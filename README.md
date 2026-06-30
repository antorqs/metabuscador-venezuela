Meta Busca Vzla is an emergency Next.js service that centralizes search across missing/found person sources.

## Requirements

- Node.js 20+ recommended
- npm

## Quick Start

1. Copy env file and set API key:

```bash
cp .env.example .env.local
```

2. Start dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Public Search API

Endpoint:

- `GET /api/search?q=<name>` (external partner API, API key required)
- `GET /api/ui/search?q=<name>` (internal UI API, no API key from browser)
- `GET /api/sources` (site catalog with enable/disable and notes)

Authentication:

- Header: `x-api-key: <key>`

### How to use `/api/search` (descriptive)

`/api/search` is the public aggregation endpoint for partner sites and tools.

Request flow:

1. Send a `GET` request with a person name in `q`.
2. Include your API key in `x-api-key`.
3. Optionally restrict which sources are queried.
4. Read `sources[]` for grouped results and status by source.
5. Use metadata (`requestedSources`, `appliedSources`, `ignoredSources`) to understand what was actually executed.

Required parameter:

- `q`: search query (2-120 characters)

Optional source filter parameters:

- Repeated param format: `source=key1&source=key2`
- CSV format: `sources=key1,key2,key3`
- You can combine both; keys are merged, trimmed, deduplicated.

Source filtering behavior:

- No source filters provided -> all enabled sources are queried.
- Unknown source key -> ignored and reported as `unknown_source`.
- Disabled source key -> ignored and reported as `disabled_source`.
- If all requested sources are ignored, request still returns `200` with empty `sources` and metadata explaining why.

Response metadata fields:

- `requestedSources`: all requested keys after normalization.
- `appliedSources`: enabled known keys that were actually queried.
- `ignoredSources`: keys that were skipped with a reason.

Example request:

```bash
curl "http://localhost:3000/api/search?q=maria" \
  -H "x-api-key: replace-with-your-emergency-key"
```

Example with repeated source params:

```bash
curl "http://localhost:3000/api/search?q=daniel&source=911-ubica-me&source=hospitales-en-venezuela" \
  -H "x-api-key: replace-with-your-emergency-key"
```

Example with CSV source params:

```bash
curl "http://localhost:3000/api/search?q=daniel&sources=911-ubica-me,hospitales-en-venezuela" \
  -H "x-api-key: replace-with-your-emergency-key"
```

Example with mixed valid + invalid + disabled:

```bash
curl "http://localhost:3000/api/search?q=daniel&source=911-ubica-me&sources=venezuela-te-busca,fuente-inexistente" \
  -H "x-api-key: replace-with-your-emergency-key"
```

Example successful response:

```json
{
  "query": "maria",
  "searchedAt": "2026-06-29T00:00:00.000Z",
  "requestedSources": [
    "911-ubica-me",
    "fuente-inexistente"
  ],
  "appliedSources": [
    "911-ubica-me"
  ],
  "ignoredSources": [
    {
      "key": "fuente-inexistente",
      "reason": "unknown_source"
    }
  ],
  "sources": [
    {
      "key": "911-ubica-me",
      "name": "911.ubica.me",
      "sourceUrl": "https://911.ubica.me/",
      "status": "ok",
      "results": [
        {
          "id": "LP-401",
          "sourceKey": "911-ubica-me",
          "sourceName": "911.ubica.me",
          "name": "SEBASTIAN TORREALBA RODRIGUEZ",
          "age": "7",
          "cedula": "14512432",
          "photoUrl": null,
          "status": "found",
          "location": "Hospital J.M de los Rios",
          "contact": null,
          "profileUrl": "https://911.ubica.me/",
          "lastUpdated": "2026-06-29T09:50:32Z"
        }
      ]
    }
  ]
}
```

Rate limiting:

- Per-IP limit with escalating cooldown
- Returns `429` with `Retry-After` when blocked
- Includes rate headers:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

## Environment Variables

See `.env.example`:

- `API_KEYS` comma-separated allowed keys
- `HOSPITALES_VE_ANON_KEY` anon key used by the hospitalesenvenezuela.com source
- `HELPMAPVZLA_API_KEY` publishable key used by the HelpMapVzla Supabase source
- `INTERNAL_UI_SEARCH_KEY` shared secret for server-side UI calls to `/api/ui/search`
- `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_BASE_COOLDOWN_MS`, `RATE_LIMIT_MAX_COOLDOWN_MS`, `RATE_LIMIT_STRIKE_RESET_MS`
- `SOURCE_TIMEOUT_MS`, `MAX_RESULTS_PER_SOURCE`
- `VTB_USER_AGENT`, `VTB_ACCEPT_LANGUAGE` request headers for `venezuelatebusca.com` source

## Current Sources

- `911.ubica.me` (enabled) - per-letter JSON files
- `hospitalesenvenezuela.com` (enabled) - Supabase RPC `buscar_paciente`
- `rescateinfantilvenezuela.com` (enabled) - `GET /api/search?q=<name>&page=1&limit=20`
- `encuentralos.tecnosoft.dev` (enabled) - `GET /api/personas?limit=50&offset=0&q=<name>`
- `localizapacientes.com` (enabled) - `GET /api/search?q=<name>`
- `buscaenlistasvzla.info` (enabled) - `GET /search?q=<name>`
- `helpmapvzla.net` (enabled) - Supabase REST query by `nombres/apellidos` token OR
- `desaparecidos-terremoto-api.theempire.tech` (disabled) - reCAPTCHA needed; contact source developer for integration access
- `venezuelatebusca.com` (disabled) - CORS + Cloudflare challenge; pending allowlist/API access

## Source Management

- Source toggles are managed in `lib/search/registry.ts` via `SOURCE_CATALOG`.
- Use `enabled: false` to temporarily disable a source without removing adapter code.
- Add operational notes in `note` (for blockers like reCAPTCHA or maintenance).
- `GET /api/sources` returns this catalog (enabled/disabled + notes) for operators.
- Search engine enforces unique result IDs per response in case upstream sources emit duplicates.

## API Boundaries

- External consumers should use `GET /api/search` with `x-api-key`.
- The web UI uses `GET /api/ui/search` without exposing API keys in browser requests.
- API keys are server-only and should never be sent as query params.
- `GET /api/ui/search` accepts only same-origin requests (Origin/Referer host match).
- Server-side UI calls can also be authorized with `x-internal-ui-key`.

## Rate Limit Notes

- IP is read from `x-forwarded-for` / `x-real-ip` when available.
- If IP is unavailable, the app uses a lightweight pseudo-IP fallback to avoid one global `unknown` bucket.

## Scripts

- `npm run dev` start local development server
- `npm run lint` run lint checks
- `npm run build` build for production
