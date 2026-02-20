require('dotenv').config();
const express = require('express');
const multer = require('multer');
const upload = multer();
const ipfs = require('./ipfs');
const { getContract } = require('./fabric');
const eccrypto = require('eccrypto-js');
const { createSign, createHash, createPrivateKey, createPublicKey } = require('crypto');

const app = express();
const cors = require('cors');
const path = require('path');

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/backend', express.static(__dirname));

let issuerPublicKeyRaw = '';
try {
    const key = createPublicKey({
        key: Buffer.from(process.env.UNI_PUBLIC_KEY || '', 'hex'),
        format: 'der',
        type: 'spki'
    });
    const jwk = key.export({ format: 'jwk' });
    const x = Buffer.from(jwk.x, 'base64');
    const y = Buffer.from(jwk.y, 'base64');
    issuerPublicKeyRaw = Buffer.concat([Buffer.from([0x04]), x, y]).toString('hex');
    console.log("Issuer Public Key Loaded:", issuerPublicKeyRaw);
} catch (e) {
    console.warn("Could not load Issuer Public Key:", e.message);
}

/**
 * Signs the document hash using the University's private key.
 */
async function signHash(hashBuffer, privateKeyHex) {
    const privateKey = Buffer.from(privateKeyHex, 'hex');
    return eccrypto.sign(privateKey, hashBuffer);
}

/**
 * ISSUANCE ENDPOINT
 * 1. Hashes the PDF
 * 2. Signs the Hash
 * 3. Converts PDF to Base64 String
 * 4. Encrypts Base64 using Student's Public Key via eccrypto-js
 * 5. Pins to IPFS and records on Fabric
 */
app.post('/issue', upload.single('pdf'), async (req, res) => {
    let gateway, client;
    try {
        const { credentialID, studentPubKey, issuerPrivateKey, issuerName } = req.body;

        if (!req.file) throw new Error("PDF file missing.");
        if (!issuerPrivateKey) throw new Error("Issuer Private Key required for signing.");
        if (!issuerName) throw new Error("Issuer Name required.");

        const rawPdfBuffer = req.file.buffer;

        // 1. Digital Signature Logic
        const pdfHashBuffer = createHash('sha256').update(rawPdfBuffer).digest();
        const pdfHash = pdfHashBuffer.toString('hex');

        // Sign using the PROVIDED University Key
        const signatureBuffer = await signHash(pdfHashBuffer, issuerPrivateKey);
        const issuerSignature = signatureBuffer.toString('hex');

        // 2. Data Transformation (Nuclear Option: Base64)
        // This ensures no raw binary data is lost during JSON stringification
        const pdfBase64 = rawPdfBuffer.toString('base64');

        // 3. Encrypt using the student's Public Key
        // eccrypto-js expects a Buffer for the public key and the message
        const pubKeyBuf = Buffer.from(studentPubKey, 'hex');
        const encrypted = await eccrypto.encrypt(pubKeyBuf, Buffer.from(pdfBase64));

        // 4. Map the ECIES components to clean hex strings
        const encryptedPayload = {
            iv: encrypted.iv.toString('hex'),
            epk: encrypted.ephemPublicKey.toString('hex'),
            ct: encrypted.ciphertext.toString('hex'),
            mac: encrypted.mac.toString('hex')
        };

        // 5. Upload to IPFS
        console.log(`[SYSTEM REFORM]: Pinning encrypted Base64 payload for ${credentialID}`);
        const ipfsCid = await ipfs.uploadBuffer(encryptedPayload, `${credentialID}.json`);

        // 6. Blockchain Commitment
        const connection = await getContract();
        gateway = connection.gateway;
        client = connection.client;

        await connection.contract.submit('IssueCredential', {
            arguments: [credentialID, studentPubKey, pdfHash, issuerSignature, ipfsCid, issuerName]
        });

        res.json({
            success: true,
            credentialID,
            ipfsCid,
            status: "Credential Aligned & Issued"
        });

    } catch (err) {
        console.error('CRITICAL ISSUANCE FAILURE:', err);
        res.status(500).json({ error: String(err) });
    } finally {
        if (gateway) gateway.close();
        if (client) client.close();
    }
});

/**
 * REGISTRATION ENDPOINT (Module 2)
 * Registers a new University on the blockchain.
 * Returns generated Private Key (User must save this!).
 */
app.post('/register', async (req, res) => {
    let gateway, client;
    try {
        const { name, authCode } = req.body;
        if (!name) throw new Error("University Name required");
        if (authCode !== "PILLAR-SECURE-2026") throw new Error("Invalid Authorization Code. Payment required.");

        console.log(`[REGISTRY]: Registering new university: ${name}`);

        // Generate Key Pair
        const privateKey = eccrypto.generatePrivate();
        const publicKey = eccrypto.getPublic(privateKey);
        const pubKeyHex = publicKey.toString('hex');
        const privKeyHex = privateKey.toString('hex');

        // Register on Blockchain
        const connection = await getContract();
        gateway = connection.gateway;
        client = connection.client;

        await connection.contract.submit('RegisterUniversity', {
            arguments: [name, pubKeyHex]
        });

        res.json({
            success: true,
            universityName: name,
            publicKey: pubKeyHex,
            privateKey: privKeyHex,
            message: "University Registered. SAVE PRIVATE KEY SECURELY!"
        });

    } catch (err) {
        console.error("REGISTRATION ERROR:", err);
        const errorMsg = (err.details && err.details.length > 0) ? err.details[0].message : err.message;
        res.status(500).json({ error: errorMsg });
    } finally {
        if (gateway) gateway.close();
        if (client) client.close();
    }
});

/**
 * VERIFY ENDPOINT
 * Fetches the metadata record from the Fabric ledger.
 */
app.post('/verify', async (req, res) => {
    let gateway, client;
    try {
        const { credentialID } = req.body;
        const connection = await getContract();
        gateway = connection.gateway;
        client = connection.client;

        const resultBytes = await connection.contract.evaluate('QueryCredential', {
            arguments: [credentialID]
        });
        const record = JSON.parse(new TextDecoder().decode(resultBytes));

        // 2. Refresh Public Key from Chain (Using Issuer Name)
        const uniBytes = await connection.contract.evaluate('QueryUniversity', {
            arguments: [record.issuerName]
        });
        const uniRecord = JSON.parse(new TextDecoder().decode(uniBytes));

        res.json({ success: true, record, issuerPublicKey: uniRecord.publicKey });

    } catch (err) {
        console.error('QUERY FAILURE:', err);
        res.status(500).json({ error: "Blockchain query failed" });
    } finally {
        if (gateway) gateway.close();
        if (client) client.close();
    }
});

app.listen(3000, '0.0.0.0', () => {
    console.log('--- 🚀 NUCLEAR ALIGNMENT API: ACTIVE ON PORT 3000 🚀 ---');
});