#!/bin/bash

# Stock Analysis Pro - Cleanup Script
# Use this when you have port conflicts or need a fresh start

echo "🧹 CLEAN START - Killing all Node.js processes..."

# Kill ALL Node.js processes
pkill -f "node" 2>/dev/null
pkill -f "npm" 2>/dev/null
pkill -f "nodemon" 2>/dev/null
pkill -f "ts-node" 2>/dev/null

# Wait for processes to die
sleep 3

# Double check - kill any remaining processes on our ports
lsof -ti:4000 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:5174 | xargs kill -9 2>/dev/null
lsof -ti:5175 | xargs kill -9 2>/dev/null

# Wait a bit more
sleep 2

echo "✅ All processes killed"
echo "🎯 Ready to start fresh!"
echo ""
echo "Now run: ./start.sh"
