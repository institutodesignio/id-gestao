import Fastify from "fastify";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("../../src/auth.js", () => ({
  requireAuthenticatedUser:
    vi.fn(),
}));

import {
  requireAuthenticatedUser,
} from "../../src/auth.js";

import {
  unitsRoutes,
} from "../../src/routes/units.js";

const organizationId =
  "bb8a3250-c661-434c-86a8-f0009a8c06e1";

const userId =
  "afbc5f88-58dd-4b5b-8163-ac96ad980bde";

const unitId =
  "11111111-1111-4111-8111-111111111111";

const requireAuthenticatedUserMock =
  vi.mocked(
    requireAuthenticatedUser
  );

function unauthenticated() {
  return {
    ok: false as const,
    statusCode: 401,
    error:
      "AUTHENTICATION_REQUIRED",
  };
}

function authenticated(
  permissions: string[] = [],
  softDeleteResult?: {
    data?: unknown;
    error?: unknown;
  }
) {
  const rpc = vi.fn(
    async (
      functionName: string
    ) => {
      if (
        functionName ===
        "current_user_context"
      ) {
        return {
          data: {
            organization: {
              id: organizationId,
            },
            permissions,
          },
          error: null,
        };
      }

      if (
        functionName ===
        "soft_delete_unit"
      ) {
        return {
          data:
            softDeleteResult?.data ??
            {
              id: unitId,
              organization_id:
                organizationId,
              name:
                "Unidade Teste",
              is_headquarters:
                false,
              deleted_at:
                "2026-08-11T02:00:00.000Z",
              deleted_by:
                userId,
            },

          error:
            softDeleteResult?.error ??
            null,
        };
      }

      return {
        data: null,
        error: null,
      };
    }
  );

  return {
    ok: true as const,
    token: "test-token",

    user: {
      id: userId,
    },

    supabase: {
      rpc,
    },
  } as any;
}

async function buildTestApp() {
  const app = Fastify({
    logger: false,
  });

  await app.register(
    unitsRoutes
  );

  return app;
}

describe(
  "units routes",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it(
      "returns 401 when listing without authentication",
      async () => {
        requireAuthenticatedUserMock
          .mockResolvedValue(
            unauthenticated()
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "GET",
            url:
              "/api/v1/units",
          });

        expect(
          response.statusCode
        ).toBe(401);

        expect(
          response.json()
        ).toEqual({
          error:
            "AUTHENTICATION_REQUIRED",
        });

        await app.close();
      }
    );

    it(
      "returns 400 for invalid pagination",
      async () => {
        requireAuthenticatedUserMock
          .mockResolvedValue(
            authenticated([
              "unit.read",
            ])
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "GET",
            url:
              "/api/v1/units?page=0",
          });

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.json().error
        ).toBe(
          "INVALID_QUERY_PARAMETERS"
        );

        await app.close();
      }
    );

    it(
      "returns 403 when listing without unit.read",
      async () => {
        requireAuthenticatedUserMock
          .mockResolvedValue(
            authenticated([])
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "GET",
            url:
              "/api/v1/units",
          });

        expect(
          response.statusCode
        ).toBe(403);

        expect(
          response.json()
        ).toEqual({
          error:
            "PERMISSION_DENIED",
        });

        await app.close();
      }
    );

    it(
      "returns 400 for invalid unit id",
      async () => {
        requireAuthenticatedUserMock
          .mockResolvedValue(
            authenticated([
              "unit.read",
            ])
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "GET",
            url:
              "/api/v1/units/not-a-uuid",
          });

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.json().error
        ).toBe(
          "INVALID_UNIT_ID"
        );

        await app.close();
      }
    );

    it(
      "returns 400 when creating invalid unit",
      async () => {
        requireAuthenticatedUserMock
          .mockResolvedValue(
            authenticated([
              "unit.create",
            ])
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "POST",
            url:
              "/api/v1/units",
            payload: {
              name:
                "Unidade sem slug",
            },
          });

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.json().error
        ).toBe(
          "INVALID_UNIT_DATA"
        );

        await app.close();
      }
    );

    it(
      "returns 400 for invalid postal code",
      async () => {
        requireAuthenticatedUserMock
          .mockResolvedValue(
            authenticated([
              "unit.create",
            ])
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "POST",
            url:
              "/api/v1/units",
            payload: {
              name:
                "Unidade Centro",
              slug:
                "unidade-centro",
              postal_code:
                "123",
            },
          });

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.json().error
        ).toBe(
          "INVALID_UNIT_DATA"
        );

        await app.close();
      }
    );

    it(
      "returns 403 when creating without unit.create",
      async () => {
        requireAuthenticatedUserMock
          .mockResolvedValue(
            authenticated([])
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "POST",
            url:
              "/api/v1/units",
            payload: {
              name:
                "Unidade Centro",
              slug:
                "unidade-centro",
            },
          });

        expect(
          response.statusCode
        ).toBe(403);

        expect(
          response.json().error
        ).toBe(
          "PERMISSION_DENIED"
        );

        await app.close();
      }
    );

    it(
      "returns 400 for empty update",
      async () => {
        requireAuthenticatedUserMock
          .mockResolvedValue(
            authenticated([
              "unit.update",
            ])
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "PATCH",
            url:
              `/api/v1/units/${unitId}`,
            payload: {},
          });

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.json().error
        ).toBe(
          "INVALID_UNIT_DATA"
        );

        await app.close();
      }
    );

    it(
      "returns 400 for invalid id on update",
      async () => {
        requireAuthenticatedUserMock
          .mockResolvedValue(
            authenticated([
              "unit.update",
            ])
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "PATCH",
            url:
              "/api/v1/units/not-a-uuid",
            payload: {
              name:
                "Unidade Atualizada",
            },
          });

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.json().error
        ).toBe(
          "INVALID_UNIT_ID"
        );

        await app.close();
      }
    );

    it(
      "returns 403 when updating without unit.update",
      async () => {
        requireAuthenticatedUserMock
          .mockResolvedValue(
            authenticated([])
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "PATCH",
            url:
              `/api/v1/units/${unitId}`,
            payload: {
              name:
                "Unidade Atualizada",
            },
          });

        expect(
          response.statusCode
        ).toBe(403);

        expect(
          response.json().error
        ).toBe(
          "PERMISSION_DENIED"
        );

        await app.close();
      }
    );

    // ========================================================
    // DELETE /api/v1/units/:id
    // ========================================================

    it(
      "returns 401 when deleting without authentication",
      async () => {
        requireAuthenticatedUserMock
          .mockResolvedValue(
            unauthenticated()
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "DELETE",
            url:
              `/api/v1/units/${unitId}`,
          });

        expect(
          response.statusCode
        ).toBe(401);

        expect(
          response.json()
        ).toEqual({
          error:
            "AUTHENTICATION_REQUIRED",
        });

        await app.close();
      }
    );

    it(
      "returns 400 for invalid id on delete",
      async () => {
        requireAuthenticatedUserMock
          .mockResolvedValue(
            authenticated([
              "unit.delete",
            ])
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "DELETE",
            url:
              "/api/v1/units/not-a-uuid",
          });

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.json().error
        ).toBe(
          "INVALID_UNIT_ID"
        );

        await app.close();
      }
    );

    it(
      "returns 403 when deleting without unit.delete",
      async () => {
        requireAuthenticatedUserMock
          .mockResolvedValue(
            authenticated([])
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "DELETE",
            url:
              `/api/v1/units/${unitId}`,
          });

        expect(
          response.statusCode
        ).toBe(403);

        expect(
          response.json().error
        ).toBe(
          "PERMISSION_DENIED"
        );

        await app.close();
      }
    );

    it(
      "returns 404 when unit does not exist",
      async () => {
        requireAuthenticatedUserMock
          .mockResolvedValue(
            authenticated(
              ["unit.delete"],
              {
                data: null,
                error: {
                  code: "P0002",
                  message:
                    "UNIT_NOT_FOUND",
                  details: null,
                  hint: null,
                },
              }
            )
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "DELETE",
            url:
              `/api/v1/units/${unitId}`,
          });

        expect(
          response.statusCode
        ).toBe(404);

        expect(
          response.json().error
        ).toBe(
          "UNIT_NOT_FOUND"
        );

        await app.close();
      }
    );

    it(
      "returns 409 when trying to delete headquarters",
      async () => {
        requireAuthenticatedUserMock
          .mockResolvedValue(
            authenticated(
              ["unit.delete"],
              {
                data: null,
                error: {
                  code: "23514",
                  message:
                    "HEADQUARTERS_CANNOT_BE_DELETED",
                  details: null,
                  hint: null,
                },
              }
            )
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "DELETE",
            url:
              `/api/v1/units/${unitId}`,
          });

        expect(
          response.statusCode
        ).toBe(409);

        expect(
          response.json().error
        ).toBe(
          "HEADQUARTERS_CANNOT_BE_DELETED"
        );

        await app.close();
      }
    );

    it(
      "soft deletes an authorized non-headquarters unit",
      async () => {
        const deletedUnit = {
          id: unitId,
          organization_id:
            organizationId,
          name:
            "Unidade Teste",
          is_headquarters:
            false,
          deleted_at:
            "2026-08-11T02:00:00.000Z",
          deleted_by:
            userId,
        };

        const auth =
          authenticated(
            ["unit.delete"],
            {
              data:
                deletedUnit,
              error: null,
            }
          );

        requireAuthenticatedUserMock
          .mockResolvedValue(
            auth
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "DELETE",
            url:
              `/api/v1/units/${unitId}`,
          });

        expect(
          response.statusCode
        ).toBe(200);

        expect(
          response.json()
        ).toEqual({
          data:
            deletedUnit,
        });

        expect(
          auth.supabase.rpc
        ).toHaveBeenCalledWith(
          "soft_delete_unit",
          {
            p_unit_id:
              unitId,
          }
        );

        await app.close();
      }
    );
  }
);