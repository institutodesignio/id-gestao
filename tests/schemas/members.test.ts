import {
  describe,
  expect,
  it,
} from "vitest";

import {
  membersQuerySchema,
} from "../../src/schemas/members.js";

describe(
  "membersQuerySchema",
  () => {
    it(
      "applies pagination defaults",
      () => {
        const result =
          membersQuerySchema.safeParse({});

        expect(
          result.success
        ).toBe(true);

        if (result.success) {
          expect(
            result.data
          ).toEqual({
            page: 1,
            limit: 20,
          });
        }
      }
    );

    it(
      "coerces pagination values",
      () => {
        const result =
          membersQuerySchema.safeParse({
            page: "2",
            limit: "50",
          });

        expect(
          result.success
        ).toBe(true);

        if (result.success) {
          expect(
            result.data.page
          ).toBe(2);

          expect(
            result.data.limit
          ).toBe(50);
        }
      }
    );

    it(
      "accepts search and status",
      () => {
        const result =
          membersQuerySchema.safeParse({
            search:
              "  Maria  ",
            status:
              "ACTIVE",
          });

        expect(
          result.success
        ).toBe(true);

        if (result.success) {
          expect(
            result.data.search
          ).toBe("Maria");
        }
      }
    );

    it(
      "rejects page below one",
      () => {
        const result =
          membersQuerySchema.safeParse({
            page: 0,
          });

        expect(
          result.success
        ).toBe(false);
      }
    );

    it(
      "rejects limit above one hundred",
      () => {
        const result =
          membersQuerySchema.safeParse({
            limit: 101,
          });

        expect(
          result.success
        ).toBe(false);
      }
    );

    it(
      "rejects unsupported status",
      () => {
        const result =
          membersQuerySchema.safeParse({
            status:
              "DELETED",
          });

        expect(
          result.success
        ).toBe(false);
      }
    );

    it(
      "rejects blank search",
      () => {
        const result =
          membersQuerySchema.safeParse({
            search: "   ",
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
          membersQuerySchema.safeParse({
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