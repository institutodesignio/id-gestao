import type { FastifyInstance } from "fastify";
import { createSystemSupabaseClient } from "../plugins/supabase.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    ok: true,
    service: "id-gestao-api",
    timestamp: new Date().toISOString(),
  }));

  app.get("/ready", async (_request, reply) => {
    const supabase = createSystemSupabaseClient();
    const { error } = await supabase.from("organizations").select("id", { head: true, count: "exact" }).limit(1);
    if (error) return reply.code(503).send({ ok: false, service: "id-gestao-api", dependency: "supabase" });
    return reply.send({ ok: true, service: "id-gestao-api", dependency: "supabase", timestamp: new Date().toISOString() });
  });
}
