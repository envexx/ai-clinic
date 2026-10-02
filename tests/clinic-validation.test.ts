import { describe, expect, it } from "vitest";

import {
  findClinicCoverageErrors,
  findWorkingHourErrors,
  settingsInputSchema,
} from "@/modules/clinic/validation";
import { intervalsOverlap, timeToMinutes } from "@/modules/clinic/time";

describe("time helpers", () => {
  it("converts HH:mm to minutes", () => {
    expect(timeToMinutes("09:30")).toBe(570);
  });

  it("treats intervals as half-open", () => {
    expect(intervalsOverlap(540, 600, 600, 660)).toBe(false);
    expect(intervalsOverlap(540, 600, 599, 660)).toBe(true);
  });
});

describe("working hour validation", () => {
  it("accepts valid non-overlapping hours", () => {
    const errors = findWorkingHourErrors([
      { weekday: 1, localStart: "09:00", localEnd: "12:00" },
      { weekday: 1, localStart: "13:00", localEnd: "17:00" },
    ]);
    expect(errors).toEqual([]);
  });

  it("rejects start after end", () => {
    const errors = findWorkingHourErrors([
      { weekday: 1, localStart: "17:00", localEnd: "09:00" },
    ]);
    expect(errors.some((e) => e.includes("start must be before end"))).toBe(true);
  });

  it("rejects overlapping blocks on the same weekday", () => {
    const errors = findWorkingHourErrors([
      { weekday: 2, localStart: "09:00", localEnd: "12:00" },
      { weekday: 2, localStart: "11:00", localEnd: "14:00" },
    ]);
    expect(errors.some((e) => e.includes("Overlapping"))).toBe(true);
  });

  it("allows the same range on different weekdays", () => {
    const errors = findWorkingHourErrors([
      { weekday: 1, localStart: "09:00", localEnd: "12:00" },
      { weekday: 2, localStart: "09:00", localEnd: "12:00" },
    ]);
    expect(errors).toEqual([]);
  });
});

describe("clinic coverage", () => {
  it("does not enforce coverage when clinic hours are empty", () => {
    const errors = findClinicCoverageErrors(
      [{ weekday: 1, localStart: "08:00", localEnd: "20:00" }],
      [],
    );
    expect(errors).toEqual([]);
  });

  it("flags provider hours outside clinic hours", () => {
    const errors = findClinicCoverageErrors(
      [{ weekday: 1, localStart: "08:00", localEnd: "20:00" }],
      [{ weekday: 1, localStart: "09:00", localEnd: "18:00" }],
    );
    expect(errors.length).toBe(1);
  });

  it("accepts provider hours inside clinic hours", () => {
    const errors = findClinicCoverageErrors(
      [{ weekday: 1, localStart: "10:00", localEnd: "16:00" }],
      [{ weekday: 1, localStart: "09:00", localEnd: "18:00" }],
    );
    expect(errors).toEqual([]);
  });
});

describe("settings schema", () => {
  it("rejects an unknown currency length", () => {
    const result = settingsInputSchema.safeParse({ currency: "AEDX" });
    expect(result.success).toBe(false);
  });

  it("accepts a partial settings patch", () => {
    const result = settingsInputSchema.safeParse({ minimumNoticeMinutes: 60 });
    expect(result.success).toBe(true);
  });
});
