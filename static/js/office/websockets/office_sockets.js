// Office-specific Socket Manager for real-time notifications
class OfficeSocketManager extends BaseSocketManager {
    constructor(options = {}) {
        super(options);
        this._officeId = options.officeId || null;
        this._setupOfficeHandlers();
        this._soundEnabled = options.sound !== false;
        this._userId = window.currentUserId;

        // Status tracking
        this._lastActiveTime = Date.now();
        this._heartbeatInterval = null;
        this._isActive = true;
        this._visibilityHandler = this._handleVisibilityChange.bind(this);

        // Typing indicator functionality
        this._typingTimeouts = {};
        this._typingIndicators = {};

        // Create notification sound element
        this._createNotificationSound();

        // Set up heartbeat and visibility tracking
        this._setupActivityTracking();
    }

    _setupActivityTracking() {
        // Set up heartbeat to send status updates
        this._heartbeatInterval = setInterval(() => this._sendHeartbeat(), 30000); // Every 30 seconds

        // Track user activity events
        document.addEventListener('mousemove', () => this._updateActivity());
        document.addEventListener('keydown', () => this._updateActivity());
        document.addEventListener('mousedown', () => this._updateActivity());
        document.addEventListener('touchstart', () => this._updateActivity());

        // Track page visibility
        document.addEventListener('visibilitychange', this._visibilityHandler);

        // Send initial status on load
        this._updateActivity();

        // Handle before unload
        window.addEventListener('beforeunload', () => {
            this.emit('staff_status', {
                user_id: this._userId,
                office_id: this._officeId,
                status: 'offline',
                timestamp: Date.now()
            });
        });
    }

    _handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            this._isActive = true;
            this._updateActivity();
        } else {
            this._isActive = false;
            this.emit('staff_status', {
                user_id: this._userId,
                office_id: this._officeId,
                status: 'away',
                timestamp: Date.now()
            });
        }
    }

    _updateActivity() {
        this._lastActiveTime = Date.now();
        if (this._isActive) {
            this.emit('staff_status', {
                user_id: this._userId,
                office_id: this._officeId,
                status: 'online',
                timestamp: this._lastActiveTime
            });
        }
    }

    _sendHeartbeat() {
        const now = Date.now();
        const idleTime = now - this._lastActiveTime;

        // If idle for more than 5 minutes but still connected
        let status = 'online';
        if (idleTime > 300000) { // 5 minutes
            status = 'idle';
        } else if (!this._isActive) {
            status = 'away';
        }

        // Send status update
        this.emit('staff_status', {
            user_id: this._userId,
            office_id: this._officeId,
            status: status,
            timestamp: now
        });

        // Update UI indicator
        this._updateStatusIndicator(status);
    }

    _updateStatusIndicator(status) {
        const statusIndicator = document.getElementById('staff-status-indicator');
        if (statusIndicator) {
            // Remove all status classes
            statusIndicator.classList.remove('bg-green-500', 'bg-yellow-500', 'bg-gray-400', 'bg-red-500');

            // Add appropriate class based on status
            switch (status) {
                case 'online':
                    statusIndicator.classList.add('bg-green-500');
                    statusIndicator.setAttribute('title', 'Online');
                    break;
                case 'idle':
                    statusIndicator.classList.add('bg-yellow-500');
                    statusIndicator.setAttribute('title', 'Idle');
                    break;
                case 'away':
                    statusIndicator.classList.add('bg-yellow-500');
                    statusIndicator.setAttribute('title', 'Away');
                    break;
                case 'offline':
                    statusIndicator.classList.add('bg-gray-400');
                    statusIndicator.setAttribute('title', 'Offline');
                    break;
                default:
                    statusIndicator.classList.add('bg-red-500');
                    statusIndicator.setAttribute('title', 'Connection issue');
            }
        }
    }

    // Make sure to clean up when we're done
    disconnect() {
        // Send offline status before disconnecting
        this.emit('staff_status', {
            user_id: this._userId,
            office_id: this._officeId,
            status: 'offline',
            timestamp: Date.now()
        });

        // Clear intervals and event listeners
        if (this._heartbeatInterval) {
            clearInterval(this._heartbeatInterval);
        }

        document.removeEventListener('visibilitychange', this._visibilityHandler);

        // Call parent method
        super.disconnect();
    }

    _setupOfficeHandlers() {
        // Listen for new inquiries specific to this office
        this.on('new_inquiry', (data) => {
            if (!this._officeId || data.office_id == this._officeId) {
                this._showNotification('New Student Inquiry', `${data.student_name} has submitted a new inquiry: ${data.subject}`, 'info');
                this._incrementInquiryCounter();
                this._playNotificationSound();

                // Refresh the page if we're on the inquiries page
                if (window.location.pathname.includes('/office_inquiries') && !document.getElementById('inquiry-' + data.inquiry_id)) {
                    setTimeout(() => {
                        window.location.reload();
                    }, 2000); // Delay to allow user to see notification
                }
            }
        });

        // Listen for counseling requests
        this.on('new_counseling_request', (data) => {
            if (!this._officeId || data.office_id == this._officeId) {
                this._showNotification('New Counseling Request',
                    `${data.student_name} has requested a counseling session`, 'info');
                this._incrementCounselingCounter();
                this._playNotificationSound();

                // Refresh the page if we're on the counseling page
                if (window.location.pathname.includes('/video_counseling') && !document.getElementById('session-' + data.session_id)) {
                    setTimeout(() => {
                        window.location.reload();
                    }, 2000); // Delay to allow user to see notification
                }
            }
        });

        // Listen for notification events
        this.on('notification', (data) => {
            if (data.user_id == window.currentUserId || !data.user_id) {
                this._showNotification(data.title, data.message, data.type || 'info');
                this._updateNotificationBadge(1); // Increment count by 1
                this._playNotificationSound();
            }
        });

        // Listen for student messages sent through both events
        // This handles messages sent directly through socket.io
        this.on('student_message_sent', (data) => {
            console.log('Received student message:', data);
            this._handleNewMessage(data);
        });

        // This handles messages emitted from the server-side emit_inquiry_reply function
        this.on('new_chat_message', (data) => {
            console.log('Received chat message:', data);
            this._handleNewMessage(data);
        });

        // Add support for 'new_message' event which is used by student_sockets.py
        this.on('new_message', (data) => {
            console.log('Received new message:', data);
            this._handleNewMessage(data);
        });

        // Listen for staff status updates from other staff
        this.on('staff_status_update', (data) => {
            // Update UI for specific staff member if displayed
            const staffElement = document.getElementById('staff-' + data.user_id);
            if (staffElement) {
                const statusDot = staffElement.querySelector('.status-indicator');
                if (statusDot) {
                    // Remove existing classes
                    statusDot.classList.remove('bg-green-500', 'bg-yellow-500', 'bg-red-500', 'bg-gray-500');

                    // Add appropriate class
                    switch (data.status) {
                        case 'online':
                            statusDot.classList.add('bg-green-500');
                            statusDot.setAttribute('title', 'Online');
                            break;
                        case 'idle':
                        case 'away':
                            statusDot.classList.add('bg-yellow-500');
                            statusDot.setAttribute('title', data.status.charAt(0).toUpperCase() + data.status.slice(1));
                            break;
                        case 'offline':
                            statusDot.classList.add('bg-gray-500');
                            statusDot.setAttribute('title', 'Offline');
                            break;
                        default:
                            statusDot.classList.add('bg-red-500');
                            statusDot.setAttribute('title', 'Unknown');
                    }
                }
            }
        });

        // Listen for inquiry status updates
        this.on('inquiry_status_changed', (data) => {
            if (!this._officeId || data.office_id == this._officeId) {
                const statusText = data.status.charAt(0).toUpperCase() + data.status.slice(1);
                this._showNotification('Inquiry Status Updated',
                    `Inquiry #${data.inquiry_id} status changed to ${statusText}`, 'info');

                // Update UI if on inquiries page
                const inquiryElement = document.getElementById('inquiry-' + data.inquiry_id);
                if (inquiryElement) {
                    const statusBadge = inquiryElement.querySelector('.status-badge');
                    if (statusBadge) {
                        // Update status badge
                        statusBadge.textContent = statusText;

                        // Remove old status classes
                        statusBadge.classList.remove('bg-yellow-100', 'bg-green-100', 'bg-red-100', 'text-yellow-800', 'text-green-800', 'text-red-800');

                        // Add appropriate status classes
                        if (data.status === 'pending') {
                            statusBadge.classList.add('bg-yellow-100', 'text-yellow-800');
                        } else if (data.status === 'resolved') {
                            statusBadge.classList.add('bg-green-100', 'text-green-800');
                        } else if (data.status === 'rejected') {
                            statusBadge.classList.add('bg-red-100', 'text-red-800');
                        }

                        // Highlight row briefly
                        inquiryElement.classList.add('bg-blue-50');
                        setTimeout(() => {
                            inquiryElement.classList.remove('bg-blue-50');
                        }, 3000);
                    }
                }
            }
        });

        // Listen for typing indicators
        this.on('user_typing', (data) => {
            this._handleTypingIndicator(data);
        });

        // Listen for typing indicators from students
        this.on('student_typing', (data) => {
            this._handleTypingIndicator(data);
        });

        // Listen for typing indicators from other staff/admins
        this.on('admin_typing', (data) => {
            // Only handle if it's not from the current user
            if (data.office_admin_id !== this._userId) {
                this._handleTypingIndicator(data);
            }
        });
    }

    /**
     * Handle typing indicator events
     * @param {Object} data - Typing event data from server
     */
    _handleTypingIndicator(data) {
        const { inquiry_id, student_id, user_id, user_name, is_typing } = data;

        // Determine if this is a student typing or another admin
        const isStudent = !!student_id;
        const userId = student_id || user_id;
        const userName = user_name || (isStudent ? 'Student' : 'Admin');

        // Find the chat container for this conversation
        const chatContainer = document.querySelector(`.chat-container[data-inquiry-id="${inquiry_id}"]`);
        if (!chatContainer) return;

        // Use a unique identifier for the typing indicator
        const typingId = `${inquiry_id}-${userId}`;

        // Get or create the typing indicator element
        let typingIndicator = this._typingIndicators[typingId];
        if (!typingIndicator) {
            typingIndicator = document.createElement('div');
            typingIndicator.className = `typing-indicator ${isStudent ? 'student-chat' : 'admin-chat'}`;
            typingIndicator.innerHTML = `
                <div class="typing-indicator-dot"></div>
                <div class="typing-indicator-dot"></div>
                <div class="typing-indicator-dot"></div>
            `;

            // Add name before the dots if provided
            const nameSpan = document.createElement('span');
            nameSpan.className = 'text-xs text-gray-600 mr-1';
            nameSpan.textContent = `${userName} is typing`;
            typingIndicator.insertBefore(nameSpan, typingIndicator.firstChild);

            // Store the reference
            this._typingIndicators[typingId] = typingIndicator;

            // Add to chat container
            const messagesContainer = chatContainer.querySelector('.chat-messages') || chatContainer;
            messagesContainer.appendChild(typingIndicator);
        }

        // Clear any existing timeout for this conversation
        if (this._typingTimeouts[typingId]) {
            clearTimeout(this._typingTimeouts[typingId]);
            this._typingTimeouts[typingId] = null;
        }

        // Show or hide the indicator based on is_typing flag
        if (is_typing) {
            typingIndicator.classList.add('visible');

            // Auto-hide after 3 seconds if no further typing events
            this._typingTimeouts[typingId] = setTimeout(() => {
                typingIndicator.classList.remove('visible');
            }, 3000);
        } else {
            typingIndicator.classList.remove('visible');
        }
    }

    /**
     * Setup typing event listeners for a chat input
     * @param {HTMLElement} inputElement - The input element to track
     * @param {Object} options - Options including inquiry_id and student_id
     */
    setupTypingTracker(inputElement, { inquiry_id, student_id }) {
        if (!inputElement || !inquiry_id) return;

        // Skip if already initialized
        if (inputElement.dataset.typingTrackerInitialized === 'true') {
            return;
        }

        let typingTimer;
        let isTyping = false;

        // Function to emit typing status
        const emitTypingStatus = (typing) => {
            if (isTyping !== typing) {
                isTyping = typing;

                // Send typing event to both student and other admins
                this.emit('typing_indicator', {
                    inquiry_id: inquiry_id,
                    student_id: student_id,
                    office_admin_id: this._userId,
                    admin_name: document.body.dataset.userName || 'Staff',
                    is_typing: typing
                });

                // Also emit admin_typing to notify other admins
                this.emit('admin_typing', {
                    inquiry_id: inquiry_id,
                    office_admin_id: this._userId,
                    admin_name: document.body.dataset.userName || 'Staff',
                    is_typing: typing
                });
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

        // Mark as initialized
        inputElement.dataset.typingTrackerInitialized = 'true';
    }

    // Initialize method now checks and restores connection
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

                // Send initial status
                this._updateActivity();

                // Update connection indicator
                const connectionStatus = document.getElementById('office-connection-status');
                if (connectionStatus) {
                    connectionStatus.classList.remove('text-red-500');
                    connectionStatus.classList.add('text-green-500');
                    connectionStatus.setAttribute('title', 'Connected to notification system');
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

    _incrementInquiryCounter() {
        const counter = document.querySelector('.sidebar-item [data-counter="inquiries"]');
        if (counter) {
            const currentCount = parseInt(counter.textContent) || 0;
            counter.textContent = currentCount + 1;
            counter.classList.remove('hidden');
        }
    }

    _incrementCounselingCounter() {
        const counter = document.querySelector('.sidebar-item [data-counter="counseling"]');
        if (counter) {
            const currentCount = parseInt(counter.textContent) || 0;
            counter.textContent = currentCount + 1;
            counter.classList.remove('hidden');
        }
    }

    _createNotificationSound() {
        // Only create if it doesn't exist and sound is enabled
        if (this._soundEnabled && !document.getElementById('notification-sound')) {
            const sound = document.createElement('audio');
            sound.id = 'notification-sound';
            sound.preload = 'auto';
            sound.style.display = 'none';

            // Add MP3 source - you'll need to provide this file in your static folder
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

    _updateNotificationBadge(increment = 1) {
        // Find the notification badge in the header
        const badge = document.querySelector('.badge');
        if (badge) {
            const currentCount = parseInt(badge.textContent) || 0;
            const newCount = currentCount + increment;

            badge.textContent = newCount;

            if (newCount > 0) {
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    }

    // Override to add custom office-specific behavior
    _updateConnectionIndicator(isConnected) {
        // Call parent method first
        super._updateConnectionIndicator(isConnected);

        // Additional office-specific behavior
        const officeStatusIndicator = document.getElementById('office-connection-status');
        if (officeStatusIndicator) {
            if (isConnected) {
                officeStatusIndicator.classList.remove('text-red-500');
                officeStatusIndicator.classList.add('text-green-500');
                officeStatusIndicator.setAttribute('title', 'Connected to notification system');

                // When reconnected, immediately update status
                this._updateActivity();
            } else {
                officeStatusIndicator.classList.remove('text-green-500');
                officeStatusIndicator.classList.add('text-red-500');
                officeStatusIndicator.setAttribute('title', 'Disconnected from notification system');
            }
        }
    }

    /**
     * Handle new messages from students
     * @param {Object} data - Message data from server
     */
    _handleNewMessage(data) {
        // Only proceed if the message is related to our office
        if (!data || !data.inquiry_id) return;

        // Show notification if we're not on the inquiry detail page
        if (!window.location.pathname.includes(`/inquiry/${data.inquiry_id}`)) {
            this._showNotification('New Student Message',
                `${data.sender_name || 'Student'} sent a new message in Inquiry #${data.inquiry_id}`,
                'info');
            this._playNotificationSound();
        }

        // If we're on the inquiry detail page for this inquiry, add the message to the UI
        const chatContainer = document.querySelector(`.chat-container[data-inquiry-id="${data.inquiry_id}"]`);
        if (chatContainer) {
            // Find or create the chat messages container
            const messagesContainer = chatContainer.querySelector('.chat-messages') || chatContainer;

            // Create a new message element
            const messageElement = document.createElement('div');
            messageElement.id = `message-${data.message_id}`;
            messageElement.className = 'student-message flex flex-col mb-4';
            messageElement.dataset.timestamp = data.timestamp;

            // Format the timestamp
            const timestamp = new Date(data.timestamp);
            const formattedTime = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // Set the HTML content
            messageElement.innerHTML = `
                <div class="student-bubble bg-blue-100 text-blue-800 p-3 rounded-lg max-w-3/4 shadow">
                    <p>${data.content}</p>
                </div>
                <div class="flex justify-start items-center mt-1">
                    <span class="text-xs text-gray-500">${formattedTime}</span>
                    <span class="text-xs text-gray-500 ml-2">${data.sender_name || 'Student'}</span>
                </div>
            `;

            // Add to the messages container
            messagesContainer.appendChild(messageElement);

            // Scroll to the bottom of the container
            messagesContainer.scrollTop = messagesContainer.scrollHeight;

            // Update status in database via API
            this._updateMessageStatus(data.message_id, 'delivered');
        }

        // If we're on the inquiries list page, update the UI to show new message
        const inquiryRow = document.getElementById(`inquiry-${data.inquiry_id}`);
        if (inquiryRow) {
            // Highlight row
            inquiryRow.classList.add('bg-blue-50');
            setTimeout(() => {
                inquiryRow.classList.remove('bg-blue-50');
            }, 5000);

            // Add message count indicator or update it
            let msgIndicator = inquiryRow.querySelector('.new-message-indicator');
            if (!msgIndicator) {
                const actionsCell = inquiryRow.querySelector('td:last-child');
                if (actionsCell) {
                    msgIndicator = document.createElement('span');
                    msgIndicator.className = 'new-message-indicator bg-red-500 text-white text-xs rounded-full px-2 py-1 ml-2';
                    msgIndicator.textContent = '1';
                    actionsCell.appendChild(msgIndicator);
                }
            } else {
                // Increment existing counter
                const count = parseInt(msgIndicator.textContent) || 0;
                msgIndicator.textContent = count + 1;
            }
        }
    }

    /**
     * Update message status in database
     * @param {number} messageId - Message ID
     * @param {string} status - New status (delivered/read)
     */
    _updateMessageStatus(messageId, status) {
        // Send event to update message status
        this.emit('message_status', {
            message_id: messageId,
            status: status
        });
    }
}