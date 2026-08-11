import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createProjectSchema,
  updateProjectSchema,
} from "../../src/schemas/projects.js";

describe(
  "createProjectSchema",
  () => {
    it(
      "accepts a valid project",
      () => {
        const result =
          createProjectSchema.safeParse({
            name:
              "Projeto Clinico",
            slug:
              "projeto-clinico",
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
          createProjectSchema.safeParse({
            name:
              "Projeto Clinico",
            slug:
              "projeto-clinico",
            short_name:
              "Clinico",
            description:
              "Projeto com atendimento clinico",
            status:
              "ACTIVE",
            starts_at:
              "2026-08-01",
            ends_at:
              "2026-12-31",
            has_clinical_care:
              true,
          });

        expect(
          result.success
        ).toBe(true);
      }
    );

    it(
      "rejects blank name",
      () => {
        const result =
          createProjectSchema.safeParse({
            name: "   ",
            slug:
              "projeto-clinico",
          });

        expect(
          result.success
        ).toBe(false);
      }
    );

    it(
      "rejects invalid slug",
      () => {
        const result =
          createProjectSchema.safeParse({
            name:
              "Projeto Clinico",
            slug:
              "Projeto Clinico",
          });

        expect(
          result.success
        ).toBe(false);
      }
    );

    it(
      "rejects invalid status",
      () => {
        const result =
          createProjectSchema.safeParse({
            name:
              "Projeto Clinico",
            slug:
              "projeto-clinico",
            status:
              "DELETED",
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
          createProjectSchema.safeParse({
            name:
              "Projeto Clinico",
            slug:
              "projeto-clinico",
            starts_at:
              "01/08/2026",
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
          createProjectSchema.safeParse({
            name:
              "Projeto Clinico",
            slug:
              "projeto-clinico",
            starts_at:
              "2026-08-10",
            ends_at:
              "2026-08-09",
          });

        expect(
          result.success
        ).toBe(false);

        if (
          !result.success
        ) {
          expect(
            result.error
              .flatten()
              .fieldErrors
              .ends_at
          ).toContain(
            "ends_at cannot be before starts_at"
          );
        }
      }
    );

    it(
      "rejects unknown fields",
      () => {
        const result =
          createProjectSchema.safeParse({
            name:
              "Projeto Clinico",
            slug:
              "projeto-clinico",
            organization_id:
              "bb8a3250-c661-434c-86a8-f0009a8c06e1",
          });

        expect(
          result.success
        ).toBe(false);
      }
    );
  }
);

describe(
  "updateProjectSchema",
  () => {
    it(
      "accepts partial update",
      () => {
        const result =
          updateProjectSchema.safeParse({
            description:
              "Descricao atualizada",
          });

        expect(
          result.success
        ).toBe(true);
      }
    );

    it(
      "accepts status update",
      () => {
        const result =
          updateProjectSchema.safeParse({
            status:
              "SUSPENDED",
          });

        expect(
          result.success
        ).toBe(true);
      }
    );

    it(
      "accepts clinical care update",
      () => {
        const result =
          updateProjectSchema.safeParse({
            has_clinical_care:
              true,
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
          updateProjectSchema.safeParse({});

        expect(
          result.success
        ).toBe(false);
      }
    );

    it(
      "rejects inverted dates",
      () => {
        const result =
          updateProjectSchema.safeParse({
            starts_at:
              "2026-08-10",
            ends_at:
              "2026-08-09",
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
          updateProjectSchema.safeParse({
            organization_id:
              "bb8a3250-c661-434c-86a8-f0009a8c06e1",
          });

        expect(
          result.success
        ).toBe(false);
      }
    );
  }
);