# Multi-Tenant Messenger Shops

One deployment serves several Facebook Pages (online shops). Each page is a **tenant** with its own knowledge, prompt, token budget, page access token and chat history. All pages share one webhook URL (`/api/webhook`), one Meta app and one Pinecone index.

---

## 1. How Routing Works

```
Meta POST /api/webhook
  └─ for each messaging event
       recipient.id (Page ID) ──► config/shops.json ──► shop (tenant)
            │                                            │
            │ no match → ignored, still 200              ├─ namespace       → Pinecone search scope
            ▼                                            ├─ customPrompt    → identity + instructions
   200 EVENT_RECEIVED (immediately)                      ├─ maxTokens       → LLM output budget
                                                         ├─ pageAccessToken → env var with the Send API token
                                                         └─ shopId          → Redis key chat:fb:<shopId>:<senderId>
```

| Concern | Isolation mechanism |
|---|---|
| Product knowledge | Each shop has its own Pinecone **namespace**; retrieval only queries that namespace. Namespaces must be unique across shops (checked at load). With `VECTOR_DB=qdrant`, every query is filtered by `_namespace` and point IDs include the namespace. |
| Identity and contact details | The shop's `customPrompt` replaces the identity block at the end of `RULES.md` (the `tenant-identity` markers), so one shop never gives out another business's name or phone numbers. All other `RULES.md` rules (no citations, Myanmar Unicode, fixed not-found reply) still apply. |
| Chat history | Redis key `chat:fb:<shopId>:<senderId>`: last 4 messages, 1-hour TTL. The same person messaging two shops gets two separate conversations. |
| Sending replies | Each shop's own page access token, read from the env var named in `pageAccessToken`. |

Web chat (`/api/chat`, `public/index.html`) is not affected: it still uses `PINECONE_NAMESPACE` and the default identity in `RULES.md`.

---

## 2. `config/shops.json`

Keys are Facebook Page IDs. Values are shop configs:

```json
{
  "104857392011234": {
    "shopId": "remax",
    "shopName": "REMAX Online Shop",
    "namespace": "shop_remax",
    "pageAccessToken": "PAGE_ACCESS_TOKEN_REMAX",
    "maxTokens": 150,
    "customPrompt": "You are REMAX Assistant. Be concise and polite."
  }
}
```

| Field | Required | Rules |
|---|---|---|
| *(key)* | Yes | The Facebook Page ID, i.e. `recipient.id` in webhook events. |
| `shopId` | Yes | `a-z 0-9 _ -`, at most 32 characters, unique. Used in Redis keys and logs. |
| `shopName` | No | Display name (defaults to `shopId`). |
| `namespace` | Yes | `A-Z a-z 0-9 _ -`, at most 64 characters, unique across shops. |
| `pageAccessToken` | Yes | The **name of an env var** that holds the token (e.g. `PAGE_ACCESS_TOKEN_REMAX`), never the token itself, so tokens stay out of git. A literal token is rejected. |
| `maxTokens` | No | Positive integer; defaults to `MAX_TOKENS` (4096). |
| `customPrompt` | No | Shop identity and instructions. Put the shop's name, focus, and support contact here (or in its ingested documents). Without it, the shop has no name or contact defined. |

The file is validated when first used and by `npm run check`: a bad field, a duplicate `shopId` or a duplicate `namespace` throws an error naming the page.

> **`maxTokens` and Burmese**: Burmese text uses several tokens per word, so a 60–80 word Burmese answer can need 300+ tokens. Low values such as 150 can cut answers off mid-sentence (the server logs "answer hit max_tokens" when that happens), and free reasoning models may use the whole budget before answering. Start at 1024 or higher for Burmese-speaking shops and rely on the prompt's length rules for brevity.

---

## 3. Adding a New Shop Page

1. **Connect the page to the Meta app.** In the Meta app dashboard → Messenger → *Access Tokens*, add the page and generate a page access token. Make sure the page is subscribed to the app's webhook (`messages` field). The webhook URL and `FB_VERIFY_TOKEN` are shared, so you don't need to verify the webhook again.
2. **Find the Page ID.** It's shown next to the page in *Access Tokens*, or in the page's *About → Page transparency* section. It's also the `recipient.id` of incoming events (an unknown page logs `Messenger: no shop configured for page <id>`).
3. **Store the token as an env var** in Vercel → Project Settings → Environment Variables, e.g. `PAGE_ACCESS_TOKEN_STORE_C=EAAG...` (and in `.env` for local testing).
4. **Add the shop** to `config/shops.json`:
   ```json
   "123456789012345": {
     "shopId": "store_c",
     "shopName": "Store C",
     "namespace": "shop_store_c",
     "pageAccessToken": "PAGE_ACCESS_TOKEN_STORE_C",
     "maxTokens": 1024,
     "customPrompt": "You are Store C Assistant. Contact: 09-xxx-xxx-xxx."
   }
   ```
5. **Validate**: `npm run check`.
6. **Load the shop's knowledge** into its namespace (any of):
   ```bash
   npm run ingest -- data/store_c --shop=store_c            # namespace looked up from shops.json
   npm run ingest -- data/store_c --namespace=shop_store_c  # same thing, explicit
   curl -X POST "https://<app>/api/upload?namespace=shop_store_c" -F "file=@catalog.pdf"
   curl -X POST "https://<app>/api/ingest?namespace=shop_store_c" \
     -H 'Content-Type: application/json' -d '{"text":"...","source":"faq.md"}'
   ```
   Note the `--` after `npm run ingest`; without it npm swallows the flags.
7. **Deploy** (commit `config/shops.json` and push, or `vercel --prod`). Changing the env var or the JSON file both require a new deployment on Vercel.
8. **Test** by messaging the page from an account with a role on the Meta app (or after the app has passed review).

To **remove** a shop, delete its entry; messages to that page are then ignored. Its vectors stay in Pinecone until you delete the namespace in the Pinecone console.

---

## 4. Troubleshooting

| Log line | Meaning |
|---|---|
| `Messenger: no shop configured for page <id>; message ignored` | `recipient.id` isn't a key in `config/shops.json`. Add the shop, or fix a typo in the Page ID. |
| `Messenger[<shopId>]: reply to <psid> failed: Error: PAGE_ACCESS_TOKEN_X is not set` | The env var named in `pageAccessToken` is missing in this environment. |
| `Send API failed (400): Invalid OAuth access token` | The token is wrong, expired, or belongs to a different page. |
| Answers are always `အချက်အလက် မတွေ့ရှိပါခင်ဗျာ။` | The shop's namespace is empty or was ingested under a different name. Re-run ingestion with `--shop=<shopId>`. |
| `answer hit max_tokens (...) and was truncated` | Raise the shop's `maxTokens`. |
