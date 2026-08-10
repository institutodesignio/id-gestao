import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
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
  .regex(/^[A-Z]{2}$/, "State code must contain exactly 2 letters")
  .nullable()
  .optional();

const countryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "Country code must contain exactly 2 letters")
  .optional();

export const createPersonAddressSchema = z
  .object({
    address_type: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .optional(),

    postal_code: postalCodeSchema,

    street: optionalText(200),

    street_number: optionalText(40),

    address_complement: optionalText(120),

    neighborhood: optionalText(120),

    city: optionalText(120),

    state_code: stateCodeSchema,

    country_code: countryCodeSchema,

    is_primary: z
      .boolean()
      .optional(),
  })
  .strict();

export const updatePersonAddressSchema = z
  .object({
    address_type: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .optional(),

    postal_code: postalCodeSchema,

    street: optionalText(200),

    street_number: optionalText(40),

    address_complement: optionalText(120),

    neighborhood: optionalText(120),

    city: optionalText(120),

    state_code: stateCodeSchema,

    country_code: countryCodeSchema,

    is_primary: z
      .boolean()
      .optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "At least one field must be provided",
    }
  );