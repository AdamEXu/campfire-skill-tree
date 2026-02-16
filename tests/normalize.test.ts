import { describe, expect, it } from "vitest";
import { normalizeFullName } from "../lib/normalize";

describe("normalizeFullName", () => {
  it("trims and compresses whitespace", () => {
    expect(normalizeFullName("   jane    doe   ")).toBe("Jane Doe");
  });

  it("capitalizes words", () => {
    expect(normalizeFullName("john smith jr")).toBe("John Smith Jr");
  });
});
