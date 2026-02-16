import { describe, expect, it } from "vitest";
import { shouldApplyIncomingUpdate } from "../convex/lib/conflict";

describe("shouldApplyIncomingUpdate", () => {
  it("applies newer updates", () => {
    expect(
      shouldApplyIncomingUpdate({
        existingUpdatedAt: "2026-02-16T00:00:00.000Z",
        incomingUpdatedAt: "2026-02-16T00:00:01.000Z",
        existingSource: "dashboard",
        incomingSource: "dashboard",
      }),
    ).toBe(true);
  });

  it("rejects older updates", () => {
    expect(
      shouldApplyIncomingUpdate({
        existingUpdatedAt: "2026-02-16T00:00:01.000Z",
        incomingUpdatedAt: "2026-02-16T00:00:00.000Z",
        existingSource: "dashboard",
        incomingSource: "dashboard",
      }),
    ).toBe(false);
  });

  it("prefers sheet on exact timestamp tie", () => {
    expect(
      shouldApplyIncomingUpdate({
        existingUpdatedAt: "2026-02-16T00:00:00.000Z",
        incomingUpdatedAt: "2026-02-16T00:00:00.000Z",
        existingSource: "dashboard",
        incomingSource: "sheet",
      }),
    ).toBe(true);
  });
});
