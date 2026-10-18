// Offline checks that need no API keys: chunker behaviour and that every
// handler module loads. Usage: npm run check
import assert from 'node:assert/strict';
import { chunkText } from '../lib/chunk.js';

const paragraph = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20);
const text = Array.from({ length: 8 }, (_, i) => `Section ${i}. ${paragraph}`).join('\n\n');

const chunks = chunkText(text, { chunkSize: 500, chunkOverlap: 100 });
assert.ok(chunks.length > 1, 'long text should produce several chunks');
for (const c of chunks) assert.ok(c.length <= 500, `chunk too long: ${c.length}`);
assert.ok(chunks.join(' ').includes('Section 7.'), 'no text should be dropped');
assert.deepEqual(chunkText('   '), []);
assert.deepEqual(chunkText('short'), ['short']);
assert.equal(chunkText('x'.repeat(2500), { chunkSize: 1000, chunkOverlap: 0 }).length, 3);

for (const mod of ['chat', 'ingest', 'health']) {
  const { default: handler } = await import(`../api/${mod}.js`);
  assert.equal(typeof handler, 'function', `api/${mod}.js must export a default handler`);
}

console.log(`OK: ${chunks.length} chunks, all ≤ 500 chars; all handlers load.`);
