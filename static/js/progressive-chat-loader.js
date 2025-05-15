/**
 * Progressive Chat Loader with Connection Monitoring
 * 
 * This script provides:
 * 1. Progressive loading of chat scripts based on page needs
 * 2. Connection status monitoring and recovery
 * 3. Automatic resource management
 */

class ProgressiveChatLoader {
    constructor() {
        this.loadedScripts = new Set();
        this.connectionMonitor = null;
        this.connectionStatus = true; // assume connected initially
        this.connectionAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.initialized = false;
    }

    /**
     * Initialize the loader
     */
    init() {
        if (this.initialized) return;

        console.log('[ProgressiveChatLoader] Initializing');

        // Setup connection monitoring
        this.setupConnectionMonitor();

        // Load required scripts based on page
        this.loadRequiredScripts();

        this.initialized = true;
    }

    /**
     * Load a script dynamically
     */
    loadScript(src, callback = null) {
        if (this.loadedScripts.has(src)) {
            if (callback) callback();
            return;
        }

        const script = document.createElement('script');
        script.src = src;

        if (callback) {
            script.onload = () => {
                this.loadedScripts.add(src);
                callback();
            };
        } else {
            script.onload = () => {
                this.loadedScripts.add(src);
            };
        }

        script.onerror = (err) => {
            console.error('[ProgressiveChatLoader] Failed to load script:', src, err);
        };

        document.head.appendChild(script);
    }

    /**
     * Setup connection monitoring
     */
    setupConnectionMonitor() {
        // Check if connection manager is available
        if (!window.connectionManager) {
            console.log('[ProgressiveChatLoader] Connection manager not available, loading socket.js first');
            this.loadScript('/static/js/socket.js', () => {
                this.startConnectionMonitoring();
            });
        } else {
            this.startConnectionMonitoring();
        }
    }

    /**
     * Start monitoring connection status
     */
    startConnectionMonitoring() {
        console.log('[ProgressiveChatLoader] Setting up connection monitor');

        // Use a status indicator element if available
        this.statusIndicator = document.getElementById('connection-status') || this.createStatusIndicator();

        // Listen for connection events
        document.addEventListener('socket:connected', () => {
            this.handleConnectionChange(true);
        });

        document.addEventListener('socket:disconnected', () => {
            this.handleConnectionChange(false);
        });

        document.addEventListener('socket:reconnected', () => {
            this.handleConnectionChange(true);
        });

        // Start periodic connection checking
        this.connectionMonitor = setInterval(() => this.checkConnection(), 30000); // Check every 30s
    }

    /**
     * Create a status indicator element if one doesn't exist
     */
    createStatusIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'connection-status';
        indicator.className = 'fixed bottom-2 right-2 z-50 p-2 bg-gray-800 bg-opacity-75 rounded-full text-white text-xs';
        indicator.style.display = 'none';
        indicator.innerHTML = '<i class="fas fa-wifi"></i>';
        document.body.appendChild(indicator);
        return indicator;
    }

    /**
     * Handle connection status changes
     */
    handleConnectionChange(isConnected) {
        this.connectionStatus = isConnected;

        if (isConnected) {
            this.connectionAttempts = 0;
            this.statusIndicator.style.display = 'none';
            console.log('[ProgressiveChatLoader] Connection established');

            // Dispatch event for other components
            document.dispatchEvent(new CustomEvent('connection:status', {
                detail: { status: 'connected' }
            }));
        } else {
            this.statusIndicator.style.display = 'block';
            this.statusIndicator.innerHTML = '<i class="fas fa-wifi text-red-500"></i>';
            console.log('[ProgressiveChatLoader] Connection lost');

            // Dispatch event for other components
            document.dispatchEvent(new CustomEvent('connection:status', {
                detail: { status: 'disconnected' }
            }));

            // Attempt reconnection if not already trying
            if (this.connectionAttempts < this.maxReconnectAttempts) {
                this.attemptReconnection();
            }
        }
    }

    /**
     * Check connection status
     */
    checkConnection() {
        // Skip if the window is not focused
        if (document.hidden) return;

        if (window.socketManager && window.socketManager.socketManager) {
            const isConnected = window.socketManager.socketManager.isConnected;

            // If our last known state doesn't match current state
            if (this.connectionStatus !== isConnected) {
                this.handleConnectionChange(isConnected);
            }

            // If we think we're connected, but haven't received events in a while
            // We might need to check by sending a ping
            if (this.connectionStatus && window.socketManager.socketManager.socket) {
                window.socketManager.socketManager.socket.emit('ping', {}, (response) => {
                    if (!response) {
                        // No response to ping, we're probably disconnected
                        this.handleConnectionChange(false);
                    }
                });
            }
        }
    }

    /**
     * Attempt to reconnect
     */
    attemptReconnection() {
        this.connectionAttempts++;
        this.statusIndicator.innerHTML = `<i class="fas fa-sync-alt fa-spin"></i> Reconnecting (${this.connectionAttempts}/${this.maxReconnectAttempts})`;
        console.log(`[ProgressiveChatLoader] Attempting reconnection ${this.connectionAttempts}/${this.maxReconnectAttempts}`);

        // Try to reconnect via the connection manager
        if (window.connectionManager) {
            window.connectionManager.getConnection()
                .then(() => {
                    this.handleConnectionChange(true);
                })
                .catch(() => {
                    if (this.connectionAttempts >= this.maxReconnectAttempts) {
                        this.statusIndicator.innerHTML = '<i class="fas fa-wifi text-red-500"></i> Connection failed';
                        console.log('[ProgressiveChatLoader] Max reconnection attempts reached');
                    } else {
                        // Try again after a delay
                        setTimeout(() => this.attemptReconnection(), 5000);
                    }
                });
        }
    }

    /**
     * Load required scripts based on the current page
     */
    loadRequiredScripts() {
        // Load core scripts
        const scriptsToLoad = [];

        // Check if we're on a page with chat functionality
        if (document.querySelector('[data-chat-container]')) {
            scriptsToLoad.push('/static/js/notification-sound-manager.js');
            scriptsToLoad.push('/static/js/inquiry-chat.js');
            scriptsToLoad.push('/static/js/chat-init.js');
        }

        // Check if we're on a page with video counseling
        if (document.querySelector('#videoSession') || window.location.pathname.includes('/video-session/')) {
            scriptsToLoad.push('/static/js/notification-sound-manager.js');
        }

        // Load scripts sequentially
        if (scriptsToLoad.length > 0) {
            let index = 0;
            const loadNext = () => {
                if (index < scriptsToLoad.length) {
                    this.loadScript(scriptsToLoad[index], () => {
                        index++;
                        loadNext();
                    });
                }
            };
            loadNext();
        }
    }

    /**
     * Clean up resources
     */
    cleanup() {
        if (this.connectionMonitor) {
            clearInterval(this.connectionMonitor);
        }

        // Remove status indicator if we created it
        if (this.statusIndicator && this.statusIndicator.parentNode && this.statusIndicator.id === 'connection-status') {
            this.statusIndicator.parentNode.removeChild(this.statusIndicator);
        }
    }
}

// Initialize on DOM loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chatLoader = new ProgressiveChatLoader();
    window.chatLoader.init();
});