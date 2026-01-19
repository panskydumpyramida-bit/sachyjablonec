// API Configuration
// This file configures the API URL based on environment

// API Configuration
// This file configures the API URL based on environment

if (typeof API_CONFIG === 'undefined') {
    window.API_CONFIG = {
        // Relative path for production (same domain)
        production: '/api',
        development: 'http://localhost:3001/api'
    };
}

// Auto-detect environment
if (typeof API_URL === 'undefined') {
    const isProduction = window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1';

    window.API_URL = isProduction ? API_CONFIG.production : API_CONFIG.development;
}

// Export for use in other scripts
window.API_URL = API_URL;
