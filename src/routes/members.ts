import type {
  FastifyInstance,
} from "fastify";

import { z } from "zod";

import {
  requireAuthenticatedUser,
} from "../auth.js";

import {
  membersQuerySchema,
} from "../schemas/members.js";

const contextSchema =
  z.object({
    organization:
      z.object({
        id:
          z.string().uuid(),
      }),

    permissions:
      z.array(
        z.string()
      ),
  });

function normalizeSearch(
  value: string
): string {
  return value
    .replace(/[%_]/g, "")
    .replace(/[(),]/g, " ")
    .trim();
}

function singleRelation(
  value: unknown
): any | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

async function loadContext(
  auth: any,
  reply: any
) {
  const {
    data,
    error,
  } =
    await auth.supabase.rpc(
      "current_user_context"
    );

  if (error) {
    return {
      ok: false as const,

      response:
        reply
          .code(403)
          .send({
            error:
              "USER_CONTEXT_UNAVAILABLE",
          }),
    };
  }

  const parsed =
    contextSchema.safeParse(
      data
    );

  if (!parsed.success) {
    return {
      ok: false as const,

      response:
        reply
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
      parsed.data,
  };
}

export async function membersRoutes(
  app: FastifyInstance
) {
  // ==========================================================
  // GET /api/v1/members
  // ==========================================================

  app.get(
    "/api/v1/members",
    async (
      request,
      reply
    ) => {
      const auth =
        await requireAuthenticatedUser(
          request
        );

      if (!auth.ok) {
        return reply
          .code(
            auth.statusCode
          )
          .send({
            error:
              auth.error,
          });
      }

      const parsedQuery =
        membersQuerySchema.safeParse(
          request.query
        );

      if (
        !parsedQuery.success
      ) {
        return reply
          .code(400)
          .send({
            error:
              "INVALID_QUERY_PARAMETERS",

            details:
              parsedQuery
                .error
                .flatten(),
          });
      }

      const contextResult =
        await loadContext(
          auth,
          reply
        );

      if (
        !contextResult.ok
      ) {
        return contextResult
          .response;
      }

      const {
        organization,
        permissions,
      } =
        contextResult.context;

      if (
        !permissions.includes(
          "user.read"
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
        page,
        limit,
        search,
        status,
      } =
        parsedQuery.data;

      const offset =
        (page - 1) *
        limit;

      const end =
        offset +
        limit -
        1;

      let personIds:
        string[] |
        null =
        null;

      if (search) {
        const normalizedSearch =
          normalizeSearch(
            search
          );

        if (
          normalizedSearch.length ===
          0
        ) {
          return reply
            .code(400)
            .send({
              error:
                "INVALID_QUERY_PARAMETERS",
            });
        }

        const {
          data:
            matchingPersons,
          error:
            personsError,
        } =
          await auth.supabase
            .from("persons")
            .select("id")
            .eq(
              "organization_id",
              organization.id
            )
            .is(
              "deleted_at",
              null
            )
            .or(
              [
                `full_name.ilike.%${normalizedSearch}%`,
                `preferred_name.ilike.%${normalizedSearch}%`,
                `primary_email.ilike.%${normalizedSearch}%`,
              ].join(",")
            );

        if (personsError) {
          request.log.error(
            {
              code:
                personsError.code,

              message:
                personsError.message,
            },
            "Failed to search members"
          );

          return reply
            .code(500)
            .send({
              error:
                "MEMBERS_SEARCH_FAILED",
            });
        }

        personIds =
          (
            matchingPersons ??
            []
          ).map(
            (
              person: {
                id: string;
              }
            ) =>
              person.id
          );

        if (
          personIds.length ===
          0
        ) {
          return reply.send({
            data: [],

            pagination: {
              page,
              limit,
              total: 0,
              totalPages: 0,

              hasPreviousPage:
                page > 1,

              hasNextPage:
                false,
            },

            filters: {
              search,
              status:
                status ??
                null,
            },
          });
        }
      }

      let query =
        auth.supabase
          .from(
            "organization_members"
          )
          .select(
            `
              id,
              person_id,
              user_profile_id,
              status,
              joined_at,
              ended_at,
              created_at,
              person:persons (
                id,
                full_name,
                preferred_name,
                primary_email
              ),
              user_profile:user_profiles (
                id,
                auth_user_id,
                email
              ),
              member_roles (
                id,
                role_id,
                starts_at,
                ends_at,
                role:roles (
                  id,
                  code,
                  name,
                  description
                )
              )
            `,
            {
              count:
                "exact",
            }
          )
          .eq(
            "organization_id",
            organization.id
          );

      if (status) {
        query =
          query.eq(
            "status",
            status
          );
      }

      if (personIds) {
        query =
          query.in(
            "person_id",
            personIds
          );
      }

      const {
        data,
        error,
        count,
      } =
        await query
          .order(
            "joined_at",
            {
              ascending:
                false,
            }
          )
          .order(
            "id",
            {
              ascending:
                true,
            }
          )
          .range(
            offset,
            end
          );

      if (error) {
        request.log.error(
          {
            code:
              error.code,

            message:
              error.message,
          },
          "Failed to list members"
        );

        return reply
          .code(500)
          .send({
            error:
              "MEMBERS_LIST_FAILED",
          });
      }

      const members =
        (
          data ??
          []
        ).map(
          (row: any) => {
            const person =
              singleRelation(
                row.person
              );

            const userProfile =
              singleRelation(
                row.user_profile
              );

            const roles =
              (
                row.member_roles ??
                []
              ).map(
                (
                  assignment:
                    any
                ) => {
                  const role =
                    singleRelation(
                      assignment
                        .role
                    );

                  return {
                    id:
                      assignment.id,

                    role_id:
                      assignment
                        .role_id,

                    role_code:
                      role?.code ??
                      null,

                    role_name:
                      role?.name ??
                      null,

                    starts_at:
                      assignment
                        .starts_at,

                    ends_at:
                      assignment
                        .ends_at,
                  };
                }
              );

            return {
              id:
                row.id,

              user_id:
                userProfile
                  ?.auth_user_id ??
                null,

              status:
                row.status,

              joined_at:
                row.joined_at,

              created_at:
                row.created_at,

              profile: {
                full_name:
                  person
                    ?.full_name ??
                  person
                    ?.preferred_name ??
                  null,

                email:
                  userProfile
                    ?.email ??
                  person
                    ?.primary_email ??
                  null,

                avatar_url:
                  null,
              },

              roles,
            };
          }
        );

      const total =
        count ?? 0;

      const totalPages =
        total === 0
          ? 0
          : Math.ceil(
              total /
                limit
            );

      return reply.send({
        data:
          members,

        pagination: {
          page,
          limit,
          total,
          totalPages,

          hasPreviousPage:
            page > 1,

          hasNextPage:
            page <
            totalPages,
        },

        filters: {
          search:
            search ??
            null,

          status:
            status ??
            null,
        },
      });
    }
  );
}