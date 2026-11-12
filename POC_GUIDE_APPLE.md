# Wallet Web Library - Apple (iOS/macOS) PoC Gids

Deze gids helpt je om de wallet_web library te gebruiken voor een Proof of Concept op Apple platforms (iOS en macOS).

## Overzicht

Voor Apple platforms zijn er enkele specifieke overwegingen:
- **iOS**: Universal Links configuratie via Associated Domains
- **macOS**: Web-based implementatie (Safari)
- **App Attestation**: Apple DeviceCheck voor security

## iOS App Build voor PoC

### Vereisten

1. **Xcode** (laatste versie)
2. **iOS Simulator** of fysiek iOS device
3. **Flutter** geïnstalleerd
4. **CocoaPods** (voor iOS dependencies)

### Stap 1: iOS Simulator starten

```bash
# Open iOS Simulator
open -a Simulator

# Of via Xcode: Xcode > Open Developer Tool > Simulator
```

### Stap 2: Flutter dependencies installeren

```bash
cd /Users/marc/Projecten/nl-wallet/wallet_app
flutter pub get
```

### Stap 3: iOS Pods installeren

```bash
cd wallet_app/ios
pod install
cd ../..
```

### Stap 4: App bouwen en runnen

#### Mock versie (geen backend nodig):

```bash
cd wallet_app
flutter run --dart-define=MOCK_REPOSITORIES=true
```

#### Core versie (met backend):

```bash
cd wallet_app
UL_HOSTNAME=app.example.com \
UNIVERSAL_LINK_BASE="https://app.example.com/ul/" \
flutter run --dart-define=UL_HOSTNAME=app.example.com
```

### Stap 5: Universal Links configureren

Voor een werkende PoC met Universal Links moet je:

1. **Associated Domains** configureren in Xcode:
   - Open `wallet_app/ios/Runner.xcworkspace` in Xcode
   - Selecteer Runner target
   - Ga naar "Signing & Capabilities"
   - Voeg "Associated Domains" capability toe
   - Voeg toe: `applinks:jouw-domein.com`

2. **Apple App Site Association (AASA) file** op je server:
   ```
   https://jouw-domein.com/.well-known/apple-app-site-association
   ```

   Voorbeeld AASA file:
   ```json
   {
     "applinks": {
       "apps": [],
       "details": [
         {
           "appID": "TEAM_ID.nl.ictu.edi.wallet.latest",
           "paths": ["/ul/*"]
         }
       ]
     }
   }
   ```

## macOS Web Implementatie

Voor macOS gebruik je dezelfde wallet_web library als voor web browsers. Safari ondersteunt alle moderne web features.

### Stap 1: Serveer de PoC op macOS

```bash
cd /Users/marc/Projecten/nl-wallet/poc-example

# Start backend
npm start

# In andere terminal: serveer HTML
python3 -m http.server 8080
```

### Stap 2: Open in Safari

Open Safari en ga naar: `http://localhost:8080/index.html`

### macOS Specifieke Overwegingen

1. **Safari Privacy**: Safari kan strict privacy settings hebben. Test in verschillende privacy modes.
2. **Localhost**: Voor development werkt `localhost` prima op macOS.
3. **HTTPS**: Voor productie heb je HTTPS nodig (gebruik bijv. ngrok voor testing).

## iOS Simulator Testing

### Testen met iOS Simulator

1. **Start de PoC backend**:
   ```bash
   cd poc-example
   npm start
   ```

2. **Start een lokale server** (zodat iOS Simulator erbij kan):
   ```bash
   # Gebruik je Mac's IP adres in plaats van localhost
   # Vind je IP: ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # Bijvoorbeeld: python3 -m http.server 8080 --bind 192.168.1.100
   ```

3. **Open in iOS Simulator Safari**:
   - Open Safari in de simulator
   - Ga naar: `http://[jouw-ip]:8080/index.html`

### Universal Links testen in Simulator

Universal Links werken in de simulator, maar je moet wel de juiste configuratie hebben:

```bash
# Test Universal Link
xcrun simctl openurl booted "https://jouw-domein.com/ul/session/123"
```

## Apple App Attestation

Voor productie builds is Apple App Attestation vereist. Voor PoC/development:

### Development/Simulator

De app gebruikt automatisch `fake_attestation` in de simulator:

```bash
flutter run --dart-define=FAKE_ATTESTATION=true
```

### Productie Build

Voor echte devices en TestFlight:

```bash
CONFIG_ENV=dev \
UL_HOSTNAME=app.example.com \
UNIVERSAL_LINK_BASE="https://app.example.com/ul/" \
APPLE_ATTESTATION_ENVIRONMENT=production \
flutter build ios --release
```

## iOS PoC Setup Script

Maak een `setup-ios-poc.sh` script:

```bash
#!/bin/bash

# iOS PoC Setup Script

echo "🍎 iOS PoC Setup"

# Check Xcode
if ! command -v xcodebuild &> /dev/null; then
    echo "❌ Xcode niet gevonden. Installeer Xcode van de App Store."
    exit 1
fi

# Check Flutter
if ! command -v flutter &> /dev/null; then
    echo "❌ Flutter niet gevonden. Installeer Flutter."
    exit 1
fi

# Install pods
echo "📦 Installing CocoaPods dependencies..."
cd wallet_app/ios
pod install
cd ../..

# Start simulator
echo "📱 Starting iOS Simulator..."
open -a Simulator

# Get local IP
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
echo "🌐 Je lokale IP: $LOCAL_IP"

echo ""
echo "✅ Setup compleet!"
echo ""
echo "Volgende stappen:"
echo "1. Start backend: cd poc-example && npm start"
echo "2. Serveer HTML: python3 -m http.server 8080 --bind $LOCAL_IP"
echo "3. Open in Simulator Safari: http://$LOCAL_IP:8080/index.html"
```

## Troubleshooting iOS

### Probleem: App bouwt niet

```bash
# Clean build
cd wallet_app
flutter clean
flutter pub get
cd ios
pod deintegrate
pod install
cd ../..
flutter run
```

### Probleem: Universal Links werken niet

1. Check Associated Domains in Xcode
2. Verify AASA file is bereikbaar: `curl https://jouw-domein.com/.well-known/apple-app-site-association`
3. Test met: `xcrun simctl openurl booted "https://jouw-domein.com/ul/test"`

### Probleem: CORS errors in Simulator

Zorg dat je backend CORS headers stuurt:

```javascript
// In server.js
app.use(cors({
    origin: '*', // Voor PoC, in productie specifiek maken
    credentials: true
}));
```

## macOS Specifieke Tips

### Local Development met HTTPS

Voor HTTPS op localhost (vereist voor sommige features):

```bash
# Installeer mkcert
brew install mkcert

# Setup local CA
mkcert -install

# Genereer certificaat
mkcert localhost 127.0.0.1 ::1

# Start server met HTTPS
npx http-server -p 8080 -S -C localhost+2.pem -K localhost+2-key.pem
```

### Safari Developer Tools

1. Enable Developer menu: Safari > Preferences > Advanced > "Show Develop menu"
2. Open Web Inspector voor debugging
3. Test responsive design met verschillende viewport sizes

## Voorbeeld: Complete iOS PoC Flow

```bash
# Terminal 1: Start backend
cd /Users/marc/Projecten/nl-wallet/poc-example
npm start

# Terminal 2: Start development environment (optioneel)
cd /Users/marc/Projecten/nl-wallet
scripts/start-devenv.sh --default

# Terminal 3: Serveer HTML
cd /Users/marc/Projecten/nl-wallet/poc-example
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
python3 -m http.server 8080 --bind $LOCAL_IP

# Terminal 4: Run iOS app
cd /Users/marc/Projecten/nl-wallet/wallet_app
flutter run --dart-define=MOCK_REPOSITORIES=true
```

## Apple Platform Specifieke Features

### 1. Face ID / Touch ID

De app gebruikt automatisch Face ID/Touch ID voor authenticatie op iOS devices.

### 2. Secure Enclave

Keys worden opgeslagen in de Secure Enclave voor maximale security.

### 3. App Transport Security

iOS vereist HTTPS voor network requests. Voor development kun je ATS uitzetten in Info.plist (niet aanbevolen voor productie).

## Volgende Stappen

1. **Test op echt device**: Test op een fysiek iOS device voor beste ervaring
2. **Configureer Universal Links**: Setup echte domain met AASA file
3. **Test App Attestation**: Verify attestation werkt correct
4. **TestFlight**: Upload naar TestFlight voor beta testing

## Referenties

- [Apple Universal Links Documentation](https://developer.apple.com/documentation/xcode/supporting-universal-links-in-your-app)
- [Associated Domains](https://developer.apple.com/documentation/xcode/supporting-universal-links-in-your-app)
- [App Attestation](https://developer.apple.com/documentation/devicecheck)

