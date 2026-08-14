import { describe, expect, it } from "vitest";
import { createProjectTeamMemberSchema, updateProjectTeamMemberSchema } from "../../src/schemas/project-team.js";
describe("project team schemas", () => {
  it("accepts a valid member", () => expect(createProjectTeamMemberSchema.safeParse({ person_id: "11111111-1111-4111-8111-111111111111", role_title: "Psicóloga", starts_at: "2026-08-01" }).success).toBe(true));
  it("rejects inverted dates", () => expect(createProjectTeamMemberSchema.safeParse({ person_id: "11111111-1111-4111-8111-111111111111", role_title: "Técnica", starts_at: "2026-08-10", ends_at: "2026-08-01" }).success).toBe(false));
  it("rejects an empty update", () => expect(updateProjectTeamMemberSchema.safeParse({}).success).toBe(false));
});
