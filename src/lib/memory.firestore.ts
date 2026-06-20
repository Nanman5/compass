/**
 * Compass — Firestore-backed memory store (Google Cloud, NOT Firebase console/SDK).
 *
 * A real, persistent, multi-tenant implementation of the `MemoryStore` contract, drop-in
 * behind the same interface as the local JSON store. Uses Cloud Firestore (Native mode) in
 * the dedicated `compass-login-16602` GCP project via the @google-cloud/firestore server
 * SDK and Application Default Credentials (on Cloud Run, the service account; no keys in code).
 *
 * Layout (mirrors the DynamoDB single-table mental model — familyId is the tenant boundary):
 *   families/{familyId}                     → { profile }            (semantic: child profile)
 *   families/{familyId}/learnings/{id}      → Learning               (semantic: learned facts)
 *   families/{familyId}/episodes/{id}       → Episode                (episodic: interactions)
 *
 * Every method addresses data ONLY under families/{familyId}, so a caller can never reach
 * another family's data — exactly like the local store and the DynamoDB design.
 */

import { randomUUID } from "node:crypto";

import { Firestore, type CollectionReference } from "@google-cloud/firestore";

import type {
  ChildProfile,
  Episode,
  FamilyMemory,
  Learning,
  MemoryStore,
} from "@/lib/types";

const FAMILIES = "families";

/** Firestore doc ids can't contain "/"; sanitize the familyId (e.g. "g:123" → "g_123"). */
function docId(familyId: string): string {
  if (typeof familyId !== "string" || familyId.length === 0) {
    throw new Error("familyId is required");
  }
  return familyId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export class FirestoreMemoryStore implements MemoryStore {
  private readonly db: Firestore;

  constructor() {
    // projectId resolves from GOOGLE_CLOUD_PROJECT / GCLOUD_PROJECT / ADC (set on Cloud Run).
    this.db = new Firestore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.FIRESTORE_PROJECT_ID || undefined,
      ignoreUndefinedProperties: true,
    });
  }

  private familyDoc(familyId: string) {
    return this.db.collection(FAMILIES).doc(docId(familyId));
  }
  private learnings(familyId: string): CollectionReference {
    return this.familyDoc(familyId).collection("learnings");
  }
  private episodes(familyId: string): CollectionReference {
    return this.familyDoc(familyId).collection("episodes");
  }

  async getFamilyMemory(familyId: string): Promise<FamilyMemory> {
    const [doc, learnSnap, epSnap] = await Promise.all([
      this.familyDoc(familyId).get(),
      this.learnings(familyId).get(),
      this.episodes(familyId).get(),
    ]);
    const profile = (doc.exists ? (doc.data()?.profile ?? null) : null) as ChildProfile | null;
    const learnings = learnSnap.docs
      .map((d) => d.data() as Learning)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const episodes = epSnap.docs
      .map((d) => d.data() as Episode)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return { profile, learnings, episodes };
  }

  async getProfile(familyId: string): Promise<ChildProfile | null> {
    const doc = await this.familyDoc(familyId).get();
    return (doc.exists ? (doc.data()?.profile ?? null) : null) as ChildProfile | null;
  }

  async saveProfile(profile: ChildProfile): Promise<ChildProfile> {
    const ref = this.familyDoc(profile.familyId);
    const existing = await ref.get();
    const now = new Date().toISOString();
    const prevCreatedAt = (existing.data()?.profile as ChildProfile | undefined)?.createdAt;
    const saved: ChildProfile = {
      ...profile,
      createdAt: prevCreatedAt ?? profile.createdAt ?? now,
      updatedAt: now,
    };
    await ref.set({ profile: saved }, { merge: true });
    return saved;
  }

  async addLearning(input: Omit<Learning, "id" | "createdAt">): Promise<Learning> {
    const learning: Learning = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    // ensure the parent family doc exists (Firestore subcollections don't require it, but
    // we keep a doc so getFamilyMemory's profile read is consistent)
    await this.familyDoc(input.familyId).set({}, { merge: true });
    await this.learnings(input.familyId).doc(learning.id).set(learning);
    return learning;
  }

  async addEpisode(input: Omit<Episode, "id" | "createdAt">): Promise<Episode> {
    const episode: Episode = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    await this.familyDoc(input.familyId).set({}, { merge: true });
    await this.episodes(input.familyId).doc(episode.id).set(episode);
    return episode;
  }

  async updateEpisodeOutcome(familyId: string, episodeId: string, outcome: string): Promise<void> {
    const ref = this.episodes(familyId).doc(episodeId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new Error(`Episode ${episodeId} not found for family ${familyId}`);
    }
    await ref.update({ outcome });
  }

  async deleteFamily(familyId: string): Promise<void> {
    // Delete subcollections then the family doc (BulkWriter handles the batching).
    await this.db.recursiveDelete(this.familyDoc(familyId));
  }
}
