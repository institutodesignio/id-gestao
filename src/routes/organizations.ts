import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuthenticatedUser } from "../auth.js";
import { updateOrganizationSchema } from "../schemas/organizations.js";

const contextSchema = z.object({
  organization: z.object({ id: z.string().uuid() }),
  permissions: z.array(z.string()),
});

async function context(request: Parameters<typeof requireAuthenticatedUser>[0]) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return { ok: false as const, status: auth.statusCode, error: auth.error };
  const result = await auth.supabase.rpc("current_user_context");
  const parsed = contextSchema.safeParse(result.data);
  if (result.error || !parsed.success) return { ok: false as const, status: 403, error: "USER_CONTEXT_UNAVAILABLE" };
  return { ok: true as const, auth, context: parsed.data };
}

const fields = "id, legal_name, trade_name, slug, cnpj, email, phone, website, status, created_at, updated_at";

export async function organizationsRoutes(app: FastifyInstance) {
  app.get("/api/v1/organization", async (request, reply) => {
    const current = await context(request);
    if (!current.ok) return reply.code(current.status).send({ error: current.error });
    if (!current.context.permissions.includes("organization.read")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const { data, error } = await current.auth.supabase.from("organizations").select(fields).eq("id", current.context.organization.id).is("deleted_at", null).maybeSingle();
    if (error) return reply.code(500).send({ error: "ORGANIZATION_READ_FAILED" });
    if (!data) return reply.code(404).send({ error: "ORGANIZATION_NOT_FOUND" });
    return reply.send({ data });
  });

  app.patch("/api/v1/organization", async (request, reply) => {
    const body = updateOrganizationSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "INVALID_ORGANIZATION_DATA", details: body.error.flatten() });
    const current = await context(request);
    if (!current.ok) return reply.code(current.status).send({ error: current.error });
    if (!current.context.permissions.includes("organization.update")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const payload = { ...body.data, updated_at: new Date().toISOString(), updated_by: current.auth.user.id };
    const { data, error } = await current.auth.supabase.from("organizations").update(payload).eq("id", current.context.organization.id).is("deleted_at", null).select(fields).maybeSingle();
    if (error?.code === "23505") return reply.code(409).send({ error: "ORGANIZATION_CNPJ_ALREADY_EXISTS" });
    if (error) return reply.code(500).send({ error: "ORGANIZATION_UPDATE_FAILED" });
    if (!data) return reply.code(404).send({ error: "ORGANIZATION_NOT_FOUND" });
    return reply.send({ data });
  });
}
