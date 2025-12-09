/**
 * Cloudflare Worker - Maintenance Mode Proxy
 * 
 * This worker sits in front of Railway and:
 * 1. Checks if Railway is healthy via /health endpoint
 * 2. If healthy → proxy all traffic to Railway
 * 3. If unhealthy → serve maintenance.html
 */

const RAILWAY_URL = 'https://sachyjablonec-production-21c7.up.railway.app';
const HEALTH_CHECK_TIMEOUT = 5000; // 5 seconds
const HEALTH_CHECK_PATH = '/health';

// Embedded maintenance HTML (from public/maintenance.html)
const MAINTENANCE_HTML = `<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Údržba | TJ Bižuterie Jablonec</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary-color: #d4af37;
            --background-color: #121212;
            --surface-color: #1e1e1e;
            --text-color: #e0e0e0;
        }

        body {
            background-color: var(--background-color);
            color: var(--text-color);
            font-family: 'Inter', sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            text-align: center;
        }

        .container {
            background: var(--surface-color);
            padding: 3rem 2rem;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            max-width: 500px;
            width: 90%;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }

        h1 {
            color: var(--primary-color);
            margin-bottom: 1rem;
            font-size: 1.8rem;
        }

        .pawn-svg {
            width: 150px;
            height: 150px;
            margin: 0 auto 1.5rem;
            filter: drop-shadow(0 0 20px rgba(212, 175, 55, 0.3));
        }

        p {
            line-height: 1.6;
            margin-bottom: 0;
            color: #aaa;
        }
    </style>
</head>
<body>
    <div class="container">
        <svg class="pawn-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <!-- Chess Pawn -->
            <g fill="#d4af37" stroke="#b8941f" stroke-width="2">
                <!-- Base -->
                <ellipse cx="100" cy="180" rx="60" ry="12"/>
                <!-- Stem -->
                <path d="M 70 180 L 75 140 L 85 100 L 115 100 L 125 140 L 130 180 Z"/>
                <!-- Body -->
                <ellipse cx="100" cy="100" rx="30" ry="35"/>
                <!-- Neck -->
                <rect x="90" y="65" width="20" height="15" rx="3"/>
                <!-- Head -->
                <circle cx="100" cy="55" r="18"/>
                <!-- Top knob -->
                <circle cx="100" cy="35" r="8"/>
            </g>
            <!-- Construction Helmet -->
            <g fill="#ffa500" stroke="#ff8c00" stroke-width="2">
                <!-- Helmet dome -->
                <path d="M 75 45 Q 75 25 100 25 Q 125 25 125 45 L 120 55 L 80 55 Z"/>
                <!-- Helmet brim -->
                <ellipse cx="100" cy="55" rx="28" ry="6"/>
                <!-- Helmet stripe -->
                <rect x="85" y="38" width="30" height="4" fill="#fff" opacity="0.3"/>
            </g>
            <!-- Tool belt (optional detail) -->
            <rect x="85" y="115" width="30" height="8" fill="#8b4513" stroke="#654321" stroke-width="1" rx="2"/>
        </svg>
        <h1>Právě probíhá údržba</h1>
        <p>Omlouváme se, ale web je momentálně v údržbě. <br>Vylepšujeme pro vás služby. <br>Zkuste to prosím za chvíli.</p>
    </div>
</body>
</html>`;

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // Check Railway health
        const isHealthy = await checkHealth();

        if (isHealthy) {
            // Railway is healthy - proxy the request
            return proxyToRailway(request);
        } else {
            // Railway is down - serve maintenance page
            return new Response(MAINTENANCE_HTML, {
                status: 503,
                headers: {
                    'Content-Type': 'text/html;charset=UTF-8',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Retry-After': '60'
                }
            });
        }
    }
};

/**
 * Check if Railway backend is healthy
 */
async function checkHealth() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

        const response = await fetch(RAILWAY_URL + HEALTH_CHECK_PATH, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                'User-Agent': 'Cloudflare-Worker-Health-Check'
            }
        });

        clearTimeout(timeoutId);

        // Strict check: Must be 200 OK AND return valid JSON with status='ok'
        if (!response.ok || response.status !== 200) {
            return false;
        }

        // Verify JSON response
        try {
            const data = await response.json();
            return data.status === 'ok';
        } catch (e) {
            return false;
        }
    } catch (error) {
        console.error('Health check failed:', error.message);
        return false;
    }
}

/**
 * Proxy request to Railway
 */
async function proxyToRailway(request) {
    const url = new URL(request.url);
    const railwayUrl = RAILWAY_URL + url.pathname + url.search;

    // Create new request with Railway URL
    const modifiedRequest = new Request(railwayUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        redirect: 'manual'
    });

    try {
        const response = await fetch(modifiedRequest);

        // Create new response with modified headers
        const modifiedResponse = new Response(response.body, response);

        // Add CORS headers if needed
        modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');

        return modifiedResponse;
    } catch (error) {
        console.error('Proxy error:', error.message);

        // If proxy fails, serve maintenance page
        return new Response(MAINTENANCE_HTML, {
            status: 503,
            headers: {
                'Content-Type': 'text/html;charset=UTF-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });
    }
}
