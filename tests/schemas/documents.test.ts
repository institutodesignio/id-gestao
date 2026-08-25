import { describe, expect, it } from "vitest";
import { createDocumentSchema, createDocumentVersionSchema, requestDocumentUploadSchema, updateDocumentSchema } from "../../src/schemas/documents.js";

describe("Document schemas", () => {
  it("accepts a confidential institutional document", () => {
    expect(createDocumentSchema.safeParse({ category: "CONTRATO", classification: "CONFIDENTIAL", title: "Contrato de prestação" }).success).toBe(true);
  });

  it("rejects an unsupported upload type", () => {
    expect(requestDocumentUploadSchema.safeParse({ version_number: 1, filename: "arquivo.exe", mime_type: "application/octet-stream" }).success).toBe(false);
  });

  it("accepts a valid SHA-256 checksum", () => {
    expect(createDocumentVersionSchema.safeParse({ checksum_sha256: "a".repeat(64) }).success).toBe(true);
  });

  it("rejects files above 25 MB", () => {
    expect(createDocumentVersionSchema.safeParse({ file_size_bytes: 25 * 1024 * 1024 + 1 }).success).toBe(false);
  });

  it("requires a reason when voiding a document", () => {
    expect(updateDocumentSchema.safeParse({ status: "VOID" }).success).toBe(false);
    expect(updateDocumentSchema.safeParse({ status: "VOID", void_reason: "Substituído por nova versão" }).success).toBe(true);
  });
});
