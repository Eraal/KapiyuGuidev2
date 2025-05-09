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

    // Initialize Socket.IO connection if it doesn't already exist
    if (!window.socket) {
        // Get the socket.io URL from meta tag or use default
        const socketUrl = document.querySelector('meta[name="socket-io-url"]')?.content || '';
        window.socket = io(socketUrl);

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
    }

    // Get required elements and data attributes
    const inquiryId = chatContainer.getAttribute('data-inquiry-id');
    const currentUserId = chatContainer.getAttribute('data-user-id');
    const currentUserRole = chatContainer.getAttribute('data-user-role');
    const currentUserName = chatContainer.getAttribute('data-user-name');
    const currentUserInitials = getUserInitials(currentUserName);

    const messageInput = document.querySelector('[data-message-input]');
    const sendButton = document.querySelector('[data-send-button]');
    const messageContainer = document.querySelector('[data-message-container]');
    const typingIndicator = document.querySelector('[data-typing-indicator]');

    // Validate required elements and data
    if (!inquiryId || !currentUserId || !messageInput || !messageContainer) {
        console.error('Missing required elements or data for chat initialization');
        return;
    }

    // Initialize the InquiryChat instance
    window.chatInstance = new InquiryChat({
        socket: window.socket,
        messageInput,
        sendButton,
        messageContainer,
        typingIndicator,
        inquiryId,
        currentUserId,
        currentUserRole,
        currentUserName,
        currentUserInitials
    });

    // Clean up when the page is unloaded
    window.addEventListener('beforeunload', () => {
        if (window.chatInstance) {
            window.chatInstance.destroy();
        }
    });
});

/**
 * Get user initials from full name
 * @param {string} fullName - The user's full name
 * @returns {string} - The user's initials (up to 2 characters)
 */
function getUserInitials(fullName) {
    if (!fullName) return 'U';

    const nameParts = fullName.split(' ').filter(part => part.length > 0);
    if (nameParts.length === 0) return 'U';

    if (nameParts.length === 1) {
        return nameParts[0].charAt(0).toUpperCase();
    }

    return (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase();
}