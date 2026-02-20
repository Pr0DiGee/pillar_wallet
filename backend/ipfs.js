require('dotenv').config();
const axios = require('axios');

/**
 * Uploads an encrypted JSON object to IPFS via Pinata.
 * @param {Object} dataObject - The ECIES encrypted data as a hex-string object.
 * @param {string} fileName - Metadata name.
 * @returns {Promise<string>} - IPFS Hash (CID).
 */
async function uploadBuffer(dataObject, fileName = 'credential.json') {
  const PINATA_API_KEY = process.env.PINATA_API_KEY;
  const PINATA_SECRET = process.env.PINATA_SECRET;

  if (!PINATA_API_KEY || !PINATA_SECRET) {
    throw new Error('SYSTEM ERROR: Pinata credentials missing in .env');
  }

  // Use the pinJSONToIPFS endpoint to keep the object structure
  const url = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';

  const body = {
    pinataContent: dataObject,
    pinataMetadata: { name: fileName }
  };

  try {
    const resp = await axios.post(url, body, {
      headers: {
        'Content-Type': 'application/json',
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET,
      }
    });

    if (resp.data && resp.data.IpfsHash) {
      console.log(`#### IPFS UPLOAD SUCCESS: ${resp.data.IpfsHash} ####`);
      return resp.data.IpfsHash;
    }
    throw new Error("No CID returned from Pinata");
  } catch (error) {
    const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
    throw new Error('PINATA STORAGE ERROR: ' + errorMsg);
  }
}

module.exports = { uploadBuffer };