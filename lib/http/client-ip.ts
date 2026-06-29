import type { NextRequest } from "next/server";

function firstForwardedIp(headerValue: string): string | null {
  const firstEntry = headerValue.split(",")[0]?.trim();
  return firstEntry || null;
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = firstForwardedIp(forwarded);
    if (ip) {
      return ip;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
}
