const ecc = require('elliptic').ec('secp256k1');
const key = ecc.genKeyPair();

console.log('--- STUDENT IDENTITY GENERATED ---');
console.log('Public Key (Send to University):', key.getPublic('hex'));
console.log('Private Key (KEEP SECRET):', key.getPrivate('hex'));