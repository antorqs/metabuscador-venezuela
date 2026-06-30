import type { PersonResult, PersonStatus, SourceAdapter } from "@/lib/search/types";
import { toOptionalString } from "@/lib/search/sources/common";

const SOURCE_KEY = "helpmap-vzla";
const SOURCE_NAME = "helpmapvzla.net";
const SOURCE_URL = "https://www.helpmapvzla.net/";
const API_URL = "https://ruavnnaaymbgfstypkya.supabase.co/rest/v1/patients_public";

interface HelpMapRecord {
  id?: string;
  apellidos?: string | null;
  nombres?: string | null;
  ci_display?: string | null;
  edad?: number | null;
  location_name?: string | null;
  municipality?: string | null;
  state?: string | null;
  estatus?: string | null;
  foto_url?: string | null;
  updated_at?: string | null;
}

function mapStatus(value: string | null | undefined): PersonStatus {
  const normalized = (value ?? "").trim().toUpperCase();

  if (normalized.includes("INGRES")) {
    return "hospitalized";
  }

  if (normalized.includes("ALTA") || normalized.includes("EGRES") || normalized.includes("LOCALIZ")) {
    return "found";
  }

  return "unknown";
}

function normalizeQueryTokens(query: string): string[] {
  const parts = query
    .trim()
    .split(/\s+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0);

  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const token of parts) {
    if (seen.has(token)) {
      continue;
    }

    seen.add(token);
    deduped.push(token);
  }

  return deduped;
}

function buildOrFilter(tokens: string[]): string {
  const escapedTokens = tokens.map((token) => token.replace(/,/g, ""));

  const filters = escapedTokens.flatMap((token) => [
    `nombres.ilike.*${token}*`,
    `apellidos.ilike.*${token}*`,
  ]);

  return `(${filters.join(",")})`;
}

function buildLocation(record: HelpMapRecord): string | null {
  const values = [record.location_name, record.municipality, record.state]
    .map((value) => toOptionalString(value))
    .filter((value): value is string => Boolean(value));

  if (values.length === 0) {
    return null;
  }

  return values.join(" - ");
}

function buildName(record: HelpMapRecord): string | null {
  const firstName = toOptionalString(record.nombres);
  const lastName = toOptionalString(record.apellidos);

  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }

  return firstName ?? lastName ?? null;
}

function mapRecord(record: HelpMapRecord): PersonResult | null {
  const name = buildName(record);
  if (!name) {
    return null;
  }

  return {
    id: toOptionalString(record.id) ?? `${name}-${crypto.randomUUID()}`,
    sourceKey: SOURCE_KEY,
    sourceName: SOURCE_NAME,
    name,
    age: record.edad !== null && record.edad !== undefined ? String(record.edad) : null,
    cedula: toOptionalString(record.ci_display),
    photoUrl: toOptionalString(record.foto_url),
    status: mapStatus(record.estatus),
    location: buildLocation(record),
    contact: null,
    profileUrl: SOURCE_URL,
    lastUpdated: toOptionalString(record.updated_at),
  };
}

async function fetchRecords(query: string): Promise<HelpMapRecord[]> {
  const apiKey = process.env.HELPMAPVZLA_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing HELPMAPVZLA_API_KEY configuration");
  }

  const tokens = normalizeQueryTokens(query);
  if (tokens.length === 0) {
    return [];
  }

  const url = new URL(API_URL);
  url.searchParams.set("select", "*");
  url.searchParams.set("order", "updated_at.desc");
  url.searchParams.set("limit", "2000");
  url.searchParams.set("or", buildOrFilter(tokens));

  const response = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`helpmapvzla.net returned HTTP ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("helpmapvzla.net returned invalid payload");
  }

  return payload as HelpMapRecord[];
}

const helpMapVzlaAdapter: SourceAdapter = {
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

export default helpMapVzlaAdapter;
