package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync/atomic"
	"syscall"
	"time"
)

type appState struct {
	ready atomic.Bool
}

func main() {
	state := &appState{}
	state.ready.Store(true)

	server := &http.Server{
		Addr:              env("LISTEN_ADDR", ":8080"),
		Handler:           newHandler(state),
		ReadHeaderTimeout: 5 * time.Second,
	}

	serveErr := make(chan error, 1)
	go func() {
		log.Printf("atlas-demo-api listening on %s (version=%s)", server.Addr, env("APP_VERSION", "dev"))
		serveErr <- server.ListenAndServe()
	}()

	shutdownSignal, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	select {
	case <-shutdownSignal.Done():
		log.Print("shutdown requested: stop readiness, allow endpoint propagation, then drain")
		state.ready.Store(false)
		time.Sleep(2 * time.Second)
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		if err := server.Shutdown(ctx); err != nil {
			log.Printf("graceful shutdown failed: %v", err)
			_ = server.Close()
		}
	case err := <-serveErr:
		if !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	}
}

func newHandler(state *appState) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health/live", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "alive"})
	})
	mux.HandleFunc("GET /health/ready", func(w http.ResponseWriter, _ *http.Request) {
		if !state.ready.Load() {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not-ready"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
	})
	mux.HandleFunc("GET /version", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"version": env("APP_VERSION", "dev")})
	})
	mux.HandleFunc("GET /dependencies", func(w http.ResponseWriter, _ *http.Request) {
		items := strings.FieldsFunc(os.Getenv("DEPENDENCY_NAMES"), func(r rune) bool { return r == ',' })
		writeJSON(w, http.StatusOK, map[string][]string{"declared_dependencies": items})
	})
	mux.HandleFunc("POST /toggle-ready", func(w http.ResponseWriter, _ *http.Request) {
		state.ready.Store(!state.ready.Load())
		status := "not-ready"
		if state.ready.Load() {
			status = "ready"
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": status})
	})
	mux.HandleFunc("GET /work", func(w http.ResponseWriter, r *http.Request) {
		ms, err := boundedQueryInt(r, "ms", 100, 0, 5000)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		deadline := time.Now().Add(time.Duration(ms) * time.Millisecond)
		value := 0.731
		for time.Now().Before(deadline) {
			value = math.Sqrt(value + 1.001)
		}
		writeJSON(w, http.StatusOK, map[string]any{"requested_ms": ms, "result": value})
	})
	mux.HandleFunc("GET /memory", func(w http.ResponseWriter, r *http.Request) {
		mb, err := boundedQueryInt(r, "mb", 16, 1, 256)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		buffer := make([]byte, mb*1024*1024)
		for index := 0; index < len(buffer); index += 4096 {
			buffer[index] = byte(index)
		}
		writeJSON(w, http.StatusOK, map[string]int{"allocated_mb": mb})
		_ = buffer[len(buffer)-1]
	})
	return mux
}

func boundedQueryInt(r *http.Request, key string, fallback, minimum, maximum int) (int, error) {
	value := r.URL.Query().Get(key)
	if value == "" {
		return fallback, nil
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed < minimum || parsed > maximum {
		return 0, fmt.Errorf("%s must be an integer from %d to %d", key, minimum, maximum)
	}
	return parsed, nil
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
