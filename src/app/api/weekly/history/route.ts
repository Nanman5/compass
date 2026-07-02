/**
 * GET /api/weekly/history?familyId= — this family's saved weekly drops (newest first).
 *
 * Powers the "past drops" archive so a family can revisit earlier weeks. The (large) generated
 * infographic is stripped from the list payload to keep it light — a revisited drop shows the
 * static illustration. Server-only (reads the per-family drop archive).
 */

import { type NextRequest, NextResponse } from "next/server";

import { familyAccessError } from "@/lib/authz";
import { drops } from "@/lib/drops";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<Response> {
  const familyId = req.nextUrl.searchParams.get("familyId");
  if (typeof familyId !== "string" || familyId.trim().length === 0) {
    return NextResponse.json({ error: "familyId is required" }, { status: 400 });
  }

  const denied = await familyAccessError(familyId);
  if (denied) return denied;

  const list = await drops.listDrops(familyId, 12).catch(() => []);
  // Strip the (large) generated image from the archive list payload (JSON drops `undefined`).
  const items = list.map((d) => ({ ...d, heroImage: undefined }));
  return NextResponse.json({ drops: items });
}
