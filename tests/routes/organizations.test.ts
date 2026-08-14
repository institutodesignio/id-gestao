import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/auth.js", () => ({ requireAuthenticatedUser: vi.fn() }));
import { requireAuthenticatedUser } from "../../src/auth.js";
import { organizationsRoutes } from "../../src/routes/organizations.js";

const authMock = vi.mocked(requireAuthenticatedUser);
const organizationId = "bb8a3250-c661-434c-86a8-f0009a8c06e1";

function query(result: unknown) {
  const chain: any = {};
  for (const method of ["select", "update", "eq", "is"]) chain[method] = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => result);
  return chain;
}

function authenticated(permissions: string[], dbResult = { data: { id: organizationId, legal_name: "Instituto Designio" }, error: null }) {
  const chain = query(dbResult);
  return {
    value: { ok: true as const, user: { id: "afbc5f88-58dd-4b5b-8163-ac96ad980bde" }, supabase: {
      rpc: vi.fn(async () => ({ data: { organization: { id: organizationId }, permissions }, error: null })),
      from: vi.fn(() => chain),
    } } as any,
    chain,
  };
}

async function app() { const instance = Fastify({ logger: false }); await instance.register(organizationsRoutes); return instance; }

describe("organization routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires authentication", async () => {
    authMock.mockResolvedValue({ ok: false, statusCode: 401, error: "AUTHENTICATION_REQUIRED" });
    const instance = await app();
    expect((await instance.inject({ method: "GET", url: "/api/v1/organization" })).statusCode).toBe(401);
    await instance.close();
  });

  it("reads only the contextual organization", async () => {
    const auth = authenticated(["organization.read"]); authMock.mockResolvedValue(auth.value);
    const instance = await app(); const response = await instance.inject({ method: "GET", url: "/api/v1/organization" });
    expect(response.statusCode).toBe(200); expect(auth.chain.eq).toHaveBeenCalledWith("id", organizationId);
    await instance.close();
  });

  it("denies update without permission", async () => {
    const auth = authenticated([]); authMock.mockResolvedValue(auth.value);
    const instance = await app(); const response = await instance.inject({ method: "PATCH", url: "/api/v1/organization", payload: { legal_name: "Novo Nome" } });
    expect(response.statusCode).toBe(403); await instance.close();
  });

  it("normalizes and updates allowed fields", async () => {
    const auth = authenticated(["organization.update"]); authMock.mockResolvedValue(auth.value);
    const instance = await app(); const response = await instance.inject({ method: "PATCH", url: "/api/v1/organization", payload: { cnpj: "12.345.678/0001-90" } });
    expect(response.statusCode).toBe(200); expect(auth.chain.update).toHaveBeenCalledWith(expect.objectContaining({ cnpj: "12345678000190" }));
    await instance.close();
  });

  it("rejects invalid payload", async () => {
    const instance = await app(); const response = await instance.inject({ method: "PATCH", url: "/api/v1/organization", payload: {} });
    expect(response.statusCode).toBe(400); expect(authMock).not.toHaveBeenCalled(); await instance.close();
  });
});
