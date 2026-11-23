import { describe, expect, it } from "vitest";
import {
  MOVEMENT_OPTIONS,
  SHOT_DURATION_MAX_SECONDS,
  SHOT_SIZE_GROUPS,
  SHOT_TYPE_GROUPS,
  validateShotDuration,
} from "./shotOptions";

describe("shot option catalogs", () => {
  it("lists every shot size from the reference list", () => {
    const sizes = SHOT_SIZE_GROUPS.flatMap((group) => group.options);
    expect(sizes).toHaveLength(13);
    expect(sizes).toContain("Extreme Long Shot");
  });

  it("lists every shot type and movement from the reference list", () => {
    const types = SHOT_TYPE_GROUPS.flatMap((group) => group.options);
    expect(types).toHaveLength(8 + 2 + 6 + 5);
    expect(MOVEMENT_OPTIONS).toEqual([
      "Static",
      "Pan",
      "Tilt",
      "Swish Pan",
      "Swish Tilt",
      "Tracking",
    ]);
  });
});

describe("validateShotDuration", () => {
  it("treats a blank value as unset", () => {
    expect(validateShotDuration("  ")).toEqual({ seconds: null, error: null });
  });

  it("accepts whole seconds within range", () => {
    expect(validateShotDuration("5")).toEqual({ seconds: 5, error: null });
    expect(validateShotDuration(String(SHOT_DURATION_MAX_SECONDS))).toEqual({
      seconds: SHOT_DURATION_MAX_SECONDS,
      error: null,
    });
  });

  it("rejects fractions, zero, negatives, and values over the cap", () => {
    for (const value of ["0", "-3", "2.5", "121", "abc"]) {
      expect(validateShotDuration(value).error).not.toBeNull();
    }
  });
});
