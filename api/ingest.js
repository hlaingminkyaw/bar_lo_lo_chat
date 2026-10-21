import { route, readJson, sendJson, HttpError } from '../lib/http.js';
import { ingestDocuments } from '../lib/ingest.js';
import { parseNamespace } from '../lib/vector-store.js';

// Keep each request small enough to finish well inside the function timeout.
// For bulk loads, use `npm run ingest` locally instead.
const MAX_DOCUMENTS = 50;
const MAX_TOTAL_CHARS = 1_000_000;

/**
 * POST /api/ingest[?namespace=shop_remax]   (no authentication)
 * The namespace comes from the query parameter or the body; the query wins.
 * Body, either a single document:
 *   { text: string, id?: string, source?: string, metadata?: object, namespace?: string }
 * or many:
 *   { documents: [{ text, id?, source?, metadata? }], namespace?: string }
 * Response: { upserted, documents: [{ id, source, chunks }] }
 */
export default route(['POST'], async (req, res) => {
  const body = await readJson(req);
  const query = new URL(req.url, 'http://localhost').searchParams;
  const namespace = parseNamespace(query.get('namespace') || body.namespace);

  const documents = Array.isArray(body.documents) ? body.documents : body.text ? [body] : [];
  if (!documents.length) {
    throw new HttpError(400, 'Provide "text" or a non-empty "documents" array');
  }
  if (documents.length > MAX_DOCUMENTS) {
    throw new HttpError(413, `At most ${MAX_DOCUMENTS} documents per request`);
  }

  let totalChars = 0;
  const cleaned = documents.map((doc, i) => {
    if (!doc || typeof doc.text !== 'string' || !doc.text.trim()) {
      throw new HttpError(400, `documents[${i}].text must be a non-empty string`);
    }
    totalChars += doc.text.length;
    return {
      text: doc.text,
      id: typeof doc.id === 'string' ? doc.id : undefined,
      source: typeof doc.source === 'string' ? doc.source : undefined,
      metadata: flatMetadata(doc.metadata),
    };
  });
  if (totalChars > MAX_TOTAL_CHARS) {
    throw new HttpError(413, `Total text must be at most ${MAX_TOTAL_CHARS} characters per request`);
  }

  const result = await ingestDocuments(cleaned, { namespace });
  sendJson(res, 200, result);
});

// Pinecone metadata values must be strings, numbers, booleans or string lists.
function flatMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return {};
  const out = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (['string', 'number', 'boolean'].includes(typeof value)) out[key] = value;
    else if (Array.isArray(value) && value.every((v) => typeof v === 'string')) out[key] = value;
  }
  return out;
}
