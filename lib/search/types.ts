export type PersonStatus = "missing" | "found" | "hospitalized" | "unknown";

export interface PersonResult {
  id: string;
  sourceKey: string;
  sourceName: string;
  name: string;
  age?: string | null;
  cedula?: string | null;
  photoUrl?: string | null;
  status: PersonStatus;
  location?: string | null;
  contact?: string | null;
  profileUrl?: string | null;
  lastUpdated?: string | null;
}

export interface SourceAdapter {
  key: string;
  displayName: string;
  sourceUrl?: string;
  search(query: string): Promise<PersonResult[]>;
}

export interface SourceCatalogEntry {
  key: string;
  name: string;
  sourceUrl?: string;
  enabled: boolean;
  note?: string;
  adapter: SourceAdapter;
}

export interface PublicSourceCatalogEntry {
  key: string;
  name: string;
  sourceUrl?: string;
  enabled: boolean;
  note?: string;
}

export type IgnoredSourceReason = "unknown_source" | "disabled_source";

export interface IgnoredSourceSelection {
  key: string;
  reason: IgnoredSourceReason;
}

export type SourceSearchStatus = "ok" | "error" | "timeout";

export interface SourceSearchResult {
  key: string;
  name: string;
  sourceUrl?: string;
  status: SourceSearchStatus;
  results: PersonResult[];
  error?: string;
}

export interface MetaSearchResponse {
  query: string;
  searchedAt: string;
  sources: SourceSearchResult[];
}

export interface SourceSelectionMetadata {
  requestedSources: string[];
  appliedSources: string[];
  ignoredSources: IgnoredSourceSelection[];
}

export type MetaSearchApiResponse = MetaSearchResponse & SourceSelectionMetadata;
