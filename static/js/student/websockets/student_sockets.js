// Student-specific Socket Manager for real-time notifications
class StudentSocketManager extends BaseSocketManager {
    constructor(options = {}) {
        super(options);
        this._studentId = window.currentUserId;
        this._soundEnabled = options.sound !== false;
        this._debug = options.debug === true || true; // Enable debug by default for troubleshooting

        // Typing indicator functionality
        this._typingTimeouts = {};
        this._typingIndicators = {};

        // Create notification sound element
        this._createNotificationSound();

        console.log(`StudentSocketManager initialized with studentId: ${this._studentId}`, { studentId: this._studentId });
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

                console.log('StudentSocketManager connected successfully');
                console.log(`User ID: ${this._studentId}`);

                if (this._studentId) {
                    // Join student-specific room
                    this.joinRoom(`user_${this._studentId}`);
                    this.joinRoom(`student_${this._studentId}`);
                    console.log(`Joined personal rooms: user_${this._studentId}, student_${this._studentId}`);
                }

                // Join student room
                this.joinRoom('student_room');
                console.log('Joined student_room');

                // Join inquiry rooms if on an inquiry page
                const currentInquiryId = this._getCurrentInquiryId();
                if (currentInquiryId) {
                    this.joinRoom(`inquiry_${currentInquiryId}`);
                    console.log(`Joined inquiry room: inquiry_${currentInquiryId}`);

                    // Also explicitly join inquiry_view room
                    this.joinRoom(`inquiry_view_${currentInquiryId}`);
                    console.log(`Joined inquiry view room: inquiry_view_${currentInquiryId}`);
                }

                if (this._debug) {
                    console.log('Student socket connected successfully');
                    this.debug(); // Print connection debug info
                }

                // Auto-activate features based on current page
                this.activatePageFeatures();

                resolve();
            }, 'connection');

            // Listen for errors
            this.on('error', (error) => {
                clearTimeout(timeout);
                console.error('StudentSocketManager connection error:', error);
                reject(error);
            }, 'connection');

            // Add reconnection handler to re-join rooms
            this.on('reconnect', (attemptNumber) => {
                console.log(`Socket reconnected after ${attemptNumber} attempts`);

                // Re-join rooms after reconnection
                if (this._studentId) {
                    this.joinRoom(`user_${this._studentId}`);
                    this.joinRoom(`student_${this._studentId}`);
                }

                const currentInquiryId = this._getCurrentInquiryId();
                if (currentInquiryId) {
                    this.joinRoom(`inquiry_${currentInquiryId}`);
                    this.joinRoom(`inquiry_view_${currentInquiryId}`);
                }

                console.log('Rooms re-joined after reconnection');
            }, 'connection');
        });
    }

    /**
     * Rejoin all necessary rooms for the current user and page context
     * Used when the socket manager exists but might need to resubscribe to rooms
     */
    rejoinRooms() {
        console.log('DEBUG: Rejoining all necessary rooms');

        // Join student room
        this.joinRoom('student_room');
        console.log('DEBUG: Rejoined student_room');

        // Join personal rooms
        if (this._studentId) {
            this.joinRoom(`user_${this._studentId}`);
            this.joinRoom(`student_${this._studentId}`);
            console.log(`DEBUG: Rejoined personal rooms: user_${this._studentId}, student_${this._studentId}`);
        }

        // Join inquiry room if on an inquiry page
        const currentInquiryId = this._getCurrentInquiryId();
        if (currentInquiryId) {
            this.joinRoom(`inquiry_${currentInquiryId}`);
            this.joinRoom(`inquiry_view_${currentInquiryId}`);
            console.log(`DEBUG: Rejoined inquiry rooms: inquiry_${currentInquiryId}, inquiry_view_${currentInquiryId}`);
        }

        // Join counseling room if on a counseling page
        const counselingSessionId = this._getCurrentCounselingSessionId();
        if (counselingSessionId) {
            this.joinRoom(`counseling_${counselingSessionId}`);
            console.log(`DEBUG: Rejoined counseling room: counseling_${counselingSessionId}`);
        }

        return this;
    }

    // Get the current inquiry ID from the page URL or data attribute
    _getCurrentInquiryId() {
        // Try to get from URL first
        const urlMatch = window.location.pathname.match(/\/inquiry\/(\d+)/);
        if (urlMatch && urlMatch[1]) {
            return urlMatch[1];
        }

        // Try to get from data attribute
        const chatContainer = document.querySelector('[data-inquiry-id]');
        if (chatContainer) {
            return chatContainer.dataset.inquiryId;
        }

        return null;
    }

    // Helper method to get counseling session ID if available
    _getCurrentCounselingSessionId() {
        // Try to get from URL
        const urlMatch = window.location.pathname.match(/\/counseling\/(\d+)/);
        if (urlMatch && urlMatch[1]) {
            return urlMatch[1];
        }

        // Try to get from data attribute
        const counselingContainer = document.querySelector('[data-counseling-id], [data-session-id]');
        if (counselingContainer) {
            return counselingContainer.dataset.counselingId || counselingContainer.dataset.sessionId;
        }

        return null;
    }

    // Method to activate features based on the current page
    activatePageFeatures() {
        console.log('Detecting and activating features for current page');

        // Always activate notifications
        this.activateFeature('notification');

        // Check URL to determine which features to activate
        if (window.location.pathname.includes('/inquiry/')) {
            this.activateFeature('chat');
            console.log('Activated chat feature for inquiry page');

            // Join inquiry-specific rooms
            const currentInquiryId = this._getCurrentInquiryId();
            if (currentInquiryId) {
                this.joinRoom(`inquiry_${currentInquiryId}`);
                this.joinRoom(`inquiry_view_${currentInquiryId}`);
                console.log(`Joined inquiry rooms: inquiry_${currentInquiryId}`);
            }
        }

        if (window.location.pathname.includes('/counseling/')) {
            this.activateFeature('counseling');
            console.log('Activated counseling feature for counseling page');

            // Join counseling-specific rooms if needed
            const counselingSessionId = this._getCurrentCounselingSessionId();
            if (counselingSessionId) {
                this.joinRoom(`counseling_${counselingSessionId}`);
                console.log(`Joined counseling room: counseling_${counselingSessionId}`);
            }
        }

        if (window.location.pathname.includes('/announcements')) {
            this.activateFeature('announcement');
            console.log('Activated announcement feature');
        }
    }

    // Override chat handlers setup
    _setupChatHandlers() {
        // Call parent method to set up basic chat handlers
        super._setupChatHandlers();

        console.log('Setting up student-specific chat handlers');

        // Add event listener directly to the socket for debugging
        this.socketManager.socket.on('new_chat_message', (data) => {
            console.log('[DIRECT] Received new_chat_message event directly on socket:', data);
        });

        this.socketManager.socket.on('new_message', (data) => {
            console.log('[DIRECT] Received new_message event directly on socket:', data);
        });

        // Add student-specific chat handlers
        this.on('new_message', (data) => {
            console.log('Received new_message event:', data);

            // Only handle if it's to this student and from an office admin
            if (data.student_id == this._studentId && data.from_admin) {
                const officeName = data.office_name || 'Office Admin';
                const title = `${officeName} replied`;

                // Create a preview of the message content
                const messagePreview = data.content && data.content.length > 100
                    ? data.content.substring(0, 100) + '...'
                    : data.content;

                // Update chat UI if on chat page
                const chatContainer = document.querySelector(`.chat-container[data-inquiry-id="${data.inquiry_id}"]`);
                if (chatContainer) {
                    console.log('Found chat container, updating UI directly');
                    this._addMessageToChatUI(chatContainer, data);

                    // Mark as delivered immediately
                    this.emit('chat_message_delivered', {
                        inquiry_id: data.inquiry_id,
                        message_id: data.message_id,
                        sender_id: data.sender_id
                    });
                    console.log('Marked message as delivered');

                    // If document is visible, also mark as read
                    if (!document.hidden) {
                        this.emit('chat_message_read', {
                            inquiry_id: data.inquiry_id,
                            message_id: data.message_id,
                            sender_id: data.sender_id
                        });
                        console.log('Marked message as read');
                    }
                } else {
                    console.log('No chat container found, showing notification');
                    // If not on the chat page, show notification
                    this._showNotification(
                        title,
                        messagePreview || 'You have a new reply to your inquiry',
                        'info',
                        {
                            is_reply: true,
                            office_name: officeName,
                            inquiry_id: data.inquiry_id,
                            message_id: data.message_id
                        }
                    );

                    // Play notification sound
                    this._playNotificationSound();

                    // Update notification count
                    this._updateNotificationCount();
                }
            }
        }, 'chat');

        // Enhanced handler for new_chat_message to update UI directly
        this.on('new_chat_message', (data) => {
            console.log('Received new_chat_message event:', data);

            // Check if message is from admin and is for this student
            if (data.from_admin && data.student_id == this._studentId) {
                console.log('New message from admin to this student:', data);
                const officeName = data.office_name || 'Office Admin';
                const title = `${officeName} replied`;

                // Create a preview of the message content
                const messagePreview = data.content && data.content.length > 100
                    ? data.content.substring(0, 100) + '...'
                    : data.content;

                // Check if we're on the chat page for this inquiry
                const chatContainer = document.querySelector(`.chat-container[data-inquiry-id="${data.inquiry_id}"]`);
                if (chatContainer) {
                    console.log('Found chat container for inquiry_id:', data.inquiry_id);

                    // Check if message already exists to avoid duplicates
                    const existingMessage = chatContainer.querySelector(`[data-message-id="${data.message_id}"]`);
                    if (existingMessage) {
                        console.log('Message already exists in UI, not adding duplicate');
                        return;
                    }

                    this._addMessageToChatUI(chatContainer, data);

                    // Mark as delivered
                    this.emit('chat_message_delivered', {
                        inquiry_id: data.inquiry_id,
                        message_id: data.message_id,
                        sender_id: data.sender_id
                    });
                    console.log('Marked message as delivered (new_chat_message)');

                    // If document is visible, mark as read
                    if (!document.hidden) {
                        this.emit('chat_message_read', {
                            inquiry_id: data.inquiry_id,
                            message_id: data.message_id,
                            sender_id: data.sender_id
                        });
                        console.log('Marked message as read (new_chat_message)');
                    }
                } else {
                    console.log('No chat container found, showing notification instead');
                    // Show notification
                    this._showNotification(
                        title,
                        messagePreview || 'You have a new message',
                        'info',
                        {
                            is_reply: true,
                            office_name: officeName,
                            inquiry_id: data.inquiry_id,
                            message_id: data.message_id
                        }
                    );

                    // Play notification sound
                    this._playNotificationSound();

                    // Update notification count
                    this._updateNotificationCount();
                }
            } else {
                console.log('Message not relevant to this student or not from admin');
            }
        }, 'chat');

        // Add explicit handler for admin_message_sent event
        this.on('admin_message_sent', (data) => {
            console.log('Received admin_message_sent event:', data);

            if (data.student_id == this._studentId) {
                console.log('Message from admin intended for this student:', data);

                const chatContainer = document.querySelector(`.chat-container[data-inquiry-id="${data.inquiry_id}"]`);
                if (chatContainer) {
                    // Check if message already exists
                    const existingMessage = chatContainer.querySelector(`[data-message-id="${data.message_id}"]`);
                    if (!existingMessage) {
                        this._addMessageToChatUI(chatContainer, data);

                        // Mark as delivered
                        this.emit('chat_message_delivered', {
                            inquiry_id: data.inquiry_id,
                            message_id: data.message_id,
                            sender_id: data.sender_id
                        });

                        // If page is visible, also mark as read
                        if (!document.hidden) {
                            this.emit('chat_message_read', {
                                inquiry_id: data.inquiry_id,
                                message_id: data.message_id,
                                sender_id: data.sender_id
                            });
                        }
                    }
                }
            }
        }, 'chat');

        // Listen for typing indicators from staff/admin
        this.on('admin_typing', (data) => {
            console.log('Received admin typing event:', data);
            this._handleTypingIndicator(data);
        }, 'chat');
    }

    // Helper method to handle typing indicators
    _handleTypingIndicator(data) {
        // Find the typing indicator element
        const inquiry_id = data.inquiry_id;
        const typingIndicator = document.querySelector(`.chat-container[data-inquiry-id="${inquiry_id}"] .typing-indicator`);

        if (!typingIndicator) {
            console.log('No typing indicator element found');
            return;
        }

        // Clear any existing timeout
        if (this._typingTimeouts[inquiry_id]) {
            clearTimeout(this._typingTimeouts[inquiry_id]);
        }

        if (data.is_typing) {
            // Show the typing indicator
            typingIndicator.classList.remove('hidden');
            typingIndicator.textContent = `${data.admin_name || 'Admin'} is typing...`;
            console.log(`Showing typing indicator for ${data.admin_name || 'Admin'}`);

            // Set timeout to hide after 5 seconds if no updates
            this._typingTimeouts[inquiry_id] = setTimeout(() => {
                typingIndicator.classList.add('hidden');
                console.log('Hiding typing indicator (timeout)');
            }, 5000);
        } else {
            // Hide the typing indicator
            typingIndicator.classList.add('hidden');
            console.log('Hiding typing indicator');
        }
    }

    // Helper method to add message to the chat UI
    _addMessageToChatUI(chatContainer, data) {
        const messageList = chatContainer.querySelector('.message-list, .messages, #messageHistory');
        if (!messageList) {
            console.error('No message list container found in the chat UI');
            return;
        }

        const isSelf = data.sender_id == this._studentId;
        const messageDiv = document.createElement('div');
        messageDiv.className = `flex ${isSelf ? 'justify-end' : ''} mb-4`;

        // Format date
        let formattedTime;
        try {
            const date = new Date(data.timestamp);
            formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            formattedTime = data.timestamp;
        }

        console.log(`Creating message element. From self: ${isSelf}, Message ID: ${data.message_id}`);

        // Create message content
        messageDiv.innerHTML = `
            <div class="message-bubble ${isSelf ? 'message-sent bg-blue-100' : 'message-received bg-gray-100'} p-3 rounded-lg max-w-xs md:max-w-md lg:max-w-lg" data-message-id="${data.message_id}" data-sender-id="${data.sender_id}">
                <div class="flex justify-between items-start">
                    <span class="font-semibold text-sm">${isSelf ? 'You' : data.sender_name}</span>
                    <span class="text-xs text-gray-500 ml-2">${formattedTime}</span>
                </div>
                <div class="mt-1 text-sm whitespace-pre-wrap">${data.content}</div>
                ${!isSelf ? '' : `
                <div class="message-status text-xs text-right mt-1">
                    <span class="status-icon">
                        <i class="fas fa-check"></i>
                    </span>
                    <span class="status-text ml-1">Sent</span>
                </div>
                `}
            </div>
        `;

        // Add to message list
        messageList.appendChild(messageDiv);
        console.log('Message added to UI');

        // Play notification sound for incoming messages that aren't from the current user
        if (!isSelf) {
            this._playNotificationSound();
        }

        // Scroll to bottom
        messageList.scrollTop = messageList.scrollHeight;
        console.log('Scrolled to bottom');
    }

    // Helper method for showing notifications on screen
    _showNotification(title, message, type = 'info', data = {}) {
        // Create notification container if it doesn't exist
        let container = document.getElementById('toast-notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-notification-container';
            container.className = 'fixed bottom-4 right-4 z-50 flex flex-col-reverse items-end';
            document.body.appendChild(container);
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'bg-white rounded-lg shadow-lg overflow-hidden mt-3 transition-all duration-300 transform translate-y-2 opacity-0 max-w-md w-full';
        notification.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';

        // Set notification content based on type
        const bgColor = type === 'info' ? 'bg-blue-100' :
            type === 'success' ? 'bg-green-100' :
                type === 'warning' ? 'bg-yellow-100' : 'bg-red-100';

        notification.innerHTML = `
            <div class="p-4">
                <div class="flex items-start">
                    <div class="flex-shrink-0 ${bgColor} p-2 rounded">
                        <svg class="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    </div>
                    <div class="ml-3 w-0 flex-1">
                        <p class="font-medium text-gray-800">${title}</p>
                        <p class="mt-1 text-sm text-gray-600">${message}</p>
                    </div>
                    <div class="ml-4 flex-shrink-0 flex">
                        <button class="bg-transparent rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none">
                            <span class="sr-only">Close</span>
                            <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
                ${data.is_reply ? `
                <div class="mt-3">
                    <a href="/inquiry/${data.inquiry_id}" class="text-sm font-medium text-blue-600 hover:text-blue-500 transition duration-150 ease-in-out">
                        View Message
                    </a>
                </div>
                ` : ''}
            </div>
        `;

        // Add to container
        container.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.classList.remove('opacity-0', 'translate-y-2');
        }, 50);

        // Add click handler for close button
        const closeButton = notification.querySelector('button');
        closeButton.addEventListener('click', () => {
            this._dismissNotification(notification);
        });

        // Auto dismiss after 5 seconds
        setTimeout(() => {
            this._dismissNotification(notification);
        }, 5000);
    }

    _dismissNotification(notification) {
        notification.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }

    _updateNotificationCount() {
        const badge = document.querySelector('.notification-badge');
        if (badge) {
            const currentCount = parseInt(badge.textContent) || 0;
            badge.textContent = currentCount + 1;
            badge.classList.remove('hidden');
        }
    }

    /**
     * Setup typing event listeners for a chat input
     * @param {HTMLElement} inputElement - The input element to track
     * @param {Object} options - Options including inquiry_id and office_admin_id
     */
    setupTypingTracker(inputElement, { inquiry_id, office_admin_id }) {
        if (!inputElement || !inquiry_id || !office_admin_id) {
            console.warn('Missing required parameters for typing tracker', { inquiry_id, office_admin_id });
            return;
        }

        console.log(`Setting up typing tracker for inquiry ${inquiry_id} to admin ${office_admin_id}`);

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
                    console.log(`Emitted typing status: ${typing ? 'typing' : 'stopped typing'}`);
                }
            }
        };

        // Handle keydown event
        inputElement.addEventListener('keydown', () => {
            // Clear existing timer
            if (typingTimer) clearTimeout(typingTimer);

            // Set typing status if changed
            emitTypingStatus(true);

            // Set timer to clear typing status
            typingTimer = setTimeout(() => {
                emitTypingStatus(false);
            }, 3000); // 3 seconds without typing = stopped typing
        });

        // Handle blur event to clear typing status
        inputElement.addEventListener('blur', () => {
            if (typingTimer) clearTimeout(typingTimer);
            emitTypingStatus(false);
        });

        console.log('Typing tracker setup complete');
    }

    _playNotificationSound() {
        if (!this._soundEnabled || !this._notificationSound) return;

        // Try to play the sound
        this._notificationSound.play().catch(error => {
            console.warn('Could not play notification sound:', error);
        });
    }

    _createNotificationSound() {
        if (this._notificationSound) return;

        this._notificationSound = document.createElement('audio');
        this._notificationSound.src = '/static/sounds/notification.mp3';
        this._notificationSound.setAttribute('preload', 'auto');
        this._notificationSound.setAttribute('hidden', 'true');
        document.body.appendChild(this._notificationSound);
    }
}

// Initialize the student socket manager when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait a moment for the base socket manager to initialize
    setTimeout(() => {
        if (window.socketManager) {
            // Use the existing socket manager if available
            console.log('Using existing socket manager for student');

            // Make sure the socket manager is a StudentSocketManager
            if (!(window.socketManager instanceof StudentSocketManager)) {
                console.log('Converting base socket manager to StudentSocketManager');
                // Create a student socket manager that uses the existing socket connection
                window.socketManager = new StudentSocketManager({
                    socket: window.socketManager.socketManager.socket,
                    sound: true
                });
            }
        } else {
            // Create a new socket manager instance
            console.log('Creating new socket manager for student');
            window.socketManager = new StudentSocketManager({
                sound: true
            });
        }

        // Initialize the socket connection
        window.socketManager.initialize()
            .then(() => {
                console.log('Student socket manager initialized successfully');
                // Use our new method to activate features based on page
                window.socketManager.activatePageFeatures();
            })
            .catch(error => {
                console.error('Failed to initialize student socket manager:', error);
            });
    }, 100);
});