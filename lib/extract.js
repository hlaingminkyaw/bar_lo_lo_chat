import path from 'node:path';
import { config } from './config.js';
import { chatCompletion } from './openrouter.js';
import { HttpError } from './http.js';

const IMAGE_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const TEXT_EXTENSIONS = new Set(['.md', '.mdx', '.txt', '.html', '.json']);

export const SUPPORTED_EXTENSIONS = [
  '.pdf', '.docx', '.xlsx', '.xls', '.csv',
  ...Object.keys(IMAGE_TYPES),
  ...TEXT_EXTENSIONS,
];

/**
 * Turn an uploaded file into plain text ready for chunking.
 * @param {Buffer} buffer
 * @param {string} filename  used to pick the parser by extension
 * @returns {Promise<string>}
 */
export async function extractText(buffer, filename) {
  const ext = path.extname(filename).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new HttpError(415, `Unsupported file type "${ext || filename}". Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`);
  }
  try {
    return await extractByType(buffer, ext);
  } catch (err) {
    if (err instanceof HttpError) throw err;
    console.error(`Extraction failed for ${filename}:`, err);
    if (err.parserLoadFailed) {
      throw new HttpError(500, `The ${ext} reader failed to start on the server: ${err.message}`);
    }
    throw new HttpError(422, `Couldn't read this ${ext} file. It may be damaged, password-protected, or not really a ${ext} file.`);
  }
}

// Parsers are loaded on first use, so a parser that fails to load on the
// server (e.g. a missing native binary) only breaks its own file type.
// Callers pass `() => import('literal')` so Vercel's bundler still sees each package.
async function load(importer) {
  try {
    return await importer();
  } catch (err) {
    err.parserLoadFailed = true;
    throw err;
  }
}

async function extractByType(buffer, ext) {
  if (ext === '.pdf') return extractPdf(buffer);
  if (ext === '.docx') return extractDocx(buffer);
  if (ext === '.xlsx' || ext === '.xls') {
    const XLSX = await load(() => import('xlsx'));
    return extractSheets(XLSX, XLSX.read(buffer, { type: 'buffer' }));
  }
  if (ext === '.csv') {
    const XLSX = await load(() => import('xlsx'));
    return extractSheets(XLSX, XLSX.read(decodeUtf8(buffer), { type: 'string' }));
  }
  if (IMAGE_TYPES[ext]) return extractImage(buffer, IMAGE_TYPES[ext]);
  return decodeUtf8(buffer);
}

async function extractDocx(buffer) {
  // Real .docx files are zip archives ("PK" header). A plain-text file that was
  // just renamed to .docx is common, so read it as text instead of failing.
  if (buffer.subarray(0, 2).toString('latin1') !== 'PK') {
    const text = strictUtf8(buffer);
    if (text !== null) return text;
    throw new HttpError(422, 'This is not a valid .docx file. Old Word (.doc) files are not supported; open it in Word or Google Docs and save it as .docx.');
  }
  const { default: mammoth } = await load(() => import('mammoth'));
  return (await mammoth.extractRawText({ buffer })).value;
}

async function extractPdf(buffer) {
  // pdfjs (inside pdf-parse) needs DOMMatrix/ImageData/Path2D, which it loads
  // from @napi-rs/canvas through an indirect require that Vercel's file tracer
  // can't follow. Without this explicit import the package is left out of the
  // deployment and every request fails with "DOMMatrix is not defined".
  const canvas = await load(() => import('@napi-rs/canvas'));
  globalThis.DOMMatrix ??= canvas.DOMMatrix;
  globalThis.ImageData ??= canvas.ImageData;
  globalThis.Path2D ??= canvas.Path2D;
  // Same problem for the pdfjs worker file, which pdfjs locates by a runtime
  // path. Loading it here lets pdfjs run it in-process instead of from disk.
  // pdfjs-dist must stay at the exact version pdf-parse depends on.
  const worker = await load(() => import('pdfjs-dist/legacy/build/pdf.worker.mjs'));
  globalThis.pdfjsWorker ??= { WorkerMessageHandler: worker.WorkerMessageHandler };
  const { PDFParse } = await load(() => import('pdf-parse'));
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    // Empty joiner drops the default "-- 1 of 3 --" page markers.
    // Note: PDFs with complex scripts (e.g. Burmese) often store glyphs out of
    // reading order, so their extracted text can be scrambled; prefer .docx.
    const { text } = await parser.getText({ pageJoiner: '' });
    return text;
  } finally {
    await parser.destroy();
  }
}

// One line per row, with each value labelled by its column header, so a chunk
// like "Plan: Pro; Price: $49; Users: 10" still makes sense on its own.
function extractSheets(XLSX, workbook) {
  const sections = [];
  for (const name of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '', raw: false, blankrows: false });
    if (!rows.length) continue;

    const [header, ...body] = rows;
    const labels = header.map((h, i) => String(h).trim() || `Column ${i + 1}`);
    const lines = body
      .map((row) =>
        row
          .map((value, i) => [labels[i] ?? `Column ${i + 1}`, String(value).trim()])
          .filter(([, value]) => value)
          .map(([label, value]) => `${label}: ${value}`)
          .join('; '),
      )
      .filter(Boolean);

    // A sheet with only one row has no header/data split; keep it as plain text.
    if (!lines.length) lines.push(labels.join('; '));
    sections.push(`Sheet: ${name}\n${lines.join('\n')}`);
  }
  return sections.join('\n\n');
}

// OCR through an OpenRouter vision model; handles Burmese far better than tesseract.
async function extractImage(buffer, mimeType) {
  const { answer } = await chatCompletion(
    [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              'Transcribe all text in this image exactly as written, keeping the original language and script ' +
              '(for example, keep Burmese text in Burmese Unicode). Preserve line breaks and list structure. ' +
              'Render tables as one row per line with values separated by " | ". ' +
              'Output only the transcribed text with no commentary. If the image contains no text, output nothing.',
          },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${buffer.toString('base64')}` } },
        ],
      },
    ],
    { model: config.visionModel, temperature: 0 },
  );
  return answer;
}

function decodeUtf8(buffer) {
  return buffer.toString('utf8').replace(/^﻿/, '');
}

// Decode only if the bytes are valid UTF-8 text (no binary NULs); otherwise null.
function strictUtf8(buffer) {
  if (buffer.includes(0)) return null;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^﻿/, '');
  } catch {
    return null;
  }
}
