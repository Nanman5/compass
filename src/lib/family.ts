/**
 * Compass — family directory (co-parenting / shared access).
 *
 * Decouples IDENTITY (a Google `sub`) from the TENANT (`familyId`) so two parents can
 * share one family's memory. A membership maps an adult → a family; an invite is the
 * consent gate that lets a second adult join. This module holds NO child data — only the
 * adult↔family graph (see "@/lib/memory" for the actual per-family memory).
 *
 * Backend mirrors the memory store: local JSON files under `.data/` in dev, Firestore in
 * prod (MEMORY_BACKEND=firestore). Both implement the same `FamilyDirectory` interface.
 *
 * familyId convention: a brand-new account defaults to `g:<sub>` — the SAME id the app
 * used before this layer existed — so existing memory is preserved and nothing is orphaned.
 * What changed is that OTHER adults can now hold a membership to that same family.
 */

import "server-only";

import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { SessionUser } from "@/lib/auth";
import { FirestoreFamilyDirectory } from "@/lib/family.firestore";
import type { FamilyDirectory, Invite, Membership } from "@/lib/types";

/* ─────────────────────────────── invite codes */

/** Unambiguous alphabet (no 0/O/1/I/L) so a code is easy to read aloud / type on a phone. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LEN = 8;
const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function newInviteCode(): string {
  const bytes = randomBytes(CODE_LEN);
  let code = "";
  for (let i = 0; i < CODE_LEN; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

/** Normalize user-entered codes: uppercase + strip spaces/dashes. The code alphabet has no
 *  ambiguous glyphs (no O/0/I/1/L), so an exact match is all we need. */
export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/* ─────────────────────────────── local JSON implementation */

function dataDir(): string {
  return process.env.COMPASS_DATA_DIR
    ? path.join(process.env.COMPASS_DATA_DIR, "..", "directory")
    : path.join(process.cwd(), ".data", "directory");
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path.join(dataDir(), file), "utf8")) as T;
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === "ENOENT") {
      return fallback;
    }
    throw err;
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  const dir = dataDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, file), JSON.stringify(value, null, 2), "utf8");
}

class LocalFamilyDirectory implements FamilyDirectory {
  async getMembershipByUser(userSub: string): Promise<Membership | null> {
    const all = await readJson<Membership[]>("memberships.json", []);
    return all.find((m) => m.userSub === userSub) ?? null;
  }

  async listMembers(familyId: string): Promise<Membership[]> {
    const all = await readJson<Membership[]>("memberships.json", []);
    return all
      .filter((m) => m.familyId === familyId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async putMembership(membership: Membership): Promise<void> {
    const all = await readJson<Membership[]>("memberships.json", []);
    const next = all.filter((m) => m.userSub !== membership.userSub);
    next.push(membership);
    await writeJson("memberships.json", next);
  }

  async createInvite(invite: Invite): Promise<void> {
    const all = await readJson<Invite[]>("invites.json", []);
    all.push(invite);
    await writeJson("invites.json", all);
  }

  async getInvite(code: string): Promise<Invite | null> {
    const all = await readJson<Invite[]>("invites.json", []);
    return all.find((i) => i.code === code) ?? null;
  }

  async markInviteRedeemed(code: string, userSub: string, redeemedAt: string): Promise<void> {
    const all = await readJson<Invite[]>("invites.json", []);
    const invite = all.find((i) => i.code === code);
    if (invite) {
      invite.redeemedBySub = userSub;
      invite.redeemedAt = redeemedAt;
      await writeJson("invites.json", all);
    }
  }
}

/** Singleton directory — same backend selector as the memory store. */
export const directory: FamilyDirectory =
  process.env.MEMORY_BACKEND === "firestore"
    ? new FirestoreFamilyDirectory()
    : new LocalFamilyDirectory();

/* ─────────────────────────────── business logic (used by the API routes) */

/**
 * The canonical familyId for a signed-in user. Resolves their membership; if they have
 * none yet (first sign-in), it lazily creates one defaulting to `g:<sub>` — preserving any
 * memory saved under that id before this layer existed. This is the SINGLE source of truth
 * the client reads (via /api/auth/me), so both co-parents converge on the same family.
 */
export async function resolveFamilyId(user: SessionUser): Promise<string> {
  const existing = await directory.getMembershipByUser(user.sub);
  if (existing) return existing.familyId;

  const familyId = `g:${user.sub}`;
  await directory.putMembership({
    userSub: user.sub,
    familyId,
    role: "owner",
    name: user.name,
    email: user.email,
    createdAt: new Date().toISOString(),
  });
  return familyId;
}

/** Everyone with access to the user's family (for the "shared with" list). */
export async function listFamilyMembers(familyId: string): Promise<Membership[]> {
  return directory.listMembers(familyId);
}

/** True if this adult is allowed to reach `familyId` (used to guard sensitive routes). */
export async function userCanAccessFamily(user: SessionUser, familyId: string): Promise<boolean> {
  const membership = await directory.getMembershipByUser(user.sub);
  if (membership) return membership.familyId === familyId;
  // No membership yet → their canonical family is the default `g:<sub>`.
  return familyId === `g:${user.sub}`;
}

/** Mint a fresh invite for the user's family. */
export async function createFamilyInvite(
  user: SessionUser,
): Promise<{ code: string; familyId: string; expiresAt: string }> {
  const familyId = await resolveFamilyId(user);
  const now = Date.now();
  const invite: Invite = {
    code: newInviteCode(),
    familyId,
    createdBySub: user.sub,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + INVITE_TTL_MS).toISOString(),
  };
  await directory.createInvite(invite);
  return { code: invite.code, familyId, expiresAt: invite.expiresAt };
}

export type RedeemResult =
  | { ok: true; familyId: string; alreadyMember: boolean }
  | { ok: false; error: "invalid" | "expired" };

/**
 * Redeem an invite: the user joins the invite's family (a membership pointing at it).
 * Re-usable until it expires (a couple may both click the same link), and idempotent —
 * redeeming your own family's code is a harmless no-op.
 */
export async function redeemFamilyInvite(user: SessionUser, rawCode: string): Promise<RedeemResult> {
  const code = normalizeCode(rawCode);
  const invite = await directory.getInvite(code);
  if (!invite) return { ok: false, error: "invalid" };
  if (Date.now() > Date.parse(invite.expiresAt)) return { ok: false, error: "expired" };

  const current = await directory.getMembershipByUser(user.sub);
  if (current?.familyId === invite.familyId) {
    return { ok: true, familyId: invite.familyId, alreadyMember: true };
  }

  await directory.putMembership({
    userSub: user.sub,
    familyId: invite.familyId,
    role: "member",
    name: user.name,
    email: user.email,
    createdAt: new Date().toISOString(),
  });
  await directory.markInviteRedeemed(code, user.sub, new Date().toISOString());
  return { ok: true, familyId: invite.familyId, alreadyMember: false };
}
