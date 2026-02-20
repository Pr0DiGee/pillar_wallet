/*
 * Register and enroll a user with the Fabric CA and store identity in the wallet
 * Usage: node registerUser.js <username>
 */
const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log('Usage: node registerUser.js <username>');
    process.exit(1);
  }
  const userId = args[0];

  const ccpPath = process.env.HLF_CONNECTION_PROFILE_FILE;
  if (!ccpPath) throw new Error('HLF_CONNECTION_PROFILE_FILE not set in .env');
  const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

  const caInfoKey = Object.keys(ccp.certificateAuthorities)[0];
  const caInfo = ccp.certificateAuthorities[caInfoKey];
  const caURL = caInfo.url;
  const ca = new FabricCAServices(caURL);

  const walletPath = process.env.FABRIC_WALLET_PATH || path.join(__dirname, 'wallet');
  const wallet = await Wallets.newFileSystemWallet(walletPath);

  // Check if user already exists
  const userIdentity = await wallet.get(userId);
  if (userIdentity) {
    console.log(`An identity for the user "${userId}" already exists in the wallet`);
    return;
  }

  // Check for admin identity to act as registrar
  const adminIdentity = await wallet.get('admin');
  if (!adminIdentity) {
    console.log('Admin identity not found in the wallet. Run enrollAdmin.js first.');
    return;
  }

  const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
  const adminUser = await provider.getUserContext(adminIdentity, 'admin');

  // Register the user, then enroll
  const secret = await ca.register({ affiliation: 'org1.department1', enrollmentID: userId, role: 'client' }, adminUser);
  const enrollment = await ca.enroll({ enrollmentID: userId, enrollmentSecret: secret });
  const x509Identity = {
    credentials: {
      certificate: enrollment.certificate,
      privateKey: enrollment.key.toBytes(),
    },
    mspId: process.env.FABRIC_MSP || 'Org1MSP',
    type: 'X.509',
  };
  await wallet.put(userId, x509Identity);
  console.log(`Successfully registered and enrolled user "${userId}" and imported into the wallet`);
}

main().catch((e) => {
  console.error('Error registering user:', e);
  process.exit(1);
});
