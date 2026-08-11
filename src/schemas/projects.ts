import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional();

const optionalDate = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Date must use YYYY-MM-DD format"
  )
  .nullable()
  .optional();

const projectStatusSchema = z.enum([
  "PLANNING",
  "APPROVED",
  "ACTIVE",
  "SUSPENDED",
  "COMPLETED",
  "CANCELLED",
  "ARCHIVED",
]);

const slugSchema = z
  .string()
  .trim()
  .min(
    1,
    "Slug is required"
  )
  .max(120)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must use lowercase letters, numbers and hyphens only"
  );

export const createProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(
        1,
        "Name is required"
      )
      .max(200),

    slug:
      slugSchema,

    short_name:
      optionalText(120),

    description:
      optionalText(2000),

    status:
      projectStatusSchema.optional(),

    starts_at:
      optionalDate,

    ends_at:
      optionalDate,

    has_clinical_care: z
      .boolean()
      .optional(),
  })
  .strict()
  .superRefine(
    (data, ctx) => {
      if (
        data.starts_at &&
        data.ends_at &&
        data.ends_at <
          data.starts_at
      ) {
        ctx.addIssue({
          code:
            z.ZodIssueCode.custom,

          path: [
            "ends_at",
          ],

          message:
            "ends_at cannot be before starts_at",
        });
      }
    }
  );

export const updateProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(
        1,
        "Name cannot be blank"
      )
      .max(200)
      .optional(),

    slug:
      slugSchema.optional(),

    short_name:
      optionalText(120),

    description:
      optionalText(2000),

    status:
      projectStatusSchema.optional(),

    starts_at:
      optionalDate,

    ends_at:
      optionalDate,

    has_clinical_care: z
      .boolean()
      .optional(),
  })
  .strict()
  .refine(
    (data) =>
      Object.keys(data)
        .length > 0,
    {
      message:
        "At least one field must be provided",
    }
  )
  .superRefine(
    (data, ctx) => {
      if (
        data.starts_at &&
        data.ends_at &&
        data.ends_at <
          data.starts_at
      ) {
        ctx.addIssue({
          code:
            z.ZodIssueCode.custom,

          path: [
            "ends_at",
          ],

          message:
            "ends_at cannot be before starts_at",
        });
      }
    }
  );

export type CreateProjectInput =
  z.infer<
    typeof createProjectSchema
  >;

export type UpdateProjectInput =
  z.infer<
    typeof updateProjectSchema
  >;