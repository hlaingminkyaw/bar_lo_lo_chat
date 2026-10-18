import path from 'node:path';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
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
    throw new HttpError(422, `Couldn't read this ${ext} file. It may be damaged, password-protected, or not really a ${ext} file.`);
  }
}

async function extractByType(buffer, ext) {
  if (ext === '.pdf') return extractPdf(buffer);
  if (ext === '.docx') return extractDocx(buffer);
  if (ext === '.xlsx' || ext === '.xls') return extractSheets(XLSX.read(buffer, { type: 'buffer' }));
  if (ext === '.csv') return extractSheets(XLSX.read(decodeUtf8(buffer), { type: 'string' }));
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
  return (await mammoth.extractRawText({ buffer })).value;
}

async function extractPdf(buffer) {
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
function extractSheets(workbook) {
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
