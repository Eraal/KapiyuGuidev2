/**
 * Student WebSocket handler
 * Manages real-time connections and updates for student users
 */

class StudentSocketManager {
    constructor() {
        this.socket = io();
        this.setupEventListeners();
        this.notificationSound = document.getElementById('notificationSound');
    }

    /**
     * Initialize connection and join appropriate rooms
     */
    connect() {
        this.socket.on('connect', () => {
            console.log('Connected to WebSocket server');

            // Join the student room on connection
            this.socket.emit('join', { room: 'student_room' });

            // Join personal room for this student (defined by current_user.id from server)
            // This is set in the HTML template using Jinja2
            const studentId = document.getElementById('current-user-id')?.value;
            if (studentId) {
                this.socket.emit('join', { room: `student_${studentId}` });
            }
        });
    }

    /**
     * Set up all event listeners for incoming socket events
     */
    setupEventListeners() {
        // Status messages (debug)
        this.socket.on('status', (data) => {
            console.log('Socket status:', data.msg);
        });

        // New notification event
        this.socket.on('new_notification', (data) => {
            this.handleNewNotification(data);
        });

        // Inquiry status update
        this.socket.on('inquiry_update', (data) => {
            this.handleInquiryUpdate(data);
        });

        // Session status update
        this.socket.on('session_update', (data) => {
            this.handleSessionUpdate(data);
        });

        // New announcement
        this.socket.on('new_announcement', (data) => {
            this.handleNewAnnouncement(data);
        });
    }

    /**
     * Handle new notification event
     */
    handleNewNotification(data) {
        // Play notification sound
        if (this.notificationSound) {
            this.notificationSound.play().catch(e => console.log('Error playing notification sound:', e));
        }

        // Update notification badge count
        const notificationBadge = document.getElementById('notificationBadge');
        if (notificationBadge) {
            let count = parseInt(notificationBadge.textContent || '0');
            count += 1;
            notificationBadge.textContent = count;
            notificationBadge.classList.remove('hidden');
        }

        // Add notification to dropdown if it exists
        const notificationsContainer = document.getElementById('notificationsContainer');
        if (notificationsContainer) {
            // Remove empty message if it exists
            const emptyMessage = notificationsContainer.querySelector('.text-center.text-gray-500');
            if (emptyMessage) {
                notificationsContainer.innerHTML = '';
            }

            // Create new notification element
            const notificationElement = this.createNotificationElement(data);

            // Add to the top of the list
            notificationsContainer.insertBefore(notificationElement, notificationsContainer.firstChild);
        }

        // Show toast notification
        this.showToastNotification(data);
    }

    /**
     * Create a notification element from data
     */
    createNotificationElement(data) {
        const notificationDiv = document.createElement('div');
        notificationDiv.className = 'border-b last:border-b-0';
        notificationDiv.dataset.notificationId = data.id;

        const iconClass = this.getNotificationIconClass(data.type);

        notificationDiv.innerHTML = `
            <div class="px-4 py-3 hover:bg-gray-100 transition-colors duration-150">
                <div class="flex items-start">
                    <div class="mr-2">
                        <i class="${iconClass}"></i>
                    </div>
                    <div class="flex-1">
                        <p class="text-sm font-medium text-gray-800">${data.title}</p>
                        <p class="text-xs text-gray-600 mt-1">${data.message}</p>
                        <p class="text-xs text-gray-500 mt-1">${data.timestamp}</p>
                    </div>
                </div>
            </div>
        `;

        return notificationDiv;
    }

    /**
     * Get appropriate icon class based on notification type
     */
    getNotificationIconClass(type) {
        switch (type) {
            case 'inquiry':
                return 'fas fa-envelope text-blue-600';
            case 'session':
                return 'fas fa-calendar text-green-600';
            case 'announcement':
                return 'fas fa-bullhorn text-purple-600';
            default:
                return 'fas fa-bell text-gray-600';
        }
    }

    /**
     * Show a toast notification
     */
    showToastNotification(data) {
        // Create toast container if it doesn't exist
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'fixed top-4 right-4 z-50 flex flex-col space-y-2';
            document.body.appendChild(toastContainer);
        }

        // Create toast element
        const toast = document.createElement('div');
        toast.className = 'bg-white rounded-lg shadow-lg border border-gray-200 p-4 transform transition-all duration-300 opacity-0 translate-y-2 max-w-xs';

        const iconClass = this.getNotificationIconClass(data.type);

        toast.innerHTML = `
            <div class="flex items-start">
                <div class="mr-3">
                    <i class="${iconClass}"></i>
                </div>
                <div class="flex-1">
                    <p class="font-medium text-gray-800">${data.title}</p>
                    <p class="text-sm text-gray-600 mt-1">${data.message}</p>
                </div>
                <button class="text-gray-400 hover:text-gray-600 focus:outline-none ml-4">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // Add to container
        toastContainer.appendChild(toast);

        // Animate in
        setTimeout(() => {
            toast.classList.remove('opacity-0', 'translate-y-2');
        }, 50);

        // Add click handler to close button
        const closeButton = toast.querySelector('button');
        closeButton.addEventListener('click', () => {
            this.dismissToast(toast);
        });

        // Auto dismiss after 5 seconds
        setTimeout(() => {
            this.dismissToast(toast);
        }, 5000);
    }

    /**
     * Dismiss a toast notification with animation
     */
    dismissToast(toast) {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }

    /**
     * Handle inquiry update event
     */
    handleInquiryUpdate(data) {
        // Update inquiries table if it exists
        const inquiriesTable = document.getElementById('inquiries-table');
        if (inquiriesTable && data.inquiry_id) {
            // Find the row for this inquiry if it exists
            const inquiryRow = inquiriesTable.querySelector(`tr[data-inquiry-id="${data.inquiry_id}"]`);
            if (inquiryRow) {
                // Update status cell
                const statusCell = inquiryRow.querySelector('.inquiry-status');
                if (statusCell && data.status) {
                    // Clear existing classes
                    statusCell.className = 'inquiry-status px-2 inline-flex text-xs leading-5 font-semibold rounded-full';

                    // Add appropriate class based on status
                    switch (data.status) {
                        case 'pending':
                            statusCell.classList.add('bg-yellow-100', 'text-yellow-800');
                            statusCell.textContent = 'Pending';
                            break;
                        case 'in_progress':
                            statusCell.classList.add('bg-blue-100', 'text-blue-800');
                            statusCell.textContent = 'In Progress';
                            break;
                        case 'resolved':
                            statusCell.classList.add('bg-green-100', 'text-green-800');
                            statusCell.textContent = 'Resolved';
                            break;
                        default:
                            statusCell.classList.add('bg-gray-100', 'text-gray-800');
                            statusCell.textContent = data.status;
                    }
                }
            }
        }

        // Update inquiry badges/counters
        this.updateInquiryCounters(data);
    }

    /**
     * Update inquiry counters and badges
     */
    updateInquiryCounters(data) {
        if (data.pending_count !== undefined) {
            const pendingBadge = document.getElementById('pendingInquiriesBadge');
            if (pendingBadge) {
                pendingBadge.textContent = data.pending_count;
                pendingBadge.classList.toggle('hidden', data.pending_count === 0);
            }
        }
    }

    /**
     * Handle session update event
     */
    handleSessionUpdate(data) {
        // Update sessions calendar if it exists
        const upcomingSchedule = document.querySelector('.upcoming-schedule');
        if (upcomingSchedule && data.refresh) {
            // Reload the schedule section (server will provide updated HTML)
            if (data.html) {
                upcomingSchedule.innerHTML = data.html;
            }
            // If no HTML provided, we could reload the page section using fetch
            else if (window.location.pathname.includes('dashboard')) {
                fetch('/student/dashboard/schedule')
                    .then(response => response.text())
                    .then(html => {
                        upcomingSchedule.innerHTML = html;
                    })
                    .catch(err => console.error('Error refreshing schedule:', err));
            }
        }

        // Update session badges/counters
        this.updateSessionCounters(data);
    }

    /**
     * Update session counters and badges
     */
    updateSessionCounters(data) {
        if (data.upcoming_count !== undefined) {
            const upcomingBadge = document.getElementById('upcomingSessionsBadge');
            if (upcomingBadge) {
                upcomingBadge.textContent = data.upcoming_count;
                upcomingBadge.classList.toggle('hidden', data.upcoming_count === 0);
            }
        }
    }

    /**
     * Handle new announcement event
     */
    handleNewAnnouncement(data) {
        // Update announcement counter
        const announcementCounter = document.querySelector('.new-announcements-count');
        if (announcementCounter && data.new_count !== undefined) {
            announcementCounter.textContent = data.new_count;
        }

        // If we're on the dashboard, add the new announcement to the list
        const announcementContainer = document.querySelector('.announcements-container');
        if (announcementContainer && data.html) {
            // Add new announcement at the top
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = data.html;
            const newAnnouncement = tempDiv.firstElementChild;

            // Add with fade in animation
            newAnnouncement.classList.add('opacity-0');
            announcementContainer.insertBefore(newAnnouncement, announcementContainer.firstChild);

            // Trigger animation
            setTimeout(() => {
                newAnnouncement.classList.remove('opacity-0');
            }, 50);
        }
    }

    /**
     * Mark a notification as read
     */
    markNotificationAsRead(notificationId) {
        this.socket.emit('read_notification', { notification_id: notificationId });
    }

    /**
     * Emit an inquiry activity event
     */
    emitInquiryActivity(inquiryId, officeId, action = 'updated') {
        this.socket.emit('inquiry_activity', {
            inquiry_id: inquiryId,
            office_id: officeId,
            action: action
        });
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    const studentSocketManager = new StudentSocketManager();
    studentSocketManager.connect();

    // Make it globally available
    window.studentSocketManager = studentSocketManager;
});