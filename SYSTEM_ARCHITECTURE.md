# System Architecture: Blockchain-Based Verifiable Credential System

## 1. Executive Summary
This project implements a decentralized verifiable credential system using Hyperledger Fabric for the ledger, IPFS for encrypted data storage, and a modern web interface for users. It enables Universities to issue digitally signed certificates that Students can claim and Verifiers can validate instantly without needing manual verification from the institution.

---

## 2. Core Functional Parts

### 2.1 The Ledger Layer (Hyperledger Fabric)
The blockchain acts as the "Source of Truth" for all credential metadata.
- **Smart Contract (Go)**: A Chaincode-as-a-Service (CCaaS) implementation that manages the lifecycle of credentials.
- **University Registry**: Stores university names and their public keys. This allows the system to support multiple institutions; the correct public key for verification is automatically looked up on-chain during validation.
- **Credential Registry**: Stores immutable records containing:
    - **PDF Hash**: A SHA-256 fingerprint of the original document.
    - **Digital Signature**: The cryptographic seal created by the University.
    - **IPFS CID**: The pointer to the off-chain encrypted file.
    - **Issuer Metadata**: Links the credential to the specific issuing institution.

### 2.2 Integrated Storage Layer (IPFS via Pinata)
Off-chain storage to handle PDF heavy-lifting.
- **Zero-Trust Encryption**: Before a PDF is uploaded to IPFS, it is encrypted using **ECIES (Elliptic Curve Integrated Encryption Scheme)** with the student’s public key.
- **Privacy First**: Even though IPFS is public, the contents are unreadable to anyone except the student who holds the corresponding private key.
- **Ledger-Link**: The 46-character IPFS Content Identifier (CID) is the only "storage" piece that goes on the blockchain.

### 2.3 The Gateway Layer (Node.js/Express)
The middleware bridge between the web and the blockchain.
- **Fabric Gateway**: Manages secure gRPC connections to the blockchain peers using X.509 certificates.
- **Cryptography Engine**: Handles the heavy math for SHA-256 hashing and ECDSA signing.
- **API Endpoints**:
    - `/register`: Records new universities on-chain.
    - `/issue`: Orchestrates hashing, signing, encrypting, IPFS pinning, and ledger commitment.
    - `/verify`: Performs the multi-step lookup and cryptographic validation.
    - `/query`: Allows users to fetch their credential metadata.

### 2.4 Frontend Portals (Vanilla HTML/JS)
The project provides three distinct user experiences:
- **University Dashboard**: For issuing credentials (single or batch). Features automated key generation and institution registration.
- **Student Wallet**: A portal for students to generate their identities, submit their public keys to universities, and decrypt/download their issued certificates.
- **Verifier Portal**: A public tool for employers or institutions to upload a document and instantly verify its authenticity against the blockchain ledger.

---

## 3. Data Flow Architecture

### 3.1 Issuance Flow
1. **Hash**: The server calculates the unique SHA-256 hash of the uploaded PDF.
2. **Sign**: The server uses the University's Private Key to sign the hash.
3. **Encrypt**: The PDF content is base64 encoded and encrypted with the Student's Public Key.
4. **Pin**: The encrypted JSON envelope is uploaded to IPFS via Pinata.
5. **Commit**: All metadata is sent to the Fabric Smart Contract to be permanently recorded.

### 3.2 Verification & Decryption Flow
1. **Lookup**: The Verifier/Student provides a Credential ID.
2. **Retrieve**: The system fetches the `CredentialRecord` (Hash, Signature, CID, IssuerName) and the Issuer's Public Key from the blockchain.
3. **Signature Verification**: Validates that the signature on the ledger matches the PDF hash using the Issuer’s Public Key.
4. **Decryption (Student Only)**: The Student uses their Private Key to unlock the IPFS payload, converting the encrypted base64 back into a viewable PDF.

---

## 4. Security Implementation
- **ECDSA (Secp256k1)**: The same industry-standard curve used by Bitcoin/Ethereum is used here for signatures.
- **X.509 Certificates**: Identity within the Fabric network is managed via Certificate Authorities (CAs).
- **TLS (Transport Layer Security)**: All gRPC communications between the backend and blockchain nodes are encrypted.
- **CORS & Environment Isolation**: Strict control of API access and secure storage of sensitive credentials (like Pinata keys) in `.env` files.

---

## 5. Technology Stack
- **Blockchain**: Hyperledger Fabric v2.4 (Go CCaaS).
- **Backend**: Node.js, Express, Multer, Axios.
- **Frontend**: HTML5, Tailwind CSS, Buffer.js.
- **Cryptography**: eccrypto-js, crypto (Node-native).
- **Storage**: IPFS (Pinata API).
- **Deployment**: Docker, Bash scripting.
