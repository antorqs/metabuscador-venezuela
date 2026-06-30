import type { PersonResult, SourceAdapter } from "@/lib/search/types";
import { toOptionalString } from "@/lib/search/sources/common";

const SOURCE_KEY = "busca-en-listas-vzla";
const SOURCE_NAME = "buscaenlistasvzla.info";
const SOURCE_URL = "https://buscaenlistasvzla.info/";
const SEARCH_URL = "https://buscaenlistasvzla.info/search";

interface BuscaEnListasRecord {
  name?: string | null;
  place?: string | null;
  note?: string | null;
  found?: string | null;
  img?: string | null;
  cedula?: string | null;
  address?: string | null;
  age?: number | null;
}

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function buildId(record: BuscaEnListasRecord): string {
  const parts = [record.name, record.place, record.found, record.cedula, record.address]
    .map((value) => toOptionalString(value))
    .filter((value): value is string => Boolean(value));

  if (parts.length > 0) {
    return parts.join("|");
  }

  return crypto.randomUUID();
}

function buildLocation(record: BuscaEnListasRecord): string | null {
  const place = toOptionalString(record.place);
  const address = toOptionalString(record.address);

  if (place && address) {
    return `${place} - ${address}`;
  }

  return place ?? address ?? null;
}

function mapPhotoUrl(value: string | null | undefined): string | null {
  const raw = toOptionalString(value);
  if (!raw) {
    return null;
  }

  if (!isAbsoluteHttpUrl(raw)) {
    return null;
  }

  return raw;
}

function mapRecord(record: BuscaEnListasRecord): PersonResult | null {
  const name = toOptionalString(record.name);
  if (!name) {
    return null;
  }

  return {
    id: buildId(record),
    sourceKey: SOURCE_KEY,
    sourceName: SOURCE_NAME,
    name,
    age: record.age !== null && record.age !== undefined ? String(record.age) : null,
    cedula: toOptionalString(record.cedula),
    photoUrl: mapPhotoUrl(record.img),
    status: "hospitalized",
    location: buildLocation(record),
    contact: null,
    profileUrl: SOURCE_URL,
    lastUpdated: toOptionalString(record.found),
  };
}

async function fetchRecords(query: string): Promise<BuscaEnListasRecord[]> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("q", query);

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`buscaenlistasvzla.info returned HTTP ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("buscaenlistasvzla.info returned invalid payload");
  }

  return payload as BuscaEnListasRecord[];
}

const buscaEnListasVzlaAdapter: SourceAdapter = {
  key: SOURCE_KEY,
  displayName: SOURCE_NAME,
  sourceUrl: SOURCE_URL,
  async search(query: string) {
    const records = await fetchRecords(query);

    return records
      .map(mapRecord)
      .filter((record): record is PersonResult => record !== null);
  },
};

export default buscaEnListasVzlaAdapter;
