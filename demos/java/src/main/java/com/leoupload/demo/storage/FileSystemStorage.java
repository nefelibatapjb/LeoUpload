package com.leoupload.demo.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Component
public class FileSystemStorage {

    private final Path baseDir;

    public FileSystemStorage(@Value("${leoupload.upload-dir:./uploads}") String baseDir) {
        this.baseDir = Path.of(baseDir);
    }

    public void createUploadDir(String uploadId) {
        try {
            Files.createDirectories(uploadDir(uploadId));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public void writeChunk(String uploadId, int chunkIndex, byte[] data) {
        try {
            Files.write(chunkPath(uploadId, chunkIndex), data);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public byte[] readChunk(String uploadId, int chunkIndex) {
        try {
            return Files.readAllBytes(chunkPath(uploadId, chunkIndex));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public List<Integer> getUploadedChunks(String uploadId) {
        Path dir = uploadDir(uploadId);
        if (!Files.exists(dir)) return Collections.emptyList();

        try (var stream = Files.list(dir)) {
            return stream
                    .filter(p -> p.getFileName().toString().startsWith("chunk_"))
                    .map(p -> {
                        String name = p.getFileName().toString()
                                .replace("chunk_", "")
                                .replace(".part", "");
                        try {
                            return Integer.parseInt(name);
                        } catch (NumberFormatException e) {
                            return -1;
                        }
                    })
                    .filter(i -> i >= 0)
                    .sorted()
                    .toList();
        } catch (IOException e) {
            return Collections.emptyList();
        }
    }

    public void mergeChunks(String uploadId, int totalChunks, String outputPath) throws IOException {
        Path output = Path.of(outputPath);
        Files.createDirectories(output.getParent());

        try (OutputStream out = Files.newOutputStream(output)) {
            for (int i = 0; i < totalChunks; i++) {
                byte[] chunkData = Files.readAllBytes(chunkPath(uploadId, i));
                out.write(chunkData);
            }
        }
    }

    public String fileChecksum(String filePath) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            try (InputStream in = Files.newInputStream(Path.of(filePath))) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = in.read(buffer)) != -1) {
                    md.update(buffer, 0, read);
                }
            }
            byte[] digest = md.digest();
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException | IOException e) {
            return "";
        }
    }

    public void cleanup(String uploadId) {
        try {
            Path dir = uploadDir(uploadId);
            if (Files.exists(dir)) {
                try (var stream = Files.walk(dir)) {
                    stream.sorted(java.util.Comparator.reverseOrder())
                            .forEach(p -> {
                                try {
                                    Files.delete(p);
                                } catch (IOException ignored) {
                                }
                            });
                }
            }
        } catch (IOException ignored) {
        }
    }

    private Path uploadDir(String uploadId) {
        return baseDir.resolve(uploadId);
    }

    private Path chunkPath(String uploadId, int chunkIndex) {
        return uploadDir(uploadId).resolve("chunk_" + chunkIndex + ".part");
    }
}
