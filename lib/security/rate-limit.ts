export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  baseCooldownMs: number;
  maxCooldownMs: number;
  strikeResetMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
  limit: number;
  remaining: number;
  resetAt: number;
}

interface RateLimitEntry {
  windowStart: number;
  requestCount: number;
  cooldownUntil: number;
  strikes: number;
  lastViolationAt: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 20,
  windowMs: 60_000,
  baseCooldownMs: 30_000,
  maxCooldownMs: 120_000,
  strikeResetMs: 5 * 60_000,
};

const entries = new Map<string, RateLimitEntry>();

function getOrCreateEntry(ip: string, now: number): RateLimitEntry {
  const current = entries.get(ip);
  if (current) {
    return current;
  }

  const created: RateLimitEntry = {
    windowStart: now,
    requestCount: 0,
    cooldownUntil: 0,
    strikes: 0,
    lastViolationAt: 0,
  };

  entries.set(ip, created);
  return created;
}

function maybeResetWindow(entry: RateLimitEntry, now: number, windowMs: number): void {
  if (now - entry.windowStart >= windowMs) {
    entry.windowStart = now;
    entry.requestCount = 0;
  }
}

function maybeResetStrikes(entry: RateLimitEntry, now: number, strikeResetMs: number): void {
  if (entry.lastViolationAt === 0) {
    return;
  }

  if (now - entry.lastViolationAt >= strikeResetMs) {
    entry.strikes = 0;
  }
}

function computeCooldownMs(
  strikes: number,
  baseCooldownMs: number,
  maxCooldownMs: number,
): number {
  const factor = 2 ** Math.max(0, strikes - 1);
  const cooldown = baseCooldownMs * factor;
  return Math.min(cooldown, maxCooldownMs);
}

function computeRemaining(entry: RateLimitEntry, maxRequests: number): number {
  return Math.max(0, maxRequests - entry.requestCount);
}

function sweepOldEntries(now: number, config: RateLimitConfig): void {
  for (const [key, entry] of entries.entries()) {
    const expiredWindow = now - entry.windowStart > config.windowMs * 2;
    const expiredCooldown = entry.cooldownUntil > 0 && now > entry.cooldownUntil;
    const strikeExpired =
      entry.lastViolationAt > 0 && now - entry.lastViolationAt > config.strikeResetMs;
    const idle = entry.requestCount === 0;

    if (expiredWindow && (idle || (expiredCooldown && strikeExpired))) {
      entries.delete(key);
    }
  }
}

export function checkRateLimit(
  ip: string,
  partialConfig: Partial<RateLimitConfig> = {},
): RateLimitResult {
  const config: RateLimitConfig = { ...DEFAULT_CONFIG, ...partialConfig };
  const now = Date.now();

  sweepOldEntries(now, config);

  const entry = getOrCreateEntry(ip, now);
  maybeResetWindow(entry, now, config.windowMs);
  maybeResetStrikes(entry, now, config.strikeResetMs);

  if (entry.cooldownUntil > now) {
    return {
      allowed: false,
      retryAfterMs: entry.cooldownUntil - now,
      limit: config.maxRequests,
      remaining: 0,
      resetAt: entry.cooldownUntil,
    };
  }

  entry.requestCount += 1;

  if (entry.requestCount > config.maxRequests) {
    entry.strikes += 1;
    entry.lastViolationAt = now;

    const cooldownMs = computeCooldownMs(
      entry.strikes,
      config.baseCooldownMs,
      config.maxCooldownMs,
    );
    entry.cooldownUntil = now + cooldownMs;

    return {
      allowed: false,
      retryAfterMs: cooldownMs,
      limit: config.maxRequests,
      remaining: 0,
      resetAt: entry.cooldownUntil,
    };
  }

  return {
    allowed: true,
    retryAfterMs: 0,
    limit: config.maxRequests,
    remaining: computeRemaining(entry, config.maxRequests),
    resetAt: entry.windowStart + config.windowMs,
  };
}
