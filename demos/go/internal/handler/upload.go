package handler

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/leopan/leoupload-demo-go/internal/service"
)

type UploadHandler struct {
	svc *service.UploadService
}

func NewUploadHandler(svc *service.UploadService) *UploadHandler {
	return &UploadHandler{svc: svc}
}

// POST /api/upload/init
func (h *UploadHandler) InitUpload(w http.ResponseWriter, r *http.Request) {
	var req service.InitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if req.FileName == "" || req.FileSize == 0 || req.TotalChunks == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing required fields"})
		return
	}

	resp, err := h.svc.InitUpload(&req)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusCreated, resp)
}

// POST /api/upload/chunk
func (h *UploadHandler) UploadChunk(w http.ResponseWriter, r *http.Request) {
	// Parse multipart form (max 100 MB)
	if err := r.ParseMultipartForm(100 << 20); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "failed to parse form"})
		return
	}

	uploadId := r.FormValue("uploadId")
	chunkIdxStr := r.FormValue("chunkIndex")
	chunkHash := r.FormValue("chunkHash")
	totalChunksStr := r.FormValue("totalChunks")

	chunkIndex, err := strconv.Atoi(chunkIdxStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid chunkIndex"})
		return
	}

	totalChunks, err := strconv.Atoi(totalChunksStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid totalChunks"})
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing file field"})
		return
	}
	defer file.Close()

	chunkData, err := io.ReadAll(file)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to read chunk"})
		return
	}

	req := &service.ChunkRequest{
		UploadID:     uploadId,
		ChunkIndex:   chunkIndex,
		ChunkHash:    chunkHash,
		TotalChunks:  totalChunks,
		Data:         chunkData,
		OriginalHash: chunkHash,
	}

	resp := h.svc.UploadChunk(req)
	if !resp.Received {
		writeJSON(w, http.StatusConflict, resp)
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// GET /api/upload/progress/{uploadId}
func (h *UploadHandler) GetProgress(w http.ResponseWriter, r *http.Request) {
	uploadId := chi.URLParam(r, "uploadId")
	if uploadId == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing uploadId"})
		return
	}

	progress, err := h.svc.GetProgress(uploadId)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, progress)
}

// POST /api/upload/complete/{uploadId}
func (h *UploadHandler) CompleteUpload(w http.ResponseWriter, r *http.Request) {
	uploadId := chi.URLParam(r, "uploadId")
	if uploadId == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing uploadId"})
		return
	}

	var body struct {
		Checksums map[string]string `json:"checksums"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	checksums := make(map[int]string)
	for k, v := range body.Checksums {
		idx, err := strconv.Atoi(k)
		if err == nil {
			checksums[idx] = v
		}
	}

	resp, err := h.svc.CompleteUpload(uploadId, checksums)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// DELETE /api/upload/{uploadId}
func (h *UploadHandler) CancelUpload(w http.ResponseWriter, r *http.Request) {
	uploadId := chi.URLParam(r, "uploadId")
	if uploadId == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing uploadId"})
		return
	}

	h.svc.CancelUpload(uploadId)
	writeJSON(w, http.StatusOK, map[string]string{"uploadId": uploadId, "status": "cancelled"})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}
