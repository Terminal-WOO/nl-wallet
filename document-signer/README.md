# NL Wallet Document Signer

Een webapplicatie waarmee gebruikers PDF documenten kunnen ondertekenen met hun NL Wallet credentials. Het systeem gebruikt cryptografische handtekeningen die publiekelijk verifieerbaar zijn.

## Features

- ✅ **QR Code met Logo**: Genereer QR codes met een embedded logo voor eenvoudig scannen
- ✅ **Credential Disclosure**: Lees gegevens uit de NL Wallet via disclosure flow
- ✅ **PDF Upload**: Drag-and-drop of browse functionaliteit voor PDF bestanden
- ✅ **Cryptografische Signing**: RSA-SHA256 handtekeningen voor documenten
- ✅ **Publieke Verificatie**: Iedereen kan de handtekening en signer verifiëren
- ✅ **Visual Signature Block**: Automatisch toegevoegd aan PDF met signer gegevens

## Architectuur

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│  Frontend   │─────▶│   Backend    │─────▶│ NL Wallet   │
│  (Browser)  │      │  (Node.js)   │      │    App      │
└─────────────┘      └──────────────┘      └─────────────┘
       │                     │
       │                     ▼
       │              ┌──────────────┐
       └─────────────▶│ Verification │
                      │    Server    │
                      └──────────────┘
```

## Project Structuur

```
document-signer/
├── frontend/
│   ├── index.html          # Hoofd signing pagina
│   ├── verify.html         # Verificatie pagina
│   └── package.json
├── backend/
│   ├── server.js           # Express API server
│   └── package.json
└── README.md
```

## Installatie

### Vereisten

- Node.js 16+
- NL Wallet app geïnstalleerd op je mobiel
- NL Wallet development environment (optional, voor echte credentials)

### Setup

1. **Installeer dependencies**:

```bash
cd document-signer/backend
npm install

cd ../frontend
npm install
```

2. **Start de backend**:

```bash
cd backend
npm start
```

De backend draait nu op http://localhost:3001

3. **Serveer de frontend**:

```bash
cd frontend
python3 -m http.server 8080
```

Of gebruik een andere static file server.

4. **Open in browser**:

```
http://localhost:8080/index.html
```

## Gebruik

### Document Ondertekenen

1. **Upload PDF**: 
   - Sleep een PDF naar de upload area, of klik om te bladeren
   
2. **Verifieer Identiteit**:
   - Klik op "Verifieer met NL Wallet"
   - Scan de QR code met je NL Wallet app (cross-device)
   - Of klik direct op de knop (same-device op mobiel)
   
3. **Onderteken**:
   - Na succesvolle verificatie wordt de "Onderteken Document" knop actief
   - Klik om het document te ondertekenen
   - Download het ondertekende PDF

### Document Verifiëren

**Optie 1 - Via QR Code**:
- Scan de verificatie QR code die wordt getoond na ondertekening
- Je wordt doorgeleid naar de verificatie pagina

**Optie 2 - Direct**:
- Ga naar: `http://localhost:8080/verify.html`
- Voer het Document ID in (te vinden in het ondertekende PDF)
- Klik "Verifieer"

**Optie 3 - Via URL**:
- Gebruik de verificatie URL: `http://localhost:8080/verify.html?id=DOCUMENT_ID`

## API Endpoints

### Backend API (Port 3001)

#### `POST /api/sessions/start`
Start een nieuwe disclosure sessie.

**Request**:
```json
{
  "usecase": "document_signing"
}
```

**Response**:
```json
{
  "status_url": "http://localhost:3001/api/sessions/SESSION_ID/status",
  "session_token": "SESSION_ID"
}
```

#### `GET /api/sessions/:sessionId/status`
Haal sessie status op (gebruikt door wallet_web library polling).

**Response**:
```json
{
  "status": "completed",
  "session_token": "SESSION_ID"
}
```

#### `GET /api/sessions/:sessionId/credentials`
Haal disclosed credentials op na succesvolle sessie.

**Response**:
```json
{
  "credentials": {
    "first_name": "Jan",
    "last_name": "Jansen",
    "birth_date": "1990-01-01",
    "bsn": "123456789",
    "nationality": "Nederlandse",
    "document_number": "NLD123456"
  },
  "session_token": "SESSION_ID"
}
```

#### `POST /api/documents/sign`
Onderteken een PDF document.

**Request** (multipart/form-data):
- `document`: PDF bestand
- `sessionToken`: Sessie token van disclosure
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
  "signedAt": "2025-11-25T09:00:00.000Z",
  "documentHash": "abc123...",
  "originalFileName": "contract.pdf"
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

### 1. QR Code met Logo

De QR code generator gebruikt `qrcode.js` met hoge error correction (Level H), zodat het logo in het midden geplaatst kan worden zonder de scanbaarheid te beïnvloeden.

```javascript
new QRCode(element, {
    text: url,
    width: 256,
    height: 256,
    correctLevel: QRCode.CorrectLevel.H  // 30% error correction
});
```

Het logo wordt als overlay gecentreerd over de QR code geplaatst.

### 2. Credential Disclosure Flow

1. Frontend roept `/api/sessions/start` aan
2. Backend maakt een sessie en retourneert een `status_url`
3. `wallet_web` library opent dialoog en pollt de status
4. Gebruiker scant QR / klikt op deeplink
5. NL Wallet app opent en vraagt om disclosure
6. Na goedkeuring worden credentials opgehaald via `/api/sessions/:id/credentials`

### 3. Document Signing

Het signing proces:

1. **PDF laden** met `pdf-lib`
2. **Signature block toevoegen** met signer gegevens
3. **Document hash berekenen** (SHA-256)
4. **Signature data maken**:
   ```json
   {
     "documentHash": "sha256...",
     "sessionToken": "...",
     "timestamp": "2025-11-25T...",
     "signer": "Jan Jansen"
   }
   ```
5. **Cryptografisch ondertekenen** met RSA private key
6. **Metadata opslaan** voor verificatie
7. **PDF retourneren** met signature block en verification URL

### 4. Verificatie

De verificatie controleert:

1. ✓ Document ID bestaat in database
2. ✓ Cryptografische signature is geldig (RSA verify)
3. ✓ Document hash komt overeen
4. ✓ Timestamp is valide
5. ✓ Signer credentials zijn consistent

## Beveiliging

### Huidige Implementatie (PoC)

⚠️ **Let op**: Dit is een Proof of Concept met mock data!

- Mock credentials (geen echte NL Wallet integratie)
- In-memory storage (data verdwijnt bij restart)
- Geen database persistence
- Geen rate limiting
- Geen input validatie
- HTTP (geen HTTPS)

### Productie Vereisten

Voor productie gebruik moet je:

1. **Echte Verification Server** integreren
2. **Database** toevoegen (PostgreSQL) voor persistente opslag
3. **HTTPS** verplicht maken
4. **Input validatie** en sanitization
5. **Rate limiting** implementeren
6. **HSM** gebruiken voor private key opslag (niet in geheugen)
7. **Audit logging** toevoegen
8. **Token expiration** implementeren
9. **CORS** restrictief configureren
10. **File size limits** en virus scanning

## Mock vs Productie

### Mock Mode (Huidige PoC)

```javascript
// Mock credentials na 3 seconden
session.credentials = {
    first_name: 'Jan',
    last_name: 'Jansen',
    // ...
};
```

### Productie Mode

Je moet de verification server integreren:

```javascript
// Start session with verification server
const response = await axios.post('https://verification-server/disclosure/sessions', {
    usecase: 'document_signing',
    returnUrl: `${baseUrl}/api/sessions/${sessionId}/callback`
});

// Poll voor status
const status = await axios.get(response.data.statusUrl);

// Haal credentials op na completion
const creds = await axios.get(response.data.statusUrl);
```

## QR Code Aanpassingen

Om het logo aan te passen in de QR code:

```javascript
// Verander het emoji logo
logo.innerHTML = '🔐';  // Huidige

// Of gebruik een image:
logo.innerHTML = '<img src="logo.png" style="width: 100%; height: 100%;">';
```

## Extensies

### Meerdere Signature Formaten

Je kunt verschillende signature formaten toevoegen:

- **PAdES** (PDF Advanced Electronic Signatures)
- **CAdES** (CMS Advanced Electronic Signatures)  
- **XAdES** (XML Advanced Electronic Signatures)

### Document Templates

Voeg support toe voor templates:

```javascript
app.post('/api/documents/sign-template', async (req, res) => {
    // Laad template
    // Vul gegevens in
    // Onderteken
});
```

### Batch Signing

Onderteken meerdere documenten in één keer:

```javascript
app.post('/api/documents/sign-batch', async (req, res) => {
    // Upload multiple PDFs
    // Sign all with same credentials
});
```

## Troubleshooting

### Frontend laadt niet
- Check of de wallet_web library correct is gebouwd: `cd wallet_web && npm run build`
- Controleer de path in index.html: `<script src="../../wallet_web/dist/nl-wallet-web.iife.js">`

### Backend start niet
- Check of port 3001 vrij is: `lsof -i :3001`
- Installeer dependencies opnieuw: `npm install`

### QR Code werkt niet
- Controleer of QRCode.js is geladen
- Check browser console voor errors
- Probeer een andere browser

### Wallet verificatie faalt
- Start de development environment: `scripts/start-devenv.sh --default`
- Check of verification server draait op de juiste poort
- Controleer CORS settings

## Testing

### Test het complete flow:

1. Start backend: `cd backend && npm start`
2. Serveer frontend: `cd frontend && python3 -m http.server 8080`
3. Open http://localhost:8080/index.html
4. Upload een test PDF
5. Klik "Verifieer met NL Wallet" (mock credentials worden na 3 sec geladen)
6. Klik "Onderteken Document"
7. Download het ondertekende PDF
8. Open http://localhost:8080/verify.html
9. Voer het Document ID in of scan de QR code

## Volgende Stappen

- [ ] Integreer met echte Verification Server
- [ ] Voeg database toe voor persistente opslag
- [ ] Implementeer HTTPS
- [ ] Voeg HSM integratie toe voor key management
- [ ] Maak audit log systeem
- [ ] Voeg rate limiting toe
- [ ] Implementeer file validation en virus scanning
- [ ] Voeg support toe voor meerdere signature formaten (PAdES)
- [ ] Maak batch signing functionaliteit
- [ ] Voeg email notifications toe
- [ ] Implementeer document retention policy

## Licentie

EUPL-1.2 (matching NL Wallet project)
