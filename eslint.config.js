import js from '@eslint/js';
import prettier from 'eslint-config-prettier';

export default [
    js.configs.recommended,
    prettier,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                // Node.js
                process: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                Buffer: 'readonly',
                URL: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'eqeqeq': ['warn', 'smart'],
            'no-var': 'error',
            'prefer-const': 'warn',
        },
    },
    // Backend (src/) — Node.js environment
    {
        files: ['src/**/*.js'],
        languageOptions: {
            globals: {
                fetch: 'readonly',
            },
        },
    },
    // Frontend (js/) — Browser environment
    {
        files: ['js/**/*.js'],
        languageOptions: {
            globals: {
                window: 'readonly',
                document: 'readonly',
                fetch: 'readonly',
                localStorage: 'readonly',
                sessionStorage: 'readonly',
                location: 'readonly',
                history: 'readonly',
                navigator: 'readonly',
                HTMLElement: 'readonly',
                Node: 'readonly',
                DOMParser: 'readonly',
                MutationObserver: 'readonly',
                IntersectionObserver: 'readonly',
                CustomEvent: 'readonly',
                Event: 'readonly',
                FormData: 'readonly',
                FileReader: 'readonly',
                Image: 'readonly',
                Audio: 'readonly',
                alert: 'readonly',
                confirm: 'readonly',
                requestAnimationFrame: 'readonly',
                // App globals
                API_URL: 'readonly',
                auth: 'readonly',
                escapeHtml: 'readonly',
                sanitizeHtml: 'readonly',
                formatDate: 'readonly',
                formatDateTime: 'readonly',
                formatRelativeTime: 'readonly',
                showToast: 'readonly',
                debounce: 'readonly',
                throttle: 'readonly',
            },
        },
    },
    // Tests
    {
        files: ['tests/**/*.js'],
        languageOptions: {
            globals: {
                describe: 'readonly',
                it: 'readonly',
                expect: 'readonly',
                vi: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                beforeAll: 'readonly',
                afterAll: 'readonly',
            },
        },
    },
    // Ignore patterns
    {
        ignores: ['node_modules/', 'dist/', 'data/', 'scripts/', '*.min.js'],
    },
];
