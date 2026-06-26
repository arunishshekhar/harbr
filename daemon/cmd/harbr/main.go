package main

import (
	"fmt"
	"os"
	"github.com/arunishshekhar/harbr/internal/tui"
)

var Version = "dev"

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Harbr - Homelab Application Deployment Platform")
		fmt.Println()
		fmt.Println("Usage:")
		fmt.Println("  harbr setup              Run setup wizard")
		fmt.Println("  harbr status             Show cluster status")
		fmt.Println("  harbr join <token>       Join a cluster")
		fmt.Println("  harbr nodes              List nodes")
		fmt.Println("  harbr projects           List projects")
		fmt.Println("  harbr logs <project>     Show project logs")
		fmt.Println("  harbr events             Show hardware events")
		fmt.Println("  harbr version            Show version")
		fmt.Println("  harbr update             Self-update")
		return
	}

	switch os.Args[1] {
	case "setup":
		tui.RunSetup()
	case "status":
		tui.RunStatus()
	case "version":
		fmt.Printf("Harbr v%s\n", Version)
	case "join":
		if len(os.Args) < 3 {
			fmt.Println("Usage: harbr join <token>")
			os.Exit(1)
		}
		fmt.Printf("Joining cluster with token: %s...\n", os.Args[2])
	default:
		fmt.Printf("Unknown command: %s\n", os.Args[1])
		os.Exit(1)
	}
}
