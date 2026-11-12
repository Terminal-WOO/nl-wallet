/**
 * Simpele Express.js server voor NL Wallet PoC
 * 
 * Installatie:
 *   npm install express cors
 * 
 * Starten:
 *   node server.js
 */

const express = require('express');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
// Serve static files (index.html, etc.)
app.use(express.static(__dirname));

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    if (req.method === 'POST' && req.path === '/api/callback') {
        console.log('📥 Callback request received');
    }
    next();
});

// Configuration
const VERIFICATION_SERVER_URL = process.env.VERIFICATION_SERVER_URL || 'http://localhost:8001';
const PORT = process.env.PORT || 3000;

/**
 * Endpoint dat door wallet_web wordt aangeroepen om een sessie te starten
 * 
 * POST /api/sessions/start
 * Body: { "usecase": "poc_demo" }
 * 
 * Returns: { "status_url": "...", "session_token": "..." }
 */
// Store active sessions in memory
const sessions = new Map();

app.post('/api/sessions/start', async (req, res) => {
    const { usecase } = req.body;

    console.log('📝 Starting session for usecase:', usecase);

    if (!usecase) {
        return res.status(400).json({ error: 'usecase is required' });
    }

    try {
        // Use a known ID from mock_disclosure_requests.dart
        // BAR only requires profilePhoto and olderThan18
        const mockDisclosureId = 'BAR';
        const mockSessionToken = `session_${Date.now()}`;

        // Construct the payload for the QR code
        const qrPayload = {
            id: mockDisclosureId,
            verifier_id: 'test_verifier',
            type: 'verify',
            nonce: '123456',
            session_token: mockSessionToken // Add session token so wallet can send it back
        };

        // Create the deeplink for the QR code
        const fragment = encodeURIComponent(JSON.stringify(qrPayload));
        const deeplink = `walletdebuginteraction://deeplink#${fragment}`;

        // Store session state
        sessions.set(mockSessionToken, {
            status: 'CREATED',
            deeplink: deeplink,
            created: Date.now()
        });

        console.log('✅ Session started:', {
            sessionToken: mockSessionToken,
            deeplink: deeplink
        });

        // Return HTTP status URL that wallet_web can poll
        res.json({
            status_url: `http://localhost:3000/api/sessions/${mockSessionToken}/status`,
            session_token: mockSessionToken,
            universal_link: deeplink // Some implementations use this
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
 * Status endpoint for polling session state
 * GET /api/sessions/:token/status
 */
app.get('/api/sessions/:token/status', (req, res) => {
    const { token } = req.params;

    console.log('🔍 Checking status for session:', token);

    const session = sessions.get(token);

    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    // MOCK: Auto-complete session after 10 seconds to simulate successful scan
    // This is needed because the mock wallet app doesn't actually call the server
    if (session.status === 'CREATED' && Date.now() - session.created > 10000) {
        session.status = 'DONE';
        console.log('✅ Session auto-completed (mock):', token);
    }

    // Return session status in the format wallet_web expects
    // status: CREATED | WAITING_FOR_RESPONSE | DONE | EXPIRED | CANCELLED | FAILED
    // ul: universal link (the deeplink for the QR code)
    const response = {
        status: session.status,
        ul: session.deeplink
    };

    // Include disclosed data if available
    if (session.disclosedData) {
        response.disclosedData = session.disclosedData;
        response.receivedAt = session.receivedAt;
        response.attributeCount = session.disclosedData.length;
    }

    res.json(response);
});

/**
 * Get disclosed data for a session
 * GET /api/sessions/:token/data
 */
app.get('/api/sessions/:token/data', (req, res) => {
    const { token } = req.params;
    const session = sessions.get(token);

    console.log(`🔍 Data request for session: ${token}`);
    console.log(`   Session exists: ${!!session}`);
    console.log(`   Has disclosedData: ${!!(session && session.disclosedData)}`);

    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    if (!session.disclosedData) {
        return res.status(404).json({ error: 'No data received yet for this session' });
    }

    res.json({
        sessionToken: token,
        receivedAt: session.receivedAt,
        attributes: session.disclosedData,
        count: session.disclosedData.length
    });
});

/**
 * Debug endpoint - show all sessions
 * GET /api/debug/sessions
 */
app.get('/api/debug/sessions', (req, res) => {
    const allSessions = Array.from(sessions.entries()).map(([token, session]) => ({
        token,
        status: session.status,
        hasDisclosedData: !!session.disclosedData,
        disclosedDataCount: session.disclosedData ? session.disclosedData.length : 0,
        receivedAt: session.receivedAt,
        created: new Date(session.created).toISOString()
    }));
    
    res.json({
        totalSessions: sessions.size,
        sessions: allSessions
    });
});

/**
 * Callback endpoint voor de wallet app om data terug te sturen
 * POST /api/callback
 */
app.post('/api/callback', (req, res) => {
    const { sessionToken, attributes } = req.body;
    console.log('📥 Received callback data for session:', sessionToken);
    console.log('📋 Full request body:', JSON.stringify(req.body, null, 2));
    console.log('📋 Disclosed attributes:', JSON.stringify(attributes, null, 2));
    console.log('📊 Current sessions:', Array.from(sessions.keys()));

    if (!sessionToken || !attributes) {
        console.error('❌ Missing sessionToken or attributes');
        return res.status(400).json({ error: 'Missing sessionToken or attributes' });
    }

    const session = sessions.get(sessionToken);
    if (session) {
        session.disclosedData = attributes;
        session.status = 'DONE'; // Mark as done when we receive data
        session.receivedAt = new Date().toISOString();
        console.log('✅ Session updated with disclosed data at', session.receivedAt);
        console.log(`   Received ${attributes.length} attributes`);
        console.log('   Session now has disclosedData:', !!session.disclosedData);
    } else {
        console.warn('⚠️ Session not found for callback:', sessionToken);
        console.warn('   Available sessions:', Array.from(sessions.keys()));
        // Create session if it doesn't exist (might happen if wallet sends data before session is created)
        sessions.set(sessionToken, {
            status: 'DONE',
            deeplink: '',
            created: Date.now(),
            disclosedData: attributes,
            receivedAt: new Date().toISOString()
        });
        console.log('✅ Created new session with disclosed data');
    }

    res.json({ status: 'ok', message: 'Data received successfully' });
});

/**
 * Return URL voor cross-device sessies
 * 
 * GET /api/sessions/return?token=...
 */
app.get('/api/sessions/return', (req, res) => {
    const { token } = req.query;

    console.log('🔄 Session returned with token:', token);
    console.log('📊 Available sessions:', Array.from(sessions.keys()));

    if (!token) {
        return res.status(400).send('Token is required');
    }

    const session = sessions.get(token);

    if (!session) {
        console.error('❌ Session not found:', token);
        return res.status(404).send(`Session ${token} not found`);
    }

    console.log('📋 Session status:', session.status);
    console.log('📋 Session has disclosedData:', !!session.disclosedData);
    if (session.disclosedData) {
        console.log('📋 DisclosedData:', JSON.stringify(session.disclosedData, null, 2));
    }

    // Use real disclosed data if available, otherwise fallback to mock
    let disclosedData;

    if (session.disclosedData && session.disclosedData.length > 0) {
        console.log('✨ Using REAL disclosed data for session:', token);
        console.log(`   Found ${session.disclosedData.length} attributes`);
        
        disclosedData = {
            disclosureId: 'REAL_DATA',
            disclosureName: 'ID-kaart Gegevens (Echt)',
            timestamp: session.receivedAt || new Date().toISOString(),
            attributes: session.disclosedData.map(attr => ({
                label: attr.label || attr.type || 'Onbekend',
                value: attr.value || 'Geen waarde',
                type: attr.type || 'unknown',
                disclosed: true
            }))
        };
    } else {
        console.log('⚠️ No disclosed data found, using MOCK data');
        // Mock disclosed data voor BAR scenario (profilePhoto + olderThan18)
        disclosedData = {
            disclosureId: 'BAR',
            disclosureName: 'Bar Toegang (Mock - Geen echte data ontvangen)',
            timestamp: new Date().toISOString(),
            attributes: [
                {
                    label: 'Profielfoto',
                    value: '👤',
                    type: 'profilePhoto',
                    disclosed: true
                },
                {
                    label: 'Ouder dan 18',
                    value: 'Ja',
                    type: 'olderThan18',
                    disclosed: true
                },
                {
                    label: 'Naam',
                    value: 'Niet gedeeld',
                    type: 'fullName',
                    disclosed: false
                },
                {
                    label: 'Adres',
                    value: 'Niet gedeeld',
                    type: 'address',
                    disclosed: false
                }
            ]
        };
    }

    res.send(`
        <!DOCTYPE html>
        <html lang="nl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Gedeelde Gegevens - NL Wallet PoC</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    padding: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .container {
                    background: white;
                    max-width: 600px;
                    width: 100%;
                    border-radius: 12px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    overflow: hidden;
                }
                .header {
                    background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
                    color: white;
                    padding: 30px;
                    text-align: center;
                }
                .header h1 {
                    font-size: 28px;
                    margin-bottom: 10px;
                }
                .header p {
                    opacity: 0.9;
                    font-size: 14px;
                }
                .content {
                    padding: 30px;
                }
                .disclosure-info {
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 25px;
                }
                .disclosure-info h2 {
                    color: #333;
                    font-size: 18px;
                    margin-bottom: 10px;
                }
                .disclosure-info .meta {
                    color: #666;
                    font-size: 14px;
                }
                .disclosure-info .meta strong {
                    color: #333;
                }
                .attributes {
                    margin-top: 20px;
                }
                .attributes h3 {
                    color: #333;
                    font-size: 16px;
                    margin-bottom: 15px;
                    padding-bottom: 10px;
                    border-bottom: 2px solid #f0f0f0;
                }
                .attribute-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 15px;
                    margin-bottom: 10px;
                    border-radius: 6px;
                    transition: all 0.2s;
                }
                .attribute-item.disclosed {
                    background: #d4edda;
                    border-left: 4px solid #28a745;
                }
                .attribute-item.not-disclosed {
                    background: #f8f9fa;
                    border-left: 4px solid #dee2e6;
                }
                .attribute-label {
                    font-weight: 600;
                    color: #333;
                    font-size: 14px;
                }
                .attribute-value {
                    color: #555;
                    font-size: 14px;
                }
                .attribute-item.not-disclosed .attribute-value {
                    color: #999;
                    font-style: italic;
                }
                .badge {
                    display: inline-block;
                    padding: 4px 10px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 600;
                    margin-left: 10px;
                }
                .badge.success {
                    background: #28a745;
                    color: white;
                }
                .badge.secondary {
                    background: #6c757d;
                    color: white;
                }
                .session-details {
                    margin-top: 25px;
                    padding: 15px;
                    background: #e7f3ff;
                    border-radius: 6px;
                    border-left: 4px solid #0066cc;
                }
                .session-details h4 {
                    color: #333;
                    font-size: 14px;
                    margin-bottom: 8px;
                }
                .session-details code {
                    background: white;
                    padding: 2px 8px;
                    border-radius: 3px;
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                    color: #0066cc;
                }
                .info-text {
                    margin-top: 20px;
                    padding: 15px;
                    background: #fff3cd;
                    border-left: 4px solid #ffc107;
                    border-radius: 6px;
                    font-size: 13px;
                    color: #856404;
                }
                .actions {
                    margin-top: 25px;
                    text-align: center;
                }
                .btn {
                    display: inline-block;
                    padding: 12px 24px;
                    background: linear-gradient(135deg, #0066cc 0%, #0052a3 100%);
                    color: white;
                    text-decoration: none;
                    border-radius: 6px;
                    font-weight: 600;
                    transition: transform 0.2s;
                }
                .btn:hover {
                    transform: translateY(-2px);
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>✅ Sessie Voltooid</h1>
                    <p>De gegevens zijn succesvol gedeeld</p>
                </div>
                
                <div class="content">
                    <div class="disclosure-info">
                        <h2>📋 ${disclosedData.disclosureName}</h2>
                        <div class="meta">
                            <strong>Disclosure ID:</strong> ${disclosedData.disclosureId}<br>
                            <strong>Tijdstip:</strong> ${new Date(disclosedData.timestamp).toLocaleString('nl-NL')}
                        </div>
                    </div>

                    <div class="attributes">
                        <h3>Gedeelde Gegevens</h3>
                        ${disclosedData.attributes.map(attr => `
                            <div class="attribute-item ${attr.disclosed ? 'disclosed' : 'not-disclosed'}">
                                <div>
                                    <div class="attribute-label">
                                        ${attr.label}
                                        <span class="badge ${attr.disclosed ? 'success' : 'secondary'}">
                                            ${attr.disclosed ? '✓ Gedeeld' : '✗ Niet gedeeld'}
                                        </span>
                                    </div>
                                </div>
                                <div class="attribute-value">${attr.value}</div>
                            </div>
                        `).join('')}
                    </div>

                    <div class="session-details">
                        <h4>🔐 Sessie Informatie</h4>
                        <p>Session Token: <code>${token}</code></p>
                        <p style="margin-top: 8px; font-size: 12px; color: #666;">
                            Status: ${session ? session.status : 'Unknown'}
                        </p>
                    </div>

                    <div class="info-text">
                        <strong>ℹ️ Let op:</strong> Dit is een mock implementatie voor demonstratie doeleinden. 
                        In een productie omgeving zouden de daadwerkelijke disclosed data van de Verification Server worden opgehaald.
                    </div>

                    <div class="actions">
                        <a href="/" class="btn">🏠 Terug naar Home</a>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `);
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        verificationServer: VERIFICATION_SERVER_URL
    });
});

// Start server
// Listen on all interfaces (0.0.0.0) so devices on the network can connect
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
🚀 NL Wallet PoC Server gestart!
   
   Server:     http://localhost:${PORT}
   Health:     http://localhost:${PORT}/health
   Start API:  POST http://localhost:${PORT}/api/sessions/start
   Return API: GET  http://localhost:${PORT}/api/sessions/return
   
   Verification Server: ${VERIFICATION_SERVER_URL}
   
   ⚠️  Let op: Dit is een mock implementatie voor demonstratie.
      Voor productie gebruik, implementeer echte calls naar de Verification Server.
    `);
});

