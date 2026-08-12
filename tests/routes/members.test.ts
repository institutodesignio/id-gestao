import Fastify from "fastify";

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock(
  "../../src/auth.js",
  () => ({
    requireAuthenticatedUser:
      vi.fn(),
  })
);

import {
  requireAuthenticatedUser,
} from "../../src/auth.js";

import {
  membersRoutes,
} from "../../src/routes/members.js";

const organizationId =
  "bb8a3250-c661-434c-86a8-f0009a8c06e1";

const userId =
  "afbc5f88-58dd-4b5b-8163-ac96ad980bde";

const memberId =
  "11111111-1111-4111-8111-111111111111";

const personId =
  "22222222-2222-4222-8222-222222222222";

const profileId =
  "33333333-3333-4333-8333-333333333333";

const roleId =
  "44444444-4444-4444-8444-444444444444";

const memberRoleId =
  "55555555-5555-4555-8555-555555555555";

const authMock =
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

function createListBuilder(
  result: {
    data: unknown[];
    error: unknown;
    count: number;
  }
) {
  const builder: any = {};

  builder.select =
    vi.fn(() => builder);

  builder.eq =
    vi.fn(() => builder);

  builder.in =
    vi.fn(() => builder);

  builder.order =
    vi.fn(() => builder);

  builder.range =
    vi.fn()
      .mockResolvedValue(
        result
      );

  return builder;
}

function authenticated(
  permissions:
    string[] = [],
  builder?: any
) {
  const rpc =
    vi.fn()
      .mockResolvedValue({
        data: {
          organization: {
            id:
              organizationId,
          },

          permissions,
        },

        error: null,
      });

  const from =
    vi.fn(() => builder);

  return {
    ok: true as const,

    token:
      "test-token",

    user: {
      id: userId,
    },

    supabase: {
      rpc,
      from,
    },
  } as any;
}

async function buildTestApp() {
  const app =
    Fastify({
      logger: false,
    });

  await app.register(
    membersRoutes
  );

  return app;
}

describe(
  "members routes",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it(
      "returns 401 without authentication",
      async () => {
        authMock
          .mockResolvedValue(
            unauthenticated()
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "GET",

            url:
              "/api/v1/members",
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
        authMock
          .mockResolvedValue(
            authenticated([])
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "GET",

            url:
              "/api/v1/members?page=0",
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
      "returns 400 when normalized search is empty",
      async () => {
        authMock
          .mockResolvedValue(
            authenticated([
              "user.read",
            ])
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "GET",

            url:
              "/api/v1/members?search=%25_%28%29%2C",
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
      "returns 403 without user.read permission",
      async () => {
        authMock
          .mockResolvedValue(
            authenticated([])
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "GET",

            url:
              "/api/v1/members",
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
      "returns an empty paginated list",
      async () => {
        const builder =
          createListBuilder({
            data: [],
            error: null,
            count: 0,
          });

        const auth =
          authenticated(
            [
              "user.read",
            ],
            builder
          );

        authMock
          .mockResolvedValue(
            auth
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "GET",

            url:
              "/api/v1/members",
          });

        expect(
          response.statusCode
        ).toBe(200);

        expect(
          response.json()
        ).toEqual({
          data: [],

          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
            hasPreviousPage:
              false,
            hasNextPage:
              false,
          },

          filters: {
            search: null,
            status: null,
          },
        });

        expect(
          auth.supabase.from
        ).toHaveBeenCalledWith(
          "organization_members"
        );

        expect(
          builder.eq
        ).toHaveBeenCalledWith(
          "organization_id",
          organizationId
        );

        await app.close();
      }
    );

    it(
      "returns members in the canonical format",
      async () => {
        const builder =
          createListBuilder({
            data: [
              {
                id: memberId,

                person_id:
                  personId,

                user_profile_id:
                  profileId,

                status:
                  "ACTIVE",

                joined_at:
                  "2026-01-10",

                ended_at:
                  null,

                created_at:
                  "2026-01-10T12:00:00.000Z",

                person: {
                  id: personId,

                  full_name:
                    "Maria Silva",

                  preferred_name:
                    "Maria",

                  primary_email:
                    "maria@institutodesignio.org",
                },

                user_profile: {
                  id: profileId,

                  auth_user_id:
                    userId,

                  email:
                    "maria@institutodesignio.org",
                },

                member_roles: [
                  {
                    id:
                      memberRoleId,

                    role_id:
                      roleId,

                    starts_at:
                      "2026-01-10",

                    ends_at:
                      null,

                    role: {
                      id:
                        roleId,

                      code:
                        "MANAGER",

                      name:
                        "Gestor",

                      description:
                        null,
                    },
                  },
                ],
              },
            ],

            error: null,
            count: 1,
          });

        authMock
          .mockResolvedValue(
            authenticated(
              [
                "user.read",
              ],
              builder
            )
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "GET",

            url:
              "/api/v1/members?page=1&limit=20&status=ACTIVE",
          });

        expect(
          response.statusCode
        ).toBe(200);

        expect(
          response.json().data
        ).toEqual([
          {
            id: memberId,

            user_id: userId,

            status:
              "ACTIVE",

            joined_at:
              "2026-01-10",

            created_at:
              "2026-01-10T12:00:00.000Z",

            profile: {
              full_name:
                "Maria Silva",

              email:
                "maria@institutodesignio.org",

              avatar_url:
                null,
            },

            roles: [
              {
                id:
                  memberRoleId,

                role_id:
                  roleId,

                role_code:
                  "MANAGER",

                role_name:
                  "Gestor",

                starts_at:
                  "2026-01-10",

                ends_at:
                  null,
              },
            ],
          },
        ]);

        expect(
          builder.eq
        ).toHaveBeenCalledWith(
          "status",
          "ACTIVE"
        );

        await app.close();
      }
    );
  }
);