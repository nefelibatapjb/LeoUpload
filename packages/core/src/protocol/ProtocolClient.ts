import {
  UploadError,
  type ChunkUploadResponse,
  type CompleteUploadRequest,
  type CompleteUploadResponse,
  type InitUploadRequest,
  type InitUploadResponse,
  type ServerEndpoints,
  type UploadProgressResponse,
} from '../types';

/**
 * HTTP client implementing the LeoUpload REST protocol.
 */
export class ProtocolClient {
  private endpoints: ServerEndpoints;
  private headers: Record<string, string>;
  private timeout: number;

  constructor(
    endpoints: ServerEndpoints,
    headers: Record<string, string> = {},
    timeout = 120000,
  ) {
    this.endpoints = endpoints;
    this.headers = headers;
    this.timeout = timeout;
  }

  /**
   * Initialize an upload session.
   */
  async initUpload(request: InitUploadRequest): Promise<InitUploadResponse> {
    const response = await this.request<InitUploadResponse>(this.endpoints.init, {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return response;
  }

  /**
   * Upload a single chunk. Uses multipart/form-data.
   */
  async uploadChunk(
    uploadId: string,
    chunkIndex: number,
    chunkHash: string,
    totalChunks: number,
    chunkBlob: Blob,
    signal?: AbortSignal,
  ): Promise<ChunkUploadResponse> {
    const formData = new FormData();
    formData.append('uploadId', uploadId);
    formData.append('chunkIndex', String(chunkIndex));
    formData.append('chunkHash', chunkHash);
    formData.append('totalChunks', String(totalChunks));
    formData.append('file', chunkBlob, `chunk_${chunkIndex}`);

    const response = await this.request<ChunkUploadResponse>(this.endpoints.chunk, {
      method: 'POST',
      body: formData,
      signal,
      // Don't set Content-Type — browser sets it with boundary for FormData
    });

    if (!response.received) {
      throw new UploadError(
        response.error || 'Chunk upload rejected',
        'CHUNK_HASH_MISMATCH',
        { chunkIndex, uploadId, retryable: true },
      );
    }

    return response;
  }

  /**
   * Query server for upload progress (which chunks are already stored).
   */
  async getProgress(uploadId: string): Promise<UploadProgressResponse> {
    const url = `${this.endpoints.progress}/${uploadId}`;
    const response = await this.request<UploadProgressResponse>(url);
    return response;
  }

  /**
   * Signal the server to merge all chunks into the final file.
   */
  async completeUpload(
    uploadId: string,
    checksums?: Record<number, string>,
    metadata?: Record<string, string>,
  ): Promise<CompleteUploadResponse> {
    const url = `${this.endpoints.complete}/${uploadId}`;
    const body: CompleteUploadRequest = {};
    if (checksums) body.checksums = checksums;
    if (metadata) body.metadata = metadata;

    const response = await this.request<CompleteUploadResponse>(url, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return response;
  }

  /**
   * Cancel an upload and clean up server-side chunks.
   */
  async cancelUpload(uploadId: string): Promise<{ status: string }> {
    const url = `${this.endpoints.cancel}/${uploadId}`;
    const response = await this.request<{ status: string }>(url, {
      method: 'DELETE',
    });
    return response;
  }

  // ---- Private ----

  private async request<T>(
    url: string,
    options: RequestInit = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const mergedHeaders: Record<string, string> = {
      ...this.headers,
    };

    // Only set Content-Type for JSON bodies — FormData sets its own
    if (options.body && typeof options.body === 'string') {
      mergedHeaders['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: mergedHeaders,
        signal: options.signal ?? controller.signal,
      });

      if (!response.ok) {
        const statusCode = response.status;

        // 409 Conflict — chunk hash mismatch (retryable)
        if (statusCode === 409) {
          const body = await response.json().catch(() => ({}));
          throw new UploadError(body.error || 'Chunk hash mismatch', 'CHUNK_HASH_MISMATCH', {
            statusCode,
            retryable: true,
          });
        }

        // Server errors — retryable
        if (statusCode >= 500) {
          throw new UploadError(`Server error: ${response.statusText}`, 'SERVER_ERROR', {
            statusCode,
            retryable: true,
          });
        }

        // Timeout
        if (statusCode === 408) {
          throw new UploadError('Request timeout', 'TIMEOUT', {
            statusCode,
            retryable: true,
          });
        }

        // Client errors (except 409) — not retryable
        const body = await response.json().catch(() => ({}));
        throw new UploadError(body.error || response.statusText, 'INVALID_RESPONSE', {
          statusCode,
          retryable: false,
        });
      }

      return response.json() as Promise<T>;
    } catch (err) {
      if (err instanceof UploadError) throw err;

      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new UploadError('Request timed out', 'TIMEOUT', { retryable: true });
      }

      throw new UploadError(
        err instanceof Error ? err.message : 'Network error',
        'NETWORK_ERROR',
        { retryable: true },
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
