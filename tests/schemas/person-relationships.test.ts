import { describe, expect, it } from "vitest";

import {
  createPersonRelationshipSchema,
  updatePersonRelationshipSchema,
} from "../../src/schemas/person-relationships.js";

const relatedPersonId =
  "ea7e997b-a389-4a6c-8198-a9ff791ac720";

describe("createPersonRelationshipSchema", () => {
  it("accepts a valid relationship", () => {
    const result =
      createPersonRelationshipSchema.safeParse({
        related_person_id: relatedPersonId,
        relationship_type:
          "RESPONSAVEL_FINANCEIRO",
        is_legal_guardian: false,
        is_financial_responsible: true,
        starts_at: "2026-08-10",
        ends_at: null,
        notes: "Relacionamento de teste",
      });

    expect(result.success).toBe(true);
  });

  it("rejects invalid related_person_id", () => {
    const result =
      createPersonRelationshipSchema.safeParse({
        related_person_id: "invalid",
        relationship_type: "RESPONSAVEL",
      });

    expect(result.success).toBe(false);
  });

  it("rejects blank relationship_type", () => {
    const result =
      createPersonRelationshipSchema.safeParse({
        related_person_id: relatedPersonId,
        relationship_type: "   ",
      });

    expect(result.success).toBe(false);
  });

  it("rejects invalid starts_at format", () => {
    const result =
      createPersonRelationshipSchema.safeParse({
        related_person_id: relatedPersonId,
        relationship_type: "RESPONSAVEL",
        starts_at: "10/08/2026",
      });

    expect(result.success).toBe(false);
  });

  it("rejects ends_at before starts_at", () => {
    const result =
      createPersonRelationshipSchema.safeParse({
        related_person_id: relatedPersonId,
        relationship_type: "RESPONSAVEL",
        starts_at: "2026-08-10",
        ends_at: "2026-08-09",
      });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(
        result.error.flatten().fieldErrors.ends_at
      ).toContain(
        "ends_at cannot be before starts_at"
      );
    }
  });

  it("rejects unknown fields", () => {
    const result =
      createPersonRelationshipSchema.safeParse({
        related_person_id: relatedPersonId,
        relationship_type: "RESPONSAVEL",
        organization_id:
          "bb8a3250-c661-434c-86a8-f0009a8c06e1",
      });

    expect(result.success).toBe(false);
  });
});

describe("updatePersonRelationshipSchema", () => {
  it("accepts a valid partial update", () => {
    const result =
      updatePersonRelationshipSchema.safeParse({
        relationship_type:
          "RESPONSAVEL_FINANCEIRO",
        is_financial_responsible: true,
      });

    expect(result.success).toBe(true);
  });

  it("rejects an empty update", () => {
    const result =
      updatePersonRelationshipSchema.safeParse({});

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(
        result.error.flatten().formErrors
      ).toContain(
        "At least one field must be provided"
      );
    }
  });

  it("rejects invalid related_person_id on update", () => {
    const result =
      updatePersonRelationshipSchema.safeParse({
        related_person_id: "invalid",
      });

    expect(result.success).toBe(false);
  });

  it("rejects blank relationship_type on update", () => {
    const result =
      updatePersonRelationshipSchema.safeParse({
        relationship_type: "   ",
      });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields on update", () => {
    const result =
      updatePersonRelationshipSchema.safeParse({
        person_id:
          "3b15bcfa-3d66-4a9a-93e2-04b53cd61836",
      });

    expect(result.success).toBe(false);
  });
});