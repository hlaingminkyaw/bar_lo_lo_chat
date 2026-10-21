import { config } from './config.js';
import { HttpError } from './http.js';
import { getIndex as getPineconeIndex } from './pinecone.js';
import { getQdrantStore } from './qdrant.js';

// Namespaces separate tenants (one per shop), so keep them to a safe charset.
const NAMESPACE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function isValidNamespace(namespace) {
  return typeof namespace === 'string' && NAMESPACE_PATTERN.test(namespace);
}

/**
 * Namespace from a request body, query string or CLI flag: undefined when
 * absent (the store then uses PINECONE_NAMESPACE), 400 when malformed.
 */
export function parseNamespace(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (!isValidNamespace(value)) {
    throw new HttpError(400, '"namespace" must be 1-64 characters of A-Z a-z 0-9 _ -');
  }
  return value;
}

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
