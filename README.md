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

- `GET /api/search?q=<name>`

Authentication:

- Header (preferred): `x-api-key: <key>`
- Query fallback: `?apiKey=<key>`

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

- `911.ubica.me` (per-letter JSON files)
- `hospitalesenvenezuela.com` (Supabase RPC `buscar_paciente`)

## Scripts

- `npm run dev` start local development server
- `npm run lint` run lint checks
- `npm run build` build for production
