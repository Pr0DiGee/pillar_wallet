#!/bin/bash

# --- SYSTEM CONFIGURATION ---
# Updated with your new Package ID
export CHAINCODE_ID="basic_1.0:b82b0be8cc583774ad7ed710f48756d356180968c464c75fd4a43de97a8a23be"
export CHAINCODE_SERVER_ADDRESS="0.0.0.0:9999"
export SEQUENCE="3" 
export CHAINCODE_TLS_DISABLED="true" 

# Common Paths
export FABRIC_CFG_PATH=$HOME/blockchain-lab/fabric-samples/config/
PEER_BIN=$HOME/blockchain-lab/fabric-samples/bin/peer
ORDERER_CA=$HOME/blockchain-lab/fabric-samples/test-network/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem

echo "#### 0. REFORMING LEDGER STATE (Sequence $SEQUENCE) ####"

# --- ORG 1 APPROVAL ---
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_ADDRESS=localhost:7051
export CORE_PEER_TLS_ROOTCERT_FILE=$HOME/blockchain-lab/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=$HOME/blockchain-lab/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp

$PEER_BIN lifecycle chaincode approveformyorg -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile $ORDERER_CA --channelID mychannel --name basic --version 1.0 --package-id $CHAINCODE_ID --sequence $SEQUENCE

# --- ORG 2 APPROVAL ---
export CORE_PEER_LOCALMSPID="Org2MSP"
export CORE_PEER_ADDRESS=localhost:9051
export CORE_PEER_TLS_ROOTCERT_FILE=$HOME/blockchain-lab/fabric-samples/test-network/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=$HOME/blockchain-lab/fabric-samples/test-network/organizations/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp

$PEER_BIN lifecycle chaincode approveformyorg -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile $ORDERER_CA --channelID mychannel --name basic --version 1.0 --package-id $CHAINCODE_ID --sequence $SEQUENCE

# --- GLOBAL COMMIT ---
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_ADDRESS=localhost:7051
export CORE_PEER_MSPCONFIGPATH=$HOME/blockchain-lab/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp

$PEER_BIN lifecycle chaincode commit -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile $ORDERER_CA --channelID mychannel --name basic --version 1.0 --sequence $SEQUENCE --peerAddresses localhost:7051 --tlsRootCertFiles $HOME/blockchain-lab/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt --peerAddresses localhost:9051 --tlsRootCertFiles $HOME/blockchain-lab/fabric-samples/test-network/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt

echo "#### 1. STARTING CHAINCODE SERVER (CCaaS) ####"
pkill -f "go run chaincode.go" || true
cd ~/blockchain-lab/PROJECT-MAIN/chaincode
nohup go run chaincode.go > cc_output.log 2>&1 &
CC_PID=$!
sleep 4

if ps -p $CC_PID > /dev/null; then
    echo "SUCCESS: Chaincode Server is LIVE (PID: $CC_PID)"
else
    echo "ERROR: Chaincode Server DIED. See cc_output.log"
    exit 1
fi

echo "#### 2. STARTING BACKEND API ####"
pkill -f "node index.js" || true
cd ~/blockchain-lab/PROJECT-MAIN/backend
node index.js &
API_PID=$!

echo "------------------------------------------------"
echo "SYSTEM FULLY ONLINE (Sequence $SEQUENCE)"
echo "------------------------------------------------"
wait