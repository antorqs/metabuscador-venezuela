import { NextResponse, type NextRequest } from "next/server";

import { getClientIp } from "@/lib/http/client-ip";
import { searchAllSources } from "@/lib/search/engine";
import { hasValidApiKey } from "@/lib/security/api-key";
import { checkRateLimit } from "@/lib/security/rate-limit";

const DEFAULT_SOURCE_TIMEOUT_MS = 7000;
const DEFAULT_MAX_RESULTS_PER_SOURCE = 50;
const DEFAULT_RATE_LIMIT_MAX = 20;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_BASE_COOLDOWN_MS = 30_000;
const DEFAULT_RATE_LIMIT_MAX_COOLDOWN_MS = 120_000;
const DEFAULT_RATE_LIMIT_STRIKE_RESET_MS = 5 * 60_000;

function getPositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function getQuery(value: string | null): string | null {
  const query = value?.trim();
  if (!query) {
    return null;
  }

  if (query.length < 2 || query.length > 120) {
    return null;
  }

  return query;
}

export async function GET(request: NextRequest): Promise<Response> {
  if (!hasValidApiKey(request)) {
    return NextResponse.json(
      { error: "Unauthorized: missing or invalid API key" },
      { status: 401 },
    );
  }

  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(ip, {
    maxRequests: getPositiveInt(process.env.RATE_LIMIT_MAX, DEFAULT_RATE_LIMIT_MAX),
    windowMs: getPositiveInt(process.env.RATE_LIMIT_WINDOW_MS, DEFAULT_RATE_LIMIT_WINDOW_MS),
    baseCooldownMs: getPositiveInt(
      process.env.RATE_LIMIT_BASE_COOLDOWN_MS,
      DEFAULT_RATE_LIMIT_BASE_COOLDOWN_MS,
    ),
    maxCooldownMs: getPositiveInt(
      process.env.RATE_LIMIT_MAX_COOLDOWN_MS,
      DEFAULT_RATE_LIMIT_MAX_COOLDOWN_MS,
    ),
    strikeResetMs: getPositiveInt(
      process.env.RATE_LIMIT_STRIKE_RESET_MS,
      DEFAULT_RATE_LIMIT_STRIKE_RESET_MS,
    ),
  });

  const headers = new Headers({
    "X-RateLimit-Limit": String(rateLimit.limit),
    "X-RateLimit-Remaining": String(rateLimit.remaining),
    "X-RateLimit-Reset": String(rateLimit.resetAt),
  });

  if (!rateLimit.allowed) {
    headers.set("Retry-After", String(Math.ceil(rateLimit.retryAfterMs / 1000)));
    return NextResponse.json(
      {
        error: "Too many requests",
        retryAfterMs: rateLimit.retryAfterMs,
      },
      { status: 429, headers },
    );
  }

  const url = new URL(request.url);
  const query = getQuery(url.searchParams.get("q"));

  if (!query) {
    return NextResponse.json(
      {
        error:
          "Invalid query. Provide ?q= with 2-120 characters.",
      },
      { status: 400, headers },
    );
  }

  const sourceTimeoutMs = getPositiveInt(
    process.env.SOURCE_TIMEOUT_MS,
    DEFAULT_SOURCE_TIMEOUT_MS,
  );
  const maxResultsPerSource = getPositiveInt(
    process.env.MAX_RESULTS_PER_SOURCE,
    DEFAULT_MAX_RESULTS_PER_SOURCE,
  );

  const payload = await searchAllSources(query, {
    sourceTimeoutMs,
    maxResultsPerSource,
  });

  return NextResponse.json(payload, { status: 200, headers });
}
