/**
 * ProgressiveChatLoader - Efficiently load chat messages progressively 
 * 
 * Features:
 * - Initially loads only latest 6 messages
 * - Loads older messages on-demand when scrolling up
 * - Maintains scroll position when loading older messages
 * - Shows loading indicator during message fetching
 * - Stops trying to load more when all messages are loaded
 */

class ProgressiveChatLoader {
    /**
     * Create a ProgressiveChatLoader instance
     * @param {Object} config - Configuration options
     * @param {HTMLElement} config.messageContainer - Container where messages are displayed
     * @param {number} config.inquiryId - ID of the current inquiry
     * @param {Function} config.renderMessage - Function to render a message (receives message data)
     * @param {Function} config.onLoadComplete - Callback when messages are loaded (optional)
     * @param {string} config.apiEndpoint - API endpoint URL for loading messages (defaults to "/api/inquiry/{id}/messages")
     * @param {number} config.loadThreshold - Scroll position threshold to trigger loading (in pixels from top)
     * @param {number} config.batchSize - Number of messages to load per request
     */
    constructor(config) {
        this.messageContainer = config.messageContainer;
        this.inquiryId = config.inquiryId;
        this.renderMessage = config.renderMessage;
        this.onLoadComplete = config.onLoadComplete || function () { };
        this.apiEndpoint = config.apiEndpoint || `/api/inquiry/${config.inquiryId}/messages`;
        this.loadThreshold = config.loadThreshold || 100;
        this.batchSize = config.batchSize || 6;

        // Internal state
        this.isLoading = false;
        this.hasMoreMessages = true;
        this.oldestMessageId = null;
        this.loadingIndicator = null;

        // Initialize
        this.init();
    }

    /**
     * Initialize the loader
     */
    init() {
        // Create loading indicator
        this.createLoadingIndicator();

        // Add scroll event listener
        this.messageContainer.addEventListener('scroll', this.handleScroll.bind(this));

        // Initialize with latest messages
        // Note: We assume the initial 6 messages are loaded server-side
        // during the initial page render

        // Set the oldest message ID based on the first rendered message
        const firstMessage = this.messageContainer.querySelector('[data-message-id]');
        if (firstMessage) {
            this.oldestMessageId = firstMessage.getAttribute('data-message-id');
        }

        console.log('ProgressiveChatLoader initialized');
    }

    /**
     * Create the loading indicator element
     */
    createLoadingIndicator() {
        this.loadingIndicator = document.createElement('div');
        this.loadingIndicator.className = 'flex justify-center items-center py-4 hidden';
        this.loadingIndicator.innerHTML = `
            <div class="flex items-center space-x-2">
                <div class="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                <div class="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                <div class="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
            </div>
        `;
    }

    /**
     * Handle scroll events
     */
    handleScroll() {
        // If already loading or no more messages, don't do anything
        if (this.isLoading || !this.hasMoreMessages) return;

        // Check if we've scrolled near the top
        if (this.messageContainer.scrollTop <= this.loadThreshold) {
            this.loadOlderMessages();
        }
    }

    /**
     * Load older messages via API
     */
    loadOlderMessages() {
        if (this.isLoading || !this.hasMoreMessages) return;

        this.isLoading = true;

        // Show loading indicator at the top of the message container
        this.messageContainer.prepend(this.loadingIndicator);
        this.loadingIndicator.classList.remove('hidden');

        // Remember current scroll position and height
        const scrollHeightBefore = this.messageContainer.scrollHeight;

        // Build API URL with parameters
        let apiUrl = `${this.apiEndpoint}?limit=${this.batchSize}`;
        if (this.oldestMessageId) {
            apiUrl += `&before_id=${this.oldestMessageId}`;
        }

        // Fetch older messages
        fetch(apiUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to load older messages');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // Remove loading indicator
                    this.loadingIndicator.remove();

                    // Check if there are more messages to load
                    this.hasMoreMessages = data.has_more;

                    if (data.messages && data.messages.length > 0) {
                        // Update oldest message ID
                        this.oldestMessageId = data.messages[0].id;

                        // Insert messages at the beginning (we need to reverse them to maintain chronological order)
                        data.messages.forEach(message => {
                            // Create message element
                            const messageElement = this.renderMessage(message);

                            // Insert at the beginning of the container
                            this.messageContainer.insertBefore(messageElement, this.messageContainer.firstChild);
                        });

                        // Maintain scroll position
                        const newScrollHeight = this.messageContainer.scrollHeight;
                        const heightDifference = newScrollHeight - scrollHeightBefore;
                        this.messageContainer.scrollTop = heightDifference;

                        // Call the callback
                        this.onLoadComplete(data.messages);
                    }
                } else {
                    console.error('Error loading messages:', data.message);
                    this.loadingIndicator.remove();
                }

                this.isLoading = false;
            })
            .catch(error => {
                console.error('Error fetching older messages:', error);
                this.loadingIndicator.remove();
                this.isLoading = false;
            });
    }

    /**
     * Check if all messages have been loaded
     * @returns {boolean} True if all messages are loaded
     */
    allMessagesLoaded() {
        return !this.hasMoreMessages;
    }

    /**
     * Reset the loader state
     */
    reset() {
        this.isLoading = false;
        this.hasMoreMessages = true;
        this.oldestMessageId = null;

        const firstMessage = this.messageContainer.querySelector('[data-message-id]');
        if (firstMessage) {
            this.oldestMessageId = firstMessage.getAttribute('data-message-id');
        }
    }

    /**
     * Destroy the loader and remove event listeners
     */
    destroy() {
        this.messageContainer.removeEventListener('scroll', this.handleScroll.bind(this));
        if (this.loadingIndicator && this.loadingIndicator.parentNode) {
            this.loadingIndicator.remove();
        }
    }
}