import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isValidNamespace } from './vector-store.js';

// Multi-tenant Messenger: each Facebook Page ID maps to one shop (tenant) in
// config/shops.json. The webhook routes every event by its recipient.id, so a
// shop only ever sees its own vector namespace, prompt, token budget, page
// token and chat history.

const SHOPS_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'config', 'shops.json');

// shopId is part of Redis keys (chat:fb:<shopId>:<senderId>), so no colons.
const SHOP_ID_PATTERN = /^[a-z0-9_-]{1,32}$/;
// pageAccessToken holds the NAME of an env var, never the token itself, so
// tokens stay out of git. Real tokens ("EAAG...") have lowercase letters and
// are rejected here.
const ENV_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;

/**
 * @typedef {{ pageId: string, shopId: string, shopName: string, namespace: string,
 *   pageAccessToken: string, maxTokens?: number, customPrompt?: string }} Shop
 */

let byPageId;

/**
 * Validate the raw shops.json object and index it by page ID. Throws on any
 * mistake so a bad config fails `npm run check` instead of misrouting replies.
 * @returns {Map<string, Shop>}
 */
export function parseShops(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('config/shops.json must be an object keyed by Facebook Page ID');
  }
  const shops = new Map();
  const shopIds = new Set();
  const namespaces = new Set();

  for (const [pageId, shop] of Object.entries(raw)) {
    const where = `config/shops.json["${pageId}"]`;
    if (!shop || typeof shop !== 'object') throw new Error(`${where} must be an object`);
    const { shopId, shopName, namespace, pageAccessToken, maxTokens, customPrompt } = shop;

    if (typeof shopId !== 'string' || !SHOP_ID_PATTERN.test(shopId)) {
      throw new Error(`${where}.shopId must be 1-32 characters of a-z 0-9 _ -`);
    }
    if (!isValidNamespace(namespace)) {
      throw new Error(`${where}.namespace must be 1-64 characters of A-Z a-z 0-9 _ -`);
    }
    if (typeof pageAccessToken !== 'string' || !ENV_NAME_PATTERN.test(pageAccessToken)) {
      throw new Error(`${where}.pageAccessToken must be the name of an env var (e.g. PAGE_ACCESS_TOKEN_${shopId.toUpperCase()}), not the token itself`);
    }
    if (maxTokens !== undefined && !(Number.isInteger(maxTokens) && maxTokens > 0)) {
      throw new Error(`${where}.maxTokens must be a positive integer`);
    }
    if (customPrompt !== undefined && typeof customPrompt !== 'string') {
      throw new Error(`${where}.customPrompt must be a string`);
    }
    if (shopName !== undefined && typeof shopName !== 'string') {
      throw new Error(`${where}.shopName must be a string`);
    }
    if (shopIds.has(shopId)) throw new Error(`${where}: shopId "${shopId}" is used by another page`);
    if (namespaces.has(namespace)) throw new Error(`${where}: namespace "${namespace}" is used by another shop`);
    shopIds.add(shopId);
    namespaces.add(namespace);

    shops.set(pageId, Object.freeze({
      pageId,
      shopId,
      shopName: shopName?.trim() || shopId,
      namespace,
      pageAccessToken,
      maxTokens,
      customPrompt: customPrompt?.trim() || undefined,
    }));
  }
  return shops;
}

function loadShops() {
  byPageId ??= parseShops(JSON.parse(fs.readFileSync(SHOPS_PATH, 'utf-8')));
  return byPageId;
}

/** @returns {Shop[]} */
export function listShops() {
  return [...loadShops().values()];
}

/** The shop for a Facebook Page ID, or null if that page isn't configured. */
export function getShopByPageId(pageId) {
  if (typeof pageId !== 'string') return null;
  return loadShops().get(pageId) ?? null;
}

export function getShopById(shopId) {
  return listShops().find((shop) => shop.shopId === shopId) ?? null;
}

/** Read the shop's page access token from the env var its config names. */
export function resolvePageToken(shop) {
  const token = process.env[shop.pageAccessToken];
  if (!token) throw new Error(`${shop.pageAccessToken} is not set (page access token for shop "${shop.shopId}")`);
  return token;
}
