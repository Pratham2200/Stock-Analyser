#!/bin/bash

# Stock Analysis Pro - Unified Startup Script
# This script handles port conflicts and starts both backend and frontend services

set -e  # Exit on any error

echo "🚀 Starting Stock Analysis Pro..."
echo "📊 Professional Trading Dashboard v2.0.0"
echo ""

# Colors for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to kill processes on specific ports
kill_port() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pids" ]; then
        echo -e "${YELLOW}🔧 Killing processes on port $port: $pids${NC}"
        echo $pids | xargs kill -9 2>/dev/null || true
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

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1
    
    echo -e "${BLUE}⏳ Waiting for $service_name to be ready...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ $service_name is ready!${NC}"
            return 0
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ $service_name failed to start within expected time${NC}"
    return 1
}

# Step 1: Clean up port conflicts
echo -e "${BLUE}🧹 Step 1: Cleaning up port conflicts...${NC}"
echo "Killing processes on ports 4000, 5173, 3000, 5174, 5175..."

kill_port 4000
kill_port 5173
kill_port 3000
kill_port 5174
kill_port 5175

# Wait for ports to be released
echo -e "${BLUE}⏳ Waiting for ports to be released...${NC}"
sleep 3

# Step 2: Verify ports are free
echo ""
echo -e "${BLUE}🔍 Step 2: Verifying ports are free...${NC}"

if is_port_free 4000; then
    echo -e "${GREEN}✅ Port 4000 is free${NC}"
else
    echo -e "${RED}❌ Port 4000 still in use, forcing cleanup...${NC}"
    kill_port 4000
    sleep 2
fi

if is_port_free 5173; then
    echo -e "${GREEN}✅ Port 5173 is free${NC}"
else
    echo -e "${RED}❌ Port 5173 still in use, forcing cleanup...${NC}"
    kill_port 5173
    sleep 2
fi

# Step 3: Check dependencies
echo ""
echo -e "${BLUE}🔍 Step 3: Checking dependencies...${NC}"

# Check if concurrently is installed
if ! command -v concurrently &> /dev/null && ! npm list concurrently &> /dev/null; then
    echo -e "${YELLOW}📦 Installing concurrently package...${NC}"
    npm install concurrently
fi

# Check if client dependencies are installed
if [ ! -d "client/node_modules" ]; then
    echo -e "${YELLOW}📦 Installing client dependencies...${NC}"
    cd client && npm install && cd ..
fi

# Step 4: Start services
echo ""
echo -e "${BLUE}🎯 Step 4: Starting services...${NC}"
echo -e "${GREEN}📊 Backend API: http://localhost:4000${NC}"
echo -e "${GREEN}🎨 Frontend App: http://localhost:5173${NC}"
echo -e "${YELLOW}💡 Note: Frontend will proxy API calls to backend${NC}"
echo ""

# Create a trap to handle cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Shutting down services...${NC}"
    # Kill any remaining processes
    pkill -f "ts-node main.ts" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    echo -e "${GREEN}✅ Services stopped${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start both services using concurrently
echo -e "${BLUE}🚀 Starting Backend (Port 4000) and Frontend (Port 5173)...${NC}"
echo ""

# Use concurrently to start both services
npx concurrently \
    --kill-others \
    --prefix "[{name}]" \
    --names "Backend,Frontend" \
    --prefix-colors "blue,green" \
    --restart-tries 3 \
    "npm run dev" \
    "cd client && npm run dev"

# If we reach here, concurrently has exited
echo -e "${YELLOW}🛑 Services stopped${NC}"

# Optional: Verify services are running on correct ports
echo ""
echo -e "${BLUE}🔍 Verifying services are running on correct ports...${NC}"
sleep 5

if curl -s http://localhost:4000/api/status >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is running on port 4000${NC}"
else
    echo -e "${RED}❌ Backend not responding on port 4000${NC}"
fi

if curl -s http://localhost:5173 >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend is running on port 5173${NC}"
else
    echo -e "${RED}❌ Frontend not responding on port 5173${NC}"
fi