#!/usr/bin/env bash
set -euo pipefail

# Deploy chaincode located in PROJECT-MAIN/chaincode to the fabric-samples test-network
# Usage: ./deploy_chaincode.sh
# This script assumes the repository layout:
#  ../fabric-samples/test-network  (sibling to PROJECT-MAIN)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_MAIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_NETWORK_DIR="$(cd "$PROJECT_MAIN_DIR/.." && pwd)/fabric-samples/test-network"

if [ ! -d "$TEST_NETWORK_DIR" ]; then
  echo "Cannot find test-network at $TEST_NETWORK_DIR"
  exit 1
fi

CHAINCODE_PATH="$PROJECT_MAIN_DIR/chaincode"
cat > "$TMP_CHAINCODE_DIR/go.mod" <<'EOF'
module github.com/fabric-cert/chaincode

go 1.20

require (
  github.com/hyperledger/fabric-chaincode-go v0.0.0-20240704073638-9fb89180dc17
  github.com/hyperledger/fabric-protos-go v0.3.7
  google.golang.org/grpc v1.64.0
  google.golang.org/protobuf v1.28.0
)

replace google.golang.org/grpc => google.golang.org/grpc v1.64.0
replace google.golang.org/protobuf => google.golang.org/protobuf v1.28.0
EOF
# Create a sanitized temporary copy of the chaincode to avoid local go.mod modifications
TMP_CHAINCODE_DIR=$(mktemp -d /tmp/chaincode_sanitized.XXXX)
echo "Creating sanitized copy at $TMP_CHAINCODE_DIR"
cp -R "$CHAINCODE_PATH/"* "$TMP_CHAINCODE_DIR/"
# sanitize go.mod if present: set go 1.20 and remove any 'toolchain' directive
if [ -f "$TMP_CHAINCODE_DIR/go.mod" ]; then
  awk 'BEGIN{printed=0} /^go[ \t]+/ { print "go 1.20"; printed=1; next } /^toolchain/ { next } { print } END{ if(!printed) print "go 1.20" }' "$TMP_CHAINCODE_DIR/go.mod" > "$TMP_CHAINCODE_DIR/go.mod.sanitized" && mv "$TMP_CHAINCODE_DIR/go.mod.sanitized" "$TMP_CHAINCODE_DIR/go.mod"
fi

# Remove any vendored deps to force the cc builder to use modules (GOPROXY)
if [ -d "$TMP_CHAINCODE_DIR/vendor" ]; then
  echo "Removing vendored deps from sanitized copy to avoid incompatible vendor tree"
  rm -rf "$TMP_CHAINCODE_DIR/vendor"
fi

# Force a minimal go.mod that is compatible with the peer builder (go 1.20)
# Avoid running 'go mod tidy' which may inject newer 'go' or 'toolchain' directives.
FORCED_GO_MOD_CONTENT="module github.com/fabric-cert/chaincode

go 1.20

require (
  github.com/hyperledger/fabric-chaincode-go v0.0.0-20240704073638-9fb89180dc17
  github.com/hyperledger/fabric-protos-go v0.3.7
  google.golang.org/grpc v1.64.0
  google.golang.org/protobuf v1.28.0
)

replace google.golang.org/grpc => google.golang.org/grpc v1.64.0
replace google.golang.org/protobuf => google.golang.org/protobuf v1.28.0
echo "Wrote forced go.mod into sanitized copy to ensure builder compatibility"

# Use dockerized Go 1.20 to run 'go mod tidy' and produce go.sum (and vendor if needed)
if command -v docker >/dev/null 2>&1; then
  echo "Running 'go mod tidy' inside golang:1.20 container to generate go.sum"
  docker run --rm -v "$TMP_CHAINCODE_DIR":/src -w /src golang:1.20 sh -c "go env && go mod tidy && go mod vendor || true"
else
  echo "Warning: docker not found. The test-network will attempt to vendor and may fail. Install Docker or run 'go mod tidy' with Go 1.20 locally."
fi

# Use the sanitized dir for packaging
SANITIZED_PATH="$TMP_CHAINCODE_DIR"
if [ ! -d "$CHAINCODE_PATH" ]; then
  echo "Cannot find chaincode folder at $CHAINCODE_PATH"
  exit 1
fi

echo "Using test-network: $TEST_NETWORK_DIR"
echo "Using chaincode path: $CHAINCODE_PATH"

pushd "$TEST_NETWORK_DIR" > /dev/null

echo "Packaging and deploying chaincode 'basic' on channel 'mychannel' (language: go)"
./network.sh deployCC -c mychannel -ccn basic -ccp "$SANITIZED_PATH" -ccl go

# cleanup temp dir
echo "Cleaning up $TMP_CHAINCODE_DIR"
rm -rf "$TMP_CHAINCODE_DIR"

popd > /dev/null

echo "Done."
