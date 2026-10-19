import { config } from './config.js';
import { getIndex as getPineconeIndex } from './pinecone.js';
import { getQdrantStore } from './qdrant.js';

/**
 * Returns the appropriate vector store adapter based on config.vectorDb.
 * Supports 'pinecone' (default) and 'qdrant'.
 *
 * @param {string} [namespace]
 */
export function getVectorStore(namespace) {
  if (config.vectorDb === 'qdrant') {
    return getQdrantStore(namespace);
  }
  return getPineconeIndex(namespace);
}
