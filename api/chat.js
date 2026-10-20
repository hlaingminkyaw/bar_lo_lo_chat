import { waitUntil } from '@vercel/functions';
import { route, readJson, sendJson, HttpError } from '../lib/http.js';
import { answerQuestion } from '../lib/rag.js';
import { getHistory, saveTurn, isValidSessionId } from '../lib/redis.js';

const MAX_QUESTION_CHARS = 4000;

/**
 * POST /api/chat
 * Body: {
 *   message: string,                 // the user's question (alias: "question")
 *   sessionId?: string,              // web UI session; history is loaded from and saved to Redis
 *   history?: [{ role, content }],   // optional prior turns, used only when there is no sessionId
 *   topK?: number,                   // 1–20, default TOP_K env or 5
 *   namespace?: string,
 *   filter?: object,                 // Pinecone metadata filter, e.g. { source: { $eq: "faq.md" } }
 *   minScore?: number                // drop matches below this similarity
 * }
 * Response: { answer, sources: [{ ref, id, source, score, snippet }], model }
 */
export default route(['POST'], async (req, res) => {
  const body = await readJson(req);
  const question = String(body.message ?? body.question ?? '').trim();

  if (!question) throw new HttpError(400, 'Field "message" is required');
  if (question.length > MAX_QUESTION_CHARS) {
    throw new HttpError(400, `"message" must be at most ${MAX_QUESTION_CHARS} characters`);
  }

  const sessionId = isValidSessionId(body.sessionId) ? body.sessionId : null;
  const history = sessionId ? await getHistory(sessionId) : sanitizeHistory(body.history);

  const result = await answerQuestion(question, {
    history,
    topK: clamp(body.topK, 1, 20),
    namespace: typeof body.namespace === 'string' ? body.namespace : undefined,
    filter: body.filter && typeof body.filter === 'object' ? body.filter : undefined,
    minScore: typeof body.minScore === 'number' ? body.minScore : 0,
  });

  // Saved after responding; waitUntil keeps the function alive until it finishes.
  if (sessionId) waitUntil(saveTurn(sessionId, question, result.answer));

  sendJson(res, 200, {
    answer: result.answer,
    sources: result.sources,
    model: result.model,
  });
});

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, Math.round(n)));
}

// Only pass through well-formed user/assistant turns; never let clients inject
// a system message.
function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_QUESTION_CHARS) }));
}
