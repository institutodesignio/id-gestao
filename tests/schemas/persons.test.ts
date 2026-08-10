import { describe, expect, it } from "vitest";

import {
  createPersonSchema,
  updatePersonSchema,
} from "../../src/schemas/persons.js";

describe("createPersonSchema", () => {
  it("accepts a valid INDIVIDUAL person", () => {
    const result = createPersonSchema.safeParse({
      person_type: "INDIVIDUAL",
      full_name: "Euclides Dias",
      preferred_name: "Euclides",
      cpf: "123.456.789-01",
      primary_email: "euclides@example.com",
      status: "ACTIVE",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.cpf).toBe("12345678901");
      expect(result.data.person_type).toBe("INDIVIDUAL");
    }
  });

  it("accepts a valid ORGANIZATION person", () => {
    const result = createPersonSchema.safeParse({
      person_type: "ORGANIZATION",
      full_name: "Empresa Teste Ltda",
      cnpj: "12.345.678/0001-90",
      primary_email: "empresa@example.com",
      status: "ACTIVE",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.cnpj).toBe("12345678000190");
      expect(result.data.person_type).toBe("ORGANIZATION");
    }
  });

  it("rejects INDIVIDUAL with CNPJ", () => {
    const result = createPersonSchema.safeParse({
      person_type: "INDIVIDUAL",
      full_name: "Pessoa Teste",
      cnpj: "12.345.678/0001-90",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(
        result.error.flatten().fieldErrors.cnpj
      ).toContain(
        "INDIVIDUAL person cannot have CNPJ"
      );
    }
  });

  it("rejects ORGANIZATION with CPF", () => {
    const result = createPersonSchema.safeParse({
      person_type: "ORGANIZATION",
      full_name: "Organizacao Teste",
      cpf: "123.456.789-01",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(
        result.error.flatten().fieldErrors.cpf
      ).toContain(
        "ORGANIZATION person cannot have CPF"
      );
    }
  });

  it("rejects CPF with wrong number of digits", () => {
    const result = createPersonSchema.safeParse({
      person_type: "INDIVIDUAL",
      full_name: "Pessoa Teste",
      cpf: "123",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(
        result.error.flatten().fieldErrors.cpf
      ).toContain(
        "CPF must contain exactly 11 digits"
      );
    }
  });

  it("rejects CNPJ with wrong number of digits", () => {
    const result = createPersonSchema.safeParse({
      person_type: "ORGANIZATION",
      full_name: "Empresa Teste",
      cnpj: "123",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(
        result.error.flatten().fieldErrors.cnpj
      ).toContain(
        "CNPJ must contain exactly 14 digits"
      );
    }
  });

  it("rejects blank full_name", () => {
    const result = createPersonSchema.safeParse({
      person_type: "INDIVIDUAL",
      full_name: "   ",
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid person_type", () => {
    const result = createPersonSchema.safeParse({
      person_type: "OTHER",
      full_name: "Pessoa Teste",
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid status", () => {
    const result = createPersonSchema.safeParse({
      person_type: "INDIVIDUAL",
      full_name: "Pessoa Teste",
      status: "DELETED",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result = createPersonSchema.safeParse({
      person_type: "INDIVIDUAL",
      full_name: "Pessoa Teste",
      organization_id:
        "bb8a3250-c661-434c-86a8-f0009a8c06e1",
    });

    expect(result.success).toBe(false);
  });
});

describe("updatePersonSchema", () => {
  it("accepts a valid partial update", () => {
    const result = updatePersonSchema.safeParse({
      preferred_name: "Novo Nome",
      occupation: "Psicologo",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty update", () => {
    const result = updatePersonSchema.safeParse({});

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(
        result.error.flatten().formErrors
      ).toContain(
        "At least one field must be provided"
      );
    }
  });

  it("rejects blank full_name on update", () => {
    const result = updatePersonSchema.safeParse({
      full_name: "   ",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields on update", () => {
    const result = updatePersonSchema.safeParse({
      organization_id:
        "bb8a3250-c661-434c-86a8-f0009a8c06e1",
    });

    expect(result.success).toBe(false);
  });
});