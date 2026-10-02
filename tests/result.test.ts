import { describe, expect, it } from "vitest";

import { DomainError, err, httpStatusFor, ok } from "@/lib/result";

describe("domain result envelope", () => {
  it("builds a success result", () => {
    const result = ok("req-1", { value: 42 });
    expect(result).toEqual({
      success: true,
      code: null,
      requestId: "req-1",
      data: { value: 42 },
      retryable: false,
    });
  });

  it("builds an error result", () => {
    const result = err("req-2", "SLOT_UNAVAILABLE", "Slot taken", true);
    expect(result.success).toBe(false);
    expect(result.code).toBe("SLOT_UNAVAILABLE");
    expect(result.retryable).toBe(true);
  });

  it("maps error codes to http status", () => {
    expect(httpStatusFor("UNAUTHORIZED")).toBe(401);
    expect(httpStatusFor("RATE_LIMITED")).toBe(429);
    expect(httpStatusFor("INTERNAL_ERROR")).toBe(500);
  });

  it("creates a DomainError with the matching status", () => {
    const error = new DomainError("FORBIDDEN", "nope");
    expect(error.httpStatus).toBe(403);
    expect(error.retryable).toBe(false);
  });
});
