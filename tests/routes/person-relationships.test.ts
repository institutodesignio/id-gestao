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
  personRelationshipsRoutes,
} from "../../src/routes/person-relationships.js";

const organizationId =
  "bb8a3250-c661-434c-86a8-f0009a8c06e1";

const userId =
  "afbc5f88-58dd-4b5b-8163-ac96ad980bde";

const personId =
  "3b15bcfa-3d66-4a9a-93e2-04b53cd61836";

const relatedPersonId =
  "ea7e997b-a389-4a6c-8198-a9ff791ac720";

const relationshipId =
  "ac1cdb9a-abea-4f55-9205-8f295fc2cf28";

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
    personRelationshipsRoutes
  );

  return app;
}

describe(
  "person relationship routes",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it(
      "returns 401 when creating relationship without authentication",
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
              `/api/v1/persons/${personId}/relationships`,
            payload: {
              related_person_id:
                relatedPersonId,
              relationship_type:
                "RESPONSAVEL",
            },
          });

        expect(
          response.statusCode
        ).toBe(401);

        expect(
          response.json().error
        ).toBe(
          "AUTHENTICATION_REQUIRED"
        );

        await app.close();
      }
    );

    it(
      "returns 400 for invalid related person id",
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
              `/api/v1/persons/${personId}/relationships`,
            payload: {
              related_person_id:
                "invalid",
              relationship_type:
                "RESPONSAVEL",
            },
          });

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.json().error
        ).toBe(
          "INVALID_RELATIONSHIP_DATA"
        );

        await app.close();
      }
    );

    it(
      "returns 403 without person.create",
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
              `/api/v1/persons/${personId}/relationships`,
            payload: {
              related_person_id:
                relatedPersonId,
              relationship_type:
                "RESPONSAVEL",
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
      "rejects self relationship",
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
              `/api/v1/persons/${personId}/relationships`,
            payload: {
              related_person_id:
                personId,
              relationship_type:
                "RESPONSAVEL",
            },
          });

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.json()
        ).toEqual({
          error:
            "PERSON_RELATIONSHIP_SELF_REFERENCE",
        });

        await app.close();
      }
    );

    it(
      "returns 400 when ends_at is before starts_at",
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
              `/api/v1/persons/${personId}/relationships`,
            payload: {
              related_person_id:
                relatedPersonId,
              relationship_type:
                "RESPONSAVEL",
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
          "INVALID_RELATIONSHIP_DATA"
        );

        await app.close();
      }
    );

    it(
      "returns 400 for invalid relationship id",
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
              `/api/v1/persons/${personId}/relationships/not-a-uuid`,
            payload: {
              relationship_type:
                "RESPONSAVEL",
            },
          });

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.json().error
        ).toBe(
          "INVALID_RELATIONSHIP_ID"
        );

        await app.close();
      }
    );

    it(
      "returns 400 for empty relationship update",
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
              `/api/v1/persons/${personId}/relationships/${relationshipId}`,
            payload: {},
          });

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.json().error
        ).toBe(
          "INVALID_RELATIONSHIP_DATA"
        );

        await app.close();
      }
    );

    it(
      "returns 400 when relationship update has inverted dates",
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
              `/api/v1/persons/${personId}/relationships/${relationshipId}`,
            payload: {
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
          "INVALID_RELATIONSHIP_DATA"
        );

        await app.close();
      }
    );
  }
);