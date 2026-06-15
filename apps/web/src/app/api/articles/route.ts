import { NextResponse } from "next/server";
import { z } from "zod";

import { getArticlesPage } from "../../../lib/articles";

const searchParamsSchema = z.object({
  cursor: z.string().min(1).nullable(),
  limit: z.coerce.number().int().min(1).max(30).default(10),
  snapshotAt: z.string().datetime().nullable(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsedParams = searchParamsSchema.safeParse({
    cursor: url.searchParams.get("cursor"),
    limit: url.searchParams.get("limit") ?? undefined,
    snapshotAt: url.searchParams.get("snapshotAt"),
  });

  if (!parsedParams.success) {
    return NextResponse.json(
      { error: "Invalid article page request" },
      { headers: { "Cache-Control": "no-store" }, status: 400 },
    );
  }

  try {
    const page = await getArticlesPage(parsedParams.data);
    return NextResponse.json(page, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch articles";
    const status =
      message === "Invalid article page cursor" || message === "Invalid article page snapshot"
        ? 400
        : 500;

    return NextResponse.json(
      { error: message },
      { headers: { "Cache-Control": "no-store" }, status },
    );
  }
}
