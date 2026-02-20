
const crypto = require('crypto');
const eccrypto = require('eccrypto-js');
require('dotenv').config();

const uniPubKeyDER = process.env.UNI_PUBLIC_KEY;
console.log("DER Public Key:", uniPubKeyDER);

// Try to convert to Raw
try {
    const key = crypto.createPublicKey({
        key: Buffer.from(uniPubKeyDER, 'hex'),
        format: 'der',
        type: 'spki'
    });

    // To get raw bytes, we can export as JWK and convert x/y?
    const jwk = key.export({ format: 'jwk' });
    console.log("JWK:", jwk);

    // Construct Raw 04 + X + Y
    const x = Buffer.from(jwk.x, 'base64');
    const y = Buffer.from(jwk.y, 'base64');
    const raw = Buffer.concat([Buffer.from([0x04]), x, y]);
    console.log("Raw Public Key (Hex):", raw.toString('hex'));

} catch (e) {
    console.error("Error parsing key:", e);
}
