package service

import (
	"crypto/md5"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/leopan/leoupload-demo-go/internal/store"
)

type InitRequest struct {
	FileName    string            `json:"fileName"`
	FileSize    int64             `json:"fileSize"`
	FileType    string            `json:"fileType"`
	ChunkSize   int64             `json:"chunkSize"`
	TotalChunks int               `json:"totalChunks"`
	Checksum    string            `json:"checksum,omitempty"`
	Metadata    map[string]string `json:"metadata,omitempty"`
}

type InitResponse struct {
	UploadID       string `json:"uploadId"`
	ChunkSize      int64  `json:"chunkSize"`
	UploadedChunks []int  `json:"uploadedChunks"`
	ExpiresAt      string `json:"expiresAt"`
}

type ChunkRequest struct {
	UploadID     string
	ChunkIndex   int
	ChunkHash    string
	TotalChunks  int
	Data         []byte
	OriginalHash string
}

type ChunkResponse struct {
	UploadID     string `json:"uploadId"`
	ChunkIndex   int    `json:"chunkIndex"`
	Received     bool   `json:"received"`
	WrittenBytes int    `json:"writtenBytes,omitempty"`
	Error        string `json:"error,omitempty"`
}

type ProgressResponse struct {
	UploadID       string `json:"uploadId"`
	FileName       string `json:"fileName"`
	FileSize       int64  `json:"fileSize"`
	TotalChunks    int    `json:"totalChunks"`
	UploadedChunks []int  `json:"uploadedChunks"`
	ChunkSize      int64  `json:"chunkSize"`
	Status         string `json:"status"`
	CreatedAt      string `json:"createdAt"`
	ExpiresAt      string `json:"expiresAt"`
}

type CompleteResponse struct {
	UploadID string `json:"uploadId"`
	Status   string `json:"status"`
	FileURL  string `json:"fileUrl"`
	FileSize int64  `json:"fileSize"`
	Checksum string `json:"checksum"`
}

type session struct {
	uploadID       string
	fileName       string
	fileSize       int64
	fileType       string
	chunkSize      int64
	totalChunks    int
	uploadedChunks map[int]bool
	status         string
	createdAt      time.Time
	expiresAt      time.Time
}

type UploadService struct {
	store    *store.FileStore
	sessions map[string]*session
	mu       sync.RWMutex
	ttl      time.Duration
}

func NewUploadService(store *store.FileStore) *UploadService {
	svc := &UploadService{
		store:    store,
		sessions: make(map[string]*session),
		ttl:      24 * time.Hour,
	}
	go svc.periodicCleanup()
	return svc
}

func (s *UploadService) InitUpload(req *InitRequest) (*InitResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check for existing session by fingerprint
	fp := fingerprint(req.FileName, req.FileSize, req.FileType)
	for _, sess := range s.sessions {
		if fingerprint(sess.fileName, sess.fileSize, sess.fileType) == fp && sess.status == "uploading" {
			chunks, _ := s.store.GetUploadedChunks(sess.uploadID)
			return &InitResponse{
				UploadID:       sess.uploadID,
				ChunkSize:      sess.chunkSize,
				UploadedChunks: chunks,
				ExpiresAt:      sess.expiresAt.Format(time.RFC3339),
			}, nil
		}
	}

	id := uuid.New().String()
	now := time.Now()

	sess := &session{
		uploadID:       id,
		fileName:       req.FileName,
		fileSize:       req.FileSize,
		fileType:       req.FileType,
		chunkSize:      req.ChunkSize,
		totalChunks:    req.TotalChunks,
		uploadedChunks: make(map[int]bool),
		status:         "uploading",
		createdAt:      now,
		expiresAt:      now.Add(s.ttl),
	}

	s.sessions[id] = sess
	s.store.CreateUploadDir(id)

	return &InitResponse{
		UploadID:       id,
		ChunkSize:      req.ChunkSize,
		UploadedChunks: []int{},
		ExpiresAt:      sess.expiresAt.Format(time.RFC3339),
	}, nil
}

func (s *UploadService) UploadChunk(req *ChunkRequest) *ChunkResponse {
	s.mu.RLock()
	sess, ok := s.sessions[req.UploadID]
	s.mu.RUnlock()

	if !ok {
		return &ChunkResponse{
			UploadID:   req.UploadID,
			ChunkIndex: req.ChunkIndex,
			Received:   false,
			Error:      "Upload session not found",
		}
	}

	// Verify chunk hash
	actualHash := md5Hash(req.Data)
	if req.OriginalHash != "" && actualHash != req.OriginalHash {
		return &ChunkResponse{
			UploadID:   req.UploadID,
			ChunkIndex: req.ChunkIndex,
			Received:   false,
			Error:      "CHUNK_HASH_MISMATCH",
		}
	}

	if err := s.store.WriteChunk(req.UploadID, req.ChunkIndex, req.Data); err != nil {
		return &ChunkResponse{
			UploadID:   req.UploadID,
			ChunkIndex: req.ChunkIndex,
			Received:   false,
			Error:      err.Error(),
		}
	}

	s.mu.Lock()
	sess.uploadedChunks[req.ChunkIndex] = true
	s.mu.Unlock()

	return &ChunkResponse{
		UploadID:     req.UploadID,
		ChunkIndex:   req.ChunkIndex,
		Received:     true,
		WrittenBytes: len(req.Data),
	}
}

func (s *UploadService) GetProgress(uploadId string) (*ProgressResponse, error) {
	s.mu.RLock()
	sess, ok := s.sessions[uploadId]
	s.mu.RUnlock()

	if !ok {
		return nil, fmt.Errorf("upload session not found")
	}

	chunks, _ := s.store.GetUploadedChunks(uploadId)

	return &ProgressResponse{
		UploadID:       uploadId,
		FileName:       sess.fileName,
		FileSize:       sess.fileSize,
		TotalChunks:    sess.totalChunks,
		UploadedChunks: chunks,
		ChunkSize:      sess.chunkSize,
		Status:         sess.status,
		CreatedAt:      sess.createdAt.Format(time.RFC3339),
		ExpiresAt:      sess.expiresAt.Format(time.RFC3339),
	}, nil
}

func (s *UploadService) CompleteUpload(uploadId string, checksums map[int]string) (*CompleteResponse, error) {
	s.mu.RLock()
	sess, ok := s.sessions[uploadId]
	s.mu.RUnlock()

	if !ok {
		return nil, fmt.Errorf("upload session not found")
	}

	// If the user already cancelled, refuse to merge
	if sess.status == "cancelled" {
		s.store.Cleanup(uploadId)
		return nil, fmt.Errorf("upload has been cancelled")
	}

	chunks, err := s.store.GetUploadedChunks(uploadId)
	if err != nil || len(chunks) != sess.totalChunks {
		return nil, fmt.Errorf("not all chunks uploaded: %d/%d", len(chunks), sess.totalChunks)
	}

	// Merge
	outputPath := fmt.Sprintf("uploads/%s", sess.fileName)
	if err := s.store.MergeChunks(uploadId, sess.totalChunks, outputPath); err != nil {
		return nil, err
	}

	// Compute checksum
	checksum, _ := s.store.FileChecksum(outputPath)

	s.mu.Lock()
	sess.status = "completed"
	s.mu.Unlock()

	// Cleanup
	s.store.Cleanup(uploadId)

	return &CompleteResponse{
		UploadID: uploadId,
		Status:   "completed",
		FileURL:  "/uploads/" + sess.fileName,
		FileSize: sess.fileSize,
		Checksum: checksum,
	}, nil
}

func (s *UploadService) CancelUpload(uploadId string) {
	s.mu.Lock()
	sess, ok := s.sessions[uploadId]
	if ok {
		sess.status = "cancelled"
		// Also delete the merged output file if it was already created
		outputPath := fmt.Sprintf("uploads/%s", sess.fileName)
		os.Remove(outputPath) // Best effort — file may not exist yet
	}
	s.mu.Unlock()
	s.store.Cleanup(uploadId)
}

func (s *UploadService) periodicCleanup() {
	ticker := time.NewTicker(1 * time.Hour)
	for range ticker.C {
		s.mu.Lock()
		now := time.Now()
		for id, sess := range s.sessions {
			if sess.expiresAt.Before(now) {
				s.store.Cleanup(id)
				delete(s.sessions, id)
			}
		}
		s.mu.Unlock()
		log.Println("[LeoUpload] Periodic cleanup completed")
	}
}

func fingerprint(fileName string, fileSize int64, fileType string) string {
	h := sha256.New()
	h.Write([]byte(fmt.Sprintf("%s|%d|%s", fileName, fileSize, fileType)))
	return hex.EncodeToString(h.Sum(nil))
}

func md5Hash(data []byte) string {
	h := md5.New()
	h.Write(data)
	return hex.EncodeToString(h.Sum(nil))
}
