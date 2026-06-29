"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import type { PersonResult, PersonStatus, SourceSearchResult } from "@/lib/search/types";
import styles from "@/app/page.module.css";

interface ResultCardsProps {
  source: SourceSearchResult;
  query: string;
}

const VTB_SOURCE_KEY = "venezuela-te-busca";
const VTB_SOURCE_URL = "https://venezuelatebusca.com/";

interface VtbReporter {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}

interface VtbRecord {
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
  reporter?: VtbReporter | null;
}

function toOptionalString(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function mapVtbStatus(
  value: string | null | undefined,
  hospitalStatus: string | null | undefined,
): PersonStatus {
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

function toAbsolutePhotoUrl(value: string | null | undefined): string | null {
  const raw = toOptionalString(value);
  if (!raw) {
    return null;
  }

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }

  const base = VTB_SOURCE_URL.endsWith("/") ? VTB_SOURCE_URL.slice(0, -1) : VTB_SOURCE_URL;
  return `${base}${raw.startsWith("/") ? "" : "/"}${raw}`;
}

function mapVtbRecord(record: VtbRecord): PersonResult | null {
  const firstName = toOptionalString(record.firstName);
  const lastName = toOptionalString(record.lastName);
  const name = firstName && lastName ? `${firstName} ${lastName}` : firstName ?? lastName;

  if (!name) {
    return null;
  }

  const reporterName = toOptionalString(record.reporter?.name);
  const reporterPhone = toOptionalString(record.reporter?.phone);
  const reporterEmail = toOptionalString(record.reporter?.email);

  const contact =
    reporterName && reporterPhone
      ? `${reporterName} ${reporterPhone}`
      : reporterPhone ?? reporterEmail ?? reporterName ?? null;

  const hospital = toOptionalString(record.hospitalName);
  const seen = toOptionalString(record.lastSeen);
  const location = hospital && seen ? `${hospital} - ${seen}` : hospital ?? seen ?? null;

  return {
    id: toOptionalString(record.id) ?? `${name}-${crypto.randomUUID()}`,
    sourceKey: VTB_SOURCE_KEY,
    sourceName: "venezuelatebusca.com",
    name,
    age: record.age !== null && record.age !== undefined ? String(record.age) : null,
    cedula: toOptionalString(record.idNumber),
    photoUrl: toAbsolutePhotoUrl(record.photoUrl),
    status: mapVtbStatus(record.status, record.hospitalStatus),
    location,
    contact,
    profileUrl: VTB_SOURCE_URL,
    lastUpdated:
      toOptionalString(record.lastActivityAt) ??
      toOptionalString(record.updatedAt) ??
      toOptionalString(record.createdAt),
  };
}

function decodeVtbRootData(payload: unknown): VtbRecord[] {
  if (!Array.isArray(payload)) {
    return [];
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
    return [];
  }

  const indexRoute = (decoded as Record<string, unknown>)["routes/_index"];
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

  return persons as VtbRecord[];
}

function getSourceStatusLabel(status: "ok" | "error" | "timeout"): string {
  switch (status) {
    case "ok":
      return "correcto";
    case "error":
      return "error";
    case "timeout":
      return "tiempo agotado";
    default:
      return status;
  }
}

function getPersonStatusLabel(status: "missing" | "found" | "hospitalized" | "unknown"): string {
  switch (status) {
    case "missing":
      return "desaparecido";
    case "found":
      return "encontrado";
    case "hospitalized":
      return "hospitalizado";
    case "unknown":
      return "desconocido";
    default:
      return status;
  }
}

export default function ResultCards({ source, query }: ResultCardsProps) {
  const [expandedImageIds, setExpandedImageIds] = useState<Record<string, boolean>>({});
  const [fallbackSource, setFallbackSource] = useState<SourceSearchResult | null>(null);
  const [fallbackState, setFallbackState] = useState<"idle" | "loading" | "success" | "failed">("idle");
  const [fallbackError, setFallbackError] = useState<string | null>(null);

  useEffect(() => {
    const shouldFallback =
      source.key === VTB_SOURCE_KEY && source.status !== "ok" && query.trim().length >= 2;

    if (!shouldFallback) {
      return;
    }

    let cancelled = false;

    const runFallback = async (): Promise<void> => {
      setFallbackState("loading");
      setFallbackError(null);

      try {
        const fallbackUrl = new URL("https://venezuelatebusca.com/_root.data");
        fallbackUrl.searchParams.set("query", query);

        const response = await fetch(fallbackUrl.toString(), {
          cache: "no-store",
          headers: {
            accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "accept-language": "es-ES,es;q=0.9,en;q=0.8",
            "cache-control": "max-age=0",
            "upgrade-insecure-requests": "1",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload: unknown = await response.json();
        const records = decodeVtbRootData(payload)
          .map(mapVtbRecord)
          .filter((record): record is PersonResult => record !== null);

        if (cancelled) {
          return;
        }

        setFallbackSource({
          ...source,
          status: "ok",
          results: records,
          error: undefined,
        });
        setFallbackState("success");
      } catch (error) {
        if (cancelled) {
          return;
        }

        setFallbackState("failed");
        setFallbackError(error instanceof Error ? error.message : "error_desconocido");
      }
    };

    void runFallback();

    return () => {
      cancelled = true;
    };
  }, [query, source]);

  const toggleImage = (id: string): void => {
    setExpandedImageIds((current) => ({
      ...current,
      [id]: !current[id],
    }));
  };

  const shouldUseFallback =
    source.key === VTB_SOURCE_KEY && source.status !== "ok" && query.trim().length >= 2;

  const effectiveSource = shouldUseFallback && fallbackSource ? fallbackSource : source;
  const statusLabel = shouldUseFallback && fallbackState === "loading"
    ? "recuperando"
    : getSourceStatusLabel(effectiveSource.status);

  return (
    <>
      <div className={styles.sourceHeaderRow}>
        <div className={styles.sourceTitleWrap}>
          <h2>Desde: {source.name}</h2>
          {source.sourceUrl && (
            <a
              href={source.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.sourceLink}
            >
              Ver fuente
            </a>
          )}
        </div>
        <span className={styles.status}>{statusLabel}</span>
      </div>

      {shouldUseFallback && fallbackState === "loading" && (
        <p className={styles.sourceHint}>Intentando consulta directa desde navegador...</p>
      )}

      {shouldUseFallback && fallbackState === "failed" && fallbackError && (
        <p className={styles.sourceHintError}>Fallo consulta directa: {fallbackError}</p>
      )}

      {effectiveSource.results.length === 0 ? (
        <p className={styles.noResults}>Esta fuente no reporta coincidencias.</p>
      ) : (
        <div className={styles.cardGrid}>
          {effectiveSource.results.map((result) => (
            <article key={result.id} className={styles.resultCard}>
              <p className={styles.personName}>{result.name}</p>
              <p>
                <strong>Edad:</strong> {result.age ?? "No reportada"}
              </p>
              <p>
                <strong>Cedula:</strong> {result.cedula ?? "No reportada"}
              </p>
              <p>
                <strong>Estado:</strong> {getPersonStatusLabel(result.status)}
              </p>
              <p>
                <strong>Ubicacion:</strong> {result.location ?? "No reportada"}
              </p>
              <p>
                <strong>Contacto:</strong> {result.contact ?? "No reportado"}
              </p>
              <p>
                <strong>Foto:</strong>{" "}
                {result.photoUrl ? (
                  <button
                    type="button"
                    className={styles.photoButton}
                    onClick={() => toggleImage(result.id)}
                  >
                    {expandedImageIds[result.id] ? "Ocultar" : "Disponible"}
                  </button>
                ) : (
                  "No reportada"
                )}
              </p>

              {result.photoUrl && expandedImageIds[result.id] && (
                <div className={styles.inlineImageWrap}>
                  <Image
                    src={result.photoUrl}
                    alt={`Foto de ${result.name}`}
                    width={900}
                    height={900}
                    className={styles.inlineImage}
                  />
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {effectiveSource.error && <p className={styles.errorText}>Error de fuente: {effectiveSource.error}</p>}
    </>
  );
}
