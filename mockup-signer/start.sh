#!/bin/bash

# Start script voor NL Wallet Document Signer Mockup

echo "🚀 NL Wallet Document Signer Mockup"
echo ""

# Check of Node.js is geïnstalleerd
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is niet geïnstalleerd. Installeer Node.js 16+ en probeer opnieuw."
    exit 1
fi

# Check of npm is geïnstalleerd
if ! command -v npm &> /dev/null; then
    echo "❌ npm is niet geïnstalleerd. Installeer npm en probeer opnieuw."
    exit 1
fi

# Ga naar backend directory
cd "$(dirname "$0")/backend"

# Check of node_modules bestaat
if [ ! -d "node_modules" ]; then
    echo "📦 Dependencies installeren..."
    npm install
fi

echo ""
echo "✅ Backend starten op http://localhost:3002"
echo "📝 Open frontend/index.html in je browser of gebruik een lokale server"
echo ""

# Start backend server
npm start

