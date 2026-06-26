package reconciler

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
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
	DriftPodMissing  DriftType = "pod_missing"
	DriftCrashLoop   DriftType = "crash_loop"
	DriftWrongImage  DriftType = "wrong_image"
)

type Drift struct {
	Type      DriftType
	ProjectID string
	Namespace string
}

type Reconciler struct {
	db     *pgxpool.Pool
	logger *zap.Logger
}

func New(logger *zap.Logger) *Reconciler {
	return &Reconciler{logger: logger}
}

func (r *Reconciler) Start(ctx context.Context) {
	r.logger.Info("reconciler started")
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			r.reconcileOnce(ctx)
		}
	}
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
	return nil
}

func (r *Reconciler) detectDrift(p Project, observed *PodState) *Drift {
	if p.ProjectStatus == "building" || p.ProjectStatus == "deploying" {
		return nil
	}
	if observed == nil || observed.Phase == "" || observed.Phase == "Failed" {
		return &Drift{Type: DriftPodMissing, ProjectID: p.ID, Namespace: p.Namespace}
	}
	if observed.RestartCount > 5 {
		return &Drift{Type: DriftCrashLoop, ProjectID: p.ID, Namespace: p.Namespace}
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
	r.logger.Info("correcting drift", zap.String("project", drift.ProjectID))
}

func (r *Reconciler) updateObservedStatus(ctx context.Context, tx interface{}, projectID string, state *PodState) {
	// Update observed_status in DB
	fmt.Printf("updating observed status for %s\n", projectID)
}
