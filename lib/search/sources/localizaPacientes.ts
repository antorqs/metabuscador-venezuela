import type { PersonResult, PersonStatus, SourceAdapter } from "@/lib/search/types";
import { toOptionalString } from "@/lib/search/sources/common";

const SOURCE_KEY = "localiza-pacientes";
const SOURCE_NAME = "localizapacientes.com";
const SOURCE_URL = "https://localizapacientes.com/";
const SEARCH_URL = "https://localizapacientes.com/api/search";

interface LocalizaPacientesRecord {
  id?: string;
  nombreCompleto?: string | null;
  edad?: number | null;
  condicion?: string | null;
  hospital?: string | null;
  ciudad?: string | null;
  estado?: string | null;
  fechaIngreso?: string | null;
  direccion?: string | null;
  cedula?: string | null;
}

interface LocalizaPacientesResponse {
  resultados?: unknown;
}

function mapStatus(value: string | null | undefined): PersonStatus {
  const normalized = (value ?? "").trim().toUpperCase();

  if (normalized.includes("ATENDIDO")) {
    return "hospitalized";
  }

  if (
    normalized.includes("ALTA") ||
    normalized.includes("EGRESADO") ||
    normalized.includes("LOCALIZADO")
  ) {
    return "found";
  }

  if (normalized.includes("DESAPAREC")) {
    return "missing";
  }

  return "unknown";
}

function buildLocation(record: LocalizaPacientesRecord): string | null {
  const structuredLocation = [record.hospital, record.ciudad, record.estado]
    .map((value) => toOptionalString(value))
    .filter((value): value is string => Boolean(value));

  const address = toOptionalString(record.direccion);

  if (structuredLocation.length > 0 && address) {
    return `${structuredLocation.join(" - ")} - ${address}`;
  }

  if (structuredLocation.length > 0) {
    return structuredLocation.join(" - ");
  }

  return address;
}

function mapRecord(record: LocalizaPacientesRecord): PersonResult | null {
  const name = toOptionalString(record.nombreCompleto);
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
    photoUrl: null,
    status: mapStatus(record.condicion),
    location: buildLocation(record),
    contact: null,
    profileUrl: SOURCE_URL,
    lastUpdated: toOptionalString(record.fechaIngreso),
  };
}

async function fetchRecords(query: string): Promise<LocalizaPacientesRecord[]> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("q", query);

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`localizapacientes.com returned HTTP ${response.status}`);
  }

  const payload: unknown = await response.json();
  const parsed = payload as LocalizaPacientesResponse;

  if (!parsed || !Array.isArray(parsed.resultados)) {
    throw new Error("localizapacientes.com returned invalid payload");
  }

  return parsed.resultados as LocalizaPacientesRecord[];
}

const localizaPacientesAdapter: SourceAdapter = {
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

export default localizaPacientesAdapter;
