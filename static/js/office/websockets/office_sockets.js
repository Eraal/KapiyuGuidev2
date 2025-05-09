// Office-specific Socket Manager for real-time notifications
class OfficeSocketManager extends BaseSocketManager {
    constructor(options = {}) {
        super(options);
        this._officeId = options.officeId || null;
        this._setupOfficeHandlers();
        this._soundEnabled = options.sound !== false;

        // Create notification sound element
        this._createNotificationSound();
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
            } else {
                officeStatusIndicator.classList.remove('text-green-500');
                officeStatusIndicator.classList.add('text-red-500');
                officeStatusIndicator.setAttribute('title', 'Disconnected from notification system');
            }
        }
    }
}