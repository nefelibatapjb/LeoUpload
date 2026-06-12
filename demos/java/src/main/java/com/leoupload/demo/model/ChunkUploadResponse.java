package com.leoupload.demo.model;

public class ChunkUploadResponse {
    private String uploadId;
    private int chunkIndex;
    private boolean received;
    private int writtenBytes;
    private String error;

    public ChunkUploadResponse() {}

    public ChunkUploadResponse(String uploadId, int chunkIndex, boolean received, int writtenBytes, String error) {
        this.uploadId = uploadId;
        this.chunkIndex = chunkIndex;
        this.received = received;
        this.writtenBytes = writtenBytes;
        this.error = error;
    }

    public String getUploadId() { return uploadId; }
    public int getChunkIndex() { return chunkIndex; }
    public boolean isReceived() { return received; }
    public int getWrittenBytes() { return writtenBytes; }
    public String getError() { return error; }
}
