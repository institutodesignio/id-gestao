import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../src/auth.js", () => ({ requireAuthenticatedUser: vi.fn() }));
import { requireAuthenticatedUser } from "../../src/auth.js";
import { projectTeamRoutes } from "../../src/routes/project-team.js";
import { clinicalSupervisionRoutes } from "../../src/routes/clinical-supervision.js";
const authMock = vi.mocked(requireAuthenticatedUser);
const projectId = "11111111-1111-4111-8111-111111111111";
async function app() { const instance = Fastify({ logger: false }); await instance.register(projectTeamRoutes); await instance.register(clinicalSupervisionRoutes); return instance; }
describe("modules five and six authentication", () => {
  beforeEach(() => { vi.clearAllMocks(); authMock.mockResolvedValue({ ok: false, statusCode: 401, error: "AUTHENTICATION_REQUIRED" }); });
  it("protects project team", async () => { const instance=await app(); const response=await instance.inject({ method:"GET", url:`/api/v1/projects/${projectId}/team` }); expect(response.statusCode).toBe(401); await instance.close(); });
  it("protects clinical cases", async () => { const instance=await app(); const response=await instance.inject({ method:"GET", url:"/api/v1/clinical-supervision/cases" }); expect(response.statusCode).toBe(401); await instance.close(); });
  it("protects clinical sessions", async () => { const instance=await app(); const response=await instance.inject({ method:"GET", url:`/api/v1/clinical-supervision/cases/${projectId}/sessions` }); expect(response.statusCode).toBe(401); await instance.close(); });
});
