#!/bin/bash
# --- PILLAR VERIFIABLE CREDENTIALS: ONE-CLICK STARTUP ---

# 1. SETUP PATHS
PROJECT_ROOT=$(pwd)
FABRIC_PATH="$HOME/blockchain-lab/fabric-samples/test-network"
export PATH=$PATH:$HOME/blockchain-lab/fabric-samples/bin

echo "🚀 [1/4] Starting Hyperledger Fabric Network..."
cd $FABRIC_PATH
./network.sh up createChannel -ca -s couchdb

echo "📦 [2/4] Deploying Smart Contract Definition..."
cd $PROJECT_ROOT
./scripts/deploy_chaincode_ccaas.sh > deploy.log 2>&1

# Extract the dynamically generated Package ID
CC_ID=$(grep -o "basic_1.0:[^ ]*" deploy.log | head -1)

if [ -z "$CC_ID" ]; then
    echo "❌ ERROR: Could not find Chaincode Package ID. Check deploy.log"
    exit 1
fi

echo "🖇️  Found Chaincode ID: $CC_ID"

echo "⚙️  [3/4] Launching Smart Contract Service (Go)..."
export CHAINCODE_SERVER_ADDRESS="0.0.0.0:9999"
export CHAINCODE_ID="$CC_ID"
export CHAINCODE_TLS_DISABLED="true"

# Kill any existing service and start fresh
fuser -k 9999/tcp > /dev/null 2>&1
cd $PROJECT_ROOT/chaincode
nohup go run chaincode.go > cc_service.log 2>&1 &
echo "✅ Smart Contract Service is running in background (log: chaincode/cc_service.log)"

echo "🌐 [4/4] Starting Backend API Server..."
cd $PROJECT_ROOT/backend
fuser -k 3000/tcp > /dev/null 2>&1
# We run node index.js and pipe to log. Use & to background or leave in foreground?
# User usually wants to see the API logs in foreground.
echo "--- SYSTEM ONLINE: Open http://localhost:3000 in your browser ---"
node index.js
