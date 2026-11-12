# Wallet Web Library - PoC Gebruikersgids

Deze gids helpt je om de wallet_web library te gebruiken voor een Proof of Concept.

## Overzicht

De wallet_web library is een custom HTML element (`<nl-wallet-button>`) die je eenvoudig in je webpagina kunt integreren. De library handelt de communicatie met de NL Wallet Verification Server af.

## Stap 1: Library kopiëren

Kopieer de gebouwde library bestanden naar je PoC project:

```bash
# Van nl-wallet/wallet_web/dist/ naar je PoC project
cp wallet_web/dist/nl-wallet-web.iife.js /pad/naar/jouw/poc/
```

## Stap 2: Minimale HTML pagina

Maak een `index.html` bestand:

```html
<!DOCTYPE html>
<html lang="nl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NL Wallet PoC</title>
    <!-- Laad de wallet_web library -->
    <script type="module" src="nl-wallet-web.iife.js"></script>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
        }
        
        /* Optioneel: Stijl de button */
        nl-wallet-button::part(button) {
            background: #0066cc;
            border: none;
            padding: 12px 24px;
            border-radius: 4px;
            cursor: pointer;
        }
        
        nl-wallet-button::part(button-span) {
            color: white;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <h1>NL Wallet PoC</h1>
    <p>Klik op de knop hieronder om in te loggen met NL Wallet:</p>
    
    <!-- De wallet button -->
    <nl-wallet-button
        id="wallet-button"
        text="Inloggen met NL Wallet"
        usecase="mijn_poc"
        start-url="http://localhost:3000/api/sessions/start"
        lang="nl"
    ></nl-wallet-button>
    
    <div id="result" style="margin-top: 20px; padding: 10px; background: #f0f0f0; display: none;">
        <h3>Resultaat:</h3>
        <pre id="result-content"></pre>
    </div>

    <script>
        const button = document.getElementById('wallet-button');
        const resultDiv = document.getElementById('result');
        const resultContent = document.getElementById('result-content');

        // Succesvolle sessie
        button.addEventListener('success', (e) => {
            if (e.detail && e.detail.length >= 2) {
                const sessionToken = e.detail[0];
                const sessionType = e.detail[1];
                
                resultDiv.style.display = 'block';
                resultContent.textContent = JSON.stringify({
                    status: 'success',
                    sessionToken: sessionToken,
                    sessionType: sessionType,
                    message: 'Sessie succesvol voltooid!'
                }, null, 2);
                
                // Voor cross-device sessies: redirect naar return URL
                if (sessionType === 'cross_device') {
                    window.location.href = `http://localhost:3000/api/sessions/return?token=${sessionToken}`;
                }
            }
        });

        // Gefaalde sessie
        button.addEventListener('failed', (e) => {
            if (e.detail && e.detail.length >= 2) {
                const sessionToken = e.detail[0];
                const sessionType = e.detail[1];
                
                resultDiv.style.display = 'block';
                resultContent.textContent = JSON.stringify({
                    status: 'failed',
                    sessionToken: sessionToken,
                    sessionType: sessionType,
                    message: 'Sessie is geannuleerd of gefaald.'
                }, null, 2);
            }
        });
    </script>
</body>
</html>
```

## Stap 3: Backend Endpoint (Node.js/Express voorbeeld)

Je hebt een backend endpoint nodig die een sessie start met de Verification Server. Hier is een simpel Express.js voorbeeld:

```javascript
// server.js
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Endpoint dat door wallet_web wordt aangeroepen
app.post('/api/sessions/start', async (req, res) => {
    const { usecase } = req.body;
    
    console.log('Starting session for usecase:', usecase);
    
    // TODO: Maak hier een request naar de Verification Server
    // Dit is een voorbeeld - vervang met echte implementatie
    const verificationServerUrl = 'http://localhost:8001'; // Aangepast naar jouw setup
    
    try {
        // Start een sessie bij de Verification Server
        const response = await fetch(`${verificationServerUrl}/disclosure/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                usecase: usecase,
                // Voeg andere vereiste parameters toe
            })
        });
        
        const sessionData = await response.json();
        
        // Return de data die wallet_web verwacht
        res.json({
            status_url: sessionData.status_url, // URL om status te pollen
            session_token: sessionData.session_token // Token voor deze sessie
        });
    } catch (error) {
        console.error('Error starting session:', error);
        res.status(500).json({ error: 'Failed to start session' });
    }
});

// Return URL voor cross-device sessies
app.get('/api/sessions/return', (req, res) => {
    const { token } = req.query;
    console.log('Session returned with token:', token);
    
    // TODO: Verifieer de sessie en haal de disclosed data op
    res.send(`
        <html>
            <body>
                <h1>Welkom terug!</h1>
                <p>Je sessie is succesvol voltooid.</p>
                <p>Session token: ${token}</p>
            </body>
        </html>
    `);
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`PoC server running on http://localhost:${PORT}`);
});
```

## Stap 4: Python Backend voorbeeld (alternatief)

Als je liever Python gebruikt:

```python
# server.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)

VERIFICATION_SERVER_URL = 'http://localhost:8001'

@app.route('/api/sessions/start', methods=['POST'])
def start_session():
    data = request.json
    usecase = data.get('usecase')
    
    print(f'Starting session for usecase: {usecase}')
    
    # Start sessie bij Verification Server
    try:
        response = requests.post(
            f'{VERIFICATION_SERVER_URL}/disclosure/sessions',
            json={'usecase': usecase}
        )
        response.raise_for_status()
        session_data = response.json()
        
        return jsonify({
            'status_url': session_data['status_url'],
            'session_token': session_data['session_token']
        })
    except Exception as e:
        print(f'Error: {e}')
        return jsonify({'error': 'Failed to start session'}), 500

@app.route('/api/sessions/return', methods=['GET'])
def return_session():
    token = request.args.get('token')
    print(f'Session returned with token: {token}')
    
    # TODO: Verifieer sessie en haal data op
    return f'''
    <html>
        <body>
            <h1>Welkom terug!</h1>
            <p>Je sessie is succesvol voltooid.</p>
            <p>Session token: {token}</p>
        </body>
    </html>
    '''

if __name__ == '__main__':
    app.run(port=3000, debug=True)
```

## Stap 5: Lokale Development Setup

### Optie A: Met lokale services

1. Start de development environment:
```bash
cd /Users/marc/Projecten/nl-wallet
scripts/start-devenv.sh --default
```

2. Start je PoC backend (Node.js):
```bash
npm install express cors
node server.js
```

3. Serveer je HTML pagina (bijv. met Python):
```bash
python3 -m http.server 8080
```

4. Open in browser: `http://localhost:8080`

### Optie B: Met eenvoudige HTTP server

Je kunt ook gewoon een simpele HTTP server gebruiken om de HTML te serveren:

```bash
# Python
python3 -m http.server 8080

# Of Node.js (met http-server)
npx http-server -p 8080
```

## Belangrijke Parameters

### nl-wallet-button attributen:

- `usecase` (vereist): Identificeert het use case type
- `start-url` (optioneel): URL van je backend endpoint. Default: `document.location.href`
- `text` (optioneel): Button tekst (moet "NL Wallet" bevatten)
- `lang` (optioneel): Taal (`nl` of `en`). Default: `nl`
- `help-base-url` (optioneel): URL voor help documentatie

### Events:

- `success`: Wordt getriggerd bij succesvolle sessie
  - `e.detail[0]`: session_token
  - `e.detail[1]`: session_type (`same_device` of `cross_device`)
  
- `failed`: Wordt getriggerd bij gefaalde/geannuleerde sessie
  - Zelfde structuur als `success`

## Sessie Types

- **same_device**: Gebruiker heeft NL Wallet app op hetzelfde apparaat. De app opent automatisch.
- **cross_device**: Gebruiker moet QR code scannen met NL Wallet app op ander apparaat. Je moet de gebruiker naar een return URL redirecten.

## Tips voor PoC

1. **Start simpel**: Begin met alleen de button en basis event handling
2. **Test beide sessie types**: Test zowel same-device als cross-device flows
3. **Log alles**: Log alle events en responses voor debugging
4. **Error handling**: Zorg voor goede error handling in je backend
5. **CORS**: Zorg dat CORS correct is geconfigureerd als frontend en backend op verschillende ports draaien

## Troubleshooting

- **Button verschijnt niet**: Controleer of `nl-wallet-web.iife.js` correct is geladen
- **Events werken niet**: Controleer of je de event listeners correct hebt toegevoegd
- **CORS errors**: Zorg dat je backend CORS headers stuurt
- **Session start faalt**: Controleer of je Verification Server draait en bereikbaar is

## Apple (iOS/macOS) Specifieke Implementatie

Voor Apple platforms, zie de uitgebreide gids: **[POC_GUIDE_APPLE.md](./POC_GUIDE_APPLE.md)**

De Apple gids bevat:
- iOS app build instructies
- iOS Simulator setup
- Universal Links configuratie
- macOS Safari implementatie
- Apple App Attestation setup

### Quick Start iOS

```bash
# Setup iOS environment
cd poc-example
./setup-ios-poc.sh

# Start backend
npm start

# In andere terminal: serveer HTML
python3 -m http.server 8080

# Run iOS app
cd ../wallet_app
flutter run --dart-define=MOCK_REPOSITORIES=true
```

## Volgende Stappen

1. Implementeer echte verificatie van disclosed data
2. Voeg database toe om sessies op te slaan
3. Implementeer proper error handling
4. Voeg logging en monitoring toe
5. Test met echte NL Wallet app (niet alleen simulator)
6. Configureer Universal Links voor productie (zie POC_GUIDE_APPLE.md)

