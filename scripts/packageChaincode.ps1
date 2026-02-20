Param(
    [string]$chaincodePath = "./chaincode",
    [string]$label = "certcc_1"
)

Write-Host "Packaging chaincode (PowerShell helper)"

# This script expects the Fabric peer binaries in PATH and a Fabric network running.
$pkg = "$env:TEMP\$label.tar.gz"
if (Test-Path $pkg) { Remove-Item $pkg -Force }

Write-Host "NOTE: This helper is a placeholder. Use 'peer lifecycle chaincode package' from Fabric CLI to package chaincode."
