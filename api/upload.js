import { createHash } from 'node:crypto';
import path from 'node:path';
import multer from 'multer';
import { config } from '../lib/config.js';
import { route, sendJson, requireBearer, HttpError } from '../lib/http.js';
import { extractText, SUPPORTED_EXTENSIONS } from '../lib/extract.js';
import { ingestDocuments } from '../lib/ingest.js';

const MAX_FILES = 10;

/**
 * Both methods require the header  Authorization: Bearer <INGEST_SECRET>,
 * checked before any of the request body is read.
 *
 * GET /api/upload
 *   Verifies the key (used by /admin at sign-in).
 *   Response: { ok: true, maxUploadMb, extensions }
 *
 * POST /api/upload
 *   multipart/form-data with one or more files in the "file" field, plus an
 *   optional "namespace" text field.
 *   Supported: .pdf .docx .xlsx .xls .csv .png .jpg .jpeg .webp .md .txt .html .json
 *   Each chunk is stored in Pinecone with metadata
 *   { text, source, uploadedAt (ms since epoch), fileType, docId, chunk }.
 *   Re-uploading a file with the same name replaces all of its old chunks.
 *   Response: { upserted, files: [{ file, id, chunks, characters } | { file, error }] }
 */
export default route(['GET', 'POST'], async (req, res) => {
  requireBearer(req, config.ingestSecret);
  if (req.method === 'GET') {
    return sendJson(res, 200, { ok: true, maxUploadMb: config.maxUploadMb, extensions: SUPPORTED_EXTENSIONS });
  }

  const files = await receiveFiles(req, res);
  if (!files.length) throw new HttpError(400, 'Attach at least one file in the "file" field');

  const namespace = typeof req.body?.namespace === 'string' && req.body.namespace ? req.body.namespace : undefined;
  const results = [];
  let upserted = 0;

  for (const file of files) {
    try {
      const text = (await extractText(file.buffer, file.originalname)).trim();
      if (!text) throw new HttpError(422, 'No readable text found in this file');

      const { documents, upserted: count } = await ingestDocuments(
        [
          {
            id: uploadId(file.originalname),
            source: file.originalname,
            text,
            metadata: {
              fileType: path.extname(file.originalname).slice(1).toLowerCase(),
              uploadedAt: Date.now(),
            },
          },
        ],
        { namespace, replace: true },
      );
      upserted += count;
      results.push({ file: file.originalname, id: documents[0].id, chunks: count, characters: text.length });
    } catch (err) {
      if (!(err instanceof HttpError)) console.error(`Upload failed for ${file.originalname}:`, err);
      results.push({ file: file.originalname, error: err instanceof HttpError ? err.message : 'Could not process this file' });
    }
  }

  const allFailed = results.every((r) => r.error);
  sendJson(res, allFailed ? 422 : 200, {
    ...(allFailed ? { error: results[0].error } : {}),
    upserted,
    files: results,
  });
});

// Stable id per filename, so re-uploading a file replaces its chunks. Pinecone
// ids must be ASCII, so non-Latin names (e.g. Burmese) are kept unique by a hash.
function uploadId(filename) {
  const slug = filename.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_').slice(0, 60);
  const hash = createHash('sha1').update(filename).digest('hex').slice(0, 8);
  return `upload_${slug}_${hash}`;
}

function receiveFiles(req, res) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: MAX_FILES },
    defParamCharset: 'utf8', // keep non-Latin (e.g. Burmese) filenames intact
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (SUPPORTED_EXTENSIONS.includes(ext)) return cb(null, true);
      cb(new HttpError(415, `Unsupported file type "${ext || file.originalname}". Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`));
    },
  }).array('file', MAX_FILES);

  return new Promise((resolve, reject) => {
    upload(req, res, (err) => {
      if (!err) return resolve(req.files ?? []);
      if (err instanceof HttpError) return reject(err);
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') return reject(new HttpError(413, `Each file must be at most ${config.maxUploadMb} MB`));
        if (err.code === 'LIMIT_FILE_COUNT') return reject(new HttpError(413, `At most ${MAX_FILES} files per request`));
        return reject(new HttpError(400, err.message));
      }
      reject(new HttpError(400, `Could not read the upload: ${err.message}`));
    });
  });
}
