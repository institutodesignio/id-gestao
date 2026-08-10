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

const paramsSchema = z.object({
  id: z.string().uuid(),
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
  // ==========================================================
  // GET /api/v1/persons
  // ==========================================================

  app.get("/api/v1/persons", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request);

    if (!auth.ok) {
      return reply
        .code(auth.statusCode)
        .send({ error: auth.error });
    }

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

    if (!permissions.includes("person.read")) {
      return reply
        .code(403)
        .send({ error: "PERMISSION_DENIED" });
    }

    const offset = (page - 1) * limit;
    const end = offset + limit - 1;

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

  // ==========================================================
  // GET /api/v1/persons/:id
  // ==========================================================

  app.get("/api/v1/persons/:id", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request);

    if (!auth.ok) {
      return reply
        .code(auth.statusCode)
        .send({ error: auth.error });
    }

    const parsedParams =
      paramsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.code(400).send({
        error: "INVALID_PERSON_ID",
        details: parsedParams.error.flatten(),
      });
    }

    const {
      id,
    } = parsedParams.data;

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
        "Failed to load institutional context for person details"
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

    if (!permissions.includes("person.read")) {
      return reply
        .code(403)
        .send({ error: "PERMISSION_DENIED" });
    }

    // --------------------------------------------------------
    // Pessoa
    // --------------------------------------------------------

    const {
      data: person,
      error: personError,
    } = await auth.supabase
      .from("persons")
      .select(`
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

    if (personError) {
      request.log.error(
        {
          code: personError.code,
          details: personError.details,
          hint: personError.hint,
          message: personError.message,
        },
        "Failed to load person details"
      );

      return reply
        .code(500)
        .send({ error: "PERSON_READ_FAILED" });
    }

    if (!person) {
      return reply
        .code(404)
        .send({ error: "PERSON_NOT_FOUND" });
    }

    // --------------------------------------------------------
    // Endereços
    // --------------------------------------------------------

    const {
      data: addresses,
      error: addressesError,
    } = await auth.supabase
      .from("person_addresses")
      .select(`
        id,
        address_type,
        postal_code,
        street,
        street_number,
        address_complement,
        neighborhood,
        city,
        state_code,
        country_code,
        is_primary,
        created_at,
        updated_at
      `)
      .eq(
        "person_id",
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
      .order(
        "is_primary",
        {
          ascending: false,
        }
      )
      .order(
        "created_at",
        {
          ascending: true,
        }
      );

    if (addressesError) {
      request.log.error(
        {
          code: addressesError.code,
          details: addressesError.details,
          hint: addressesError.hint,
          message: addressesError.message,
        },
        "Failed to load person addresses"
      );

      return reply
        .code(500)
        .send({ error: "PERSON_ADDRESSES_READ_FAILED" });
    }

    // --------------------------------------------------------
    // Relacionamentos
    // --------------------------------------------------------

    const {
      data: relationships,
      error: relationshipsError,
    } = await auth.supabase
      .from("person_relationships")
      .select(`
        id,
        related_person_id,
        relationship_type,
        is_legal_guardian,
        is_financial_responsible,
        starts_at,
        ends_at,
        notes,
        created_at,
        updated_at
      `)
      .eq(
        "person_id",
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
      .order(
        "created_at",
        {
          ascending: true,
        }
      );

    if (relationshipsError) {
      request.log.error(
        {
          code: relationshipsError.code,
          details: relationshipsError.details,
          hint: relationshipsError.hint,
          message: relationshipsError.message,
        },
        "Failed to load person relationships"
      );

      return reply
        .code(500)
        .send({ error: "PERSON_RELATIONSHIPS_READ_FAILED" });
    }

    return reply.send({
      person,
      addresses: addresses ?? [],
      relationships: relationships ?? [],
    });
  });
}