// API Configuration
// This file configures the API URL based on environment

// API Configuration
// This file configures the API URL based on environment

if (typeof API_CONFIG === 'undefined') {
    window.API_CONFIG = {
        // Z důvodu problémů s HSTS cache a localhost vs 127.0.0.1 
        // budeme všude používat relativní cestu, protože frontend
        // i backend běží na stejném serveru a portu.
        default: '/api'
    };
}

if (typeof API_URL === 'undefined') {
    window.API_URL = API_CONFIG.default;
}

// Export for use in other scripts
window.API_URL = API_URL;
