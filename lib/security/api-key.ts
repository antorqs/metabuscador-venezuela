import type { NextRequest } from "next/server";

function parseApiKeys(rawValue: string | undefined): Set<string> {
  if (!rawValue) {
    return new Set();
  }

  const keys = rawValue
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return new Set(keys);
}

export function getConfiguredApiKeys(): Set<string> {
  return parseApiKeys(process.env.API_KEYS);
}

export function extractApiKey(request: NextRequest): string | null {
  const headerKey = request.headers.get("x-api-key")?.trim();
  if (headerKey) {
    return headerKey;
  }

  return null;
}

export function hasValidApiKey(request: NextRequest): boolean {
  const configuredKeys = getConfiguredApiKeys();
  if (configuredKeys.size === 0) {
    return false;
  }

  const apiKey = extractApiKey(request);
  if (!apiKey) {
    return false;
  }

  return configuredKeys.has(apiKey);
}
