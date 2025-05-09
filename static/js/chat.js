/**
 * Real-time Chat Module for Inquiry System
 * Handles messaging features including sent/delivered/read indicators and typing notifications
 */

class ChatManager {
    constructor(options = {}) {
        // Initialize configuration
        this.options = {
            socketManager: null,
            inquiryId: null,
            messageContainer: 'messageHistory',
            messageInput: 'messageInput',
            sendButton: 'sendButton',
            typingIndicator: 'typingIndicator',
            messageTemplate: 'messageTemplate',
            currentUserId: null,
            currentUserRole: null,
            ...options
        };

        // Properties
        this.isTyping = false;
        this.typingTimeout = null;
        this.pendingMessages = new Map(); // Track messages waiting for status updates
        this.unreadMessages = []; // Track new messages that need to be marked as read

        // Bind methods to this
        this._onMessageReceived = this._onMessageReceived.bind(this);
        this._onMessageStatusUpdate = this._onMessageStatusUpdate.bind(this);
        this._onUserTyping = this._onUserTyping.bind(this);
        this._onInputKeyup = this._onInputKeyup.bind(this);

        // Initialize if all required options are present
        if (this.options.socketManager && this.options.inquiryId &&
            this.options.currentUserId && this.options.currentUserRole) {
            this.initialize();
        }
    }

    /**
     * Initialize the chat manager and set up event listeners
     */
    initialize() {
        // Cache DOM elements
        this.messageContainer = document.getElementById(this.options.messageContainer);
        this.messageInput = document.getElementById(this.options.messageInput);
        this.sendButton = document.getElementById(this.options.sendButton);
        this.typingIndicator = document.getElementById(this.options.typingIndicator);

        if (!this.messageContainer || !this.messageInput || !this.sendButton) {
            console.error('Required DOM elements not found');
            return;
        }

        // Set up socket event listeners
        this._setupSocketEvents();

        // Set up UI event listeners
        this._setupUIEvents();

        // Mark messages as read when the chat is opened
        this._markVisibleMessagesAsRead();

        // Set up intersection observer to detect when messages come into view
        this._setupMessageObserver();

        console.log('Chat manager initialized for inquiry', this.options.inquiryId);
    }

    /**
     * Set up Socket.IO event listeners
     */
    _setupSocketEvents() {
        const socket = this.options.socketManager;

        // Listen for new messages
        socket.on('new_chat_message', this._onMessageReceived);

        // Listen for message status updates
        socket.on('message_status_update', this._onMessageStatusUpdate);

        // Listen for typing indicators
        socket.on('user_typing', this._onUserTyping);
    }

    /**
     * Set up UI event listeners
     */
    _setupUIEvents() {
        // Message input events for typing indicator
        this.messageInput.addEventListener('keyup', this._onInputKeyup);
        this.messageInput.addEventListener('focus', () => {
            this._markVisibleMessagesAsRead();
        });

        // Send button click event
        this.sendButton.addEventListener('click', (e) => {
            e.preventDefault();
            this._sendMessage();
        });

        // Form submission event
        const form = this.messageInput.closest('form');
        if (form) {
            form.addEventListener('submit', (e) => {
                // Let the form submit normally, but track the message for status updates
                const content = this.messageInput.value.trim();
                if (content) {
                    this._trackSentMessage(content);
                }
            });
        }

        // Page visibility change to mark messages as read when user returns to tab
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this._markVisibleMessagesAsRead();
            }
        });
    }

    /**
     * Setup Intersection Observer to monitor message visibility
     */
    _setupMessageObserver() {
        // Create new intersection observer
        this.messageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const messageEl = entry.target;
                    const messageId = messageEl.dataset.messageId;
                    const senderId = messageEl.dataset.senderId;

                    // If this is not our message and it hasn't been marked as read yet
                    if (messageId && senderId && senderId !== this.options.currentUserId &&
                        !messageEl.classList.contains('message-read')) {

                        this._markMessageAsRead(messageId, senderId);
                        messageEl.classList.add('message-read');
                    }
                }
            });
        }, {
            threshold: 0.5
        });

        // Observe all incoming message elements
        this._observeExistingMessages();
    }

    /**
     * Observe all existing message elements
     */
    _observeExistingMessages() {
        if (!this.messageObserver) return;

        // Get all message elements not from the current user
        const messageElements = this.messageContainer.querySelectorAll(`.message-bubble[data-sender-id]:not([data-sender-id="${this.options.currentUserId}"])`);

        messageElements.forEach(messageEl => {
            this.messageObserver.observe(messageEl);
        });
    }

    /**
     * Handle incoming messages
     */
    _onMessageReceived(data) {
        if (data.inquiry_id !== this.options.inquiryId) return;

        // Add the new message to the UI
        this._appendMessage({
            id: data.message_id,
            content: data.content,
            senderId: data.sender_id,
            senderName: data.sender_name,
            timestamp: data.timestamp,
            isSelf: data.sender_id === this.options.currentUserId,
            status: 'sent'
        });

        // Play notification sound
        this._playNotificationSound();

        // If the message is not from us, mark it as delivered
        if (data.sender_id !== this.options.currentUserId) {
            this._markMessageAsDelivered(data.message_id, data.sender_id);

            // If the page is visible, also mark it as read
            if (!document.hidden) {
                this._markMessageAsRead(data.message_id, data.sender_id);
            } else {
                // Add to unread messages to mark as read when user focuses tab
                this.unreadMessages.push({
                    id: data.message_id,
                    senderId: data.sender_id
                });
            }
        }
    }

    /**
     * Handle message status updates
     */
    _onMessageStatusUpdate(data) {
        if (data.inquiry_id !== this.options.inquiryId) return;

        const messageEl = document.querySelector(`.message-bubble[data-message-id="${data.message_id}"]`);
        if (!messageEl) return;

        const statusEl = messageEl.querySelector('.message-status');
        if (!statusEl) return;

        // Update status icon and text
        this._updateMessageStatusDisplay(statusEl, data.status);

        // Remove from pending messages if applicable
        if (this.pendingMessages.has(data.message_id)) {
            this.pendingMessages.delete(data.message_id);
        }
    }

    /**
     * Handle typing indicator events
     */
    _onUserTyping(data) {
        if (data.inquiry_id !== this.options.inquiryId ||
            data.user_id === this.options.currentUserId) return;

        if (data.is_typing) {
            // Show typing indicator
            this.typingIndicator.innerHTML = `<div class="text-sm text-gray-500 italic mb-2">${data.user_name} is typing<span class="typing-dots">...</span></div>`;
            this.typingIndicator.classList.remove('hidden');

            // Add animation to dots
            const dots = this.typingIndicator.querySelector('.typing-dots');
            if (dots) {
                dots.classList.add('animate-typing-dots');
            }
        } else {
            // Hide typing indicator
            this.typingIndicator.classList.add('hidden');
            this.typingIndicator.innerHTML = '';
        }
    }

    /**
     * Handle keyup event on message input to send typing indicator
     */
    _onInputKeyup(e) {
        // If Enter key is pressed without Shift, send message
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this._sendMessage();
            return;
        }

        const content = this.messageInput.value.trim();

        // Clear previous timeout
        clearTimeout(this.typingTimeout);

        // If there's content and we're not currently typing, send typing start
        if (content && !this.isTyping) {
            this.isTyping = true;
            this._sendTypingIndicator(true);
        }
        // If no content and we are typing, send typing end
        else if (!content && this.isTyping) {
            this.isTyping = false;
            this._sendTypingIndicator(false);
        }

        // Set timeout to automatically stop typing indicator after 3 seconds
        this.typingTimeout = setTimeout(() => {
            if (this.isTyping) {
                this.isTyping = false;
                this._sendTypingIndicator(false);
            }
        }, 3000);
    }

    /**
     * Send typing indicator message via socket
     */
    _sendTypingIndicator(isTyping) {
        const socketManager = this.options.socketManager;

        // Prepare data based on user role
        let data = {
            inquiry_id: this.options.inquiryId,
            is_typing: isTyping
        };

        // Add role-specific data
        if (this.options.currentUserRole === 'student') {
            // Student to office
            data.office_id = this.options.officeId;
        } else {
            // Office admin to student
            data.student_id = this.options.studentId;
        }

        // Emit typing indicator event
        socketManager.emit('typing_indicator', data);
    }

    /**
     * Send a chat message
     */
    _sendMessage() {
        const content = this.messageInput.value.trim();
        if (!content) return;

        // Clear input
        this.messageInput.value = '';

        // Reset typing indicator
        if (this.isTyping) {
            this.isTyping = false;
            this._sendTypingIndicator(false);
        }

        // Save current form action/method
        const form = this.messageInput.closest('form');
        if (!form) return;

        // Track sent message
        this._trackSentMessage(content);

        // Let the form submit normally (or in case of AJAX, the regular handler will take care of it)
    }

    /**
     * Track a sent message for status updates
     */
    _trackSentMessage(content) {
        // We'll add this message to our tracking once we get the message ID from server
        // In a form-submitted case, we'll receive the message on our socket with the ID
    }

    /**
     * Append a new message to the UI
     */
    _appendMessage(message) {
        // Use message template if defined, otherwise create HTML manually
        let messageEl;

        if (this.options.messageTemplate) {
            const template = document.getElementById(this.options.messageTemplate);
            if (template) {
                messageEl = template.content.cloneNode(true).firstElementChild;
            }
        }

        // If no template or template failed, create element manually
        if (!messageEl) {
            messageEl = document.createElement('div');
            messageEl.className = `flex ${message.isSelf ? 'justify-end' : ''}`;

            const bubbleClass = message.isSelf ? 'message-sent' : 'message-received';
            messageEl.innerHTML = `
                <div class="message-bubble p-4 ${bubbleClass}" data-message-id="${message.id}" data-sender-id="${message.senderId}">
                    <div class="flex items-center mb-2">
                        ${message.isSelf ? `
                            <div class="text-right ml-auto">
                                <div class="text-xs font-semibold">You</div>
                                <div class="text-xs text-gray-500">${message.timestamp}</div>
                            </div>
                            <div class="h-8 w-8 rounded-full bg-green-500 ml-2 flex items-center justify-center text-white">
                                ${this.options.currentUserInitials || 'U'}
                            </div>
                        ` : `
                            <div class="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
                                ${message.senderName?.split(' ').map(n => n[0]).join('') || 'U'}
                            </div>
                            <div class="ml-2">
                                <div class="text-xs font-semibold">
                                    ${message.senderName}
                                </div>
                                <div class="text-xs text-gray-500">${message.timestamp}</div>
                            </div>
                        `}
                    </div>
                    <div class="text-sm">${message.content}</div>
                    ${message.isSelf ? `
                        <div class="message-status text-xs text-right mt-1">
                            <span class="status-icon">
                                <i class="fas fa-check"></i>
                            </span>
                            <span class="status-text ml-1">Sent</span>
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            // If using template, fill in the data
            messageEl.querySelector('.message-content').textContent = message.content;
            // Additional template processing...
        }

        // Add to message container
        this.messageContainer.appendChild(messageEl);

        // Scroll to bottom
        this.messageContainer.scrollTop = this.messageContainer.scrollHeight;

        // Add to observer if it's not our message
        if (!message.isSelf && this.messageObserver) {
            const bubbleEl = messageEl.querySelector('.message-bubble');
            if (bubbleEl) {
                this.messageObserver.observe(bubbleEl);
            }
        }
    }

    /**
     * Mark a message as delivered
     */
    _markMessageAsDelivered(messageId, senderId) {
        const socket = this.options.socketManager;

        // Emit delivered status
        socket.emit('chat_message_delivered', {
            inquiry_id: this.options.inquiryId,
            message_id: messageId,
            sender_id: senderId
        });
    }

    /**
     * Mark a message as read
     */
    _markMessageAsRead(messageId, senderId) {
        const socket = this.options.socketManager;

        // Emit read status
        socket.emit('chat_message_read', {
            inquiry_id: this.options.inquiryId,
            message_id: messageId,
            sender_id: senderId
        });
    }

    /**
     * Mark all currently visible messages as read
     */
    _markVisibleMessagesAsRead() {
        // Process any unread messages
        if (this.unreadMessages.length > 0) {
            this.unreadMessages.forEach(msg => {
                this._markMessageAsRead(msg.id, msg.senderId);
            });
            this.unreadMessages = [];
        }

        // Also check for any visible messages that might need to be marked
        const visibleMessages = this.messageContainer.querySelectorAll(`.message-bubble[data-sender-id]:not([data-sender-id="${this.options.currentUserId}"]):not(.message-read)`);

        visibleMessages.forEach(messageEl => {
            const messageId = messageEl.dataset.messageId;
            const senderId = messageEl.dataset.senderId;

            if (messageId && senderId) {
                this._markMessageAsRead(messageId, senderId);
                messageEl.classList.add('message-read');
            }
        });
    }

    /**
     * Update the message status display
     */
    _updateMessageStatusDisplay(statusEl, status) {
        const iconEl = statusEl.querySelector('.status-icon i');
        const textEl = statusEl.querySelector('.status-text');

        if (!iconEl || !textEl) return;

        // Update status text
        textEl.textContent = status.charAt(0).toUpperCase() + status.slice(1);

        // Update icon and colors based on status
        switch (status) {
            case 'sent':
                iconEl.className = 'fas fa-check';
                statusEl.classList.remove('text-blue-600', 'text-green-600');
                statusEl.classList.add('text-gray-500');
                break;
            case 'delivered':
                iconEl.className = 'fas fa-check-double';
                statusEl.classList.remove('text-gray-500', 'text-green-600');
                statusEl.classList.add('text-blue-600');
                break;
            case 'read':
                iconEl.className = 'fas fa-check-double';
                statusEl.classList.remove('text-gray-500', 'text-blue-600');
                statusEl.classList.add('text-green-600');
                break;
        }
    }

    /**
     * Play notification sound for new messages
     */
    _playNotificationSound() {
        const notificationSound = document.getElementById('notificationSound');
        if (notificationSound) {
            notificationSound.play().catch(err => {
                // Handle autoplay restrictions
                console.warn('Could not play notification sound:', err);
            });
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatManager;
}