const DEFAULT_MIN_QUERY_LENGTH = 2;
const DEFAULT_MAX_QUERY_LENGTH = 120;

interface QueryOptions {
  minLength?: number;
  maxLength?: number;
}

export function normalizeSearchQuery(
  value: string | null | undefined,
  options: QueryOptions = {},
): string | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  const minLength = options.minLength ?? DEFAULT_MIN_QUERY_LENGTH;
  const maxLength = options.maxLength ?? DEFAULT_MAX_QUERY_LENGTH;

  if (normalized.length < minLength || normalized.length > maxLength) {
    return null;
  }

  return normalized;
}
