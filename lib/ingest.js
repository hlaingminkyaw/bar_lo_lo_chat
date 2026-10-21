import { createHash } from 'node:crypto';
import { config } from './config.js';
import { chunkText } from './chunk.js';
import { embed } from './embeddings.js';
import { getVectorStore } from './vector-store.js';

const UPSERT_BATCH = 100;

/**
 * Chunk, embed and upsert documents into Pinecone.
 *
 * Vector IDs are `${docId}#${chunkIndex}`, so re-ingesting the same document
 * overwrites its chunks instead of duplicating them.
 *
 * With `replace: true`, chunks left over from an earlier, longer version of the
 * same document are deleted after the new ones are written.
 *
 * @param {{ id?: string, text: string, source?: string, metadata?: object }[]} documents
 * @param {{ namespace?: string, replace?: boolean, retryBudgetMs?: number }} [opts]
 *   `retryBudgetMs` is how long embedding may wait out rate limits (see embed()).
 */
export async function ingestDocuments(documents, { namespace, replace = false, retryBudgetMs } = {}) {
  const records = [];
  const summary = [];

  for (const doc of documents) {
    const docId = doc.id || createHash('sha1').update(doc.text).digest('hex').slice(0, 16);
    const chunks = chunkText(doc.text, {
      chunkSize: config.chunkSize,
      chunkOverlap: config.chunkOverlap,
    });
    chunks.forEach((text, i) => {
      records.push({
        id: `${docId}#${i}`,
        text,
        metadata: {
          ...doc.metadata,
          docId,
          source: doc.source || docId,
          chunk: i,
          text,
        },
      });
    });
    summary.push({ id: docId, source: doc.source || docId, chunks: chunks.length });
  }

  if (!records.length) return { documents: summary, upserted: 0 };

  const vectors = await embed(records.map((r) => r.text), 'passage', { retryBudgetMs });
  const index = getVectorStore(namespace);

  for (let i = 0; i < records.length; i += UPSERT_BATCH) {
    const batch = records.slice(i, i + UPSERT_BATCH).map((r, j) => ({
      id: r.id,
      values: vectors[i + j],
      metadata: r.metadata,
    }));
    await index.upsert({ records: batch });
  }

  if (replace) {
    const current = new Set(records.map((r) => r.id));
    for (const { id } of summary) await deleteStaleChunks(index, id, current);
  }

  return { documents: summary, upserted: records.length };
}

// Runs after the upsert, so a failure never leaves a document with no chunks.
async function deleteStaleChunks(index, docId, keep) {
  const stale = [];
  let paginationToken;
  do {
    const page = await index.listPaginated({ prefix: `${docId}#`, paginationToken });
    for (const v of page.vectors ?? []) if (!keep.has(v.id)) stale.push(v.id);
    paginationToken = page.pagination?.next;
  } while (paginationToken);

  for (let i = 0; i < stale.length; i += 1000) {
    await index.deleteMany({ ids: stale.slice(i, i + 1000) });
  }
}
