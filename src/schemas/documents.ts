import { z } from "zod";

const uuid = z.string().uuid();

export const createDocumentTemplateSchema = z.object({
  code: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(80),
  version: z.number().int().positive().optional(),
  body_template: z.string().min(1).max(100_000),
  field_schema: z.record(z.string(), z.unknown()).optional(),
  requires_approval: z.boolean().optional(),
  requires_signature: z.boolean().optional(),
}).strict();

export const updateDocumentTemplateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  body_template: z.string().min(1).max(100_000).optional(),
  field_schema: z.record(z.string(), z.unknown()).optional(),
  requires_approval: z.boolean().optional(),
  requires_signature: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field must be provided");

export const createDocumentSchema = z.object({
  template_id: uuid.nullable().optional(),
  person_id: uuid.nullable().optional(),
  project_id: uuid.nullable().optional(),
  unit_id: uuid.nullable().optional(),
  appointment_id: uuid.nullable().optional(),
  clinical_case_id: uuid.nullable().optional(),
  category: z.string().trim().min(1).max(80),
  classification: z.enum(["INTERNAL", "CONFIDENTIAL", "CLINICAL", "FINANCIAL"]).optional(),
  title: z.string().trim().min(1).max(250),
  description: z.string().trim().max(2000).nullable().optional(),
}).strict();

export const updateDocumentSchema = z.object({
  title: z.string().trim().min(1).max(250).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(["DRAFT", "READY_FOR_APPROVAL", "APPROVED", "SIGNED", "ARCHIVED", "VOID"]).optional(),
  void_reason: z.string().trim().max(2000).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field must be provided");

export const createDocumentVersionSchema = z.object({
  content: z.record(z.string(), z.unknown()).optional(),
  original_filename: z.string().trim().min(1).max(255).nullable().optional(),
  mime_type: z.string().trim().min(1).max(150).nullable().optional(),
  file_size_bytes: z.number().int().nonnegative().max(25 * 1024 * 1024).nullable().optional(),
  checksum_sha256: z.string().regex(/^[a-fA-F0-9]{64}$/).nullable().optional(),
  change_summary: z.string().trim().max(2000).nullable().optional(),
}).strict();

export const requestDocumentUploadSchema = z.object({
  version_number: z.number().int().positive(),
  filename: z.string().trim().min(1).max(255),
  mime_type: z.enum([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]),
}).strict();

export const createDocumentSignatureSchema = z.object({
  document_version_id: uuid,
  signer_person_id: uuid.nullable().optional(),
  signature_type: z.enum(["INTERNAL", "GOV_BR", "CERTIFICATE", "UPLOAD"]),
  provider: z.string().trim().max(120).nullable().optional(),
  external_reference: z.string().trim().max(255).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

export const updateDocumentSignatureSchema = z.object({
  status: z.enum(["SIGNED", "DECLINED", "REVOKED"]),
  external_reference: z.string().trim().max(255).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();
