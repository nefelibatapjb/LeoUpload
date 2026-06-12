package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/leopan/leoupload-demo-go/internal/handler"
	"github.com/leopan/leoupload-demo-go/internal/service"
	"github.com/leopan/leoupload-demo-go/internal/store"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	fs := store.NewFileStore("./uploads")
	svc := service.NewUploadService(fs)
	h := handler.NewUploadHandler(svc)

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(corsMiddleware)

	// Upload endpoints
	r.Post("/api/upload/init", h.InitUpload)
	r.Post("/api/upload/chunk", h.UploadChunk)
	r.Get("/api/upload/progress/{uploadId}", h.GetProgress)
	r.Post("/api/upload/complete/{uploadId}", h.CompleteUpload)
	r.Delete("/api/upload/{uploadId}", h.CancelUpload)

	// Health check
	r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok","service":"leoupload-go"}`))
	})

	addr := fmt.Sprintf(":%s", port)
	log.Printf("[LeoUpload] Go demo server running on http://localhost%s", addr)
	log.Println("[LeoUpload] Upload endpoints:")
	log.Println("  POST /api/upload/init")
	log.Println("  POST /api/upload/chunk")
	log.Println("  GET  /api/upload/progress/:uploadId")
	log.Println("  POST /api/upload/complete/:uploadId")
	log.Println("  DELETE /api/upload/:uploadId")

	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatal(err)
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
