import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/auth.js", () => ({ requireAuthenticatedUser: vi.fn() }));
vi.mock("../../src/plugins/supabase.js", () => ({ createAdminSupabaseClient: vi.fn(() => null) }));

import { requireAuthenticatedUser } from "../../src/auth.js";
import { agendaRoutes } from "../../src/routes/agenda.js";
import { documentRoutes } from "../../src/routes/documents.js";
import { financeRoutes } from "../../src/routes/finance.js";

const auth = vi.mocked(requireAuthenticatedUser);
const id = "11111111-1111-4111-8111-111111111111";

async function build() {
  const app = Fastify({ logger: false });
  await app.register(agendaRoutes);
  await app.register(documentRoutes);
  await app.register(financeRoutes);
  return app;
}

describe("Agenda, Documents and Finance authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.mockResolvedValue({ ok: false, statusCode: 401, error: "AUTHENTICATION_REQUIRED" });
  });

  it("protects appointment lists", async () => {
    const app = await build();
    const response = await app.inject({ method: "GET", url: "/api/v1/appointments" });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("protects appointment creation", async () => {
    const app = await build();
    const response = await app.inject({ method: "POST", url: "/api/v1/appointments", payload: {} });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("protects document lists", async () => {
    const app = await build();
    const response = await app.inject({ method: "GET", url: "/api/v1/documents" });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("protects signed document downloads", async () => {
    const app = await build();
    const response = await app.inject({ method: "GET", url: `/api/v1/documents/${id}/download-url` });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("protects finance transactions", async () => {
    const app = await build();
    const response = await app.inject({ method: "GET", url: "/api/v1/finance/transactions" });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("protects finance approvals", async () => {
    const app = await build();
    const response = await app.inject({ method: "POST", url: `/api/v1/finance/transactions/${id}/approve`, payload: {} });
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});
