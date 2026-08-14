import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuthenticatedUser } from "../auth.js";
import { createClinicalCaseSchema, createClinicalSessionSchema, updateClinicalCaseSchema, updateClinicalSessionSchema } from "../schemas/clinical-supervision.js";

const idParams = z.object({ id: z.string().uuid() });
const sessionParams = z.object({ id: z.string().uuid(), sessionId: z.string().uuid() });
const querySchema = z.object({ status: z.enum(["OPEN", "IN_FOLLOW_UP", "PAUSED", "CLOSED"]).optional(), project_id: z.string().uuid().optional() });
const contextSchema = z.object({ organization: z.object({ id: z.string().uuid() }), permissions: z.array(z.string()) });
async function context(auth: any, reply: FastifyReply) {
  const { data, error } = await auth.supabase.rpc("current_user_context");
  const parsed = contextSchema.safeParse(data);
  if (error || !parsed.success) return { ok: false as const, response: reply.code(403).send({ error: "USER_CONTEXT_UNAVAILABLE" }) };
  return { ok: true as const, data: parsed.data };
}

export async function clinicalSupervisionRoutes(app: FastifyInstance) {
  app.get("/api/v1/clinical-supervision/cases", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const query = querySchema.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "INVALID_QUERY_PARAMETERS" });
    const ctx = await context(auth, reply);
    if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("clinical_supervision.read")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    let db = auth.supabase.from("clinical_supervision_cases").select(`id, project_id, beneficiary_person_id, assigned_technical_person_id, status, priority, summary, opened_at, closed_at, created_at, updated_at`).eq("organization_id", ctx.data.organization.id).is("deleted_at", null);
    if (query.data.status) db = db.eq("status", query.data.status);
    if (query.data.project_id) db = db.eq("project_id", query.data.project_id);
    const { data, error } = await db.order("opened_at", { ascending: false });
    if (error) return reply.code(500).send({ error: "CLINICAL_CASES_LIST_FAILED" });
    return reply.send({ data: data ?? [], filters: { status: query.data.status ?? null, project_id: query.data.project_id ?? null } });
  });

  app.post("/api/v1/clinical-supervision/cases", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const body = createClinicalCaseSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "INVALID_CLINICAL_CASE_DATA", details: body.error.flatten() });
    const ctx = await context(auth, reply);
    if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("clinical_supervision.manage")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const { data, error } = await auth.supabase.from("clinical_supervision_cases").insert({ organization_id: ctx.data.organization.id, ...body.data, assigned_technical_person_id: body.data.assigned_technical_person_id ?? null, priority: body.data.priority ?? "NORMAL", created_by: auth.user.id, updated_by: auth.user.id }).select().single();
    if (error?.code === "23505") return reply.code(409).send({ error: "CLINICAL_CASE_ALREADY_OPEN" });
    if (error) return reply.code(500).send({ error: "CLINICAL_CASE_CREATE_FAILED" });
    return reply.code(201).send({ data });
  });

  app.patch("/api/v1/clinical-supervision/cases/:id", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const params = idParams.safeParse(request.params); const body = updateClinicalCaseSchema.safeParse(request.body);
    if (!params.success) return reply.code(400).send({ error: "INVALID_CLINICAL_CASE_ID" });
    if (!body.success) return reply.code(400).send({ error: "INVALID_CLINICAL_CASE_DATA", details: body.error.flatten() });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("clinical_supervision.manage")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const closed = body.data.status === "CLOSED" ? new Date().toISOString() : body.data.status ? null : undefined;
    const update = { ...body.data, ...(closed !== undefined ? { closed_at: closed } : {}), updated_at: new Date().toISOString(), updated_by: auth.user.id };
    const { data, error } = await auth.supabase.from("clinical_supervision_cases").update(update).eq("id", params.data.id).eq("organization_id", ctx.data.organization.id).is("deleted_at", null).select().maybeSingle();
    if (error) return reply.code(500).send({ error: "CLINICAL_CASE_UPDATE_FAILED" });
    if (!data) return reply.code(404).send({ error: "CLINICAL_CASE_NOT_FOUND" });
    return reply.send({ data });
  });

  app.get("/api/v1/clinical-supervision/cases/:id/sessions", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request); if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const params = idParams.safeParse(request.params); if (!params.success) return reply.code(400).send({ error: "INVALID_CLINICAL_CASE_ID" });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("clinical_supervision.read")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const { data, error } = await auth.supabase.from("clinical_supervision_sessions").select("id, case_id, supervisor_person_id, scheduled_at, status, notes, created_at, updated_at").eq("organization_id", ctx.data.organization.id).eq("case_id", params.data.id).order("scheduled_at", { ascending: false });
    if (error) return reply.code(500).send({ error: "CLINICAL_SESSIONS_LIST_FAILED" });
    return reply.send({ data: data ?? [] });
  });

  app.post("/api/v1/clinical-supervision/cases/:id/sessions", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request); if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const params = idParams.safeParse(request.params); const body = createClinicalSessionSchema.safeParse(request.body);
    if (!params.success) return reply.code(400).send({ error: "INVALID_CLINICAL_CASE_ID" });
    if (!body.success) return reply.code(400).send({ error: "INVALID_CLINICAL_SESSION_DATA", details: body.error.flatten() });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("clinical_supervision.manage")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const { data, error } = await auth.supabase.from("clinical_supervision_sessions").insert({ organization_id: ctx.data.organization.id, case_id: params.data.id, ...body.data, notes: body.data.notes ?? null, created_by: auth.user.id, updated_by: auth.user.id }).select().single();
    if (error) return reply.code(500).send({ error: "CLINICAL_SESSION_CREATE_FAILED" });
    return reply.code(201).send({ data });
  });

  app.patch("/api/v1/clinical-supervision/cases/:id/sessions/:sessionId", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request); if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const params = sessionParams.safeParse(request.params); const body = updateClinicalSessionSchema.safeParse(request.body);
    if (!params.success) return reply.code(400).send({ error: "INVALID_CLINICAL_SESSION_ID" });
    if (!body.success) return reply.code(400).send({ error: "INVALID_CLINICAL_SESSION_DATA", details: body.error.flatten() });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("clinical_supervision.manage")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const { data, error } = await auth.supabase.from("clinical_supervision_sessions").update({ ...body.data, updated_at: new Date().toISOString(), updated_by: auth.user.id }).eq("id", params.data.sessionId).eq("case_id", params.data.id).eq("organization_id", ctx.data.organization.id).select().maybeSingle();
    if (error) return reply.code(500).send({ error: "CLINICAL_SESSION_UPDATE_FAILED" });
    if (!data) return reply.code(404).send({ error: "CLINICAL_SESSION_NOT_FOUND" });
    return reply.send({ data });
  });
}
