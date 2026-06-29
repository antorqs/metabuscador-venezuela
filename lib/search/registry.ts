import desaparecidosTerremotoAdapter from "@/lib/search/sources/desaparecidosTerremoto";
import hospitalesVeAdapter from "@/lib/search/sources/hospitalesVe";
import rescateInfantilAdapter from "@/lib/search/sources/rescateInfantil";
import ubica911Adapter from "@/lib/search/sources/ubica911";
import venezuelaTeBuscaAdapter from "@/lib/search/sources/venezuelaTeBusca";
import type {
  PublicSourceCatalogEntry,
  SourceAdapter,
  SourceCatalogEntry,
} from "@/lib/search/types";

export const SOURCE_CATALOG: SourceCatalogEntry[] = [
  {
    key: ubica911Adapter.key,
    name: ubica911Adapter.displayName,
    sourceUrl: ubica911Adapter.sourceUrl,
    enabled: true,
    adapter: ubica911Adapter,
  },
  {
    key: hospitalesVeAdapter.key,
    name: hospitalesVeAdapter.displayName,
    sourceUrl: hospitalesVeAdapter.sourceUrl,
    enabled: true,
    adapter: hospitalesVeAdapter,
  },
  {
    key: rescateInfantilAdapter.key,
    name: rescateInfantilAdapter.displayName,
    sourceUrl: rescateInfantilAdapter.sourceUrl,
    enabled: true,
    adapter: rescateInfantilAdapter,
  },
  {
    key: desaparecidosTerremotoAdapter.key,
    name: desaparecidosTerremotoAdapter.displayName,
    sourceUrl: desaparecidosTerremotoAdapter.sourceUrl,
    enabled: false,
    note: "reCAPTCHA needed; contact source developer for integration access.",
    adapter: desaparecidosTerremotoAdapter,
  },
  {
    key: venezuelaTeBuscaAdapter.key,
    name: venezuelaTeBuscaAdapter.displayName,
    sourceUrl: venezuelaTeBuscaAdapter.sourceUrl,
    enabled: false,
    note: "CORS + Cloudflare challenge; pending allowlist/API access.",
    adapter: venezuelaTeBuscaAdapter,
  },
];

export const REGISTERED_SOURCES: SourceAdapter[] = SOURCE_CATALOG.filter(
  (entry) => entry.enabled,
).map((entry) => entry.adapter);

export function getPublicSourceCatalog(): PublicSourceCatalogEntry[] {
  return SOURCE_CATALOG.map((entry) => ({
    key: entry.key,
    name: entry.name,
    sourceUrl: entry.sourceUrl,
    enabled: entry.enabled,
    note: entry.note,
  }));
}
