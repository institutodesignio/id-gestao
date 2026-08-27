import { z } from "zod";

export const memberTypeSchema = z.enum([
  "TECHNICAL_PROFESSIONAL",
  "ADMINISTRATIVE_PROFESSIONAL",
]);

export const inviteMemberSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((value) => value.toLowerCase())
      .refine((value) => value.endsWith("@institutodesignio.org"), {
        message: "Institutional email required",
      }),
    full_name: z.string().trim().min(3).max(200),
    role_id: z.string().uuid(),
    member_type: memberTypeSchema,
    job_title: z.string().trim().min(2).max(120),
    professional_council: z.string().trim().min(2).max(40).nullable().optional(),
    professional_registration: z.string().trim().min(2).max(40).nullable().optional(),
  })
  .strict()
  .superRefine((data, context) => {
    if (data.member_type !== "TECHNICAL_PROFESSIONAL") return;
    if (!data.professional_council) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["professional_council"],
        message: "Professional council is required for technical professionals",
      });
    }
    if (!data.professional_registration) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["professional_registration"],
        message: "Professional registration is required for technical professionals",
      });
    }
  });
