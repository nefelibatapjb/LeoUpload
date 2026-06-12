package com.leoupload.demo.model;

import java.util.List;

public class UploadProgressResponse {
    private String uploadId;
    private String fileName;
    private Long fileSize;
    private Integer totalChunks;
    private List<Integer> uploadedChunks;
    private Integer chunkSize;
    private String status;
    private String createdAt;
    private String expiresAt;

    public UploadProgressResponse() {}

    public UploadProgressResponse(String uploadId, String fileName, Long fileSize,
                                   Integer totalChunks, List<Integer> uploadedChunks,
                                   Integer chunkSize, String status, String createdAt,
                                   String expiresAt) {
        this.uploadId = uploadId;
        this.fileName = fileName;
        this.fileSize = fileSize;
        this.totalChunks = totalChunks;
        this.uploadedChunks = uploadedChunks;
        this.chunkSize = chunkSize;
        this.status = status;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    public String getUploadId() { return uploadId; }
    public String getFileName() { return fileName; }
    public Long getFileSize() { return fileSize; }
    public Integer getTotalChunks() { return totalChunks; }
    public List<Integer> getUploadedChunks() { return uploadedChunks; }
    public Integer getChunkSize() { return chunkSize; }
    public String getStatus() { return status; }
    public String getCreatedAt() { return createdAt; }
    public String getExpiresAt() { return expiresAt; }
}
