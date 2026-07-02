/**
 * Tests for the SSRF guard on Paste & Personalize link ingestion: a user-pasted URL must
 * never let the server reach localhost, the cloud metadata service, or the private network.
 */

import { describe, expect, it, vi } from "vitest";

// ingest.ts is server-only; neutralize the guard so we can unit-test its logic in node.
vi.mock("server-only", () => ({}));

const { assertPublicUrl, IngestError, isPrivateAddress } = await import("@/lib/ingest");

describe("isPrivateAddress", () => {
  it("flags private / reserved IPv4 ranges", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "192.168.0.10",
      "172.16.0.1",
      "172.31.255.255",
      "169.254.169.254", // cloud metadata
      "100.64.0.1", // CGNAT
      "0.0.0.0",
      "224.0.0.1", // multicast
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it("allows public IPv4", () => {
    for (const ip of ["8.8.8.8", "142.250.72.14", "104.16.0.1", "172.32.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });

  it("flags private IPv6 (loopback, unique-local, link-local, mapped v4)", () => {
    for (const ip of ["::1", "::", "fd12::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    expect(isPrivateAddress("2607:f8b0::1")).toBe(false);
    expect(isPrivateAddress("::ffff:8.8.8.8")).toBe(false);
  });
});

describe("assertPublicUrl", () => {
  it("rejects non-http(s) schemes", async () => {
    await expect(assertPublicUrl("file:///etc/passwd")).rejects.toThrow(IngestError);
    await expect(assertPublicUrl("ftp://example.com/x")).rejects.toThrow(IngestError);
    await expect(assertPublicUrl("not a url")).rejects.toThrow(IngestError);
  });

  it("rejects literal private / metadata addresses", async () => {
    await expect(assertPublicUrl("http://127.0.0.1:3000/admin")).rejects.toThrow(IngestError);
    await expect(assertPublicUrl("http://169.254.169.254/computeMetadata/v1/")).rejects.toThrow(IngestError);
    await expect(assertPublicUrl("http://[::1]/x")).rejects.toThrow(IngestError);
    await expect(assertPublicUrl("http://10.0.0.5/x")).rejects.toThrow(IngestError);
  });

  it("rejects hostnames that resolve to private addresses (e.g. localhost)", async () => {
    await expect(assertPublicUrl("http://localhost:8080/x")).rejects.toThrow(IngestError);
  });

  it("accepts a public literal address", async () => {
    const url = await assertPublicUrl("https://8.8.8.8/page");
    expect(url.hostname).toBe("8.8.8.8");
  });
});
