// Student-specific Socket Manager for real-time notifications
class StudentSocketManager extends BaseSocketManager {
    constructor(options = {}) {
        super(options);
        this._studentId = window.currentUserId;
        this._setupStudentHandlers();
        this._soundEnabled = options.sound !== false;
        this._debug = options.debug === true;

        // Typing indicator functionality
        this._typingTimeouts = {};
        this._typingIndicators = {};

        // Create notification sound element
        this._createNotificationSound();
    }

    // Initialize method with promise support
    initialize() {
        // Return a promise for connection
        return new Promise((resolve, reject) => {
            // Set a timeout to fail if connection doesn't happen
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, 10000); // 10 seconds timeout

            // Try to connect and set up
            this.connect();

            // Listen for connection
            this.on('connect', () => {
                clearTimeout(timeout);

                // Update connection indicator
                const connectionStatus = document.getElementById('student-connection-status');
                if (connectionStatus) {
                    connectionStatus.classList.remove('text-red-500');
                    connectionStatus.classList.add('text-green-500');
                    connectionStatus.setAttribute('title', 'Connected to notification system');
                }

                if (this._debug) {
                    console.log('Student socket connected successfully');
                }

                resolve();
            });

            // Listen for errors
            this.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }

    _setupStudentHandlers() {
        // Listen for notification events
        this.on('notification', (data) => {
            if (data.user_id == this._studentId || !data.user_id) {
                this._showNotification(data.title, data.message, data.type || 'info');
                this._playNotificationSound();
            }
        });

        // Listen for inquiry status updates
        this.on('inquiry_status_changed', (data) => {
            if (data.student_id == this._studentId) {
                const statusText = data.status.charAt(0).toUpperCase() + data.status.slice(1);
                this._showNotification('Inquiry Status Updated',
                    `Your inquiry #${data.inquiry_id} status changed to ${statusText}`, 'info');

                // Update UI if on inquiries page
                const inquiryElement = document.getElementById('inquiry-' + data.inquiry_id);
                if (inquiryElement) {
                    const statusBadge = inquiryElement.querySelector('.status-badge');
                    if (statusBadge) {
                        // Update status badge
                        statusBadge.textContent = statusText;

                        // Update status classes
                        statusBadge.className = 'status-badge px-2 py-1 rounded-full text-xs font-semibold';
                        if (data.status === 'pending') {
                            statusBadge.classList.add('bg-yellow-100', 'text-yellow-800');
                        } else if (data.status === 'resolved') {
                            statusBadge.classList.add('bg-green-100', 'text-green-800');
                        } else if (data.status === 'rejected') {
                            statusBadge.classList.add('bg-red-100', 'text-red-800');
                        }
                    }
                }
            }
        });

        // Listen for typing indicators from staff/admin
        this.on('admin_typing', (data) => {
            this._handleTypingIndicator(data);
        });
    }

    /**
     * Handle typing indicator events
     * @param {Object} data - Typing event data from server
     */
    _handleTypingIndicator(data) {
        const { inquiry_id, office_admin_id, admin_name, is_typing } = data;

        // Find the chat container for this conversation
        const chatContainer = document.querySelector(`.chat-container[data-inquiry-id="${inquiry_id}"]`);
        if (!chatContainer) return;

        // Get or create the typing indicator element
        let typingIndicator = this._typingIndicators[inquiry_id];
        if (!typingIndicator) {
            typingIndicator = document.createElement('div');
            typingIndicator.className = 'typing-indicator admin-chat';
            typingIndicator.innerHTML = `
                <div class="typing-indicator-dot"></div>
                <div class="typing-indicator-dot"></div>
                <div class="typing-indicator-dot"></div>
            `;

            // Add name before the dots if provided
            if (admin_name) {
                const nameSpan = document.createElement('span');
                nameSpan.className = 'text-xs text-gray-600 mr-1';
                nameSpan.textContent = `${admin_name} is typing`;
                typingIndicator.insertBefore(nameSpan, typingIndicator.firstChild);
            }

            // Store the reference
            this._typingIndicators[inquiry_id] = typingIndicator;

            // Add to chat container
            const messagesContainer = chatContainer.querySelector('.chat-messages') || chatContainer;
            messagesContainer.appendChild(typingIndicator);
        }

        // Clear any existing timeout for this conversation
        if (this._typingTimeouts[inquiry_id]) {
            clearTimeout(this._typingTimeouts[inquiry_id]);
            this._typingTimeouts[inquiry_id] = null;
        }

        // Show or hide the indicator based on is_typing flag
        if (is_typing) {
            typingIndicator.classList.add('visible');

            // Auto-hide after 3 seconds if no further typing events
            this._typingTimeouts[inquiry_id] = setTimeout(() => {
                typingIndicator.classList.remove('visible');
            }, 3000);
        } else {
            typingIndicator.classList.remove('visible');
        }
    }

    /**
     * Setup typing event listeners for a chat input
     * @param {HTMLElement} inputElement - The input element to track
     * @param {Object} options - Options including inquiry_id and office_admin_id
     */
    setupTypingTracker(inputElement, { inquiry_id, office_admin_id }) {
        if (!inputElement || !inquiry_id || !office_admin_id) return;

        let typingTimer;
        let isTyping = false;

        // Function to emit typing status
        const emitTypingStatus = (typing) => {
            if (isTyping !== typing) {
                isTyping = typing;
                this.emit('student_typing', {
                    inquiry_id: inquiry_id,
                    student_id: this._studentId,
                    office_admin_id: office_admin_id,
                    is_typing: typing
                });

                if (this._debug) {
                    console.log(`Emitting typing status: ${typing ? 'typing' : 'stopped typing'}`);
                }
            }
        };

        // Listen for keydown events
        inputElement.addEventListener('keydown', () => {
            // Clear any existing timer
            if (typingTimer) clearTimeout(typingTimer);

            // Set typing status to true
            emitTypingStatus(true);

            // Set a timer to stop typing after 1.5 seconds of inactivity
            typingTimer = setTimeout(() => {
                emitTypingStatus(false);
            }, 1500);
        });

        // Also stop typing on blur
        inputElement.addEventListener('blur', () => {
            if (typingTimer) clearTimeout(typingTimer);
            emitTypingStatus(false);
        });
    }

    _createNotificationSound() {
        // Only create if it doesn't exist and sound is enabled
        if (this._soundEnabled && !document.getElementById('notification-sound')) {
            const sound = document.createElement('audio');
            sound.id = 'notification-sound';
            sound.preload = 'auto';
            sound.style.display = 'none';

            // Add MP3 source
            const source = document.createElement('source');
            source.src = '/static/sounds/notification.mp3';
            source.type = 'audio/mpeg';
            sound.appendChild(source);

            // Add fallback ogg source
            const oggSource = document.createElement('source');
            oggSource.src = '/static/sounds/notification.ogg';
            oggSource.type = 'audio/ogg';
            sound.appendChild(oggSource);

            document.body.appendChild(sound);
        }
    }

    _playNotificationSound() {
        if (!this._soundEnabled) return;

        const sound = document.getElementById('notification-sound');
        if (sound) {
            // Reset and play
            sound.pause();
            sound.currentTime = 0;
            sound.play().catch(e => console.warn('Could not play notification sound', e));
        }
    }

    // Override to add custom student-specific behavior
    _updateConnectionIndicator(isConnected) {
        // Call parent method first
        super._updateConnectionIndicator(isConnected);

        // Additional student-specific behavior
        const studentStatusIndicator = document.getElementById('student-connection-status');
        if (studentStatusIndicator) {
            if (isConnected) {
                studentStatusIndicator.classList.remove('text-red-500');
                studentStatusIndicator.classList.add('text-green-500');
                studentStatusIndicator.setAttribute('title', 'Connected to notification system');
            } else {
                studentStatusIndicator.classList.remove('text-green-500');
                studentStatusIndicator.classList.add('text-red-500');
                studentStatusIndicator.setAttribute('title', 'Disconnected from notification system');
            }
        }
    }
}

// Initialize the student socket manager when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait a moment for the base socket manager to initialize
    setTimeout(() => {
        if (window.socketManager) {
            // Use the existing socket manager if available
            console.log('Using existing socket manager for student');
        } else {
            // Create a new socket manager instance
            console.log('Creating new socket manager for student');
            window.socketManager = new StudentSocketManager({
                sound: true
            });

            // Initialize the socket connection
            window.socketManager.initialize()
                .then(() => {
                    console.log('Student socket manager initialized successfully');
                })
                .catch(error => {
                    console.error('Failed to initialize student socket manager:', error);
                });
        }
    }, 100);
});