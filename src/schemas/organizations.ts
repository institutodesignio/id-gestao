import { z } from "zod";

const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();
const cnpj = z.string().transform((value) => value.replace(/\D/g, "")).refine((value) => value.length === 14, "CNPJ must contain exactly 14 digits").nullable().optional();

export const updateOrganizationSchema = z.object({
  legal_name: z.string().trim().min(1).max(200).optional(),
  trade_name: nullableText(200),
  cnpj,
  email: z.string().trim().email().max(254).nullable().optional(),
  phone: nullableText(30),
  website: z.string().trim().url().max(500).nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "ARCHIVED"]).optional(),
}).strict().refine((data) => Object.keys(data).length > 0, "At least one field must be provided");

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
