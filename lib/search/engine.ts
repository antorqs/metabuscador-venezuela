import { REGISTERED_SOURCES } from "@/lib/search/registry";
import type {
  MetaSearchResponse,
  PersonResult,
  SourceAdapter,
  SourceSearchResult,
} from "@/lib/search/types";

const DEFAULT_SOURCE_TIMEOUT_MS = 7000;
const DEFAULT_MAX_RESULTS_PER_SOURCE = 50;

class SourceTimeoutError extends Error {
  constructor(sourceName: string, timeoutMs: number) {
    super(`Source '${sourceName}' timed out after ${timeoutMs}ms`);
    this.name = "SourceTimeoutError";
  }
}

function withTimeout<T>(
  promise: Promise<T>,
  sourceName: string,
  timeoutMs: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new SourceTimeoutError(sourceName, timeoutMs));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function normalizeResults(results: PersonResult[], maxResults: number): PersonResult[] {
  const uniqueResults = ensureUniqueResultIds(results);

  if (uniqueResults.length <= maxResults) {
    return uniqueResults;
  }

  return uniqueResults.slice(0, maxResults);
}

function ensureUniqueResultIds(results: PersonResult[]): PersonResult[] {
  const counts = new Map<string, number>();

  return results.map((result) => {
    const currentCount = counts.get(result.id) ?? 0;
    const nextCount = currentCount + 1;
    counts.set(result.id, nextCount);

    if (currentCount === 0) {
      return result;
    }

    return {
      ...result,
      id: `${result.id}#${nextCount}`,
    };
  });
}

function toSourceErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown source error";
}

async function searchSource(
  source: SourceAdapter,
  query: string,
  timeoutMs: number,
  maxResults: number,
): Promise<SourceSearchResult> {
  try {
    const results = await withTimeout(source.search(query), source.displayName, timeoutMs);

    return {
      key: source.key,
      name: source.displayName,
      sourceUrl: source.sourceUrl,
      status: "ok",
      results: normalizeResults(results, maxResults),
    };
  } catch (error) {
    const isTimeout = error instanceof SourceTimeoutError;

    return {
      key: source.key,
      name: source.displayName,
      sourceUrl: source.sourceUrl,
      status: isTimeout ? "timeout" : "error",
      results: [],
      error: toSourceErrorMessage(error),
    };
  }
}

export interface SearchEngineOptions {
  sourceTimeoutMs?: number;
  maxResultsPerSource?: number;
}

export async function searchAllSources(
  query: string,
  options: SearchEngineOptions = {},
): Promise<MetaSearchResponse> {
  const sourceTimeoutMs = options.sourceTimeoutMs ?? DEFAULT_SOURCE_TIMEOUT_MS;
  const maxResultsPerSource =
    options.maxResultsPerSource ?? DEFAULT_MAX_RESULTS_PER_SOURCE;

  const sourceResults = await Promise.all(
    REGISTERED_SOURCES.map((source) =>
      searchSource(source, query, sourceTimeoutMs, maxResultsPerSource),
    ),
  );

  return {
    query,
    searchedAt: new Date().toISOString(),
    sources: sourceResults,
  };
}
