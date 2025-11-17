// API Configuration
// For production deployment, update these URLs to match your domain

const CONFIG = {
    // API Base URL
    API_URL: window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : 'https://relays.social',

    // WebSocket URL
    WS_URL: window.location.hostname === 'localhost'
        ? 'ws://localhost:3000'
        : 'wss://relays.social',

    // Environment
    ENV: window.location.hostname === 'localhost' ? 'development' : 'production'
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
