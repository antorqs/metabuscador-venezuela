export type PersonStatus = "missing" | "found" | "hospitalized" | "unknown";

export interface PersonResult {
  id: string;
  sourceKey: string;
  sourceName: string;
  name: string;
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
