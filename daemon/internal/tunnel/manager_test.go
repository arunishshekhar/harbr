package tunnel

import "testing"

func TestNew(t *testing.T) {
	m := New(nil)
	if m == nil {
		t.Error("expected non-nil manager")
	}
}
