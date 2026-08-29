package com.leoupload.demo.service;

import com.leoupload.demo.model.*;
import com.leoupload.demo.storage.FileSystemStorage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class UploadService {

    private final FileSystemStorage storage;
    private final Map<String, UploadSession> sessions = new ConcurrentHashMap<>();
    private final int sessionTtlHours;

    public UploadService(
            FileSystemStorage storage,
            @Value("${leoupload.session-ttl-hours:24}") int sessionTtlHours) {
        this.storage = storage;
        this.sessionTtlHours = sessionTtlHours;
    }

    public InitUploadResponse initUpload(InitUploadRequest req) {
        String fingerprint = fingerprint(req.getFileName(), req.getFileSize(), req.getFileType());

        // Check for existing session
        for (UploadSession session : sessions.values()) {
            String sessionFp = fingerprint(
                    session.getFileName(), session.getFileSize(), session.getFileType());
            if (sessionFp.equals(fingerprint) && "uploading".equals(session.getStatus())) {
                List<Integer> uploadedChunks = storage.getUploadedChunks(session.getUploadId());
                return new InitUploadResponse(
                        session.getUploadId(),
                        session.getChunkSize(),
                        uploadedChunks,
                        session.getExpiresAt().toString());
            }
        }

        String uploadId = UUID.randomUUID().toString();
        Instant now = Instant.now();
        Instant expiresAt = now.plus(sessionTtlHours, ChronoUnit.HOURS);

        UploadSession session = new UploadSession(
                uploadId,
                req.getFileName(),
                req.getFileSize(),
                req.getFileType() != null ? req.getFileType() : "application/octet-stream",
                req.getChunkSize() != null ? req.getChunkSize() : 5 * 1024 * 1024,
                req.getTotalChunks(),
                new HashSet<>(),
                "uploading",
                now,
                expiresAt);

        sessions.put(uploadId, session);
        storage.createUploadDir(uploadId);

        return new InitUploadResponse(uploadId, session.getChunkSize(), List.of(), expiresAt.toString());
    }

    public ChunkUploadResponse uploadChunk(
            String uploadId, int chunkIndex, String chunkHash,
            int totalChunks, byte[] chunkData) {

        UploadSession session = sessions.get(uploadId);
        if (session == null) {
            return new ChunkUploadResponse(uploadId, chunkIndex, false, 0,
                    "Upload session not found");
        }

        // Verify chunk hash
        String actualHash = md5Hex(chunkData);
        if (chunkHash != null && !chunkHash.isEmpty() && !actualHash.equals(chunkHash)) {
            return new ChunkUploadResponse(uploadId, chunkIndex, false, 0,
                    "CHUNK_HASH_MISMATCH");
        }

        storage.writeChunk(uploadId, chunkIndex, chunkData);
        session.getUploadedChunks().add(chunkIndex);

        return new ChunkUploadResponse(uploadId, chunkIndex, true, chunkData.length, null);
    }

    public UploadProgressResponse getProgress(String uploadId) {
        UploadSession session = sessions.get(uploadId);
        if (session == null) return null;

        List<Integer> uploadedChunks = storage.getUploadedChunks(uploadId);

        return new UploadProgressResponse(
                uploadId,
                session.getFileName(),
                session.getFileSize(),
                session.getTotalChunks(),
                uploadedChunks,
                session.getChunkSize(),
                session.getStatus(),
                session.getCreatedAt().toString(),
                session.getExpiresAt().toString());
    }

    public CompleteUploadResponse completeUpload(
            String uploadId, Map<String, String> checksums) throws IOException {

        UploadSession session = sessions.get(uploadId);
        if (session == null) {
            throw new IllegalArgumentException("Upload session not found");
        }

        // If the user already cancelled, refuse to merge
        if ("cancelled".equals(session.getStatus())) {
            storage.cleanup(uploadId);
            throw new IllegalStateException("Upload has been cancelled");
        }

        List<Integer> uploadedChunks = storage.getUploadedChunks(uploadId);
        if (uploadedChunks.size() != session.getTotalChunks()) {
            throw new IllegalStateException(
                    "Not all chunks uploaded: " + uploadedChunks.size() + "/" + session.getTotalChunks());
        }

        // Validate checksums if provided
        if (checksums != null && !checksums.isEmpty()) {
            for (Map.Entry<String, String> entry : checksums.entrySet()) {
                int idx = Integer.parseInt(entry.getKey());
                byte[] chunkData = storage.readChunk(uploadId, idx);
                String actualHash = md5Hex(chunkData);
                if (!actualHash.equals(entry.getValue())) {
                    throw new IllegalStateException("Chunk " + idx + " hash mismatch");
                }
            }
        }

        // Merge chunks
        String outputPath = "uploads/" + session.getFileName();
        storage.mergeChunks(uploadId, session.getTotalChunks(), outputPath);

        // Compute checksum
        String checksum = storage.fileChecksum(outputPath);

        session.setStatus("completed");

        // Clean up chunks
        storage.cleanup(uploadId);

        return new CompleteUploadResponse(
                uploadId, "completed", "/uploads/" + session.getFileName(),
                session.getFileSize(), checksum);
    }

    public void cancelUpload(String uploadId) {
        UploadSession session = sessions.get(uploadId);
        if (session != null) {
            session.setStatus("cancelled");
            // Also delete the merged output file if it was already created
            try {
                java.nio.file.Files.deleteIfExists(java.nio.file.Path.of("uploads", session.getFileName()));
            } catch (IOException e) {
                // Best effort — file may not exist
            }
        }
        storage.cleanup(uploadId);
    }

    @Scheduled(fixedRate = 3600000) // Every hour
    public void cleanupExpired() {
        Instant now = Instant.now();
        List<String> toRemove = new ArrayList<>();
        for (Map.Entry<String, UploadSession> entry : sessions.entrySet()) {
            if (entry.getValue().getExpiresAt().isBefore(now)) {
                storage.cleanup(entry.getKey());
                toRemove.add(entry.getKey());
            }
        }
        toRemove.forEach(sessions::remove);
    }

    private String fingerprint(String fileName, Long fileSize, String fileType) {
        String input = fileName + "|" + fileSize + "|" + fileType;
        return sha256Hex(input.getBytes(StandardCharsets.UTF_8));
    }

    private static String md5Hex(byte[] data) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] digest = md.digest(data);
            return bytesToHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("MD5 not available", e);
        }
    }

    private static String sha256Hex(byte[] data) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(data);
            return bytesToHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
