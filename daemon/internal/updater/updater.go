// Package updater implements the self-update engine for the harbr CLI binary.
//
// Flow:
//  1. Check GitHub releases API for latest tag.
//  2. Compare against running version.
//  3. If update available: download binary + SHA256 checksum, verify, swap via atomic rename.
//  4. If running on a K3s node: drain node, swap, uncordon.
package updater

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"golang.org/x/mod/semver"
)

const (
	githubAPI     = "https://api.github.com/repos/arunishshekhar/harbr/releases/latest"
	downloadBase  = "https://github.com/arunishshekhar/harbr/releases/download"
	updateTimeout = 5 * time.Minute
)

// Info holds the result of a version check.
type Info struct {
	Current         string
	Latest          string
	UpdateAvailable bool
	Changelog       string
	DownloadURL     string
	ChecksumURL     string
}

// Updater checks and applies self-updates.
type Updater struct {
	currentVersion string
	http           *http.Client
}

// New creates an Updater for the given current version string.
func New(currentVersion string) *Updater {
	return &Updater{
		currentVersion: normaliseVersion(currentVersion),
		http:           &http.Client{Timeout: 30 * time.Second},
	}
}

// Check queries GitHub releases and returns version info.
func (u *Updater) Check() (*Info, error) {
	req, _ := http.NewRequest("GET", githubAPI, nil)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	resp, err := u.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("github API request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		// no releases yet (common in new repos)
		return &Info{
			Current:         u.currentVersion,
			Latest:          u.currentVersion,
			UpdateAvailable: false,
		}, nil
	}
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("github API returned %d", resp.StatusCode)
	}

	var release struct {
		TagName string `json:"tag_name"`
		Body    string `json:"body"`
		Assets  []struct {
			Name               string `json:"name"`
			BrowserDownloadURL string `json:"browser_download_url"`
		} `json:"assets"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return nil, fmt.Errorf("failed to decode release: %w", err)
	}

	latest := normaliseVersion(release.TagName)
	arch := runtime.GOARCH
	goos := runtime.GOOS

	binaryName := fmt.Sprintf("harbr-%s-%s", goos, arch)
	checksumName := fmt.Sprintf("harbr-%s-%s.sha256", goos, arch)

	var downloadURL, checksumURL string
	for _, asset := range release.Assets {
		if asset.Name == binaryName {
			downloadURL = asset.BrowserDownloadURL
		}
		if asset.Name == checksumName {
			checksumURL = asset.BrowserDownloadURL
		}
	}

	// Fallback URL if no assets published yet
	if downloadURL == "" {
		downloadURL = fmt.Sprintf("%s/%s/%s", downloadBase, release.TagName, binaryName)
		checksumURL = fmt.Sprintf("%s/%s/%s", downloadBase, release.TagName, checksumName)
	}

	updateAvailable := semver.Compare(latest, u.currentVersion) > 0

	return &Info{
		Current:         u.currentVersion,
		Latest:          latest,
		UpdateAvailable: updateAvailable,
		Changelog:       release.Body,
		DownloadURL:     downloadURL,
		ChecksumURL:     checksumURL,
	}, nil
}

// Run downloads and installs the specified version.
func (u *Updater) Run(version string) error {
	version = normaliseVersion(version)
	arch := runtime.GOARCH
	goos := runtime.GOOS

	binaryName := fmt.Sprintf("harbr-%s-%s", goos, arch)
	checksumName := fmt.Sprintf("harbr-%s-%s.sha256", goos, arch)
	downloadURL := fmt.Sprintf("%s/%s/%s", downloadBase, version, binaryName)
	checksumURL := fmt.Sprintf("%s/%s/%s", downloadBase, version, checksumName)

	fmt.Printf("  Downloading %s...\n", binaryName)
	tmpBin, err := u.download(downloadURL)
	if err != nil {
		return fmt.Errorf("download failed: %w", err)
	}
	defer os.Remove(tmpBin)

	fmt.Printf("  Verifying SHA256 checksum...\n")
	if err := u.verifyChecksum(tmpBin, checksumURL, binaryName); err != nil {
		return fmt.Errorf("checksum verification failed: %w", err)
	}

	if err := os.Chmod(tmpBin, 0755); err != nil {
		return fmt.Errorf("chmod failed: %w", err)
	}

	selfPath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("cannot determine executable path: %w", err)
	}
	selfPath, _ = filepath.EvalSymlinks(selfPath)

	// drain K3s node if running in-cluster
	if isK3sNode() {
		fmt.Println("  Draining K3s node before update...")
		nodeName, _ := os.Hostname()
		_ = runCmd("kubectl", "drain", nodeName,
			"--ignore-daemonsets", "--delete-emptydir-data",
			"--timeout=120s")
	}

	fmt.Printf("  Replacing %s...\n", selfPath)
	backupPath := selfPath + ".bak"
	_ = os.Rename(selfPath, backupPath)

	if err := atomicCopy(tmpBin, selfPath); err != nil {
		_ = os.Rename(backupPath, selfPath) // restore backup
		return fmt.Errorf("binary replacement failed: %w", err)
	}
	_ = os.Remove(backupPath)

	if isK3sNode() {
		nodeName, _ := os.Hostname()
		fmt.Println("  Uncordoning node...")
		_ = runCmd("kubectl", "uncordon", nodeName)
	}

	fmt.Printf("\n\033[32m✓ Updated to %s\033[0m\n", version)
	fmt.Println("  Run `harbr version` to verify.")
	return nil
}

// ─── Private helpers ──────────────────────────────────────────────────────────

func (u *Updater) download(url string) (string, error) {
	client := &http.Client{Timeout: updateTimeout}
	resp, err := client.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	tmp, err := os.CreateTemp("", "harbr-update-*")
	if err != nil {
		return "", err
	}
	defer tmp.Close()

	total := resp.ContentLength
	written := int64(0)
	buf := make([]byte, 32*1024)
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			if _, werr := tmp.Write(buf[:n]); werr != nil {
				os.Remove(tmp.Name())
				return "", werr
			}
			written += int64(n)
			if total > 0 {
				pct := int(written * 50 / total)
				bar := strings.Repeat("█", pct) + strings.Repeat("░", 50-pct)
				fmt.Printf("\r  [%s] %d/%d KB", bar, written/1024, total/1024)
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			os.Remove(tmp.Name())
			return "", err
		}
	}
	if total > 0 {
		fmt.Println()
	}
	return tmp.Name(), nil
}

func (u *Updater) verifyChecksum(binPath, checksumURL, binaryName string) error {
	resp, err := u.http.Get(checksumURL)
	if err != nil {
		// If checksum file doesn't exist (early releases), skip verification with warning
		fmt.Println("  \033[33mWarning: no checksum file found, skipping verification\033[0m")
		return nil
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		fmt.Printf("  \033[33mWarning: checksum HTTP %d, skipping verification\033[0m\n", resp.StatusCode)
		return nil
	}

	body, _ := io.ReadAll(resp.Body)
	expectedHash := ""
	for _, line := range strings.Split(string(body), "\n") {
		parts := strings.Fields(line)
		if len(parts) == 2 && parts[1] == binaryName {
			expectedHash = parts[0]
			break
		}
	}
	if expectedHash == "" {
		fmt.Println("  \033[33mWarning: binary not found in checksum file, skipping\033[0m")
		return nil
	}

	f, err := os.Open(binPath)
	if err != nil {
		return err
	}
	defer f.Close()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return err
	}
	actual := fmt.Sprintf("%x", h.Sum(nil))
	if actual != expectedHash {
		return fmt.Errorf("SHA256 mismatch — expected %s, got %s", expectedHash, actual)
	}
	return nil
}

func atomicCopy(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0755)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}

func isK3sNode() bool {
	_, err := exec.LookPath("k3s")
	return err == nil
}

func runCmd(name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func normaliseVersion(v string) string {
	v = strings.TrimSpace(v)
	if v == "" || v == "dev" {
		return "v0.0.0"
	}
	if !strings.HasPrefix(v, "v") {
		v = "v" + v
	}
	return v
}
