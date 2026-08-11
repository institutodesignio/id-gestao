import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
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

const postalCodeSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => value.length === 8, {
    message: "Postal code must contain exactly 8 digits",
  })
  .nullable()
  .optional();

const stateCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z]{2}$/,
    "State code must contain exactly 2 letters"
  )
  .nullable()
  .optional();

const countryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z]{2}$/,
    "Country code must contain exactly 2 letters"
  )
  .optional();

const unitStatusSchema = z.enum([
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "ARCHIVED",
]);

const slugSchema = z
  .string()
  .trim()
  .min(1, "Slug is required")
  .max(120)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must use lowercase letters, numbers and hyphens only"
  );

export const createUnitSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .max(200),

    slug: slugSchema,

    description: optionalText(1000),

    email: optionalEmail,

    phone: optionalPhone,

    postal_code: postalCodeSchema,

    street: optionalText(200),

    street_number: optionalText(40),

    address_complement: optionalText(120),

    neighborhood: optionalText(120),

    city: optionalText(120),

    state_code: stateCodeSchema,

    country_code: countryCodeSchema,

    is_headquarters: z
      .boolean()
      .optional(),

    status: unitStatusSchema.optional(),
  })
  .strict();

export const updateUnitSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name cannot be blank")
      .max(200)
      .optional(),

    slug: slugSchema.optional(),

    description: optionalText(1000),

    email: optionalEmail,

    phone: optionalPhone,

    postal_code: postalCodeSchema,

    street: optionalText(200),

    street_number: optionalText(40),

    address_complement: optionalText(120),

    neighborhood: optionalText(120),

    city: optionalText(120),

    state_code: stateCodeSchema,

    country_code: countryCodeSchema,

    is_headquarters: z
      .boolean()
      .optional(),

    status: unitStatusSchema.optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "At least one field must be provided",
    }
  );

export type CreateUnitInput =
  z.infer<typeof createUnitSchema>;

export type UpdateUnitInput =
  z.infer<typeof updateUnitSchema>;