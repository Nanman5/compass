import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { beforeAll, describe, expect, it, vi } from "vitest";

// family.ts is server-only; neutralize the guard so we can unit-test its logic in node.
vi.mock("server-only", () => ({}));

// Point the local store at a throwaway dir BEFORE importing the module under test.
beforeAll(() => {
  const dir = mkdtempSync(path.join(tmpdir(), "compass-family-"));
  process.env.COMPASS_DATA_DIR = path.join(dir, "families");
  delete process.env.MEMORY_BACKEND; // force the local JSON directory
});

const userA = { sub: "A", email: "a@x.com", name: "Ana", picture: "", exp: 0 };
const userB = { sub: "B", email: "b@x.com", name: "Beto", picture: "", exp: 0 };

describe("family directory — co-parent sharing", () => {
  it("invite → join lands the co-parent on the same family", async () => {
    const fam = await import("@/lib/family");

    // Each new account defaults to its own family (g:<sub>), preserving legacy data.
    expect(await fam.resolveFamilyId(userA)).toBe("g:A");
    expect(await fam.resolveFamilyId(userB)).toBe("g:B");

    // A invites; B redeems and is moved into A's family.
    const invite = await fam.createFamilyInvite(userA);
    expect(invite.familyId).toBe("g:A");

    const redeemed = await fam.redeemFamilyInvite(userB, invite.code);
    expect(redeemed).toMatchObject({ ok: true, familyId: "g:A" });

    // From now on B resolves to the shared family.
    expect(await fam.resolveFamilyId(userB)).toBe("g:A");

    const members = await fam.listFamilyMembers("g:A");
    expect(members.map((m) => m.userSub).sort()).toEqual(["A", "B"]);
    expect(members.find((m) => m.userSub === "A")?.role).toBe("owner");
    expect(members.find((m) => m.userSub === "B")?.role).toBe("member");

    // Access guard: B can reach the shared family, not a stranger's.
    expect(await fam.userCanAccessFamily(userB, "g:A")).toBe(true);
    expect(await fam.userCanAccessFamily(userB, "g:ZZ")).toBe(false);

    // A bad code is rejected, not silently accepted.
    expect(await fam.redeemFamilyInvite(userB, "NOPE")).toMatchObject({ ok: false, error: "invalid" });

    // Codes are typed forgivingly (lowercase / spacing normalized).
    const invite2 = await fam.createFamilyInvite(userA);
    const lower = await fam.redeemFamilyInvite(userB, invite2.code.toLowerCase());
    expect(lower.ok).toBe(true);
  });
});
