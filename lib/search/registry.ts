import hospitalesVeAdapter from "@/lib/search/sources/hospitalesVe";
import ubica911Adapter from "@/lib/search/sources/ubica911";
import type { SourceAdapter } from "@/lib/search/types";

export const REGISTERED_SOURCES: SourceAdapter[] = [
  ubica911Adapter,
  hospitalesVeAdapter,
];
