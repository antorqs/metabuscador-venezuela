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

Example request:

```bash
curl "http://localhost:3000/api/search?q=maria" \
  -H "x-api-key: replace-with-your-emergency-key"
```

Example successful response:

```json
{
  "query": "maria",
  "searchedAt": "2026-06-29T00:00:00.000Z",
  "sources": [
    {
      "key": "911-ubica-me",
      "name": "911.ubica.me",
      "sourceUrl": "https://911.ubica.me/",
      "status": "ok",
      "results": []
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
- `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_BASE_COOLDOWN_MS`, `RATE_LIMIT_MAX_COOLDOWN_MS`, `RATE_LIMIT_STRIKE_RESET_MS`
- `SOURCE_TIMEOUT_MS`, `MAX_RESULTS_PER_SOURCE`

## Current Sources

- `911.ubica.me` (enabled) - per-letter JSON files
- `hospitalesenvenezuela.com` (enabled) - Supabase RPC `buscar_paciente`
- `rescateinfantilvenezuela.com` (disabled) - reCAPTCHA needed; contact source developer for integration access
- `desaparecidos-terremoto-api.theempire.tech` (enabled) - `GET /api/personas?page=1&pageSize=20&q=<name>`
- `venezuelatebusca.com` (enabled) - `GET /_root.data?query=<name>`

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

## Rate Limit Notes

- IP is read from `x-forwarded-for` / `x-real-ip` when available.
- If IP is unavailable, the app uses a lightweight pseudo-IP fallback to avoid one global `unknown` bucket.

## Scripts

- `npm run dev` start local development server
- `npm run lint` run lint checks
- `npm run build` build for production
