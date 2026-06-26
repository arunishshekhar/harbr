package ssh

import (
	"os"
	"path/filepath"
	"testing"
)

func TestGenerateUpdateKeyPair(t *testing.T) {
	dir := t.TempDir()
	key, err := GenerateUpdateKeyPair(dir)
	if err != nil {
		t.Fatalf("GenerateUpdateKeyPair failed: %v", err)
	}
	if key == "" {
		t.Error("expected non-empty public key")
	}
	privPath := filepath.Join(dir, "harbr_update_id_ed25519")
	if _, err := os.Stat(privPath); os.IsNotExist(err) {
		t.Error("expected private key file to exist")
	}
}

func TestGenerateUpdateKeyPair_Idempotent(t *testing.T) {
	dir := t.TempDir()
	key1, _ := GenerateUpdateKeyPair(dir)
	key2, err := GenerateUpdateKeyPair(dir)
	if err != nil {
		t.Fatalf("second call failed: %v", err)
	}
	if key1 != key2 {
		t.Error("expected same public key on second call")
	}
}
