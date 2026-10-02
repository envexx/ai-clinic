import { describe, expect, it } from "vitest";

import {
  hashPayload,
  stableStringify,
} from "@/modules/appointments/idempotency";
import {
  prepareBookingSchema,
  staffStatusSchema,
} from "@/modules/appointments/validation";

describe("stableStringify", () => {
  it("is independent of object key order", () => {
    expect(stableStringify({ a: 1, b: 2 })).toBe(
      stableStringify({ b: 2, a: 1 }),
    );
  });

  it("preserves array order", () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });

  it("hashes equivalent payloads identically", () => {
    expect(hashPayload({ x: 1, y: [1, 2] })).toBe(
      hashPayload({ y: [1, 2], x: 1 }),
    );
  });

  it("ignores undefined properties", () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe(
      stableStringify({ a: 1 }),
    );
  });
});

describe("booking validation", () => {
  it("requires explicit consent", () => {
    const result = prepareBookingSchema.safeParse({
      serviceId: "00000000-0000-0000-0000-000000000000",
      startAt: new Date().toISOString(),
      displayName: "Ada",
      contact: "ada@example.com",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid booking request", () => {
    const result = prepareBookingSchema.safeParse({
      serviceId: "00000000-0000-0000-0000-000000000000",
      startAt: new Date().toISOString(),
      displayName: "Ada",
      contact: "ada@example.com",
      consent: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown staff status", () => {
    const result = staffStatusSchema.safeParse({
      status: "CONFIRMED",
      expectedVersion: 1,
    });
    expect(result.success).toBe(false);
  });
});
