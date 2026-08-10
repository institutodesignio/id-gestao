import { describe, expect, it } from "vitest";

import {
  createPersonAddressSchema,
  updatePersonAddressSchema,
} from "../../src/schemas/person-addresses.js";

describe("createPersonAddressSchema", () => {
  it("accepts a valid address", () => {
    const result =
      createPersonAddressSchema.safeParse({
        address_type: "RESIDENTIAL",
        postal_code: "01310-100",
        street: "Avenida Paulista",
        street_number: "1500",
        address_complement: "Sala 20",
        neighborhood: "Bela Vista",
        city: "Sao Paulo",
        state_code: "sp",
        country_code: "br",
        is_primary: true,
      });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.postal_code).toBe(
        "01310100"
      );
      expect(result.data.state_code).toBe("SP");
      expect(result.data.country_code).toBe("BR");
    }
  });

  it("rejects invalid postal code", () => {
    const result =
      createPersonAddressSchema.safeParse({
        postal_code: "123",
      });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(
        result.error.flatten().fieldErrors.postal_code
      ).toContain(
        "Postal code must contain exactly 8 digits"
      );
    }
  });

  it("rejects invalid state code", () => {
    const result =
      createPersonAddressSchema.safeParse({
        state_code: "S",
      });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(
        result.error.flatten().fieldErrors.state_code
      ).toContain(
        "State code must contain exactly 2 letters"
      );
    }
  });

  it("rejects invalid country code", () => {
    const result =
      createPersonAddressSchema.safeParse({
        country_code: "BRA",
      });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(
        result.error.flatten().fieldErrors.country_code
      ).toContain(
        "Country code must contain exactly 2 letters"
      );
    }
  });

  it("rejects unknown fields", () => {
    const result =
      createPersonAddressSchema.safeParse({
        organization_id:
          "bb8a3250-c661-434c-86a8-f0009a8c06e1",
      });

    expect(result.success).toBe(false);
  });
});

describe("updatePersonAddressSchema", () => {
  it("accepts a valid partial update", () => {
    const result =
      updatePersonAddressSchema.safeParse({
        street_number: "2000",
        is_primary: true,
      });

    expect(result.success).toBe(true);
  });

  it("rejects an empty update", () => {
    const result =
      updatePersonAddressSchema.safeParse({});

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(
        result.error.flatten().formErrors
      ).toContain(
        "At least one field must be provided"
      );
    }
  });

  it("rejects invalid postal code on update", () => {
    const result =
      updatePersonAddressSchema.safeParse({
        postal_code: "999",
      });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields on update", () => {
    const result =
      updatePersonAddressSchema.safeParse({
        person_id:
          "3b15bcfa-3d66-4a9a-93e2-04b53cd61836",
      });

    expect(result.success).toBe(false);
  });
});