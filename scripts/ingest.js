// Bulk-ingest local files straight into Pinecone (no HTTP, no function timeout).
// Usage:
//   npm run ingest                 # ingests ./data
//   npm run ingest -- ./docs a.md  # any mix of files and folders
//   npm run ingest -- ./docs --namespace=handbook
import 'dotenv/config';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { ingestDocuments } from '../lib/ingest.js';
import { extractText, SUPPORTED_EXTENSIONS } from '../lib/extract.js';

const EXTENSIONS = new Set(SUPPORTED_EXTENSIONS);

const args = process.argv.slice(2);
const namespace = args.find((a) => a.startsWith('--namespace='))?.split('=')[1];
const targets = args.filter((a) => !a.startsWith('--'));
if (!targets.length) targets.push('data');

async function collect(target) {
  const info = await stat(target);
  if (info.isFile()) return EXTENSIONS.has(path.extname(target).toLowerCase()) ? [target] : [];
  const entries = await readdir(target, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((e) => !e.name.startsWith('.'))
      .map((e) => collect(path.join(target, e.name))),
  );
  return nested.flat();
}

const files = (await Promise.all(targets.map(collect))).flat();
if (!files.length) {
  console.error(`No ${[...EXTENSIONS].join('/')} files found in: ${targets.join(', ')}`);
  process.exit(1);
}

let total = 0;
for (const file of files) {
  const text = await extractText(await readFile(file), file);
  if (!text.trim()) {
    console.log(`- ${file}: no text found, skipped`);
    continue;
  }
  const source = path.relative(process.cwd(), file);
  // Stable id per file path, so re-running updates instead of duplicating.
  const id = source.replace(/[^a-zA-Z0-9._-]+/g, '_');
  const { upserted } = await ingestDocuments([{ id, source, text }], { namespace });
  total += upserted;
  console.log(`✓ ${source} → ${upserted} chunks`);
}
console.log(`Done. Upserted ${total} chunks from ${files.length} file(s).`);
