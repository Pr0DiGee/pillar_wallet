/*
 * Enroll the CA admin and import the identity into the wallet directory
 * Usage: node enrollAdmin.js
 */
const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

async function main() {
  const ccpPath = process.env.HLF_CONNECTION_PROFILE_FILE;
  if (!ccpPath) throw new Error('HLF_CONNECTION_PROFILE_FILE not set in .env');
  const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

  const caInfoKey = Object.keys(ccp.certificateAuthorities)[0];
  const caInfo = ccp.certificateAuthorities[caInfoKey];
  const caURL = caInfo.url;
  const ca = new FabricCAServices(caURL);

  const walletPath = process.env.FABRIC_WALLET_PATH || path.join(__dirname, 'wallet');
  const wallet = await Wallets.newFileSystemWallet(walletPath);

  const adminId = process.env.CA_ADMIN || 'admin';
  const adminPW = process.env.CA_ADMIN_PASSWORD || 'adminpw';
  const mspId = process.env.FABRIC_MSP || 'Org1MSP';

  const identity = await wallet.get('admin');
  if (identity) {
    console.log('An identity for the admin user "admin" already exists in the wallet');
    return;
  }

  // Enroll the admin user, and import the new identity into the wallet.
  const enrollment = await ca.enroll({ enrollmentID: adminId, enrollmentSecret: adminPW });
  const x509Identity = {
    credentials: {
      certificate: enrollment.certificate,
      privateKey: enrollment.key.toBytes(),
    },
    mspId: mspId,
    type: 'X.509',
  };
  await wallet.put('admin', x509Identity);
  console.log('Successfully enrolled admin user "admin" and imported it into the wallet');
}

main().catch((e) => {
  console.error('Error enrolling admin:', e);
  process.exit(1);
});
