package reconciler

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
	"github.com/arunishshekhar/harbr/internal/config"
	"github.com/arunishshekhar/harbr/internal/leader"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

type Project struct {
	ID              string
	Name            string
	Namespace       string
	DesiredStatus   string
	ProjectStatus   string
	CurrentImageTag string
	ImageTag        string
}

type PodState struct {
	Phase        string
	Image        string
	RestartCount int32
}

type DriftType string

const (
	DriftPodMissing DriftType = "pod_missing"
	DriftCrashLoop  DriftType = "crash_loop"
	DriftWrongImage DriftType = "wrong_image"
)

type Drift struct {
	Type      DriftType
	ProjectID string
	Namespace string
	Details   map[string]string
}

type Reconciler struct {
	cfg    *config.Config
	db     *pgxpool.Pool
	k8s    kubernetes.Interface
	logger *zap.Logger
	leader *leader.Leader
}

func New(cfg *config.Config, logger *zap.Logger) *Reconciler {
	return &Reconciler{
		cfg:    cfg,
		logger: logger,
		leader: leader.New(cfg, logger),
	}
}

func (r *Reconciler) Start(ctx context.Context) {
	var err error
	r.db, err = pgxpool.New(ctx, r.cfg.PostgresDSN())
	if err != nil {
		r.logger.Fatal("failed to connect to postgres", zap.Error(err))
	}
	defer r.db.Close()

	r.k8s, err = newK8sClient()
	if err != nil {
		r.logger.Fatal("failed to create k8s client", zap.Error(err))
	}

	r.logger.Info("reconciler started")
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if !r.leader.IsLeader() {
				continue
			}
			r.reconcileOnce(ctx)
		}
	}
}

func newK8sClient() (kubernetes.Interface, error) {
	config, err := rest.InClusterConfig()
	if err != nil {
		config, err = rest.InClusterConfig()
		if err != nil {
			return nil, fmt.Errorf("no in-cluster config (running outside K8s?)")
		}
	}
	return kubernetes.NewForConfig(config)
}

const fetchSQL = `
  SELECT id, name, namespace, desired_status, project_status, current_image_tag
  FROM projects
  WHERE desired_status = 'running'
    AND project_status NOT IN ('building', 'deploying')
  FOR UPDATE SKIP LOCKED
`

func (r *Reconciler) reconcileOnce(ctx context.Context) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		r.logger.Error("tx begin failed", zap.Error(err))
		return
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx, fetchSQL)
	if err != nil {
		r.logger.Error("query failed", zap.Error(err))
		return
	}
	defer rows.Close()

	var projects []Project
	for rows.Next() {
		var p Project
		if err := rows.Scan(&p.ID, &p.Name, &p.Namespace, &p.DesiredStatus,
			&p.ProjectStatus, &p.CurrentImageTag); err != nil {
			r.logger.Error("scan failed", zap.Error(err))
			continue
		}
		projects = append(projects, p)
	}

	for _, p := range projects {
		if p.ProjectStatus == "building" || p.ProjectStatus == "deploying" {
			continue
		}
		observed := r.observePodState(ctx, p.Namespace, p.Name)
		if drift := r.detectDrift(p, observed); drift != nil {
			r.logger.Info("drift detected",
				zap.String("project", p.Name),
				zap.String("type", string(drift.Type)))
			r.enqueueCorrection(ctx, drift)
		}
		r.updateObservedStatus(ctx, tx, p.ID, observed)
	}
	tx.Commit(ctx)
}

func (r *Reconciler) observePodState(ctx context.Context, namespace, name string) *PodState {
	pods, err := r.k8s.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: fmt.Sprintf("app=%s", name),
	})
	if err != nil || len(pods.Items) == 0 {
		return nil
	}
	pod := pods.Items[0]
	var restartCount int32
	for _, cs := range pod.Status.ContainerStatuses {
		restartCount += cs.RestartCount
	}
	image := ""
	if len(pod.Spec.Containers) > 0 {
		image = pod.Spec.Containers[0].Image
	}
	return &PodState{
		Phase:        string(pod.Status.Phase),
		Image:        image,
		RestartCount: restartCount,
	}
}

func (r *Reconciler) detectDrift(p Project, observed *PodState) *Drift {
	if p.ProjectStatus == "building" || p.ProjectStatus == "deploying" {
		return nil
	}
	if observed == nil || observed.Phase == "" || observed.Phase == string(corev1.PodFailed) {
		return &Drift{Type: DriftPodMissing, ProjectID: p.ID, Namespace: p.Namespace}
	}
	if observed.RestartCount > 5 {
		return &Drift{
			Type: DriftCrashLoop, ProjectID: p.ID, Namespace: p.Namespace,
			Details: map[string]string{"restarts": fmt.Sprintf("%d", observed.RestartCount)},
		}
	}
	if p.CurrentImageTag != "" {
		expectedSuffix := ":" + p.CurrentImageTag
		if !strings.HasSuffix(observed.Image, expectedSuffix) {
			return &Drift{Type: DriftWrongImage, ProjectID: p.ID, Namespace: p.Namespace}
		}
	}
	return nil
}

func (r *Reconciler) enqueueCorrection(ctx context.Context, drift *Drift) {
	r.logger.Info("correcting drift",
		zap.String("project", drift.ProjectID),
		zap.String("namespace", drift.Namespace),
		zap.String("type", string(drift.Type)))

	switch drift.Type {
	case DriftPodMissing:
		_, err := r.k8s.CoreV1().Pods(drift.Namespace).List(ctx, metav1.ListOptions{})
		if err != nil {
			r.logger.Error("cannot list pods, namespace may be missing", zap.Error(err))
		}
	case DriftCrashLoop:
		pods, err := r.k8s.CoreV1().Pods(drift.Namespace).List(ctx, metav1.ListOptions{
			LabelSelector: fmt.Sprintf("harbr.io/project=%s", drift.ProjectID),
		})
		if err == nil && len(pods.Items) > 0 {
			r.k8s.CoreV1().Pods(drift.Namespace).Delete(ctx, pods.Items[0].Name,
				metav1.DeleteOptions{})
			r.logger.Info("deleted crashlooping pod", zap.String("pod", pods.Items[0].Name))
		}
	case DriftWrongImage:
		r.logger.Info("wrong image tag detected, rollout should handle via Deployment update")
	}
}

func (r *Reconciler) updateObservedStatus(ctx context.Context, tx pgx.Tx, projectID string, state *PodState) {
	status := "unknown"
	if state != nil {
		switch state.Phase {
		case string(corev1.PodRunning):
			status = "running"
		case string(corev1.PodPending):
			status = "pending"
		case string(corev1.PodFailed):
			status = "failed"
		case string(corev1.PodSucceeded):
			status = "stopped"
		}
	}
	_, err := tx.Exec(ctx,
		"UPDATE projects SET observed_status = $2 WHERE id = $1",
		projectID, status,
	)
	if err != nil {
		r.logger.Error("failed to update observed_status", zap.Error(err))
	}
}
