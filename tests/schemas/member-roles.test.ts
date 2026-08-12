import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createMemberRoleSchema,
  endMemberRoleSchema,
} from "../../src/schemas/member-roles.js";

const roleId =
  "11111111-1111-4111-8111-111111111111";

describe(
  "createMemberRoleSchema",
  () => {
    it(
      "accepts role id only",
      () => {
        const result =
          createMemberRoleSchema.safeParse({
            role_id: roleId,
          });

        expect(
          result.success
        ).toBe(true);
      }
    );

    it(
      "accepts a temporal assignment",
      () => {
        const result =
          createMemberRoleSchema.safeParse({
            role_id: roleId,
            starts_at:
              "2026-08-12",
            ends_at:
              "2026-12-31",
          });

        expect(
          result.success
        ).toBe(true);
      }
    );

    it(
      "accepts an open assignment",
      () => {
        const result =
          createMemberRoleSchema.safeParse({
            role_id: roleId,
            ends_at: null,
          });

        expect(
          result.success
        ).toBe(true);
      }
    );

    it(
      "rejects invalid role id",
      () => {
        const result =
          createMemberRoleSchema.safeParse({
            role_id:
              "not-a-uuid",
          });

        expect(
          result.success
        ).toBe(false);
      }
    );

    it(
      "rejects an impossible date",
      () => {
        const result =
          createMemberRoleSchema.safeParse({
            role_id: roleId,
            starts_at:
              "2026-02-30",
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
          createMemberRoleSchema.safeParse({
            role_id: roleId,
            starts_at:
              "2026-08-12",
            ends_at:
              "2026-08-11",
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
          createMemberRoleSchema.safeParse({
            role_id: roleId,
            created_by: roleId,
          });

        expect(
          result.success
        ).toBe(false);
      }
    );
  }
);

describe(
  "endMemberRoleSchema",
  () => {
    it(
      "accepts a valid end date",
      () => {
        const result =
          endMemberRoleSchema.safeParse({
            ends_at:
              "2026-12-31",
          });

        expect(
          result.success
        ).toBe(true);
      }
    );

    it(
      "rejects an invalid end date",
      () => {
        const result =
          endMemberRoleSchema.safeParse({
            ends_at:
              "31/12/2026",
          });

        expect(
          result.success
        ).toBe(false);
      }
    );

    it(
      "rejects an impossible end date",
      () => {
        const result =
          endMemberRoleSchema.safeParse({
            ends_at:
              "2026-02-30",
          });

        expect(
          result.success
        ).toBe(false);
      }
    );

    it(
      "rejects an empty body",
      () => {
        const result =
          endMemberRoleSchema.safeParse({});

        expect(
          result.success
        ).toBe(false);
      }
    );
  }
);