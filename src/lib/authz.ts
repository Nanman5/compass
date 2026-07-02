/**
 * Compass — per-request family authorization (used by every route that takes a familyId).
 *
 * The tenant model has two kinds of families:
 *  - Signed-in: `g:<google-sub>` (or a joined family via invite). These ids are GUESSABLE
 *    (derived from the Google sub), so access requires a session with a matching membership.
 *  - Guest: `demo-<uuid>` minted client-side and kept in localStorage. These are capability
 *    ids — unguessable 122-bit UUIDs — so holding the id IS the credential, exactly like an
 *    unlisted link. No session required.
 *
 * Every API route that reads or writes family-scoped data must call `familyAccessError`
 * after validating the id and return the response it yields, so a caller can never operate
 * on another family's memory by naming its id.
 */

import "server-only";

import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { userCanAccessFamily } from "@/lib/family";

const GUEST_PREFIX = "demo-";

export function isGuestFamilyId(familyId: string): boolean {
  return familyId.startsWith(GUEST_PREFIX);
}

/**
 * Null when the current request may access `familyId`; otherwise the 401/403 response the
 * route should return. Signed-in users must hold a membership (or own the `g:<sub>` default);
 * guests may only reach unguessable `demo-*` capability ids.
 */
export async function familyAccessError(familyId: string): Promise<Response | null> {
  const user = await getSessionUser();
  if (user) {
    if (await userCanAccessFamily(user, familyId)) return null;
    // A signed-in browser may still be carrying its old pre-sign-in guest id — that guest
    // data is theirs (it lives in their localStorage), so let them keep using it.
    if (isGuestFamilyId(familyId)) return null;
    return NextResponse.json({ error: "Not your family" }, { status: 403 });
  }
  if (isGuestFamilyId(familyId)) return null;
  return NextResponse.json({ error: "Sign in to access this family" }, { status: 401 });
}
