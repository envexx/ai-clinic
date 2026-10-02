import { z } from "zod";

import {
  TIME_PATTERN,
  intervalsOverlap,
  isWithin,
  timeToMinutes,
} from "./time";

export const serviceInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  durationMinutes: z.number().int().positive(),
  bufferMinutes: z.number().int().min(0).default(0),
  priceMinor: z.number().int().min(0),
  providerIds: z.array(z.uuid()).default([]),
});

export const serviceUpdateSchema = serviceInputSchema
  .partial()
  .extend({ active: z.boolean().optional() });

export type ServiceInput = z.infer<typeof serviceInputSchema>;
export type ServiceUpdate = z.infer<typeof serviceUpdateSchema>;

export const providerInputSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  active: z.boolean().optional(),
});

export const providerUpdateSchema = providerInputSchema.partial();

export type ProviderInput = z.infer<typeof providerInputSchema>;
export type ProviderUpdate = z.infer<typeof providerUpdateSchema>;

export const workingHourSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  localStart: z.string().regex(TIME_PATTERN, "Expected HH:mm (24h)"),
  localEnd: z.string().regex(TIME_PATTERN, "Expected HH:mm (24h)"),
});

export type WorkingHourInput = z.infer<typeof workingHourSchema>;

export const workingHoursInputSchema = z.object({
  hours: z.array(workingHourSchema).max(50),
});

export const clinicHoursInputSchema = z.object({
  hours: z.array(workingHourSchema).max(50),
});

export const scheduleExceptionInputSchema = z.object({
  providerId: z.uuid(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  reason: z.string().trim().min(1).max(240),
});

export const settingsInputSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  currency: z.string().trim().length(3).optional(),
  slotGranularityMinutes: z.number().int().positive().max(240).optional(),
  bookingHorizonDays: z.number().int().positive().max(365).optional(),
  minimumNoticeMinutes: z.number().int().min(0).max(10080).optional(),
  selfServiceCutoffMinutes: z.number().int().min(0).max(10080).optional(),
  pendingActionTtlMinutes: z.number().int().min(1).max(60).optional(),
});

export type SettingsInput = z.infer<typeof settingsInputSchema>;

/** Validates a single set of weekly hours (ranges + no overlap per weekday). */
export function findWorkingHourErrors(
  hours: WorkingHourInput[],
): string[] {
  const errors: string[] = [];

  hours.forEach((hour, index) => {
    if (timeToMinutes(hour.localStart) >= timeToMinutes(hour.localEnd)) {
      errors.push(`Hour #${index + 1}: start must be before end`);
    }
  });

  for (let i = 0; i < hours.length; i += 1) {
    for (let j = i + 1; j < hours.length; j += 1) {
      if (hours[i].weekday !== hours[j].weekday) continue;
      const overlaps = intervalsOverlap(
        timeToMinutes(hours[i].localStart),
        timeToMinutes(hours[i].localEnd),
        timeToMinutes(hours[j].localStart),
        timeToMinutes(hours[j].localEnd),
      );
      if (overlaps) {
        errors.push(`Overlapping hours on weekday ${hours[i].weekday}`);
      }
    }
  }

  return errors;
}

/**
 * Every working-hour block must sit inside a clinic opening block for the same
 * weekday (PRD section 6: provider hours must also satisfy clinic hours). If no
 * clinic hours are configured yet, nothing is enforced.
 */
export function findClinicCoverageErrors(
  hours: WorkingHourInput[],
  clinicHours: WorkingHourInput[],
): string[] {
  if (clinicHours.length === 0) return [];

  const errors: string[] = [];
  for (const hour of hours) {
    const sameDay = clinicHours.filter((c) => c.weekday === hour.weekday);
    const covered = sameDay.some((block) =>
      isWithin(
        timeToMinutes(hour.localStart),
        timeToMinutes(hour.localEnd),
        timeToMinutes(block.localStart),
        timeToMinutes(block.localEnd),
      ),
    );
    if (!covered) {
      errors.push(
        `Working hours on weekday ${hour.weekday} fall outside clinic hours`,
      );
    }
  }
  return errors;
}
