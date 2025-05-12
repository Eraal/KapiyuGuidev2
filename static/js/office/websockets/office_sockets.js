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
        if (!data || !data.inquiry_id) {
            console.warn('Invalid message data received:', data);
            return;
        }
        
        console.log('Processing new message:', data);

        // Check if we're on an inquiry detail page
        const isDetailPage = window.location.pathname.includes(`/inquiry/`);
        const isSpecificInquiryPage = window.location.pathname.includes(`/inquiry/${data.inquiry_id}`);
        
        if (!isDetailPage) {
            this._showNotification('New Student Message',
                `${data.sender_name || 'Student'} sent a new message in Inquiry #${data.inquiry_id}`,
                'info');
            this._playNotificationSound();
        } else {
            console.log('On inquiry detail page, checking if this is for the current inquiry...');
        }

        // If we're on the inquiry detail page, try multiple ways to find the chat container
        let messageContainer = null;
        
        // Try the most direct method - find the message history element
        messageContainer = document.getElementById('messageHistory');
        
        // If not found, try to find it by data attribute
        if (!messageContainer) {
            // First try with main container that has inquiry ID
            const mainContainer = document.querySelector(`[data-inquiry-id="${data.inquiry_id}"][data-chat-container="true"]`) || 
                                document.querySelector(`[data-inquiry-id="${data.inquiry_id}"]`);
            
            if (mainContainer) {
                console.log('Found main container with matching inquiry ID:', mainContainer);
                // Look for messageHistory inside this container
                messageContainer = mainContainer.querySelector('#messageHistory');
            }
        }
        
        // If still not found, try additional selectors
        if (!messageContainer && isDetailPage) {
            console.log('Trying alternative methods to find message container');
            
            // Try other common message container selectors
            const possibleContainers = [
                document.querySelector('.chat-messages'),
                document.querySelector('.message-container'),
                document.querySelector('#chat-messages'),
                document.querySelector('.messages-wrapper')
            ];
            
            // Use the first valid container found
            messageContainer = possibleContainers.find(container => container !== null);
        }
        
        console.log('Message container found:', !!messageContainer, messageContainer);
        
        if (messageContainer) {
            // Create and append a new message element
            const messageElement = this._createMessageElement(data);
            
            // Add to the messages container
            messageContainer.appendChild(messageElement);
            console.log('Message element appended:', messageElement);

            // Scroll to the bottom of the container
            messageContainer.scrollTop = messageContainer.scrollHeight;

            // Update status in database via API
            this._updateMessageStatus(data.message_id, 'delivered');

            // Play notification sound for current inquiry
            if (isSpecificInquiryPage) {
                this._playNotificationSound();
            }
        } else if (isDetailPage) {
            console.warn('We appear to be on the detail page but could not find any suitable message container');
            
            // If this is specifically for the current inquiry and we still can't find a container
            // Try to refresh the page as a last resort if this is the specific inquiry page
            if (isSpecificInquiryPage) {
                console.log('This message is for the current inquiry. Showing notification instead.');
                this._showNotification('New Message Received', 
                    `${data.sender_name || 'Student'} sent: ${data.content.substring(0, 50)}${data.content.length > 50 ? '...' : ''}`, 
                    'info');
                this._playNotificationSound();
            }
        }

        // If we're on the inquiries list page, update the UI to show new message
        const inquiryRow = document.getElementById(`inquiry-${data.inquiry_id}`);
        if (inquiryRow) {
            console.log('Found inquiry row, updating indicator');
            
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
                    console.log('Created new message indicator');
                }
            } else {
                // Increment existing counter
                const count = parseInt(msgIndicator.textContent) || 0;
                msgIndicator.textContent = count + 1;
                console.log('Updated message indicator count to', count + 1);
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

    /**
     * Create a new message element with the proper styling
     * @param {Object} message - Message data from server
     * @returns {HTMLElement} - The message element
     */
    _createMessageElement(message) {
        const isSentByMe = message.sender_id == this._userId;
        const messageElement = document.createElement('div');
        messageElement.className = `flex ${isSentByMe ? 'justify-end' : ''}`;
        
        // Format date nicely
        let formattedDate = 'Unknown date';
        if (message.timestamp) {
            const date = new Date(message.timestamp);
            formattedDate = date.toLocaleString('default', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric', 
                hour: 'numeric', 
                minute: 'numeric', 
                hour12: true 
            });
        }
        
        // Get sender initials for avatar
        let senderInitials = 'UN';
        if (message.sender_name) {
            const nameParts = message.sender_name.split(' ');
            if (nameParts.length > 1) {
                senderInitials = nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0);
            } else {
                senderInitials = message.sender_name.substring(0, 2);
            }
        }
        
        // Create message HTML that matches the template format exactly
        messageElement.innerHTML = `
            <div class="message-bubble p-4 ${isSentByMe ? 'message-sent' : 'message-received'}"
                data-message-id="${message.message_id || message.id}"
                data-sender-id="${message.sender_id}">
              <div class="flex items-center mb-2">
                ${!isSentByMe ? `
                  <div class="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
                    ${senderInitials}
                  </div>
                  <div class="ml-2">
                    <div class="text-xs font-semibold">
                      ${message.sender_name || 'Unknown'}
                      ${message.is_student ? '<span class="text-blue-600">(Student)</span>' : ''}
                    </div>
                    <div class="text-xs text-gray-500">
                      ${formattedDate}
                    </div>
                  </div>
                ` : `
                  <div class="text-right ml-auto">
                    <div class="text-xs font-semibold">You</div>
                    <div class="text-xs text-gray-500">
                      ${formattedDate}
                    </div>
                  </div>
                  <div class="h-8 w-8 rounded-full bg-green-500 ml-2 flex items-center justify-center text-white">
                    ${document.body.dataset.userInitials || 'ME'}
                  </div>
                `}
              </div>
              <div class="text-sm">${(message.content || '').replace(/\r\n|\r|\n/g, '<br>')}</div>
              
              ${isSentByMe ? `
              <div class="message-status text-xs text-right mt-1">
                <span class="status-icon">
                  <i class="fas ${message.status === 'read' ? 'fa-check-double text-green-500' : 
                                 message.status === 'delivered' ? 'fa-check-double' : 'fa-check'}"></i>
                </span>
                <span class="status-text ml-1">${(message.status || 'sent').charAt(0).toUpperCase() + (message.status || 'sent').slice(1)}</span>
              </div>
              ` : ''}
            </div>
        `;
        
        return messageElement;
    }

    /**
     * Display a notification to the user
     * @param {string} title - Notification title
     * @param {string} message - Notification message
     * @param {string} type - Notification type (info, success, warning, error)
     */
    _showNotification(title, message, type = 'info') {
        // Create notification element
        const notificationDiv = document.createElement('div');
        notificationDiv.className = `fixed bottom-5 right-5 p-4 rounded shadow-lg z-50 
            ${type === 'error' ? 'bg-red-600' : 
            type === 'warning' ? 'bg-yellow-600' : 
            type === 'success' ? 'bg-green-600' : 'bg-blue-600'} text-white`;
        
        // Set notification content
        notificationDiv.innerHTML = `
            <div class="flex items-center">
                <div class="mr-3">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                        d="${type === 'error' ? 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' : 
                        type === 'warning' ? 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' : 
                        type === 'success' ? 'M5 13l4 4L19 7' : 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'}"></path>
                    </svg>
                </div>
                <div>
                    <h4 class="font-bold">${title}</h4>
                    <p>${message}</p>
                </div>
                <button class="ml-auto" onclick="this.parentNode.parentNode.remove()">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        `;
        
        // Add to DOM
        document.body.appendChild(notificationDiv);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notificationDiv.parentNode) {
                notificationDiv.remove();
            }
        }, 5000);
    }
}