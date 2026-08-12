import { z } from "zod";

const dateSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Date must use YYYY-MM-DD format"
  )
  .refine(
    (value) => {
      const date =
        new Date(
          `${value}T00:00:00.000Z`
        );

      return (
        !Number.isNaN(
          date.getTime()
        ) &&
        date
          .toISOString()
          .slice(0, 10) ===
          value
      );
    },
    {
      message:
        "Date must be valid",
    }
  );

export const createMemberRoleSchema =
  z
    .object({
      role_id:
        z.string().uuid(),

      starts_at:
        dateSchema.optional(),

      ends_at:
        dateSchema
          .nullable()
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
              z.ZodIssueCode
                .custom,

            path: [
              "ends_at",
            ],

            message:
              "ends_at cannot be before starts_at",
          });
        }
      }
    );

export const endMemberRoleSchema =
  z
    .object({
      ends_at:
        dateSchema,
    })
    .strict();

export type CreateMemberRoleInput =
  z.infer<
    typeof createMemberRoleSchema
  >;

export type EndMemberRoleInput =
  z.infer<
    typeof endMemberRoleSchema
  >;