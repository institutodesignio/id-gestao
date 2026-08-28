import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuthenticatedUser } from "../auth.js";

const contextSchema = z.object({
  organization: z.object({ id: z.string().uuid() }),
  permissions: z.array(z.string()),
});

export async function rolesRoutes(app: FastifyInstance) {
  app.get("/api/v1/roles", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) {
      return reply.code(auth.statusCode).send({ error: auth.error });
    }

    const { data: rawContext, error: contextError } = await auth.supabase.rpc(
      "current_user_context",
    );
    const context = contextSchema.safeParse(rawContext);
    if (contextError || !context.success) {
      return reply.code(403).send({ error: "USER_CONTEXT_UNAVAILABLE" });
    }
    if (!context.data.permissions.includes("user.manage_roles")) {
      return reply.code(403).send({ error: "PERMISSION_DENIED" });
    }

    const { data, error } = await auth.supabase
      .from("roles")
      .select("id,code,name,description,organization_id,status")
      .eq("status", "ACTIVE")
      .is("deleted_at", null)
      .or(`organization_id.is.null,organization_id.eq.${context.data.organization.id}`)
      .order("name", { ascending: true });

    if (error) {
      request.log.error({ code: error.code }, "Failed to list institutional roles");
      return reply.code(500).send({ error: "ROLES_LIST_FAILED" });
    }

    return reply.send({ data: data ?? [] });
  });
}
