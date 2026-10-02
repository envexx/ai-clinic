import { z } from "zod";

export const prepareBookingSchema = z.object({
  serviceId: z.uuid(),
  providerId: z.uuid().optional(),
  startAt: z.string().datetime(),
  displayName: z.string().trim().min(1).max(120),
  contact: z.string().trim().min(3).max(200),
  consent: z.literal(true, {
    message: "Consent is required before providing contact details",
  }),
});

export const prepareRescheduleSchema = z.object({
  appointmentId: z.uuid(),
  providerId: z.uuid().optional(),
  startAt: z.string().datetime(),
  expectedVersion: z.number().int().positive(),
});

export const prepareCancellationSchema = z.object({
  appointmentId: z.uuid(),
  expectedVersion: z.number().int().positive(),
});

export const confirmActionSchema = z.object({
  idempotencyKey: z.string().min(8).max(200),
});

export const staffStatusSchema = z.object({
  status: z.enum(["CHECKED_IN", "COMPLETED", "CANCELLED", "NO_SHOW"]),
  expectedVersion: z.number().int().positive(),
  reason: z.string().trim().max(240).optional(),
});

export type PrepareBookingInput = z.infer<typeof prepareBookingSchema>;
export type PrepareRescheduleInput = z.infer<typeof prepareRescheduleSchema>;
export type PrepareCancellationInput = z.infer<typeof prepareCancellationSchema>;
export type StaffStatusInput = z.infer<typeof staffStatusSchema>;
