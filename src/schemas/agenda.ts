import { z } from "zod";

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/);
const timestamp = z.string().datetime({ offset: true });

export const createAvailabilitySchema = z.object({
  organization_member_id: uuid,
  unit_id: uuid.nullable().optional(),
  project_id: uuid.nullable().optional(),
  weekday: z.number().int().min(0).max(6),
  start_time: time,
  end_time: time,
  timezone: z.string().trim().min(1).max(80).optional(),
  valid_from: date.optional(),
  valid_until: date.nullable().optional(),
}).strict().refine((value) => value.end_time > value.start_time, {
  message: "end_time must be after start_time",
  path: ["end_time"],
});

export const updateAvailabilitySchema = z.object({
  unit_id: uuid.nullable().optional(),
  project_id: uuid.nullable().optional(),
  weekday: z.number().int().min(0).max(6).optional(),
  start_time: time.optional(),
  end_time: time.optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  valid_from: date.optional(),
  valid_until: date.nullable().optional(),
  is_active: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field must be provided");

export const createAppointmentSchema = z.object({
  unit_id: uuid.nullable().optional(),
  project_id: uuid.nullable().optional(),
  care_request_id: uuid.nullable().optional(),
  beneficiary_person_id: uuid,
  professional_member_id: uuid,
  appointment_type: z.string().trim().min(1).max(120),
  starts_at: timestamp,
  ends_at: timestamp,
  timezone: z.string().trim().min(1).max(80).optional(),
  delivery_mode: z.enum(["IN_PERSON", "REMOTE", "HYBRID"]).optional(),
  location_detail: z.string().trim().max(500).nullable().optional(),
  administrative_notes: z.string().trim().max(2000).nullable().optional(),
  source: z.enum(["INTERNAL", "GOOGLE_CALENDAR", "IMPORT"]).optional(),
  external_calendar_id: z.string().trim().max(255).nullable().optional(),
  external_event_id: z.string().trim().max(255).nullable().optional(),
  recurrence_key: z.string().trim().max(255).nullable().optional(),
}).strict().refine((value) => new Date(value.ends_at) > new Date(value.starts_at), {
  message: "ends_at must be after starts_at",
  path: ["ends_at"],
});

export const updateAppointmentSchema = z.object({
  unit_id: uuid.nullable().optional(),
  project_id: uuid.nullable().optional(),
  care_request_id: uuid.nullable().optional(),
  professional_member_id: uuid.optional(),
  appointment_type: z.string().trim().min(1).max(120).optional(),
  starts_at: timestamp.optional(),
  ends_at: timestamp.optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  delivery_mode: z.enum(["IN_PERSON", "REMOTE", "HYBRID"]).optional(),
  location_detail: z.string().trim().max(500).nullable().optional(),
  administrative_notes: z.string().trim().max(2000).nullable().optional(),
  confirmation_notes: z.string().trim().max(1000).nullable().optional(),
  cancellation_reason: z.string().trim().max(1000).nullable().optional(),
  no_show_notes: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
  external_calendar_id: z.string().trim().max(255).nullable().optional(),
  external_event_id: z.string().trim().max(255).nullable().optional(),
  recurrence_key: z.string().trim().max(255).nullable().optional(),
}).strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field must be provided")
  .refine((value) => value.status !== "CANCELLED" || Boolean(value.cancellation_reason?.trim()), {
    message: "cancellation_reason is required when status is CANCELLED",
    path: ["cancellation_reason"],
  })
  .refine((value) => value.status !== "NO_SHOW" || Boolean(value.no_show_notes?.trim()), {
    message: "no_show_notes is required when status is NO_SHOW",
    path: ["no_show_notes"],
  });
