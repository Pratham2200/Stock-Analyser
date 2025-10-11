#!/bin/bash

# Quick Port Fix - One-liner solution
echo "🔧 Quick Port Fix..."

# Kill all Node.js processes on our target ports
lsof -ti:4000 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:5174 | xargs kill -9 2>/dev/null
lsof -ti:5175 | xargs kill -9 2>/dev/null

# Wait for cleanup
sleep 2

echo "✅ Ports cleaned up!"
echo "Now run:"
echo "Terminal 1: cd '/Users/kesha/Desktop/Stock Analyser/swing-screener' && npm run dev"
echo "Terminal 2: cd '/Users/kesha/Desktop/Stock Analyser/swing-screener/client' && npm run dev"
