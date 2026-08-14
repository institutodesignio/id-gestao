import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { requireAuthenticatedUser } from "../auth.js";

import {
  createProjectUnitSchema,
  updateProjectUnitSchema,
} from "../schemas/project-units.js";

const projectParamsSchema = z.object({
  projectId: z.string().uuid(),
});

const projectUnitParamsSchema = z.object({
  projectId: z.string().uuid(),
  projectUnitId: z.string().uuid(),
});

const contextSchema = z.object({
  organization: z.object({
    id: z.string().uuid(),
  }),

  permissions: z.array(z.string()),
});

async function loadContext(
  auth: any,
  reply: any
) {
  const {
    data: contextData,
    error: contextError,
  } = await auth.supabase.rpc(
    "current_user_context"
  );

  if (contextError) {
    return {
      ok: false as const,
      response: reply
        .code(403)
        .send({
          error:
            "USER_CONTEXT_UNAVAILABLE",
        }),
    };
  }

  const parsedContext =
    contextSchema.safeParse(
      contextData
    );

  if (!parsedContext.success) {
    return {
      ok: false as const,
      response: reply
        .code(403)
        .send({
          error:
            "INVALID_USER_CONTEXT",
        }),
    };
  }

  return {
    ok: true as const,
    context:
      parsedContext.data,
  };
}

export async function projectUnitsRoutes(
  app: FastifyInstance
) {
  // ==========================================================
  // GET /api/v1/projects/:projectId/units
  // ==========================================================

  app.get(
    "/api/v1/projects/:projectId/units",
    async (request, reply) => {
      const auth = await requireAuthenticatedUser(request);

      if (!auth.ok) {
        return reply.code(auth.statusCode).send({ error: auth.error });
      }

      const parsedParams = projectParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.code(400).send({ error: "INVALID_PROJECT_ID" });
      }

      const contextResult = await loadContext(auth, reply);

      if (!contextResult.ok) {
        return contextResult.response;
      }

      const { organization, permissions } = contextResult.context;

      if (!permissions.includes("project.read")) {
        return reply.code(403).send({ error: "PERMISSION_DENIED" });
      }

      const { projectId } = parsedParams.data;
      const { data: project, error: projectError } = await auth.supabase
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .eq("organization_id", organization.id)
        .is("deleted_at", null)
        .maybeSingle();

      if (projectError) {
        return reply.code(500).send({ error: "PROJECT_READ_FAILED" });
      }

      if (!project) {
        return reply.code(404).send({ error: "PROJECT_NOT_FOUND" });
      }

      const { data, error } = await auth.supabase
        .from("project_units")
        .select(`
          id,
          project_id,
          unit_id,
          starts_at,
          ends_at,
          is_primary,
          created_at,
          updated_at,
          unit:units!project_units_unit_fk (
            id,
            name,
            slug,
            status,
            is_headquarters
          )
        `)
        .eq("organization_id", organization.id)
        .eq("project_id", projectId)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true });

      if (error) {
        return reply.code(500).send({ error: "PROJECT_UNITS_LIST_FAILED" });
      }

      return reply.send({ data: data ?? [] });
    }
  );

  // ==========================================================
  // POST /api/v1/projects/:projectId/units
  // ==========================================================

  app.post(
    "/api/v1/projects/:projectId/units",
    async (request, reply) => {
      const auth =
        await requireAuthenticatedUser(
          request
        );

      if (!auth.ok) {
        return reply
          .code(auth.statusCode)
          .send({
            error: auth.error,
          });
      }

      const parsedParams =
        projectParamsSchema.safeParse(
          request.params
        );

      if (!parsedParams.success) {
        return reply
          .code(400)
          .send({
            error:
              "INVALID_PROJECT_ID",
          });
      }

      const parsedBody =
        createProjectUnitSchema.safeParse(
          request.body
        );

      if (!parsedBody.success) {
        return reply
          .code(400)
          .send({
            error:
              "INVALID_PROJECT_UNIT_DATA",
            details:
              parsedBody.error.flatten(),
          });
      }

      const contextResult =
        await loadContext(
          auth,
          reply
        );

      if (!contextResult.ok) {
        return contextResult.response;
      }

      const {
        organization,
        permissions,
      } = contextResult.context;

      if (
        !permissions.includes(
          "project.update"
        ) ||
        !permissions.includes(
          "unit.read"
        )
      ) {
        return reply
          .code(403)
          .send({
            error:
              "PERMISSION_DENIED",
          });
      }

      const {
        projectId,
      } = parsedParams.data;

      const payload =
        parsedBody.data;

      const {
        data: project,
        error: projectError,
      } = await auth.supabase
        .from("projects")
        .select("id")
        .eq(
          "id",
          projectId
        )
        .eq(
          "organization_id",
          organization.id
        )
        .is(
          "deleted_at",
          null
        )
        .maybeSingle();

      if (projectError) {
        return reply
          .code(500)
          .send({
            error:
              "PROJECT_READ_FAILED",
          });
      }

      if (!project) {
        return reply
          .code(404)
          .send({
            error:
              "PROJECT_NOT_FOUND",
          });
      }

      const {
        data: unit,
        error: unitError,
      } = await auth.supabase
        .from("units")
        .select("id")
        .eq(
          "id",
          payload.unit_id
        )
        .eq(
          "organization_id",
          organization.id
        )
        .is(
          "deleted_at",
          null
        )
        .maybeSingle();

      if (unitError) {
        return reply
          .code(500)
          .send({
            error:
              "UNIT_READ_FAILED",
          });
      }

      if (!unit) {
        return reply
          .code(404)
          .send({
            error:
              "UNIT_NOT_FOUND",
          });
      }

      const {
        data,
        error,
      } = await auth.supabase
        .from("project_units")
        .insert({
          organization_id:
            organization.id,

          project_id:
            projectId,

          unit_id:
            payload.unit_id,

          starts_at:
            payload.starts_at ??
            null,

          ends_at:
            payload.ends_at ??
            null,

          is_primary:
            payload.is_primary ??
            false,

          created_by:
            auth.user.id,

          updated_by:
            auth.user.id,
        })
        .select()
        .single();

      if (error) {
        if (
          error.code ===
          "23505"
        ) {
          return reply
            .code(409)
            .send({
              error:
                "PROJECT_UNIT_CONFLICT",
            });
        }

        return reply
          .code(500)
          .send({
            error:
              "PROJECT_UNIT_CREATE_FAILED",
          });
      }

      return reply
        .code(201)
        .send({
          data,
        });
    }
  );

  // ==========================================================
  // PATCH /api/v1/projects/:projectId/units/:projectUnitId
  // ==========================================================

  app.patch(
    "/api/v1/projects/:projectId/units/:projectUnitId",
    async (request, reply) => {
      const auth =
        await requireAuthenticatedUser(
          request
        );

      if (!auth.ok) {
        return reply
          .code(auth.statusCode)
          .send({
            error: auth.error,
          });
      }

      const parsedParams =
        projectUnitParamsSchema.safeParse(
          request.params
        );

      if (!parsedParams.success) {
        return reply
          .code(400)
          .send({
            error:
              "INVALID_PROJECT_UNIT_ID",
          });
      }

      const parsedBody =
        updateProjectUnitSchema.safeParse(
          request.body
        );

      if (!parsedBody.success) {
        return reply
          .code(400)
          .send({
            error:
              "INVALID_PROJECT_UNIT_DATA",
            details:
              parsedBody.error.flatten(),
          });
      }

      const contextResult =
        await loadContext(
          auth,
          reply
        );

      if (!contextResult.ok) {
        return contextResult.response;
      }

      const {
        organization,
        permissions,
      } = contextResult.context;

      if (
        !permissions.includes(
          "project.update"
        )
      ) {
        return reply
          .code(403)
          .send({
            error:
              "PERMISSION_DENIED",
          });
      }

      const {
        projectId,
        projectUnitId,
      } = parsedParams.data;

      const {
        data: existing,
        error: existingError,
      } = await auth.supabase
        .from("project_units")
        .select(`
          id,
          project_id,
          unit_id,
          starts_at,
          ends_at,
          is_primary
        `)
        .eq(
          "id",
          projectUnitId
        )
        .eq(
          "project_id",
          projectId
        )
        .eq(
          "organization_id",
          organization.id
        )
        .maybeSingle();

      if (existingError) {
        return reply
          .code(500)
          .send({
            error:
              "PROJECT_UNIT_READ_FAILED",
          });
      }

      if (!existing) {
        return reply
          .code(404)
          .send({
            error:
              "PROJECT_UNIT_NOT_FOUND",
          });
      }

      const startsAt =
        parsedBody.data
          .starts_at !==
        undefined
          ? parsedBody.data
              .starts_at
          : existing.starts_at;

      const endsAt =
        parsedBody.data
          .ends_at !==
        undefined
          ? parsedBody.data
              .ends_at
          : existing.ends_at;

      if (
        startsAt &&
        endsAt &&
        endsAt < startsAt
      ) {
        return reply
          .code(400)
          .send({
            error:
              "INVALID_PROJECT_UNIT_DATA",
            details: {
              formErrors: [],
              fieldErrors: {
                ends_at: [
                  "ends_at cannot be before starts_at",
                ],
              },
            },
          });
      }

      const {
        data,
        error,
      } = await auth.supabase
        .from("project_units")
        .update({
          ...parsedBody.data,

          updated_at:
            new Date().toISOString(),

          updated_by:
            auth.user.id,
        })
        .eq(
          "id",
          projectUnitId
        )
        .eq(
          "project_id",
          projectId
        )
        .eq(
          "organization_id",
          organization.id
        )
        .select()
        .single();

      if (error) {
        if (
          error.code ===
          "23505"
        ) {
          return reply
            .code(409)
            .send({
              error:
                "PROJECT_UNIT_CONFLICT",
            });
        }

        return reply
          .code(500)
          .send({
            error:
              "PROJECT_UNIT_UPDATE_FAILED",
          });
      }

      return reply.send({
        data,
      });
    }
  );

  // ==========================================================
  // DELETE /api/v1/projects/:projectId/units/:projectUnitId
  // ==========================================================

  app.delete(
    "/api/v1/projects/:projectId/units/:projectUnitId",
    async (request, reply) => {
      const auth =
        await requireAuthenticatedUser(
          request
        );

      if (!auth.ok) {
        return reply
          .code(auth.statusCode)
          .send({
            error: auth.error,
          });
      }

      const parsedParams =
        projectUnitParamsSchema.safeParse(
          request.params
        );

      if (!parsedParams.success) {
        return reply
          .code(400)
          .send({
            error:
              "INVALID_PROJECT_UNIT_ID",
          });
      }

      const contextResult =
        await loadContext(
          auth,
          reply
        );

      if (!contextResult.ok) {
        return contextResult.response;
      }

      const {
        organization,
        permissions,
      } = contextResult.context;

      if (
        !permissions.includes(
          "project.update"
        )
      ) {
        return reply
          .code(403)
          .send({
            error:
              "PERMISSION_DENIED",
          });
      }

      const {
        projectId,
        projectUnitId,
      } = parsedParams.data;

      const {
        data: existing,
        error: existingError,
      } = await auth.supabase
        .from("project_units")
        .select(`
          id,
          is_primary
        `)
        .eq(
          "id",
          projectUnitId
        )
        .eq(
          "project_id",
          projectId
        )
        .eq(
          "organization_id",
          organization.id
        )
        .maybeSingle();

      if (existingError) {
        return reply
          .code(500)
          .send({
            error:
              "PROJECT_UNIT_READ_FAILED",
          });
      }

      if (!existing) {
        return reply
          .code(404)
          .send({
            error:
              "PROJECT_UNIT_NOT_FOUND",
          });
      }

      const {
        error,
      } = await auth.supabase
        .from("project_units")
        .delete()
        .eq(
          "id",
          projectUnitId
        )
        .eq(
          "project_id",
          projectId
        )
        .eq(
          "organization_id",
          organization.id
        );

      if (error) {
        return reply
          .code(500)
          .send({
            error:
              "PROJECT_UNIT_DELETE_FAILED",
          });
      }

      return reply.send({
        data: {
          id:
            projectUnitId,
          deleted:
            true,
          was_primary:
            existing.is_primary,
        },
      });
    }
  );
}
