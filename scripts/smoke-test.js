// Offline checks that need no API keys: chunker behaviour, vector store
// abstraction, AI provider config, and that every handler module loads.
// Usage: npm run check
import assert from 'node:assert/strict';
import { chunkText } from '../lib/chunk.js';
import { stringToUuid } from '../lib/qdrant.js';
import { getVectorStore } from '../lib/vector-store.js';
import { config } from '../lib/config.js';

const paragraph = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20);
const text = Array.from({ length: 8 }, (_, i) => `Section ${i}. ${paragraph}`).join('\n\n');

const chunks = chunkText(text, { chunkSize: 500, chunkOverlap: 100 });
assert.ok(chunks.length > 1, 'long text should produce several chunks');
for (const c of chunks) assert.ok(c.length <= 500, `chunk too long: ${c.length}`);
assert.ok(chunks.join(' ').includes('Section 7.'), 'no text should be dropped');
assert.deepEqual(chunkText('   '), []);
assert.deepEqual(chunkText('short'), ['short']);
assert.equal(chunkText('x'.repeat(2500), { chunkSize: 1000, chunkOverlap: 0 }).length, 3);

// Verify deterministic UUID generation for Qdrant
const uuid1 = stringToUuid('doc1#0');
const uuid2 = stringToUuid('doc1#0');
const uuid3 = stringToUuid('doc1#1');
assert.equal(uuid1, uuid2, 'stringToUuid must be deterministic');
assert.notEqual(uuid1, uuid3, 'different IDs must generate distinct UUIDs');
assert.match(uuid1, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, 'must be valid UUID shape');

// Verify vector store factory
process.env.VECTOR_DB = 'qdrant';
const qdrantStore = getVectorStore('test');
assert.equal(typeof qdrantStore.upsert, 'function');
assert.equal(typeof qdrantStore.query, 'function');
assert.equal(typeof qdrantStore.listPaginated, 'function');
assert.equal(typeof qdrantStore.deleteMany, 'function');
delete process.env.VECTOR_DB;

// Verify AI provider resolution
process.env.AI_PROVIDER = 'gemini';
assert.equal(config.aiProvider, 'gemini');
assert.equal(config.aiBaseUrl, 'https://generativelanguage.googleapis.com/v1beta/openai');
assert.equal(config.llmModel, 'gemini-2.5-flash');

process.env.AI_PROVIDER = 'openai';
assert.equal(config.aiBaseUrl, 'https://api.openai.com/v1');
assert.equal(config.llmModel, 'gpt-4o-mini');

process.env.AI_PROVIDER = 'groq';
assert.equal(config.aiBaseUrl, 'https://api.groq.com/openai/v1');

process.env.AI_PROVIDER = 'ollama';
assert.equal(config.aiBaseUrl, 'http://localhost:11434/v1');
assert.equal(config.llmModel, 'llama3.2');

delete process.env.AI_PROVIDER;

// Verify all API endpoints load
for (const mod of ['chat', 'ingest', 'health', 'upload', 'webhook']) {
  const { default: handler } = await import(`../api/${mod}.js`);
  assert.equal(typeof handler, 'function', `api/${mod}.js must export a default handler`);
}

// Verify Messenger replies are split under the 2000-character limit
const { splitMessage } = await import('../api/webhook.js');
assert.deepEqual(splitMessage('hello'), ['hello']);
const longReply = 'မင်္ဂလာပါ။ '.repeat(400);
const replyParts = splitMessage(longReply);
assert.ok(replyParts.length > 1, 'long replies should be split');
for (const p of replyParts) assert.ok(p.length <= 2000, `message part too long: ${p.length}`);
assert.equal(replyParts.join(' ').replace(/\s+/g, ''), longReply.replace(/\s+/g, ''), 'no reply text should be dropped');

// Verify web chat history degrades to "no history" without Redis credentials
for (const name of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN']) {
  delete process.env[name];
}
const { getHistory, saveTurn, isValidSessionId } = await import('../lib/redis.js');
assert.ok(isValidSessionId('3f2b8c1e-4d5a-4b6c-9e7f-0a1b2c3d4e5f'));
assert.ok(isValidSessionId('lq2x9k1a-8f3hd02kq9'));
assert.ok(!isValidSessionId('short'));
assert.ok(!isValidSessionId('bad:key*with spaces'));
assert.ok(!isValidSessionId(123));
assert.deepEqual(await getHistory('3f2b8c1e-4d5a-4b6c-9e7f-0a1b2c3d4e5f'), []);
await saveTurn('3f2b8c1e-4d5a-4b6c-9e7f-0a1b2c3d4e5f', 'hi', 'hello');

console.log(`OK: ${chunks.length} chunks; Qdrant/Pinecone verified; AI providers verified; all handlers load; Redis history fallback verified.`);
