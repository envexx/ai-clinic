import { describe, expect, it } from "vitest";

import { classifyIntent } from "@/modules/ai/intent";

describe("fallback intent classifier", () => {
  it("detects handoff requests", () => {
    expect(classifyIntent("I want to talk to staff")).toBe("handoff");
    expect(classifyIntent("can I speak to a human?")).toBe("handoff");
  });

  it("detects managing an existing appointment", () => {
    expect(classifyIntent("I need to cancel my appointment")).toBe(
      "appointment_status",
    );
    expect(classifyIntent("can I reschedule")).toBe("appointment_status");
  });

  it("detects booking intent", () => {
    expect(classifyIntent("book an appointment tomorrow")).toBe("booking");
    expect(classifyIntent("what slots are available")).toBe("booking");
  });

  it("detects greetings", () => {
    expect(classifyIntent("hello")).toBe("greeting");
    expect(classifyIntent("Good morning")).toBe("greeting");
  });

  it("defaults to knowledge", () => {
    expect(classifyIntent("what are your opening hours")).toBe("knowledge");
    expect(classifyIntent("how much is a dental cleaning")).toBe("knowledge");
  });
});
