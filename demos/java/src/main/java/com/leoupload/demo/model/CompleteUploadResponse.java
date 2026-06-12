package com.leoupload.demo.model;

public class CompleteUploadResponse {
    private String uploadId;
    private String status;
    private String fileUrl;
    private Long fileSize;
    private String checksum;

    public CompleteUploadResponse() {}

    public CompleteUploadResponse(String uploadId, String status, String fileUrl, Long fileSize, String checksum) {
        this.uploadId = uploadId;
        this.status = status;
        this.fileUrl = fileUrl;
        this.fileSize = fileSize;
        this.checksum = checksum;
    }

    public String getUploadId() { return uploadId; }
    public String getStatus() { return status; }
    public String getFileUrl() { return fileUrl; }
    public Long getFileSize() { return fileSize; }
    public String getChecksum() { return checksum; }
}
