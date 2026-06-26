package main

import (
	"fmt"
	"os"
	"strings"

	"github.com/arunishshekhar/harbr/internal/tui"
)

var Version = "dev"

func main() {
	if len(os.Args) < 2 {
		printUsage()
		return
	}

	cmd := os.Args[1]
	args := os.Args[2:]

	switch cmd {
	case "setup":
		mode := "fresh"
		for i, a := range args {
			if a == "--mode" && i+1 < len(args) {
				mode = args[i+1]
			}
			if strings.HasPrefix(a, "--mode=") {
				mode = strings.TrimPrefix(a, "--mode=")
			}
		}
		_ = mode
		tui.RunSetup()

	case "status":
		tui.RunStatus()

	case "version":
		fmt.Printf("Harbr v%s\n", Version)

	case "join":
		if len(args) < 1 {
			fmt.Println("Usage: harbr join <token>")
			os.Exit(1)
		}
		fmt.Printf("Joining cluster with token: %s...\n", args[0])

	case "ps":
		fmt.Println("PROJECT          STATUS    DOMAIN                    NODE        CPU    MEM   UPTIME")
		fmt.Println("-----           ------    ------                    ----        ---    ---   ------")

	case "logs":
		if len(args) < 1 {
			fmt.Println("Usage: harbr logs <project> [--since 1h] [--build]")
			os.Exit(1)
		}
		fmt.Printf("Streaming logs for project: %s\n", args[0])
		fmt.Println("(requires running daemon connection)")

	case "exec":
		if len(args) < 1 {
			fmt.Println("Usage: harbr exec <project> [-- command]")
			os.Exit(1)
		}
		fmt.Printf("Opening shell for project: %s\n", args[0])
		fmt.Println("(requires running daemon connection)")

	case "env":
		if len(args) < 2 {
			fmt.Println("Usage: harbr env <list|set|delete> <project> [KEY=VALUE]")
			os.Exit(1)
		}
		fmt.Printf("Environment for project: %s\n", args[1])

	case "deploy":
		if len(args) < 1 {
			fmt.Println("Usage: harbr deploy <project>")
			os.Exit(1)
		}
		fmt.Printf("Triggering deploy for project: %s\n", args[0])

	case "rollback":
		if len(args) < 1 {
			fmt.Println("Usage: harbr rollback <project> [--to <tag>]")
			os.Exit(1)
		}
		fmt.Printf("Rolling back project: %s\n", args[0])

	case "nodes":
		fmt.Println("NODE             STATUS    ROLE       IP               CPU    RAM    DISK")
		fmt.Println("----             ------    ----       --               ---    ---    ----")

	case "projects":
		fmt.Println("PROJECT          STATUS    DOMAIN                    PORT")
		fmt.Println("-------          ------    ------                    ----")

	case "update":
		fmt.Println("Checking for updates...")
		fmt.Println("(self-update engine will be available in a future release)")

	case "events":
		fmt.Println("Hardware Events")
		fmt.Println("===============")
		fmt.Println("(requires running daemon connection)")

	default:
		fmt.Printf("Unknown command: %s\n", cmd)
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println("Harbr - Homelab Application Deployment Platform")
	fmt.Println()
	fmt.Println("Usage:")
	fmt.Println("  harbr setup              Run setup wizard")
	fmt.Println("  harbr status             Show cluster status")
	fmt.Println("  harbr join <token>       Join a cluster")
	fmt.Println("  harbr ps                 List running projects")
	fmt.Println("  harbr projects           List all projects")
	fmt.Println("  harbr nodes              List nodes")
	fmt.Println("  harbr logs <project>     Show project logs")
	fmt.Println("  harbr exec <project>     Open shell in container")
	fmt.Println("  harbr env <action> <project>  Manage environment variables")
	fmt.Println("  harbr deploy <project>   Trigger deployment")
	fmt.Println("  harbr rollback <project> Rollback deployment")
	fmt.Println("  harbr events             Show hardware events")
	fmt.Println("  harbr version            Show version")
	fmt.Println("  harbr update             Self-update")
}
