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