import { describe, expect, it } from "vitest";
import { createClinicalCaseSchema, createClinicalSessionSchema, updateClinicalCaseSchema } from "../../src/schemas/clinical-supervision.js";
describe("clinical supervision schemas", () => {
  it("accepts a valid case", () => expect(createClinicalCaseSchema.safeParse({ project_id: "11111111-1111-4111-8111-111111111111", beneficiary_person_id: "22222222-2222-4222-8222-222222222222", summary: "Acompanhamento técnico" }).success).toBe(true));
  it("rejects an empty case update", () => expect(updateClinicalCaseSchema.safeParse({}).success).toBe(false));
  it("requires an offset on session timestamps", () => expect(createClinicalSessionSchema.safeParse({ supervisor_person_id: "22222222-2222-4222-8222-222222222222", scheduled_at: "2026-08-15T10:00:00" }).success).toBe(false));
});
