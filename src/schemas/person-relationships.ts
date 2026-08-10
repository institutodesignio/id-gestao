import { z } from "zod";

const optionalDate = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Date must use YYYY-MM-DD format"
  )
  .nullable()
  .optional();

export const createPersonRelationshipSchema = z
  .object({
    related_person_id: z
      .string()
      .uuid(),

    relationship_type: z
      .string()
      .trim()
      .min(1)
      .max(120),

    is_legal_guardian: z
      .boolean()
      .optional(),

    is_financial_responsible: z
      .boolean()
      .optional(),

    starts_at: optionalDate,

    ends_at: optionalDate,

    notes: z
      .string()
      .trim()
      .max(1000)
      .nullable()
      .optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      data.starts_at &&
      data.ends_at &&
      data.ends_at < data.starts_at
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ends_at"],
        message:
          "ends_at cannot be before starts_at",
      });
    }
  });

export const updatePersonRelationshipSchema = z
  .object({
    related_person_id: z
      .string()
      .uuid()
      .optional(),

    relationship_type: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .optional(),

    is_legal_guardian: z
      .boolean()
      .optional(),

    is_financial_responsible: z
      .boolean()
      .optional(),

    starts_at: optionalDate,

    ends_at: optionalDate,

    notes: z
      .string()
      .trim()
      .max(1000)
      .nullable()
      .optional(),
  })
  .strict()
  .refine(
    (data) =>
      Object.keys(data).length > 0,
    {
      message:
        "At least one field must be provided",
    }
  )
  .superRefine((data, ctx) => {
    if (
      data.starts_at &&
      data.ends_at &&
      data.ends_at < data.starts_at
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ends_at"],
        message:
          "ends_at cannot be before starts_at",
      });
    }
  });