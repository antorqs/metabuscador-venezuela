import type { PersonResult, PersonStatus, SourceAdapter } from "@/lib/search/types";
import { toOptionalString } from "@/lib/search/sources/common";

const SOURCE_KEY = "venezuela-te-busca";
const SOURCE_NAME = "venezuelatebusca.com";
const SOURCE_URL = "https://venezuelatebusca.com/";
const SEARCH_URL = "https://venezuelatebusca.com/_root.data";
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const DEFAULT_ACCEPT_LANGUAGE = "es-ES,es;q=0.9,en;q=0.8";

interface ReporterInfo {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}

interface VenezuelaTeBuscaRecord {
  id?: string;
  firstName?: string | null;
  lastName?: string | null;
  age?: number | null;
  idNumber?: string | null;
  lastSeen?: string | null;
  status?: string | null;
  hospitalName?: string | null;
  hospitalStatus?: string | null;
  photoUrl?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastActivityAt?: string | null;
  reporter?: ReporterInfo | null;
}

interface DecodedRootData {
  [key: string]: unknown;
}

function getRequestHeaders(): HeadersInit {
  const userAgent = process.env.VTB_USER_AGENT?.trim() || DEFAULT_USER_AGENT;
  const acceptLanguage =
    process.env.VTB_ACCEPT_LANGUAGE?.trim() || DEFAULT_ACCEPT_LANGUAGE;

  return {
    accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "accept-language": acceptLanguage,
    "cache-control": "max-age=0",
    "upgrade-insecure-requests": "1",
    referer: SOURCE_URL,
    "user-agent": userAgent,
  };
}

function isCloudflareChallenge(payload: string, contentType: string | null): boolean {
  const normalizedType = (contentType ?? "").toLowerCase();
  const normalizedPayload = payload.toLowerCase();

  if (!normalizedType.includes("text/html")) {
    return false;
  }

  return (
    normalizedPayload.includes("just a moment") ||
    normalizedPayload.includes("enable javascript and cookies to continue") ||
    normalizedPayload.includes("cf_chl") ||
    normalizedPayload.includes("challenge-platform")
  );
}

function mapStatus(value: string | null | undefined, hospitalStatus: string | null | undefined): PersonStatus {
  const status = value?.trim().toLowerCase() ?? "";
  const hospital = hospitalStatus?.trim().toLowerCase() ?? "";

  if (hospital || status.includes("hospital")) {
    return "hospitalized";
  }

  if (status.includes("found") || status.includes("localiz")) {
    return "found";
  }

  if (status.includes("missing") || status.includes("buscando") || status.includes("sin-contacto")) {
    return "missing";
  }

  return "unknown";
}

function buildName(record: VenezuelaTeBuscaRecord): string | null {
  const firstName = toOptionalString(record.firstName);
  const lastName = toOptionalString(record.lastName);

  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }

  return firstName ?? lastName ?? null;
}

function toAbsolutePhotoUrl(value: string | null | undefined): string | null {
  const raw = toOptionalString(value);
  if (!raw) {
    return null;
  }

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }

  const base = SOURCE_URL.endsWith("/") ? SOURCE_URL.slice(0, -1) : SOURCE_URL;
  return `${base}${raw.startsWith("/") ? "" : "/"}${raw}`;
}

function buildContact(record: VenezuelaTeBuscaRecord): string | null {
  const name = toOptionalString(record.reporter?.name);
  const phone = toOptionalString(record.reporter?.phone);
  const email = toOptionalString(record.reporter?.email);

  if (name && phone) {
    return `${name} ${phone}`;
  }

  return phone ?? email ?? name ?? null;
}

function buildLocation(record: VenezuelaTeBuscaRecord): string | null {
  const seen = toOptionalString(record.lastSeen);
  const hospital = toOptionalString(record.hospitalName);

  if (hospital && seen) {
    return `${hospital} - ${seen}`;
  }

  return hospital ?? seen ?? null;
}

function mapRecord(record: VenezuelaTeBuscaRecord): PersonResult | null {
  const name = buildName(record);
  if (!name) {
    return null;
  }

  const id = toOptionalString(record.id) ?? `${name}-${crypto.randomUUID()}`;

  return {
    id,
    sourceKey: SOURCE_KEY,
    sourceName: SOURCE_NAME,
    name,
    age: record.age !== null && record.age !== undefined ? String(record.age) : null,
    cedula: toOptionalString(record.idNumber),
    photoUrl: toAbsolutePhotoUrl(record.photoUrl),
    status: mapStatus(record.status, record.hospitalStatus),
    location: buildLocation(record),
    contact: buildContact(record),
    profileUrl: SOURCE_URL,
    lastUpdated:
      toOptionalString(record.lastActivityAt) ??
      toOptionalString(record.updatedAt) ??
      toOptionalString(record.createdAt),
  };
}

function decodeRootDataPayload(payload: unknown): DecodedRootData {
  if (!Array.isArray(payload)) {
    throw new Error("venezuelatebusca.com returned non-array payload");
  }

  const raw = payload as unknown[];
  const cache = new Map<number, unknown>();
  const resolving = new Set<number>();

  const resolveRef = (ref: number): unknown => {
    if (ref === -7) {
      return undefined;
    }

    if (ref === -5) {
      return null;
    }

    if (ref < 0 || ref >= raw.length) {
      return null;
    }

    if (cache.has(ref)) {
      return cache.get(ref);
    }

    if (resolving.has(ref)) {
      return null;
    }

    resolving.add(ref);
    const resolved = resolveValue(raw[ref]);
    resolving.delete(ref);
    cache.set(ref, resolved);
    return resolved;
  };

  const resolveValue = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map((entry) => (typeof entry === "number" ? resolveRef(entry) : resolveValue(entry)));
    }

    if (value && typeof value === "object") {
      const output: Record<string, unknown> = {};

      for (const [rawKey, rawValue] of Object.entries(value)) {
        let key = rawKey;

        if (rawKey.startsWith("_")) {
          const keyIndex = Number.parseInt(rawKey.slice(1), 10);
          if (Number.isFinite(keyIndex)) {
            const resolvedKey = resolveRef(keyIndex);
            if (typeof resolvedKey === "string" && resolvedKey.length > 0) {
              key = resolvedKey;
            }
          }
        }

        const resolvedValue =
          typeof rawValue === "number" ? resolveRef(rawValue) : resolveValue(rawValue);

        if (resolvedValue !== undefined) {
          output[key] = resolvedValue;
        }
      }

      return output;
    }

    return value;
  };

  const decoded = resolveRef(0);
  if (!decoded || typeof decoded !== "object") {
    throw new Error("venezuelatebusca.com payload decoding failed");
  }

  return decoded as DecodedRootData;
}

function extractPersons(decoded: DecodedRootData): VenezuelaTeBuscaRecord[] {
  const indexRoute = decoded["routes/_index"];
  if (!indexRoute || typeof indexRoute !== "object") {
    return [];
  }

  const data = (indexRoute as Record<string, unknown>).data;
  if (!data || typeof data !== "object") {
    return [];
  }

  const persons = (data as Record<string, unknown>).persons;
  if (!Array.isArray(persons)) {
    return [];
  }

  return persons as VenezuelaTeBuscaRecord[];
}

async function fetchRecords(query: string): Promise<VenezuelaTeBuscaRecord[]> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("query", query);

  const response = await fetch(url.toString(), {
    cache: "no-store",
    headers: getRequestHeaders(),
  });

  const contentType = response.headers.get("content-type");
  const rawPayload = await response.text();

  if (isCloudflareChallenge(rawPayload, contentType)) {
    throw new Error("venezuelatebusca.com blocked the request with Cloudflare challenge");
  }

  if (!response.ok) {
    throw new Error(`venezuelatebusca.com returned HTTP ${response.status}`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawPayload) as unknown;
  } catch {
    throw new Error("venezuelatebusca.com returned non-JSON payload");
  }

  const decoded = decodeRootDataPayload(payload);
  return extractPersons(decoded);
}

const venezuelaTeBuscaAdapter: SourceAdapter = {
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

export default venezuelaTeBuscaAdapter;
