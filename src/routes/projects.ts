import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { requireAuthenticatedUser } from "../auth.js";

import {
  createProjectSchema,
  updateProjectSchema,
} from "../schemas/projects.js";

const querySchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1),

  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),

  search: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .optional(),

  status: z
    .enum([
      "PLANNING",
      "APPROVED",
      "ACTIVE",
      "SUSPENDED",
      "COMPLETED",
      "CANCELLED",
      "ARCHIVED",
    ])
    .optional(),

  has_clinical_care: z.coerce
    .boolean()
    .optional(),
});

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const contextSchema = z.object({
  organization: z.object({
    id: z.string().uuid(),
  }),
  permissions: z.array(z.string()),
});

function normalizeSearch(
  value: string
): string {
  return value
    .replace(/[%_]/g, "")
    .replace(/[(),]/g, " ")
    .trim();
}

export async function projectsRoutes(
  app: FastifyInstance
) {
  // ==========================================================
  // GET /api/v1/projects
  // ==========================================================

  app.get(
    "/api/v1/projects",
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

      const parsedQuery =
        querySchema.safeParse(
          request.query
        );

      if (!parsedQuery.success) {
        return reply
          .code(400)
          .send({
            error:
              "INVALID_QUERY_PARAMETERS",
            details:
              parsedQuery.error.flatten(),
          });
      }

      const {
        page,
        limit,
        search,
        status,
        has_clinical_care,
      } = parsedQuery.data;

      const {
        data: contextData,
        error: contextError,
      } = await auth.supabase.rpc(
        "current_user_context"
      );

      if (contextError) {
        return reply
          .code(403)
          .send({
            error:
              "USER_CONTEXT_UNAVAILABLE",
          });
      }

      const parsedContext =
        contextSchema.safeParse(
          contextData
        );

      if (!parsedContext.success) {
        return reply
          .code(403)
          .send({
            error:
              "INVALID_USER_CONTEXT",
          });
      }

      const {
        organization,
        permissions,
      } = parsedContext.data;

      if (
        !permissions.includes(
          "project.read"
        )
      ) {
        return reply
          .code(403)
          .send({
            error:
              "PERMISSION_DENIED",
          });
      }

      const offset =
        (page - 1) * limit;

      const end =
        offset + limit - 1;

      let query =
        auth.supabase
          .from("projects")
          .select(
            `
              id,
              name,
              slug,
              short_name,
              description,
              status,
              starts_at,
              ends_at,
              has_clinical_care,
              created_at,
              updated_at
            `,
            {
              count: "exact",
            }
          )
          .eq(
            "organization_id",
            organization.id
          )
          .is(
            "deleted_at",
            null
          );

      if (status) {
        query = query.eq(
          "status",
          status
        );
      }

      if (
        has_clinical_care !==
        undefined
      ) {
        query = query.eq(
          "has_clinical_care",
          has_clinical_care
        );
      }

      if (search) {
        const normalizedSearch =
          normalizeSearch(search);

        if (
          normalizedSearch.length > 0
        ) {
          query = query.or(
            [
              `name.ilike.%${normalizedSearch}%`,
              `slug.ilike.%${normalizedSearch}%`,
              `short_name.ilike.%${normalizedSearch}%`,
            ].join(",")
          );
        }
      }

      const {
        data,
        error,
        count,
      } = await query
        .order(
          "name",
          {
            ascending: true,
          }
        )
        .range(
          offset,
          end
        );

      if (error) {
        return reply
          .code(500)
          .send({
            error:
              "PROJECTS_LIST_FAILED",
          });
      }

      const total =
        count ?? 0;

      const totalPages =
        total === 0
          ? 0
          : Math.ceil(
              total / limit
            );

      return reply.send({
        data:
          data ?? [],

        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasPreviousPage:
            page > 1,
          hasNextPage:
            page < totalPages,
        },

        filters: {
          search:
            search ?? null,
          status:
            status ?? null,
          has_clinical_care:
            has_clinical_care ??
            null,
        },
      });
    }
  );

  // ==========================================================
  // GET /api/v1/projects/:id
  // ==========================================================

  app.get(
    "/api/v1/projects/:id",
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
        paramsSchema.safeParse(
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

      const {
        data: contextData,
        error: contextError,
      } = await auth.supabase.rpc(
        "current_user_context"
      );

      if (contextError) {
        return reply
          .code(403)
          .send({
            error:
              "USER_CONTEXT_UNAVAILABLE",
          });
      }

      const parsedContext =
        contextSchema.safeParse(
          contextData
        );

      if (!parsedContext.success) {
        return reply
          .code(403)
          .send({
            error:
              "INVALID_USER_CONTEXT",
          });
      }

      const {
        organization,
        permissions,
      } = parsedContext.data;

      if (
        !permissions.includes(
          "project.read"
        )
      ) {
        return reply
          .code(403)
          .send({
            error:
              "PERMISSION_DENIED",
          });
      }

      const { id } =
        parsedParams.data;

      const {
        data,
        error,
      } = await auth.supabase
        .from("projects")
        .select(`
          id,
          name,
          slug,
          short_name,
          description,
          status,
          starts_at,
          ends_at,
          has_clinical_care,
          created_at,
          updated_at
        `)
        .eq(
          "id",
          id
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

      if (error) {
        return reply
          .code(500)
          .send({
            error:
              "PROJECT_READ_FAILED",
          });
      }

      if (!data) {
        return reply
          .code(404)
          .send({
            error:
              "PROJECT_NOT_FOUND",
          });
      }

      return reply.send({
        data,
      });
    }
  );

  // ==========================================================
  // POST /api/v1/projects
  // ==========================================================

  app.post(
    "/api/v1/projects",
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

      const parsedBody =
        createProjectSchema.safeParse(
          request.body
        );

      if (!parsedBody.success) {
        return reply
          .code(400)
          .send({
            error:
              "INVALID_PROJECT_DATA",
            details:
              parsedBody.error.flatten(),
          });
      }

      const {
        data: contextData,
        error: contextError,
      } = await auth.supabase.rpc(
        "current_user_context"
      );

      if (contextError) {
        return reply
          .code(403)
          .send({
            error:
              "USER_CONTEXT_UNAVAILABLE",
          });
      }

      const parsedContext =
        contextSchema.safeParse(
          contextData
        );

      if (!parsedContext.success) {
        return reply
          .code(403)
          .send({
            error:
              "INVALID_USER_CONTEXT",
          });
      }

      const {
        organization,
        permissions,
      } = parsedContext.data;

      if (
        !permissions.includes(
          "project.create"
        )
      ) {
        return reply
          .code(403)
          .send({
            error:
              "PERMISSION_DENIED",
          });
      }

      const payload =
        parsedBody.data;

      const {
        data,
        error,
      } = await auth.supabase
        .from("projects")
        .insert({
          organization_id:
            organization.id,

          name:
            payload.name,

          slug:
            payload.slug,

          short_name:
            payload.short_name ??
            null,

          description:
            payload.description ??
            null,

          status:
            payload.status ??
            "PLANNING",

          starts_at:
            payload.starts_at ??
            null,

          ends_at:
            payload.ends_at ??
            null,

          has_clinical_care:
            payload.has_clinical_care ??
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
                "PROJECT_CONFLICT",
            });
        }

        return reply
          .code(500)
          .send({
            error:
              "PROJECT_CREATE_FAILED",
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
  // PATCH /api/v1/projects/:id
  // ==========================================================

  app.patch(
    "/api/v1/projects/:id",
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
        paramsSchema.safeParse(
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
        updateProjectSchema.safeParse(
          request.body
        );

      if (!parsedBody.success) {
        return reply
          .code(400)
          .send({
            error:
              "INVALID_PROJECT_DATA",
            details:
              parsedBody.error.flatten(),
          });
      }

      const {
        data: contextData,
        error: contextError,
      } = await auth.supabase.rpc(
        "current_user_context"
      );

      if (contextError) {
        return reply
          .code(403)
          .send({
            error:
              "USER_CONTEXT_UNAVAILABLE",
          });
      }

      const parsedContext =
        contextSchema.safeParse(
          contextData
        );

      if (!parsedContext.success) {
        return reply
          .code(403)
          .send({
            error:
              "INVALID_USER_CONTEXT",
          });
      }

      const {
        organization,
        permissions,
      } = parsedContext.data;

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

      const { id } =
        parsedParams.data;

      const {
        data: existingProject,
        error: existingError,
      } = await auth.supabase
        .from("projects")
        .select("id")
        .eq(
          "id",
          id
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

      if (existingError) {
        return reply
          .code(500)
          .send({
            error:
              "PROJECT_READ_FAILED",
          });
      }

      if (!existingProject) {
        return reply
          .code(404)
          .send({
            error:
              "PROJECT_NOT_FOUND",
          });
      }

      const {
        data,
        error,
      } = await auth.supabase
        .from("projects")
        .update({
          ...parsedBody.data,
          updated_at:
            new Date().toISOString(),
          updated_by:
            auth.user.id,
        })
        .eq(
          "id",
          id
        )
        .eq(
          "organization_id",
          organization.id
        )
        .is(
          "deleted_at",
          null
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
                "PROJECT_CONFLICT",
            });
        }

        return reply
          .code(500)
          .send({
            error:
              "PROJECT_UPDATE_FAILED",
          });
      }

      return reply.send({
        data,
      });
    }
  );

  // ==========================================================
  // DELETE /api/v1/projects/:id
  // SOFT DELETE
  // ==========================================================

  app.delete(
    "/api/v1/projects/:id",
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
        paramsSchema.safeParse(
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

      const {
        data: contextData,
        error: contextError,
      } = await auth.supabase.rpc(
        "current_user_context"
      );

      if (contextError) {
        return reply
          .code(403)
          .send({
            error:
              "USER_CONTEXT_UNAVAILABLE",
          });
      }

      const parsedContext =
        contextSchema.safeParse(
          contextData
        );

      if (!parsedContext.success) {
        return reply
          .code(403)
          .send({
            error:
              "INVALID_USER_CONTEXT",
          });
      }

      const {
        permissions,
      } = parsedContext.data;

      if (
        !permissions.includes(
          "project.delete"
        )
      ) {
        return reply
          .code(403)
          .send({
            error:
              "PERMISSION_DENIED",
          });
      }

      const { id } =
        parsedParams.data;

      const {
        data,
        error,
      } = await auth.supabase.rpc(
        "soft_delete_project",
        {
          p_project_id: id,
        }
      );

      if (error) {
        request.log.error(
          {
            code: error.code,
            details: error.details,
            hint: error.hint,
            message: error.message,
          },
          "Failed to soft delete project"
        );

        if (
          error.code === "P0002" ||
          error.message?.includes(
            "PROJECT_NOT_FOUND"
          )
        ) {
          return reply
            .code(404)
            .send({
              error:
                "PROJECT_NOT_FOUND",
            });
        }

        if (
          error.code === "42501" ||
          error.message?.includes(
            "PERMISSION_DENIED"
          ) ||
          error.message?.includes(
            "PROJECT_SCOPE_DENIED"
          )
        ) {
          return reply
            .code(403)
            .send({
              error:
                "PERMISSION_DENIED",
            });
        }

        return reply
          .code(500)
          .send({
            error:
              "PROJECT_DELETE_FAILED",
          });
      }

      return reply.send({
        data,
      });
    }
  );
}