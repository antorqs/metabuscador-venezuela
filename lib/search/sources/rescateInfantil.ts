import type { PersonResult, PersonStatus, SourceAdapter } from "@/lib/search/types";
import { toOptionalString } from "@/lib/search/sources/common";

const SOURCE_KEY = "rescate-infantil-venezuela";
const SOURCE_NAME = "rescateinfantilvenezuela.com";
const SOURCE_URL = "https://rescateinfantilvenezuela.com/";
const SEARCH_URL = "https://rescateinfantilvenezuela.com/api/search";

interface RescateCurrentLocation {
  hospital?: string | null;
  area?: string | null;
  bedNumber?: string | null;
}

interface RescateFindLocation {
  state?: string | null;
  municipality?: string | null;
}

interface RescateInfantilRecord {
  id?: string;
  code?: string | null;
  firstName?: string | null;
  secondName?: string | null;
  lastName?: string | null;
  nickname?: string | null;
  caseStatus?: string | null;
  rescuedAt?: string | null;
  updatedAt?: string | null;
  rescuerPhone?: string | null;
  rescuerWhatsapp?: string | null;
  currentLocation?: RescateCurrentLocation | null;
  findLocation?: RescateFindLocation | null;
}

interface RescateSearchResponse {
  data?: unknown;
}

function mapStatus(caseStatus: string | null | undefined): PersonStatus {
  const normalized = caseStatus?.trim().toUpperCase();

  if (normalized === "HOSPITALIZED") {
    return "hospitalized";
  }

  if (normalized === "FOUND" || normalized === "SAFE" || normalized === "LOCATED") {
    return "found";
  }

  if (normalized === "MISSING") {
    return "missing";
  }

  return "unknown";
}

function buildName(record: RescateInfantilRecord): string | null {
  const parts = [record.firstName, record.secondName, record.lastName]
    .map((value) => toOptionalString(value))
    .filter((value): value is string => Boolean(value));

  if (parts.length > 0) {
    return parts.join(" ");
  }

  return toOptionalString(record.nickname);
}

function buildLocation(record: RescateInfantilRecord): string | null {
  const hospital = toOptionalString(record.currentLocation?.hospital);
  const area = toOptionalString(record.currentLocation?.area);
  const bedNumber = toOptionalString(record.currentLocation?.bedNumber);
  const municipality = toOptionalString(record.findLocation?.municipality);
  const state = toOptionalString(record.findLocation?.state);

  const locationParts = [hospital, area, bedNumber ? `Cama ${bedNumber}` : null, municipality, state]
    .filter((value): value is string => Boolean(value));

  if (locationParts.length === 0) {
    return null;
  }

  return locationParts.join(" - ");
}

function buildContact(record: RescateInfantilRecord): string | null {
  return toOptionalString(record.rescuerPhone) ?? toOptionalString(record.rescuerWhatsapp);
}

function mapRecord(record: RescateInfantilRecord): PersonResult | null {
  const name = buildName(record);
  if (!name) {
    return null;
  }

  const id =
    toOptionalString(record.id) ??
    toOptionalString(record.code) ??
    `${name}-${toOptionalString(record.updatedAt) ?? crypto.randomUUID()}`;

  return {
    id,
    sourceKey: SOURCE_KEY,
    sourceName: SOURCE_NAME,
    name,
    photoUrl: null,
    status: mapStatus(record.caseStatus),
    location: buildLocation(record),
    contact: buildContact(record),
    profileUrl: SOURCE_URL,
    lastUpdated: toOptionalString(record.updatedAt) ?? toOptionalString(record.rescuedAt),
  };
}

async function fetchRecords(query: string): Promise<RescateInfantilRecord[]> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("page", "1");
  url.searchParams.set("limit", "20");

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`rescateinfantilvenezuela.com returned HTTP ${response.status}`);
  }

  const payload: unknown = await response.json();
  const container = payload as RescateSearchResponse;
  if (!container || !Array.isArray(container.data)) {
    throw new Error("rescateinfantilvenezuela.com returned invalid payload");
  }

  return container.data as RescateInfantilRecord[];
}

const rescateInfantilAdapter: SourceAdapter = {
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

export default rescateInfantilAdapter;
