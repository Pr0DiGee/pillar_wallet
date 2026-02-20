const { connect, signers } = require('@hyperledger/fabric-gateway');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const grpc = require('@grpc/grpc-js');

async function getContract() {
    // 1. Load the TLS Certificate
    const tlsCertPath = '/home/zubby/blockchain-lab/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt';
    const tlsCert = fs.readFileSync(tlsCertPath);
    const credentials = grpc.credentials.createSsl(tlsCert);

    // 2. Identity material from your existing wallet
    const walletPath = path.join(__dirname, 'wallet');
    const identityLabel = process.env.FABRIC_IDENTITY || 'zubby';
    const idPath = path.join(walletPath, `${identityLabel}.id`);
    const idData = JSON.parse(fs.readFileSync(idPath, 'utf8'));
    
    const privateKey = crypto.createPrivateKey(idData.credentials.privateKey);

    // 3. Establish SECURE gRPC connection
    const client = new grpc.Client('127.0.0.1:7051', credentials, {
        'grpc.ssl_target_name_override': 'peer0.org1.example.com'
    });

    // 4. Connect the Gateway
    // Update Step 4 in your fabric.js
    const gateway = connect({
        client,
        identity: { mspId: idData.mspId, credentials: Buffer.from(idData.credentials.certificate) },
        signer: signers.newPrivateKeySigner(privateKey),
        endorsementByOrg: 'Org1MSP', // Keep this
        evaluateOptions: () => ({ deadline: Date.now() + 5000 }),
        endorseOptions: () => ({ deadline: Date.now() + 60000 }), // Changed from 15000 to 60000
        // ADD THIS: Disable discovery so it doesn't try to find Org2
        discovery: false 
    });

    const network = gateway.getNetwork(process.env.HLF_CHANNEL || 'mychannel');
    const contract = network.getContract(process.env.HLF_CHAINCODE || 'basic');

    return { contract, gateway, client };
}

module.exports = { getContract };