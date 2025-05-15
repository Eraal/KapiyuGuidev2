/**
 * Counseling Socket Base Manager
 * 
 * Base class for counseling websocket connections - separated from chat functionality
 * to avoid conflicts between the two systems
 */

class CounselingBaseManager {
    constructor(options = {}) {
        this.options = {
            url: '',  // Use empty string to connect to same host
            path: '/socket.io',
            namespace: '/counseling',
            autoConnect: true,
            debug: false,
            ...options
        };

        this.socket = null;
        this.isConnected = false;
        this.eventHandlers = {};
        this.sessionId = options.sessionId;
        this.userId = options.userId;
        this.userRole = options.userRole;

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
            this._log('Connecting to counseling socket server...');

            // Create Socket.IO connection
            this.socket = io(this.options.namespace, {
                path: this.options.path,
                forceNew: true, // Force a new connection to avoid conflicts with chat
                transports: ['websocket', 'polling'],
                query: {
                    feature: 'counseling_session',
                    session_id: this.sessionId,
                    user_id: this.userId,
                    role: this.userRole
                }
            });

            // Set up connection events
            this.socket.on('connect', () => {
                this.isConnected = true;
                this._log('Counseling socket connected');
                this._triggerEvent('connect');
                this._updateConnectionStatus(true);

                // Join the session room if available
                if (this.sessionId) {
                    this.socket.emit('join_counseling_room', {
                        session_id: this.sessionId
                    });
                }
            });

            this.socket.on('disconnect', (reason) => {
                this.isConnected = false;
                this._log(`Counseling socket disconnected: ${reason}`);
                this._triggerEvent('disconnect', reason);
                this._updateConnectionStatus(false);
            });

            this.socket.on('connect_error', (error) => {
                this._log(`Counseling socket connection error: ${error.message}`);
                this._triggerEvent('error', error);
                this._updateConnectionStatus(false);
            });

            this.socket.on('reconnect', (attemptNumber) => {
                this.isConnected = true;
                this._log(`Counseling socket reconnected after ${attemptNumber} attempts`);
                this._triggerEvent('reconnect', attemptNumber);
                this._updateConnectionStatus(true);

                // Re-join the session room if available
                if (this.sessionId) {
                    this.socket.emit('join_counseling_room', {
                        session_id: this.sessionId
                    });
                }
            });

        } catch (e) {
            console.error('Error setting up counseling socket:', e);
        }
    }

    /**
     * Disconnect from Socket.IO server
     */
    disconnect() {
        if (!this.socket) return;

        // Leave the counseling room before disconnecting
        if (this.sessionId) {
            this.socket.emit('leave_counseling_room', {
                session_id: this.sessionId
            });
        }

        this.socket.disconnect();
        this.socket = null;
        this.isConnected = false;
    }

    /**
     * Register an event handler
     */
    on(event, handler) {
        if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
        }

        this.eventHandlers[event].push(handler);

        // If already connected, register with socket
        if (this.socket) {
            this.socket.on(event, handler);
        }
    }

    /**
     * Emit an event to the server
     */
    emit(event, data, callback) {
        if (!this.socket || !this.isConnected) {
            console.error(`Cannot emit ${event} - counseling socket not connected`);
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
    _triggerEvent(event, data) {
        if (event === 'connect') {
            this._registerPendingEvents();
        }

        // Trigger any registered callbacks
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.error(`Error in callback for ${event}:`, e);
                }
            });
        }
    }

    /**
     * Update connection status in the UI
     */
    _updateConnectionStatus(isConnected) {
        const connectionIndicator = document.getElementById('counseling-connection-status');
        if (connectionIndicator) {
            if (isConnected) {
                connectionIndicator.classList.remove('text-red-500');
                connectionIndicator.classList.add('text-green-500');
                connectionIndicator.title = 'Connected to counseling system';
            } else {
                connectionIndicator.classList.remove('text-green-500');
                connectionIndicator.classList.add('text-red-500');
                connectionIndicator.title = 'Disconnected from counseling system';
            }
        }
    }

    /**
     * Log messages if debug is enabled
     */
    _log(message) {
        if (this.options.debug) {
            console.log(`[CounselingBaseManager] ${message}`);
        }
    }
}

// Make globally available
window.CounselingBaseManager = CounselingBaseManager;