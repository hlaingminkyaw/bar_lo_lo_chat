import { Pinecone } from '@pinecone-database/pinecone';
import { config } from './config.js';

// Module-level cache: warm serverless invocations reuse the same client.
let client;

export function getPinecone() {
  client ??= new Pinecone({ apiKey: config.pineconeApiKey });
  return client;
}

export function getIndex(namespace = config.pineconeNamespace) {
  return getPinecone().index({ name: config.pineconeIndex, namespace });
}
