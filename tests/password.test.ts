import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/modules/auth/password";

describe("password hashing", () => {
  it("verifies a correct password", async () => {
    const hash = await hashPassword("demo-password");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("demo-password", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("demo-password");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("produces a unique salt per hash", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toBe(b);
  });

  it("rejects malformed stored hashes", async () => {
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
  });
});
