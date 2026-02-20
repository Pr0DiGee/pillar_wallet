# Local Fabric Test Network (instructions)

This directory contains instructions to bring up a local Fabric network for development and testing. The scaffold does not include the full crypto material or binaries; use the Fabric samples `test-network` to create the network and then use the scripts in `../scripts` to package/deploy chaincode.

Quick steps (summary):

1. Install prerequisites: Docker, Docker Compose, Node.js, Go, Fabric binaries (peer, orderer) and Fabric samples.
2. From `fabric-samples/test-network`: run `./network.sh up createChannel -ca` to bring up a test network.
3. Package and install this chaincode using the provided PowerShell helper `../scripts/packageChaincode.ps1`.
4. Use the Fabric `peer` CLI or fabric-sdk to approve and commit the chaincode.

See the official Hyperledger Fabric docs for full instructions: https://hyperledger-fabric.readthedocs.io/
