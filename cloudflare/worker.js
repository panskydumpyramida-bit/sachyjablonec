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
            width: 180px;
            height: 180px;
            margin: 0 auto 1.5rem;
            filter: drop-shadow(0 0 25px rgba(212, 175, 55, 0.4));
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
        <svg class="pawn-svg" viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg">
            <!-- Oval Frame -->
            <ellipse cx="100" cy="110" rx="90" ry="100" fill="none" stroke="#d4af37" stroke-width="3" stroke-dasharray="10, 5"/>
            <ellipse cx="100" cy="110" rx="82" ry="92" fill="#1a1a1a" stroke="#b8941f" stroke-width="1" opacity="0.5"/>

            <!-- Glow behind pawn -->
            <ellipse cx="100" cy="160" rx="50" ry="20" fill="#d4af37" opacity="0.2" filter="blur(10px)"/>

            <g transform="translate(0, 10)">
                <!-- Chess Pawn Body -->
                <g fill="#d4af37" stroke="#b8941f" stroke-width="2">
                    <!-- Base -->
                    <path d="M 40 170 Q 100 190 160 170 L 160 160 Q 100 180 40 160 Z" />
                    <rect x="45" y="150" width="110" height="15" rx="5" />
                    
                    <!-- Stem -->
                    <path d="M 70 150 Q 85 100 85 80 L 115 80 Q 115 100 130 150 Z" />
                    
                    <!-- Collar -->
                    <ellipse cx="100" cy="80" rx="25" ry="10" />
                    
                    <!-- Head base -->
                    <circle cx="100" cy="55" r="22" />
                </g>

                <!-- Construction Helmet -->
                <g fill="#ff9100" stroke="#cc7400" stroke-width="2">
                    <!-- Helmet dome -->
                    <path d="M 65 48 C 65 15 135 15 135 48" fill="#ff9100"/>
                    <path d="M 65 48 L 135 48" stroke="none"/> <!-- fill bottom -->
                    
                    <!-- Helmet brim -->
                    <path d="M 60 48 Q 100 65 140 48" fill="none" stroke="#cc7400" stroke-width="4" stroke-linecap="round"/>
                    
                    <!-- Reflective stripe -->
                    <path d="M 75 35 Q 100 30 125 35" fill="none" stroke="#ffffff" stroke-width="4" opacity="0.4"/>
                    
                    <!-- Slight shine -->
                    <ellipse cx="90" cy="28" rx="10" ry="5" fill="#fff" opacity="0.3" transform="rotate(-20 90 28)"/>
                </g>
                
                <!-- Tool belt -->
                <rect x="75" y="120" width="50" height="12" rx="3" fill="#8d6e63" stroke="#5d4037" stroke-width="2"/>
                <circle cx="100" cy="126" r="3" fill="#gold"/>
            </g>
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
        modifiedResponse.headers.set('X-Proxy-By', 'Sachy-Worker-Maintenance');

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
