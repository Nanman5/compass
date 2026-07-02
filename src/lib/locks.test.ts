/**
 * Tests for the keyed mutex that serializes the local JSON stores' read-modify-writes.
 * The invariant: two concurrent critical sections under the SAME key never interleave
 * (so no lost updates), while different keys stay concurrent.
 */

import { describe, expect, it } from "vitest";

import { withLock } from "@/lib/locks";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("withLock", () => {
  it("serializes concurrent read-modify-writes on the same key (no lost updates)", async () => {
    let value = 0;
    const bump = () =>
      withLock("same", async () => {
        const read = value;
        await sleep(5); // widen the race window a lost update would need
        value = read + 1;
      });
    await Promise.all([bump(), bump(), bump(), bump()]);
    expect(value).toBe(4);
  });

  it("keeps different keys independent (does not serialize across keys)", async () => {
    const order: string[] = [];
    await Promise.all([
      withLock("slow", async () => {
        await sleep(30);
        order.push("slow");
      }),
      withLock("fast", async () => {
        order.push("fast");
      }),
    ]);
    expect(order).toEqual(["fast", "slow"]);
  });

  it("keeps the chain alive after a section throws", async () => {
    await expect(
      withLock("k", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    await expect(withLock("k", async () => "ok")).resolves.toBe("ok");
  });

  it("returns the section's value", async () => {
    await expect(withLock("k2", async () => 123)).resolves.toBe(123);
  });
});
