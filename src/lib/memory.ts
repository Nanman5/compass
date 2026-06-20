/**
 * Compass — per-family memory store (local-first implementation).
 *
 * Implements the `MemoryStore` contract from "@/lib/types". Persistence is to plain
 * JSON files under a `.data/` dir at the repo root (one file per family), so the demo
 * runs with zero cloud dependencies. The shape, however, is modelled on a DynamoDB
 * single-table design so this module can later be swapped for a real DynamoDB-backed
 * implementation behind the SAME interface — no caller changes required.
 *
 * ── DynamoDB single-table mental model ────────────────────────────────────────────
 *   Table: CompassMemory
 *     PK = FAMILY#<familyId>            ← partition key = the tenant. Hard isolation.
 *     SK = PROFILE                      ← semantic: the child profile (single item)
 *        | LEARNING#<ISO-timestamp>     ← semantic: incremental learned facts (many)
 *        | EPISODE#<ISO-timestamp>      ← episodic: coach interactions / Win Logger (many)
 *
 *   Reads  → Query(PK = FAMILY#id [, SK begins_with PROFILE|LEARNING#|EPISODE#]).
 *   Writes → PutItem with PK = FAMILY#id (every write is pinned to the caller's tenant).
 *   Delete → Query by PK then BatchWrite deletes (here: just remove the family's file).
 *
 * In this local impl each "family file" IS the partition: it holds the PROFILE item
 * plus the LEARNING#/EPISODE# item collections. Because every method takes a familyId
 * and only ever opens that family's file, a caller can NEVER reach another family's
 * data — the partition key is the only door in, exactly as on DynamoDB.
 * ──────────────────────────────────────────────────────────────────────────────────
 */

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";

import { FirestoreMemoryStore } from "@/lib/memory.firestore";
import type {
  ChildProfile,
  Episode,
  FamilyMemory,
  Learning,
  MemoryStore,
} from "@/lib/types";

/** On-disk shape of one family's partition (PROFILE + LEARNING#/EPISODE# collections). */
interface FamilyRecord {
  profile: ChildProfile | null;
  learnings: Learning[];
  episodes: Episode[];
}

/** Fresh empty partition. Must return NEW arrays each call — a shared array would leak
 *  writes across families (an "empty" read for family B would see family A's pushes). */
function emptyRecord(): FamilyRecord {
  return { profile: null, learnings: [], episodes: [] };
}

/** Root for the local "table". Override with COMPASS_DATA_DIR (used by tests). */
function dataDir(): string {
  return process.env.COMPASS_DATA_DIR ?? path.join(process.cwd(), ".data", "families");
}

/**
 * Sanitize a familyId before using it as a filename. DynamoDB would accept any string
 * as a partition key; on a filesystem we must reject path traversal so one tenant can
 * never address another tenant's file (e.g. "../other").
 */
function familyFilePath(familyId: string): string {
  if (typeof familyId !== "string" || familyId.length === 0) {
    throw new Error("familyId is required");
  }
  const safe = familyId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(dataDir(), `${safe}.json`);
}

async function readFamily(familyId: string): Promise<FamilyRecord> {
  try {
    const raw = await readFile(familyFilePath(familyId), "utf8");
    const parsed = JSON.parse(raw) as Partial<FamilyRecord>;
    return {
      profile: parsed.profile ?? null,
      learnings: parsed.learnings ?? [],
      episodes: parsed.episodes ?? [],
    };
  } catch (err: unknown) {
    if (isNotFound(err)) return emptyRecord();
    throw err;
  }
}

async function writeFamily(familyId: string, record: FamilyRecord): Promise<void> {
  const file = familyFilePath(familyId);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(record, null, 2), "utf8");
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "ENOENT"
  );
}

class LocalMemoryStore implements MemoryStore {
  async getFamilyMemory(familyId: string): Promise<FamilyMemory> {
    const record = await readFamily(familyId);
    return {
      profile: record.profile,
      learnings: record.learnings,
      episodes: record.episodes,
    };
  }

  async getProfile(familyId: string): Promise<ChildProfile | null> {
    const record = await readFamily(familyId);
    return record.profile;
  }

  async saveProfile(profile: ChildProfile): Promise<ChildProfile> {
    const record = await readFamily(profile.familyId);
    const now = new Date().toISOString();
    // Upsert the single PROFILE item, preserving the original createdAt on update.
    const saved: ChildProfile = {
      ...profile,
      createdAt: record.profile?.createdAt ?? profile.createdAt ?? now,
      updatedAt: now,
    };
    record.profile = saved;
    await writeFamily(profile.familyId, record);
    return saved;
  }

  async addLearning(input: Omit<Learning, "id" | "createdAt">): Promise<Learning> {
    const record = await readFamily(input.familyId);
    const learning: Learning = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    record.learnings.push(learning); // append as LEARNING#<ts>
    await writeFamily(input.familyId, record);
    return learning;
  }

  async addEpisode(input: Omit<Episode, "id" | "createdAt">): Promise<Episode> {
    const record = await readFamily(input.familyId);
    const episode: Episode = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    record.episodes.push(episode); // append as EPISODE#<ts>
    await writeFamily(input.familyId, record);
    return episode;
  }

  async updateEpisodeOutcome(
    familyId: string,
    episodeId: string,
    outcome: string,
  ): Promise<void> {
    const record = await readFamily(familyId);
    const episode = record.episodes.find((e) => e.id === episodeId);
    if (!episode) {
      throw new Error(`Episode ${episodeId} not found for family ${familyId}`);
    }
    episode.outcome = outcome;
    await writeFamily(familyId, record);
  }

  async deleteFamily(familyId: string): Promise<void> {
    // Wipes the entire partition — the parent's data-autonomy / "forget me" control.
    await rm(familyFilePath(familyId), { force: true });
  }
}

/**
 * Singleton store shared across the app. Backend is chosen by env: set
 * MEMORY_BACKEND=firestore (e.g. on Cloud Run) for real, persistent, multi-tenant
 * storage in Cloud Firestore; otherwise the local JSON store (great for dev/tests).
 * Both implement the SAME `MemoryStore` interface, so nothing else changes.
 */
export const memory: MemoryStore =
  process.env.MEMORY_BACKEND === "firestore"
    ? new FirestoreMemoryStore()
    : new LocalMemoryStore();
