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
for (const mod of ['chat', 'history', 'ingest', 'health', 'upload', 'webhook']) {
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

// Verify GET /api/history returns an empty history for invalid or unknown sessions
const { default: historyHandler } = await import('../api/history.js');
for (const url of ['/api/history', '/api/history?sessionId=bad*id', '/api/history?sessionId=3f2b8c1e-4d5a-4b6c-9e7f-0a1b2c3d4e5f']) {
  const res = {
    headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body) { this.body = body; },
  };
  await historyHandler({ method: 'GET', url }, res);
  assert.equal(res.statusCode, 200, `${url} should return 200`);
  assert.deepEqual(JSON.parse(res.body), { history: [] });
  assert.equal(res.headers['cache-control'], 'no-store');
}

// Verify Qdrant point IDs and queries are scoped per namespace (tenant)
process.env.VECTOR_DB = 'qdrant';
assert.equal(getVectorStore('default').pointId('doc1#0'), uuid1, 'default namespace keeps legacy point IDs');
assert.notEqual(getVectorStore('shop_a').pointId('doc1#0'), getVectorStore('shop_b').pointId('doc1#0'), 'same doc in two shops must not collide');
delete process.env.VECTOR_DB;

// Verify namespace parsing for /api/upload, /api/ingest and npm run ingest
const { parseNamespace } = await import('../lib/vector-store.js');
assert.equal(parseNamespace(undefined), undefined);
assert.equal(parseNamespace(''), undefined);
assert.equal(parseNamespace('shop_remax'), 'shop_remax');
for (const bad of ['a b', 'x/y', 'a'.repeat(65), 42]) assert.throws(() => parseNamespace(bad), /namespace/);

// Verify shop config: the committed file is valid, and mistakes fail loudly
const { parseShops, listShops, getShopByPageId, resolvePageToken } = await import('../lib/shops.js');
assert.ok(Array.isArray(listShops()), 'config/shops.json must load');
assert.equal(getShopByPageId('no-such-page'), null);
assert.equal(getShopByPageId(undefined), null);
const shopA = { shopId: 'shop_a', namespace: 'ns_a', pageAccessToken: 'TOKEN_A', maxTokens: 150, customPrompt: '  Be brief.  ' };
const parsedShops = parseShops({ 111: shopA });
assert.deepEqual({ ...parsedShops.get('111') }, {
  pageId: '111', shopId: 'shop_a', shopName: 'shop_a', namespace: 'ns_a', pageAccessToken: 'TOKEN_A', maxTokens: 150, customPrompt: 'Be brief.',
});
assert.throws(() => parseShops([]), /keyed by Facebook Page ID/);
assert.throws(() => parseShops({ 1: { ...shopA, shopId: 'Bad:Id' } }), /shopId/);
assert.throws(() => parseShops({ 1: { ...shopA, namespace: '' } }), /namespace/);
assert.throws(() => parseShops({ 1: { ...shopA, pageAccessToken: 'EAAGm0PX4ZCpsBA' } }), /name of an env var/);
assert.throws(() => parseShops({ 1: { ...shopA, maxTokens: 0 } }), /maxTokens/);
assert.throws(() => parseShops({ 1: shopA, 2: { ...shopA, namespace: 'ns_b' } }), /shopId "shop_a" is used/);
assert.throws(() => parseShops({ 1: shopA, 2: { ...shopA, shopId: 'shop_b' } }), /namespace "ns_a" is used/);
delete process.env.TOKEN_A;
assert.throws(() => resolvePageToken(parsedShops.get('111')), /TOKEN_A is not set/);
process.env.TOKEN_A = 'test-token';
assert.equal(resolvePageToken(parsedShops.get('111')), 'test-token');
delete process.env.TOKEN_A;

// Verify a shop prompt replaces the default bot's name and contact from RULES.md
const { buildSystemMessage } = await import('../lib/rag.js');
const webPrompt = buildSystemMessage([]);
assert.ok(webPrompt.includes('BarLoLo Assistant') && webPrompt.includes('09-887-887-504'), 'web chat keeps the default identity');
assert.ok(!webPrompt.includes('<!--'), 'RULES.md markers must not reach the model');
const shopPrompt = buildSystemMessage([], 'You are Store B Sales Bot. Delivery costs $& extra.');
assert.ok(shopPrompt.includes('You are Store B Sales Bot. Delivery costs $& extra.'));
assert.ok(!shopPrompt.includes('BarLoLo Assistant') && !shopPrompt.includes('09-887-887-504'), 'no other tenant identity in shop prompts');
assert.ok(shopPrompt.includes('No Inline Citations'.toUpperCase()) || shopPrompt.includes('NO INLINE CITATIONS'), 'shared rules still apply');

// Verify Messenger history keys are isolated per shop and degrade without Redis
const { messengerHistoryKey, getMessengerHistory, saveMessengerTurn } = await import('../lib/redis.js');
assert.equal(messengerHistoryKey('remax', '24680135792468'), 'chat:fb:remax:24680135792468');
assert.equal(messengerHistoryKey('bad:shop', '1'), null);
assert.equal(messengerHistoryKey('remax', undefined), null);
assert.deepEqual(await getMessengerHistory('remax', '24680135792468'), []);
await saveMessengerTurn('remax', '24680135792468', 'hi', 'hello');

// Verify the webhook acks, but never answers, messages to unconfigured pages
const { default: webhookHandler } = await import('../api/webhook.js');
const realFetch = globalThis.fetch;
let fetchCalls = 0;
globalThis.fetch = async () => { fetchCalls++; throw new Error('unexpected network call'); };
const webhookRes = {
  headers: {},
  setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
  end(body) { this.body = body; },
};
await webhookHandler({
  method: 'POST',
  url: '/api/webhook',
  body: { object: 'page', entry: [{ messaging: [{ sender: { id: '123' }, recipient: { id: 'no-such-page' }, message: { text: 'hi' } }] }] },
}, webhookRes);
globalThis.fetch = realFetch;
assert.equal(webhookRes.statusCode, 200);
assert.equal(webhookRes.body, 'EVENT_RECEIVED');
assert.equal(fetchCalls, 0, 'unknown pages must not trigger the Send API or RAG');

// Verify embedding calls retry 429s within their budget and fail fast on other errors
const { withRateLimitRetry } = await import('../lib/embeddings.js');
const realWarn = console.warn;
console.warn = () => {};
const pinecone429 = new Error("Request failed. You've reached the max tokens per minute (250000). Status: 429.");
let embedCalls = 0;
const retried = await withRateLimitRetry(async () => {
  if (++embedCalls < 3) throw pinecone429;
  return 'ok';
}, { budgetMs: 100, waitedMs: 0 }, { baseDelayMs: 1 });
assert.equal(retried, 'ok');
assert.equal(embedCalls, 3);
embedCalls = 0;
await assert.rejects(withRateLimitRetry(async () => { embedCalls++; throw pinecone429; }, { budgetMs: 10, waitedMs: 0 }, { baseDelayMs: 4 }), /Status: 429/);
assert.equal(embedCalls, 2, 'gives up once the retry budget is spent');
embedCalls = 0;
await assert.rejects(withRateLimitRetry(async () => { embedCalls++; throw new Error('Status: 400.'); }, { budgetMs: 100, waitedMs: 0 }, { baseDelayMs: 1 }));
assert.equal(embedCalls, 1, 'non-429 errors are not retried');
console.warn = realWarn;

console.log(`OK: ${chunks.length} chunks; Qdrant/Pinecone verified; AI providers verified; all handlers load; Redis history fallback verified; ${listShops().length} shop(s) configured, tenant routing verified; embedding 429 retry verified.`);
