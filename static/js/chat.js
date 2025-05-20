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

        console.log('[ChatManager] Created with options:', JSON.stringify(this.options));

        // Initialize if all required options are present
        if (this.options.socketManager && this.options.inquiryId &&
            this.options.currentUserId && this.options.currentUserRole) {
            this.initialize();
        } else {
            console.error('[ChatManager] Missing required options:',
                !this.options.socketManager ? 'socketManager ' : '',
                !this.options.inquiryId ? 'inquiryId ' : '',
                !this.options.currentUserId ? 'currentUserId ' : '',
                !this.options.currentUserRole ? 'currentUserRole' : '');
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
            console.error('[ChatManager] Required DOM elements not found:',
                !this.messageContainer ? 'messageContainer ' : '',
                !this.messageInput ? 'messageInput ' : '',
                !this.sendButton ? 'sendButton' : '');
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

        console.log('[ChatManager] Initialized for inquiry', this.options.inquiryId);
    }

    /**
     * Set up Socket.IO event listeners
     */
    _setupSocketEvents() {
        const socket = this.options.socketManager;
        console.log('[ChatManager] Setting up socket events. Socket connected:',
            socket && socket.isConnected ? 'Yes' : 'No');

        // Listen for new messages
        socket.on('new_chat_message', (data) => {
            console.log('[ChatManager] Received new_chat_message event:', JSON.stringify(data));
            this._onMessageReceived(data);
        });

        // Listen for message status updates
        socket.on('message_status_update', (data) => {
            console.log('[ChatManager] Received message_status_update event:', JSON.stringify(data));
            this._onMessageStatusUpdate(data);
        });

        // Listen for typing indicators
        socket.on('user_typing', (data) => {
            console.log('[ChatManager] Received user_typing event:', JSON.stringify(data));
            this._onUserTyping(data);
        });

        // Additional events to catch all possible message types
        socket.on('new_message', (data) => {
            console.log('[ChatManager] Received new_message event:', JSON.stringify(data));
            this._onMessageReceived(data);
        });

        socket.on('student_message_sent', (data) => {
            console.log('[ChatManager] Received student_message_sent event:', JSON.stringify(data));
            this._onMessageReceived(data);
        });

        socket.on('chat_message', (data) => {
            console.log('[ChatManager] Received chat_message event:', JSON.stringify(data));
            this._onMessageReceived(data);
        });
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
        console.log('[ChatManager] Processing received message:', JSON.stringify(data));
        if (data.inquiry_id !== this.options.inquiryId) {
            console.log('[ChatManager] Message is for a different inquiry, ignoring');
            return;
        }

        // Check if message is already in DOM
        const existingMessage = document.querySelector(`.message-bubble[data-message-id="${data.message_id}"]`);
        if (existingMessage) {
            console.log('[ChatManager] Message already exists in DOM, skipping');
            return;
        }

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
        console.log('[ChatManager] Played notification sound');

        // If the message is not from us, mark it as delivered
        if (data.sender_id !== this.options.currentUserId) {
            console.log('[ChatManager] Message from other user, marking as delivered');
            this._markMessageAsDelivered(data.message_id, data.sender_id);

            // If the page is visible, also mark it as read
            if (!document.hidden) {
                console.log('[ChatManager] Page is visible, marking message as read');
                this._markMessageAsRead(data.message_id, data.sender_id);
            } else {
                // Add to unread messages to mark as read when user focuses tab
                this.unreadMessages.push({
                    id: data.message_id,
                    senderId: data.sender_id
                });
                console.log('[ChatManager] Page is not visible, added to unread messages');
            }
        }
    }

    /**
     * Handle message status updates
     */
    _onMessageStatusUpdate(data) {
        console.log('[ChatManager] Processing message status update:', JSON.stringify(data));
        if (data.inquiry_id !== this.options.inquiryId) return;

        const messageEl = document.querySelector(`.message-bubble[data-message-id="${data.message_id}"]`);
        if (!messageEl) {
            console.warn('[ChatManager] Message element not found for status update:', data.message_id);
            return;
        }

        const statusEl = messageEl.querySelector('.message-status');
        if (!statusEl) {
            console.warn('[ChatManager] Status element not found for message:', data.message_id);
            return;
        }

        // Update status icon and text
        this._updateMessageStatusDisplay(statusEl, data.status);

        // Remove from pending messages if applicable
        if (this.pendingMessages.has(data.message_id)) {
            this.pendingMessages.delete(data.message_id);
            console.log('[ChatManager] Removed message from pending messages:', data.message_id);
        }
    }

    /**
     * Handle typing indicator events
     */
    _onUserTyping(data) {
        console.log('[ChatManager] Processing typing indicator event:', JSON.stringify(data));
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
            console.log('[ChatManager] Typing indicator shown for user:', data.user_name);
        } else {
            // Hide typing indicator
            this.typingIndicator.classList.add('hidden');
            this.typingIndicator.innerHTML = '';
            console.log('[ChatManager] Typing indicator hidden for user:', data.user_name);
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
            console.log('[ChatManager] Typing started');
        }
        // If no content and we are typing, send typing end
        else if (!content && this.isTyping) {
            this.isTyping = false;
            this._sendTypingIndicator(false);
            console.log('[ChatManager] Typing stopped');
        }

        // Set timeout to automatically stop typing indicator after 3 seconds
        this.typingTimeout = setTimeout(() => {
            if (this.isTyping) {
                this.isTyping = false;
                this._sendTypingIndicator(false);
                console.log('[ChatManager] Typing indicator timeout reached, stopped typing');
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

        console.log('[ChatManager] Sending typing indicator:', JSON.stringify(data));

        // Emit typing indicator event
        socketManager.emit('typing_indicator', data);
    }

    /**
     * Send a chat message
     */
    _sendMessage() {
        const content = this.messageInput.value.trim();
        if (!content) return;

        console.log('[ChatManager] Preparing to send message:', content);

        // Clear input
        this.messageInput.value = '';

        // Reset typing indicator
        if (this.isTyping) {
            this.isTyping = false;
            this._sendTypingIndicator(false);
        }

        // Save current form action/method
        const form = this.messageInput.closest('form');
        if (!form) {
            console.error('[ChatManager] No form found for message input');
            return;
        }

        // Track sent message
        this._trackSentMessage(content);

        // Additional direct socket event for more reliable delivery
        try {
            const messageData = {
                inquiry_id: this.options.inquiryId,
                content: content,
                sender_id: this.options.currentUserId,
                timestamp: new Date().toISOString()
            };

            // Add role-specific data
            if (this.options.currentUserRole === 'student') {
                messageData.office_id = this.options.officeId;
                console.log('[ChatManager] Emitting student_message_sent with data:', JSON.stringify(messageData));
                this.options.socketManager.emit('chat_message_sent', messageData);
            } else {
                messageData.student_id = this.options.studentId;
                console.log('[ChatManager] Emitting chat_message_sent with data:', JSON.stringify(messageData));
                this.options.socketManager.emit('chat_message_sent', messageData);
            }
        } catch (error) {
            console.error('[ChatManager] Error sending message via socket:', error);
        }

        // Let the form submit normally (or in case of AJAX, the regular handler will take care of it)
        console.log('[ChatManager] Submitting form to send message');
    }

    /**
     * Track a sent message for status updates
     */
    _trackSentMessage(content) {
        console.log('[ChatManager] Tracking sent message:', content);
        // We'll add this message to our tracking once we get the message ID from server
        // In a form-submitted case, we'll receive the message on our socket with the ID
    }

    /**
     * Append a new message to the UI
     */
    _appendMessage(message) {
        console.log('[ChatManager] Appending message to UI:', JSON.stringify(message));
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
        console.log('[ChatManager] Marking message as delivered:', messageId, 'from sender:', senderId);

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
        console.log('[ChatManager] Marking message as read:', messageId, 'from sender:', senderId);

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
        console.log('[ChatManager] Marking visible messages as read');
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
        console.log('[ChatManager] Updating message status display:', status);
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
            console.log('[ChatManager] Playing notification sound');
            notificationSound.play().catch(err => {
                // Handle autoplay restrictions
                console.warn('[ChatManager] Could not play notification sound:', err);
            });
        } else {
            console.warn('[ChatManager] Notification sound element not found');
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatManager;
}