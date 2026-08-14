import { z } from "zod";

export const createClinicalCaseSchema = z.object({
  project_id: z.string().uuid(),
  beneficiary_person_id: z.string().uuid(),
  assigned_technical_person_id: z.string().uuid().nullable().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  summary: z.string().trim().min(1).max(2000),
}).strict();

export const updateClinicalCaseSchema = z.object({
  assigned_technical_person_id: z.string().uuid().nullable().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  status: z.enum(["OPEN", "IN_FOLLOW_UP", "PAUSED", "CLOSED"]).optional(),
  summary: z.string().trim().min(1).max(2000).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field must be provided");

export const createClinicalSessionSchema = z.object({
  supervisor_person_id: z.string().uuid(),
  scheduled_at: z.string().datetime({ offset: true }),
  notes: z.string().trim().max(4000).nullable().optional(),
}).strict();

export const updateClinicalSessionSchema = z.object({
  scheduled_at: z.string().datetime({ offset: true }).optional(),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field must be provided");
