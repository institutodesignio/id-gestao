import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/auth.js", () => ({
  requireAuthenticatedUser: vi.fn(),
}));

import { requireAuthenticatedUser } from "../../src/auth.js";
import { rolesRoutes } from "../../src/routes/roles.js";

const organizationId = "bb8a3250-c661-434c-86a8-f0009a8c06e1";
const authMock = vi.mocked(requireAuthenticatedUser);

function rolesBuilder(result: Record<string, unknown>) {
  const value: any = {};
  for (const method of ["select", "eq", "is", "or"]) {
    value[method] = vi.fn(() => value);
  }
  value.order = vi.fn().mockResolvedValue(result);
  return value;
}

function authenticated(permissions: string[], roles: any) {
  return {
    ok: true as const,
    user: { id: "afbc5f88-58dd-4b5b-8163-ac96ad980bde" },
    supabase: {
      rpc: vi.fn().mockResolvedValue({
        data: { organization: { id: organizationId }, permissions },
        error: null,
      }),
      from: vi.fn(() => roles),
    },
  } as any;
}

async function buildTestApp() {
  const app = Fastify({ logger: false });
  await app.register(rolesRoutes);
  return app;
}

describe("institutional roles route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists active global and organization roles for role managers", async () => {
    const roles = rolesBuilder({
      data: [
        { id: "11111111-1111-4111-8111-111111111111", code: "TECHNICAL", name: "Técnico" },
      ],
      error: null,
    });
    authMock.mockResolvedValue(authenticated(["user.manage_roles"], roles));

    const app = await buildTestApp();
    const response = await app.inject({ method: "GET", url: "/api/v1/roles" });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toHaveLength(1);
    expect(roles.or).toHaveBeenCalledWith(
      `organization_id.is.null,organization_id.eq.${organizationId}`,
    );
    await app.close();
  });

  it("denies callers without role-management permission", async () => {
    authMock.mockResolvedValue(authenticated([], rolesBuilder({ data: [], error: null })));
    const app = await buildTestApp();
    const response = await app.inject({ method: "GET", url: "/api/v1/roles" });
    expect(response.statusCode).toBe(403);
    expect(response.json().error).toBe("PERMISSION_DENIED");
    await app.close();
  });
});
