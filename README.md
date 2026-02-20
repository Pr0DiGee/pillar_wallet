# University Certificate Verification (Hyperledger Fabric)

This repository contains a reference implementation for "Secure Verification of University Certificates Using Hyperledger Fabric".

Structure:
- `chaincode/` - Go chaincode implementing credential lifecycle
- `backend/` - Node.js (Express) backend acting as a trusted gateway
- `frontend/` - Lightweight student wallet demo (WebCrypto) and verifier demo
- `network/` - Instructions and helper scripts to bring up a Fabric test network
- `scripts/` - Packaging and deployment helper scripts (PowerShell)

See `network/README.md` to bootstrap a local Fabric network (requires Fabric samples and binaries).

Recommended defaults used for this scaffold:
- Chaincode: Go
- Backend: Node.js (Express)
- Fabric: 2.4 (Raft ordering)
- ECC: P-256
- IPFS pinning: Pinata
