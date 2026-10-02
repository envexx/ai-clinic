export type AgentIntent =
  | "greeting"
  | "handoff"
  | "appointment_status"
  | "booking"
  | "knowledge";

/**
 * Deterministic intent classifier for the offline fallback agent. It is a
 * simple keyword router, not a language model.
 */
export function classifyIntent(text: string): AgentIntent {
  const normalized = text.toLowerCase().trim();

  if (
    /\b(talk to (a )?(staff|human|agent|person|someone)|speak to (a )?(staff|human|agent|person|someone)|real person|receptionist)\b/.test(
      normalized,
    )
  ) {
    return "handoff";
  }
  if (
    /\b(my (appointment|appointments|booking|bookings)|reschedule|cancel|change my|manage my)\b/.test(
      normalized,
    )
  ) {
    return "appointment_status";
  }
  if (
    /\b(book|books|booking|bookings|appointment|appointments|schedule|schedules|scheduling|slot|slots|available|availability|reserve|reservation)\b/.test(
      normalized,
    )
  ) {
    return "booking";
  }
  if (
    /^(hi|hello|hey|good (morning|afternoon|evening)|salam|marhaba|assalam)/.test(
      normalized,
    )
  ) {
    return "greeting";
  }
  return "knowledge";
}
