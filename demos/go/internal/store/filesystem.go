package store

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

type FileStore struct {
	baseDir string
}

func NewFileStore(baseDir string) *FileStore {
	return &FileStore{baseDir: baseDir}
}

func (s *FileStore) CreateUploadDir(uploadId string) error {
	return os.MkdirAll(s.uploadDir(uploadId), 0755)
}

func (s *FileStore) WriteChunk(uploadId string, chunkIndex int, data []byte) error {
	return os.WriteFile(s.chunkPath(uploadId, chunkIndex), data, 0644)
}

func (s *FileStore) GetUploadedChunks(uploadId string) ([]int, error) {
	dir := s.uploadDir(uploadId)
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return []int{}, nil
		}
		return nil, err
	}

	var chunks []int
	for _, entry := range entries {
		name := entry.Name()
		if strings.HasPrefix(name, "chunk_") && strings.HasSuffix(name, ".part") {
			idxStr := strings.TrimPrefix(name, "chunk_")
			idxStr = strings.TrimSuffix(idxStr, ".part")
			idx, err := strconv.Atoi(idxStr)
			if err == nil {
				chunks = append(chunks, idx)
			}
		}
	}

	sort.Ints(chunks)
	return chunks, nil
}

func (s *FileStore) MergeChunks(uploadId string, totalChunks int, outputPath string) error {
	if err := os.MkdirAll(filepath.Dir(outputPath), 0755); err != nil {
		return err
	}

	out, err := os.Create(outputPath)
	if err != nil {
		return err
	}
	defer out.Close()

	for i := 0; i < totalChunks; i++ {
		chunkPath := s.chunkPath(uploadId, i)
		data, err := os.ReadFile(chunkPath)
		if err != nil {
			return fmt.Errorf("failed to read chunk %d: %w", i, err)
		}
		if _, err := out.Write(data); err != nil {
			return err
		}
	}

	return nil
}

func (s *FileStore) FileChecksum(filePath string) (string, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer f.Close()

	h := md5.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func (s *FileStore) Cleanup(uploadId string) {
	os.RemoveAll(s.uploadDir(uploadId))
}

func (s *FileStore) uploadDir(uploadId string) string {
	return filepath.Join(s.baseDir, uploadId)
}

func (s *FileStore) chunkPath(uploadId string, chunkIndex int) string {
	return filepath.Join(s.uploadDir(uploadId), fmt.Sprintf("chunk_%d.part", chunkIndex))
}
