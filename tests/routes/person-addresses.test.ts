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
  personAddressesRoutes,
} from "../../src/routes/person-addresses.js";

const organizationId =
  "bb8a3250-c661-434c-86a8-f0009a8c06e1";

const userId =
  "afbc5f88-58dd-4b5b-8163-ac96ad980bde";

const personId =
  "3b15bcfa-3d66-4a9a-93e2-04b53cd61836";

const addressId =
  "5c91dffd-6d54-498a-a4b0-f34154c55ab4";

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
    personAddressesRoutes
  );

  return app;
}

describe(
  "person address routes",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it(
      "returns 401 when creating address without authentication",
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
              `/api/v1/persons/${personId}/addresses`,
            payload: {
              street:
                "Rua Teste",
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
      "returns 400 for invalid person id",
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
              "/api/v1/persons/not-a-uuid/addresses",
            payload: {
              street:
                "Rua Teste",
            },
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
      "returns 400 for invalid postal code",
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
              `/api/v1/persons/${personId}/addresses`,
            payload: {
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
          "INVALID_ADDRESS_DATA"
        );

        expect(
          response
            .json()
            .details
            .fieldErrors
            .postal_code
        ).toContain(
          "Postal code must contain exactly 8 digits"
        );

        await app.close();
      }
    );

    it(
      "returns 400 for invalid state code",
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
              `/api/v1/persons/${personId}/addresses`,
            payload: {
              state_code:
                "S",
            },
          });

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.json().error
        ).toBe(
          "INVALID_ADDRESS_DATA"
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
              `/api/v1/persons/${personId}/addresses`,
            payload: {
              street:
                "Rua Teste",
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
      "returns 400 for invalid address id",
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
              `/api/v1/persons/${personId}/addresses/not-a-uuid`,
            payload: {
              street_number:
                "10",
            },
          });

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.json().error
        ).toBe(
          "INVALID_ADDRESS_ID"
        );

        await app.close();
      }
    );

    it(
      "returns 400 for empty address update",
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
              `/api/v1/persons/${personId}/addresses/${addressId}`,
            payload: {},
          });

        expect(
          response.statusCode
        ).toBe(400);

        expect(
          response.json().error
        ).toBe(
          "INVALID_ADDRESS_DATA"
        );

        await app.close();
      }
    );
  }
);