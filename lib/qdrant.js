import { createHash } from 'node:crypto';
import { config } from './config.js';
import { HttpError } from './http.js';

/**
 * Deterministically converts any string ID into a valid RFC 4122 v4 UUID format.
 * Qdrant points require integer or UUID identifiers.
 */
export function stringToUuid(str) {
  const hash = createHash('md5').update(str).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

class QdrantStore {
  constructor(namespace) {
    this.namespace = namespace || config.pineconeNamespace || 'default';
    this.url = config.qdrantUrl.replace(/\/+$/, '');
    this.collection = config.qdrantCollection;
    this.apiKey = config.qdrantApiKey;
  }

  // All namespaces share one collection, so point IDs include the namespace;
  // otherwise two shops uploading "price_list.pdf" would overwrite each other.
  // The default namespace keeps the plain ID so existing points still match.
  pointId(recordId) {
    return stringToUuid(this.namespace === 'default' ? recordId : `${this.namespace}::${recordId}`);
  }

  namespaceFilter() {
    return { key: '_namespace', match: { value: this.namespace } };
  }

  headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.apiKey) h['api-key'] = this.apiKey;
    return h;
  }

  async request(path, options = {}) {
    const url = `${this.url}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: { ...this.headers(), ...options.headers },
      signal: AbortSignal.timeout(30_000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new HttpError(
        res.status >= 500 ? 502 : res.status,
        `Qdrant request failed (${res.status}): ${body?.status?.error || body?.error || res.statusText}`
      );
    }
    return body;
  }

  async upsert({ records }) {
    if (!records?.length) return;
    const points = records.map((r) => ({
      id: this.pointId(r.id),
      vector: r.values,
      payload: {
        ...r.metadata,
        _recordId: r.id,
        _namespace: this.namespace,
      },
    }));

    return this.request(`/collections/${encodeURIComponent(this.collection)}/points?wait=true`, {
      method: 'PUT',
      body: JSON.stringify({ points }),
    });
  }

  async query({ vector, topK = 6, filter }) {
    // Always scoped, including "default", so one tenant never sees another's points.
    const mustFilters = [this.namespaceFilter()];

    if (filter && typeof filter === 'object') {
      for (const [key, val] of Object.entries(filter)) {
        if (val && typeof val === 'object' && val.$eq !== undefined) {
          mustFilters.push({ key, match: { value: val.$eq } });
        } else if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
          mustFilters.push({ key, match: { value: val } });
        }
      }
    }

    const searchBody = {
      vector,
      limit: topK,
      with_payload: true,
      filter: { must: mustFilters },
    };

    const res = await this.request(`/collections/${encodeURIComponent(this.collection)}/points/search`, {
      method: 'POST',
      body: JSON.stringify(searchBody),
    });

    const matches = (res.result || []).map((hit) => {
      const payload = hit.payload || {};
      const { _recordId, _namespace, ...metadata } = payload;
      return {
        id: _recordId || hit.id,
        score: hit.score,
        metadata: { ...metadata, text: payload.text, source: payload.source },
      };
    });

    return { matches };
  }

  async listPaginated({ prefix, paginationToken }) {
    const scrollBody = {
      limit: 100,
      with_payload: true,
      filter: { must: [this.namespaceFilter()] },
      ...(paginationToken ? { offset: paginationToken } : {}),
    };

    const res = await this.request(`/collections/${encodeURIComponent(this.collection)}/points/scroll`, {
      method: 'POST',
      body: JSON.stringify(scrollBody),
    });

    const points = res.result?.points || [];
    const nextOffset = res.result?.next_page_offset;

    const matching = points
      .filter((p) => {
        const recId = p.payload?._recordId || '';
        return !prefix || recId.startsWith(prefix);
      })
      .map((p) => ({
        id: p.payload?._recordId || p.id,
      }));

    return {
      vectors: matching,
      pagination: nextOffset ? { next: nextOffset } : undefined,
    };
  }

  async deleteMany({ ids }) {
    if (!ids?.length) return;
    const points = ids.map((id) => this.pointId(id));
    return this.request(`/collections/${encodeURIComponent(this.collection)}/points/delete?wait=true`, {
      method: 'POST',
      body: JSON.stringify({ points }),
    });
  }
}

export function getQdrantStore(namespace) {
  return new QdrantStore(namespace);
}

export async function ensureQdrantCollection(dimension) {
  const url = config.qdrantUrl.replace(/\/+$/, '');
  const collection = config.qdrantCollection;
  const headers = { 'Content-Type': 'application/json' };
  if (config.qdrantApiKey) headers['api-key'] = config.qdrantApiKey;

  const check = await fetch(`${url}/collections/${encodeURIComponent(collection)}`, { headers });
  if (check.ok) {
    const data = await check.json();
    return { created: false, collection, info: data.result };
  }

  const createRes = await fetch(`${url}/collections/${encodeURIComponent(collection)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      vectors: {
        size: dimension,
        distance: 'Cosine',
      },
    }),
  });
  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(`Failed to create Qdrant collection "${collection}": ${err?.status?.error || createRes.statusText}`);
  }
  return { created: true, collection };
}
