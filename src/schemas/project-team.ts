import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();

const projectTeamMemberFields = z.object({
  person_id: z.string().uuid(),
  role_title: z.string().trim().min(1).max(120),
  starts_at: date,
  ends_at: date,
  notes: z.string().trim().max(1000).nullable().optional(),
}).strict();

export const createProjectTeamMemberSchema = projectTeamMemberFields.superRefine((value, ctx) => {
  if (value.starts_at && value.ends_at && value.ends_at < value.starts_at) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["ends_at"], message: "ends_at cannot be before starts_at" });
  }
});

export const updateProjectTeamMemberSchema = projectTeamMemberFields
  .omit({ person_id: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field must be provided");
