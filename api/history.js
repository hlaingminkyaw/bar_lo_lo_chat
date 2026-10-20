import { route, sendJson } from '../lib/http.js';
import { getHistory, isValidSessionId } from '../lib/redis.js';

/**
 * GET /api/history?sessionId=<id>
 * Response: { history: [{ role: 'user'|'assistant', content }] }, oldest first.
 * Lets the web UI redraw the conversation after a reload. Missing or invalid
 * IDs, unknown sessions and Redis failures all return an empty history.
 */
export default route(['GET'], async (req, res) => {
  const sessionId = new URL(req.url, 'http://localhost').searchParams.get('sessionId');
  const history = isValidSessionId(sessionId) ? await getHistory(sessionId) : [];
  res.setHeader('Cache-Control', 'no-store');
  sendJson(res, 200, { history });
});
