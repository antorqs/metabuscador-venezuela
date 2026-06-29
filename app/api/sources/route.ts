import { NextResponse, type NextRequest } from "next/server";

import { getPublicSourceCatalog } from "@/lib/search/registry";
import { hasValidApiKey } from "@/lib/security/api-key";

export async function GET(request: NextRequest): Promise<Response> {
  if (!hasValidApiKey(request)) {
    return NextResponse.json(
      { error: "No autorizado: falta x-api-key o es invalido" },
      { status: 401 },
    );
  }

  const sources = getPublicSourceCatalog();

  return NextResponse.json(
    {
      sources,
      total: sources.length,
    },
    { status: 200 },
  );
}
