import { z } from "zod";

// ============================================================
// HELPERS
// ============================================================

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

const optionalEmail = z
  .string()
  .trim()
  .email("Invalid email address")
  .max(254)
  .nullable()
  .optional();

const optionalPhone = z
  .string()
  .trim()
  .max(30)
  .nullable()
  .optional();

const optionalCpf = z
  .string()
  .transform((value) =>
    value.replace(/\D/g, "")
  )
  .refine(
    (value) =>
      value.length === 11,
    {
      message:
        "CPF must contain exactly 11 digits",
    }
  )
  .nullable()
  .optional();

const optionalCnpj = z
  .string()
  .transform((value) =>
    value.replace(/\D/g, "")
  )
  .refine(
    (value) =>
      value.length === 14,
    {
      message:
        "CNPJ must contain exactly 14 digits",
    }
  )
  .nullable()
  .optional();

// ============================================================
// ENUMS
// ============================================================

const personTypeSchema =
  z.enum([
    "INDIVIDUAL",
    "ORGANIZATION",
  ]);

const personStatusSchema =
  z.enum([
    "ACTIVE",
    "INACTIVE",
    "ARCHIVED",
  ]);

// ============================================================
// CREATE PERSON
// ============================================================

export const createPersonSchema =
  z
    .object({
      person_type:
        personTypeSchema,

      full_name: z
        .string()
        .trim()
        .min(
          1,
          "Full name is required"
        )
        .max(200),

      preferred_name:
        optionalText(200),

      birth_date:
        optionalDate,

      gender:
        optionalText(60),

      marital_status:
        optionalText(60),

      nationality:
        optionalText(100),

      occupation:
        optionalText(150),

      cpf:
        optionalCpf,

      cnpj:
        optionalCnpj,

      rg:
        optionalText(40),

      rg_issuer:
        optionalText(40),

      nis:
        optionalText(40),

      primary_email:
        optionalEmail,

      primary_phone:
        optionalPhone,

      status:
        personStatusSchema.optional(),
    })
    .strict()
    .superRefine(
      (data, ctx) => {
        if (
          data.person_type ===
            "INDIVIDUAL" &&
          data.cnpj
        ) {
          ctx.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: ["cnpj"],

            message:
              "INDIVIDUAL person cannot have CNPJ",
          });
        }

        if (
          data.person_type ===
            "ORGANIZATION" &&
          data.cpf
        ) {
          ctx.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: ["cpf"],

            message:
              "ORGANIZATION person cannot have CPF",
          });
        }
      }
    );

// ============================================================
// UPDATE PERSON
// ============================================================

export const updatePersonSchema =
  z
    .object({
      person_type:
        personTypeSchema.optional(),

      full_name: z
        .string()
        .trim()
        .min(
          1,
          "Full name cannot be blank"
        )
        .max(200)
        .optional(),

      preferred_name:
        optionalText(200),

      birth_date:
        optionalDate,

      gender:
        optionalText(60),

      marital_status:
        optionalText(60),

      nationality:
        optionalText(100),

      occupation:
        optionalText(150),

      cpf:
        optionalCpf,

      cnpj:
        optionalCnpj,

      rg:
        optionalText(40),

      rg_issuer:
        optionalText(40),

      nis:
        optionalText(40),

      primary_email:
        optionalEmail,

      primary_phone:
        optionalPhone,

      status:
        personStatusSchema.optional(),
    })
    .strict()
    .refine(
      (data) =>
        Object.keys(data).length > 0,
      {
        message:
          "At least one field must be provided",
      }
    );

// ============================================================
// TYPES
// ============================================================

export type CreatePersonInput =
  z.infer<
    typeof createPersonSchema
  >;

export type UpdatePersonInput =
  z.infer<
    typeof updatePersonSchema
  >;