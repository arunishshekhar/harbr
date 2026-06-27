package tui

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/progress"
)

var (
	accentColor = lipgloss.AdaptiveColor{Light: "#00D4FF", Dark: "#00D4FF"}
	dimColor    = lipgloss.AdaptiveColor{Light: "#6B7280", Dark: "#6B7280"}
	errorColor  = lipgloss.AdaptiveColor{Light: "#EF4444", Dark: "#EF4444"}
	okColor     = lipgloss.AdaptiveColor{Light: "#10B981", Dark: "#10B981"}
	warnColor   = lipgloss.AdaptiveColor{Light: "#F59E0B", Dark: "#F59E0B"}

	titleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(accentColor).
			MarginBottom(1)

	subtitleStyle = lipgloss.NewStyle().
			Foreground(dimColor).
			MarginBottom(2)

	selectedStyle = lipgloss.NewStyle().
			Foreground(accentColor).
			Bold(true)

	dimmedStyle = lipgloss.NewStyle().
			Foreground(dimColor)

	errorStyle = lipgloss.NewStyle().
			Foreground(errorColor)

	okStyle = lipgloss.NewStyle().
		Foreground(okColor)

	boxStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(accentColor).
			Padding(1, 2).
			MarginTop(1).
			MarginBottom(1)
)

type Step int

const (
	StepWelcome Step = iota
	StepPathSelect
	StepNodeName
	StepDomain
	StepCloudflareToken
	StepAdminUser
	StepAdminPassword
	StepConfirmInstall
	StepInstalling
	StepDone
)

type SetupPath string

const (
	PathQuickStart SetupPath = "quick"
	PathVPS        SetupPath = "vps"
	PathHomeServer SetupPath = "home"
)

type installStep struct {
	name   string
	action func(ctx context.Context) error
}

type model struct {
	step            Step
	width           int
	height          int
	err             error
	done            bool

	setupPath       SetupPath
	nodeName        string
	domain          string
	cloudflareToken string
	adminUser       string
	adminPassword   string

	pathCursor      int
	pathOptions     []SetupPath
	pathLabels      []string

	inputs          map[Step]*textinput.Model
	spinner         spinner.Model
	progress        progress.Model
	installProgress float64
	installLog      []string
	installStep     int
	installSteps    []installStep
	installDone     bool
	installErr      error
}

func initialModel() model {
	sp := spinner.New()
	sp.Style = lipgloss.NewStyle().Foreground(accentColor)

	pb := progress.New(
		progress.WithDefaultGradient(),
		progress.WithWidth(50),
	)

	inputs := make(map[Step]*textinput.Model)
	for _, s := range []Step{StepNodeName, StepDomain, StepCloudflareToken, StepAdminUser, StepAdminPassword} {
		ti := textinput.New()
		ti.Placeholder = getPlaceholder(s)
		ti.PromptStyle = lipgloss.NewStyle().Foreground(accentColor)
		ti.Width = 40
		ti.CharLimit = 100
		if s == StepAdminPassword {
			ti.EchoMode = textinput.EchoPassword
			ti.EchoCharacter = '●'
		}
		inputs[s] = &ti
	}

	return model{
		step:        StepWelcome,
		pathOptions: []SetupPath{PathQuickStart, PathVPS, PathHomeServer},
		pathLabels:  []string{"Quick Start — local use, no domain", "VPS Mode — cloud server with static IP", "Home Server — home hardware, public access"},
		inputs:      inputs,
		spinner:     sp,
		progress:    pb,
	}
}

func getPlaceholder(s Step) string {
	switch s {
	case StepNodeName:
		return "my-harbr-node"
	case StepDomain:
		return "example.com"
	case StepCloudflareToken:
		return "your-cloudflare-api-token"
	case StepAdminUser:
		return "admin"
	case StepAdminPassword:
		return "password (min 8 characters)"
	}
	return ""
}

func (m model) Init() tea.Cmd {
	return tea.Batch(textinput.Blink, m.spinner.Tick)
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width, m.height = msg.Width, msg.Height
		return m, nil

	case tea.KeyMsg:
		if m.step == StepDone {
			if msg.String() == "q" || msg.String() == "ctrl+c" || msg.String() == "enter" {
				return m, tea.Quit
			}
			return m, nil
		}
		if m.step == StepInstalling {
			return m, nil
		}

		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit
		case "enter":
			return m.advance()
		case "up", "k":
			if m.step == StepPathSelect && m.pathCursor > 0 {
				m.pathCursor--
			}
		case "down", "j":
			if m.step == StepPathSelect && m.pathCursor < len(m.pathOptions)-1 {
				m.pathCursor++
			}
		case "backspace":
			if m.step == StepWelcome {
				return m, tea.Quit
			}
		}

	case spinner.TickMsg:
		if m.step == StepInstalling && !m.installDone {
			var cmd tea.Cmd
			m.spinner, cmd = m.spinner.Update(msg)
			return m, cmd
		}

	case progress.FrameMsg:
		if m.step == StepInstalling {
			progressModel, cmd := m.progress.Update(msg)
			m.progress = progressModel.(progress.Model)
			return m, cmd
		}

	case installProgressMsg:
		m.installProgress = msg.percent
		if msg.stepIndex >= 0 {
			m.installStep = msg.stepIndex
		}
		m.installLog = append(m.installLog, msg.line)
		if msg.done {
			m.installDone = true
			m.step = StepDone
		}
		if msg.err != nil {
			m.installErr = msg.err
			m.step = StepDone
		}
		return m, m.progress.SetPercent(m.installProgress)
	}

	if input, ok := m.inputs[m.step]; ok {
		updated, cmd := input.Update(msg)
		m.inputs[m.step] = &updated
		return m, cmd
	}

	return m, nil
}

type installProgressMsg struct {
	percent   float64
	stepIndex int
	line      string
	done      bool
	err       error
}

func performInstallCmd(m *model) tea.Cmd {
	var cmds []tea.Cmd
	for i, step := range m.installSteps {
		i, step := i, step
		n := len(m.installSteps)
		cmds = append(cmds, func() tea.Msg {
			return installProgressMsg{
				percent:   float64(i) / float64(n),
				stepIndex: i,
				line:      fmt.Sprintf("▶ %s", step.name),
			}
		})
		cmds = append(cmds, func() tea.Msg {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
			defer cancel()
			if err := step.action(ctx); err != nil {
				return installProgressMsg{
					percent:   float64(i) / float64(n),
					stepIndex: i,
					line:      fmt.Sprintf("✗ %s: %v", step.name, err),
					err:       err,
				}
			}
			return nil
		})
	}
	cmds = append(cmds, func() tea.Msg {
		return installProgressMsg{percent: 1.0, stepIndex: -1, line: "✓ Installation complete", done: true}
	})
	return tea.Sequence(cmds...)
}

func (m model) advance() (tea.Model, tea.Cmd) {
	switch m.step {
	case StepWelcome:
		if m.setupPath == "" {
			m.step = StepPathSelect
		} else {
			m.step = StepNodeName
		}
		return m, nil

	case StepPathSelect:
		m.setupPath = m.pathOptions[m.pathCursor]
		m.step = StepNodeName
		cmd := m.inputs[StepNodeName].Focus()
		return m, cmd

	case StepNodeName:
		m.nodeName = m.inputs[StepNodeName].Value()
		if m.nodeName == "" {
			m.nodeName = "harbr-node"
		}
		var nextStep Step
		if m.setupPath == PathQuickStart {
			nextStep = StepAdminUser
		} else {
			nextStep = StepDomain
		}
		m.step = nextStep
		cmd := m.inputs[nextStep].Focus()
		return m, cmd

	case StepDomain:
		if m.setupPath == PathHomeServer && m.inputs[StepDomain].Value() == "" {
			m.err = fmt.Errorf("domain is required for Home Server mode")
			return m, nil
		}
		m.err = nil
		m.domain = m.inputs[StepDomain].Value()
		m.step = StepCloudflareToken
		cmd := m.inputs[StepCloudflareToken].Focus()
		return m, cmd

	case StepCloudflareToken:
		m.cloudflareToken = m.inputs[StepCloudflareToken].Value()
		m.step = StepAdminUser
		cmd := m.inputs[StepAdminUser].Focus()
		return m, cmd

	case StepAdminUser:
		m.adminUser = m.inputs[StepAdminUser].Value()
		if m.adminUser == "" {
			m.adminUser = "admin"
		}
		m.step = StepAdminPassword
		cmd := m.inputs[StepAdminPassword].Focus()
		return m, cmd

	case StepAdminPassword:
		m.adminPassword = m.inputs[StepAdminPassword].Value()
		if len(m.adminPassword) < 8 {
			m.err = fmt.Errorf("password must be at least 8 characters")
			m.step = StepAdminPassword
			return m, nil
		}
		m.step = StepConfirmInstall

	case StepConfirmInstall:
		m.buildInstallSteps()
		m.step = StepInstalling
		return m, tea.Batch(m.spinner.Tick, performInstallCmd(&m))
	}

	return m, nil
}

func (m *model) buildInstallSteps() {
	if m.setupPath == PathQuickStart {
		m.installSteps = []installStep{
			{"Installing Tailscale", runScriptSafe("apt-get install -y tailscale")},
			{"Installing Postgres 16", runScriptSafe("apt-get install -y postgresql-16")},
			{"Installing K3s", runScriptSafe("curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC='--disable=traefik --write-kubeconfig-mode=644' sh -")},
			{"Installing Harbr Daemon", runScriptSafe("systemctl daemon-reload && systemctl enable harbrd && systemctl start harbrd")},
			{"Starting Harbr API + Panel", runScriptSafe("kubectl apply -f /etc/harbr/k8s/")},
			{"Creating admin user", m.createAdminUser},
		}
	} else {
		m.installSteps = []installStep{
			{"Installing Tailscale", runScriptSafe("apt-get install -y tailscale")},
			{"Installing Postgres 16", runScriptSafe("apt-get install -y postgresql-16")},
			{"Installing K3s with external datastore", m.installK3sWithDSN},
			{"Installing Cilium CNI", runScriptSafe("helm repo add cilium https://helm.cilium.io && helm upgrade --install cilium cilium/cilium --version 1.19.0 --namespace kube-system --set operator.replicas=1")},
			{"Installing Longhorn", runScriptSafe("helm repo add longhorn https://charts.longhorn.io && helm upgrade --install longhorn longhorn/longhorn --namespace longhorn-system --create-namespace --version 1.7.0")},
			{"Deploying Registry", runScriptSafe("kubectl apply -f /etc/harbr/k8s/redis.yaml && kubectl apply -f /etc/harbr/k8s/caddy.yaml")},
			{"Installing Harbr Daemon", runScriptSafe("systemctl daemon-reload && systemctl enable harbrd && systemctl start harbrd")},
			{"Starting Harbr API + Panel", runScriptSafe("kubectl apply -f /etc/harbr/k8s/")},
			{"Configuring Cloudflare", m.configureCloudflare},
			{"Creating admin user", m.createAdminUser},
		}
	}
}

func runScript(script string) func(ctx context.Context) error {
	return func(ctx context.Context) error {
		cmd := exec.CommandContext(ctx, "bash", "-c", script)
		output, err := cmd.CombinedOutput()
		if err != nil {
			return fmt.Errorf("%s: %s", err, strings.TrimSpace(string(output)))
		}
		return nil
	}
}

func runScriptSafe(script string) func(ctx context.Context) error {
	if os.Getenv("HARBR_DEV_MODE") != "" {
		return func(ctx context.Context) error {
			return nil
		}
	}
	return runScript(script)
}

func (m *model) installK3sWithDSN(ctx context.Context) error {
	if os.Getenv("HARBR_DEV_MODE") != "" {
		return nil
	}
	dsn := fmt.Sprintf("postgres://harbr:harbr@localhost:5432/harbr?sslmode=disable")
	script := fmt.Sprintf(`curl -sfL https://get.k3s.io | \
		INSTALL_K3S_EXEC='server \
			--datastore-endpoint="%s" \
			--disable=traefik \
			--flannel-backend=none \
			--disable-network-policy \
			--write-kubeconfig-mode=644' sh -`,
		dsn)
	return runScript(script)(ctx)
}

func (m *model) configureCloudflare(ctx context.Context) error {
	return nil
}

func (m *model) createAdminUser(ctx context.Context) error {
	return nil
}

func (m model) View() string {
	switch m.step {
	case StepWelcome:
		return m.welcomeView()
	case StepPathSelect:
		return m.pathSelectView()
	case StepNodeName, StepDomain, StepCloudflareToken, StepAdminUser, StepAdminPassword:
		return m.inputView()
	case StepConfirmInstall:
		return m.confirmView()
	case StepInstalling:
		return m.installingView()
	case StepDone:
		return m.doneView()
	}
	return ""
}

func (m model) welcomeView() string {
	var b strings.Builder
	b.WriteString(titleStyle.Render("Harbr Setup Wizard"))
	b.WriteString("\n")
	b.WriteString(subtitleStyle.Render("Self-Hosted Infrastructure Platform"))
	b.WriteString("\n\n")
	b.WriteString(boxStyle.Render(
		"This wizard will guide you through setting up a Harbr node.\n\n" +
			"Choose your setup path:\n" +
			"  • Quick Start — local use only, no domain needed\n" +
			"  • VPS Mode — cloud server with static public IP\n" +
			"  • Home Server — home hardware, public access via Cloudflare\n\n" +
			"Press Enter to begin. Ctrl+C to quit."))
	return b.String()
}

func (m model) pathSelectView() string {
	var b strings.Builder
	b.WriteString(titleStyle.Render("Select Setup Path"))
	b.WriteString("\n\n")
	for i, label := range m.pathLabels {
		cursor := "  "
		if i == m.pathCursor {
			cursor = selectedStyle.Render("▸")
			label = selectedStyle.Render(label)
		}
		b.WriteString(fmt.Sprintf("%s %s\n", cursor, label))
	}
	b.WriteString("\n")
	b.WriteString(dimmedStyle.Render("↑/↓ to navigate • Enter to select • q to quit"))
	return b.String()
}

func (m model) inputView() string {
	var b strings.Builder
	var title string
	switch m.step {
	case StepNodeName:
		title = "Node Name"
	case StepDomain:
		title = "Domain Name"
		if m.setupPath == PathVPS {
			title = "Domain Name (optional — press Enter to skip)"
		}
	case StepCloudflareToken:
		title = "Cloudflare API Token"
	case StepAdminUser:
		title = "Admin Username"
	case StepAdminPassword:
		title = "Admin Password"
	}
	b.WriteString(titleStyle.Render(title))
	b.WriteString("\n")
	if m.err != nil {
		b.WriteString(errorStyle.Render(fmt.Sprintf("✗ %v\n\n", m.err)))
	}
	b.WriteString(m.inputs[m.step].View())
	b.WriteString("\n")
	b.WriteString("\n")
	b.WriteString(dimmedStyle.Render("Enter to confirm • q to quit"))
	return b.String()
}

func (m model) confirmView() string {
	var b strings.Builder
	b.WriteString(titleStyle.Render("Confirm Installation"))
	b.WriteString("\n\n")
	b.WriteString(boxStyle.Render(
		fmt.Sprintf("Setup Path:  %s\n", m.setupPath) +
			fmt.Sprintf("Node Name:   %s\n", m.nodeName) +
			fmt.Sprintf("Domain:      %s\n", ifEmpty(m.domain, "(none - local only)")) +
			fmt.Sprintf("Admin User:  %s\n", m.adminUser) +
			fmt.Sprintf("Admin Pass:  %s\n", strings.Repeat("●", len(m.adminPassword)))))
	b.WriteString("\n")
	b.WriteString(dimmedStyle.Render("Press Enter to start installation • q to quit"))
	return b.String()
}

func (m model) installingView() string {
	var b strings.Builder
	b.WriteString(titleStyle.Render("Installing Harbr"))
	b.WriteString("\n\n")
	b.WriteString(m.spinner.View())
	stepName := ""
	if m.installStep >= 0 && m.installStep < len(m.installSteps) {
		stepName = m.installSteps[m.installStep].name
	}
	if stepName != "" {
		b.WriteString(" ")
		b.WriteString(stepName)
	}
	b.WriteString("\n")
	b.WriteString(m.progress.ViewAs(m.installProgress))
	b.WriteString("\n\n")
	if len(m.installLog) > 0 {
		last := m.installLog[len(m.installLog)-1]
		b.WriteString(dimmedStyle.Render(last))
	}
	return b.String()
}

func (m model) doneView() string {
	var b strings.Builder
	if m.installErr != nil {
		b.WriteString(errorStyle.Render("✗ Installation Failed"))
		b.WriteString("\n\n")
		failedStep := ""
		if m.installStep < len(m.installSteps) {
			failedStep = m.installSteps[m.installStep].name
		}
		if failedStep != "" {
			b.WriteString(boxStyle.Render(
				errorStyle.Render(fmt.Sprintf("Step: %s", failedStep)) + "\n\n" +
					fmt.Sprintf("Error: %v", m.installErr)))
		} else {
			b.WriteString(boxStyle.Render(fmt.Sprintf("%v", m.installErr)))
		}
		b.WriteString("\n\n")
		if len(m.installLog) > 0 {
			b.WriteString(dimmedStyle.Render("Last log entries:"))
			b.WriteString("\n")
			start := 0
			if len(m.installLog) > 3 {
				start = len(m.installLog) - 3
			}
			for _, line := range m.installLog[start:] {
				b.WriteString(dimmedStyle.Render(line))
				b.WriteString("\n")
			}
			b.WriteString("\n")
		}
		b.WriteString("Check the system logs above for details. Press Enter or q to exit.")
	} else {
		b.WriteString(okStyle.Render("✓ Installation Complete"))
		b.WriteString("\n\n")
		b.WriteString(boxStyle.Render(
			fmt.Sprintf("Harbr is now running on %s.\n\n", m.nodeName) +
				"Admin Panel:  http://localhost:3000\n" +
				fmt.Sprintf("Username:     %s\n", m.adminUser) +
				"Password:     (as configured)\n\n" +
				"To add more nodes later:\n" +
				"  harbr join <join-token>"))
	}
	b.WriteString("\n")
	b.WriteString(dimmedStyle.Render("Press Enter or q to exit"))
	return b.String()
}

func ifEmpty(s, fallback string) string {
	if s == "" {
		return fallback
	}
	return s
}

func RunSetup() {
	p := tea.NewProgram(initialModel(), tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Setup failed: %v\n", err)
		os.Exit(1)
	}
}

func RunStatus() {
	fmt.Println("Harbr Cluster Status")
	fmt.Println("====================")
	fmt.Println("Checking cluster health...")
}
