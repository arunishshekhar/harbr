package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"text/tabwriter"
	"time"

	"github.com/arunishshekhar/harbr/internal/tui"
	"github.com/arunishshekhar/harbr/internal/updater"
)

var Version = "dev"

// ─── API client ──────────────────────────────────────────────────────────────

type client struct {
	base  string
	token string
	http  *http.Client
}

type cliConfig struct {
	APIBase string `json:"api_base"`
	Token   string `json:"token"`
}

func loadCLIConfig() cliConfig {
	cfg := cliConfig{APIBase: "http://localhost:3001"}
	home, _ := os.UserHomeDir()
	data, err := os.ReadFile(filepath.Join(home, ".harbr", "config.json"))
	if err == nil {
		_ = json.Unmarshal(data, &cfg)
	}
	if e := os.Getenv("HARBR_API"); e != "" {
		cfg.APIBase = e
	}
	if t := os.Getenv("HARBR_TOKEN"); t != "" {
		cfg.Token = t
	}
	return cfg
}

func saveCLIConfig(cfg cliConfig) {
	home, _ := os.UserHomeDir()
	dir := filepath.Join(home, ".harbr")
	_ = os.MkdirAll(dir, 0700)
	data, _ := json.MarshalIndent(cfg, "", "  ")
	_ = os.WriteFile(filepath.Join(dir, "config.json"), data, 0600)
}

func newClient() *client {
	cfg := loadCLIConfig()
	return &client{
		base:  strings.TrimRight(cfg.APIBase, "/"),
		token: cfg.Token,
		http:  &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *client) req(method, path string, body any) (*http.Response, error) {
	var r io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		r = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, c.base+"/api/v1"+path, r)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	return c.http.Do(req)
}

func (c *client) get(path string) (map[string]any, error) {
	resp, err := c.req("GET", path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error %d: %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}
	var out map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&out)
	return out, nil
}

func (c *client) getSlice(path string) ([]any, error) {
	resp, err := c.req("GET", path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error %d: %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}
	var out []any
	_ = json.NewDecoder(resp.Body).Decode(&out)
	return out, nil
}

func (c *client) post(path string, body any) (map[string]any, error) {
	resp, err := c.req("POST", path, body)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error %d: %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}
	var out map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&out)
	return out, nil
}

func (c *client) patch(path string, body any) (map[string]any, error) {
	resp, err := c.req("PATCH", path, body)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error %d: %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}
	var out map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&out)
	return out, nil
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func fatal(msg string, args ...any) {
	fmt.Fprintf(os.Stderr, "Error: "+msg+"\n", args...)
	os.Exit(1)
}

func str(v any) string {
	if v == nil {
		return "—"
	}
	return fmt.Sprintf("%v", v)
}

func findProject(c *client, nameOrID string) map[string]any {
	projects, err := c.getSlice("/projects")
	if err != nil {
		fatal("cannot list projects: %v", err)
	}
	for _, p := range projects {
		proj := p.(map[string]any)
		if proj["name"] == nameOrID || proj["id"] == nameOrID {
			return proj
		}
	}
	fatal("project %q not found", nameOrID)
	return nil
}

// ─── Commands ────────────────────────────────────────────────────────────────

func cmdLogin(args []string) {
	fs := flag.NewFlagSet("login", flag.ExitOnError)
	api := fs.String("api", "http://localhost:3001", "API base URL")
	_ = fs.Parse(args)

	fmt.Print("Username: ")
	var user string
	fmt.Scanln(&user)

	fmt.Print("Password: ")
	var pass string
	fmt.Scanln(&pass)

	c := &client{base: strings.TrimRight(*api, "/"), http: &http.Client{Timeout: 15 * time.Second}}
	resp, err := c.post("/auth/login", map[string]string{"username": user, "password": pass})
	if err != nil {
		fatal("login failed: %v", err)
	}
	token, _ := resp["token"].(string)
	if token == "" {
		fatal("no token in response")
	}
	cfg := loadCLIConfig()
	cfg.APIBase = *api
	cfg.Token = token
	saveCLIConfig(cfg)
	fmt.Println("✓ Logged in successfully")
}

func cmdPS(args []string) {
	c := newClient()
	projects, err := c.getSlice("/projects")
	if err != nil {
		fatal("%v", err)
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "PROJECT\tSTATUS\tDOMAIN\tNODE\tIMAGE TAG")
	fmt.Fprintln(w, "-------\t------\t------\t----\t---------")
	for _, p := range projects {
		proj := p.(map[string]any)
		status := str(proj["project_status"])
		color := ""
		reset := ""
		if status == "running" {
			color = "\033[32m"; reset = "\033[0m"
		} else if status == "failed" || status == "crashloop" {
			color = "\033[31m"; reset = "\033[0m"
		} else if status == "building" || status == "deploying" {
			color = "\033[33m"; reset = "\033[0m"
		}
		fmt.Fprintf(w, "%s\t%s%s%s\t%s\t%s\t%s\n",
			str(proj["name"]),
			color, status, reset,
			str(proj["domain"]),
			str(proj["node_selector"]),
			str(proj["current_image_tag"]),
		)
	}
	w.Flush()
}

func cmdStatus(args []string) {
	c := newClient()

	nodes, _ := c.getSlice("/nodes")
	projects, _ := c.getSlice("/projects")
	hw, _ := c.get("/hardware")

	fmt.Printf("\033[1mHARBR STATUS\033[0m\n\n")

	// Nodes
	fmt.Println("NODES")
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	for _, n := range nodes {
		node := n.(map[string]any)
		nodeID := str(node["id"])
		snap := map[string]any{}
		if hw != nil {
			if s, ok := hw[nodeID].(map[string]any); ok {
				snap = s
			}
		}
		cpu := 0.0
		if v, ok := snap["cpu_pct"].(float64); ok {
			cpu = v
		}
		mem := 0.0
		if v, ok := snap["mem_pct"].(float64); ok {
			mem = v
		}
		status := str(node["status"])
		dot := "●"
		if status != "online" {
			dot = "○"
		}
		fmt.Fprintf(w, "  %s %s\t(%s)\tCPU %.0f%%\tRAM %.0f%%\t%s\n",
			dot, str(node["name"]), str(node["role"]), cpu, mem, str(node["tailscale_ip"]))
	}
	w.Flush()

	// Projects summary
	running, building, failed := 0, 0, 0
	for _, p := range projects {
		switch p.(map[string]any)["project_status"] {
		case "running":
			running++
		case "building", "deploying":
			building++
		case "failed", "crashloop":
			failed++
		}
	}
	fmt.Printf("\nPROJECTS\n  %d running  %d building  %d failed\n", running, building, failed)
}

func cmdNodes(args []string) {
	c := newClient()
	nodes, err := c.getSlice("/nodes")
	if err != nil {
		fatal("%v", err)
	}
	hw, _ := c.get("/hardware")

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "NODE\tROLE\tSTATUS\tTAILSCALE IP\tCPU\tRAM\tTEMP")
	fmt.Fprintln(w, "----\t----\t------\t------------\t---\t---\t----")
	for _, n := range nodes {
		node := n.(map[string]any)
		nodeID := str(node["id"])
		snap := map[string]any{}
		if hw != nil {
			if s, ok := hw[nodeID].(map[string]any); ok {
				snap = s
			}
		}
		cpu, mem, temp := "—", "—", "—"
		if v, ok := snap["cpu_pct"].(float64); ok {
			cpu = fmt.Sprintf("%.0f%%", v)
		}
		if v, ok := snap["mem_pct"].(float64); ok {
			mem = fmt.Sprintf("%.0f%%", v)
		}
		if v, ok := snap["temp_c"].(float64); ok {
			temp = fmt.Sprintf("%.0f°C", v)
		}
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\t%s\t%s\n",
			str(node["name"]), str(node["role"]), str(node["status"]),
			str(node["tailscale_ip"]), cpu, mem, temp)
	}
	w.Flush()
}

func cmdDeploy(args []string) {
	if len(args) < 1 {
		fatal("usage: harbr deploy <project>")
	}
	c := newClient()
	proj := findProject(c, args[0])
	projectID := str(proj["id"])

	result, err := c.post("/projects/"+projectID+"/deploy", nil)
	if err != nil {
		fatal("deploy failed: %v", err)
	}
	fmt.Printf("✓ Deploy triggered for \033[1m%s\033[0m\n", str(proj["name"]))
	if jobID, ok := result["jobId"]; ok {
		fmt.Printf("  Job ID: %v\n", jobID)
	}
}

func cmdRollback(args []string) {
	fs := flag.NewFlagSet("rollback", flag.ExitOnError)
	toTag := fs.String("to", "", "specific image tag to roll back to")
	_ = fs.Parse(args)
	if fs.NArg() < 1 {
		fatal("usage: harbr rollback <project> [--to <tag>]")
	}
	c := newClient()
	proj := findProject(c, fs.Arg(0))
	projectID := str(proj["id"])

	body := map[string]any{}
	if *toTag != "" {
		body["imageTag"] = *toTag
	}
	result, err := c.post("/projects/"+projectID+"/rollback", body)
	if err != nil {
		fatal("rollback failed: %v", err)
	}
	fmt.Printf("✓ Rollback triggered for \033[1m%s\033[0m\n", str(proj["name"]))
	if jobID, ok := result["jobId"]; ok {
		fmt.Printf("  Job ID: %v\n", jobID)
	}
}

func cmdLogs(args []string) {
	fs := flag.NewFlagSet("logs", flag.ExitOnError)
	since := fs.String("since", "", "show logs since duration (e.g. 1h, 30m)")
	build := fs.Bool("build", false, "show last build log instead of live logs")
	_ = fs.Parse(args)
	if fs.NArg() < 1 {
		fatal("usage: harbr logs <project> [--since 1h] [--build]")
	}

	c := newClient()
	proj := findProject(c, fs.Arg(0))
	projectID := str(proj["id"])

	if *build {
		// fetch last build log
		builds, err := c.getSlice("/projects/" + projectID + "/builds")
		if err != nil {
			fatal("%v", err)
		}
		if len(builds) == 0 {
			fatal("no builds found for project %s", fs.Arg(0))
		}
		last := builds[0].(map[string]any)
		log := str(last["log"])
		if log == "" || log == "—" {
			fmt.Printf("Build ID: %s\nStatus:   %s\n(no log content)\n", str(last["id"]), str(last["status"]))
		} else {
			fmt.Print(log)
		}
		return
	}

	// SSE stream via plain HTTP
	path := "/logs/" + projectID
	if *since != "" {
		path += "?since=" + *since
	}

	cfg := loadCLIConfig()
	url := strings.TrimRight(cfg.APIBase, "/") + "/api/v1" + path
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Accept", "text/event-stream")
	if cfg.Token != "" {
		req.Header.Set("Authorization", "Bearer "+cfg.Token)
	}

	resp, err := (&http.Client{Timeout: 0}).Do(req)
	if err != nil {
		fatal("cannot connect to log stream: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		fatal("log stream error %d: %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}

	fmt.Printf("\033[2m[Streaming logs for %s — Ctrl+C to stop]\033[0m\n", str(proj["name"]))
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "data: ") {
			line = strings.TrimPrefix(line, "data: ")
			// colour-code by level
			switch {
			case strings.Contains(line, "ERROR") || strings.Contains(line, "error"):
				fmt.Printf("\033[31m%s\033[0m\n", line)
			case strings.Contains(line, "WARN") || strings.Contains(line, "warn"):
				fmt.Printf("\033[33m%s\033[0m\n", line)
			default:
				fmt.Println(line)
			}
		}
	}
}

func cmdExec(args []string) {
	// split on "--"
	project := ""
	command := []string{"bash"}
	for i, a := range args {
		if a == "--" {
			command = args[i+1:]
			break
		}
		if i == 0 {
			project = a
		}
	}
	if project == "" {
		fatal("usage: harbr exec <project> [-- command]")
	}

	c := newClient()
	proj := findProject(c, project)
	ns := str(proj["namespace"])
	name := str(proj["name"])

	// use kubectl exec — reads KUBECONFIG from env
	execArgs := []string{"exec", "-it",
		"-n", ns,
		"deployment/" + name,
		"--",
	}
	execArgs = append(execArgs, command...)

	cmd := exec.Command("kubectl", execArgs...)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		os.Exit(1)
	}
}

func cmdEnv(args []string) {
	if len(args) < 2 {
		fatal("usage: harbr env <list|set|delete> <project> [KEY=VALUE]")
	}
	action := args[0]
	c := newClient()
	proj := findProject(c, args[1])
	projectID := str(proj["id"])

	switch action {
	case "list":
		p, err := c.get("/projects/" + projectID)
		if err != nil {
			fatal("%v", err)
		}
		envVars, _ := p["env_vars"].(map[string]any)
		if len(envVars) == 0 {
			fmt.Println("(no environment variables set)")
			return
		}
		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		for k, v := range envVars {
			val := fmt.Sprintf("%v", v)
			masked := val
			if len(val) > 6 {
				masked = val[:2] + strings.Repeat("*", len(val)-4) + val[len(val)-2:]
			}
			fmt.Fprintf(w, "%s\t%s\n", k, masked)
		}
		w.Flush()

	case "set":
		if len(args) < 3 {
			fatal("usage: harbr env set <project> KEY=VALUE")
		}
		parts := strings.SplitN(args[2], "=", 2)
		if len(parts) != 2 {
			fatal("format must be KEY=VALUE")
		}
		// patch env_vars by merging into project
		p, _ := c.get("/projects/" + projectID)
		envVars, _ := p["env_vars"].(map[string]any)
		if envVars == nil {
			envVars = map[string]any{}
		}
		envVars[parts[0]] = parts[1]
		_, err := c.patch("/projects/"+projectID, map[string]any{"env_vars": envVars})
		if err != nil {
			fatal("failed to set env var: %v", err)
		}
		fmt.Printf("✓ Set %s on %s\n", parts[0], str(proj["name"]))
		fmt.Println("  Triggering redeploy...")
		c.post("/projects/"+projectID+"/deploy", nil) //nolint

	case "delete":
		if len(args) < 3 {
			fatal("usage: harbr env delete <project> KEY")
		}
		p, _ := c.get("/projects/" + projectID)
		envVars, _ := p["env_vars"].(map[string]any)
		if envVars != nil {
			delete(envVars, args[2])
		}
		_, err := c.patch("/projects/"+projectID, map[string]any{"env_vars": envVars})
		if err != nil {
			fatal("failed to delete env var: %v", err)
		}
		fmt.Printf("✓ Deleted %s from %s\n", args[2], str(proj["name"]))

	default:
		fatal("unknown action %q — use list, set, or delete", action)
	}
}

func cmdUpdate(args []string) {
	fs := flag.NewFlagSet("update", flag.ExitOnError)
	version := fs.String("version", "", "update to specific version (default: latest)")
	_ = fs.Parse(args)

	u := updater.New(Version)
	info, err := u.Check()
	if err != nil {
		fatal("cannot check for updates: %v", err)
	}
	fmt.Printf("Current version: \033[1m%s\033[0m\n", info.Current)
	fmt.Printf("Latest version:  \033[1m%s\033[0m\n", info.Latest)

	if !info.UpdateAvailable && *version == "" {
		fmt.Println("\n✓ Already up to date.")
		return
	}

	target := info.Latest
	if *version != "" {
		target = *version
	}

	if info.Changelog != "" {
		fmt.Printf("\nChangelog:\n%s\n", info.Changelog)
	}

	fmt.Printf("\nUpdate to \033[1m%s\033[0m? [y/N] ", target)
	var confirm string
	fmt.Scanln(&confirm)
	if strings.ToLower(strings.TrimSpace(confirm)) != "y" {
		fmt.Println("Cancelled.")
		return
	}

	if err := u.Run(target); err != nil {
		fatal("update failed: %v", err)
	}
}

// ─── Main ────────────────────────────────────────────────────────────────────

func main() {
	if len(os.Args) < 2 {
		printUsage()
		return
	}

	cmd := os.Args[1]
	args := os.Args[2:]

	switch cmd {
	case "login":
		cmdLogin(args)

	case "setup":
		tui.RunSetup()

	case "status":
		cmdStatus(args)

	case "version":
		fmt.Printf("Harbr v%s\n", Version)

	case "join":
		if len(args) < 1 {
			fatal("usage: harbr join <token>")
		}
		c := newClient()
		result, err := c.post("/nodes/consume-token", map[string]string{"token": args[0]})
		if err != nil {
			fatal("join failed: %v", err)
		}
		fmt.Printf("✓ Joined cluster\n")
		if name, ok := result["name"]; ok {
			fmt.Printf("  Node: %v\n", name)
		}

	case "ps":
		cmdPS(args)

	case "projects":
		cmdPS(args) // alias

	case "nodes":
		cmdNodes(args)

	case "logs":
		cmdLogs(args)

	case "exec":
		cmdExec(args)

	case "env":
		cmdEnv(args)

	case "deploy":
		cmdDeploy(args)

	case "rollback":
		cmdRollback(args)

	case "update":
		cmdUpdate(args)

	case "events":
		c := newClient()
		events, err := c.getSlice("/hardware/events")
		if err != nil {
			fatal("%v", err)
		}
		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "TIME\tNODE\tEVENT\tDEVICE")
		fmt.Fprintln(w, "----\t----\t-----\t------")
		for _, e := range events {
			ev := e.(map[string]any)
			fmt.Fprintf(w, "%s\t%s\t%s\t%s\n",
				str(ev["created_at"]), str(ev["node_id"]),
				str(ev["event_type"]), str(ev["device_type"]))
		}
		w.Flush()

	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n", cmd)
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println("Harbr — Self-Hosted Infrastructure Platform")
	fmt.Println()
	fmt.Println("Usage:")
	fmt.Println("  harbr login              Authenticate with the Harbr API")
	fmt.Println("  harbr setup              Run setup wizard")
	fmt.Println("  harbr status             Cluster health summary")
	fmt.Println("  harbr ps                 List all projects with live status")
	fmt.Println("  harbr nodes              List nodes with hardware metrics")
	fmt.Println("  harbr logs <project>     Stream live container logs")
	fmt.Println("    --since 1h               Show logs from last 1 hour")
	fmt.Println("    --build                  Show last build log")
	fmt.Println("  harbr exec <project>     Open shell in running container")
	fmt.Println("    -- <command>             Run specific command")
	fmt.Println("  harbr env list <project> Show environment variables")
	fmt.Println("  harbr env set <p> K=V    Set env var (triggers redeploy)")
	fmt.Println("  harbr env delete <p> K   Delete env var")
	fmt.Println("  harbr deploy <project>   Trigger new deployment")
	fmt.Println("  harbr rollback <project> Roll back to previous version")
	fmt.Println("    --to <tag>               Roll back to specific image tag")
	fmt.Println("  harbr events             Show hardware device events")
	fmt.Println("  harbr update             Update Harbr to latest version")
	fmt.Println("    --version v1.2.0         Update to specific version")
	fmt.Println("  harbr join <token>       Join a cluster as a worker node")
	fmt.Println("  harbr version            Show version")
	fmt.Println()
	fmt.Println("Config: ~/.harbr/config.json  |  Env: HARBR_API, HARBR_TOKEN")
}
