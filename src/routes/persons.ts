import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { requireAuthenticatedUser } from "../auth.js";

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

  search: z.string()
    .trim()
    .min(1)
    .max(120)
    .optional(),

  status: z.enum([
    "ACTIVE",
    "INACTIVE",
    "ARCHIVED",
  ]).optional(),

  type: z.enum([
    "INDIVIDUAL",
    "ORGANIZATION",
  ]).optional(),
});

const contextSchema = z.object({
  organization: z.object({
    id: z.string().uuid(),
  }),

  permissions: z.array(z.string()),
});

function normalizeSearch(value: string): string {
  return value
    .replace(/[%_]/g, "")
    .replace(/[(),]/g, " ")
    .trim();
}

export async function personsRoutes(app: FastifyInstance) {
  app.get("/api/v1/persons", async (request, reply) => {
    // ========================================================
    // 1. AUTENTICAÇÃO
    // ========================================================

    const auth = await requireAuthenticatedUser(request);

    if (!auth.ok) {
      return reply
        .code(auth.statusCode)
        .send({ error: auth.error });
    }

    // ========================================================
    // 2. VALIDAR QUERY STRING
    // ========================================================

    const parsedQuery = querySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return reply.code(400).send({
        error: "INVALID_QUERY_PARAMETERS",
        details: parsedQuery.error.flatten(),
      });
    }

    const {
      page,
      limit,
      search,
      status,
      type,
    } = parsedQuery.data;

    // ========================================================
    // 3. CARREGAR CONTEXTO INSTITUCIONAL
    // ========================================================

    const {
      data: contextData,
      error: contextError,
    } = await auth.supabase.rpc("current_user_context");

    if (contextError) {
      request.log.error(
        {
          code: contextError.code,
          details: contextError.details,
          hint: contextError.hint,
        },
        "Failed to load institutional context for persons"
      );

      return reply
        .code(403)
        .send({ error: "USER_CONTEXT_UNAVAILABLE" });
    }

    const parsedContext =
      contextSchema.safeParse(contextData);

    if (!parsedContext.success) {
      request.log.error(
        {
          issues: parsedContext.error.issues,
        },
        "Invalid institutional context structure"
      );

      return reply
        .code(403)
        .send({ error: "INVALID_USER_CONTEXT" });
    }

    const {
      organization,
      permissions,
    } = parsedContext.data;

    // ========================================================
    // 4. AUTORIZAÇÃO
    // ========================================================

    if (!permissions.includes("person.read")) {
      return reply
        .code(403)
        .send({ error: "PERMISSION_DENIED" });
    }

    // ========================================================
    // 5. PAGINAÇÃO
    // ========================================================

    const offset = (page - 1) * limit;
    const end = offset + limit - 1;

    // ========================================================
    // 6. CONSULTA
    //
    // organization_id SEMPRE vem do contexto autenticado.
    // Nunca aceitar organization_id enviado pelo frontend.
    // ========================================================

    let query = auth.supabase
      .from("persons")
      .select(
        `
          id,
          person_type,
          full_name,
          preferred_name,
          birth_date,
          gender,
          marital_status,
          nationality,
          occupation,
          cpf,
          cnpj,
          rg,
          rg_issuer,
          nis,
          primary_email,
          primary_phone,
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

    // ========================================================
    // 7. FILTROS
    // ========================================================

    if (status) {
      query = query.eq(
        "status",
        status
      );
    }

    if (type) {
      query = query.eq(
        "person_type",
        type
      );
    }

    if (search) {
      const normalizedSearch =
        normalizeSearch(search);

      if (normalizedSearch.length > 0) {
        query = query.or(
          [
            `full_name.ilike.%${normalizedSearch}%`,
            `preferred_name.ilike.%${normalizedSearch}%`,
            `primary_email.ilike.%${normalizedSearch}%`,
          ].join(",")
        );
      }
    }

    // ========================================================
    // 8. ORDENAÇÃO E RANGE
    // ========================================================

    const {
      data,
      error,
      count,
    } = await query
      .order(
        "full_name",
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
        "Failed to list persons"
      );

      return reply
        .code(500)
        .send({ error: "PERSONS_LIST_FAILED" });
    }

    // ========================================================
    // 9. RESPOSTA
    // ========================================================

    const total = count ?? 0;
    const totalPages =
      total === 0
        ? 0
        : Math.ceil(total / limit);

    return reply.send({
      data: data ?? [],

      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      },

      filters: {
        search: search ?? null,
        status: status ?? null,
        type: type ?? null,
      },
    });
  });
}