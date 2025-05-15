// Office-specific Socket Manager for real-time notifications
class OfficeSocketManager extends BaseSocketManager {
    constructor(options = {}) {
        super(options);
        this._officeId = options.officeId || null;
        this._userId = window.currentUserId;
        this._soundEnabled = options.sound !== false;
        this._debug = options.debug === true || true; // Enable debug by default for troubleshooting

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

        // Initialize feature set
        this._activeFeatures = new Set();

        // Set up heartbeat and visibility tracking
        this._setupActivityTracking();

        // Log initialization
        console.log(`OfficeSocketManager initialized with officeId: ${this._officeId}, userId: ${this._userId}`);
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

                // Send initial status
                this._updateActivity();

                // Update connection indicator
                const connectionStatus = document.getElementById('office-connection-status');
                if (connectionStatus) {
                    connectionStatus.classList.remove('text-red-500');
                    connectionStatus.classList.add('text-green-500');
                    connectionStatus.setAttribute('title', 'Connected to notification system');
                }

                console.log('OfficeSocketManager connected successfully');

                // Explicitly join office-specific room
                if (this._officeId) {
                    this.joinRoom(`office_${this._officeId}`);
                    console.log(`Joined office room: office_${this._officeId}`);
                }

                // Also join user-specific room
                if (this._userId) {
                    this.joinRoom(`user_${this._userId}`);
                    console.log(`Joined user room: user_${this._userId}`);
                }

                // Join inquiry room if on an inquiry page
                const currentInquiryId = this._getCurrentInquiryId();
                if (currentInquiryId) {
                    this.joinRoom(`inquiry_${currentInquiryId}`);
                    console.log(`Joined inquiry room: inquiry_${currentInquiryId}`);

                    // Also join inquiry view room explicitly
                    this.joinRoom(`inquiry_view_${currentInquiryId}`);
                    console.log(`Joined inquiry view room: inquiry_${currentInquiryId}`);
                }

                resolve();
            }, 'connection');

            // Listen for errors
            this.on('error', (error) => {
                clearTimeout(timeout);
                console.error('OfficeSocketManager connection error:', error);
                reject(error);
            }, 'connection');

            // Add reconnection handler to re-join rooms
            this.on('reconnect', (attemptNumber) => {
                console.log(`Socket reconnected after ${attemptNumber} attempts`);

                // Re-join rooms after reconnection
                if (this._officeId) {
                    this.joinRoom(`office_${this._officeId}`);
                }

                if (this._userId) {
                    this.joinRoom(`user_${this._userId}`);
                }

                const currentInquiryId = this._getCurrentInquiryId();
                if (currentInquiryId) {
                    this.joinRoom(`inquiry_${currentInquiryId}`);
                    this.joinRoom(`inquiry_view_${currentInquiryId}`);
                }

                console.log('Rooms re-joined after reconnection');

                // Update status
                this._updateActivity();
            }, 'connection');
        });
    }

    /**
     * Rejoin all necessary rooms for the current user and page context
     * Used when the socket manager exists but might need to resubscribe to rooms
     */
    rejoinRooms() {
        console.log('DEBUG: Office socket manager rejoining all necessary rooms');

        // Join office-specific room
        if (this._officeId) {
            this.joinRoom(`office_${this._officeId}`);
            console.log(`DEBUG: Rejoined office room: office_${this._officeId}`);
        }

        // Join user-specific room
        if (this._userId) {
            this.joinRoom(`user_${this._userId}`);
            console.log(`DEBUG: Rejoined user room: ${this._userId}`);
        }

        // Join admin room if needed
        this.joinRoom('office_admin_room');
        console.log('DEBUG: Rejoined office_admin_room');

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

    // Helper to get the current inquiry ID from URL or DOM
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

    /**
     * Get current counseling session ID if available from URL or DOM
     */
    _getCurrentCounselingSessionId() {
        // Try to get from URL first
        const urlMatch = window.location.pathname.match(/\/video_counseling\/(\d+)/);
        if (urlMatch && urlMatch[1]) {
            return urlMatch[1];
        }

        // Try alternate URL format
        const altUrlMatch = window.location.pathname.match(/\/video_session\/(\d+)/);
        if (altUrlMatch && altUrlMatch[1]) {
            return altUrlMatch[1];
        }

        // Try to get from data attribute
        const sessionContainer = document.querySelector('[data-counseling-id], [data-session-id]');
        if (sessionContainer) {
            return sessionContainer.dataset.counselingId || sessionContainer.dataset.sessionId;
        }

        return null;
    }

    // Override the detectPageFeatures method to include office-specific detection
    detectPageFeatures() {
        // Get base features first
        const features = super.detectPageFeatures();

        // Add office-specific features
        // Always include staff feature for office staff
        features.add('staff');

        // Detect office inquiries page
        if (document.querySelector('[data-inquiries-container]') ||
            window.location.pathname.includes('/office_inquiries') ||
            window.location.pathname.includes('/inquiry/')) {
            features.add('chat');
        }

        console.log('Detected office page features:', Array.from(features));
        return features;
    }

    // Method to activate a specific feature
    activateFeature(feature) {
        if (this._activeFeatures.has(feature)) {
            console.log(`Feature ${feature} is already active`);
            return;
        }

        console.log(`Activating office feature: ${feature}`);

        switch (feature) {
            case 'chat':
                this._setupChatHandlers();
                break;
            case 'counseling':
                this._setupCounselingHandlers();
                break;
            case 'announcement':
                this._setupAnnouncementHandlers();
                break;
            case 'notification':
                this._setupNotificationHandlers();
                break;
            case 'staff':
                this._setupStaffHandlers();
                break;
            default:
                console.warn(`Unknown feature: ${feature}`);
                return;
        }

        this._activeFeatures.add(feature);
    }

    // Method to deactivate a specific feature
    deactivateFeature(feature) {
        if (!this._activeFeatures.has(feature)) {
            console.log(`Feature ${feature} is not active`);
            return;
        }

        console.log(`Deactivating office feature: ${feature}`);
        this.cleanupFeatureHandlers(feature);
        this._activeFeatures.delete(feature);
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

    _setupNotificationHandlers() {
        // First call parent method to set up basic notification handlers
        super._setupNotificationHandlers();

        // Listen for office-specific notification events
        document.addEventListener('notification:received', (customEvent) => {
            const data = customEvent.detail;

            // Handle all notification events through the custom event system
            if (data.eventType === 'inquiry_status_changed') {
                if (!this._officeId || data.office_id == this._officeId) {
                    this._handleInquiryStatusChange(data);
                }
            } else if (data.eventType === 'notification') {
                this._handleGenericNotification(data);
            }
        });
    }

    _handleInquiryStatusChange(data) {
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

    _handleGenericNotification(data) {
        if (data.user_id == window.currentUserId || !data.user_id) {
            this._showNotification(data.title, data.message, data.type || 'info');
            this._updateNotificationBadge(1); // Increment count by 1
            this._playNotificationSound();
        }
    }

    _setupStaffHandlers() {
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
        }, 'staff');
    }

    // Override chat handlers setup
    _setupChatHandlers() {
        // First call parent method to set up chat event system
        super._setupChatHandlers();

        // Add direct socket event listeners for debugging
        this.socketManager.socket.on('new_chat_message', (data) => {
            console.log('[DIRECT] Received new_chat_message event directly on socket:', data);
        });

        this.socketManager.socket.on('new_message', (data) => {
            console.log('[DIRECT] Received new_message event directly on socket:', data);
        });

        this.socketManager.socket.on('student_message_sent', (data) => {
            console.log('[DIRECT] Received student_message_sent event directly on socket:', data);
        });

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
        }, 'chat');

        // Use the centralized event system for chat messages
        document.addEventListener('chat:new_message', (customEvent) => {
            const data = customEvent.detail;
            console.log('Received chat:new_message event:', data);

            // Only process messages that are relevant to this office
            if ((!this._officeId || data.office_id == this._officeId) && (!data.from_admin || data.sender_id != this._userId)) {
                this._handleNewMessage(data);
            }
        });

        // Add explicit handler for student_message_sent event
        this.on('student_message_sent', (data) => {
            console.log('Received student_message_sent event:', data);

            if (!this._officeId || data.office_id == this._officeId) {
                // Check if we need to process this message (not from this user)
                if (!data.from_admin || data.sender_id != this._userId) {
                    console.log('Processing student message for this office:', data);
                    this._handleNewMessage(data);
                }
            }
        }, 'chat');

        // Add explicit handler for new_chat_message event
        this.on('new_chat_message', (data) => {
            console.log('Received new_chat_message event:', data);

            // Verify this message is for this office
            if (!this._officeId || data.office_id == this._officeId) {
                // Make sure it's not our own message
                if (!data.from_admin || data.sender_id != this._userId) {
                    console.log('Processing new chat message for this office:', data);

                    // If we're viewing the specific inquiry, update the UI
                    const currentInquiryId = this._getCurrentInquiryId();
                    if (currentInquiryId && currentInquiryId == data.inquiry_id) {
                        // Check if message already exists to avoid duplicates
                        const existingMessage = document.querySelector(`[data-message-id="${data.message_id}"]`);
                        if (!existingMessage) {
                            this._handleNewMessage(data);
                        } else {
                            console.log('Message already exists in the DOM, not adding duplicate');
                        }
                    } else {
                        // If not viewing this inquiry, show notification
                        this._showNotification('New Message',
                            `${data.sender_name || 'Student'} sent a message in inquiry #${data.inquiry_id}`,
                            'info');
                        this._playNotificationSound();
                    }
                }
            }
        }, 'chat');

        // Use the centralized event system for typing indicators
        document.addEventListener('chat:typing_indicator', (customEvent) => {
            const data = customEvent.detail;
            console.log('Received chat:typing_indicator event:', data);

            // Only handle typing indicators from students or other staff
            if (data.office_admin_id !== this._userId) {
                this._handleTypingIndicator(data);
            }
        });

        // Add explicit handler for student_typing event
        this.on('student_typing', (data) => {
            console.log('Received student_typing event:', data);
            this._handleTypingIndicator(data);
        }, 'chat');
    }

    _setupCounselingHandlers() {
        // First set up basic counseling handlers
        super._setupCounselingHandlers();

        // Use the centralized event system for counseling sessions
        document.addEventListener('counseling:session_update', (customEvent) => {
            const data = customEvent.detail;

            // Handle new counseling requests
            if (data.eventType === 'new_counseling_request') {
                if (!this._officeId || data.office_id == this._officeId) {
                    this._showNotification('New Counseling Request',
                        `${data.student_name} has requested a counseling session`, 'info');
                    this._incrementCounselingCounter();
                    this._playNotificationSound();

                    // Refresh the page if we're on the counseling page
                    if (window.location.pathname.includes('/video_counseling') && !document.getElementById('session-' + data.session_id)) {
                        setTimeout(() => {
                            window.location.reload();
                        }, 2000);
                    }
                }
            }
            // Handle other session updates
            else if (['counseling_session_created', 'counseling_session_updated', 'session_update'].includes(data.eventType)) {
                if (!this._officeId || data.office_id == this._officeId) {
                    this._showNotification(
                        'Counseling Session Update',
                        data.message || 'A counseling session has been updated',
                        'info'
                    );

                    this._playNotificationSound();
                }
            }
        });
    }

    _setupAnnouncementHandlers() {
        // First set up basic announcement handlers
        super._setupAnnouncementHandlers();

        // Use the centralized event system for announcements
        document.addEventListener('announcement:event', (customEvent) => {
            const data = customEvent.detail;

            // Handle new announcements
            if (data.eventType === 'new_announcement') {
                if ((!data.office_id && !data.target_office_id) ||
                    data.office_id == this._officeId ||
                    data.target_office_id == this._officeId) {

                    this._showNotification(
                        'New Announcement',
                        data.title || 'A new announcement has been posted',
                        'info'
                    );

                    this._playNotificationSound();
                }
            }
        });
    }

    /**
     * Handle typing indicator events
     * @param {Object} data - Typing event data from server
     */
    _handleTypingIndicator(data) {
        // Find the typing indicator element
        const inquiry_id = data.inquiry_id;
        const typingIndicator = document.querySelector(`.chat-container[data-inquiry-id="${inquiry_id}"] .typing-indicator`);

        if (!typingIndicator) return;

        // Clear any existing timeout
        if (this._typingTimeouts[inquiry_id]) {
            clearTimeout(this._typingTimeouts[inquiry_id]);
        }

        if (data.is_typing) {
            // Show the typing indicator
            typingIndicator.classList.remove('hidden');
            typingIndicator.textContent = `${data.student_name || 'Student'} is typing...`;

            // Set timeout to hide after 5 seconds if no updates
            this._typingTimeouts[inquiry_id] = setTimeout(() => {
                typingIndicator.classList.add('hidden');
            }, 5000);
        } else {
            // Hide the typing indicator
            typingIndicator.classList.add('hidden');
        }
    }

    /**
     * Setup typing event listeners for a chat input
     * @param {HTMLElement} inputElement - The input element to track
     * @param {Object} options - Options including inquiry_id and student_id
     */
    setupTypingTracker(inputElement, { inquiry_id, student_id }) {
        if (!inputElement || !inquiry_id || !student_id) return;

        let typingTimer;
        let isTyping = false;

        // Function to emit typing status
        const emitTypingStatus = (typing) => {
            if (isTyping !== typing) {
                isTyping = typing;
                this.emit('admin_typing', {
                    inquiry_id: inquiry_id,
                    student_id: student_id,
                    office_admin_id: this._userId,
                    office_id: this._officeId,
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
        if (this._notificationSound) return;

        this._notificationSound = document.createElement('audio');
        this._notificationSound.src = '/static/sounds/notification.mp3';
        this._notificationSound.setAttribute('preload', 'auto');
        this._notificationSound.setAttribute('hidden', 'true');
        document.body.appendChild(this._notificationSound);
    }

    _playNotificationSound() {
        if (!this._soundEnabled || !this._notificationSound) return;

        // Try to play the sound
        this._notificationSound.play().catch(error => {
            console.warn('Could not play notification sound:', error);
        });
    }

    _updateNotificationBadge(increment = 1) {
        const badge = document.querySelector('.notification-badge');
        if (!badge) return;

        // Get current count
        let count = parseInt(badge.textContent) || 0;

        // Increment
        count += increment;

        // Update badge
        badge.textContent = count > 99 ? '99+' : count;

        // Make sure it's visible
        badge.classList.remove('hidden');
    }

    /**
     * Display a notification to the user
     * @param {string} title - Notification title
     * @param {string} message - Notification message
     * @param {string} type - Notification type (info, success, warning, error)
     */
    _showNotification(title, message, type = 'info') {
        // Check for notification container
        const container = document.getElementById('notification-container');
        if (!container) return;

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type} animate-fade-in`;

        // Set icon based on type
        let iconPath = '';
        if (type === 'success') {
            iconPath = 'M5 13l4 4L19 7';
        } else if (type === 'info') {
            iconPath = 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
        } else if (type === 'warning') {
            iconPath = 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z';
        } else {
            iconPath = 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z';
        }

        // Create notification content
        notification.innerHTML = `
            <div class="flex p-4 rounded-lg shadow-md bg-white dark:bg-gray-800 mb-3">
                <div class="mr-3">
                    <svg class="h-6 w-6 ${type === 'info' ? 'text-blue-500' : type === 'success' ? 'text-green-500' : type === 'warning' ? 'text-yellow-500' : 'text-red-500'}" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${iconPath}"></path>
                    </svg>
                </div>
                <div class="flex-grow">
                    <h4 class="font-semibold text-sm">${title}</h4>
                    <p class="text-sm text-gray-600 dark:text-gray-300">${message}</p>
                </div>
                <button class="close-btn ml-2 text-gray-400 hover:text-gray-600">
                    <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        `;

        // Add close button handler
        const closeBtn = notification.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => {
            notification.classList.add('animate-fade-out');
            setTimeout(() => {
                container.removeChild(notification);
            }, 300);
        });

        // Add to container
        container.prepend(notification);

        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (notification.parentNode === container) {
                notification.classList.add('animate-fade-out');
                setTimeout(() => {
                    if (notification.parentNode === container) {
                        container.removeChild(notification);
                    }
                }, 300);
            }
        }, 10000);
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

        // Ensure we have a message_id (some events might use id instead)
        const messageId = data.message_id || data.id;
        if (!messageId) {
            console.warn('Message has no ID:', data);
            return;
        }

        // Check if we're on an inquiry detail page
        const isDetailPage = window.location.pathname.includes(`/inquiry/`);
        const isSpecificInquiryPage = window.location.pathname.includes(`/inquiry/${data.inquiry_id}`);

        // Check if this message already exists in the DOM (prevent duplicates)
        const existingMessage = document.querySelector(`[data-message-id="${messageId}"]`);
        if (existingMessage) {
            console.log('Message already exists in DOM, not adding duplicate:', messageId);
            return;
        }

        if (!isDetailPage) {
            this._showNotification('New Student Message',
                `${data.sender_name || 'Student'} sent a new message in Inquiry #${data.inquiry_id}`,
                'info');
            this._playNotificationSound();
        } else {
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
                const messageElement = this._createMessageElement({
                    ...data,
                    message_id: messageId
                });

                // Add to the messages container
                messageContainer.appendChild(messageElement);
                console.log('Message element appended:', messageElement);

                // Scroll to the bottom of the container
                messageContainer.scrollTop = messageContainer.scrollHeight;

                // Update status in database via API
                this._updateMessageStatus(messageId, 'delivered');

                // Play notification sound for current inquiry
                if (isSpecificInquiryPage) {
                    this._playNotificationSound();
                }

                // Mark message as delivered
                this.emit('chat_message_delivered', {
                    inquiry_id: data.inquiry_id,
                    message_id: messageId,
                    sender_id: data.sender_id
                });

                // If page is visible, also mark as read
                if (!document.hidden) {
                    this.emit('chat_message_read', {
                        inquiry_id: data.inquiry_id,
                        message_id: messageId,
                        sender_id: data.sender_id
                    });
                }
            } else if (isDetailPage) {
                console.warn('We appear to be on the detail page but could not find any suitable message container');

                // If this is specifically for the current inquiry and we still can't find a container
                // Show a notification instead
                if (isSpecificInquiryPage) {
                    console.log('This message is for the current inquiry. Showing notification instead.');
                    this._showNotification('New Message Received',
                        `${data.sender_name || 'Student'} sent: ${data.content.substring(0, 50)}${data.content.length > 50 ? '...' : ''}`,
                        'info');
                    this._playNotificationSound();
                }
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
        // Create message container
        const div = document.createElement('div');
        const isSelf = message.sender_id == this._userId;

        div.className = `message-item ${isSelf ? 'message-sent' : 'message-received'} mb-4`;

        // Format date
        let formattedTime;
        try {
            const date = new Date(message.timestamp);
            formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            formattedTime = message.timestamp;
        }

        // Create message bubble with data attributes for tracking
        const bubbleHTML = `
            <div class="flex ${isSelf ? 'justify-end' : ''}">
                <div class="message-bubble ${isSelf ? 'bg-blue-100' : 'bg-gray-100'} rounded-lg p-3 max-w-md" 
                     data-message-id="${message.message_id}" 
                     data-sender-id="${message.sender_id}">
                    <div class="flex justify-between items-start">
                        <span class="font-semibold text-sm">${isSelf ? 'You' : message.sender_name || 'Student'}</span>
                        <span class="text-xs text-gray-500 ml-2">${formattedTime}</span>
                    </div>
                    <div class="message-content mt-1 text-sm whitespace-pre-wrap">${message.content}</div>
                    ${isSelf ? `
                    <div class="message-status text-xs text-right mt-1">
                        <span class="status-icon">
                            <i class="fas ${message.status === 'read' ? 'fa-check-double text-green-500' :
                    message.status === 'delivered' ? 'fa-check-double' : 'fa-check'}"></i>
                        </span>
                        <span class="status-text ml-1">${(message.status || 'sent').charAt(0).toUpperCase() + (message.status || 'sent').slice(1)}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;

        div.innerHTML = bubbleHTML;
        console.log(`Created message element with ID: ${message.message_id}, from: ${message.sender_name}`);
        return div;
    }
}

// Initialize the office socket manager when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait a moment for the base socket manager to initialize
    setTimeout(() => {
        if (window.socketManager) {
            // Use the existing socket manager if available
            console.log('Using existing socket manager for office');

            // Make sure the socket manager is an OfficeSocketManager
            if (!(window.socketManager instanceof OfficeSocketManager)) {
                console.log('Converting base socket manager to OfficeSocketManager');
                // Get office ID from data attribute or meta tag
                const officeId = document.body.dataset.officeId ||
                    document.querySelector('meta[name="office-id"]')?.content;

                // Create an office socket manager that uses the existing socket connection
                window.socketManager = new OfficeSocketManager({
                    socket: window.socketManager.socketManager.socket,
                    officeId: officeId,
                    sound: true
                });
            }
        } else {
            // Get office ID from data attribute or meta tag
            const officeId = document.body.dataset.officeId ||
                document.querySelector('meta[name="office-id"]')?.content;

            // Create a new socket manager instance
            console.log('Creating new office socket manager with officeId:', officeId);
            window.socketManager = new OfficeSocketManager({
                officeId: officeId,
                sound: true
            });
        }

        // Initialize the socket connection
        window.socketManager.initialize()
            .then(() => {
                console.log('Office socket manager initialized successfully');
                // Activate all features based on the current page - allow multiple features to be active
                window.socketManager.activatePageFeatures();
            })
            .catch(error => {
                console.error('Failed to initialize office socket manager:', error);
            });
    }, 100);
});