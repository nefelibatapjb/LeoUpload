import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { UploadService } from '../services/UploadService.js';
import { FileStore } from '../services/FileStore.js';

const router = Router();
const store = new FileStore('./uploads');
const service = new UploadService(store);

// Multer config for chunk uploads — store in memory temporarily
const chunkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max per chunk
});

/**
 * POST /api/upload/init
 * Initialize an upload session.
 */
router.post('/init', async (req: Request, res: Response) => {
  try {
    const { fileName, fileSize, fileType, chunkSize, totalChunks, metadata } = req.body;

    if (!fileName || !fileSize || !totalChunks) {
      return res.status(400).json({ error: 'Missing required fields: fileName, fileSize, totalChunks' });
    }

    const session = await service.initUpload({
      fileName,
      fileSize: Number(fileSize),
      fileType: fileType || 'application/octet-stream',
      chunkSize: Number(chunkSize) || 5 * 1024 * 1024,
      totalChunks: Number(totalChunks),
      metadata,
    });

    return res.status(201).json(session);
  } catch (err) {
    console.error('[LeoUpload] Init error:', err);
    return res.status(500).json({ error: 'Failed to initialize upload' });
  }
});

/**
 * POST /api/upload/chunk
 * Upload a single chunk.
 */
router.post('/chunk', chunkUpload.single('file'), async (req: Request, res: Response) => {
  try {
    const { uploadId, chunkIndex, chunkHash, totalChunks } = req.body;
    const file = req.file;

    if (!uploadId || chunkIndex === undefined || !file) {
      return res.status(400).json({ error: 'Missing required fields: uploadId, chunkIndex, file' });
    }

    const result = await service.uploadChunk({
      uploadId,
      chunkIndex: Number(chunkIndex),
      chunkHash: chunkHash || '',
      totalChunks: Number(totalChunks),
      buffer: file.buffer,
      originalHash: chunkHash || '',
    });

    if (!result.received) {
      return res.status(409).json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error('[LeoUpload] Chunk error:', err);
    return res.status(500).json({ error: 'Failed to upload chunk' });
  }
});

/**
 * GET /api/upload/progress/:uploadId
 * Query upload progress.
 */
router.get('/progress/:uploadId', async (req: Request, res: Response) => {
  try {
    const { uploadId } = req.params;
    const progress = await service.getProgress(uploadId!);
    if (!progress) {
      return res.status(404).json({ error: 'Upload session not found' });
    }
    return res.json(progress);
  } catch (err) {
    console.error('[LeoUpload] Progress error:', err);
    return res.status(500).json({ error: 'Failed to get progress' });
  }
});

/**
 * POST /api/upload/complete/:uploadId
 * Merge chunks into final file.
 */
router.post('/complete/:uploadId', async (req: Request, res: Response) => {
  try {
    const { uploadId } = req.params;
    const { checksums } = req.body || {};

    const result = await service.completeUpload(uploadId!, checksums);
    return res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to complete upload';
    console.error('[LeoUpload] Complete error:', err);
    return res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/upload/:uploadId
 * Cancel upload and clean up.
 */
router.delete('/:uploadId', async (req: Request, res: Response) => {
  try {
    const { uploadId } = req.params;
    await service.cancelUpload(uploadId!);
    return res.json({ uploadId, status: 'cancelled' });
  } catch (err) {
    console.error('[LeoUpload] Cancel error:', err);
    return res.status(500).json({ error: 'Failed to cancel upload' });
  }
});

export { router as uploadRouter };
