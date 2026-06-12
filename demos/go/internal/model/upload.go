package model

// Shared request/response types.
// Used by handler and service packages for serialization.

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
