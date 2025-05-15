/**
 * InquiryChat - Real-time chat functionality for KapiyuGuide System
 * 
 * This class handles the client-side implementation of real-time chat features including:
 * - Sending and receiving messages
 * - Typing indicators
 * - Message status updates (sent, delivered, read)
 * - Sound notifications
 */

class InquiryChat {
    constructor(config) {
        // Store configuration
        this.socket = config.socket;
        this.messageInput = config.messageInput;
        this.sendButton = config.sendButton;
        this.messageContainer = config.messageContainer;
        this.typingIndicator = config.typingIndicator;
        this.inquiryId = config.inquiryId;
        this.currentUserId = config.currentUserId;
        this.currentUserRole = config.currentUserRole;
        this.currentUserName = config.currentUserName;
        this.currentUserInitials = config.currentUserInitials;
        this.studentId = config.studentId;

        // Internal state
        this.isTyping = false;
        this.typingTimeout = null;
        this.unreadMessages = [];
        this.debugMode = true; // Enable debugging for troubleshooting
        this.eventNamespace = 'inquiry_chat'; // Use specific namespace to avoid conflicts with counseling
        this.hasJoinedRooms = false; // Track if we've joined the rooms

        // Track event listeners for cleanup
        this._boundEventListeners = [];

        // Initialize the chat
        this.init();
        this.debug('InquiryChat constructor completed');
    }

    /**
     * Initialize the chat functionality
     */
    init() {
        // NOTE: We're no longer activating the general chat feature in window.socketManager
        // because that creates conflicts with the dedicated socket for inquiry chat

        // Join the room for this inquiry using our dedicated socket
        this.joinInquiryRooms();

        // Set up event listeners
        this.setupSocketListeners();
        this.setupUIListeners();

        // Mark messages as read when they're in the viewport
        this.markVisibleMessagesAsRead();

        this.debug(`InquiryChat initialized for inquiry ${this.inquiryId}, user ${this.currentUserName} (${this.currentUserRole})`);
    }

    /**
     * Join all needed inquiry rooms and track the membership
     */
    joinInquiryRooms() {
        if (!this.socket) {
            this.debug('Cannot join rooms - no socket available');
            return;
        }

        const room = `inquiry_${this.inquiryId}`;

        // Join inquiry-specific room
        this.socket.emit('join_inquiry_room', {
            inquiry_id: this.inquiryId
        });
        this.debug(`Joined inquiry_room: ${room}`);

        // Also join the standard socket.io room format
        this.socket.emit('join', {
            room: room,
            context: 'inquiry_chat' // Mark this as inquiry chat context to differentiate
        });
        this.debug(`Joined standard room: ${room}`);

        // Join the view room as well
        this.socket.emit('join', {
            room: `inquiry_view_${this.inquiryId}`,
            context: 'inquiry_chat'
        });
        this.debug(`Joined view room: inquiry_view_${this.inquiryId}`);

        this.hasJoinedRooms = true;
    }

    /**
     * Verify and rejoin rooms if necessary
     */
    verifyRoomMembership() {
        if (!this.hasJoinedRooms) {
            this.debug('Rooms not joined previously, joining now');
            this.joinInquiryRooms();
            return;
        }

        // Rejoin rooms to ensure we're still in them
        this.joinInquiryRooms();
    }

    /**
     * Log debug messages
     */
    debug(...args) {
        if (this.debugMode) {
            console.log(`[InquiryChat] [${this.inquiryId}]`, ...args);
        }
    }

    /**
     * Set up Socket.IO event listeners
     */
    setupSocketListeners() {
        // Use document events from our feature-based architecture with our specific namespace
        this.debug('Setting up socket listeners for inquiry chat');

        // Handle new messages
        const messageHandler = (event) => {
            const data = event.detail;

            // Skip messages for other inquiries
            if (!data || data.inquiry_id != this.inquiryId) {
                this.debug('Message is for another inquiry, ignoring');
                return;
            }

            // Use the namespaced event handler to prevent duplicate processing
            // Only continue if this is not a duplicate message
            if (!window.socketManager || !window.socketManager.handleNamespacedEvent) {
                // Fallback if handleNamespacedEvent not available
                this._processNewMessage(data);
                return;
            }

            // Create unique ID from message properties with our specific namespace
            const messageId = data.message_id || data.id;
            const eventId = `inquiry_msg_${messageId}_${data.inquiry_id}`;

            window.socketManager.handleNamespacedEvent(this.eventNamespace, eventId, () => {
                this._processNewMessage(data);
            });
        };

        /**
         * Process a new chat message after duplicate check
         * @private
         */
        this._processNewMessage = (data) => {
            this.debug('Processing new message event:', data);

            // If the message is from someone else
            if (data.sender_id != this.currentUserId) {
                this.debug('Message is from another user, processing...');
                this.playNotificationSound();

                // Mark message as delivered
                this.socket.emit('chat_message_delivered', {
                    inquiry_id: this.inquiryId,
                    message_id: data.message_id || data.id,
                    sender_id: data.sender_id,
                    timestamp: new Date().toISOString()
                });
                this.debug('Marked message as delivered');

                // Add to unread messages if not currently visible
                const messageId = data.message_id || data.id;
                this.unreadMessages.push(messageId);

                // Mark as read if the message is currently visible
                if (document.visibilityState === 'visible') {
                    this.markVisibleMessagesAsRead();
                }
            } else {
                this.debug('Message is from current user');
            }

            // Update the UI if the message isn't already in the DOM
            const messageId = data.message_id || data.id;
            if (!document.querySelector(`[data-message-id="${messageId}"]`)) {
                this.debug('Appending new message to UI');
                this.appendMessage(data);
            }
        };

        // Handle message status updates
        const statusHandler = (event) => {
            const data = event.detail;

            if (!data || data.inquiry_id != this.inquiryId) {
                return;
            }

            this.debug('Received message status update:', data);

            // Update the message status in the UI
            const messageElement = document.querySelector(`[data-message-id="${data.message_id}"]`);
            if (messageElement) {
                const statusElement = messageElement.querySelector('.message-status');
                if (statusElement) {
                    const iconElement = statusElement.querySelector('.status-icon i');
                    const textElement = statusElement.querySelector('.status-text');

                    if (iconElement) {
                        // Update icon based on status
                        iconElement.className = 'fas';
                        if (data.status === 'read') {
                            iconElement.classList.add('fa-check-double', 'text-green-500');
                        } else if (data.status === 'delivered') {
                            iconElement.classList.add('fa-check-double');
                        } else {
                            iconElement.classList.add('fa-check');
                        }
                    }

                    if (textElement) {
                        textElement.textContent = data.status.charAt(0).toUpperCase() + data.status.slice(1);
                    }
                    this.debug('Updated message status in UI');
                }
            }
        };

        // Handle typing indicators
        const typingHandler = (event) => {
            const data = event.detail;

            if (!data || data.inquiry_id != this.inquiryId) {
                return;
            }

            this.debug('Received typing indicator:', data);

            // Skip if this is our own typing event
            if (this.currentUserRole === 'office_admin' && data.office_admin_id == this.currentUserId) return;
            if (this.currentUserRole === 'student' && data.student_id == this.currentUserId) return;

            if (data.is_typing) {
                const userName = data.admin_name || data.user_name || 'User';
                this.showTypingIndicator(userName);
            } else {
                this.hideTypingIndicator();
            }
        };

        // Register listeners with document events for our specific namespace
        document.addEventListener('chat:new_message', messageHandler);
        document.addEventListener('chat:status_update', statusHandler);
        document.addEventListener('chat:typing_indicator', typingHandler);

        // Store references for cleanup
        this._boundEventListeners = [
            { element: document, event: 'chat:new_message', handler: messageHandler },
            { element: document, event: 'chat:status_update', handler: statusHandler },
            { element: document, event: 'chat:typing_indicator', handler: typingHandler }
        ];

        // Handle socket connection issues with direct listeners on our dedicated socket
        this.socket.on('connect_error', (error) => {
            this.debug('Socket connection error:', error);
        });

        this.socket.on('disconnect', (reason) => {
            this.debug('Socket disconnected:', reason);
            this.hasJoinedRooms = false; // Mark rooms as left
        });

        this.socket.on('reconnect', (attemptNumber) => {
            this.debug('Socket reconnected after', attemptNumber, 'attempts');
            // Rejoin the inquiry rooms after reconnect
            this.joinInquiryRooms();
        });

        // Add a periodic verification of room membership
        this._roomVerificationInterval = setInterval(() => {
            this.verifyRoomMembership();
        }, 60000); // Check every minute

        // Register with health check system
        document.addEventListener('socket:health_check', () => {
            this.debug('Received health check, verifying room membership');
            this.verifyRoomMembership();
        });
    }

    /**
     * Handle typing events
     */
    handleTypingEvent() {
        // Clear previous timeout
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }

        const content = this.messageInput.value.trim();

        // If there's content and we're not already marked as typing
        if (content && !this.isTyping) {
            this.isTyping = true;
            this.emitTypingStatus(true);
            this.debug('Started typing');
        }
        // If no content and we're currently marked as typing
        else if (!content && this.isTyping) {
            this.isTyping = false;
            this.emitTypingStatus(false);
            this.debug('Stopped typing (no content)');
        }

        // Set a timeout to automatically stop typing indicator
        this.typingTimeout = setTimeout(() => {
            if (this.isTyping) {
                this.isTyping = false;
                this.emitTypingStatus(false);
                this.debug('Stopped typing (timeout)');
            }
        }, 5000); // 5 seconds without typing = stop typing indicator
    }

    /**
     * Emit typing status to other users
     * @param {boolean} isTyping - Whether the user is typing
     */
    emitTypingStatus(isTyping) {
        // Different events based on user role
        if (this.currentUserRole === 'student') {
            this.socket.emit('student_typing', {
                inquiry_id: this.inquiryId,
                student_id: this.currentUserId,
                is_typing: isTyping
            });
            this.debug(`Emitted student_typing: ${isTyping}`);
        } else {
            this.socket.emit('admin_typing', {
                inquiry_id: this.inquiryId,
                student_id: this.studentId,
                office_admin_id: this.currentUserId,
                is_typing: isTyping
            });
            this.debug(`Emitted admin_typing: ${isTyping}`);
        }
    }

    /**
     * Stop the typing indicator
     */
    stopTypingIndicator() {
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }

        if (this.isTyping) {
            this.isTyping = false;
            this.emitTypingStatus(false);
        }

        this.hideTypingIndicator();
    }

    /**
     * Show typing indicator in the UI
     * @param {string} userName - The name of the user who is typing
     */
    showTypingIndicator(userName) {
        if (!this.typingIndicator) return;

        this.debug(`Showing typing indicator for: ${userName}`);
        this.typingIndicator.textContent = `${userName} is typing...`;
        this.typingIndicator.classList.remove('hidden');
    }

    /**
     * Hide typing indicator
     */
    hideTypingIndicator() {
        if (!this.typingIndicator) return;

        this.debug('Hiding typing indicator');
        this.typingIndicator.classList.add('hidden');
        this.typingIndicator.textContent = '';
    }

    /**
     * Play notification sound using the centralized NotificationSoundManager
     */
    playNotificationSound() {
        // Use the global sound manager if available
        if (window.soundManager) {
            this.debug('Playing notification sound via sound manager');
            window.soundManager.playSound('default')
                .catch(error => this.debug('Error playing notification sound:', error));
        } else {
            this.debug('Sound manager not available');
        }
    }

    /**
     * Scroll the message container to the bottom
     */
    scrollToBottom() {
        if (this.messageContainer) {
            this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
            this.debug('Scrolled message container to bottom');
        }
    }

    /**
     * Append a new message to the message container
     * @param {Object} message - The message data
     */
    appendMessage(message) {
        if (!this.messageContainer) return;

        const isSentByMe = message.sender_id == this.currentUserId;
        const messageId = message.message_id || message.id;

        // Format the date
        let formattedDate = 'Unknown date';
        if (message.timestamp || message.created_at) {
            const date = new Date(message.timestamp || message.created_at);
            formattedDate = date.toLocaleString();
        }

        this.debug(`Appending message ${messageId}, sent by me: ${isSentByMe}`);

        // Create the message element
        const messageElement = document.createElement('div');
        messageElement.className = 'flex ' + (isSentByMe ? 'justify-end' : '');

        // Get sender name or initials
        let senderInitials = 'UN';
        if (isSentByMe) {
            senderInitials = this.currentUserInitials;
        } else {
            if (message.sender_name) {
                senderInitials = message.sender_name.split(' ').map(n => n[0]).join('').toUpperCase();
            }
        }

        // Create message HTML
        messageElement.innerHTML = `
            <div class="message-bubble ${isSentByMe ? 'message-sent bg-blue-100' : 'message-received bg-gray-100'} p-4 rounded-lg shadow-sm max-w-xs md:max-w-md lg:max-w-lg" data-message-id="${messageId}" data-sender-id="${message.sender_id}">
                <div class="flex items-center mb-1">
                    ${!isSentByMe ? `
                    <div class="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white mr-2">
                        ${senderInitials}
                    </div>
                    <div>
                        <div class="font-semibold">${message.sender_name || 'User'}</div>
                        <div class="text-xs text-gray-500">${formattedDate}</div>
                    </div>
                    ` : `
                    <div>
                        <div class="text-right font-semibold">You</div>
                        <div class="text-xs text-gray-500 text-right">${formattedDate}</div>
                    </div>
                    <div class="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center text-white ml-2">
                        ${senderInitials}
                    </div>
                    `}
                </div>
                <div class="text-sm">${(message.content || '').replace(/\n/g, '<br>')}</div>
                
                <!-- Message status indicator (only for sent messages) -->
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

        // Append the message to the container
        this.messageContainer.appendChild(messageElement);

        // Scroll to the bottom
        this.scrollToBottom();

        // Send message_received event to confirm message display
        if (!isSentByMe) {
            this.socket.emit('message_received', {
                inquiry_id: this.inquiryId,
                message_id: messageId,
                sender_id: message.sender_id
            });
            this.debug(`Sent message_received confirmation for message ${messageId}`);
        }
    }

    /**
     * Mark visible messages as read
     */
    markVisibleMessagesAsRead() {
        if (!this.messageContainer) return;

        // Get all message elements that are not from the current user
        const messageElements = this.messageContainer.querySelectorAll('.message-bubble[data-sender-id]:not([data-sender-id="' + this.currentUserId + '"])');

        // Check if each message is visible
        messageElements.forEach((element) => {
            const messageId = element.getAttribute('data-message-id');
            const senderId = element.getAttribute('data-sender-id');

            // Check if the message is in the viewport
            const rect = element.getBoundingClientRect();
            const isVisible = (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            );

            if (isVisible && this.unreadMessages.includes(messageId)) {
                // Mark the message as read
                this.socket.emit('chat_message_read', {
                    inquiry_id: this.inquiryId,
                    message_id: messageId,
                    sender_id: senderId
                });

                this.debug(`Marked message ${messageId} as read`);

                // Remove from unread messages
                this.unreadMessages = this.unreadMessages.filter(id => id !== messageId);
            }
        });
    }

    /**
     * Clean up event listeners and disconnect
     */
    destroy() {
        // Leave the inquiry room
        if (this.socket) {
            this.socket.emit('leave', { room: `inquiry_${this.inquiryId}` });
            this.socket.emit('leave', { room: `inquiry_view_${this.inquiryId}` });
        }

        // Clear any timeouts and intervals
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }

        if (this._roomVerificationInterval) {
            clearInterval(this._roomVerificationInterval);
        }

        // Remove all event listeners
        this._boundEventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });

        // Clear references
        this._boundEventListeners = [];
        this.hasJoinedRooms = false;

        this.debug(`InquiryChat destroyed for inquiry ${this.inquiryId}`);

        // We no longer need to deactivate any global features
        // since we're using a dedicated socket connection
    }
}