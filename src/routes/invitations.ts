import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuthenticatedUser } from "../auth.js";
import { config } from "../config.js";
import { createAdminSupabaseClient } from "../plugins/supabase.js";
import { inviteMemberSchema } from "../schemas/invitations.js";

const contextSchema = z.object({
  organization: z.object({ id: z.string().uuid() }),
  permissions: z.array(z.string()),
});

export async function invitationRoutes(app: FastifyInstance) {
  app.post("/api/v1/members/invite", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });

    const body = inviteMemberSchema.safeParse(request.body);
    if (!body.success) {
      return reply
        .code(400)
        .send({ error: "INVALID_INVITATION_DATA", details: body.error.flatten() });
    }

    const { data: rawContext, error: contextError } = await auth.supabase.rpc(
      "current_user_context",
    );
    const context = contextSchema.safeParse(rawContext);
    if (contextError || !context.success) {
      return reply.code(403).send({ error: "USER_CONTEXT_UNAVAILABLE" });
    }
    if (
      !context.data.permissions.includes("user.invite") ||
      !context.data.permissions.includes("user.manage_roles")
    ) {
      return reply.code(403).send({ error: "PERMISSION_DENIED" });
    }

    const admin = createAdminSupabaseClient();
    if (!admin) return reply.code(503).send({ error: "ADMIN_CLIENT_NOT_CONFIGURED" });

    const { data: role, error: roleError } = await admin
      .from("roles")
      .select("id,code")
      .eq("id", body.data.role_id)
      .or(`organization_id.is.null,organization_id.eq.${context.data.organization.id}`)
      .is("deleted_at", null)
      .maybeSingle();
    if (roleError || !role) return reply.code(404).send({ error: "ROLE_NOT_FOUND" });
    if (
      role.code === "ADMINISTRATOR" &&
      !context.data.permissions.includes("role.manage")
    ) {
      return reply.code(403).send({ error: "ROLE_ASSIGNMENT_FORBIDDEN" });
    }

    const redirectTo = config.APP_PUBLIC_URL
      ? `${config.APP_PUBLIC_URL.replace(/\/$/, "")}/auth/callback`
      : undefined;
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      body.data.email,
      { redirectTo, data: { full_name: body.data.full_name } },
    );
    if (inviteError || !invited.user) {
      if (inviteError?.message?.toLowerCase().includes("already")) {
        return reply.code(409).send({ error: "USER_ALREADY_EXISTS" });
      }
      return reply.code(500).send({ error: "USER_INVITATION_FAILED" });
    }

    const userId = invited.user.id;
    const personId = crypto.randomUUID();
    const profileId = crypto.randomUUID();
    const memberId = crypto.randomUUID();
    const { error: provisionError } = await admin.rpc("provision_invited_member", {
      p_organization_id: context.data.organization.id,
      p_auth_user_id: userId,
      p_email: body.data.email,
      p_full_name: body.data.full_name,
      p_person_id: personId,
      p_profile_id: profileId,
      p_member_id: memberId,
      p_role_id: body.data.role_id,
      p_actor_id: auth.user.id,
      p_member_type: body.data.member_type,
      p_job_title: body.data.job_title,
      p_professional_council: body.data.professional_council ?? null,
      p_professional_registration: body.data.professional_registration ?? null,
    });
    if (provisionError) {
      await admin.auth.admin.deleteUser(userId);
      request.log.error({ code: provisionError.code }, "Invitation provisioning rolled back");
      return reply.code(500).send({ error: "MEMBER_PROVISIONING_FAILED" });
    }

    return reply.code(201).send({
      data: {
        auth_user_id: userId,
        person_id: personId,
        user_profile_id: profileId,
        member_id: memberId,
        email: body.data.email,
        invited: true,
      },
    });
  });
}
