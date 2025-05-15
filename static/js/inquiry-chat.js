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
    /**
     * Create an InquiryChat instance
     * @param {Object} config - Configuration object
     * @param {Object} config.socket - The Socket.IO socket instance
     * @param {HTMLElement} config.messageInput - The message input element
     * @param {HTMLElement} config.sendButton - The send button element
     * @param {HTMLElement} config.messageContainer - The message container element
     * @param {HTMLElement} config.typingIndicator - The typing indicator element
     * @param {string|number} config.inquiryId - The ID of the inquiry
     * @param {string|number} config.currentUserId - The current user's ID
     * @param {string} config.currentUserRole - The current user's role
     * @param {string} config.currentUserName - The current user's full name
     * @param {string} config.currentUserInitials - The current user's initials
     * @param {string|number} [config.studentId] - The student's ID (only needed for office admin)
     */
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
        this.notificationSound = document.getElementById('notificationSound');
        this.debugMode = true; // Enable debugging
        this.joinedRooms = []; // Track joined rooms for proper cleanup

        // Initialize the chat
        this.init();
    }

    /**
     * Initialize the chat functionality
     */
    init() {
        // Join all required rooms for this inquiry using consistent naming
        this._joinInquiryRooms();

        // Set up event listeners
        this.setupSocketListeners();
        this.setupUIListeners();

        // Mark messages as read when they're in the viewport
        this.markVisibleMessagesAsRead();

        this.debug(`InquiryChat initialized for inquiry ${this.inquiryId}, user ${this.currentUserName} (${this.currentUserRole})`);
    }

    /**
     * Join all required rooms for this inquiry
     * @private
     */
    _joinInquiryRooms() {
        // Define the rooms to join
        const inquiryRoom = `inquiry_${this.inquiryId}`;
        const viewRoom = `inquiry_view_${this.inquiryId}`;

        // Join the main inquiry room
        this.socket.emit('join_inquiry_room', {
            inquiry_id: this.inquiryId
        });
        this.joinedRooms.push('join_inquiry_room');
        this.debug(`Joined room via join_inquiry_room event with inquiry_id=${this.inquiryId}`);

        // Join the standard room for this inquiry
        this.socket.emit('join', {
            room: inquiryRoom,
            context: 'inquiry_chat'
        });
        this.joinedRooms.push(inquiryRoom);
        this.debug(`Joined room: ${inquiryRoom}`);

        // Join the view room for this inquiry (for admins viewing specific inquiries)
        this.socket.emit('join', {
            room: viewRoom,
            context: 'inquiry_chat'
        });
        this.joinedRooms.push(viewRoom);
        this.debug(`Joined room: ${viewRoom}`);
    }

    /**
     * Log debug messages
     */
    debug(...args) {
        if (this.debugMode) {
            console.log(`[InquiryChat]`, ...args);
        }
    }

    /**
     * Set up Socket.IO event listeners
     */
    setupSocketListeners() {
        // Listen for new messages - handle all possible event types
        const messageEventHandler = (data) => {
            this.debug('Received message event:', data);

            // Only handle messages for this inquiry
            if (data.inquiry_id != this.inquiryId) {
                this.debug('Message is for another inquiry, ignoring');
                return;
            }

            // If the message is from someone else
            if (data.sender_id != this.currentUserId) {
                this.debug('Message is from another user, processing...');
                this.playNotificationSound();

                // Mark message as delivered
                this.socket.emit('chat_message_delivered', {
                    inquiry_id: this.inquiryId,
                    message_id: data.message_id || data.id,
                    sender_id: data.sender_id
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

        // Listen for all message event types
        this.socket.on('new_chat_message', messageEventHandler);
        this.socket.on('new_message', messageEventHandler);
        this.socket.on('student_message_sent', messageEventHandler);

        // Listen for typing indicators - handle both student and admin typing events
        const typingEventHandler = (data) => {
            this.debug('Received typing indicator:', data);

            // Only handle typing indicators for this inquiry
            if (data.inquiry_id != this.inquiryId) return;

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

        // Listen for both admin and student typing indicators
        this.socket.on('user_typing', typingEventHandler);
        this.socket.on('student_typing', typingEventHandler);
        this.socket.on('admin_typing', typingEventHandler);

        // Listen for message status updates
        this.socket.on('message_status_update', (data) => {
            this.debug('Received message status update:', data);

            // Only handle updates for this inquiry
            if (data.inquiry_id != this.inquiryId) return;

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
        });
    }

    /**
     * Set up UI event listeners
     */
    setupUIListeners() {
        // Listen for message input to detect typing
        this.messageInput.addEventListener('input', () => {
            this.handleTypingEvent();
        });

        // Listen for focus/blur events to mark messages as read
        window.addEventListener('focus', () => {
            this.markVisibleMessagesAsRead();
        });

        // Listen for scroll events to mark messages as read when they become visible
        this.messageContainer.addEventListener('scroll', () => {
            this.markVisibleMessagesAsRead();
        });

        // Listen for message form submissions
        const messageForm = this.messageInput.closest('form');
        if (messageForm) {
            messageForm.addEventListener('submit', (e) => {
                // We'll let the form submit normally and handle the real-time updates
                // after the message is saved to the database

                // Stop typing indicator
                this.stopTypingIndicator();
            });
        }

        // Listen for visibility change to mark messages as read when page becomes visible
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.markVisibleMessagesAsRead();
            }
        });
    }

    /**
     * Handle typing events
     */
    handleTypingEvent() {
        // If not already marked as typing, emit the typing event
        if (!this.isTyping) {
            this.isTyping = true;

            // Emit appropriate typing event based on user role
            if (this.currentUserRole === 'student') {
                this.socket.emit('student_typing', {
                    inquiry_id: this.inquiryId,
                    student_id: this.currentUserId,
                    is_typing: true
                });
                this.debug('Emitted student typing event (typing)');
            } else if (this.currentUserRole === 'office_admin') {
                // For office admins, we need to specify both the inquiry and the student
                this.socket.emit('typing_indicator', {
                    inquiry_id: this.inquiryId,
                    student_id: this.studentId,
                    office_admin_id: this.currentUserId,
                    admin_name: this.currentUserName,
                    is_typing: true
                });
                this.debug('Emitted admin typing event (typing)');
            }
        }

        // Clear any existing timeout
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }

        // Set a new timeout to stop the typing indicator after 2 seconds of inactivity
        this.typingTimeout = setTimeout(() => {
            this.stopTypingIndicator();
        }, 2000);
    }

    /**
     * Stop the typing indicator
     */
    stopTypingIndicator() {
        if (this.isTyping) {
            this.isTyping = false;

            // Emit appropriate typing event based on user role
            if (this.currentUserRole === 'student') {
                this.socket.emit('student_typing', {
                    inquiry_id: this.inquiryId,
                    student_id: this.currentUserId,
                    is_typing: false
                });
                this.debug('Emitted student typing event (stopped)');
            } else if (this.currentUserRole === 'office_admin') {
                // For office admins, we need to specify both the inquiry and the student
                this.socket.emit('typing_indicator', {
                    inquiry_id: this.inquiryId,
                    student_id: this.studentId,
                    office_admin_id: this.currentUserId,
                    admin_name: this.currentUserName,
                    is_typing: false
                });
                this.debug('Emitted admin typing event (stopped)');
            }
        }

        // Clear the timeout
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
            this.typingTimeout = null;
        }
    }

    /**
     * Show typing indicator in the UI
     * @param {string} userName - The name of the user who is typing
     */
    showTypingIndicator(userName) {
        if (!this.typingIndicator) return;

        this.typingIndicator.innerHTML = `
            <div class="flex items-center text-sm text-gray-500 p-2 mb-2">
                <div class="flex space-x-1 mr-2">
                    <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                    <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                    <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
                </div>
                <span>${userName} is typing...</span>
            </div>
        `;

        this.typingIndicator.classList.remove('hidden');
        this.debug(`Showing typing indicator for ${userName}`);
    }

    /**
     * Hide typing indicator
     */
    hideTypingIndicator() {
        if (!this.typingIndicator) return;
        this.typingIndicator.classList.add('hidden');
        this.debug('Hiding typing indicator');
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
        } else if (message.sender_name) {
            const nameParts = message.sender_name.split(' ');
            if (nameParts.length > 1) {
                senderInitials = nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0);
            } else {
                senderInitials = message.sender_name.substring(0, 2);
            }
        }

        // Create message HTML - ensures consistency between student and office modules
        messageElement.innerHTML = `
            <div class="message-bubble p-4 ${isSentByMe ? 'message-sent' : 'message-received'}"
                 data-message-id="${messageId}" data-sender-id="${message.sender_id}">
                <div class="flex items-center mb-2">
                    ${isSentByMe ? `
                        <div class="text-right ml-auto">
                            <div class="text-xs font-semibold">You</div>
                            <div class="text-xs text-gray-500">${formattedDate}</div>
                        </div>
                        <div class="h-8 w-8 rounded-full bg-green-500 ml-2 flex items-center justify-center text-white">
                            ${this.currentUserInitials}
                        </div>
                    ` : `
                        <div class="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
                            ${senderInitials}
                        </div>
                        <div class="ml-2">
                            <div class="text-xs font-semibold">
                                ${message.sender_name || 'User'} 
                                ${(message.is_student || message.sender_role === 'student') ? '<span class="text-blue-600">(Student)</span>' : ''}
                            </div>
                            <div class="text-xs text-gray-500">${formattedDate}</div>
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
    }

    /**
     * Scroll the message container to the bottom
     */
    scrollToBottom() {
        if (!this.messageContainer) return;
        this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
    }

    /**
     * Play the notification sound
     */
    playNotificationSound() {
        if (this.notificationSound && this.notificationSound.play) {
            this.notificationSound.play().catch(error => {
                // Autoplay might be blocked, we can ignore this error
                console.log('Could not play notification sound:', error);
            });
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
        // Leave all joined rooms
        this.joinedRooms.forEach(room => {
            if (room === 'join_inquiry_room') {
                // Special handling for join_inquiry_room
                this.socket.emit('leave_inquiry_room', {
                    inquiry_id: this.inquiryId
                });
                this.debug(`Left room via leave_inquiry_room event with inquiry_id=${this.inquiryId}`);
            } else {
                // Standard room leaving
                this.socket.emit('leave', {
                    room: room,
                    context: 'inquiry_chat'
                });
                this.debug(`Left room: ${room}`);
            }
        });

        // Clear the joined rooms array
        this.joinedRooms = [];

        // Stop typing indicator if active
        if (this.isTyping) {
            this.stopTypingIndicator();
        }

        // Clean up any timeouts
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
            this.typingTimeout = null;
        }

        this.debug(`InquiryChat destroyed for inquiry ${this.inquiryId}`);
    }
}