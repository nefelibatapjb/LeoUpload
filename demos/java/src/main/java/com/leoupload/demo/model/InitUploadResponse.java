package com.leoupload.demo.model;

import java.util.List;

public class InitUploadResponse {
    private String uploadId;
    private Integer chunkSize;
    private List<Integer> uploadedChunks;
    private String expiresAt;

    public InitUploadResponse() {}

    public InitUploadResponse(String uploadId, Integer chunkSize, List<Integer> uploadedChunks, String expiresAt) {
        this.uploadId = uploadId;
        this.chunkSize = chunkSize;
        this.uploadedChunks = uploadedChunks;
        this.expiresAt = expiresAt;
    }

    public String getUploadId() { return uploadId; }
    public Integer getChunkSize() { return chunkSize; }
    public List<Integer> getUploadedChunks() { return uploadedChunks; }
    public String getExpiresAt() { return expiresAt; }
}
