package com.leoupload.demo.model;

import java.time.Instant;
import java.util.Set;

public class UploadSession {
    private String uploadId;
    private String fileName;
    private Long fileSize;
    private String fileType;
    private Integer chunkSize;
    private Integer totalChunks;
    private Set<Integer> uploadedChunks;
    private String status;
    private Instant createdAt;
    private Instant expiresAt;

    public UploadSession() {}

    public UploadSession(String uploadId, String fileName, Long fileSize, String fileType,
                          Integer chunkSize, Integer totalChunks, Set<Integer> uploadedChunks,
                          String status, Instant createdAt, Instant expiresAt) {
        this.uploadId = uploadId;
        this.fileName = fileName;
        this.fileSize = fileSize;
        this.fileType = fileType;
        this.chunkSize = chunkSize;
        this.totalChunks = totalChunks;
        this.uploadedChunks = uploadedChunks;
        this.status = status;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    public String getUploadId() { return uploadId; }
    public String getFileName() { return fileName; }
    public Long getFileSize() { return fileSize; }
    public String getFileType() { return fileType; }
    public Integer getChunkSize() { return chunkSize; }
    public Integer getTotalChunks() { return totalChunks; }
    public Set<Integer> getUploadedChunks() { return uploadedChunks; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getExpiresAt() { return expiresAt; }
}
