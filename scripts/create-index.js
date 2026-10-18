// One-time setup: creates the Pinecone index with the dimension that matches
// your embedding model. Usage: npm run setup-index
import 'dotenv/config';
import { config } from '../lib/config.js';
import { embedOne } from '../lib/embeddings.js';
import { getPinecone } from '../lib/pinecone.js';

const pc = getPinecone();
const name = config.pineconeIndex;

// Probe the model instead of hard-coding a dimension, so switching
// EMBEDDING_MODEL can't silently create a mismatched index.
console.log(`Embedding a probe string with ${config.embeddingProvider}:${config.embeddingModel}…`);
const dimension = (await embedOne('dimension probe', 'passage')).length;
console.log(`Model dimension: ${dimension}`);

const { indexes = [] } = await pc.indexes.list();
const existing = indexes.find((i) => i.name === name);

if (existing) {
  const current = await pc.indexes.describe(name);
  const currentDim = current.dimension ?? current.schema?.fields?._values?.dimension;
  if (currentDim && currentDim !== dimension) {
    console.error(
      `Index "${name}" exists with dimension ${currentDim}, but the model produces ${dimension}.\n` +
        'Delete the index in the Pinecone console (or pick a new PINECONE_INDEX name) and rerun.',
    );
    process.exit(1);
  }
  console.log(`Index "${name}" already exists. Nothing to do.`);
} else {
  console.log(`Creating serverless index "${name}" (aws/us-east-1, cosine)…`);
  await pc.indexes.create({
    name,
    schema: {
      fields: {
        _values: { type: 'dense_vector', dimension, metric: 'cosine' },
      },
    },
    // The free Starter plan only allows AWS us-east-1.
    deployment: { deploymentType: 'managed', cloud: 'aws', region: 'us-east-1' },
    waitUntilReady: true,
    suppressConflicts: true,
  });
  console.log(`Index "${name}" is ready.`);
}
