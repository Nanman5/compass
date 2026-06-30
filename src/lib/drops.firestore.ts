/**
 * Compass — Firestore-backed weekly-drop archive.
 *
 * Drop-in `DropStore`, mirroring FirestoreFamilyDirectory: same GCP project, ADC auth,
 * no keys in code. One doc per (family, ISO week) so revisiting a week is a single get.
 * The generated infographic is NOT persisted here — base64 images blow past Firestore's
 * 1 MB doc limit — so the durable copy is text + real sources; the live drop keeps the image.
 *
 * Layout:  drops/{familyId}__{weekKey} → WeeklyDrop (sans heroImage)
 */

import "server-only";

import { Firestore } from "@google-cloud/firestore";

import type { DropStore, WeeklyDrop } from "@/lib/types";

function docId(raw: string): string {
  if (typeof raw !== "string" || raw.length === 0) throw new Error("id is required");
  return raw.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export class FirestoreDropStore implements DropStore {
  private readonly db: Firestore;

  constructor() {
    this.db = new Firestore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.FIRESTORE_PROJECT_ID || undefined,
      ignoreUndefinedProperties: true,
    });
  }

  private key(familyId: string, weekKey: string): string {
    return `${docId(familyId)}__${docId(weekKey)}`;
  }

  async saveDrop(drop: WeeklyDrop): Promise<void> {
    // Never store the big base64 image (1 MB doc limit); ignoreUndefinedProperties drops it.
    await this.db
      .collection("drops")
      .doc(this.key(drop.familyId, drop.weekKey))
      .set({ ...drop, heroImage: undefined });
  }

  async getDrop(familyId: string, weekKey: string): Promise<WeeklyDrop | null> {
    const doc = await this.db.collection("drops").doc(this.key(familyId, weekKey)).get();
    return doc.exists ? (doc.data() as WeeklyDrop) : null;
  }

  async listDrops(familyId: string, limit = 12): Promise<WeeklyDrop[]> {
    // Single-field equality query (auto-indexed); sort in memory to avoid a composite index.
    const snap = await this.db.collection("drops").where("familyId", "==", familyId).get();
    return snap.docs
      .map((d) => d.data() as WeeklyDrop)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }
}
