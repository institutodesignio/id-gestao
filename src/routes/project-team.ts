import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuthenticatedUser } from "../auth.js";
import { createProjectTeamMemberSchema, updateProjectTeamMemberSchema } from "../schemas/project-team.js";

const projectParams = z.object({ projectId: z.string().uuid() });
const memberParams = z.object({ projectId: z.string().uuid(), memberId: z.string().uuid() });
const contextSchema = z.object({ organization: z.object({ id: z.string().uuid() }), permissions: z.array(z.string()) });

async function context(auth: any, reply: FastifyReply) {
  const { data, error } = await auth.supabase.rpc("current_user_context");
  const parsed = contextSchema.safeParse(data);
  if (error || !parsed.success) return { ok: false as const, response: reply.code(403).send({ error: "USER_CONTEXT_UNAVAILABLE" }) };
  return { ok: true as const, data: parsed.data };
}

export async function projectTeamRoutes(app: FastifyInstance) {
  app.get("/api/v1/projects/:projectId/team", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const params = projectParams.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "INVALID_PROJECT_ID" });
    const ctx = await context(auth, reply);
    if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("project.read")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const { data, error } = await auth.supabase.from("project_team_members").select(`id, project_id, person_id, role_title, starts_at, ends_at, notes, created_at, updated_at, person:persons!project_team_members_person_id_fkey(id, full_name, preferred_name, primary_email, primary_phone)`).eq("organization_id", ctx.data.organization.id).eq("project_id", params.data.projectId).is("deleted_at", null).order("role_title");
    if (error) return reply.code(500).send({ error: "PROJECT_TEAM_LIST_FAILED" });
    return reply.send({ data: data ?? [] });
  });

  app.post("/api/v1/projects/:projectId/team", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const params = projectParams.safeParse(request.params);
    const body = createProjectTeamMemberSchema.safeParse(request.body);
    if (!params.success) return reply.code(400).send({ error: "INVALID_PROJECT_ID" });
    if (!body.success) return reply.code(400).send({ error: "INVALID_PROJECT_TEAM_DATA", details: body.error.flatten() });
    const ctx = await context(auth, reply);
    if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("project.manage_team")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const { data, error } = await auth.supabase.from("project_team_members").insert({ organization_id: ctx.data.organization.id, project_id: params.data.projectId, ...body.data, starts_at: body.data.starts_at ?? new Date().toISOString().slice(0, 10), ends_at: body.data.ends_at ?? null, notes: body.data.notes ?? null, created_by: auth.user.id, updated_by: auth.user.id }).select().single();
    if (error?.code === "23505") return reply.code(409).send({ error: "PROJECT_TEAM_MEMBER_ALREADY_ACTIVE" });
    if (error) return reply.code(500).send({ error: "PROJECT_TEAM_CREATE_FAILED" });
    return reply.code(201).send({ data });
  });

  app.patch("/api/v1/projects/:projectId/team/:memberId", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const params = memberParams.safeParse(request.params);
    const body = updateProjectTeamMemberSchema.safeParse(request.body);
    if (!params.success) return reply.code(400).send({ error: "INVALID_PROJECT_TEAM_MEMBER_ID" });
    if (!body.success) return reply.code(400).send({ error: "INVALID_PROJECT_TEAM_DATA", details: body.error.flatten() });
    const ctx = await context(auth, reply);
    if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("project.manage_team")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const { data, error } = await auth.supabase.from("project_team_members").update({ ...body.data, updated_at: new Date().toISOString(), updated_by: auth.user.id }).eq("id", params.data.memberId).eq("project_id", params.data.projectId).eq("organization_id", ctx.data.organization.id).is("deleted_at", null).select().maybeSingle();
    if (error) return reply.code(500).send({ error: "PROJECT_TEAM_UPDATE_FAILED" });
    if (!data) return reply.code(404).send({ error: "PROJECT_TEAM_MEMBER_NOT_FOUND" });
    return reply.send({ data });
  });

  app.delete("/api/v1/projects/:projectId/team/:memberId", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const params = memberParams.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "INVALID_PROJECT_TEAM_MEMBER_ID" });
    const ctx = await context(auth, reply);
    if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("project.manage_team")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const now = new Date().toISOString();
    const { data, error } = await auth.supabase.from("project_team_members").update({ deleted_at: now, deleted_by: auth.user.id, ends_at: now.slice(0, 10), updated_at: now, updated_by: auth.user.id }).eq("id", params.data.memberId).eq("project_id", params.data.projectId).eq("organization_id", ctx.data.organization.id).is("deleted_at", null).select("id").maybeSingle();
    if (error) return reply.code(500).send({ error: "PROJECT_TEAM_DELETE_FAILED" });
    if (!data) return reply.code(404).send({ error: "PROJECT_TEAM_MEMBER_NOT_FOUND" });
    return reply.send({ data: { id: data.id, deleted: true } });
  });
}
