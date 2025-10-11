#!/bin/bash

# Stock Analysis Pro - Start Servers Script
# This script kills conflicting ports first, then starts both backend and frontend

echo "🚀 Starting Stock Analysis Pro Servers..."
echo ""

# Function to kill processes on specific ports
kill_port() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pids" ]; then
        echo "🔧 Killing processes on port $port: $pids"
        echo $pids | xargs kill -9 2>/dev/null
        sleep 2
    fi
}

# Function to check if port is free
is_port_free() {
    local port=$1
    if lsof -i:$port >/dev/null 2>&1; then
        return 1  # Port is in use
    else
        return 0  # Port is free
    fi
}

# Step 1: Kill all conflicting ports
echo "🧹 Step 1: Killing all conflicting ports..."
echo "Killing processes on ports 4000, 5173, 3000, 5174, 5175..."

kill_port 4000
kill_port 5173
kill_port 3000
kill_port 5174
kill_port 5175

# Wait for ports to be released
echo "⏳ Waiting for ports to be released..."
sleep 3

# Step 2: Verify ports are free
echo ""
echo "🔍 Step 2: Verifying ports are free..."

if is_port_free 4000; then
    echo "✅ Port 4000 is free"
else
    echo "❌ Port 4000 still in use, forcing cleanup..."
    kill_port 4000
    sleep 2
fi

if is_port_free 5173; then
    echo "✅ Port 5173 is free"
else
    echo "❌ Port 5173 still in use, forcing cleanup..."
    kill_port 5173
    sleep 2
fi

# Step 3: Start both servers
echo ""
echo "🎯 Step 3: Starting servers..."
echo "📊 Backend will run on: http://localhost:4000"
echo "🎨 Frontend will run on: http://localhost:5173"
echo ""

# Start both services using concurrently
echo "🚀 Starting both backend and frontend..."
npm run dev:full
