import type { PersonResult, SourceAdapter } from "@/lib/search/types";

const SOURCE_KEY = "hospitales-en-venezuela";
const SOURCE_NAME = "hospitalesenvenezuela.com";
const SOURCE_URL = "https://hospitalesenvenezuela.com/";
const RPC_URL =
  "https://ozuxfepfkvnxkywdsqxy.supabase.co/rest/v1/rpc/buscar_paciente";

interface HospitalesVeRecord {
  nombre?: string | null;
  detalle?: string | null;
  cedula?: string | null;
  centro?: string | null;
  ciudad?: string | null;
  telefono?: string | null;
  estado?: string | null;
  estado_por?: string | null;
  estado_fecha?: string | null;
  registrado?: string | null;
  registrado_por?: string | null;
  vol_nombre?: string | null;
  vol_tel?: string | null;
  contacto?: string | null;
  correcciones?: unknown[];
}

function toOptionalString(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function buildLocation(record: HospitalesVeRecord): string | null {
  const centro = toOptionalString(record.centro);
  const ciudad = toOptionalString(record.ciudad);

  if (centro && ciudad) {
    return `${centro} - ${ciudad}`;
  }

  return centro ?? ciudad ?? null;
}

function buildContact(record: HospitalesVeRecord): string | null {
  return (
    toOptionalString(record.telefono) ??
    toOptionalString(record.contacto) ??
    toOptionalString(record.vol_tel)
  );
}

function buildRecordId(record: HospitalesVeRecord): string {
  const pieces = [record.nombre, record.centro, record.registrado]
    .map((value) => toOptionalString(value))
    .filter((value): value is string => Boolean(value));

  if (pieces.length > 0) {
    return pieces.join("|");
  }

  return crypto.randomUUID();
}

function mapRecord(record: HospitalesVeRecord): PersonResult | null {
  const name = toOptionalString(record.nombre);
  if (!name) {
    return null;
  }

  return {
    id: buildRecordId(record),
    sourceKey: SOURCE_KEY,
    sourceName: SOURCE_NAME,
    name,
    photoUrl: null,
    status: "hospitalized",
    location: buildLocation(record),
    contact: buildContact(record),
    profileUrl: SOURCE_URL,
    lastUpdated: toOptionalString(record.registrado),
  };
}

async function fetchPatients(query: string): Promise<HospitalesVeRecord[]> {
  const anonKey = process.env.HOSPITALES_VE_ANON_KEY?.trim();
  if (!anonKey) {
    throw new Error("Missing HOSPITALES_VE_ANON_KEY configuration");
  }

  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ p_term: query }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `hospitalesenvenezuela.com RPC returned HTTP ${response.status}`,
    );
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("hospitalesenvenezuela.com RPC returned invalid payload");
  }

  return payload as HospitalesVeRecord[];
}

const hospitalesVeAdapter: SourceAdapter = {
  key: SOURCE_KEY,
  displayName: SOURCE_NAME,
  sourceUrl: SOURCE_URL,
  async search(query: string) {
    const records = await fetchPatients(query);

    return records
      .map(mapRecord)
      .filter((record): record is PersonResult => record !== null);
  },
};

export default hospitalesVeAdapter;
