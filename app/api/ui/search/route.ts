import { NextResponse, type NextRequest } from "next/server";

import { getClientIp } from "@/lib/http/client-ip";
import { searchAllSources } from "@/lib/search/engine";
import { normalizeSearchQuery } from "@/lib/search/query";
import { getSourceCatalog } from "@/lib/search/registry";
import {
  parseRequestedSourceKeys,
  resolveSourceSelection,
} from "@/lib/search/source-filter";
import type { MetaSearchApiResponse } from "@/lib/search/types";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { parsePositiveInt } from "@/lib/utils/number";

const DEFAULT_SOURCE_TIMEOUT_MS = 7000;
const DEFAULT_MAX_RESULTS_PER_SOURCE = 50;
const DEFAULT_RATE_LIMIT_MAX = 30;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_BASE_COOLDOWN_MS = 10_000;
const DEFAULT_RATE_LIMIT_MAX_COOLDOWN_MS = 60_000;
const DEFAULT_RATE_LIMIT_STRIKE_RESET_MS = 5 * 60_000;

function hasValidInternalKey(request: NextRequest): boolean {
  const configuredKey = process.env.INTERNAL_UI_SEARCH_KEY?.trim();
  if (!configuredKey) {
    return false;
  }

  const providedKey = request.headers.get("x-internal-ui-key")?.trim();
  if (!providedKey) {
    return false;
  }

  return providedKey === configuredKey;
}

function hasAllowedOrigin(request: NextRequest): boolean {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) {
    return false;
  }

  const allowedOrigins = [
    `https://${host}`,
    `http://${host}`,
  ];

  const origin = request.headers.get("origin")?.trim();
  if (origin && allowedOrigins.includes(origin)) {
    return true;
  }

  const referer = request.headers.get("referer")?.trim();
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      return allowedOrigins.includes(refererOrigin);
    } catch {
      return false;
    }
  }

  return false;
}

export async function GET(request: NextRequest): Promise<Response> {
  if (!hasValidInternalKey(request) && !hasAllowedOrigin(request)) {
    return NextResponse.json(
      { error: "Origen no permitido" },
      { status: 403 },
    );
  }

  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(ip, {
    maxRequests: parsePositiveInt(process.env.UI_RATE_LIMIT_MAX, DEFAULT_RATE_LIMIT_MAX),
    windowMs: parsePositiveInt(
      process.env.UI_RATE_LIMIT_WINDOW_MS,
      DEFAULT_RATE_LIMIT_WINDOW_MS,
    ),
    baseCooldownMs: parsePositiveInt(
      process.env.UI_RATE_LIMIT_BASE_COOLDOWN_MS,
      DEFAULT_RATE_LIMIT_BASE_COOLDOWN_MS,
    ),
    maxCooldownMs: parsePositiveInt(
      process.env.UI_RATE_LIMIT_MAX_COOLDOWN_MS,
      DEFAULT_RATE_LIMIT_MAX_COOLDOWN_MS,
    ),
    strikeResetMs: parsePositiveInt(
      process.env.UI_RATE_LIMIT_STRIKE_RESET_MS,
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
        error: "Demasiadas solicitudes",
        retryAfterMs: rateLimit.retryAfterMs,
      },
      { status: 429, headers },
    );
  }

  const query = normalizeSearchQuery(request.nextUrl.searchParams.get("q"));

  if (!query) {
    return NextResponse.json(
      { error: "Consulta invalida. Envia ?q= con 2-120 caracteres." },
      { status: 400, headers },
    );
  }

  const sourceTimeoutMs = parsePositiveInt(
    process.env.SOURCE_TIMEOUT_MS,
    DEFAULT_SOURCE_TIMEOUT_MS,
  );
  const maxResultsPerSource = parsePositiveInt(
    process.env.MAX_RESULTS_PER_SOURCE,
    DEFAULT_MAX_RESULTS_PER_SOURCE,
  );

  const requestedSources = parseRequestedSourceKeys(request.nextUrl.searchParams);
  const selection = resolveSourceSelection(requestedSources, getSourceCatalog());

  const payload = await searchAllSources(query, {
    sourceTimeoutMs,
    maxResultsPerSource,
  }, selection.appliedEntries.map((entry) => entry.adapter));

  const responsePayload: MetaSearchApiResponse = {
    ...payload,
    requestedSources: selection.requestedSourceKeys,
    appliedSources: selection.appliedEntries.map((entry) => entry.key),
    ignoredSources: selection.ignoredSources,
  };

  return NextResponse.json(responsePayload, { status: 200, headers });
}
