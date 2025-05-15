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
                // Format the notification title for office replies
                const isOfficeReply = data.type === 'reply' ||
                    data.title?.toLowerCase().includes('reply') ||
                    data.message?.toLowerCase().includes('replied to your inquiry');

                // Get office name from the data or extract from title/message
                const officeName = data.office_name || this._extractOfficeName(data.title, data.message) || 'Office';

                // Create a more descriptive title for replies
                const title = isOfficeReply ? `${officeName} replied` : data.title;

                // Show the notification with enhanced data
                this._showNotification(
                    title,
                    data.message,
                    data.type || 'info',
                    {
                        is_reply: isOfficeReply,
                        office_name: officeName,
                        inquiry_id: data.inquiry_id
                    }
                );

                this._playNotificationSound();

                // Create or update a browser notification if supported and page is not visible
                this._createBrowserNotification(title, data.message);

                // Update notification count
                this._updateNotificationCount();
            }
        });

        // Listen for inquiry status updates
        this.on('inquiry_status_changed', (data) => {
            if (data.student_id == this._studentId) {
                const statusText = data.status.charAt(0).toUpperCase() + data.status.slice(1);
                this._showNotification(
                    'Inquiry Status Updated',
                    `Your inquiry #${data.inquiry_id} status changed to ${statusText}`,
                    'info',
                    {
                        inquiry_id: data.inquiry_id,
                        office_name: data.office_name
                    }
                );

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

                // Update notification count
                this._updateNotificationCount();
            }
        });

        // Listen for new messages
        this.on('new_message', (data) => {
            // Only handle if it's to this student and from an office admin
            if (data.student_id == this._studentId && data.from_admin) {
                const officeName = data.office_name || 'Office Admin';
                const title = `${officeName} replied`;

                // Create a preview of the message content
                const messagePreview = data.content && data.content.length > 100
                    ? data.content.substring(0, 100) + '...'
                    : data.content;

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

                this._playNotificationSound();

                // Create browser notification
                this._createBrowserNotification(title, messagePreview);

                // Update notification count
                this._updateNotificationCount();
            }
        });

        // Listen for typing indicators from staff/admin
        this.on('admin_typing', (data) => {
            this._handleTypingIndicator(data);
        });
    }

    // Helper method to extract office name from notification title/message
    _extractOfficeName(title, message) {
        // Common office name patterns in notifications
        const patterns = [
            /from\s+([A-Za-z\s&]+)\s+office/i,
            /([A-Za-z\s&]+)\s+office\s+replied/i,
            /([A-Za-z\s&]+)\s+department\s+replied/i,
            /([A-Za-z\s&]+)\s+unit\s+replied/i
        ];

        const textToSearch = `${title || ''} ${message || ''}`;

        for (const pattern of patterns) {
            const match = textToSearch.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }

        return null;
    }

    // Create browser notification if supported and page is not visible
    _createBrowserNotification(title, message) {
        if ('Notification' in window && document.visibilityState !== 'visible') {
            // Check if permission is granted
            if (Notification.permission === 'granted') {
                // Create notification
                try {
                    const notification = new Notification('KapiyuGuide - ' + title, {
                        body: message,
                        icon: '/static/images/schoollogo.png'
                    });

                    // Close after 5 seconds
                    setTimeout(() => notification.close(), 5000);

                    // Handle notification click - focus the window
                    notification.onclick = function () {
                        window.focus();
                        this.close();
                    };
                } catch (e) {
                    console.warn('Browser notification creation failed:', e);
                }
            }
            // Request permission if not denied
            else if (Notification.permission !== 'denied') {
                Notification.requestPermission();
            }
        }
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

    /**
     * Enhanced notification display method with additional metadata
     * @param {string} title - Notification title
     * @param {string} message - Notification message
     * @param {string} type - Notification type (info, success, warning, error)
     * @param {Object} metadata - Additional notification metadata
     */
    _showNotification(title, message, type = 'info', metadata = {}) {
        // Call the original method with title and message
        super._showNotification(title, message, type);

        // Check if we should add the notification to the dropdown
        const container = document.getElementById('notificationsContainer');
        if (!container) return;

        const emptyMessage = container.querySelector('.text-center.text-gray-500');
        if (emptyMessage) {
            container.innerHTML = "";
        }

        // Create a formatted notification element
        const notificationElement = document.createElement("div");
        notificationElement.className = "notification-item p-3 border-b hover:bg-gray-50 unread";

        // Add metadata as data attributes
        if (metadata.inquiry_id) {
            notificationElement.dataset.inquiryId = metadata.inquiry_id;
        }

        // Determine the appropriate icon based on notification type
        let iconClass = 'fa-info-circle';
        if (metadata.is_reply) {
            iconClass = 'fa-reply';
        } else if (type === 'success') {
            iconClass = 'fa-check-circle';
        } else if (type === 'warning') {
            iconClass = 'fa-exclamation-triangle';
        } else if (type === 'error') {
            iconClass = 'fa-exclamation-circle';
        }

        // Create message preview - limit to 100 characters
        const messagePreview = message && message.length > 100
            ? message.substring(0, 100) + '...'
            : message || '';

        // Create the notification content
        notificationElement.innerHTML = `
            <div class="flex items-start">
                <div class="flex-shrink-0 pt-1">
                    <i class="fas ${iconClass} text-blue-500"></i>
                </div>
                <div class="ml-3 flex-grow notification-content">
                    <div class="text-sm font-medium text-gray-900">${title}</div>
                    <div class="text-xs text-gray-600 mt-1 notification-preview">${messagePreview}</div>
                    <div class="text-xs text-gray-400 mt-1">Just now</div>
                </div>
                <button class="notification-close text-gray-400 hover:text-gray-600 ml-2">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // Add click handler for redirection
        notificationElement.addEventListener('click', function (e) {
            // Don't navigate if clicked on close button
            if (e.target.closest('.notification-close')) {
                return;
            }

            const inquiryId = this.dataset.inquiryId;
            if (inquiryId) {
                window.location.href = `/student/inquiry/${inquiryId}`;
            }
        });

        // Add close button functionality
        const closeBtn = notificationElement.querySelector('.notification-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                const notifItem = this.closest('.notification-item');

                // Animate removal
                notifItem.style.height = notifItem.offsetHeight + 'px';
                setTimeout(() => {
                    notifItem.style.height = '0';
                    notifItem.style.padding = '0';
                    notifItem.style.margin = '0';
                    notifItem.style.opacity = '0';
                    notifItem.style.overflow = 'hidden';
                }, 10);

                setTimeout(() => {
                    notifItem.remove();

                    // Update badge count
                    const badge = document.getElementById('notificationBadge');
                    if (badge) {
                        let count = parseInt(badge.textContent || '0');
                        if (count > 0) {
                            count--;
                            badge.textContent = count;
                            if (count === 0) badge.classList.add('hidden');
                        }
                    }

                    // Show empty message if needed
                    if (!container.querySelector('.notification-item')) {
                        container.innerHTML = `
                            <div class="p-3 text-center text-gray-500">
                                <i class="far fa-bell-slash text-gray-300 text-lg mb-2"></i>
                                <p>No notifications</p>
                            </div>
                        `;
                    }
                }, 300);
            });
        }

        // Add to container
        container.prepend(notificationElement);
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