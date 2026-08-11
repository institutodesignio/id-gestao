import { z } from "zod";

const optionalDate = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Date must use YYYY-MM-DD format"
  )
  .nullable()
  .optional();

export const createProjectUnitSchema = z
  .object({
    unit_id: z
      .string()
      .uuid(),

    starts_at:
      optionalDate,

    ends_at:
      optionalDate,

    is_primary: z
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

export const updateProjectUnitSchema = z
  .object({
    starts_at:
      optionalDate,

    ends_at:
      optionalDate,

    is_primary: z
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

export type CreateProjectUnitInput =
  z.infer<
    typeof createProjectUnitSchema
  >;

export type UpdateProjectUnitInput =
  z.infer<
    typeof updateProjectUnitSchema
  >;