/**
 * Notification Sound Manager
 * 
 * Provides centralized management of notification sounds to prevent 
 * duplicate audio elements and ensure consistent playback.
 */

class NotificationSoundManager {
    constructor() {
        this.sounds = {};
        this.initialized = false;
        this.muted = false;
    }

    /**
     * Initialize the sound manager
     */
    init() {
        if (this.initialized) return;

        // Create default notification sound
        this.registerSound('default', '/static/sounds/notification.mp3');

        // Try to get mute preference from localStorage
        try {
            this.muted = localStorage.getItem('notification_muted') === 'true';
        } catch (e) {
            console.error('Error accessing localStorage:', e);
        }

        this.initialized = true;
    }

    /**
     * Register a new sound
     * @param {string} name - Unique name for the sound
     * @param {string} src - Path to the sound file
     */
    registerSound(name, src) {
        if (this.sounds[name]) return;

        // Create audio element
        const audio = document.createElement('audio');
        audio.id = `sound-${name}`;
        audio.preload = 'auto';
        audio.style.display = 'none';

        // Add source
        const source = document.createElement('source');
        source.src = src;
        source.type = src.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav';
        audio.appendChild(source);

        // Store audio element
        this.sounds[name] = {
            element: audio,
            src: src
        };

        // Add to document
        document.body.appendChild(audio);
    }

    /**
     * Play a sound by name
     * @param {string} name - Name of the sound to play (defaults to 'default')
     * @returns {Promise} - Promise resolving when sound playback starts or rejects on error
     */
    playSound(name = 'default') {
        if (this.muted) return Promise.resolve();

        // Make sure sound manager is initialized
        if (!this.initialized) {
            this.init();
        }

        // Get sound or use default
        const sound = this.sounds[name] || this.sounds['default'];
        if (!sound) {
            return Promise.reject(new Error(`Sound "${name}" not found`));
        }

        // Play the sound
        return sound.element.play().catch(error => {
            console.warn(`Error playing sound "${name}":`, error);

            // If autoplay was blocked, we'll just ignore it
            if (error.name === 'NotAllowedError') {
                // Just resolve with a silent promise
                return Promise.resolve();
            }

            return Promise.reject(error);
        });
    }

    /**
     * Toggle mute status
     * @param {boolean} muted - Whether sounds should be muted
     */
    setMuted(muted) {
        this.muted = muted;

        // Store preference in localStorage
        try {
            localStorage.setItem('notification_muted', muted);
        } catch (e) {
            console.error('Error accessing localStorage:', e);
        }
    }

    /**
     * Toggle mute status
     * @returns {boolean} - The new muted state
     */
    toggleMuted() {
        this.setMuted(!this.muted);
        return this.muted;
    }

    /**
     * Clean up resources used by the sound manager
     */
    cleanup() {
        // Remove all audio elements
        Object.values(this.sounds).forEach(sound => {
            if (sound.element.parentNode) {
                sound.element.parentNode.removeChild(sound.element);
            }
        });

        this.sounds = {};
        this.initialized = false;
    }
}

// Create a singleton instance
window.soundManager = window.soundManager || new NotificationSoundManager();

// Initialize by default
window.soundManager.init();