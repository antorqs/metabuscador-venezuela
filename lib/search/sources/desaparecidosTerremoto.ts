import type { PersonResult, PersonStatus, SourceAdapter } from "@/lib/search/types";
import { toOptionalString } from "@/lib/search/sources/common";

const SOURCE_KEY = "desaparecidos-terremoto-api";
const SOURCE_NAME = "desaparecidos-terremoto-api.theempire.tech";
const SOURCE_URL = "https://desaparecidos-terremoto-api.theempire.tech/";
const SEARCH_URL =
  "https://desaparecidos-terremoto-api.theempire.tech/api/personas";

interface DesaparecidosRecord {
  id?: string;
  nombre?: string | null;
  primerNombre?: string | null;
  segundoNombre?: string | null;
  primerApellido?: string | null;
  segundoApellido?: string | null;
  direccion?: string | null;
  cedula?: string | null;
  edad?: number | null;
  ubicacion?: string | null;
  ubicacionEstado?: string | null;
  ubicacionMunicipio?: string | null;
  ubicacionParroquia?: string | null;
  ubicacionCentroNombre?: string | null;
  contacto?: string | null;
  nombreContacto?: string | null;
  telefonoContacto?: string | null;
  estado?: string | null;
  foto?: string | null;
  fecha?: string | null;
  fechaContacto?: string | null;
  updatedAt?: number | string | null;
}

interface DesaparecidosResponse {
  items?: unknown;
}

function mapStatus(value: string | null | undefined): PersonStatus {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return "unknown";
  }

  if (normalized.includes("localizado") || normalized.includes("encontr")) {
    return "found";
  }

  if (normalized.includes("hospital")) {
    return "hospitalized";
  }

  if (normalized.includes("sin-contacto") || normalized.includes("desapare")) {
    return "missing";
  }

  return "unknown";
}

function buildName(record: DesaparecidosRecord): string | null {
  const directName = toOptionalString(record.nombre);
  if (directName) {
    return directName;
  }

  const parts = [
    record.primerNombre,
    record.segundoNombre,
    record.primerApellido,
    record.segundoApellido,
  ]
    .map((value) => toOptionalString(value))
    .filter((value): value is string => Boolean(value));

  if (parts.length === 0) {
    return null;
  }

  return parts.join(" ");
}

function buildLocation(record: DesaparecidosRecord): string | null {
  const primary = toOptionalString(record.ubicacion) ?? toOptionalString(record.direccion);
  const context = [
    toOptionalString(record.ubicacionCentroNombre),
    toOptionalString(record.ubicacionParroquia),
    toOptionalString(record.ubicacionMunicipio),
    toOptionalString(record.ubicacionEstado),
  ].filter((value): value is string => Boolean(value));

  if (primary && context.length > 0) {
    return `${primary} - ${context.join(", ")}`;
  }

  if (primary) {
    return primary;
  }

  if (context.length > 0) {
    return context.join(", ");
  }

  return null;
}

function buildContact(record: DesaparecidosRecord): string | null {
  const direct = toOptionalString(record.contacto);
  if (direct) {
    return direct;
  }

  const name = toOptionalString(record.nombreContacto);
  const phone = toOptionalString(record.telefonoContacto);

  if (name && phone) {
    return `${name} ${phone}`;
  }

  return name ?? phone ?? null;
}

function buildLastUpdated(record: DesaparecidosRecord): string | null {
  if (typeof record.updatedAt === "number" && Number.isFinite(record.updatedAt)) {
    return new Date(record.updatedAt).toISOString();
  }

  if (typeof record.updatedAt === "string") {
    const parsed = Date.parse(record.updatedAt);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }

    const raw = record.updatedAt.trim();
    if (raw) {
      return raw;
    }
  }

  return toOptionalString(record.fechaContacto) ?? toOptionalString(record.fecha);
}

function mapRecord(record: DesaparecidosRecord): PersonResult | null {
  const name = buildName(record);
  if (!name) {
    return null;
  }

  const id = toOptionalString(record.id) ?? `${name}-${crypto.randomUUID()}`;
  const photoUrl = toOptionalString(record.foto);

  return {
    id,
    sourceKey: SOURCE_KEY,
    sourceName: SOURCE_NAME,
    name,
    age: record.edad !== null && record.edad !== undefined ? String(record.edad) : null,
    cedula: toOptionalString(record.cedula),
    photoUrl,
    status: mapStatus(record.estado),
    location: buildLocation(record),
    contact: buildContact(record),
    profileUrl: SOURCE_URL,
    lastUpdated: buildLastUpdated(record),
  };
}

async function fetchRecords(query: string): Promise<DesaparecidosRecord[]> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("page", "1");
  url.searchParams.set("pageSize", "20");
  url.searchParams.set("q", query);

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(
      `desaparecidos-terremoto-api.theempire.tech returned HTTP ${response.status}`,
    );
  }

  const payload: unknown = await response.json();
  const parsed = payload as DesaparecidosResponse;
  if (!parsed || !Array.isArray(parsed.items)) {
    throw new Error("desaparecidos-terremoto-api.theempire.tech returned invalid payload");
  }

  return parsed.items as DesaparecidosRecord[];
}

const desaparecidosTerremotoAdapter: SourceAdapter = {
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

export default desaparecidosTerremotoAdapter;
