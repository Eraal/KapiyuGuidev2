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

    // Get required data attributes early
    const inquiryId = chatContainer.getAttribute('data-inquiry-id');
    const currentUserId = chatContainer.getAttribute('data-user-id');
    const currentUserRole = chatContainer.getAttribute('data-user-role');

    if (!inquiryId || !currentUserId) {
        console.error('Missing required data attributes for chat initialization');
        return;
    }

    // Always create a dedicated connection for chat to avoid conflicts with counseling
    console.log('Creating dedicated connection for inquiry chat');

    // Use the DedicatedConnectionManager if available, otherwise fall back to direct connection
    let socketPromise;

    if (window.DedicatedConnectionManager) {
        // Create a dedicated connection for this chat instance
        socketPromise = window.DedicatedConnectionManager.createConnection({
            feature: 'inquiry_chat',
            query: {
                inquiry_id: inquiryId,
                user_id: currentUserId,
                role: currentUserRole
            },
            debug: true
        });
    } else {
        console.warn('DedicatedConnectionManager not found, falling back to direct connection');
        // Create a new socket connection with forceNew to ensure separation
        const socket = io({
            forceNew: true,
            query: {
                feature: 'inquiry_chat',
                inquiry_id: inquiryId,
                user_id: currentUserId,
                role: currentUserRole
            }
        });

        // Wrap in a promise for consistent API
        socketPromise = Promise.resolve(socket);
    }

    // Once we have a socket connection, initialize the chat
    socketPromise.then(socket => {
        // Get additional required elements and data attributes
        const currentUserName = chatContainer.getAttribute('data-user-name');
        const currentUserInitials = getUserInitials(currentUserName);
        const studentId = chatContainer.getAttribute('data-student-id');

        const messageInput = document.querySelector('[data-message-input]');
        const sendButton = document.querySelector('[data-send-button]');
        const messageContainer = document.querySelector('[data-message-container]');
        const typingIndicator = document.querySelector('[data-typing-indicator]');

        // Validate required elements and data
        if (!messageInput || !messageContainer) {
            console.error('Missing required elements for chat initialization');
            return;
        }

        console.log(`Initializing chat for inquiry ${inquiryId} with user ${currentUserId} (${currentUserRole})`);

        // Join rooms via a single unified method instead of multiple calls
        // All room joining will be handled by the InquiryChat class itself
        // to avoid duplicate event handling

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