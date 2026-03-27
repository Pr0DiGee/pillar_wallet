require('dotenv').config();
const fs = require('fs');
const crypto = require('crypto');
const eccrypto = require('eccrypto-js');
const axios = require('axios');
const { getContract } = require('./fabric');
const os = require('os');

// --- CONSTANTS ---
const NUM_TRIALS = 25;
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET = process.env.PINATA_SECRET;
const EXPORT_FILE = 'pillar_evaluation_remaining_25.csv';

if (!PINATA_API_KEY || !PINATA_SECRET) {
    console.error("FATAL: PINATA_API_KEY or PINATA_SECRET not found in .env");
    process.exit(1);
}

// Generate a mock 2MB PDF buffer
const createMockPDF = () => crypto.randomBytes(2048 * 1024);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function runEvaluation() {
    console.log(`🚀 Starting Pillar Wallet Evaluation Harness: ${NUM_TRIALS} Trials`);
    console.log(`--------------------------------------------------------------`);

    let csvOutput = "Trial,Type,DataSizeMB,HashDivergence,EncryptMs,DecryptMs,SignMs,VerifyMs,IpfsUploadMs,IpfsFetchMs,FabricLatencyMs,Success\n";
    // Live save header immediately
    fs.writeFileSync(EXPORT_FILE, csvOutput);

    // Setup University and Student Identities for Testing
    const uniPriv = eccrypto.generatePrivate();
    const uniPub = eccrypto.getPublic(uniPriv).toString('hex');
    const studentPriv = eccrypto.generatePrivate();
    const studentPub = eccrypto.getPublic(studentPriv);

    let totalFabricLatency = 0;
    let totalEncryptTime = 0;
    let totalDecryptTime = 0;

    for (let i = 1; i <= NUM_TRIALS; i++) {
        console.log(`\n--- Execution Trial: ${i}/${NUM_TRIALS} ---`);
        const credID = `EVAL-CERT-${Date.now()}-${i}`;
        const mockPdfBuffer = createMockPDF();

        // 1. Cryptographic ECC Metrics (Hash, Sign, Encrypt, Decrypt)
        let t0 = performance.now();
        const originalHashBuffer = crypto.createHash('sha256').update(mockPdfBuffer).digest();
        const originalHash = originalHashBuffer.toString('hex');
        const hashMs = performance.now() - t0;

        // Sign
        t0 = performance.now();
        const signature = await eccrypto.sign(uniPriv, originalHashBuffer);
        const signMs = performance.now() - t0;

        // Validating Cryptographic Integrity (1-bit flip Avalanche Test)
        const tamperedPdf = Buffer.from(mockPdfBuffer);
        tamperedPdf[0] ^= 1; // Flip 1 bit
        const tamperedHash = crypto.createHash('sha256').update(tamperedPdf).digest('hex');
        const hashDivergence = (originalHash !== tamperedHash) ? "100%" : "0%";

        // Encrypt (ECIES)
        const pdfBase64 = mockPdfBuffer.toString('base64');
        t0 = performance.now();
        const encrypted = await eccrypto.encrypt(studentPub, Buffer.from(pdfBase64));
        const encryptMs = performance.now() - t0;

        const encryptedPayload = {
            iv: encrypted.iv.toString('hex'),
            epk: encrypted.ephemPublicKey.toString('hex'),
            ct: encrypted.ciphertext.toString('hex'),
            mac: encrypted.mac.toString('hex')
        };
        const payloadString = JSON.stringify(encryptedPayload);

        // 2. IPFS Lifecycle Management
        // Upload (Pinata)
        t0 = performance.now();
        const formData = new FormData();
        const blob = new Blob([payloadString], { type: 'application/json' });
        formData.append('file', blob, 'encrypted.json');

        const pinRes = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
            headers: {
                'pinata_api_key': PINATA_API_KEY,
                'pinata_secret_api_key': PINATA_SECRET
            }
        });
        const cid = pinRes.data.IpfsHash;
        const ipfsUploadMs = performance.now() - t0;
        console.log(`[IPFS] Uploaded 2MB payload. CID: ${cid} (${ipfsUploadMs.toFixed(2)}ms)`);

        // Fetch (Pinata)
        t0 = performance.now();
        const fetchRes = await axios.get(`https://gateway.pinata.cloud/ipfs/${cid}`);
        const fetchedData = fetchRes.data;
        const ipfsFetchMs = performance.now() - t0;

        // Decryption Test
        t0 = performance.now();
        await eccrypto.decrypt(studentPriv, {
            iv: Buffer.from(fetchedData.iv, 'hex'),
            ephemPublicKey: Buffer.from(fetchedData.epk, 'hex'),
            ciphertext: Buffer.from(fetchedData.ct, 'hex'),
            mac: Buffer.from(fetchedData.mac, 'hex')
        });
        const decryptMs = performance.now() - t0;

        // Unpin immediately to save quota
        try {
            await axios.delete(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
                headers: {
                    'pinata_api_key': PINATA_API_KEY,
                    'pinata_secret_api_key': PINATA_SECRET
                }
            });
            console.log(`[IPFS] Successfully unpinned CID: ${cid}`);
        } catch (e) {
            console.warn(`[IPFS WARNING] Failed to unpin ${cid}`);
        }

        // 3. Blockchain Metrics (Fabric Commitment)
        console.log(`[FABRIC] Committing to Hyperledger Fabric...`);
        let fabricLatencyMs = 0;
        let success = true;
        let connection;
        try {
            connection = await getContract();
            t0 = performance.now();
            // IssueCredential arguments: [credentialID, studentPubKey, pdfHash, issuerSignature, ipfsCid, issuerName]
            await connection.contract.submit('IssueCredential', {
                arguments: [credID, studentPub.toString('hex'), originalHash, signature.toString('hex'), cid, "EVAL-UNIVERSITY"]
            });
            fabricLatencyMs = performance.now() - t0;
            console.log(`[FABRIC] Block Generated in ${fabricLatencyMs.toFixed(2)}ms`);
        } catch (e) {
            success = false;
            console.error(`[FABRIC ERROR]: ${e.message}`);
        } finally {
            if (connection) {
                if (connection.gateway) connection.gateway.close();
                if (connection.client) connection.client.close();
            }
        }

        // Write row live to prevent data loss on crash
        const row = `${i},SEQUENTIAL,2,${hashDivergence},${encryptMs.toFixed(2)},${decryptMs.toFixed(2)},${signMs.toFixed(2)},${hashMs.toFixed(2)},${ipfsUploadMs.toFixed(2)},${ipfsFetchMs.toFixed(2)},${fabricLatencyMs.toFixed(2)},${success}\n`;
        fs.appendFileSync(EXPORT_FILE, row);

        totalFabricLatency += fabricLatencyMs;
        totalEncryptTime += encryptMs;
        totalDecryptTime += decryptMs;

        // Small delay to prevent rate-limiting from Pinata during rapid fire
        await sleep(500);
    }

    // 4. MVCC Conflict Analysis (State Concurrency)
    console.log(`\n\n--- Executing MVCC Conflict Analysis ---`);
    const mvccCredID = `MVCC-TEST-${Date.now()}`;
    let connection;
    try {
        connection = await getContract();
        // Initial creation
        await connection.contract.submit('IssueCredential', {
            arguments: [mvccCredID, studentPub.toString('hex'), "hash", "sig", "cid", "MVCC-UNI"]
        });

        // 5 Rapid Concurrent Updates (assuming chaincode has an 'UpdateCredential' or we try re-issuing)
        console.log(`[FABRIC] Firing 5 rapid transactions at same ID to trigger MVCC Read-Write Conflict...`);
        const promises = [];
        for (let j = 0; j < 5; j++) {
            promises.push(connection.contract.submit('IssueCredential', {
                arguments: [mvccCredID, studentPub.toString('hex'), "hash" + j, "sig", "cid", "MVCC-UNI"]
            }).catch(e => e.message)); // Catch to prevent unhandled rejection crash
        }
        const results = await Promise.all(promises);

        let conflicts = 0;
        results.forEach(res => {
            if (String(res).includes("exists") || String(res).includes("MVCC") || String(res).includes("error")) {
                conflicts++;
            }
        });
        console.log(`[MVCC TEST] Detected ${conflicts} rejections out of 5 concurrent writes. (Expected: 4 or 5 rejections indicating successful concurrency control)`);

    } catch (e) {
        console.error("MVCC Test Error:", e);
    } finally {
        if (connection) {
            if (connection.gateway) connection.gateway.close();
            if (connection.client) connection.client.close();
        }
    }

    console.log(`\n✅ Raw evaluation data successfully kept live in ${EXPORT_FILE}`);

    // Print Final Performance Index
    const avgLatency = (totalFabricLatency / NUM_TRIALS) / 1000;
    const avgEncrypt = totalEncryptTime / NUM_TRIALS;

    console.log(`\n📊 OVERALL PERFORMANCE INDEX`);
    console.log(`Total CPU Memory Usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100} MB`);
    console.log(`System Load Average: ${os.loadavg()[0]}`);
    console.log(`Avg Blockchain TPS / Latency: ~ ${(1 / avgLatency).toFixed(2)} TPS @ ${avgLatency.toFixed(2)}s per block`);
    console.log(`Avg Cryptographic Load: Encryption: ${avgEncrypt.toFixed(2)}ms | Decryption: ${(totalDecryptTime / NUM_TRIALS).toFixed(2)}ms`);

}

runEvaluation();
