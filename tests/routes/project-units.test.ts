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
  projectUnitsRoutes,
} from "../../src/routes/project-units.js";

const organizationId =
  "bb8a3250-c661-434c-86a8-f0009a8c06e1";

const userId =
  "afbc5f88-58dd-4b5b-8163-ac96ad980bde";

const projectId =
  "22222222-2222-4222-8222-222222222222";

const projectUnitId =
  "33333333-3333-4333-8333-333333333333";

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
  permissions: string[] = []
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
    projectUnitsRoutes
  );

  return app;
}

describe(
  "project units routes",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    // ========================================================
    // POST
    // ========================================================

    it(
      "returns 401 when creating project unit without authentication",
      async () => {
        requireAuthenticatedUserMock
          .mockResolvedValue(
            unauthenticated()
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "POST",

            url:
              `/api/v1/projects/${projectId}/units`,

            payload: {
              unit_id:
                unitId,
            },
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
      "returns 400 for invalid project id when creating project unit",
      async () => {
        requireAuthenticatedUserMock
          .mockResolvedValue(
            authenticated([
              "project.update",
              "unit.read",
            ])
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "POST",

            url:
              "/api/v1/projects/not-a-uuid/units",

            payload: {
              unit_id:
                unitId,
            },
          });

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.json().error
        ).toBe(
          "INVALID_PROJECT_ID"
        );

        await app.close();
      }
    );

    it(
      "returns 400 for invalid project unit data",
      async () => {
        requireAuthenticatedUserMock
          .mockResolvedValue(
            authenticated([
              "project.update",
              "unit.read",
            ])
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "POST",

            url:
              `/api/v1/projects/${projectId}/units`,

            payload: {
              unit_id:
                "not-a-uuid",
            },
          });

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.json().error
        ).toBe(
          "INVALID_PROJECT_UNIT_DATA"
        );

        await app.close();
      }
    );

    it(
      "returns 403 when creating without required permissions",
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
              `/api/v1/projects/${projectId}/units`,

            payload: {
              unit_id:
                unitId,
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
    // PATCH
    // ========================================================

    it(
      "returns 400 for invalid ids when updating project unit",
      async () => {
        requireAuthenticatedUserMock
          .mockResolvedValue(
            authenticated([
              "project.update",
            ])
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "PATCH",

            url:
              `/api/v1/projects/${projectId}/units/not-a-uuid`,

            payload: {
              is_primary:
                true,
            },
          });

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.json().error
        ).toBe(
          "INVALID_PROJECT_UNIT_ID"
        );

        await app.close();
      }
    );

    it(
      "returns 400 for empty project unit update",
      async () => {
        requireAuthenticatedUserMock
          .mockResolvedValue(
            authenticated([
              "project.update",
            ])
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "PATCH",

            url:
              `/api/v1/projects/${projectId}/units/${projectUnitId}`,

            payload: {},
          });

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.json().error
        ).toBe(
          "INVALID_PROJECT_UNIT_DATA"
        );

        await app.close();
      }
    );

    it(
      "returns 403 when updating without project.update",
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
              `/api/v1/projects/${projectId}/units/${projectUnitId}`,

            payload: {
              is_primary:
                true,
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
    // DELETE
    // ========================================================

    it(
      "returns 400 for invalid ids when deleting project unit",
      async () => {
        requireAuthenticatedUserMock
          .mockResolvedValue(
            authenticated([
              "project.update",
            ])
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "DELETE",

            url:
              `/api/v1/projects/${projectId}/units/not-a-uuid`,
          });

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.json().error
        ).toBe(
          "INVALID_PROJECT_UNIT_ID"
        );

        await app.close();
      }
    );

    it(
      "returns 403 when deleting without project.update",
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
              `/api/v1/projects/${projectId}/units/${projectUnitId}`,
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
  }
);