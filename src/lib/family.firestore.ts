/**
 * Compass — Firestore-backed family directory (co-parenting / shared access).
 *
 * Drop-in implementation of `FamilyDirectory`, mirroring FirestoreMemoryStore: same GCP
 * project, same ADC auth (no keys in code). Holds only the adult↔family graph — never any
 * child data.
 *
 * Layout:
 *   memberships/{userSub}   → Membership   (one per adult; lookup by user = a doc get)
 *   invites/{code}          → Invite       (lookup by code = a doc get)
 *
 * "Who's in family X?" is a single-field equality query on memberships (auto-indexed).
 */

import { Firestore } from "@google-cloud/firestore";

import type { FamilyDirectory, Invite, Membership } from "@/lib/types";

/** Firestore doc ids can't contain "/"; sanitize (e.g. a `sub` is already safe, but be sure). */
function docId(raw: string): string {
  if (typeof raw !== "string" || raw.length === 0) throw new Error("id is required");
  return raw.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export class FirestoreFamilyDirectory implements FamilyDirectory {
  private readonly db: Firestore;

  constructor() {
    this.db = new Firestore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.FIRESTORE_PROJECT_ID || undefined,
      ignoreUndefinedProperties: true,
    });
  }

  async getMembershipByUser(userSub: string): Promise<Membership | null> {
    const doc = await this.db.collection("memberships").doc(docId(userSub)).get();
    return doc.exists ? (doc.data() as Membership) : null;
  }

  async listMembers(familyId: string): Promise<Membership[]> {
    const snap = await this.db.collection("memberships").where("familyId", "==", familyId).get();
    return snap.docs
      .map((d) => d.data() as Membership)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async putMembership(membership: Membership): Promise<void> {
    await this.db.collection("memberships").doc(docId(membership.userSub)).set(membership);
  }

  async createInvite(invite: Invite): Promise<void> {
    await this.db.collection("invites").doc(docId(invite.code)).set(invite);
  }

  async getInvite(code: string): Promise<Invite | null> {
    const doc = await this.db.collection("invites").doc(docId(code)).get();
    return doc.exists ? (doc.data() as Invite) : null;
  }

  async markInviteRedeemed(code: string, userSub: string, redeemedAt: string): Promise<void> {
    await this.db
      .collection("invites")
      .doc(docId(code))
      .set({ redeemedBySub: userSub, redeemedAt }, { merge: true });
  }
}
