import type {
  IgnoredSourceSelection,
  SourceCatalogEntry,
} from "@/lib/search/types";

function splitCsvSources(rawValue: string): string[] {
  return rawValue
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function parseRequestedSourceKeys(searchParams: URLSearchParams): string[] {
  const repeatedSourceParams = searchParams.getAll("source");
  const csvSourceParams = searchParams
    .getAll("sources")
    .flatMap((value) => splitCsvSources(value));

  const merged = [...repeatedSourceParams, ...csvSourceParams]
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const item of merged) {
    if (seen.has(item)) {
      continue;
    }

    seen.add(item);
    deduped.push(item);
  }

  return deduped;
}

export interface ResolvedSourceSelection {
  requestedSourceKeys: string[];
  appliedEntries: SourceCatalogEntry[];
  ignoredSources: IgnoredSourceSelection[];
}

export function resolveSourceSelection(
  requestedSourceKeys: string[],
  sourceCatalog: SourceCatalogEntry[],
): ResolvedSourceSelection {
  if (requestedSourceKeys.length === 0) {
    return {
      requestedSourceKeys,
      appliedEntries: sourceCatalog.filter((entry) => entry.enabled),
      ignoredSources: [],
    };
  }

  const catalogByKey = new Map(sourceCatalog.map((entry) => [entry.key, entry]));
  const appliedEntries: SourceCatalogEntry[] = [];
  const ignoredSources: IgnoredSourceSelection[] = [];

  for (const key of requestedSourceKeys) {
    const entry = catalogByKey.get(key);

    if (!entry) {
      ignoredSources.push({ key, reason: "unknown_source" });
      continue;
    }

    if (!entry.enabled) {
      ignoredSources.push({ key, reason: "disabled_source" });
      continue;
    }

    appliedEntries.push(entry);
  }

  return {
    requestedSourceKeys,
    appliedEntries,
    ignoredSources,
  };
}
