import { Redis } from '@upstash/redis';

// Chat history in Upstash Redis (HTTP, so it works from serverless functions).
//   Web UI:    chat:session:<sessionId>
//   Messenger: chat:fb:<shopId>:<senderId>  (one conversation per shop + person)
// Every function here swallows Redis errors: history is a nice-to-have, so a
// Redis outage must degrade to "no history", never to a failed answer.

const KEY_PREFIX = 'chat:session:';
const MESSENGER_KEY_PREFIX = 'chat:fb:';
// 4 messages = 2 user + 2 assistant turns; kept small to save input tokens.
export const HISTORY_MESSAGES = 4;
export const HISTORY_TTL_SECONDS = 3600;
const MAX_CONTENT_CHARS = 4000;
const REQUEST_TIMEOUT_MS = 2000;

// Client-generated IDs (crypto.randomUUID() or a fallback); reject anything
// else so callers can't write arbitrary or oversized keys.
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
// Shop IDs and Messenger page-scoped IDs; no colons, so keys can't collide.
const KEY_PART_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

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

const sessionKey = (sessionId) => (isValidSessionId(sessionId) ? `${KEY_PREFIX}${sessionId}` : null);

/** chat:fb:<shopId>:<senderId>, or null if either part is malformed. */
export function messengerHistoryKey(shopId, senderId) {
  const valid = [shopId, senderId].every((part) => typeof part === 'string' && KEY_PART_PATTERN.test(part));
  return valid ? `${MESSENGER_KEY_PREFIX}${shopId}:${senderId}` : null;
}

/**
 * Last HISTORY_MESSAGES messages for a web session, oldest first, or [] if
 * there is no session, no Redis, or Redis fails.
 * @returns {Promise<{ role: 'user'|'assistant', content: string }[]>}
 */
export function getHistory(sessionId) {
  return readHistory(sessionKey(sessionId));
}

/** Same as getHistory, for one Messenger user talking to one shop's page. */
export function getMessengerHistory(shopId, senderId) {
  return readHistory(messengerHistoryKey(shopId, senderId));
}

/**
 * Append one user/assistant turn, keep only the last HISTORY_MESSAGES, and
 * refresh the TTL so idle sessions expire after an hour. Never throws.
 */
export function saveTurn(sessionId, userMessage, assistantMessage) {
  return appendTurn(sessionKey(sessionId), userMessage, assistantMessage);
}

export function saveMessengerTurn(shopId, senderId, userMessage, assistantMessage) {
  return appendTurn(messengerHistoryKey(shopId, senderId), userMessage, assistantMessage);
}

async function readHistory(key) {
  const redis = getClient();
  if (!redis || !key) return [];
  try {
    const items = await redis.lrange(key, -HISTORY_MESSAGES, -1);
    return items.filter(
      (m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string',
    );
  } catch (err) {
    console.warn('Redis getHistory failed, answering without history:', err.message);
    return [];
  }
}

async function appendTurn(key, userMessage, assistantMessage) {
  const redis = getClient();
  if (!redis || !key) return;
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
