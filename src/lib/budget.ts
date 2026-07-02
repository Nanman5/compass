/**
 * Compass — hard per-family DAILY spend cap (the project is submitted; keep the demo
 * alive for pennies, never more).
 *
 * Google offers no per-user billing limits, so we meter in-app: every route that reaches
 * an LLM pre-charges a conservative USD estimate against its family's ledger for TODAY
 * (UTC) before doing the work. Once a family/device has spent the daily cap (default
 * $0.30/day, override with FAMILY_BUDGET_USD), those routes return a warm "come back
 * tomorrow" note instead of burning more; at midnight UTC the budget renews itself.
 * Free work (memory reads, Europe PMC, cached weekly drops) is never charged.
 *
 * Backend mirrors the other stores: local JSON (dev) / Firestore (prod), one ledger
 * entry per family per day: `budgets/{familyId}_{YYYY-MM-DD}`.
 */

import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { FieldValue, Firestore } from "@google-cloud/firestore";
import { NextResponse } from "next/server";

import { withLock } from "@/lib/locks";

/** Daily cap per familyId, in USD. */
const CAP_USD = Number(process.env.FAMILY_BUDGET_USD ?? "0.30");

/** Today's ledger bucket, e.g. "2026-07-02" (UTC so it can't be gamed by clock zones). */
function dayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Conservative (over-)estimates per operation, in USD. */
export const COST = {
  coachTurn: 0.01, // multi-step tool loop + evidence
  chatTurn: 0.004, // helpnow / onboarding single calls
  personalize: 0.012, // ingest + vision + grounded call
  weeklyDrop: 0.05, // synthesis + infographic (only on fresh generation)
  voiceSession: 0.06, // one Live session mint (~10 min max)
  grounding: 0.005, // one Gemini + Google Search lookup
} as const;

/** What the parent sees when today's demo budget is spent. */
const BUDGET_MESSAGE =
  "This demo has reached its little budget for your device today — come back tomorrow, and thanks for trying Compass!";

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
    const today = dayKey();
    const key = `${familyId}:${today}`;
    const spent = (ledger[key] ?? 0) + usd;
    ledger[key] = spent;
    // Yesterday's buckets are dead weight — drop them so the file never grows.
    for (const k of Object.keys(ledger)) {
      if (!k.endsWith(`:${today}`)) delete ledger[k];
    }
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
  // One doc per family per day — the increment stays atomic and midnight is a fresh doc.
  const ref = firestore.collection("budgets").doc(`${budgetDocId(familyId)}_${dayKey()}`);
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
      console.warn(`[budget] family ${familyId} over today's cap ($${spent.toFixed(3)} > $${CAP_USD})`);
      return NextResponse.json({ error: BUDGET_MESSAGE, budgetExceeded: true }, { status: 402 });
    }
    return null;
  } catch (err) {
    console.error("[budget] ledger failed (allowing the call):", err);
    return null;
  }
}
