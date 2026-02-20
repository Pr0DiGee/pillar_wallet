package main

import (
    "encoding/json"
    "fmt"
    "os"
    "time"

    "github.com/hyperledger/fabric-chaincode-go/pkg/cid"
    "github.com/hyperledger/fabric-chaincode-go/shim"
    sc "github.com/hyperledger/fabric-protos-go/peer"
)

const (
    StatusActive = "ACTIVE"
)

type CredentialRecord struct {
    CredentialID    string `json:"credentialID"`
    IssuerName      string `json:"issuerName"`
    IssuerMSP       string `json:"issuerMSP"`
    StudentPubKey   string `json:"studentPubKey"`
    PDFHash         string `json:"pdfHash"`
    IssuerSignature string `json:"issuerSignature"`
    IPFSCID         string `json:"ipfsCID"`
    Status          string `json:"status"`
    Timestamp       string `json:"timestamp"`
}

type UniversityRecord struct {
    UniversityName string `json:"universityName"`
    PublicKey      string `json:"publicKey"`
    MSP            string `json:"msp"`
}

type SimpleChaincode struct{}

func (s *SimpleChaincode) Invoke(stub shim.ChaincodeStubInterface) sc.Response {
    fn, args := stub.GetFunctionAndParameters()
    switch fn {
    case "RegisterUniversity":
        return s.RegisterUniversity(stub, args)
    case "IssueCredential":
        return s.IssueCredential(stub, args)
    case "QueryCredential":
        return s.QueryCredential(stub, args)
    case "QueryUniversity":
        return s.QueryUniversity(stub, args)
    default:
        return shim.Error("unsupported function")
    }
}

func (s *SimpleChaincode) Init(stub shim.ChaincodeStubInterface) sc.Response {
    return shim.Success(nil)
}

func (s *SimpleChaincode) QueryUniversity(stub shim.ChaincodeStubInterface, args []string) sc.Response {
    if len(args) != 1 {
        return shim.Error("QueryUniversity requires 1 argument: Name")
    }
    key := "UNI_" + args[0]
    value, err := stub.GetState(key)
    if err != nil {
        return shim.Error("Failed to get state")
    }
    if value == nil {
        return shim.Error("University not found")
    }
    return shim.Success(value)
}

func (s *SimpleChaincode) IssueCredential(stub shim.ChaincodeStubInterface, args []string) sc.Response {
    if len(args) != 6 {
        return shim.Error("IssueCredential requires 6 arguments: ID, StudentPub, PDFHash, Signature, CID, IssuerName")
    }

    credentialID := args[0]
    fmt.Printf("#### Reforming Record: %s ####\n", credentialID)

    // Capture system metadata automatically
    id, _ := cid.New(stub)
    mspID, _ := id.GetMSPID()
    txTimestamp, _ := stub.GetTxTimestamp()
    timestamp := time.Unix(txTimestamp.Seconds, int64(txTimestamp.Nanos)).UTC().Format(time.RFC3339)

    rec := CredentialRecord{
        CredentialID:    credentialID,
        IssuerName:      args[5],
        IssuerMSP:       mspID,
        StudentPubKey:   args[1],
        PDFHash:         args[2],
        IssuerSignature: args[3], // The University's cryptographic seal
        IPFSCID:         args[4],
        Status:          StatusActive,
        Timestamp:       timestamp,
    }

    b, _ := json.Marshal(rec)
    stub.PutState(credentialID, b)

    return shim.Success(nil)
}

func (s *SimpleChaincode) QueryCredential(stub shim.ChaincodeStubInterface, args []string) sc.Response {
    if len(args) != 1 { return shim.Error("QueryCredential requires 1 argument") }
    b, _ := stub.GetState(args[0])
    if b == nil { return shim.Error("credential not found") }
    return shim.Success(b)
}

func (s *SimpleChaincode) RegisterUniversity(stub shim.ChaincodeStubInterface, args []string) sc.Response {
    if len(args) != 2 {
        return shim.Error("RegisterUniversity requires 2 arguments: Name, PublicKey")
    }

    name := args[0]
    pubKey := args[1]
    
    // Key format: "UNI_" + name
    key := "UNI_" + name

    existing, _ := stub.GetState(key)
    if existing != nil {
        return shim.Error("University already registered")
    }
    
    id, _ := cid.New(stub)
    mspID, _ := id.GetMSPID()

    uni := UniversityRecord{
        UniversityName: name,
        PublicKey:      pubKey,
        MSP:            mspID,
    }

    b, _ := json.Marshal(uni)
    stub.PutState(key, b)

    return shim.Success(nil)
}

func main() {
    server := &shim.ChaincodeServer{
        CCID:     os.Getenv("CHAINCODE_ID"),
        Address:  os.Getenv("CHAINCODE_SERVER_ADDRESS"),
        CC:       new(SimpleChaincode),
        TLSProps: shim.TLSProperties{Disabled: true},
    }
    if err := server.Start(); err != nil {
        fmt.Printf("Error starting CCaaS: %s", err)
    }
}