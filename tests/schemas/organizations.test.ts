import { describe, expect, it } from "vitest";
import { updateOrganizationSchema } from "../../src/schemas/organizations.js";

describe("organization schema", () => {
  it("normalizes CNPJ and accepts an institutional update", () => {
    const result = updateOrganizationSchema.parse({ legal_name: " Instituto Designio ", cnpj: "12.345.678/0001-90" });
    expect(result).toEqual({ legal_name: "Instituto Designio", cnpj: "12345678000190" });
  });

  it("rejects empty and unknown updates", () => {
    expect(updateOrganizationSchema.safeParse({}).success).toBe(false);
    expect(updateOrganizationSchema.safeParse({ slug: "cannot-change" }).success).toBe(false);
  });
});
