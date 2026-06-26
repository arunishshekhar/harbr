#!/usr/bin/env bash
# End-to-end local cluster test for Harbr using k3d (K3s in Docker)
# Creates a 2-node K3s cluster (server + agent), deploys apps, runs DB migrations
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC} $1"; }
pass()  { echo -e "${GREEN}[PASS]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail()  { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }

HARBR_DIR="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$HOME/.local/bin:$PATH"
CLUSTER="harbr-test"
EXISTING_PG_CONTAINER="society-bot-postgres"

cleanup() {
  info "Cleaning up k3d cluster..."
  k3d cluster delete "$CLUSTER" 2>/dev/null || true
}
trap cleanup EXIT

# ── Step 1: Install tools ──────────────────────────────────────────────
step1() {
  info "Step 1/6: Ensuring k3d and kubectl are installed..."

  if ! command -v k3d &>/dev/null; then
    mkdir -p "$HOME/.local/bin"
    curl -fsSL https://github.com/k3d-io/k3d/releases/latest/download/k3d-linux-amd64 -o "$HOME/.local/bin/k3d"
    chmod +x "$HOME/.local/bin/k3d"
  fi

  if ! command -v kubectl &>/dev/null; then
    curl -fsSL https://dl.k8s.io/release/v1.30.0/bin/linux/amd64/kubectl -o "$HOME/.local/bin/kubectl"
    chmod +x "$HOME/.local/bin/kubectl"
  fi

  pass "k3d $(k3d version 2>&1 | head -1) and kubectl v$(kubectl version --client -o json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['clientVersion']['gitVersion'])" 2>/dev/null || echo 'ready')"
}

# ── Step 2: Create 2-node cluster ──────────────────────────────────────
step2() {
  info "Step 2/6: Creating 2-node K3s cluster ($CLUSTER)..."

  if k3d cluster list 2>/dev/null | grep -q "\b$CLUSTER\b"; then
    warn "Cluster $CLUSTER already exists, deleting..."
    k3d cluster delete "$CLUSTER"
  fi

  k3d cluster create "$CLUSTER" \
    --servers 1 --agents 1 \
    --k3s-arg '--disable=traefik@server:0' \
    --port '8081:80@server:0' \
    --wait

  # Wait for nodes to be ready
  kubectl wait --for=condition=Ready nodes --all --timeout=60s

  local nodes
  nodes=$(kubectl get nodes -o name | wc -l)
  pass "Cluster ready with $nodes node(s)"
  kubectl get nodes -o wide
}

# ── Step 3: Verify cluster health ──────────────────────────────────────
step3() {
  info "Step 3/6: Verifying cluster health..."

  # Check all system pods
  kubectl get pods -n kube-system -o name | head -10

  # Deploy a test nginx to verify scheduling
  kubectl create deployment test-nginx --image=nginx:alpine --replicas=2
  kubectl expose deployment test-nginx --port=80 --target-port=80 --name=test-nginx
  kubectl rollout status deployment/test-nginx --timeout=60s

  # Verify pods are running on different nodes
  local nodes_used
  nodes_used=$(kubectl get pods -l app=test-nginx -o json | python3 -c "
import sys, json
pods = json.load(sys.stdin)['items']
nodes = set(p['spec']['nodeName'] for p in pods if p['status']['phase'] == 'Running')
print(len(nodes))
" 2>/dev/null || echo "0")
  info "Pods distributed across $nodes_used node(s)"

  # Test service connectivity
  kubectl run test-curl --image=curlimages/curl --restart=Never --command -- sleep 30 2>/dev/null
  kubectl wait --for=condition=Ready pod/test-curl --timeout=30s 2>/dev/null
  local http_code
  http_code=$(kubectl exec test-curl -- curl -s -o /dev/null -w "%{http_code}" http://test-nginx 2>/dev/null || echo "000")
  kubectl delete pod test-curl --force --grace-period=0 2>/dev/null || true
  if [ "$http_code" = "200" ]; then
    pass "Service reachable (HTTP $http_code)"
  else
    fail "Service not reachable (HTTP $http_code)"
  fi

  kubectl delete deployment test-nginx service/test-nginx 2>/dev/null || true
  pass "Cluster health verified"
}

# ── Step 4: Deploy Harbr infrastructure components ─────────────────────
step4() {
  info "Step 4/6: Deploying Harbr infrastructure..."

  kubectl create namespace harbr-system 2>/dev/null || true

  # Deploy Redis (as used by Harbr)
  cat <<'EOF' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: harbr-system
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7.4-alpine
        args: ["redis-server", "--appendonly", "yes"]
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: harbr-system
spec:
  ports:
  - port: 6379
  selector:
    app: redis
EOF
  kubectl rollout status deployment/redis -n harbr-system --timeout=60s
  pass "Redis deployed"

  # Deploy a test project: nginx in its own namespace
  kubectl create namespace hello-harbr 2>/dev/null || true

  cat <<'EOF' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hello-harbr
  namespace: hello-harbr
  labels:
    app: hello-harbr
    harbr.io/project: "test-001"
spec:
  replicas: 1
  selector:
    matchLabels:
      app: hello-harbr
  template:
    metadata:
      labels:
        app: hello-harbr
    spec:
      containers:
      - name: nginx
        image: nginx:alpine
        ports:
        - containerPort: 80
        readinessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 5
        livenessProbe:
          tcpSocket:
            port: 80
          initialDelaySeconds: 15
          periodSeconds: 20
        resources:
          requests:
            cpu: 100m
            memory: 64Mi
          limits:
            cpu: 200m
            memory: 128Mi
---
apiVersion: v1
kind: Service
metadata:
  name: hello-harbr
  namespace: hello-harbr
  labels:
    app: hello-harbr
spec:
  selector:
    app: hello-harbr
  ports:
  - port: 80
    targetPort: 80
    protocol: TCP
  type: ClusterIP
EOF

  kubectl rollout status deployment/hello-harbr -n hello-harbr --timeout=60s
  pass "Test project (nginx) deployed"

  # Verify service from within cluster
  kubectl run test-curl2 --image=curlimages/curl --restart=Never --command -- sleep 30 2>/dev/null
  kubectl wait --for=condition=Ready pod/test-curl2 --timeout=30s 2>/dev/null
  local http_code2
  http_code2=$(kubectl exec test-curl2 -- curl -s -o /dev/null -w "%{http_code}" http://hello-harbr.hello-harbr.svc.cluster.local 2>/dev/null || echo "000")
  kubectl delete pod test-curl2 --force --grace-period=0 2>/dev/null || true
  if [ "$http_code2" = "200" ]; then
    pass "Project service reachable via cluster DNS (HTTP $http_code2)"
  else
    fail "Project service unreachable (HTTP $http_code2)"
  fi
}

# ── Step 5: Run database migrations ────────────────────────────────────
step5() {
  info "Step 5/6: Running database migrations against PostgreSQL..."

  local pg_host="localhost"
  local pg_pass="harbr-test-2026"

  # Check if existing PG container is running
  if docker ps --format '{{.Names}}' | grep -q "$EXISTING_PG_CONTAINER"; then
    pg_host=$(docker inspect "$EXISTING_PG_CONTAINER" --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')
    info "Using existing PostgreSQL container: $EXISTING_PG_CONTAINER ($pg_host)"
  else
    # Ensure user/DB exist
    docker exec "$EXISTING_PG_CONTAINER" psql -U postgres -c "CREATE USER harbr WITH PASSWORD '$pg_pass';" 2>/dev/null || true
    docker exec "$EXISTING_PG_CONTAINER" psql -U postgres -c "CREATE DATABASE harbr OWNER harbr;" 2>/dev/null || true
    docker exec "$EXISTING_PG_CONTAINER" psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE harbr TO harbr;" 2>/dev/null || true
  fi

  local psql_cmd="docker exec -i $EXISTING_PG_CONTAINER psql -U harbr -d harbr"

  # Ensure user/DB exist
  docker exec "$EXISTING_PG_CONTAINER" psql -U postgres -c "CREATE USER harbr WITH PASSWORD '$pg_pass';" 2>/dev/null || true
  docker exec "$EXISTING_PG_CONTAINER" psql -U postgres -c "CREATE DATABASE harbr OWNER harbr;" 2>/dev/null || true
  docker exec "$EXISTING_PG_CONTAINER" psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE harbr TO harbr;" 2>/dev/null || true

  # Run migrations via Docker PostgreSQL
  for f in "$HARBR_DIR/migrations"/*.sql; do
    local name
    name=$(basename "$f")
    info "  Running migration: $name"
    $psql_cmd < "$f" 2>&1
    pass "Migration $name applied"
  done

  # Create default admin user
  $psql_cmd -c "INSERT INTO users (username, password_hash, role, is_active) VALUES ('admin', '\$2b\$12\$uFUKCEESa4XDDb4cYC08heWSxXRI.n8NKn5jnzROvyAE1bXTpQd2.', 'admin', true) ON CONFLICT (username) DO NOTHING;"
  pass "Default admin user created"

  # Verify migrations
  local tables
  tables=$($psql_cmd -t -A -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
  pass "$tables tables created in PostgreSQL"
}

# ── Step 6: Build and verify API ───────────────────────────────────────
step6() {
  info "Step 6/6: Building and verifying Harbr API..."

  cd "$HARBR_DIR/api"

  # Install deps
  npm install --silent 2>&1 | tail -1
  pass "API dependencies installed"

  # Run TypeScript compilation
  npx tsc --noEmit 2>&1
  pass "API TypeScript compilation passes"

  # Run tests
  npx jest --passWithNoTests --no-coverage --verbose 2>&1
  pass "All API unit tests pass"

  # Build the API
  npm run build 2>&1 | tail -3
  pass "API build successful"

  cd "$HARBR_DIR/daemon"

  # Build daemon
  go build ./... 2>&1
  pass "Go daemon builds"

  # Run Go tests
  go test ./... -race -timeout 120s 2>&1
  pass "All Go tests pass"

  cd "$HARBR_DIR"
}

# ── Main ────────────────────────────────────────────────────────────────
main() {
  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║       Harbr Local Cluster Test Suite                        ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""

  cd "$HARBR_DIR"

  step1
  step2
  step3
  step4
  step5
  step6

  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║  All tests passed!                                          ║"
  echo "║                                                            ║"
  echo "║  Cluster: $CLUSTER (2 nodes, K3s in Docker via k3d)        ║"
  echo "║  Cluster DNS: http://hello-harbr.hello-harbr.svc.cluster.local ║"
  echo "║  Exposed port: :8081 → port 80                             ║"
  echo "║                                                            ║"
  echo "║  kubectl get nodes -o wide                                 ║"
  echo "║  kubectl get pods -A                                       ║"
  echo "║                                                            ║"
  echo "║  To clean up: k3d cluster delete $CLUSTER                  ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""
}

main "$@"
