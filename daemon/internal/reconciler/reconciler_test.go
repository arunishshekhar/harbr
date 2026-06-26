package reconciler

import "testing"

func TestDetectDrift_ReturnsNilForBuilding(t *testing.T) {
	r := &Reconciler{}
	p := Project{ProjectStatus: "building", DesiredStatus: "running"}
	drift := r.detectDrift(p, nil)
	if drift != nil {
		t.Error("expected nil drift for building project")
	}
}

func TestDetectDrift_ReturnsNilForDeploying(t *testing.T) {
	r := &Reconciler{}
	p := Project{ProjectStatus: "deploying", DesiredStatus: "running"}
	drift := r.detectDrift(p, nil)
	if drift != nil {
		t.Error("expected nil drift for deploying project")
	}
}

func TestDetectDrift_PodMissing(t *testing.T) {
	r := &Reconciler{}
	p := Project{ProjectStatus: "running", DesiredStatus: "running"}
	drift := r.detectDrift(p, nil)
	if drift == nil || drift.Type != DriftPodMissing {
		t.Error("expected DriftPodMissing when pod absent")
	}
}

func TestDetectDrift_CrashLoop(t *testing.T) {
	r := &Reconciler{}
	p := Project{ProjectStatus: "running", DesiredStatus: "running"}
	observed := &PodState{Phase: "Running", RestartCount: 6}
	drift := r.detectDrift(p, observed)
	if drift == nil || drift.Type != DriftCrashLoop {
		t.Error("expected DriftCrashLoop when restarts >5")
	}
}

func TestDetectDrift_WrongImage(t *testing.T) {
	r := &Reconciler{}
	p := Project{ProjectStatus: "running", DesiredStatus: "running", CurrentImageTag: "abc123"}
	observed := &PodState{Phase: "Running", Image: "wrong:xyz789", RestartCount: 0}
	drift := r.detectDrift(p, observed)
	if drift == nil || drift.Type != DriftWrongImage {
		t.Error("expected DriftWrongImage when image tag mismatch")
	}
}

func TestDetectDrift_NilWhenOK(t *testing.T) {
	r := &Reconciler{}
	p := Project{ProjectStatus: "running", DesiredStatus: "running", CurrentImageTag: "abc123"}
	observed := &PodState{Phase: "Running", Image: ":abc123", RestartCount: 2}
	drift := r.detectDrift(p, observed)
	if drift != nil {
		t.Error("expected nil drift when everything matches")
	}
}
