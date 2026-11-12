/**
 * Express.js server voor NL Wallet PoC - Apple (iOS/macOS) Optimized
 * 
 * Deze versie bevat specifieke optimalisaties voor Apple platforms:
 * - Universal Links support
 * - Apple App Site Association (AASA) endpoint
 * - CORS configuratie voor iOS Simulator
 * - HTTPS support voor local development
 * 
 * Installatie:
 *   npm install express cors
 * 
 * Starten:
 *   node server-apple.js
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = express();

// Middleware
app.use(cors({
    origin: '*', // Voor PoC - in productie specifiek maken
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Configuration
const VERIFICATION_SERVER_URL = process.env.VERIFICATION_SERVER_URL || 'http://localhost:8001';
const PORT = process.env.PORT || 3000;
const DOMAIN = process.env.DOMAIN || 'localhost';

/**
 * Apple App Site Association (AASA) endpoint
 * Vereist voor Universal Links op iOS
 * 
 * GET /.well-known/apple-app-site-association
 */
app.get('/.well-known/apple-app-site-association', (req, res) => {
    // AASA moet worden geserveerd zonder .json extensie
    // En moet Content-Type: application/json hebben
    
    const aasaPath = path.join(__dirname, 'apple-app-site-association.json');
    
    // Als er een custom AASA file is, gebruik die
    if (fs.existsSync(aasaPath)) {
        const aasa = JSON.parse(fs.readFileSync(aasaPath, 'utf8'));
        res.setHeader('Content-Type', 'application/json');
        return res.json(aasa);
    }
    
    // Anders, return een voorbeeld AASA
    // VERVANG TEAM_ID met jouw Apple Team ID
    const aasa = {
        "applinks": {
            "apps": [],
            "details": [
                {
                    "appID": "TEAM_ID.nl.ictu.edi.wallet.latest",
                    "paths": [
                        "/ul/*",
                        "/deeplink/*",
                        "/api/sessions/return"
                    ]
                }
            ]
        },
        "webcredentials": {
            "apps": [
                "TEAM_ID.nl.ictu.edi.wallet.latest"
            ]
        }
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.json(aasa);
    
    console.log('📱 AASA file served for Universal Links');
});

/**
 * Endpoint dat door wallet_web wordt aangeroepen om een sessie te starten
 * 
 * POST /api/sessions/start
 * Body: { "usecase": "poc_demo" }
 * 
 * Returns: { "status_url": "...", "session_token": "..." }
 */
app.post('/api/sessions/start', async (req, res) => {
    const { usecase } = req.body;
    
    console.log('📝 Starting session for usecase:', usecase);
    
    if (!usecase) {
        return res.status(400).json({ error: 'usecase is required' });
    }
    
    try {
        // TODO: Vervang dit met een echte call naar de Verification Server
        const mockSessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const mockStatusUrl = `${VERIFICATION_SERVER_URL}/disclosure/sessions/${mockSessionToken}/status`;
        
        console.log('✅ Session started:', {
            sessionToken: mockSessionToken,
            statusUrl: mockStatusUrl
        });
        
        res.json({
            status_url: mockStatusUrl,
            session_token: mockSessionToken
        });
        
    } catch (error) {
        console.error('❌ Error starting session:', error);
        res.status(500).json({ 
            error: 'Failed to start session',
            message: error.message 
        });
    }
});

/**
 * Return URL voor cross-device sessies
 * 
 * GET /api/sessions/return?token=...
 */
app.get('/api/sessions/return', (req, res) => {
    const { token } = req.query;
    
    console.log('🔄 Session returned with token:', token);
    
    if (!token) {
        return res.status(400).send('Token is required');
    }
    
    // Voor Universal Links: return een redirect of HTML page
    // iOS zal deze automatisch openen in de app als Universal Links correct zijn geconfigureerd
    
    res.send(`
        <!DOCTYPE html>
        <html lang="nl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welkom terug - NL Wallet PoC</title>
            <meta http-equiv="refresh" content="2;url=nl-wallet://return?token=${token}">
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    max-width: 600px;
                    margin: 50px auto;
                    padding: 20px;
                    background: #f5f5f5;
                    text-align: center;
                }
                .container {
                    background: white;
                    padding: 30px;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                h1 { color: #28a745; }
                .success { color: #28a745; }
                code {
                    background: #f8f9fa;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-family: 'Courier New', monospace;
                }
                .spinner {
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #0066cc;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    animation: spin 1s linear infinite;
                    margin: 20px auto;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>✅ Welkom terug!</h1>
                <div class="spinner"></div>
                <p class="success">Je sessie is succesvol voltooid.</p>
                <p>Session token: <code>${token}</code></p>
                <p><small>Redirecting naar NL Wallet app...</small></p>
                <p><small>In een echte implementatie zou je hier de disclosed data tonen.</small></p>
            </div>
        </body>
        </html>
    `);
});

/**
 * Health check endpoint
 * 
 * GET /health
 */
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        platform: 'apple',
        verificationServer: VERIFICATION_SERVER_URL,
        domain: DOMAIN,
        aasaEndpoint: `https://${DOMAIN}/.well-known/apple-app-site-association`
    });
});

/**
 * Serve static files (voor HTML, CSS, JS)
 */
app.use(express.static(__dirname));

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
🍎 NL Wallet PoC Server (Apple Optimized) gestart!
   
   Server:     http://localhost:${PORT}
   Health:     http://localhost:${PORT}/health
   AASA:       http://localhost:${PORT}/.well-known/apple-app-site-association
   Start API:  POST http://localhost:${PORT}/api/sessions/start
   Return API: GET  http://localhost:${PORT}/api/sessions/return
   
   Verification Server: ${VERIFICATION_SERVER_URL}
   Domain: ${DOMAIN}
   
   ⚠️  Let op: Dit is een mock implementatie voor demonstratie.
      Voor productie gebruik, implementeer echte calls naar de Verification Server.
   
   📱 Apple Specifieke Features:
   - Universal Links support via AASA endpoint
   - iOS Simulator compatible CORS
   - macOS Safari optimized
    `);
});

