import { Redis } from '@upstash/redis';

// Web chat history in Upstash Redis (HTTP, so it works from serverless
// functions). Only the web UI uses this; Messenger stays stateless.
// Every function here swallows Redis errors: history is a nice-to-have, so a
// Redis outage must degrade to "no history", never to a failed answer.

const KEY_PREFIX = 'chat:session:';
// 4 messages = 2 user + 2 assistant turns; kept small to save input tokens.
export const HISTORY_MESSAGES = 4;
export const HISTORY_TTL_SECONDS = 3600;
const MAX_CONTENT_CHARS = 4000;
const REQUEST_TIMEOUT_MS = 2000;

// Client-generated IDs (crypto.randomUUID() or a fallback); reject anything
// else so callers can't write arbitrary or oversized keys.
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

let client;

function getClient() {
  if (client !== undefined) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  client = url && token
    ? new Redis({
      url,
      token,
      retry: { retries: 1 },
      signal: () => AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    : null;
  return client;
}

export function isValidSessionId(sessionId) {
  return typeof sessionId === 'string' && SESSION_ID_PATTERN.test(sessionId);
}

const sessionKey = (sessionId) => `${KEY_PREFIX}${sessionId}`;

/**
 * Last HISTORY_MESSAGES messages for a session, oldest first, or [] if there
 * is no session, no Redis, or Redis fails.
 * @returns {Promise<{ role: 'user'|'assistant', content: string }[]>}
 */
export async function getHistory(sessionId) {
  const redis = getClient();
  if (!redis || !isValidSessionId(sessionId)) return [];
  try {
    const items = await redis.lrange(sessionKey(sessionId), -HISTORY_MESSAGES, -1);
    return items.filter(
      (m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string',
    );
  } catch (err) {
    console.warn('Redis getHistory failed, answering without history:', err.message);
    return [];
  }
}

/**
 * Append one user/assistant turn, keep only the last HISTORY_MESSAGES, and
 * refresh the TTL so idle sessions expire after an hour. Never throws.
 */
export async function saveTurn(sessionId, userMessage, assistantMessage) {
  const redis = getClient();
  if (!redis || !isValidSessionId(sessionId)) return;
  const key = sessionKey(sessionId);
  try {
    await redis
      .multi()
      .rpush(
        key,
        { role: 'user', content: String(userMessage).slice(0, MAX_CONTENT_CHARS) },
        { role: 'assistant', content: String(assistantMessage).slice(0, MAX_CONTENT_CHARS) },
      )
      .ltrim(key, -HISTORY_MESSAGES, -1)
      .expire(key, HISTORY_TTL_SECONDS)
      .exec();
  } catch (err) {
    console.warn('Redis saveTurn failed:', err.message);
  }
}
