#!/bin/bash

echo "🚀 Starting NL Wallet Document Signer"
echo ""

# Check if in correct directory
if [ ! -f "README.md" ]; then
    echo "❌ Please run this script from the document-signer directory"
    exit 1
fi

# Start backend
echo "📦 Starting backend on port 3001..."
cd backend
npm start &
BACKEND_PID=$!
cd ..

sleep 2

# Start frontend
echo "🌐 Starting frontend on port 8080..."
cd frontend
python3 -m http.server 8080 &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Document Signer is running!"
echo ""
echo "📋 URLs:"
echo "   Frontend: http://localhost:8080/index.html"
echo "   Verify:   http://localhost:8080/verify.html"
echo "   Backend:  http://localhost:3001"
echo "   Health:   http://localhost:3001/health"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Trap to cleanup on exit
trap "echo ''; echo '🛑 Stopping services...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

# Wait for processes
wait
