// API Configuration
// Automatically uses the current origin (works for localhost and production)

const CONFIG = {
    // API Base URL - use same origin as the page
    API_URL: window.location.hostname === 'localhost' 
        ? 'http://localhost:3000'
        : 'https://relays.social',

    // WebSocket URL - use same host with ws/wss protocol
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
