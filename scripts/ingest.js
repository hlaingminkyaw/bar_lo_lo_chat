// Bulk-ingest local files straight into Pinecone (no HTTP, no function timeout).
// Usage:
//   npm run ingest                 # ingests ./data
//   npm run ingest -- ./docs a.md  # any mix of files and folders
//   npm run ingest -- ./docs --namespace=handbook   (or --namespace handbook)
//   npm run ingest -- data/remax --shop=remax       # the namespace of shop "remax" in config/shops.json
import 'dotenv/config';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { ingestDocuments } from '../lib/ingest.js';
import { extractText, SUPPORTED_EXTENSIONS } from '../lib/extract.js';
import { getShopById } from '../lib/shops.js';
import { parseNamespace } from '../lib/vector-store.js';

const EXTENSIONS = new Set(SUPPORTED_EXTENSIONS);

function fail(message) {
  console.error(message);
  process.exit(1);
}

const flags = {};
const targets = [];
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const flag = args[i].match(/^--(namespace|shop)(?:=(.*))?$/);
  if (flag) {
    flags[flag[1]] = flag[2] ?? args[++i];
    if (!flags[flag[1]]) fail(`--${flag[1]} needs a value`);
  } else if (args[i].startsWith('--')) fail(`Unknown option ${args[i]}. Use --namespace=<ns> or --shop=<shopId>.`);
  else targets.push(args[i]);
}
if (!targets.length) targets.push('data');

let namespace;
try {
  namespace = parseNamespace(flags.namespace);
} catch (err) {
  fail(err.message);
}
if (flags.shop !== undefined) {
  const shop = getShopById(flags.shop);
  if (!shop) fail(`No shop "${flags.shop}" in config/shops.json`);
  if (namespace && namespace !== shop.namespace) {
    fail(`--namespace=${namespace} does not match shop "${shop.shopId}" (namespace ${shop.namespace})`);
  }
  namespace = shop.namespace;
}
console.log(`Ingesting into namespace "${namespace ?? process.env.PINECONE_NAMESPACE ?? 'default'}"`);

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
  // No function timeout here, so wait out embedding rate limits (per-minute quotas).
  const { upserted } = await ingestDocuments([{ id, source, text }], { namespace, retryBudgetMs: 5 * 60_000 });
  total += upserted;
  console.log(`✓ ${source} → ${upserted} chunks`);
}
console.log(`Done. Upserted ${total} chunks from ${files.length} file(s).`);
