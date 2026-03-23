#!/bin/bash
set -e  # Stop script if any command fails
# --- PILLAR VERIFIABLE CREDENTIALS: ONE-CLICK STARTUP ---

# 1. SETUP PATHS
PROJECT_ROOT=$(pwd)
FABRIC_PATH="$HOME/blockchain-lab/fabric-samples/test-network"
export PATH=$PATH:$HOME/blockchain-lab/fabric-samples/bin

echo "🚀 [1/4] Starting Hyperledger Fabric Network (CouchDB + CA)..."
cd $FABRIC_PATH
./network.sh down # Clean start

# STAGE 1: Bring up the nodes first
./network.sh up -ca -s couchdb

echo "⏳ Nodes are booting up. Giving them a 20-second grace period for TLS synchronization..."
sleep 20

# STAGE 2: Explicitly create and join the channel
./network.sh createChannel -c mychannel

echo "📦 [2/4] Deploying Smart Contract (CCaaS)..."
cd $PROJECT_ROOT
./scripts/deploy_chaincode_ccaas.sh > deploy.log 2>&1

echo "🖇️  Chaincode is now registered on the channel."

echo "🌐 [3/4] Starting Backend API Server..."
cd $PROJECT_ROOT/backend
# Refresh identities for the new network
rm -rf wallet/
node enrollAdmin.js && node registerUser.js backend_user

fuser -k 3000/tcp > /dev/null 2>&1 || true
echo "--- SYSTEM ONLINE ---"
echo "Open http://localhost:3000 for the Portal"
node index.js



