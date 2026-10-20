// Minimal local server that mounts the same /api handlers Vercel runs, so you
// can test without logging in to the Vercel CLI. Usage: npm run dev
import 'dotenv/config';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import chat from '../api/chat.js';
import ingest from '../api/ingest.js';
import health from '../api/health.js';
import upload from '../api/upload.js';
import webhook from '../api/webhook.js';
import history from '../api/history.js';

const routes = { '/api/chat': chat, '/api/history': history, '/api/ingest': ingest, '/api/upload': upload, '/api/health': health, '/api/webhook': webhook };
// Mirrors Vercel's cleanUrls: /admin serves public/admin.html.
const pages = { '/': 'index.html', '/index.html': 'index.html', '/admin': 'admin.html', '/admin.html': 'admin.html' };
const STATIC_TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
};
const port = Number(process.env.PORT) || 3000;

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  const handler = routes[pathname.replace(/\/$/, '')];
  if (handler) return handler(req, res);

  const page = pages[pathname.replace(/\/$/, '') || '/'];
  if (page) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(await readFile(new URL(`../public/${page}`, import.meta.url)));
  }

  // Other files in public/ (logo, icons). Only plain names with a known type,
  // so requests can't climb out of public/.
  const file = pathname.slice(1);
  const type = STATIC_TYPES[path.extname(file).toLowerCase()];
  if (type && /^[\w.-]+$/.test(file)) {
    try {
      const body = await readFile(new URL(`../public/${file}`, import.meta.url));
      res.setHeader('Content-Type', type);
      return res.end(body);
    } catch {}
  }
  res.statusCode = 404;
  res.end('Not found');
})
  .on('error', (err) => {
    if (err.code !== 'EADDRINUSE') throw err;
    console.error(`Port ${port} is already in use (probably another "npm run dev" still running).`);
    console.error(`Stop it with:  kill $(lsof -ti tcp:${port})   or use another port:  PORT=3001 npm run dev`);
    process.exit(1);
  })
  .listen(port, () => {
  console.log(`BarLoLo Chat running at http://localhost:${port}   (admin: http://localhost:${port}/admin)`);
  console.log(`  POST /api/chat   GET /api/history   POST /api/ingest   POST /api/upload   GET /api/health   GET|POST /api/webhook`);
});
