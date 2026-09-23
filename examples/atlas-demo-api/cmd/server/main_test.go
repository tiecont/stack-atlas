package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthEndpointsAndReadinessToggle(t *testing.T) {
	state := &appState{}
	state.ready.Store(true)
	handler := newHandler(state)

	for _, endpoint := range []struct {
		path string
		want int
	}{{"/health/live", http.StatusOK}, {"/health/ready", http.StatusOK}} {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, endpoint.path, nil))
		if response.Code != endpoint.want {
			t.Fatalf("GET %s status = %d, want %d", endpoint.path, response.Code, endpoint.want)
		}
	}

	toggle := httptest.NewRecorder()
	handler.ServeHTTP(toggle, httptest.NewRequest(http.MethodPost, "/toggle-ready", nil))
	if toggle.Code != http.StatusOK {
		t.Fatalf("POST /toggle-ready status = %d, want %d", toggle.Code, http.StatusOK)
	}
	readiness := httptest.NewRecorder()
	handler.ServeHTTP(readiness, httptest.NewRequest(http.MethodGet, "/health/ready", nil))
	if readiness.Code != http.StatusServiceUnavailable {
		t.Fatalf("GET /health/ready after toggle status = %d, want %d", readiness.Code, http.StatusServiceUnavailable)
	}
	liveness := httptest.NewRecorder()
	handler.ServeHTTP(liveness, httptest.NewRequest(http.MethodGet, "/health/live", nil))
	if liveness.Code != http.StatusOK {
		t.Fatalf("GET /health/live after readiness toggle status = %d, want %d", liveness.Code, http.StatusOK)
	}
}

func TestBoundedQueryInt(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/work?ms=20", nil)
	got, err := boundedQueryInt(request, "ms", 100, 0, 5000)
	if err != nil || got != 20 {
		t.Fatalf("boundedQueryInt() = %d, %v; want 20, nil", got, err)
	}

	request = httptest.NewRequest(http.MethodGet, "/work?ms=9000", nil)
	if _, err := boundedQueryInt(request, "ms", 100, 0, 5000); err == nil {
		t.Fatal("boundedQueryInt accepted an out-of-range value")
	}
}

func TestDemoEndpoints(t *testing.T) {
	t.Setenv("APP_VERSION", "test-version")
	t.Setenv("DEPENDENCY_NAMES", "postgres,redis")
	state := &appState{}
	state.ready.Store(true)
	handler := newHandler(state)

	for _, path := range []string{"/version", "/dependencies", "/work?ms=0", "/memory?mb=1"} {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, path, nil))
		if response.Code != http.StatusOK {
			t.Errorf("GET %s status = %d, want %d", path, response.Code, http.StatusOK)
		}
		if got := response.Header().Get("Content-Type"); got != "application/json" {
			t.Errorf("GET %s content type = %q, want application/json", path, got)
		}
	}
}
