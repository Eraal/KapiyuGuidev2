/**
 * Chat Socket Base Manager
 * 
 * Base class for chat websocket connections - separated from counseling functionality
 * to avoid conflicts between the two systems
 */

class ChatBaseManager extends BaseSocketManager {
    constructor(options = {}) {
        // Set default namespace for chat
        options.namespace = options.namespace || '/chat';

        // Call parent constructor
        super(options);

        // Chat-specific properties
        this.inquiryId = options.inquiryId;
        this.userId = options.userId;
        this.userRole = options.userRole;

        // Set up chat-specific event handlers
        this._setupChatHandlers();
    }

    /**
     * Override the _setupApplicationHandlers to add chat-specific handlers
     */
    _setupApplicationHandlers() {
        // Add chat message handler for bi-directional real-time updates
        this.on('chat_message', (data) => {
            console.log('Chat message received:', data);
            // Dispatch a custom event so that the chat UI can update immediately
            const event = new CustomEvent('chat:new_message', { detail: data });
            document.dispatchEvent(event);
        });
    }

    /**
     * Set up chat-specific event handlers
     */
    _setupChatHandlers() {
        // Register for chat-related events
        this.on('new_chat_message', (data) => {
            console.log('New chat message received:', data);
            // Forward to UI via custom event
            const event = new CustomEvent('chat:message', { detail: data });
            document.dispatchEvent(event);
        });

        // Message status updates
        this.on('message_status_update', (data) => {
            console.log('Message status update received:', data);
            const event = new CustomEvent('chat:status_update', { detail: data });
            document.dispatchEvent(event);
        });

        // Typing indicators
        this.on('user_typing', (data) => {
            console.log('User typing received:', data);
            const event = new CustomEvent('chat:typing', { detail: data });
            document.dispatchEvent(event);
        });
    }

    /**
     * Send a message in the chat
     * @param {string} content - The message content
     * @param {object} additionalData - Any additional data to send
     */
    sendMessage(content, additionalData = {}) {
        if (!this.inquiryId) {
            console.error('Cannot send message - no inquiry ID provided');
            return false;
        }

        return this.emit('chat_message', {
            inquiry_id: this.inquiryId,
            content: content,
            ...additionalData
        });
    }

    /**
     * Send typing indicator
     * @param {boolean} isTyping - Whether the user is typing
     */
    sendTypingIndicator(isTyping) {
        if (!this.inquiryId) return false;

        return this.emit('typing_indicator', {
            inquiry_id: this.inquiryId,
            is_typing: isTyping,
            user_id: this.userId,
            role: this.userRole
        });
    }

    /**
     * Mark message as read
     * @param {string|number} messageId - The ID of the message to mark as read
     */
    markMessageAsRead(messageId) {
        if (!this.inquiryId || !messageId) return false;

        return this.emit('mark_message_read', {
            inquiry_id: this.inquiryId,
            message_id: messageId,
            user_id: this.userId
        });
    }
}

// Make globally available
window.ChatBaseManager = ChatBaseManager;