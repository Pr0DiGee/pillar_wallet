#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_MAIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_NETWORK_DIR="$(cd "$PROJECT_MAIN_DIR/.." && pwd)/fabric-samples/test-network"

if [ ! -d "$TEST_NETWORK_DIR" ]; then
  echo "Cannot find test-network at $TEST_NETWORK_DIR"
  exit 1
fi

CHAINCODE_PATH="$PROJECT_MAIN_DIR/chaincode"

pushd "$TEST_NETWORK_DIR" > /dev/null
export CCAAS_DOCKER_RUN=false
./network.sh deployCCAAS -c mychannel -ccn basic -ccp "$CHAINCODE_PATH"
popd > /dev/null
