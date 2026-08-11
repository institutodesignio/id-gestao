import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createUnitSchema,
  updateUnitSchema,
} from "../../src/schemas/units.js";

describe("createUnitSchema", () => {
  it("accepts a valid unit", () => {
    const result =
      createUnitSchema.safeParse({
        name: "Unidade Centro",
        slug: "unidade-centro",
      });

    expect(result.success).toBe(true);
  });

  it("accepts complete valid data", () => {
    const result =
      createUnitSchema.safeParse({
        name: "Unidade Paulista",
        slug: "unidade-paulista",
        description:
          "Unidade de atendimento",
        email:
          "paulista@institutodesignio.org",
        phone: "11999999999",
        postal_code: "01310-100",
        street: "Avenida Paulista",
        street_number: "1000",
        address_complement: "Sala 10",
        neighborhood: "Bela Vista",
        city: "Sao Paulo",
        state_code: "sp",
        country_code: "br",
        is_headquarters: true,
        status: "ACTIVE",
      });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(
        result.data.postal_code
      ).toBe("01310100");

      expect(
        result.data.state_code
      ).toBe("SP");

      expect(
        result.data.country_code
      ).toBe("BR");
    }
  });

  it("rejects blank name", () => {
    const result =
      createUnitSchema.safeParse({
        name: "   ",
        slug: "unidade-centro",
      });

    expect(result.success).toBe(false);
  });

  it("rejects invalid slug", () => {
    const result =
      createUnitSchema.safeParse({
        name: "Unidade Centro",
        slug: "Unidade Centro",
      });

    expect(result.success).toBe(false);
  });

  it("rejects invalid postal code", () => {
    const result =
      createUnitSchema.safeParse({
        name: "Unidade Centro",
        slug: "unidade-centro",
        postal_code: "123",
      });

    expect(result.success).toBe(false);
  });

  it("rejects invalid state code", () => {
    const result =
      createUnitSchema.safeParse({
        name: "Unidade Centro",
        slug: "unidade-centro",
        state_code: "SAO",
      });

    expect(result.success).toBe(false);
  });

  it("rejects invalid country code", () => {
    const result =
      createUnitSchema.safeParse({
        name: "Unidade Centro",
        slug: "unidade-centro",
        country_code: "BRA",
      });

    expect(result.success).toBe(false);
  });

  it("rejects invalid status", () => {
    const result =
      createUnitSchema.safeParse({
        name: "Unidade Centro",
        slug: "unidade-centro",
        status: "DELETED",
      });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result =
      createUnitSchema.safeParse({
        name: "Unidade Centro",
        slug: "unidade-centro",
        organization_id:
          "bb8a3250-c661-434c-86a8-f0009a8c06e1",
      });

    expect(result.success).toBe(false);
  });
});

describe("updateUnitSchema", () => {
  it("accepts partial update", () => {
    const result =
      updateUnitSchema.safeParse({
        name:
          "Unidade Centro Atualizada",
      });

    expect(result.success).toBe(true);
  });

  it("accepts headquarters update", () => {
    const result =
      updateUnitSchema.safeParse({
        is_headquarters: true,
      });

    expect(result.success).toBe(true);
  });

  it("rejects empty update", () => {
    const result =
      updateUnitSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result =
      updateUnitSchema.safeParse({
        organization_id:
          "bb8a3250-c661-434c-86a8-f0009a8c06e1",
      });

    expect(result.success).toBe(false);
  });
});