/**
 * Counseling Session Socket Manager
 * 
 * Dedicated WebSocket manager for counseling sessions to avoid conflicts with chat system
 */

class CounselingSocketManager extends CounselingBaseManager {
    constructor(options = {}) {
        // Call parent constructor with options
        super(options);

        // Create notification sound element if enabled
        if (options.sound !== false) {
            this._createNotificationSound();
        }

        // Set up counseling-specific event handlers
        this._setupEventHandlers();
    }

    /**
     * Update counseling session status
     * @param {string} status - The new status
     * @param {string} notes - Optional notes about the status change
     */
    updateStatus(status, notes) {
        if (!this.sessionId) {
            console.error('Cannot update status - no session ID provided');
            return false;
        }

        return this.emit('counseling_status_update', {
            session_id: this.sessionId,
            status: status,
            notes: notes || ''
        });
    }

    /**
     * Send a message in the counseling session
     * @param {string} content - The message content
     */
    sendMessage(content) {
        if (!this.sessionId) {
            console.error('Cannot send message - no session ID provided');
            return false;
        }

        return this.emit('counseling_message', {
            session_id: this.sessionId,
            content: content
        });
    }

    /**
     * Change the schedule for a counseling session
     * @param {string} newDate - The new date (YYYY-MM-DD)
     * @param {string} newTime - The new time (HH:MM)
     */
    changeSchedule(newDate, newTime) {
        if (!this.sessionId) {
            console.error('Cannot change schedule - no session ID provided');
            return false;
        }

        return this.emit('schedule_change', {
            session_id: this.sessionId,
            new_date: newDate,
            new_time: newTime
        });
    }

    /**
     * Set up counseling-specific event handlers
     * @private
     */
    _setupEventHandlers() {
        // User joined the counseling session
        this.socket.on('user_joined_counseling', (data) => {
            this._log('User joined counseling:', data);
            this._triggerEvent('user_joined', data);
            this._showNotification(`${data.name} joined the counseling session`, 'info');
        });

        // User left the counseling session
        this.socket.on('user_left_counseling', (data) => {
            this._log('User left counseling:', data);
            this._triggerEvent('user_left', data);
            this._showNotification(`${data.name} left the counseling session`, 'info');
        });

        // Counseling status changed
        this.socket.on('counseling_status_changed', (data) => {
            this._log('Counseling status changed:', data);
            this._triggerEvent('status_changed', data);
            this._showNotification(`Session status changed to: ${data.status}`, 'info');
            this._playNotificationSound();
        });

        // New message received
        this.socket.on('new_counseling_message', (data) => {
            this._log('New counseling message:', data);
            this._triggerEvent('new_message', data);

            // Only play sound if message is from someone else
            if (data.sender_id !== this.userId) {
                this._showNotification(`New message from ${data.sender_name}`, 'info');
                this._playNotificationSound();
            }
        });

        // Schedule updated
        this.socket.on('counseling_schedule_updated', (data) => {
            this._log('Counseling schedule updated:', data);
            this._triggerEvent('schedule_updated', data);
            this._showNotification(`Session rescheduled to: ${data.formatted_datetime}`, 'info');
            this._playNotificationSound();
        });

        // Error handling
        this.socket.on('error', (data) => {
            console.error('Counseling socket error:', data);
            this._triggerEvent('socket_error', data);
            this._showNotification(`Error: ${data.message}`, 'error');
        });
    }

    /**
     * Create notification sound element
     * @private
     */
    _createNotificationSound() {
        if (!this._notificationSound) {
            this._notificationSound = document.createElement('audio');
            this._notificationSound.id = 'counseling-notification-sound';
            this._notificationSound.src = '/static/sounds/notification.mp3';
            this._notificationSound.preload = 'auto';
            document.body.appendChild(this._notificationSound);
        }
    }

    /**
     * Play notification sound
     * @private
     */
    _playNotificationSound() {
        if (this._notificationSound && this.options.sound !== false) {
            try {
                this._notificationSound.currentTime = 0;
                this._notificationSound.play();
            } catch (e) {
                console.warn('Could not play notification sound:', e);
            }
        }
    }

    /**
     * Show notification in the UI
     * @param {string} message - The notification message
     * @param {string} type - The notification type (info, success, error, warning)
     * @private
     */
    _showNotification(message, type = 'info') {
        if (!message) return;

        // Try to find an existing notification container
        let container = document.getElementById('counseling-notification-container');

        // Create one if it doesn't exist
        if (!container) {
            container = document.createElement('div');
            container.id = 'counseling-notification-container';
            container.className = 'fixed top-4 right-4 z-50 flex flex-col items-end space-y-2';
            document.body.appendChild(container);
        }

        // Create notification element
        const notification = document.createElement('div');

        // Set appropriate classes based on type
        let bgColor, textColor;
        switch (type) {
            case 'success':
                bgColor = 'bg-green-100';
                textColor = 'text-green-800';
                break;
            case 'error':
                bgColor = 'bg-red-100';
                textColor = 'text-red-800';
                break;
            case 'warning':
                bgColor = 'bg-yellow-100';
                textColor = 'text-yellow-800';
                break;
            default: // info
                bgColor = 'bg-blue-100';
                textColor = 'text-blue-800';
        }

        notification.className = `${bgColor} ${textColor} px-4 py-3 rounded shadow-md max-w-md transform transition-transform duration-300 ease-in-out`;
        notification.textContent = message;

        // Add to container
        container.appendChild(notification);

        // Remove after 5 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 5000);
    }
}

// Initialize the counseling socket manager when document is ready
document.addEventListener('DOMContentLoaded', () => {
    // Look for counseling session information on the page
    const counselingContainer = document.querySelector('[data-counseling-container]');
    if (!counselingContainer) return;

    const sessionId = counselingContainer.getAttribute('data-session-id');
    const userId = counselingContainer.getAttribute('data-user-id');
    const userRole = counselingContainer.getAttribute('data-user-role');

    if (!sessionId || !userId) {
        console.error('Missing required data attributes for counseling socket initialization');
        return;
    }

    // Create the counseling socket manager
    window.counselingSocketManager = new CounselingSocketManager({
        sessionId: sessionId,
        userId: userId,
        userRole: userRole,
        debug: true,
        sound: true
    });

    console.log('Counseling socket manager initialized');
});