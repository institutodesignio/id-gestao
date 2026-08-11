import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createProjectUnitSchema,
  updateProjectUnitSchema,
} from "../../src/schemas/project-units.js";

const unitId =
  "11111111-1111-4111-8111-111111111111";

describe(
  "createProjectUnitSchema",
  () => {
    it(
      "accepts a valid project unit",
      () => {
        const result =
          createProjectUnitSchema.safeParse({
            unit_id:
              unitId,
          });

        expect(
          result.success
        ).toBe(true);
      }
    );

    it(
      "accepts complete valid data",
      () => {
        const result =
          createProjectUnitSchema.safeParse({
            unit_id:
              unitId,
            starts_at:
              "2026-08-11",
            ends_at:
              "2026-12-31",
            is_primary:
              true,
          });

        expect(
          result.success
        ).toBe(true);
      }
    );

    it(
      "rejects invalid unit id",
      () => {
        const result =
          createProjectUnitSchema.safeParse({
            unit_id:
              "not-a-uuid",
          });

        expect(
          result.success
        ).toBe(false);
      }
    );

    it(
      "rejects invalid date format",
      () => {
        const result =
          createProjectUnitSchema.safeParse({
            unit_id:
              unitId,
            starts_at:
              "11/08/2026",
          });

        expect(
          result.success
        ).toBe(false);
      }
    );

    it(
      "rejects ends_at before starts_at",
      () => {
        const result =
          createProjectUnitSchema.safeParse({
            unit_id:
              unitId,
            starts_at:
              "2026-08-11",
            ends_at:
              "2026-08-10",
          });

        expect(
          result.success
        ).toBe(false);
      }
    );

    it(
      "rejects unknown fields",
      () => {
        const result =
          createProjectUnitSchema.safeParse({
            unit_id:
              unitId,
            project_id:
              "22222222-2222-4222-8222-222222222222",
          });

        expect(
          result.success
        ).toBe(false);
      }
    );
  }
);

describe(
  "updateProjectUnitSchema",
  () => {
    it(
      "accepts partial update",
      () => {
        const result =
          updateProjectUnitSchema.safeParse({
            is_primary:
              true,
          });

        expect(
          result.success
        ).toBe(true);
      }
    );

    it(
      "accepts date update",
      () => {
        const result =
          updateProjectUnitSchema.safeParse({
            starts_at:
              "2026-08-11",
            ends_at:
              "2026-12-31",
          });

        expect(
          result.success
        ).toBe(true);
      }
    );

    it(
      "rejects empty update",
      () => {
        const result =
          updateProjectUnitSchema.safeParse({});

        expect(
          result.success
        ).toBe(false);
      }
    );

    it(
      "rejects inverted dates",
      () => {
        const result =
          updateProjectUnitSchema.safeParse({
            starts_at:
              "2026-08-11",
            ends_at:
              "2026-08-10",
          });

        expect(
          result.success
        ).toBe(false);
      }
    );

    it(
      "rejects structural ids",
      () => {
        const result =
          updateProjectUnitSchema.safeParse({
            unit_id:
              unitId,
          });

        expect(
          result.success
        ).toBe(false);
      }
    );
  }
);