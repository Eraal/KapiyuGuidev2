// Main entry point for student WebSocket functionality
document.addEventListener('DOMContentLoaded', () => {
    // Load the necessary scripts
    function loadScript(src, callback) {
        const script = document.createElement('script');
        script.src = src;
        script.onload = callback;
        document.head.appendChild(script);
    }

    // First, make sure the base socket manager is loaded
    if (typeof BaseSocketManager === 'undefined') {
        loadScript('/static/js/socket.js', () => {
            // Then load the student-specific socket manager
            loadScript('/static/js/student/websockets/student_sockets.js', initializeStudentSockets);
        });
    } else {
        // If base socket manager is already loaded, just load the student socket manager
        loadScript('/static/js/student/websockets/student_sockets.js', initializeStudentSockets);
    }

    function initializeStudentSockets() {
        // Create a student socket manager if it doesn't exist
        if (!window.studentSocketManager) {
            window.studentSocketManager = new StudentSocketManager({
                sound: true,
                debug: true
            });

            // Initialize the socket connection
            window.studentSocketManager.initialize()
                .then(() => {
                    console.log('Student socket system initialized');

                    // Setup typing indicators for any chat inputs on the page
                    setupChatTypingIndicators();

                    // Add event listener for dynamically loaded chat content
                    document.addEventListener('chat:loaded', setupChatTypingIndicators);

                    // Register for DOM changes to detect dynamically added chat elements
                    observeChatAdditions();
                })
                .catch(error => {
                    console.error('Failed to initialize student socket system:', error);
                });
        }
    }

    // Find all chat inputs and set up typing indicators
    function setupChatTypingIndicators() {
        // Look for chat message inputs in the DOM
        const chatInputs = document.querySelectorAll('.chat-input, .chat-message-input, [data-chat-input]');

        console.log(`Found ${chatInputs.length} chat inputs to setup typing indicators`);

        chatInputs.forEach(input => {
            // Get the inquiry and admin IDs from data attributes or parent elements
            const chatContainer = input.closest('[data-inquiry-id]');
            if (!chatContainer) return;

            const inquiryId = chatContainer.dataset.inquiryId;
            const officeAdminId = chatContainer.dataset.officeAdminId ||
                chatContainer.dataset.adminId;

            if (inquiryId && officeAdminId && window.studentSocketManager) {
                // Set up typing tracking for this input
                window.studentSocketManager.setupTypingTracker(input, {
                    inquiry_id: inquiryId,
                    office_admin_id: officeAdminId
                });

                console.log(`Set up typing indicator for inquiry ${inquiryId} with admin ${officeAdminId}`);

                // Mark this input as initialized to avoid duplicates
                input.dataset.typingTrackerInitialized = 'true';
            }
        });
    }

    // Use MutationObserver to detect when chat elements are dynamically added
    function observeChatAdditions() {
        // Create a new observer
        const observer = new MutationObserver(mutations => {
            let shouldCheckForChatInputs = false;

            // Look through all mutations
            mutations.forEach(mutation => {
                // If nodes were added
                if (mutation.addedNodes.length) {
                    // Check if any of the added nodes might contain chat inputs
                    for (let i = 0; i < mutation.addedNodes.length; i++) {
                        const node = mutation.addedNodes[i];
                        if (node.nodeType === 1) { // Element node
                            if (node.classList &&
                                (node.classList.contains('chat-container') ||
                                    node.querySelector('.chat-input, .chat-message-input, [data-chat-input]'))) {
                                shouldCheckForChatInputs = true;
                                break;
                            }
                        }
                    }
                }
            });

            // If new chat elements were added, set up their typing indicators
            if (shouldCheckForChatInputs) {
                console.log('New chat elements detected, setting up typing indicators');
                setupChatTypingIndicators();
            }
        });

        // Start observing the document with the configured parameters
        observer.observe(document.body, { childList: true, subtree: true });
    }
});