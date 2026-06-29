import type { PersonResult, PersonStatus, SourceAdapter } from "@/lib/search/types";

const SOURCE_KEY = "911-ubica-me";
const SOURCE_NAME = "911.ubica.me";
const SOURCE_URL = "https://911.ubica.me/";
const BASE_DATA_URL = "https://911.ubica.me/public/data";

interface Ubica911Record {
  source?: string;
  person_record_id?: string;
  full_name?: string;
  age?: string;
  ext_venezuela_ci?: string;
  phone?: string;
  last_known_location?: string;
  hospital?: string;
  notes?: string;
  status?: string;
  source_date?: string;
}

function normalizeForSearch(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function firstLetterFromQuery(query: string): string | null {
  const normalized = normalizeForSearch(query);
  const match = normalized.match(/[A-Z]/);
  return match ? match[0] : null;
}

function mapStatus(status: string | undefined): PersonStatus {
  const normalized = (status ?? "").trim().toLowerCase();

  if (normalized === "believed_alive" || normalized === "found") {
    return "found";
  }

  if (normalized === "hospitalized") {
    return "hospitalized";
  }

  if (normalized === "missing") {
    return "missing";
  }

  return "unknown";
}

function getRecordId(record: Ubica911Record): string {
  const personRecordId = record.person_record_id?.trim();
  if (personRecordId) {
    return personRecordId;
  }

  const fallbackParts = [record.full_name, record.ext_venezuela_ci, record.source_date]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  if (fallbackParts.length > 0) {
    return fallbackParts.join("-");
  }

  return crypto.randomUUID();
}

function mapRecord(record: Ubica911Record): PersonResult | null {
  const name = record.full_name?.trim();
  if (!name) {
    return null;
  }

  const location = record.last_known_location?.trim() || record.hospital?.trim() || null;
  const contact = record.phone?.trim() || null;

  return {
    id: getRecordId(record),
    sourceKey: SOURCE_KEY,
    sourceName: SOURCE_NAME,
    name,
    photoUrl: null,
    status: mapStatus(record.status),
    location,
    contact,
    profileUrl: null,
    lastUpdated: record.source_date?.trim() || null,
  };
}

async function fetchRecordsByLetter(letter: string): Promise<Ubica911Record[]> {
  const response = await fetch(`${BASE_DATA_URL}/${letter}.json`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`911.ubica.me returned HTTP ${response.status} for letter ${letter}`);
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("911.ubica.me returned invalid JSON payload");
  }

  return payload as Ubica911Record[];
}

function recordMatchesQuery(record: Ubica911Record, normalizedQuery: string): boolean {
  const fullName = record.full_name?.trim();
  if (!fullName) {
    return false;
  }

  const normalizedName = normalizeForSearch(fullName);
  return normalizedName.includes(normalizedQuery);
}

const ubica911Adapter: SourceAdapter = {
  key: SOURCE_KEY,
  displayName: SOURCE_NAME,
  sourceUrl: SOURCE_URL,
  async search(query: string) {
    const normalizedQuery = normalizeForSearch(query);
    if (normalizedQuery.length < 2) {
      return [];
    }

    const firstLetter = firstLetterFromQuery(normalizedQuery);
    if (!firstLetter) {
      return [];
    }

    const records = await fetchRecordsByLetter(firstLetter);

    return records
      .filter((record) => recordMatchesQuery(record, normalizedQuery))
      .map(mapRecord)
      .filter((record): record is PersonResult => record !== null);
  },
};

export default ubica911Adapter;
