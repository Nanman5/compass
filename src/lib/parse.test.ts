/**
 * Tests for the shared LLM-output parsing helpers — the one home for tolerating fenced,
 * prose-wrapped, or plain JSON across coach / onboarding / personalize / weekly.
 */

import { describe, expect, it } from "vitest";

import { asString, extractJsonObject, firstBalancedObject } from "@/lib/parse";

describe("extractJsonObject", () => {
  it("parses a plain JSON object", () => {
    expect(extractJsonObject('{"a": 1}')).toEqual({ a: 1 });
  });

  it("parses a ```json fenced block", () => {
    expect(extractJsonObject('Here you go:\n```json\n{"a": 1}\n```\nDone.')).toEqual({ a: 1 });
  });

  it("parses an object wrapped in prose (balanced braces, nested)", () => {
    const text = 'Sure! {"outer": {"inner": "x"}, "b": 2} — hope that helps';
    expect(extractJsonObject(text)).toEqual({ outer: { inner: "x" }, b: 2 });
  });

  it("returns null for arrays, garbage, and empty input", () => {
    expect(extractJsonObject("[1,2,3]")).toBeNull();
    expect(extractJsonObject("no json here")).toBeNull();
    expect(extractJsonObject("")).toBeNull();
    expect(extractJsonObject("{broken")).toBeNull();
  });
});

describe("firstBalancedObject", () => {
  it("finds the first balanced object and ignores the rest", () => {
    expect(firstBalancedObject('x {"a":{"b":1}} y {"c":2}')).toBe('{"a":{"b":1}}');
  });

  it("returns null when no object opens or none closes", () => {
    expect(firstBalancedObject("plain text")).toBeNull();
    expect(firstBalancedObject('{"never": "closed"')).toBeNull();
  });
});

describe("asString", () => {
  it("trims strings and blanks everything else", () => {
    expect(asString("  hi  ")).toBe("hi");
    expect(asString(42)).toBe("");
    expect(asString(undefined)).toBe("");
  });
});
