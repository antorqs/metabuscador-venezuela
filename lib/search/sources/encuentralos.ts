import type { PersonResult, PersonStatus, SourceAdapter } from "@/lib/search/types";
import { toOptionalString } from "@/lib/search/sources/common";

const SOURCE_KEY = "encuentralos-tecnosoft";
const SOURCE_NAME = "encuentralos.tecnosoft.dev";
const SOURCE_URL = "https://encuentralos.tecnosoft.dev/";
const SEARCH_URL = "https://encuentralos.tecnosoft.dev/api/personas";

interface EncuentralosRecord {
  id?: string;
  nombre?: string | null;
  edad?: number | null;
  foto?: string | null;
  ultima_ubicacion?: string | null;
  ultima_vez?: string | null;
  reporta_contacto?: string | null;
  estado?: string | null;
  creado?: string | null;
  cedula?: string | null;
}

interface EncuentralosResponse {
  items?: unknown;
}

function mapStatus(value: string | null | undefined): PersonStatus {
  const normalized = (value ?? "").trim().toLowerCase();

  if (normalized.includes("desapare")) {
    return "missing";
  }

  if (normalized.includes("localiz") || normalized.includes("encontr")) {
    return "found";
  }

  if (normalized.includes("hospital")) {
    return "hospitalized";
  }

  return "unknown";
}

function mapRecord(record: EncuentralosRecord): PersonResult | null {
  const name = toOptionalString(record.nombre);
  if (!name) {
    return null;
  }

  return {
    id: toOptionalString(record.id) ?? `${name}-${crypto.randomUUID()}`,
    sourceKey: SOURCE_KEY,
    sourceName: SOURCE_NAME,
    name,
    age: record.edad !== null && record.edad !== undefined ? String(record.edad) : null,
    cedula: toOptionalString(record.cedula),
    photoUrl: toOptionalString(record.foto),
    status: mapStatus(record.estado),
    location: toOptionalString(record.ultima_ubicacion),
    contact: toOptionalString(record.reporta_contacto),
    profileUrl: SOURCE_URL,
    lastUpdated: toOptionalString(record.ultima_vez) ?? toOptionalString(record.creado),
  };
}

async function fetchRecords(query: string): Promise<EncuentralosRecord[]> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("limit", "50");
  url.searchParams.set("offset", "0");
  url.searchParams.set("q", query);

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`encuentralos.tecnosoft.dev returned HTTP ${response.status}`);
  }

  const payload: unknown = await response.json();
  const parsed = payload as EncuentralosResponse;

  if (!parsed || !Array.isArray(parsed.items)) {
    throw new Error("encuentralos.tecnosoft.dev returned invalid payload");
  }

  return parsed.items as EncuentralosRecord[];
}

const encuentralosAdapter: SourceAdapter = {
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

export default encuentralosAdapter;
