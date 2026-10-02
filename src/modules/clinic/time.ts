/**
 * Time-of-day helpers for clinic configuration.
 *
 * Weekdays use ISO-8601: 1=Monday .. 7=Sunday.
 * Times are local wall-clock strings "HH:mm" interpreted in the clinic
 * timezone, so they are safe to store as text (PRD section 6).
 */

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Half-open interval overlap: [aStart, aEnd) vs [bStart, bEnd). */
export function intervalsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function isValidRange(localStart: string, localEnd: string): boolean {
  return (
    isValidTime(localStart) &&
    isValidTime(localEnd) &&
    timeToMinutes(localStart) < timeToMinutes(localEnd)
  );
}

/** Returns true when [start, end) is fully contained in [outerStart, outerEnd). */
export function isWithin(
  start: number,
  end: number,
  outerStart: number,
  outerEnd: number,
): boolean {
  return start >= outerStart && end <= outerEnd;
}
