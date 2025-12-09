/**
 * Cloudflare Worker - Maintenance Mode Proxy
 * 
 * This worker sits in front of Railway and:
 * 1. Checks if Railway is healthy via /health endpoint
 * 2. If healthy → proxy all traffic to Railway
 * 3. If unhealthy → serve maintenance.html
 */

const RAILWAY_URL = 'https://sachyjablonec-production.up.railway.app'; // Update with your Railway URL
const HEALTH_CHECK_TIMEOUT = 5000; // 5 seconds
const HEALTH_CHECK_PATH = '/health';

// Embedded maintenance HTML (fallback if fetch fails)
const MAINTENANCE_HTML = `<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Údržba - Šachy Jablonec</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            color: #ffffff;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
        }
        .container {
            max-width: 600px;
            text-align: center;
            background: rgba(255, 255, 255, 0.05);
            padding: 3rem;
            border-radius: 16px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(212, 175, 55, 0.2);
        }
        .icon {
            font-size: 4rem;
            margin-bottom: 1.5rem;
            animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        h1 {
            color: #d4af37;
            font-size: 2rem;
            margin-bottom: 1rem;
        }
        p {
            color: rgba(255, 255, 255, 0.8);
            line-height: 1.6;
            margin-bottom: 0.5rem;
        }
        .status {
            margin-top: 2rem;
            padding: 1rem;
            background: rgba(212, 175, 55, 0.1);
            border-radius: 8px;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">♟️</div>
        <h1>Probíhá údržba</h1>
        <p>Momentálně provádíme aktualizaci našich systémů.</p>
        <p>Stránky budou brzy opět dostupné.</p>
        <div class="status">
            <p><strong>Děkujeme za trpělivost!</strong></p>
        </div>
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

        // Consider healthy if status is 200-299
        return response.ok;
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
