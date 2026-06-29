import { headers } from "next/headers";

import ResultCards from "@/components/result-cards";
import { normalizeSearchQuery } from "@/lib/search/query";
import styles from "./page.module.css";
import type { MetaSearchResponse } from "@/lib/search/types";

type HomePageProps = {
  searchParams: Promise<{ q?: string }>;
};

async function getUiSearchUrl(query: string): Promise<string> {
  const incomingHeaders = await headers();
  const host = incomingHeaders.get("x-forwarded-host") ?? incomingHeaders.get("host");
  const protocol = incomingHeaders.get("x-forwarded-proto") ?? "http";

  if (!host) {
    return `/api/ui/search?q=${encodeURIComponent(query)}`;
  }

  const baseUrl = `${protocol}://${host}`;
  return `${baseUrl}/api/ui/search?q=${encodeURIComponent(query)}`;
}

export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const query = normalizeSearchQuery(params.q);

  const payload: MetaSearchResponse | null = query
    ? await fetch(await getUiSearchUrl(query), {
        cache: "no-store",
        headers: {
          "x-internal-ui-key": process.env.INTERNAL_UI_SEARCH_KEY ?? "",
        },
      })
        .then(async (response) => {
          if (!response.ok) {
            return null;
          }

          return (await response.json()) as MetaSearchResponse;
        })
        .catch(() => null)
    : null;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <p className={styles.badge}>Metabuscador de Emergencia</p>
          <h1>Busqueda Centralizada de Personas</h1>
          <p>
            Ingresa un nombre y revisa resultados agrupados por sitio. Esto
            ayuda a familias y voluntarios a consultar varios registros en un
            solo lugar.
          </p>
        </header>

        <form className={styles.searchForm} action="/" method="get">
          <label htmlFor="q" className={styles.label}>
            Nombre
          </label>
          <div className={styles.searchRow}>
            <input
              id="q"
              name="q"
              className={styles.searchInput}
              defaultValue={params.q ?? ""}
              placeholder="Ejemplo: Maria Fernanda Gonzalez"
              minLength={2}
              maxLength={120}
              required
            />
            <button type="submit" className={styles.searchButton}>
              Buscar
            </button>
          </div>
        </form>

        {!query && (
          <section className={styles.emptyState}>
            <h2>Listo para buscar</h2>
            <p>Escribe al menos 2 caracteres para iniciar.</p>
          </section>
        )}

        {params.q && !query && (
          <section className={styles.emptyState}>
            <h2>Busqueda invalida</h2>
            <p>La consulta debe tener entre 2 y 120 caracteres.</p>
          </section>
        )}

        {payload && (
          <section className={styles.resultsSection}>
            <p className={styles.resultMeta}>
              Mostrando resultados para <strong>{payload.query}</strong>
            </p>

            {payload.sources.map((source, sourceIndex) => (
              <article
                key={source.key}
                className={`${styles.sourceGroup} ${
                  sourceIndex % 2 === 0 ? styles.sourceGroupGreen : styles.sourceGroupBlue
                }`}
              >
                <ResultCards source={source} />
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
