package com.leoupload.demo.controller;

import com.leoupload.demo.model.*;
import com.leoupload.demo.service.UploadService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/upload")
@CrossOrigin(origins = "*")
public class UploadController {

    private final UploadService uploadService;

    public UploadController(UploadService uploadService) {
        this.uploadService = uploadService;
    }

    /**
     * POST /api/upload/init
     */
    @PostMapping("/init")
    public ResponseEntity<InitUploadResponse> initUpload(@RequestBody InitUploadRequest request) {
        if (request.getFileName() == null || request.getFileSize() == null || request.getTotalChunks() == null) {
            return ResponseEntity.badRequest().build();
        }

        InitUploadResponse response = uploadService.initUpload(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * POST /api/upload/chunk
     */
    @PostMapping("/chunk")
    public ResponseEntity<ChunkUploadResponse> uploadChunk(
            @RequestParam("uploadId") String uploadId,
            @RequestParam("chunkIndex") int chunkIndex,
            @RequestParam("chunkHash") String chunkHash,
            @RequestParam("totalChunks") int totalChunks,
            @RequestParam("file") MultipartFile file) {

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        try {
            byte[] chunkData = file.getBytes();
            ChunkUploadResponse response = uploadService.uploadChunk(
                    uploadId, chunkIndex, chunkHash, totalChunks, chunkData);

            if (!response.isReceived()) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
            }

            return ResponseEntity.ok(response);
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * GET /api/upload/progress/{uploadId}
     */
    @GetMapping("/progress/{uploadId}")
    public ResponseEntity<UploadProgressResponse> getProgress(@PathVariable String uploadId) {
        UploadProgressResponse progress = uploadService.getProgress(uploadId);
        if (progress == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(progress);
    }

    /**
     * POST /api/upload/complete/{uploadId}
     */
    @PostMapping("/complete/{uploadId}")
    public ResponseEntity<?> completeUpload(
            @PathVariable String uploadId,
            @RequestBody(required = false) Map<String, Object> body) {

        @SuppressWarnings("unchecked")
        Map<String, String> checksumsRaw = body != null
                ? (Map<String, String>) body.getOrDefault("checksums", Map.of())
                : Map.of();

        try {
            CompleteUploadResponse response = uploadService.completeUpload(uploadId, checksumsRaw);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to merge chunks"));
        }
    }

    /**
     * DELETE /api/upload/{uploadId}
     */
    @DeleteMapping("/{uploadId}")
    public ResponseEntity<Map<String, String>> cancelUpload(@PathVariable String uploadId) {
        uploadService.cancelUpload(uploadId);
        return ResponseEntity.ok(Map.of("uploadId", uploadId, "status", "cancelled"));
    }

    /**
     * GET /api/health
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "ok", "service", "leoupload-java"));
    }
}
