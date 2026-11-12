#!/bin/bash

# iOS PoC Setup Script
# Dit script helpt je om de iOS PoC environment op te zetten

set -e

SCRIPT_DIR="$(cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🍎 iOS PoC Setup"
echo ""

# Check Xcode
if ! command -v xcodebuild &> /dev/null; then
    echo "❌ Xcode niet gevonden. Installeer Xcode van de App Store."
    exit 1
fi
echo "✅ Xcode gevonden: $(xcodebuild -version | head -1)"

# Check Flutter
if ! command -v flutter &> /dev/null; then
    echo "❌ Flutter niet gevonden. Installeer Flutter."
    exit 1
fi
echo "✅ Flutter gevonden: $(flutter --version | head -1)"

# Check CocoaPods
if ! command -v pod &> /dev/null; then
    echo "⚠️  CocoaPods niet gevonden. Installeren..."
    sudo gem install cocoapods
fi
echo "✅ CocoaPods gevonden: $(pod --version)"

# Install Flutter dependencies
echo ""
echo "📦 Installing Flutter dependencies..."
cd "$PROJECT_ROOT/wallet_app"
flutter pub get

# Install iOS pods
echo ""
echo "📦 Installing CocoaPods dependencies..."
cd ios
if [ ! -d "Pods" ]; then
    pod install
else
    echo "   Pods al geïnstalleerd, overslaan..."
fi
cd ../..

# Get local IP
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP="localhost"
fi

# Check if simulator is available
if xcrun simctl list devices available | grep -q "iPhone"; then
    echo ""
    echo "📱 iOS Simulator beschikbaar"
    
    # List available simulators
    echo ""
    echo "Beschikbare simulators:"
    xcrun simctl list devices available | grep "iPhone" | head -5
else
    echo "⚠️  Geen iPhone simulators gevonden. Open Xcode om simulators te installeren."
fi

echo ""
echo "✅ Setup compleet!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Volgende stappen:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1️⃣  Start de backend server:"
echo "   cd poc-example && npm start"
echo ""
echo "2️⃣  Serveer de HTML (in een andere terminal):"
echo "   cd poc-example"
if [ "$LOCAL_IP" != "localhost" ]; then
    echo "   python3 -m http.server 8080 --bind $LOCAL_IP"
    echo ""
    echo "   Of voor localhost alleen:"
    echo "   python3 -m http.server 8080"
else
    echo "   python3 -m http.server 8080"
fi
echo ""
echo "3️⃣  Start iOS Simulator:"
echo "   open -a Simulator"
echo ""
echo "4️⃣  Open in Simulator Safari:"
if [ "$LOCAL_IP" != "localhost" ]; then
    echo "   http://$LOCAL_IP:8080/index.html"
else
    echo "   http://localhost:8080/index.html"
fi
echo ""
echo "5️⃣  Of run de Flutter app direct:"
echo "   cd wallet_app"
echo "   flutter run --dart-define=MOCK_REPOSITORIES=true"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

