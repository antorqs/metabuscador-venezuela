"use client";

import { useState } from "react";
import Image from "next/image";

import type { SourceSearchResult } from "@/lib/search/types";
import styles from "@/app/page.module.css";

interface ResultCardsProps {
  source: SourceSearchResult;
}

const DEFAULT_VISIBLE_RESULTS = 6;
const BUSCA_LISTAS_SOURCE_KEY = "busca-en-listas-vzla";

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

function getPersonStatusTagClass(status: "missing" | "found" | "hospitalized" | "unknown"): string {
  switch (status) {
    case "missing":
      return styles.personStatusMissing;
    case "found":
      return styles.personStatusFound;
    case "hospitalized":
      return styles.personStatusHospitalized;
    case "unknown":
      return styles.personStatusUnknown;
    default:
      return styles.personStatusUnknown;
  }
}

export default function ResultCards({ source }: ResultCardsProps) {
  const [expandedImageIds, setExpandedImageIds] = useState<Record<string, boolean>>({});
  const [showAllResults, setShowAllResults] = useState(false);

  const hasMoreThanDefault = source.results.length > DEFAULT_VISIBLE_RESULTS;
  const visibleResults =
    showAllResults || !hasMoreThanDefault
      ? source.results
      : source.results.slice(0, DEFAULT_VISIBLE_RESULTS);

  const toggleImage = (id: string): void => {
    setExpandedImageIds((current) => ({
      ...current,
      [id]: !current[id],
    }));
  };

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
        <span className={styles.status}>{getSourceStatusLabel(source.status)}</span>
      </div>

      {source.key === BUSCA_LISTAS_SOURCE_KEY && source.results.length > 0 && (
        <p className={styles.sourceInfoHint}>
          Info: este sitio busca en listas escaneadas asi que la coincidencia puede ser parcial, se
          muestran todos los resultados que tienen cierta coincidencia.
        </p>
      )}

      {source.results.length === 0 ? (
        <p className={styles.noResults}>Esta fuente no reporta coincidencias.</p>
      ) : (
        <div className={styles.cardGrid}>
          {visibleResults.map((result) => (
            <article key={result.id} className={styles.resultCard}>
              <p className={styles.personName}>{result.name}</p>
              <p>
                <strong>Edad:</strong> {result.age ?? "No reportada"}
              </p>
              <p>
                <strong>Cedula:</strong> {result.cedula ?? "No reportada"}
              </p>
              <p>
                <strong>Estado:</strong>{" "}
                <span className={`${styles.personStatusTag} ${getPersonStatusTagClass(result.status)}`}>
                  {getPersonStatusLabel(result.status)}
                </span>
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

      {hasMoreThanDefault && (
        <button
          type="button"
          className={styles.showAllButton}
          onClick={() => setShowAllResults((current) => !current)}
        >
          {showAllResults
            ? `Mostrar menos (${source.results.length})`
            : `Mostrar todos (${source.results.length})`}
        </button>
      )}

      {source.error && <p className={styles.errorText}>Error de fuente: {source.error}</p>}
    </>
  );
}
