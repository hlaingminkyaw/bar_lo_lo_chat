import { config, ConfigError } from './config.js';

// These helpers only use the plain Node (req, res) API, so the same handlers
// run on Vercel and under scripts/dev-server.js.

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', config.allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Vercel pre-parses JSON into req.body; the local dev server does not.
export async function readJson(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
    return parse(req.body.toString());
  }
  const parts = [];
  for await (const part of req) parts.push(part);
  return parse(Buffer.concat(parts).toString() || '{}');
}

function parse(text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON');
  }
}

/**
 * Wraps a route with CORS, method checks and uniform error responses.
 * @param {string[]} methods allowed HTTP methods
 * @param {(req, res) => Promise<void>} fn
 */
export function route(methods, fn) {
  return async function handler(req, res) {
    applyCors(res);
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      return res.end();
    }
    if (!methods.includes(req.method)) {
      res.setHeader('Allow', methods.join(', '));
      return sendJson(res, 405, { error: `Method ${req.method} not allowed` });
    }
    try {
      await fn(req, res);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status >= 500) console.error(err);
      const message =
        err instanceof HttpError || err instanceof ConfigError
          ? err.message
          : 'Internal server error';
      sendJson(res, status, { error: message });
    }
  };
}
