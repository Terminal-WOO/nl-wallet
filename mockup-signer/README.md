# NL Wallet Document Signer Mockup

Een interactieve animatie/simulatie voor het digitaal ondertekenen en verifiëren van documenten met de NL Wallet.

## Overzicht

Deze mockup app demonstreert visueel hoe documenten digitaal worden ondertekend met de NL Wallet en hoe anderen via een link kunnen verifiëren dat jij het document hebt ondertekend. De applicatie bevat:

- 🎬 **Interactieve Animatie**: Stap-voor-stap simulatie van het ondertekeningsproces
- 📱 **NL Wallet Simulatie**: Visuele simulatie van de NL Wallet app
- 🔗 **Deelbare Verificatie Links**: Genereer links die anderen kunnen gebruiken om te verifiëren
- ✅ **Real-time Verificatie**: Directe verificatie van ondertekende documenten

## Demo

Open `frontend/demo.html` voor de interactieve animatie/simulatie!

## Features

- ✅ **PDF Upload**: Upload PDF documenten via drag-and-drop of browse
- ✅ **Mock Wallet Verificatie**: Simuleert verificatie met NL Wallet (geen echte wallet nodig)
- ✅ **Digitale Ondertekening**: Onderteken documenten met cryptografische handtekeningen
- ✅ **Document Verificatie**: Verifieer de authenticiteit van ondertekende documenten
- ✅ **Moderne UI**: Gebruiksvriendelijke interface met duidelijke stappen

## Project Structuur

```
mockup-signer/
├── backend/
│   ├── server.js          # Express API server
│   └── package.json       # Backend dependencies
├── frontend/
│   ├── index.html         # Ondertekening pagina
│   └── verify.html        # Verificatie pagina
└── README.md
```

## Installatie

### Vereisten

- Node.js 16+ en npm
- Een moderne webbrowser

### Setup

1. **Installeer backend dependencies**:

```bash
cd mockup-signer/backend
npm install
```

2. **Start de backend server**:

```bash
npm start
```

De backend draait nu op http://localhost:3002

3. **Open de frontend**:

Je kunt de frontend openen door `frontend/index.html` te openen in je browser, of gebruik een lokale server:

```bash
# Met Python
cd frontend
python3 -m http.server 8080

# Of met Node.js http-server
npx http-server -p 8080
```

Open dan: http://localhost:8080/index.html

## Gebruik

### Interactieve Demo (Aanbevolen)

1. **Open de demo**:
   - Open `frontend/demo.html` in je browser
   - Of start een lokale server en ga naar `http://localhost:8080/demo.html`
   
2. **Start ondertekening**:
   - Klik op "Start Ondertekening"
   - Bekijk de animatie van het proces:
     - QR code wordt getoond
     - NL Wallet app simuleert (onderaan scherm)
     - PIN invoer simulatie
     - Document wordt ondertekend
   
3. **Deel verificatie link**:
   - Na ondertekening wordt een verificatie link gegenereerd
   - Kopieer en deel deze link met anderen
   - Zij kunnen de link gebruiken om te verifiëren dat jij het document hebt ondertekend

### PDF Upload Modus

1. **Upload PDF**: 
   - Sleep een PDF naar de upload area, of klik om te bladeren
   
2. **Verifieer met NL Wallet**:
   - Klik op "Verifieer met NL Wallet"
   - De app simuleert verificatie (wacht 2 seconden)
   - Mock credentials worden getoond
   
3. **Onderteken**:
   - Na succesvolle verificatie wordt de "Onderteken Document" knop actief
   - Klik om het document te ondertekenen
   - Het ondertekende PDF wordt automatisch gedownload

### Document Verifiëren

1. **Open verificatie pagina**:
   - Gebruik de verificatie link die is gegenereerd na ondertekening
   - Of ga naar `verify.html?id=DOCUMENT_ID`
   
2. **Automatische verificatie**:
   - De pagina verifieert automatisch het document
   - Resultaten worden direct getoond

## API Endpoints

### Backend API (Port 3002)

#### `POST /api/sessions/start`
Start een nieuwe disclosure sessie (mock).

**Request**:
```json
{
  "usecase": "document_signing"
}
```

**Response**:
```json
{
  "status_url": "http://localhost:3002/api/sessions/SESSION_ID/status",
  "session_token": "SESSION_ID"
}
```

#### `GET /api/sessions/:sessionId/status`
Haal sessie status op.

**Response**:
```json
{
  "status": "completed",
  "session_token": "SESSION_ID"
}
```

#### `GET /api/sessions/:sessionId/credentials`
Haal disclosed credentials op (mock data).

**Response**:
```json
{
  "credentials": {
    "given_name": "Jan",
    "family_name": "Jansen",
    "birth_date": "1990-05-15",
    "document_number": "NLD123456789",
    "nationality": "Nederlandse"
  },
  "session_token": "SESSION_ID"
}
```

#### `POST /api/documents/sign`
Onderteken een PDF document.

**Request** (multipart/form-data):
- `document`: PDF bestand
- `sessionToken`: Sessie token
- `credentials`: JSON string met credentials

**Response**: 
Ondertekend PDF bestand (application/pdf)

#### `GET /api/documents/verify/:documentId`
Verifieer een ondertekend document.

**Response**:
```json
{
  "verified": true,
  "documentId": "DOC_ID",
  "signer": {
    "name": "Jan Jansen",
    "credentials": { ... }
  },
  "signedAt": "2025-01-20T10:00:00.000Z",
  "documentHash": "abc123...",
  "originalFileName": "document.pdf"
}
```

#### `GET /api/public-key`
Haal de publieke sleutel op voor handmatige verificatie.

**Response**:
```json
{
  "publicKey": "-----BEGIN PUBLIC KEY-----\n...",
  "algorithm": "RSA-SHA256",
  "keySize": 2048
}
```

## Hoe het werkt

### 1. Mock Wallet Verificatie

In plaats van een echte wallet integratie, simuleert de app de verificatie flow:
- Een sessie wordt gestart
- Na 2 seconden zijn mock credentials beschikbaar
- Deze credentials worden gebruikt voor ondertekening

### 2. Document Signing

Het ondertekeningsproces:
1. PDF wordt geladen met `pdf-lib`
2. Signature block wordt toegevoegd met signer gegevens
3. Document hash wordt berekend (SHA-256)
4. Signature data wordt cryptografisch ondertekend met RSA
5. Metadata wordt opgeslagen voor verificatie
6. PDF wordt geretourneerd met signature block

### 3. Verificatie

De verificatie controleert:
- ✓ Document ID bestaat
- ✓ Cryptografische signature is geldig (RSA verify)
- ✓ Document hash komt overeen
- ✓ Timestamp is valide
- ✓ Signer credentials zijn consistent

## Beveiliging

⚠️ **Let op**: Dit is een mockup met mock data!

- Mock credentials (geen echte NL Wallet integratie)
- In-memory storage (data verdwijnt bij restart)
- Geen database persistence
- Geen rate limiting
- Geen input validatie
- HTTP (geen HTTPS)

Voor productie gebruik moet je:
- Echte Verification Server integreren
- Database toevoegen voor persistente opslag
- HTTPS verplicht maken
- Input validatie en sanitization
- Rate limiting implementeren
- HSM gebruiken voor private key opslag
- Audit logging toevoegen

## Troubleshooting

### Backend start niet
- Check of port 3002 vrij is: `lsof -i :3002`
- Installeer dependencies opnieuw: `npm install`

### Frontend laadt niet
- Check of de backend draait op port 3002
- Controleer browser console voor errors
- Zorg dat CORS is ingeschakeld in de backend

### Verificatie werkt niet
- Zorg dat je een geldig Document ID gebruikt
- Check of het document daadwerkelijk is ondertekend
- Controleer backend logs voor errors

## Licentie

EUPL-1.2 (matching NL Wallet project)

