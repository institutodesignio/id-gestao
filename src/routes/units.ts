import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { requireAuthenticatedUser } from "../auth.js";

import {
  createUnitSchema,
  updateUnitSchema,
} from "../schemas/units.js";

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
      "ACTIVE",
      "INACTIVE",
      "SUSPENDED",
      "ARCHIVED",
    ])
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

export async function unitsRoutes(
  app: FastifyInstance
) {
  // ==========================================================
  // GET /api/v1/units
  // ==========================================================

  app.get(
    "/api/v1/units",
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

      const offset =
        (page - 1) * limit;

      const end =
        offset + limit - 1;

      let query =
        auth.supabase
          .from("units")
          .select(
            `
              id,
              name,
              slug,
              description,
              email,
              phone,
              postal_code,
              street,
              street_number,
              address_complement,
              neighborhood,
              city,
              state_code,
              country_code,
              is_headquarters,
              status,
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
              `city.ilike.%${normalizedSearch}%`,
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
          "is_headquarters",
          {
            ascending: false,
          }
        )
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
        request.log.error(
          {
            code: error.code,
            details: error.details,
            hint: error.hint,
            message: error.message,
          },
          "Failed to list units"
        );

        return reply
          .code(500)
          .send({
            error:
              "UNITS_LIST_FAILED",
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
        },
      });
    }
  );

  // ==========================================================
  // GET /api/v1/units/:id
  // ==========================================================

  app.get(
    "/api/v1/units/:id",
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
              "INVALID_UNIT_ID",
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

      const { id } =
        parsedParams.data;

      const {
        data,
        error,
      } = await auth.supabase
        .from("units")
        .select(`
          id,
          name,
          slug,
          description,
          email,
          phone,
          postal_code,
          street,
          street_number,
          address_complement,
          neighborhood,
          city,
          state_code,
          country_code,
          is_headquarters,
          status,
          created_at,
          updated_at
        `)
        .eq("id", id)
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
        request.log.error(
          {
            code: error.code,
            details: error.details,
            hint: error.hint,
            message: error.message,
          },
          "Failed to read unit"
        );

        return reply
          .code(500)
          .send({
            error:
              "UNIT_READ_FAILED",
          });
      }

      if (!data) {
        return reply
          .code(404)
          .send({
            error:
              "UNIT_NOT_FOUND",
          });
      }

      return reply.send({
        data,
      });
    }
  );

  // ==========================================================
  // POST /api/v1/units
  // ==========================================================

  app.post(
    "/api/v1/units",
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
        createUnitSchema.safeParse(
          request.body
        );

      if (!parsedBody.success) {
        return reply
          .code(400)
          .send({
            error:
              "INVALID_UNIT_DATA",
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
          "unit.create"
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
        .from("units")
        .insert({
          organization_id:
            organization.id,

          name:
            payload.name,

          slug:
            payload.slug,

          description:
            payload.description ??
            null,

          email:
            payload.email ??
            null,

          phone:
            payload.phone ??
            null,

          postal_code:
            payload.postal_code ??
            null,

          street:
            payload.street ??
            null,

          street_number:
            payload.street_number ??
            null,

          address_complement:
            payload.address_complement ??
            null,

          neighborhood:
            payload.neighborhood ??
            null,

          city:
            payload.city ??
            null,

          state_code:
            payload.state_code ??
            null,

          country_code:
            payload.country_code ??
            "BR",

          is_headquarters:
            payload.is_headquarters ??
            false,

          status:
            payload.status ??
            "ACTIVE",

          created_by:
            auth.user.id,

          updated_by:
            auth.user.id,
        })
        .select()
        .single();

      if (error) {
        request.log.error(
          {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          },
          "Failed to create unit"
        );

        if (
          error.code ===
          "23505"
        ) {
          return reply
            .code(409)
            .send({
              error:
                "UNIT_CONFLICT",
            });
        }

        return reply
          .code(500)
          .send({
            error:
              "UNIT_CREATE_FAILED",
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
  // PATCH /api/v1/units/:id
  // ==========================================================

  app.patch(
    "/api/v1/units/:id",
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
              "INVALID_UNIT_ID",
          });
      }

      const parsedBody =
        updateUnitSchema.safeParse(
          request.body
        );

      if (!parsedBody.success) {
        return reply
          .code(400)
          .send({
            error:
              "INVALID_UNIT_DATA",
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
          "unit.update"
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
        data: existingUnit,
        error: existingError,
      } = await auth.supabase
        .from("units")
        .select("id")
        .eq("id", id)
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
        request.log.error(
          {
            code: existingError.code,
            details:
              existingError.details,
            hint: existingError.hint,
            message:
              existingError.message,
          },
          "Failed to check unit before update"
        );

        return reply
          .code(500)
          .send({
            error:
              "UNIT_READ_FAILED",
          });
      }

      if (!existingUnit) {
        return reply
          .code(404)
          .send({
            error:
              "UNIT_NOT_FOUND",
          });
      }

      const update =
        parsedBody.data;

      const {
        data,
        error,
      } = await auth.supabase
        .from("units")
        .update({
          ...update,

          updated_by:
            auth.user.id,

          updated_at:
            new Date().toISOString(),
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
        request.log.error(
          {
            code: error.code,
            details: error.details,
            hint: error.hint,
            message: error.message,
          },
          "Failed to update unit"
        );

        if (
          error.code ===
          "23505"
        ) {
          return reply
            .code(409)
            .send({
              error:
                "UNIT_CONFLICT",
            });
        }

        return reply
          .code(500)
          .send({
            error:
              "UNIT_UPDATE_FAILED",
          });
      }

      return reply.send({
        data,
      });
    }
  );

  // ==========================================================
  // DELETE /api/v1/units/:id
  //
  // SOFT DELETE:
  // não executa DELETE físico.
  // A RPC controla deleted_at/deleted_by e protege a sede.
  // ==========================================================

  app.delete(
    "/api/v1/units/:id",
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
              "INVALID_UNIT_ID",
          });
      }

      const {
        data: contextData,
        error: contextError,
      } = await auth.supabase.rpc(
        "current_user_context"
      );

      if (contextError) {
        request.log.error(
          {
            code: contextError.code,
            details:
              contextError.details,
            hint: contextError.hint,
            message:
              contextError.message,
          },
          "Failed to load context before deleting unit"
        );

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
        request.log.error(
          {
            issues:
              parsedContext.error.issues,
          },
          "Invalid context before deleting unit"
        );

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
          "unit.delete"
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
        "soft_delete_unit",
        {
          p_unit_id: id,
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
          "Failed to soft delete unit"
        );

        if (
          error.code === "P0002" ||
          error.message?.includes(
            "UNIT_NOT_FOUND"
          )
        ) {
          return reply
            .code(404)
            .send({
              error:
                "UNIT_NOT_FOUND",
            });
        }

        if (
          error.code === "23514" ||
          error.message?.includes(
            "HEADQUARTERS_CANNOT_BE_DELETED"
          )
        ) {
          return reply
            .code(409)
            .send({
              error:
                "HEADQUARTERS_CANNOT_BE_DELETED",
            });
        }

        if (
          error.code === "42501" ||
          error.message?.includes(
            "PERMISSION_DENIED"
          ) ||
          error.message?.includes(
            "UNIT_SCOPE_DENIED"
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
              "UNIT_DELETE_FAILED",
          });
      }

      return reply.send({
        data,
      });
    }
  );
}
