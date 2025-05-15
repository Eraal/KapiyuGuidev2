/**
 * Inquiry Chat Initialization
 * 
 * This script initializes the InquiryChat functionality when loaded on a page
 * that contains the required chat elements.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on an inquiry page with chat functionality
    const chatContainer = document.querySelector('[data-chat-container]');
    if (!chatContainer) return;

    // Initialize Socket.IO connection using shared connection manager
    let socketPromise;
    if (window.connectionManager) {
        console.log('Using shared connection manager for chat');
        socketPromise = window.connectionManager.getConnection();

        // Make sure the socketManager exists or create it
        if (!window.socketManager) {
            console.log('Creating socketManager for chat');
            window.socketManager = new BaseSocketManager();

            // Start health check system
            if (window.socketManager.startHealthChecks) {
                window.socketManager.startHealthChecks();
                console.log('Health check system started');
            }

            // Activate chat feature specifically
            window.socketManager.activateFeature('chat');
            console.log('Activated chat feature');
        } else {
            console.log('Using existing socketManager');
            // Ensure chat feature is activated
            window.socketManager.activateFeature('chat');

            // Make sure we're in the right rooms for this inquiry
            setTimeout(() => {
                const inquiryId = chatContainer.getAttribute('data-inquiry-id');
                if (inquiryId && window.socketManager.rejoinRooms) {
                    window.socketManager.rejoinRooms();
                    console.log('Rejoined socket rooms for inquiry chat');
                }
            }, 500); // Small delay to allow for connection setup
        }
    } else {
        console.log('Connection manager not found, falling back to direct connection');
        // Get the socket.io URL from meta tag or use default
        const socketUrl = document.querySelector('meta[name="socket-io-url"]')?.content || '';

        // Create a new socket connection
        window.socket = io(socketUrl);

        // Wrap in a promise for consistent API
        socketPromise = Promise.resolve(window.socket);

        // Set up global socket event listeners
        window.socket.on('connect', () => {
            console.log('Socket.io connected');
        });

        window.socket.on('disconnect', () => {
            console.log('Socket.io disconnected');
        });

        window.socket.on('error', (error) => {
            console.error('Socket.io error:', error);
        });

        // Log explicit warning about missing connection manager
        console.warn('WARNING: Using direct socket connection without connection manager. This may cause issues with room management and event handling!');
    }

    // Once we have a socket connection, initialize the chat
    socketPromise.then(socket => {
        // Get required elements and data attributes
        const inquiryId = chatContainer.getAttribute('data-inquiry-id');
        const currentUserId = chatContainer.getAttribute('data-user-id');
        const currentUserRole = chatContainer.getAttribute('data-user-role');
        const currentUserName = chatContainer.getAttribute('data-user-name');
        const currentUserInitials = getUserInitials(currentUserName);
        const studentId = chatContainer.getAttribute('data-student-id'); // Make sure we get student ID

        const messageInput = document.querySelector('[data-message-input]');
        const sendButton = document.querySelector('[data-send-button]');
        const messageContainer = document.querySelector('[data-message-container]');
        const typingIndicator = document.querySelector('[data-typing-indicator]');

        // Validate required elements and data
        if (!inquiryId || !currentUserId || !messageInput || !messageContainer) {
            console.error('Missing required elements or data for chat initialization');
            return;
        }

        console.log(`Initializing chat for inquiry ${inquiryId} with user ${currentUserId} (${currentUserRole})`);

        // Join inquiry room explicitly before initializing chat
        socket.emit('join_inquiry_room', { inquiry_id: inquiryId });
        socket.emit('join', { room: `inquiry_${inquiryId}` });
        console.log(`Explicitly joined inquiry rooms for inquiry ${inquiryId}`);

        // Initialize the InquiryChat instance
        window.chatInstance = new InquiryChat({
            socket: socket,
            messageInput,
            sendButton,
            messageContainer,
            typingIndicator,
            inquiryId,
            currentUserId,
            currentUserRole,
            currentUserName,
            currentUserInitials,
            studentId
        });

        // Clean up when the page is unloaded
        window.addEventListener('beforeunload', () => {
            if (window.chatInstance) {
                window.chatInstance.destroy();
            }

            // Explicitly leave the inquiry room to avoid lingering subscriptions
            socket.emit('leave', { room: `inquiry_${inquiryId}` });
            console.log(`Left inquiry room: inquiry_${inquiryId}`);
        });
    }).catch(error => {
        console.error('Failed to initialize chat:', error);
    });
});

/**
 * Helper function to get user initials from name
 * @param {string} name - The user's name
 * @returns {string} The user's initials
 */
function getUserInitials(name) {
    if (!name) return 'UN';
    return name.split(' ')
        .map(part => part.charAt(0))
        .join('')
        .toUpperCase();
}