/**
 * Compass — weekly-drop archive (so every drop is saved and revisitable).
 *
 * Same backend selector as the memory store: local JSON files under `.data/drops/` (one file
 * per family, holding that family's drops newest-first) in dev, Firestore in prod
 * (MEMORY_BACKEND=firestore). Both implement the same `DropStore` interface. Neither persists
 * the generated infographic (Firestore's 1 MB doc limit; locally it would bloat the JSON
 * forever) — the current week's image lives in the route's in-memory cache only.
 */

import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { FirestoreDropStore } from "@/lib/drops.firestore";
import { withLock } from "@/lib/locks";
import type { DropStore, WeeklyDrop } from "@/lib/types";

function dataDir(): string {
  return process.env.COMPASS_DATA_DIR
    ? path.join(process.env.COMPASS_DATA_DIR, "..", "drops")
    : path.join(process.cwd(), ".data", "drops");
}

function safeName(familyId: string): string {
  return familyId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function fileFor(familyId: string): string {
  return path.join(dataDir(), `${safeName(familyId)}.json`);
}

function isEnoent(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "ENOENT"
  );
}

async function readDrops(familyId: string): Promise<WeeklyDrop[]> {
  try {
    return JSON.parse(await readFile(fileFor(familyId), "utf8")) as WeeklyDrop[];
  } catch (err) {
    if (isEnoent(err)) return [];
    throw err;
  }
}

async function writeDrops(familyId: string, all: WeeklyDrop[]): Promise<void> {
  await mkdir(dataDir(), { recursive: true });
  await writeFile(fileFor(familyId), JSON.stringify(all, null, 2), "utf8");
}

class LocalDropStore implements DropStore {
  async saveDrop(drop: WeeklyDrop): Promise<void> {
    // Match the Firestore store: don't persist the generated infographic (a multi-MB base64
    // data URL) — the in-memory weekly cache holds it for the week; the archive stays light.
    const toStore: WeeklyDrop = { ...drop };
    delete toStore.heroImage;
    await withLock(`drops:${drop.familyId}`, async () => {
      const all = await readDrops(drop.familyId);
      const next = all.filter((d) => d.weekKey !== drop.weekKey); // upsert by week
      next.push(toStore);
      next.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      await writeDrops(drop.familyId, next);
    });
  }

  async getDrop(familyId: string, weekKey: string): Promise<WeeklyDrop | null> {
    const all = await readDrops(familyId);
    return all.find((d) => d.weekKey === weekKey) ?? null;
  }

  async listDrops(familyId: string, limit = 12): Promise<WeeklyDrop[]> {
    const all = await readDrops(familyId);
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }
}

/** Singleton drop archive — same backend selector as the memory store. */
export const drops: DropStore =
  process.env.MEMORY_BACKEND === "firestore" ? new FirestoreDropStore() : new LocalDropStore();
