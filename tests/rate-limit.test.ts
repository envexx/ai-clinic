import { beforeEach, describe, expect, it } from "vitest";

import { rateLimit, resetRateLimits } from "@/lib/rate-limit";

describe("rate limiter", () => {
  beforeEach(() => resetRateLimits());

  it("allows up to the limit then blocks", () => {
    const options = { limit: 3, windowMs: 60_000 };
    expect(rateLimit("k", options)).toBe(true);
    expect(rateLimit("k", options)).toBe(true);
    expect(rateLimit("k", options)).toBe(true);
    expect(rateLimit("k", options)).toBe(false);
  });

  it("uses independent buckets per key", () => {
    const options = { limit: 1, windowMs: 60_000 };
    expect(rateLimit("a", options)).toBe(true);
    expect(rateLimit("b", options)).toBe(true);
    expect(rateLimit("a", options)).toBe(false);
  });
});
