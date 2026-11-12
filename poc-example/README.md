# NL Wallet PoC - Voorbeeld Implementatie

Dit is een complete voorbeeld implementatie voor het gebruik van de wallet_web library in een Proof of Concept.

## Bestanden

- `index.html` - Frontend voorbeeld met wallet_web library
- `server.js` - Backend server (Node.js/Express) voorbeeld
- `package.json` - Node.js dependencies

## Recente Wijzigingen

### 26 november 2025
- ✅ **Static File Serving**: `server.js` serveert nu ook statische bestanden via `express.static()`
- ✅ **Vereenvoudigde Setup**: Geen aparte HTTP server meer nodig, alles draait op poort 3000
- ✅ **Gecentraliseerde Server**: Zowel API endpoints als frontend worden door één server geserveerd

## Snelstart

### 1. Installeer dependencies

```bash
cd poc-example
npm install
```

### 2. Start de server

De server serveert zowel de API endpoints als de statische bestanden (HTML, JS):

```bash
# Standaard server (inclusief static file serving)
npm start

# Of Apple-optimized server (met Universal Links support)
npm run start:apple
```

De server draait nu op `http://localhost:3000`

### 3. Open in browser

Ga naar: `http://localhost:3000/`

> **Let op**: De server serveert nu automatisch de `index.html` en alle andere statische bestanden. Je hoeft geen aparte HTTP server meer te starten.

## Server Endpoints

De `server.js` biedt de volgende endpoints:

### API Endpoints
- `POST /api/sessions/start` - Start een nieuwe sessie voor QR disclosure
- `GET /api/sessions/:token/status` - Controleer de status van een sessie
- `GET /api/sessions/return` - Return URL voor cross-device sessies
- `GET /health` - Health check endpoint

### Statische Bestanden
- `/` of `/index.html` - Hoofdpagina met NL Wallet button
- `/qr_card_generator.html` - QR kaart generator tool
- `/wallet_web/` - Wallet web library distributie

De server gebruikt `express.static()` om alle bestanden in de `poc-example` directory te serveren.

## Belangrijk voor een werkende PoC

⚠️ **De huidige implementatie is een MOCK** - voor een werkende PoC moet je:

1. **Verification Server draaien**:
   ```bash
   cd /Users/marc/Projecten/nl-wallet
   scripts/start-devenv.sh --default
   ```

2. **Echte API calls implementeren** in `server.js`:
   - Vervang de mock implementatie met echte calls naar de Verification Server
   - Implementeer de juiste endpoints volgens de Verification Server API documentatie

3. **NL Wallet app**:
   - Installeer de NL Wallet app op je device (of gebruik simulator)
   - Zorg dat de app verbonden is met dezelfde Verification Server

## Aanpassen voor jouw PoC

1. **Wijzig de usecase** in `index.html`:
   ```html
   <nl-wallet-button usecase="jouw_usecase" ...>
   ```

2. **Pas de backend URL aan** als nodig:
   ```html
   start-url="http://jouw-server:port/api/sessions/start"
   ```

3. **Implementeer echte Verification Server integratie** in `server.js`

## Apple (iOS/macOS) Implementatie

Voor Apple platforms:

```bash
# iOS setup
./setup-ios-poc.sh

# Run iOS app
cd ../wallet_app
flutter run --dart-define=MOCK_REPOSITORIES=true
```

Zie `../POC_GUIDE_APPLE.md` voor uitgebreide iOS/macOS instructies.

## QR-Codes Genereren om Data in de Wallet te Laden

De NL Wallet PoC biedt twee manieren om kaarten aan de wallet toe te voegen via QR-codes:

### 🎫 Optie 1: Visuele QR Card Generator (Aanbevolen voor Testing)

Een gebruiksvriendelijke webinterface om snel QR-codes te genereren met kaartdata.

#### Starten

De QR card generator is beschikbaar zodra de server draait:

```bash
# Open in browser (als server draait)
open http://localhost:3000/qr_card_generator.html
# Of navigeer handmatig naar: http://localhost:3000/qr_card_generator.html
```

#### Gebruik

1. **Vul de kaartgegevens in**:
   - Kaart Type (ID Kaart, Rijbewijs, Diploma, Lidmaatschap)
   - Uitgever Naam
   - Persoonlijke gegevens (naam, geboortedatum, etc.)
   - Adresgegevens
   - Geldigheidsperiode

2. **Genereer QR Code**: Klik op "Genereer QR Code"

3. **Scan met Wallet**: 
   - Start de NL Wallet app in mock mode
   - Scan de gegenereerde QR-code
   - De kaart wordt automatisch toegevoegd

4. **Extra opties**:
   - Download QR als PNG afbeelding
   - Kopieer JSON data naar klembord
   - Maak een nieuwe kaart

#### QR Code Data Formaat

De gegenereerde QR-codes bevatten JSON data in het volgende formaat:

```json
{
  "type": "nl_wallet_card_import",
  "version": "1.0",
  "card": {
    "attestationType": "id_card",
    "issuer": {
      "name": { "nl-NL": "Test Organisatie" },
      "id": "test_issuer_123"
    },
    "status": "valid",
    "validFrom": "2025-11-26T00:00:00.000Z",
    "validUntil": "2026-11-26T00:00:00.000Z",
    "attributes": [
      {
        "type": "mock_firstNames",
        "label": { "nl-NL": "Voornamen" },
        "value": { "nl-NL": "Jan" }
      },
      {
        "type": "mock_lastName",
        "label": { "nl-NL": "Achternaam" },
        "value": { "nl-NL": "de Vries" }
      }
    ]
  }
}
```

### 🔧 Optie 2: Programmatisch QR-Codes Genereren

Voor geautomatiseerde tests of integratie kun je QR-codes programmatisch genereren.

#### Voorbeeld met JavaScript

```javascript
// Kaart data object
const cardData = {
  type: 'nl_wallet_card_import',
  version: '1.0',
  card: {
    attestationType: 'id_card',
    issuer: {
      name: { 'nl-NL': 'Mijn Organisatie' },
      id: 'my_issuer_id'
    },
    status: 'valid',
    validFrom: new Date().toISOString(),
    validUntil: new Date(Date.now() + 365*24*60*60*1000).toISOString(),
    attributes: [
      {
        type: 'mock_firstNames',
        label: { 'nl-NL': 'Voornamen' },
        value: { 'nl-NL': 'Test' }
      }
    ]
  }
};

// Converteer naar JSON string voor QR code
const qrData = JSON.stringify(cardData);

// Gebruik een QR library zoals qrcode.js
// npm install qrcode
const QRCode = require('qrcode');
QRCode.toFile('card-qr.png', qrData);
```

#### Voorbeeld met Python

```python
import qrcode
import json
from datetime import datetime, timedelta

# Kaart data
card_data = {
    "type": "nl_wallet_card_import",
    "version": "1.0",
    "card": {
        "attestationType": "id_card",
        "issuer": {
            "name": {"nl-NL": "Test Organisatie"},
            "id": "test_issuer_123"
        },
        "status": "valid",
        "validFrom": datetime.now().isoformat(),
        "validUntil": (datetime.now() + timedelta(days=365)).isoformat(),
        "attributes": [
            {
                "type": "mock_firstNames",
                "label": {"nl-NL": "Voornamen"},
                "value": {"nl-NL": "Jan"}
            }
        ]
    }
}

# Genereer QR code
qr = qrcode.QRCode(version=1, box_size=10, border=5)
qr.add_data(json.dumps(card_data))
qr.make(fit=True)

img = qr.make_image(fill_color="black", back_color="white")
img.save("card-qr.png")
```

### ⚠️ Vereisten voor QR Scanning

Om QR-codes te kunnen scannen moet de NL Wallet app draaien in **mock mode**:

```bash
cd wallet_app
flutter run --dart-define=MOCK_REPOSITORIES=true
```

In mock mode kan de app:
- ✅ QR-codes scannen zonder echte verificatie
- ✅ Kaarten toevoegen aan de mock storage
- ✅ Test data tonen zonder backend connectie

### 📋 Beschikbare Kaart Types

De volgende `attestationType` waarden worden ondersteund:

- `id_card` - Identiteitsbewijs
- `drivers_license` - Rijbewijs  
- `diploma` - Diploma of certificaat
- `membership` - Lidmaatschapskaart

### 🔍 Attribute Types

Standaard mock attribute types die herkend worden:

| Type | Label (NL) | Beschrijving |
|------|-----------|--------------|
| `mock_firstNames` | Voornamen | Voornamen van persoon |
| `mock_lastName` | Achternaam | Achternaam van persoon |
| `mock_birthDate` | Geboortedatum | Geboortedatum (YYYY-MM-DD) |
| `mock_streetName` | Straatnaam | Straatnaam van adres |
| `mock_houseNumber` | Huisnummer | Huisnummer incl. toevoeging |
| `mock_postalCode` | Postcode | Nederlandse postcode |
| `mock_city` | Woonplaats | Woonplaats naam |
| `birth_place` | Geboorteplaats | Geboorteplaats |
| `document_number` | Document Nummer | Uniek documentnummer |

### 💡 Tips

- **QR Code Grootte**: Gebruik minimaal 256x256 pixels voor betrouwbaar scannen
- **Error Correction**: Level M (medium) wordt aanbevolen
- **Data Grootte**: Houd JSON compact; grote payloads kunnen moeilijk scanbaar zijn
- **Testing**: Test QR-codes eerst op groot scherm voordat je ze print

## Meer informatie


- Algemene gids: `../POC_GUIDE.md`
- Apple specifiek: `../POC_GUIDE_APPLE.md`

