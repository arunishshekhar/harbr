package dns_failover

import (
	"context"
	"testing"
)

func TestFailoverSkipsInTunnelMode(t *testing.T) {
	a := &Agent{cfg: &Config{AccessMode: "tunnel"}}
	a.Start(context.Background())
}
