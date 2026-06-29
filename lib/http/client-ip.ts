import type { NextRequest } from "next/server";

function firstForwardedIp(headerValue: string): string | null {
  const firstEntry = headerValue.split(",")[0]?.trim();
  return firstEntry || null;
}

function sanitizeIp(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const withoutPort = normalized.includes(":") && normalized.includes(".")
    ? normalized.split(":")[0]
    : normalized;

  if (withoutPort.toLowerCase() === "unknown") {
    return null;
  }

  return withoutPort;
}

function fallbackPseudoIp(request: NextRequest): string {
  const userAgent = request.headers.get("user-agent")?.trim() || "no-ua";
  const acceptLanguage = request.headers.get("accept-language")?.trim() || "no-lang";

  const seed = `${userAgent}|${acceptLanguage}`;
  let hash = 0;

  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }

  return `unknown-${hash.toString(16)}`;
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = firstForwardedIp(forwarded);
    if (ip) {
      const sanitized = sanitizeIp(ip);
      if (sanitized) {
        return sanitized;
      }
    }
  }

  const realIp = sanitizeIp(request.headers.get("x-real-ip") ?? "");
  if (realIp) {
    return realIp;
  }

  return fallbackPseudoIp(request);
}
