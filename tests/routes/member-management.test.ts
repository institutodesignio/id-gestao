import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/auth.js", () => ({
  requireAuthenticatedUser: vi.fn(),
}));

import { requireAuthenticatedUser } from "../../src/auth.js";
import { membersRoutes } from "../../src/routes/members.js";

const organizationId = "bb8a3250-c661-434c-86a8-f0009a8c06e1";
const userId = "afbc5f88-58dd-4b5b-8163-ac96ad980bde";
const memberId = "11111111-1111-4111-8111-111111111111";
const personId = "22222222-2222-4222-8222-222222222222";
const profileId = "33333333-3333-4333-8333-333333333333";
const roleId = "44444444-4444-4444-8444-444444444444";
const memberRoleId = "55555555-5555-4555-8555-555555555555";

const authMock = vi.mocked(requireAuthenticatedUser);

function builder(result: Record<string, unknown>) {
  const value: any = {};
  for (const method of ["select", "eq", "is", "or", "insert", "update", "neq"]) {
    value[method] = vi.fn(() => value);
  }
  value.maybeSingle = vi.fn().mockResolvedValue(result);
  value.single = vi.fn().mockResolvedValue(result);
  return value;
}

function authenticated(permissions: string[], builders: Record<string, any>) {
  return {
    ok: true as const,
    token: "test-token",
    user: { id: userId },
    supabase: {
      rpc: vi.fn().mockResolvedValue({
        data: { organization: { id: organizationId }, permissions },
        error: null,
      }),
      from: vi.fn((table: string) => builders[table]),
    },
  } as any;
}

async function buildTestApp() {
  const app = Fastify({ logger: false });
  await app.register(membersRoutes);
  return app;
}

describe("member management routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns one member from the authenticated organization", async () => {
    const members = builder({
      data: {
        id: memberId,
        person_id: personId,
        user_profile_id: profileId,
        status: "ACTIVE",
        joined_at: "2026-01-10",
        ended_at: null,
        created_at: "2026-01-10T12:00:00.000Z",
        person: { id: personId, full_name: "Maria Silva", preferred_name: "Maria", primary_email: "maria@example.org" },
        user_profile: { id: profileId, auth_user_id: userId, email: "maria@institutodesignio.org" },
        member_roles: [{
          id: memberRoleId,
          role_id: roleId,
          starts_at: "2026-01-10",
          ends_at: null,
          role: { id: roleId, code: "MANAGER", name: "Gestor", description: "Gestão" },
        }],
      },
      error: null,
    });
    authMock.mockResolvedValue(authenticated(["user.read"], { organization_members: members }));

    const app = await buildTestApp();
    const response = await app.inject({ method: "GET", url: `/api/v1/members/${memberId}` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: memberId,
      profile: { full_name: "Maria Silva", email: "maria@institutodesignio.org" },
      roles: [{ role_code: "MANAGER", role_description: "Gestão" }],
    });
    expect(members.eq).toHaveBeenCalledWith("organization_id", organizationId);
    await app.close();
  });

  it("denies member detail without user.read", async () => {
    authMock.mockResolvedValue(authenticated([], {}));
    const app = await buildTestApp();
    const response = await app.inject({ method: "GET", url: `/api/v1/members/${memberId}` });
    expect(response.statusCode).toBe(403);
    expect(response.json().error).toBe("PERMISSION_DENIED");
    await app.close();
  });

  it("inactivates a member while preserving the record", async () => {
    const members = builder({
      data: {
        id: memberId,
        user_profile_id: profileId,
        status: "ACTIVE",
        user_profile: { auth_user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
        member_roles: [{ ends_at: null, role: { code: "TECHNICAL_PROFESSIONAL" } }],
      },
      error: null,
    });
    members.single.mockResolvedValue({
      data: { id: memberId, status: "INACTIVE", ended_at: "2026-08-27" },
      error: null,
    });
    authMock.mockResolvedValue(authenticated(["user.update"], { organization_members: members }));

    const app = await buildTestApp();
    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/members/${memberId}`,
      payload: { status: "INACTIVE" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ data: { id: memberId, status: "INACTIVE" } });
    expect(members.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "INACTIVE", updated_by: userId }),
    );
    await app.close();
  });

  it("denies member status changes without user.update", async () => {
    authMock.mockResolvedValue(authenticated([], {}));
    const app = await buildTestApp();
    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/members/${memberId}`,
      payload: { status: "INACTIVE" },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error).toBe("PERMISSION_DENIED");
    await app.close();
  });

  it("assigns an active role to a member", async () => {
    const members = builder({ data: { id: memberId }, error: null });
    const roles = builder({
      data: { id: roleId, code: "MANAGER", name: "Gestor", description: null },
      error: null,
    });
    const assignments = builder({
      data: {
        id: memberRoleId,
        organization_member_id: memberId,
        role_id: roleId,
        starts_at: "2026-08-13",
        ends_at: null,
        created_at: "2026-08-13T12:00:00.000Z",
      },
      error: null,
    });
    authMock.mockResolvedValue(authenticated(["user.manage_roles"], {
      organization_members: members,
      roles,
      member_roles: assignments,
    }));

    const app = await buildTestApp();
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/members/${memberId}/roles`,
      payload: { role_id: roleId, starts_at: "2026-08-13" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ id: memberRoleId, role: { id: roleId } });
    expect(assignments.insert).toHaveBeenCalledWith(expect.objectContaining({
      organization_member_id: memberId,
      role_id: roleId,
      created_by: userId,
    }));
    await app.close();
  });

  it("returns conflict when an active role already exists", async () => {
    const members = builder({ data: { id: memberId }, error: null });
    const roles = builder({ data: { id: roleId }, error: null });
    const assignments = builder({ data: null, error: { code: "23505" } });
    authMock.mockResolvedValue(authenticated(["user.manage_roles"], {
      organization_members: members,
      roles,
      member_roles: assignments,
    }));

    const app = await buildTestApp();
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/members/${memberId}/roles`,
      payload: { role_id: roleId },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toBe("MEMBER_ROLE_ALREADY_ACTIVE");
    await app.close();
  });

  it("ends an active member role", async () => {
    const members = builder({ data: { id: memberId }, error: null });
    const assignments = builder({
      data: {
        id: memberRoleId,
        organization_member_id: memberId,
        role_id: roleId,
        starts_at: "2026-01-10",
        ends_at: "2026-08-13",
        updated_at: "2026-08-13T12:00:00.000Z",
      },
      error: null,
    });
    authMock.mockResolvedValue(authenticated(["user.manage_roles"], {
      organization_members: members,
      member_roles: assignments,
    }));

    const app = await buildTestApp();
    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/members/${memberId}/roles/${memberRoleId}/end`,
      payload: { ends_at: "2026-08-13" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().ends_at).toBe("2026-08-13");
    expect(assignments.update).toHaveBeenCalledWith(expect.objectContaining({
      ends_at: "2026-08-13",
      updated_by: userId,
    }));
    await app.close();
  });

  it("rejects an end date before the role start", async () => {
    const members = builder({ data: { id: memberId }, error: null });
    const assignments = builder({ data: { id: memberRoleId, role_id: roleId, starts_at: "2026-05-01", role: { code: "MANAGER" } }, error: null });
    authMock.mockResolvedValue(authenticated(["user.manage_roles"], {
      organization_members: members,
      member_roles: assignments,
    }));

    const app = await buildTestApp();
    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/members/${memberId}/roles/${memberRoleId}/end`,
      payload: { ends_at: "2026-04-30" },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toBe("MEMBER_ROLE_END_BEFORE_START");
    await app.close();
  });

  it("prevents privilege escalation to administrator", async () => {
    const members = builder({ data: { id: memberId }, error: null });
    const roles = builder({ data: { id: roleId, code: "ADMINISTRATOR", name: "Administrador" }, error: null });
    authMock.mockResolvedValue(authenticated(["user.manage_roles"], {
      organization_members: members,
      roles,
    }));

    const app = await buildTestApp();
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/members/${memberId}/roles`,
      payload: { role_id: roleId },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error).toBe("ROLE_ASSIGNMENT_FORBIDDEN");
    await app.close();
  });

  it("prevents ending the last active administrator", async () => {
    const members = builder({ data: { id: memberId }, error: null });
    const assignments = builder({
      data: { id: memberRoleId, role_id: roleId, starts_at: "2026-01-10", role: { code: "ADMINISTRATOR" } },
      error: null,
      count: 0,
    });
    authMock.mockResolvedValue(authenticated(["user.manage_roles", "role.manage"], {
      organization_members: members,
      member_roles: assignments,
    }));

    const app = await buildTestApp();
    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/members/${memberId}/roles/${memberRoleId}/end`,
      payload: { ends_at: "2026-08-13" },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toBe("LAST_ADMINISTRATOR_ROLE_REQUIRED");
    await app.close();
  });
});
