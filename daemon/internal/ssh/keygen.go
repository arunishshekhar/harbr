package ssh

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

func GenerateUpdateKeyPair(dir string) (publicKey string, err error) {
	privPath := filepath.Join(dir, "harbr_update_id_ed25519")
	pubPath := filepath.Join(dir, "harbr_update_id_ed25519.pub")

	if _, err := os.Stat(privPath); err == nil {
		pub, err := os.ReadFile(pubPath)
		return string(pub), err
	}

	cmd := exec.Command("ssh-keygen",
		"-t", "ed25519",
		"-f", privPath,
		"-N", "",
		"-C", "harbr-update-engine",
	)
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("ssh-keygen failed: %w", err)
	}
	pub, err := os.ReadFile(pubPath)
	return string(pub), err
}

func InstallPublicKey(publicKey string) error {
	sshDir := "/root/.ssh"
	authKeys := filepath.Join(sshDir, "authorized_keys")
	os.MkdirAll(sshDir, 0700)

	entry := fmt.Sprintf(
		"command=\"/usr/local/bin/harbr-update-receiver\","+
			"no-port-forwarding,no-X11-forwarding,no-agent-forwarding %s\n", publicKey)

	f, err := os.OpenFile(authKeys, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = f.WriteString(entry)
	return err
}
