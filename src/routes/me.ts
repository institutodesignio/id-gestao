import type { FastifyInstance } from "fastify";
import { requireAuthenticatedUser } from "../auth.js";

export async function meRoutes(app: FastifyInstance) {
  app.get("/api/v1/me", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request);

    if (!auth.ok) {
      return reply.code(auth.statusCode).send({ error: auth.error });
    }

    const { data, error } = await auth.supabase.rpc("current_user_context");

    if (error) {
      request.log.error(
        { code: error.code, details: error.details, hint: error.hint },
        "Failed to load current user context"
      );
      return reply.code(403).send({ error: "USER_CONTEXT_UNAVAILABLE" });
    }

    return reply.send(data);
  });
}
