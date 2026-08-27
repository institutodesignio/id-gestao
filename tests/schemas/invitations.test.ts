import { describe, expect, it } from "vitest";
import { inviteMemberSchema } from "../../src/schemas/invitations.js";

const base = {
  email: "  Pessoa@institutodesignio.org ",
  full_name: "  Maria da Silva  ",
  role_id: "44444444-4444-4444-8444-444444444444",
  member_type: "TECHNICAL_PROFESSIONAL",
  job_title: "Psicóloga",
  professional_council: "CRP 06",
  professional_registration: "204055",
};

describe("member invitation schema", () => {
  it("normalizes a valid institutional invitation", () => {
    const result = inviteMemberSchema.parse(base);
    expect(result).toEqual({
      ...base,
      email: "pessoa@institutodesignio.org",
      full_name: "Maria da Silva",
    });
  });

  it("rejects non-institutional email", () => {
    expect(inviteMemberSchema.safeParse({ ...base, email: "pessoa@gmail.com" }).success).toBe(
      false,
    );
  });

  it("requires council registration for technical professionals", () => {
    expect(
      inviteMemberSchema.safeParse({ ...base, professional_registration: null }).success,
    ).toBe(false);
  });

  it("allows an administrative professional without council registration", () => {
    expect(
      inviteMemberSchema.safeParse({
        ...base,
        member_type: "ADMINISTRATIVE_PROFESSIONAL",
        professional_council: null,
        professional_registration: null,
      }).success,
    ).toBe(true);
  });
});
