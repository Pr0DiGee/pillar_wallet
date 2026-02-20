package main

import (
    "encoding/json"
    "testing"
    "time"
)

// Basic helper tests for marshal/unmarshal and timestamp
func TestCredentialRecordMarshal(t *testing.T) {
    rec := CredentialRecord{
        CredentialID:  "id-123",
        IssuerMSP:     "UniMSP",
        StudentPubKey: "studentPub",
        PDFHash:       "abc",
        Status:        StatusActive,
        Timestamp:     time.Now().UTC().Format(time.RFC3339),
    }
    b, err := json.Marshal(rec)
    if err != nil {
        t.Fatalf("marshal failed: %v", err)
    }
    var out CredentialRecord
    if err := json.Unmarshal(b, &out); err != nil {
        t.Fatalf("unmarshal failed: %v", err)
    }
    if out.CredentialID != rec.CredentialID {
        t.Fatalf("mismatch id")
    }
}
