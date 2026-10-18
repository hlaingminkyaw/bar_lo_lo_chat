// Recursive character splitter: tries to break on paragraphs, then lines,
// then sentences, then words, and only hard-cuts as a last resort.
const SEPARATORS = ['\n\n', '\n', '. ', ' ', ''];

/**
 * @param {string} text
 * @param {{ chunkSize?: number, chunkOverlap?: number }} [opts]
 * @returns {string[]}
 */
export function chunkText(text, { chunkSize = 1000, chunkOverlap = 150 } = {}) {
  if (chunkOverlap >= chunkSize) {
    throw new Error('chunkOverlap must be smaller than chunkSize');
  }
  const clean = text.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
  if (!clean) return [];
  const pieces = split(clean, chunkSize, SEPARATORS);
  return merge(pieces, chunkSize, chunkOverlap);
}

// Break text into pieces no longer than chunkSize, keeping separators attached.
function split(text, chunkSize, separators) {
  if (text.length <= chunkSize) return [text];
  const [sep, ...rest] = separators;
  if (sep === '') {
    const out = [];
    for (let i = 0; i < text.length; i += chunkSize) out.push(text.slice(i, i + chunkSize));
    return out;
  }
  const parts = text.split(sep);
  const out = [];
  parts.forEach((part, i) => {
    const piece = i < parts.length - 1 ? part + sep : part;
    if (!piece) return;
    if (piece.length <= chunkSize) out.push(piece);
    else out.push(...split(piece, chunkSize, rest));
  });
  return out;
}

// Greedily pack pieces into chunks, carrying the tail of each chunk forward
// as overlap so context isn't lost at boundaries.
function merge(pieces, chunkSize, chunkOverlap) {
  const chunks = [];
  let current = [];
  let length = 0;

  for (const piece of pieces) {
    if (length + piece.length > chunkSize && current.length) {
      chunks.push(current.join('').trim());
      while (length > chunkOverlap || (length + piece.length > chunkSize && length > 0)) {
        length -= current.shift().length;
      }
    }
    current.push(piece);
    length += piece.length;
  }
  if (current.length) chunks.push(current.join('').trim());
  return chunks.filter(Boolean);
}
