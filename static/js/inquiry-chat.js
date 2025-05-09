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

        // Internal state
        this.isTyping = false;
        this.typingTimeout = null;
        this.unreadMessages = [];
        this.notificationSound = document.getElementById('notificationSound');

        // Initialize the chat
        this.init();
    }

    /**
     * Initialize the chat functionality
     */
    init() {
        // Join the room for this inquiry
        const room = `inquiry_${this.inquiryId}`;
        this.socket.emit('join', { room: room });

        // Set up event listeners
        this.setupSocketListeners();
        this.setupUIListeners();

        // Mark messages as read when they're in the viewport
        this.markVisibleMessagesAsRead();

        console.log(`InquiryChat initialized for inquiry ${this.inquiryId}`);
    }

    /**
     * Set up Socket.IO event listeners
     */
    setupSocketListeners() {
        // Listen for new messages
        this.socket.on('new_message', (data) => {
            // Only handle messages for this inquiry
            if (data.inquiry_id != this.inquiryId) return;

            // If the message is from someone else, play notification sound
            if (data.sender_id != this.currentUserId) {
                this.playNotificationSound();

                // Mark message as delivered
                this.socket.emit('chat_message_delivered', {
                    inquiry_id: this.inquiryId,
                    message_id: data.message_id,
                    sender_id: data.sender_id
                });

                // Add to unread messages if not currently visible
                this.unreadMessages.push(data.message_id);

                // Mark as read if the message is currently visible
                if (document.visibilityState === 'visible') {
                    this.markVisibleMessagesAsRead();
                }
            }

            // Update the UI if the message isn't already in the DOM
            if (!document.querySelector(`[data-message-id="${data.message_id}"]`)) {
                this.appendMessage(data);
            }
        });

        // Listen for typing indicators
        this.socket.on('user_typing', (data) => {
            // Only handle typing indicators for this inquiry and from other users
            if (data.inquiry_id != this.inquiryId || data.user_id == this.currentUserId) return;

            if (data.is_typing) {
                this.showTypingIndicator(data.user_name);
            } else {
                this.hideTypingIndicator();
            }
        });

        // Listen for message status updates
        this.socket.on('message_status_update', (data) => {
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
            this.socket.emit('typing_indicator', {
                inquiry_id: this.inquiryId,
                is_typing: true
            });
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
            this.socket.emit('typing_indicator', {
                inquiry_id: this.inquiryId,
                is_typing: false
            });
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
    }

    /**
     * Hide the typing indicator
     */
    hideTypingIndicator() {
        if (!this.typingIndicator) return;
        this.typingIndicator.classList.add('hidden');
    }

    /**
     * Append a new message to the message container
     * @param {Object} message - The message data
     */
    appendMessage(message) {
        if (!this.messageContainer) return;

        const isSentByMe = message.sender_id == this.currentUserId;
        const formattedDate = new Date(message.timestamp).toLocaleString();

        // Create the message element
        const messageElement = document.createElement('div');
        messageElement.className = 'flex ' + (isSentByMe ? 'justify-end' : '');
        messageElement.innerHTML = `
            <div class="message-bubble p-4 ${isSentByMe ? 'message-sent' : 'message-received'}"
                 data-message-id="${message.message_id}" data-sender-id="${message.sender_id}">
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
                            ${message.sender_name?.substring(0, 2) || 'U'}
                        </div>
                        <div class="ml-2">
                            <div class="text-xs font-semibold">
                                ${message.sender_name || 'User'} 
                                ${message.sender_role === 'student' ? '<span class="text-blue-600">(Student)</span>' : ''}
                            </div>
                            <div class="text-xs text-gray-500">${formattedDate}</div>
                        </div>
                    `}
                </div>
                <div class="text-sm">${message.content}</div>
                
                <!-- Message status indicator (only for sent messages) -->
                ${isSentByMe ? `
                <div class="message-status text-xs text-right mt-1">
                    <span class="status-icon">
                        <i class="fas ${message.status === 'read' ? 'fa-check-double text-green-500' :
                    message.status === 'delivered' ? 'fa-check-double' : 'fa-check'}"></i>
                    </span>
                    <span class="status-text ml-1">${message.status.charAt(0).toUpperCase() + message.status.slice(1)}</span>
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

                // Remove from unread messages
                this.unreadMessages = this.unreadMessages.filter(id => id !== messageId);
            }
        });
    }

    /**
     * Clean up event listeners and disconnect
     */
    destroy() {
        // Leave the room
        this.socket.emit('leave', { room: `inquiry_${this.inquiryId}` });

        // Clean up any timeouts
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }

        console.log(`InquiryChat destroyed for inquiry ${this.inquiryId}`);
    }
}