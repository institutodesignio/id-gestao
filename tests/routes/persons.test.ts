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
  personsRoutes,
} from "../../src/routes/persons.js";

const organizationId =
  "bb8a3250-c661-434c-86a8-f0009a8c06e1";

const userId =
  "afbc5f88-58dd-4b5b-8163-ac96ad980bde";

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
  const rpc = vi.fn()
    .mockResolvedValue({
      data: {
        organization: {
          id: organizationId,
        },
        permissions,
      },
      error: null,
    });

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
    personsRoutes
  );

  return app;
}

describe(
  "persons routes",
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
              "/api/v1/persons",
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
            authenticated(
              ["person.read"]
            )
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "GET",
            url:
              "/api/v1/persons?page=0",
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
      "returns 403 without person.read",
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
              "/api/v1/persons",
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
      "returns 400 when creating an invalid person",
      async () => {
        requireAuthenticatedUserMock
          .mockResolvedValue(
            authenticated(
              ["person.create"]
            )
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "POST",
            url:
              "/api/v1/persons",
            payload: {
              person_type:
                "INDIVIDUAL",
            },
          });

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.json().error
        ).toBe(
          "INVALID_PERSON_DATA"
        );

        await app.close();
      }
    );

    it(
      "returns 400 for invalid person id",
      async () => {
        requireAuthenticatedUserMock
          .mockResolvedValue(
            authenticated(
              ["person.read"]
            )
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "GET",
            url:
              "/api/v1/persons/not-a-uuid",
          });

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.json().error
        ).toBe(
          "INVALID_PERSON_ID"
        );

        await app.close();
      }
    );

    it(
      "returns 400 for empty person update",
      async () => {
        requireAuthenticatedUserMock
          .mockResolvedValue(
            authenticated(
              ["person.update"]
            )
          );

        const app =
          await buildTestApp();

        const response =
          await app.inject({
            method: "PATCH",
            url:
              "/api/v1/persons/3b15bcfa-3d66-4a9a-93e2-04b53cd61836",
            payload: {},
          });

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.json().error
        ).toBe(
          "INVALID_PERSON_DATA"
        );

        await app.close();
      }
    );
  }
);