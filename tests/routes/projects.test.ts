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
  projectsRoutes,
} from "../../src/routes/projects.js";

const organizationId =
  "bb8a3250-c661-434c-86a8-f0009a8c06e1";

const userId =
  "afbc5f88-58dd-4b5b-8163-ac96ad980bde";

const projectId =
  "22222222-2222-4222-8222-222222222222";

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
        "soft_delete_project"
      ) {
        return {
          data:
            softDeleteResult?.data ??
            {
              id: projectId,
              organization_id:
                organizationId,
              name:
                "Projeto Teste",
              deleted_at:
                "2026-08-11T03:00:00.000Z",
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
    projectsRoutes
  );

  return app;
}

describe(
  "projects routes",
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
              "/api/v1/projects",
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
              "project.read",
            ])
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "GET",
            url:
              "/api/v1/projects?page=0",
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
      "returns 403 when listing without project.read",
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
              "/api/v1/projects",
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
      "returns 400 for invalid project id",
      async () => {
        requireAuthenticatedUserMock
          .mockResolvedValue(
            authenticated([
              "project.read",
            ])
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "GET",
            url:
              "/api/v1/projects/not-a-uuid",
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
      "returns 400 when creating invalid project",
      async () => {
        requireAuthenticatedUserMock
          .mockResolvedValue(
            authenticated([
              "project.create",
            ])
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "POST",
            url:
              "/api/v1/projects",
            payload: {
              name:
                "Projeto sem slug",
            },
          });

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.json().error
        ).toBe(
          "INVALID_PROJECT_DATA"
        );

        await app.close();
      }
    );

    it(
      "returns 400 for inverted dates on create",
      async () => {
        requireAuthenticatedUserMock
          .mockResolvedValue(
            authenticated([
              "project.create",
            ])
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "POST",
            url:
              "/api/v1/projects",
            payload: {
              name:
                "Projeto Teste",
              slug:
                "projeto-teste",
              starts_at:
                "2026-08-10",
              ends_at:
                "2026-08-09",
            },
          });

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.json().error
        ).toBe(
          "INVALID_PROJECT_DATA"
        );

        await app.close();
      }
    );

    it(
      "returns 403 when creating without project.create",
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
              "/api/v1/projects",
            payload: {
              name:
                "Projeto Teste",
              slug:
                "projeto-teste",
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
              "project.update",
            ])
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "PATCH",
            url:
              `/api/v1/projects/${projectId}`,
            payload: {},
          });

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.json().error
        ).toBe(
          "INVALID_PROJECT_DATA"
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
              "project.update",
            ])
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "PATCH",
            url:
              "/api/v1/projects/not-a-uuid",
            payload: {
              description:
                "Atualizado",
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
              `/api/v1/projects/${projectId}`,
            payload: {
              description:
                "Atualizado",
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
    // DELETE /api/v1/projects/:id
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
              `/api/v1/projects/${projectId}`,
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
              "project.delete",
            ])
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "DELETE",
            url:
              "/api/v1/projects/not-a-uuid",
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
      "returns 403 when deleting without project.delete",
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
              `/api/v1/projects/${projectId}`,
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
      "returns 404 when project does not exist",
      async () => {
        requireAuthenticatedUserMock
          .mockResolvedValue(
            authenticated(
              [
                "project.delete",
              ],
              {
                data: null,
                error: {
                  code: "P0002",
                  message:
                    "PROJECT_NOT_FOUND",
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
              `/api/v1/projects/${projectId}`,
          });

        expect(
          response.statusCode
        ).toBe(404);

        expect(
          response.json().error
        ).toBe(
          "PROJECT_NOT_FOUND"
        );

        await app.close();
      }
    );

    it(
      "returns 403 when project scope is denied",
      async () => {
        requireAuthenticatedUserMock
          .mockResolvedValue(
            authenticated(
              [
                "project.delete",
              ],
              {
                data: null,
                error: {
                  code: "42501",
                  message:
                    "PROJECT_SCOPE_DENIED",
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
              `/api/v1/projects/${projectId}`,
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
      "soft deletes an authorized project",
      async () => {
        const deletedProject = {
          id:
            projectId,
          organization_id:
            organizationId,
          name:
            "Projeto Teste",
          deleted_at:
            "2026-08-11T03:00:00.000Z",
          deleted_by:
            userId,
        };

        const auth =
          authenticated(
            [
              "project.delete",
            ],
            {
              data:
                deletedProject,
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
              `/api/v1/projects/${projectId}`,
          });

        expect(
          response.statusCode
        ).toBe(200);

        expect(
          response.json()
        ).toEqual({
          data:
            deletedProject,
        });

        expect(
          auth.supabase.rpc
        ).toHaveBeenCalledWith(
          "soft_delete_project",
          {
            p_project_id:
              projectId,
          }
        );

        await app.close();
      }
    );
  }
);