import express from 'express';
import cors from 'cors';
import { uploadRouter } from './routes/upload.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/upload', uploadRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'leoupload-nodejs' });
});

// Error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error('[LeoUpload] Unhandled error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  },
);

app.listen(PORT, () => {
  console.log(`[LeoUpload] Node.js demo server running on http://localhost:${PORT}`);
  console.log(`[LeoUpload] Upload endpoints:`);
  console.log(`  POST /api/upload/init`);
  console.log(`  POST /api/upload/chunk`);
  console.log(`  GET  /api/upload/progress/:uploadId`);
  console.log(`  POST /api/upload/complete/:uploadId`);
  console.log(`  DELETE /api/upload/:uploadId`);
});

export { app };
