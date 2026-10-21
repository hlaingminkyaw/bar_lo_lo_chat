import { waitUntil } from '@vercel/functions';
import { route, readJson, sendJson } from '../lib/http.js';
import { answerQuestion } from '../lib/rag.js';
import { getMessengerHistory, saveMessengerTurn } from '../lib/redis.js';
import { getShopByPageId, resolvePageToken } from '../lib/shops.js';

const SEND_API_URL = 'https://graph.facebook.com/v21.0/me/messages';
const MAX_QUESTION_CHARS = 4000;
// Messenger rejects text messages longer than 2000 characters.
const MAX_MESSAGE_CHARS = 2000;

/**
 * Facebook Messenger webhook, shared by every shop's Facebook Page.
 *
 * GET /api/webhook
 *   Meta's subscription handshake. Returns hub.challenge as plain text when
 *   hub.mode is "subscribe" and hub.verify_token matches FB_VERIFY_TOKEN.
 *
 * POST /api/webhook
 *   Page events. Each message is routed by recipient.id (the Page ID) to its
 *   shop in config/shops.json; messages to pages with no shop are ignored.
 *   Replies "EVENT_RECEIVED" right away (Meta retries slow webhooks), then
 *   answers each text message from that shop's vector namespace with the
 *   shop's prompt, token budget and chat history, and sends the reply with
 *   the shop's page access token. waitUntil keeps the Vercel function alive
 *   for that work after the response is sent.
 */
export default route(['GET', 'POST'], async (req, res) => {
  if (req.method === 'GET') return verify(req, res);

  const body = await readJson(req);
  if (body.object !== 'page') return sendText(res, 404, 'Not a page event');

  const jobs = [];
  for (const event of (body.entry ?? []).flatMap((entry) => entry.messaging ?? [])) {
    if (!event.sender?.id || typeof event.message?.text !== 'string' || event.message.is_echo) continue;
    const shop = getShopByPageId(event.recipient?.id);
    if (!shop) {
      console.warn(`Messenger: no shop configured for page ${event.recipient?.id}; message ignored`);
      continue;
    }
    jobs.push({ shop, psid: event.sender.id, text: event.message.text });
  }

  sendText(res, 200, 'EVENT_RECEIVED');
  if (jobs.length) {
    waitUntil(Promise.allSettled(jobs.map(({ shop, psid, text }) => reply(shop, psid, text))));
  }
});

function verify(req, res) {
  const params = new URL(req.url, 'http://localhost').searchParams;
  const expected = process.env.FB_VERIFY_TOKEN;
  if (expected && params.get('hub.mode') === 'subscribe' && params.get('hub.verify_token') === expected) {
    return sendText(res, 200, params.get('hub.challenge') ?? '');
  }
  sendJson(res, 403, { error: 'Webhook verification failed' });
}

function sendText(res, status, text) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(text);
}

// Runs after the response is sent, so it must never throw.
async function reply(shop, psid, text) {
  const question = text.trim().slice(0, MAX_QUESTION_CHARS);
  if (!question) return;
  try {
    const token = resolvePageToken(shop);
    const [, history] = await Promise.all([
      sendAction(token, psid, 'typing_on'),
      getMessengerHistory(shop.shopId, psid),
    ]);

    let answer;
    let answered = false;
    try {
      ({ answer } = await answerQuestion(question, {
        history,
        namespace: shop.namespace,
        customPrompt: shop.customPrompt,
        maxTokens: shop.maxTokens,
      }));
      answered = true;
    } catch (err) {
      console.error(`Messenger[${shop.shopId}]: answerQuestion failed:`, err);
      answer = fallbackMessage(question);
    }

    for (const part of splitMessage(toPlainText(answer))) {
      await callSendApi(token, { recipient: { id: psid }, messaging_type: 'RESPONSE', message: { text: part } });
    }
    // Only real answers that reached the user become context for the next turn.
    if (answered) await saveMessengerTurn(shop.shopId, psid, question, answer);
  } catch (err) {
    console.error(`Messenger[${shop.shopId}]: reply to ${psid} failed:`, err);
  }
}

function sendAction(token, psid, action) {
  return callSendApi(token, { recipient: { id: psid }, sender_action: action }).catch((err) =>
    console.warn(`Messenger: ${action} failed:`, err.message),
  );
}

async function callSendApi(token, payload) {
  const res = await fetch(`${SEND_API_URL}?access_token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Send API failed (${res.status}): ${body?.error?.message ?? res.statusText}`);
  }
}

// Messenger shows raw text, so drop markdown emphasis and heading markers.
function toPlainText(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .trim();
}

// Split on paragraph, line, Burmese sentence (။) or word boundaries so each
// part fits Messenger's limit.
export function splitMessage(text, limit = MAX_MESSAGE_CHARS) {
  const parts = [];
  let rest = text.trim();
  while (rest.length > limit) {
    const window = rest.slice(0, limit);
    let cut = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('\n'));
    if (cut < limit / 2) cut = Math.max(cut, window.lastIndexOf('။') + 1, window.lastIndexOf(' '));
    if (cut < limit / 2) cut = limit;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

function fallbackMessage(question) {
  return /[က-႟]/.test(question)
    ? 'တောင်းပန်ပါတယ်၊ ယခုအချိန်တွင် အဖြေမပေးနိုင်သေးပါ။ ခဏနေမှ ထပ်မံမေးမြန်းကြည့်ပေးပါ။'
    : "Sorry, I can't answer right now. Please try again in a moment.";
}
