/**
 * Socket.IO Manager for KapiyuGuide System
 * Handles socket connection and provides interface for other components
 */

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

            // Create Socket.IO connection
            this.socket = io(this.options.url, {
                path: this.options.path,
                transports: ['websocket', 'polling']
            });

            // Set up connection events
            this.socket.on('connect', () => {
                this.isConnected = true;
                this.log('Socket connected');
                this._triggerEvent('connect');
            });

            this.socket.on('disconnect', (reason) => {
                this.isConnected = false;
                this.log(`Socket disconnected: ${reason}`);
                this._triggerEvent('disconnect', reason);
            });

            this.socket.on('connect_error', (error) => {
                this.log(`Socket connection error: ${error.message}`);
                this._triggerEvent('error', error);
            });

            this.socket.on('reconnect', (attemptNumber) => {
                this.isConnected = true;
                this.log(`Socket reconnected after ${attemptNumber} attempts`);
                this._triggerEvent('reconnect', attemptNumber);
            });

        } catch (e) {
            console.error('Error setting up socket:', e);
        }
    }

    /**
     * Disconnect from Socket.IO server
     */
    disconnect() {
        if (!this.socket) return;
        this.socket.disconnect();
    }

    /**
     * Register an event handler
     */
    on(event, handler) {
        if (!this.socket) {
            console.warn('Socket not connected yet, event handler will be registered when connected');

            // Store for later registration
            if (!this.eventHandlers[event]) {
                this.eventHandlers[event] = [];
            }
            this.eventHandlers[event].push(handler);
            return;
        }

        this.socket.on(event, handler);
    }

    /**
     * Emit an event to the server
     */
    emit(event, data, callback) {
        if (!this.socket || !this.isConnected) {
            console.error(`Cannot emit ${event} - socket not connected`);
            return false;
        }

        try {
            this.socket.emit(event, data, callback);
            return true;
        } catch (e) {
            console.error(`Error emitting ${event}:`, e);
            return false;
        }
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
    }

    /**
     * Trigger an internal event
     */
    _triggerEvent(event, ...args) {
        if (event === 'connect') {
            this._registerPendingEvents();
        }

        // Future use for custom event handling
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
        this.socketManager = new SocketManager(options);
    }

    // Connection methods
    connect() {
        this.socketManager.connect();
    }

    disconnect() {
        this.socketManager.disconnect();
    }

    // Event handlers
    on(event, handler) {
        this.socketManager.on(event, handler);
    }

    emit(event, data, callback) {
        return this.socketManager.emit(event, data, callback);
    }

    // Connection indicator
    _updateConnectionIndicator(isConnected) {
        // Base implementation - can be overridden by subclasses
        console.log(`Connection status changed: ${isConnected ? 'connected' : 'disconnected'}`);
    }

    // Base application handlers - keep this empty in the base class
    // Specific functionality should be implemented in derived classes
    _setupApplicationHandlers() {
        // No default implementation - each feature should implement their own
    }
}

/**
 * Dedicated Connection Manager
 * Helps manage multiple isolated socket connections for different features
 * This prevents conflicts between chat, video counseling, and other socket-based features
 */
class DedicatedConnectionManager {
    constructor() {
        this._connections = new Map();
    }

    /**
     * Create a new dedicated socket connection for a specific feature
     * 
     * @param {Object} options - Connection options
     * @param {string} options.feature - Feature name (e.g., 'chat', 'video_counseling')
     * @param {Object} options.query - Query parameters to send with connection
     * @param {boolean} options.debug - Enable debug logging
     * @returns {Promise<SocketIOClient.Socket>} - Promise resolving to socket instance
     */
    async createConnection(options) {
        if (!options.feature) {
            throw new Error('Feature name is required for dedicated connection');
        }

        // Check if connection already exists for this feature
        if (this._connections.has(options.feature)) {
            console.log(`Reusing existing connection for ${options.feature}`);
            return this._connections.get(options.feature);
        }

        console.log(`Creating new dedicated connection for ${options.feature}`);

        return new Promise((resolve, reject) => {
            try {
                // Create socket with forceNew to ensure isolation
                const socket = io({
                    forceNew: true,
                    query: {
                        feature: options.feature,
                        ...(options.query || {})
                    }
                });

                // Set up debug logging if enabled
                if (options.debug) {
                    socket.onAny((event, ...args) => {
                        console.log(`[${options.feature}] Received event: ${event}`, args);
                    });
                }

                // Handle connection
                socket.on('connect', () => {
                    console.log(`Dedicated connection established for ${options.feature}`);

                    // Store the connection for future reference
                    this._connections.set(options.feature, socket);

                    // Dispatch a custom event that others can listen for
                    const connectionEvent = new CustomEvent('dedicated_socket:connected', {
                        detail: {
                            feature: options.feature,
                            socketId: socket.id
                        }
                    });
                    document.dispatchEvent(connectionEvent);

                    // Resolve with the socket instance
                    resolve(socket);
                });

                // Handle connection errors
                socket.on('connect_error', (error) => {
                    console.error(`Connection error for ${options.feature}:`, error);
                    reject(error);
                });
            } catch (error) {
                console.error(`Failed to create dedicated connection for ${options.feature}:`, error);
                reject(error);
            }
        });
    }

    /**
     * Get an existing dedicated connection for a feature
     * 
     * @param {string} feature - The feature name
     * @returns {SocketIOClient.Socket|null} - The socket or null if not found
     */
    getConnection(feature) {
        return this._connections.get(feature) || null;
    }

    /**
     * Close a specific dedicated connection
     * 
     * @param {string} feature - The feature name
     */
    closeConnection(feature) {
        const socket = this._connections.get(feature);
        if (socket) {
            socket.disconnect();
            this._connections.delete(feature);
            console.log(`Closed dedicated connection for ${feature}`);
        }
    }

    /**
     * Close all dedicated connections
     */
    closeAllConnections() {
        for (const [feature, socket] of this._connections.entries()) {
            socket.disconnect();
            console.log(`Closed dedicated connection for ${feature}`);
        }
        this._connections.clear();
    }
}

// Create a global singleton instance
window.DedicatedConnectionManager = new DedicatedConnectionManager();

// Ensure connections are cleaned up when page is unloaded
window.addEventListener('beforeunload', () => {
    if (window.DedicatedConnectionManager) {
        window.DedicatedConnectionManager.closeAllConnections();
    }
});