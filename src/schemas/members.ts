import { z } from "zod";

export const memberStatusSchema =
  z.enum([
    "ACTIVE",
    "INACTIVE",
    "SUSPENDED",
    "ENDED",
  ]);

export const membersQuerySchema =
  z
    .object({
      page:
        z.coerce
          .number()
          .int()
          .min(1)
          .default(1),

      limit:
        z.coerce
          .number()
          .int()
          .min(1)
          .max(100)
          .default(20),

      search:
        z.string()
          .trim()
          .min(1)
          .max(120)
          .optional(),

      status:
        memberStatusSchema
          .optional(),
    })
    .strict();

export type MembersQuery =
  z.infer<
    typeof membersQuerySchema
  >;