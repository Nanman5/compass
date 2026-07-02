/**
 * Compass — hard per-family spend cap (the project is submitted; keep the demo alive
 * for pennies, never more).
 *
 * Google offers no per-user billing limits, so we meter in-app: every route that reaches
 * an LLM pre-charges a conservative USD estimate against its family's ledger BEFORE doing
 * the work. Once a family/device has spent the cap (default $0.30, override with
 * FAMILY_BUDGET_USD), those routes return a warm "demo budget used up" note instead of
 * burning more. Free work (memory reads, Europe PMC, cached weekly drops) is never charged.
 *
 * Backend mirrors the other stores: local JSON (dev) / Firestore `budgets/{familyId}` (prod).
 */

import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { FieldValue, Firestore } from "@google-cloud/firestore";
import { NextResponse } from "next/server";

import { withLock } from "@/lib/locks";

/** Lifetime cap per familyId, in USD. */
const CAP_USD = Number(process.env.FAMILY_BUDGET_USD ?? "0.30");

/** Conservative (over-)estimates per operation, in USD. */
export const COST = {
  coachTurn: 0.01, // multi-step tool loop + evidence
  chatTurn: 0.004, // helpnow / onboarding single calls
  personalize: 0.012, // ingest + vision + grounded call
  weeklyDrop: 0.05, // synthesis + infographic (only on fresh generation)
  voiceSession: 0.06, // one Live session mint (~10 min max)
  grounding: 0.005, // one Gemini + Google Search lookup
} as const;

/** What the parent sees when the demo budget is spent. */
const BUDGET_MESSAGE =
  "This demo has reached its little budget for your device — thank you so much for trying Compass!";

/* ─────────────────────────────── local JSON ledger */

function ledgerFile(): string {
  return process.env.COMPASS_DATA_DIR
    ? path.join(process.env.COMPASS_DATA_DIR, "..", "budgets.json")
    : path.join(process.cwd(), ".data", "budgets.json");
}

async function localAddAndGet(familyId: string, usd: number): Promise<number> {
  return withLock("budget:ledger", async () => {
    let ledger: Record<string, number> = {};
    try {
      ledger = JSON.parse(await readFile(ledgerFile(), "utf8")) as Record<string, number>;
    } catch {
      /* first spend */
    }
    const spent = (ledger[familyId] ?? 0) + usd;
    ledger[familyId] = spent;
    await mkdir(path.dirname(ledgerFile()), { recursive: true });
    await writeFile(ledgerFile(), JSON.stringify(ledger, null, 2), "utf8");
    return spent;
  });
}

/* ─────────────────────────────── Firestore ledger */

let firestore: Firestore | null = null;

function budgetDocId(familyId: string): string {
  return familyId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function firestoreAddAndGet(familyId: string, usd: number): Promise<number> {
  firestore ??= new Firestore();
  const ref = firestore.collection("budgets").doc(budgetDocId(familyId));
  await ref.set({ spent: FieldValue.increment(usd) }, { merge: true });
  const snap = await ref.get();
  const spent = snap.get("spent");
  return typeof spent === "number" ? spent : usd;
}

/* ─────────────────────────────── the gate */

/** Pre-charge `usd` against this family. Returns the running total AFTER the charge. */
async function addAndGet(familyId: string, usd: number): Promise<number> {
  return process.env.MEMORY_BACKEND === "firestore"
    ? firestoreAddAndGet(familyId, usd)
    : localAddAndGet(familyId, usd);
}

/**
 * Null when the family may spend `usd` more; otherwise the 402 response the route should
 * return. Charged up-front (a failed call still counts — conservative by design). Fails
 * OPEN on ledger errors so a storage hiccup never breaks the app over pennies.
 */
export async function budgetExceededError(familyId: string, usd: number): Promise<Response | null> {
  try {
    const spent = await addAndGet(familyId, usd);
    if (spent > CAP_USD) {
      console.warn(`[budget] family ${familyId} over cap ($${spent.toFixed(3)} > $${CAP_USD})`);
      return NextResponse.json({ error: BUDGET_MESSAGE, budgetExceeded: true }, { status: 402 });
    }
    return null;
  } catch (err) {
    console.error("[budget] ledger failed (allowing the call):", err);
    return null;
  }
}
