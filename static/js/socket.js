/**
 * Socket.IO Manager for KapiyuGuide System
 * Handles socket connection and provides interface for other components
 */

// ConnectionManager singleton to ensure only one connection is used across the application
class ConnectionManager {
    constructor() {
        this.connection = null;
        this.connectionPromise = null;
        this.handlers = [];
        this.debug = true;
    }

    // Get the shared socket connection instance
    getConnection() {
        if (!this.connectionPromise) {
            this.connectionPromise = new Promise((resolve, reject) => {
                try {
                    // Create the socket connection if it doesn't exist
                    if (!this.connection) {
                        console.log('[ConnectionManager] Creating new socket.io connection');
                        this.connection = io({
                            transports: ['websocket', 'polling'],
                            reconnectionAttempts: 10,
                            reconnectionDelay: 1000,
                            timeout: 20000
                        });

                        // Listen for connection events
                        this.connection.on('connect', () => {
                            console.log('[ConnectionManager] Socket connected');
                            this._notifyHandlers('connect');
                        });

                        this.connection.on('disconnect', (reason) => {
                            console.log('[ConnectionManager] Socket disconnected:', reason);
                            this._notifyHandlers('disconnect', reason);
                        });

                        this.connection.on('reconnect', (attemptNumber) => {
                            console.log('[ConnectionManager] Socket reconnected after', attemptNumber, 'attempts');
                            this._notifyHandlers('reconnect', attemptNumber);
                        });

                        this.connection.on('connect_error', (error) => {
                            console.error('[ConnectionManager] Socket connection error:', error);
                            this._notifyHandlers('error', error);
                        });
                    }

                    // Resolve with the socket connection
                    if (this.connection.connected) {
                        resolve(this.connection);
                    } else {
                        // If not connected yet, wait for the 'connect' event
                        this.connection.once('connect', () => {
                            resolve(this.connection);
                        });
                    }
                } catch (error) {
                    console.error('[ConnectionManager] Error creating socket connection:', error);
                    reject(error);
                }
            });
        }

        return this.connectionPromise;
    }

    // Add a connection event handler
    addConnectionHandler(handler) {
        this.handlers.push(handler);
    }

    // Remove a connection event handler
    removeConnectionHandler(handler) {
        const index = this.handlers.indexOf(handler);
        if (index !== -1) {
            this.handlers.splice(index, 1);
        }
    }

    // Notify all connection event handlers
    _notifyHandlers(event, ...args) {
        this.handlers.forEach(handler => {
            if (typeof handler[event] === 'function') {
                try {
                    handler[event](...args);
                } catch (error) {
                    console.error('[ConnectionManager] Error in handler:', error);
                }
            }
        });
    }

    // Debug utility
    log(message) {
        if (this.debug) {
            console.log(`[ConnectionManager] ${message}`);
        }
    }
}

// Create a global instance
window.connectionManager = new ConnectionManager();

class SocketManager {
    constructor(options = {}) {
        this.options = {
            url: '',  // Use empty string to connect to same host
            path: '/socket.io',
            autoConnect: true,
            debug: false,
            ...options
        };

        this.socket = null;
        this.isConnected = false;
        this.eventHandlers = {};

        if (this.options.autoConnect) {
            this.connect();
        }
    }

    /**
     * Connect to the Socket.IO server
     */
    connect() {
        if (this.socket) return;

        try {
            this.log('Connecting to socket server...');

            // Get the shared connection from ConnectionManager
            window.connectionManager.getConnection()
                .then(socket => {
                    this.socket = socket;
                    this.isConnected = socket.connected;

                    if (this.isConnected) {
                        this._triggerEvent('connect');
                    }

                    // Register existing event handlers
                    this._registerPendingEvents();
                })
                .catch(error => {
                    console.error('[SocketManager] Failed to get connection:', error);
                });

        } catch (e) {
            console.error('Error setting up socket:', e);
        }
    }

    /**
     * Disconnect from Socket.IO server
     */
    disconnect() {
        // We don't actually disconnect the socket since it's shared
        // but we can remove our event handlers
        if (this.socket) {
            Object.keys(this.eventHandlers).forEach(event => {
                this.eventHandlers[event].forEach(handler => {
                    this.socket.off(event, handler);
                });
            });

            this.eventHandlers = {};
            this.isConnected = false;
        }
    }

    /**
     * Register an event handler
     */
    on(event, handler) {
        if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
        }

        this.eventHandlers[event].push(handler);

        if (this.socket) {
            this.socket.on(event, handler);
            this.log(`Registered handler for event: ${event}`);
        } else {
            this.log(`Event handler for ${event} queued for when socket connects`);
        }
    }

    /**
     * Emit an event to the server
     */
    emit(event, data, callback) {
        if (!this.socket) {
            this.log(`Cannot emit event ${event} - socket not connected`);
            return;
        }

        this.socket.emit(event, data, callback);
        this.log(`Emitted event: ${event}`);
        return this;
    }

    /**
     * Register for events that will be applied when socket connects
     */
    _registerPendingEvents() {
        if (!this.socket) return;

        Object.keys(this.eventHandlers).forEach(event => {
            this.eventHandlers[event].forEach(handler => {
                this.socket.on(event, handler);
            });
        });

        this.log('Registered all pending event handlers');
    }

    /**
     * Trigger an internal event
     */
    _triggerEvent(event, ...args) {
        if (event === 'connect') {
            this._registerPendingEvents();
        }
    }

    /**
     * Log messages if debug is enabled
     */
    log(message) {
        if (this.options.debug) {
            console.log(`[SocketManager] ${message}`);
        }
    }
}

// Make globally available
window.SocketManager = SocketManager;

class BaseSocketManager {
    constructor(options = {}) {
        // Create a SocketManager instance
        this.socketManager = new SocketManager({
            debug: true,
            ...options
        });

        // Keep track of joined rooms
        this._joinedRooms = new Set();
        this._connectPromise = null;
        this._featureEventHandlers = {};  // Store event handlers by feature
        this._activeFeatures = new Set(); // Track active features

        // Event namespace tracking to prevent conflicts 
        this._eventNamespaces = {
            'chat': new Set(),      // Track chat event IDs to prevent duplicates
            'counseling': new Set() // Track counseling event IDs to prevent duplicates
        };

        // Health check system
        this._healthCheckInterval = null;
        this._lastHealthCheckTime = Date.now();

        // Store original socket if provided (for video sessions)
        this._originalSocket = options.socket || null;

        // Setup connection event handlers only
        this._setupConnectionHandlers();
    }

    /**
     * Start periodic health checks to maintain connection and room memberships
     */
    startHealthChecks() {
        if (this._healthCheckInterval) {
            clearInterval(this._healthCheckInterval);
        }

        console.log('Starting WebSocket health check system');

        // Run health check every 30 seconds
        this._healthCheckInterval = setInterval(() => {
            this._performHealthCheck();
        }, 30000);

        // Run immediately
        this._performHealthCheck();
    }

    /**
     * Stop health checks
     */
    stopHealthChecks() {
        if (this._healthCheckInterval) {
            clearInterval(this._healthCheckInterval);
            this._healthCheckInterval = null;
        }
    }

    /**
     * Perform connection health check
     * @private
     */
    _performHealthCheck() {
        const now = Date.now();
        this._lastHealthCheckTime = now;

        // Skip if not connected
        if (!this.socketManager.isConnected || !this.socketManager.socket) {
            console.warn('Health check: Socket not connected, reconnecting...');
            this.connect();
            return;
        }

        console.log('WebSocket health check: Connection OK');

        // Ping server to check connection
        this.socketManager.socket.emit('ping', { timestamp: now }, (response) => {
            if (response && response.timestamp) {
                const latency = Date.now() - response.timestamp;
                console.log(`WebSocket latency: ${latency}ms`);
            }
        });

        // Trigger room verification event
        document.dispatchEvent(new CustomEvent('socket:health_check', {
            detail: { timestamp: now }
        }));

        return true;
    }

    // Connection methods
    connect() {
        this.socketManager.connect();
    }

    disconnect() {
        this.socketManager.disconnect();
    }

    // Debug output to help troubleshoot
    debug() {
        console.log('===== BaseSocketManager Debug Information =====');
        console.log('Connected:', this.socketManager.isConnected);
        console.log('Socket instance:', !!this.socketManager.socket);
        console.log('Joined rooms:', Array.from(this._joinedRooms));
        console.log('Active features:', Array.from(this._activeFeatures));
        console.log('Feature event handlers:', Object.keys(this._featureEventHandlers).map(feature => ({
            feature,
            count: this._featureEventHandlers[feature]?.length || 0
        })));
    }

    // Event handlers
    on(event, handler, feature = 'general') {
        // Store the handler by feature for management
        if (!this._featureEventHandlers[feature]) {
            this._featureEventHandlers[feature] = [];
        }

        this._featureEventHandlers[feature].push({
            event: event,
            handler: handler
        });

        // Register with socket
        this.socketManager.on(event, handler);
    }

    emit(event, data, callback) {
        return this.socketManager.emit(event, data, callback);
    }

    // Join a socket room - with tracking to avoid duplicates
    joinRoom(roomName) {
        if (this._joinedRooms.has(roomName)) {
            console.log(`Already joined room: ${roomName}`);
            return;
        }

        this.emit('join', { room: roomName });
        this._joinedRooms.add(roomName);
        console.log(`Joined room: ${roomName}`);
    }

    // Leave a socket room
    leaveRoom(roomName) {
        if (!this._joinedRooms.has(roomName)) {
            console.log(`Not in room: ${roomName}`);
            return;
        }

        this.emit('leave', { room: roomName });
        this._joinedRooms.delete(roomName);
        console.log(`Left room: ${roomName}`);
    }

    // Manage features
    activateFeature(feature) {
        if (this._activeFeatures.has(feature)) {
            console.log(`Feature ${feature} is already active`);
            return;
        }

        console.log(`Activating feature: ${feature}`);

        switch (feature) {
            case 'chat':
                this._setupChatHandlers();
                break;
            case 'counseling':
                this._setupCounselingHandlers();
                break;
            case 'announcement':
                this._setupAnnouncementHandlers();
                break;
            case 'notification':
                this._setupNotificationHandlers();
                break;
            default:
                console.warn(`Unknown feature: ${feature}`);
                return;
        }

        this._activeFeatures.add(feature);
    }

    deactivateFeature(feature) {
        if (!this._activeFeatures.has(feature)) {
            console.log(`Feature ${feature} is not active`);
            return;
        }

        console.log(`Deactivating feature: ${feature}`);
        this.cleanupFeatureHandlers(feature);
        this._activeFeatures.delete(feature);
    }

    // Setup connection event handlers
    _setupConnectionHandlers() {
        // Handle connect event
        this.on('connect', () => {
            console.log('Connected to socket server');
            this._updateConnectionIndicator(true);

            // Rejoin any rooms we were in before
            this._joinedRooms.forEach(room => {
                this.emit('join', { room });
                console.log(`Rejoined room after reconnection: ${room}`);
            });

            // Emit custom event that other components can listen for
            document.dispatchEvent(new Event('socket:connected'));
        }, 'connection');

        // Handle disconnect event
        this.on('disconnect', (reason) => {
            console.log(`Disconnected from socket server: ${reason}`);
            this._updateConnectionIndicator(false);

            // Emit custom event
            document.dispatchEvent(new Event('socket:disconnected'));
        }, 'connection');

        // Handle error
        this.on('error', (error) => {
            console.error('Socket error:', error);
            this._updateConnectionIndicator(false);
        }, 'connection');

        // Handle reconnect
        this.on('reconnect', () => {
            console.log('Reconnected to socket server');
            this._updateConnectionIndicator(true);

            // Emit custom event
            document.dispatchEvent(new Event('socket:reconnected'));
        }, 'connection');
    }

    // Connection indicator
    _updateConnectionIndicator(isConnected) {
        // Base implementation - can be overridden by subclasses
        console.log(`Connection status changed: ${isConnected ? 'connected' : 'disconnected'}`);
    }

    /**
     * Helper method to handle namespaced events and prevent duplicates
     * @param {string} namespace - The namespace for the event (e.g., 'chat', 'counseling')
     * @param {string} eventId - A unique identifier for the event
     * @param {Function} handler - The handler function to execute if not a duplicate
     * @returns {boolean} - True if handled, false if duplicate
     */
    handleNamespacedEvent(namespace, eventId, handler) {
        // Check if we're tracking this namespace
        if (!this._eventNamespaces[namespace]) {
            this._eventNamespaces[namespace] = new Set();
        }

        // Check if we've already processed this event
        if (this._eventNamespaces[namespace].has(eventId)) {
            console.log(`[${namespace}] Skipping duplicate event: ${eventId}`);
            return false;
        }

        // Add to processed set
        this._eventNamespaces[namespace].add(eventId);

        // Limit the size of the set to prevent memory leaks
        if (this._eventNamespaces[namespace].size > 100) {
            // Remove oldest items (first 20) when we hit 100
            const toRemove = Array.from(this._eventNamespaces[namespace]).slice(0, 20);
            toRemove.forEach(id => this._eventNamespaces[namespace].delete(id));
        }

        // Execute the handler
        handler();
        return true;
    }

    // Setup chat-specific event handlers
    _setupChatHandlers() {
        console.log('Setting up chat event handlers');

        // Add direct socket event listeners for debugging
        if (this.socketManager.socket) {
            this.socketManager.socket.on('new_chat_message', (data) => {
                console.log('[BASE-DIRECT] new_chat_message received directly:', data);
            });

            this.socketManager.socket.on('new_message', (data) => {
                console.log('[BASE-DIRECT] new_message received directly:', data);
            });

            this.socketManager.socket.on('student_message_sent', (data) => {
                console.log('[BASE-DIRECT] student_message_sent received directly:', data);
            });

            this.socketManager.socket.on('admin_message_sent', (data) => {
                console.log('[BASE-DIRECT] admin_message_sent received directly:', data);
            });
        }

        // Message receipt events
        this.on('message_received', (data) => {
            console.log('Message received confirmation:', data);
        }, 'chat');

        this.on('message_delivered', (data) => {
            console.log('Message delivered confirmation:', data);
        }, 'chat');

        this.on('message_read', (data) => {
            console.log('Message read confirmation:', data);
        }, 'chat');

        this.on('message_status_update', (data) => {
            console.log('Message status update:', data);

            // Dispatch custom event
            document.dispatchEvent(new CustomEvent('chat:status_update', {
                detail: data
            }));
        }, 'chat');

        // Handle all message types for chat functionality
        const messageEvents = ['new_chat_message', 'new_message', 'student_message_sent', 'chat_message', 'admin_message_sent'];

        messageEvents.forEach(eventType => {
            this.on(eventType, (data) => {
                console.log(`Message received (${eventType}):`, data);

                // Normalize message ID (some events use different field names)
                const messageId = data.message_id || data.id;
                if (!messageId) {
                    console.warn(`Message has no ID (${eventType})`, data);
                    return;
                }

                // Check if message already exists in DOM to avoid duplicates
                const existingMessage = document.querySelector(`.message-bubble[data-message-id="${messageId}"]`);
                if (existingMessage) {
                    console.log(`Message ${messageId} already exists in DOM, skipping dispatch`);
                    return;
                }

                // Ensure data has a normalized message_id field
                const normalizedData = {
                    ...data,
                    message_id: messageId
                };

                // Dispatch a custom event so that the chat UI can update immediately
                const event = new CustomEvent('chat:new_message', {
                    detail: { ...normalizedData, eventType }
                });
                document.dispatchEvent(event);
            }, 'chat');
        });

        // Handle typing indicators
        const typingEvents = ['user_typing', 'student_typing', 'admin_typing', 'typing_indicator'];

        typingEvents.forEach(eventType => {
            this.on(eventType, (data) => {
                console.log(`Typing indicator received (${eventType}):`, data);

                // Dispatch a custom event for typing indicators
                const event = new CustomEvent('chat:typing_indicator', {
                    detail: { ...data, eventType }
                });
                document.dispatchEvent(event);
            }, 'chat');
        });

        // Handle room joined event to ensure proper room setup
        this.on('room_joined', (data) => {
            console.log('Room joined:', data);
            if (data.room && data.status === 'success') {
                this._joinedRooms.add(data.room);
            }
        }, 'chat');

        // Listen for reconnection to rejoin chat rooms
        document.addEventListener('socket:reconnected', () => {
            console.log('Socket reconnected - rejoining rooms for chat feature');

            // Get current inquiry ID if on an inquiry page
            const inquiryIdMatch = window.location.pathname.match(/\/inquiry\/(\d+)/);
            if (inquiryIdMatch && inquiryIdMatch[1]) {
                const inquiryId = inquiryIdMatch[1];
                this.joinRoom(`inquiry_${inquiryId}`);
                this.joinRoom(`inquiry_view_${inquiryId}`);
                console.log(`Rejoined inquiry rooms after reconnection: inquiry_${inquiryId}`);
            }
        });
    }

    // Setup counseling-specific event handlers
    _setupCounselingHandlers() {
        console.log('Setting up counseling event handlers');

        // Video counseling events
        const counselingEvents = [
            'video_offer',
            'video_answer',
            'ice_candidate',
            'waiting_room_status',
            'call_status',
            'user_joined',
            'user_left',
            'start_call',
            'end_call'
        ];

        counselingEvents.forEach(eventType => {
            this.on(eventType, (data) => {
                console.log(`Counseling event received (${eventType}):`, data);

                // Dispatch a custom event for counseling
                const event = new CustomEvent('counseling:event', {
                    detail: { ...data, eventType }
                });
                document.dispatchEvent(event);
            }, 'counseling');
        });

        // Session management events
        const sessionEvents = [
            'counseling_session_created',
            'counseling_session_updated',
            'session_update',
            'new_counseling_request'
        ];

        sessionEvents.forEach(eventType => {
            this.on(eventType, (data) => {
                console.log(`Session event received (${eventType}):`, data);

                // Dispatch a custom event for session updates
                const event = new CustomEvent('counseling:session_update', {
                    detail: { ...data, eventType }
                });
                document.dispatchEvent(event);
            }, 'counseling');
        });
    }

    // Setup announcement-specific event handlers
    _setupAnnouncementHandlers() {
        console.log('Setting up announcement event handlers');

        // Announcement events
        const announcementEvents = [
            'announcement_created',
            'announcement_updated',
            'announcement_deleted',
            'admin_announcement_created',
            'office_announcement_created',
            'new_announcement'
        ];

        announcementEvents.forEach(eventType => {
            this.on(eventType, (data) => {
                console.log(`Announcement event received (${eventType}):`, data);

                // Dispatch a custom event for announcements
                const event = new CustomEvent('announcement:event', {
                    detail: { ...data, eventType }
                });
                document.dispatchEvent(event);
            }, 'announcement');
        });
    }

    // Setup notification event handlers
    _setupNotificationHandlers() {
        console.log('Setting up notification event handlers');

        // Notification events
        const notificationEvents = [
            'notification',
            'new_notification',
            'system_alert',
            'inquiry_status_changed',
            'inquiry_update'
        ];

        notificationEvents.forEach(eventType => {
            this.on(eventType, (data) => {
                console.log(`Notification received (${eventType}):`, data);

                // Dispatch a custom event for notifications
                const event = new CustomEvent('notification:received', {
                    detail: { ...data, eventType }
                });
                document.dispatchEvent(event);
            }, 'notification');
        });
    }

    // Clean up event handlers for a specific feature
    cleanupFeatureHandlers(feature) {
        if (!this._featureEventHandlers[feature]) {
            return;
        }

        console.log(`Cleaning up event handlers for feature: ${feature}`);

        // Get the list of handlers to clean up
        const handlers = this._featureEventHandlers[feature];

        // Remove each handler from the socket
        handlers.forEach(({ event, handler }) => {
            if (this.socketManager.socket) {
                this.socketManager.socket.off(event, handler);
            }
        });

        // Clear the handlers list
        this._featureEventHandlers[feature] = [];
    }

    // Helper to determine which features to activate based on page
    detectPageFeatures() {
        // Base implementation - detect common features based on page URL or elements
        const features = new Set();

        // Always activate notification system
        features.add('notification');

        // Check for chat-related features
        if (document.querySelector('.chat-container') || window.location.pathname.match(/\/inquiry\/(\d+)/)) {
            features.add('chat');
        }

        // Check for counseling-related features
        if (document.querySelector('[data-counseling-id]') ||
            document.querySelector('[data-session-id]') ||
            window.location.pathname.includes('/counseling/') ||
            window.location.pathname.includes('/video-session/')) {
            features.add('counseling');
        }

        // Check for announcement-related features
        if (document.querySelector('#announcements') ||
            window.location.pathname.includes('/announcements')) {
            features.add('announcement');
        }

        return Array.from(features);
    }

    // Activate features based on current page
    activatePageFeatures() {
        const features = this.detectPageFeatures();
        console.log('Detected features for current page:', features);

        features.forEach(feature => this.activateFeature(feature));
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SocketManager, BaseSocketManager, ConnectionManager };
} else {
    // Create global instances when in browser
    window.socketManager = null;

    // Initialize socket manager when page loads
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.socketManager) {
            console.log('Creating global socketManager instance');
            window.socketManager = new BaseSocketManager();

            // Activate features based on page
            window.socketManager.activatePageFeatures();
        }
    });
}