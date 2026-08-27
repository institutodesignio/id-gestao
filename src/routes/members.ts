import type {
  FastifyInstance,
} from "fastify";

import { z } from "zod";

import {
  requireAuthenticatedUser,
} from "../auth.js";

import {
  createMemberRoleSchema,
  endMemberRoleSchema,
} from "../schemas/member-roles.js";

import {
  membersQuerySchema,
  updateMemberStatusSchema,
} from "../schemas/members.js";

const memberParamsSchema = z.object({
  memberId: z.string().uuid(),
});

const memberRoleParamsSchema = z.object({
  memberId: z.string().uuid(),
  memberRoleId: z.string().uuid(),
});

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
              member_type,
              job_title,
              professional_council,
              professional_registration,
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

              member_type:
                row.member_type,

              job_title:
                row.job_title,

              professional_council:
                row.professional_council,

              professional_registration:
                row.professional_registration,

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

  // ==========================================================
  // GET /api/v1/members/:memberId
  // ==========================================================

  app.get(
    "/api/v1/members/:memberId",
    async (request, reply) => {
      const auth = await requireAuthenticatedUser(request);

      if (!auth.ok) {
        return reply.code(auth.statusCode).send({ error: auth.error });
      }

      const parsedParams = memberParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return reply.code(400).send({ error: "INVALID_MEMBER_ID" });
      }

      const contextResult = await loadContext(auth, reply);
      if (!contextResult.ok) return contextResult.response;

      const { organization, permissions } = contextResult.context;
      if (!permissions.includes("user.read")) {
        return reply.code(403).send({ error: "PERMISSION_DENIED" });
      }

      const { data, error } = await auth.supabase
        .from("organization_members")
        .select(`
          id, person_id, user_profile_id, status, member_type, job_title,
          professional_council, professional_registration, joined_at, ended_at, created_at,
          person:persons (id, full_name, preferred_name, primary_email),
          user_profile:user_profiles (id, auth_user_id, email),
          member_roles (
            id, role_id, starts_at, ends_at,
            role:roles (id, code, name, description)
          )
        `)
        .eq("id", parsedParams.data.memberId)
        .eq("organization_id", organization.id)
        .maybeSingle();

      if (error) {
        request.log.error({ code: error.code, message: error.message }, "Failed to read member");
        return reply.code(500).send({ error: "MEMBER_READ_FAILED" });
      }

      if (!data) return reply.code(404).send({ error: "MEMBER_NOT_FOUND" });

      const person = singleRelation(data.person);
      const userProfile = singleRelation(data.user_profile);
      const roles = (data.member_roles ?? []).map((assignment: any) => {
        const role = singleRelation(assignment.role);
        return {
          id: assignment.id,
          role_id: assignment.role_id,
          role_code: role?.code ?? null,
          role_name: role?.name ?? null,
          role_description: role?.description ?? null,
          starts_at: assignment.starts_at,
          ends_at: assignment.ends_at,
        };
      });

      return reply.send({
        id: data.id,
        person_id: data.person_id,
        user_profile_id: data.user_profile_id,
        user_id: userProfile?.auth_user_id ?? null,
        status: data.status,
        member_type: data.member_type,
        job_title: data.job_title,
        professional_council: data.professional_council,
        professional_registration: data.professional_registration,
        joined_at: data.joined_at,
        ended_at: data.ended_at,
        created_at: data.created_at,
        profile: {
          full_name: person?.full_name ?? person?.preferred_name ?? null,
          preferred_name: person?.preferred_name ?? null,
          email: userProfile?.email ?? person?.primary_email ?? null,
          avatar_url: null,
        },
        roles,
      });
    }
  );

  // ==========================================================
  // PATCH /api/v1/members/:memberId
  // ==========================================================

  app.patch("/api/v1/members/:memberId", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });

    const parsedParams = memberParamsSchema.safeParse(request.params);
    if (!parsedParams.success) return reply.code(400).send({ error: "INVALID_MEMBER_ID" });

    const parsedBody = updateMemberStatusSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.code(400).send({
        error: "INVALID_MEMBER_DATA",
        details: parsedBody.error.flatten(),
      });
    }

    const contextResult = await loadContext(auth, reply);
    if (!contextResult.ok) return contextResult.response;
    const { organization, permissions } = contextResult.context;
    if (!permissions.includes("user.update")) {
      return reply.code(403).send({ error: "PERMISSION_DENIED" });
    }

    const { data: member, error: memberError } = await auth.supabase
      .from("organization_members")
      .select(`
        id, user_profile_id, status,
        user_profile:user_profiles(auth_user_id),
        member_roles!inner(role:roles(code), ends_at)
      `)
      .eq("id", parsedParams.data.memberId)
      .eq("organization_id", organization.id)
      .maybeSingle();

    if (memberError) return reply.code(500).send({ error: "MEMBER_READ_FAILED" });
    if (!member) return reply.code(404).send({ error: "MEMBER_NOT_FOUND" });

    const targetProfile = singleRelation(member.user_profile);
    if (
      parsedBody.data.status === "INACTIVE" &&
      targetProfile?.auth_user_id === auth.user.id
    ) {
      return reply.code(409).send({ error: "SELF_DEACTIVATION_FORBIDDEN" });
    }

    const activeRoles = (member.member_roles ?? []).filter(
      (assignment: any) =>
        !assignment.ends_at && singleRelation(assignment.role)?.code === "ADMINISTRATOR",
    );
    if (parsedBody.data.status === "INACTIVE" && activeRoles.length > 0) {
      if (!permissions.includes("role.manage")) {
        return reply.code(403).send({ error: "ROLE_ASSIGNMENT_FORBIDDEN" });
      }
      const { count, error: countError } = await auth.supabase
        .from("organization_members")
        .select("id, member_roles!inner(role:roles!inner(code), ends_at)", {
          count: "exact",
          head: true,
        })
        .eq("organization_id", organization.id)
        .eq("status", "ACTIVE")
        .eq("member_roles.role.code", "ADMINISTRATOR")
        .is("member_roles.ends_at", null)
        .neq("id", member.id);
      if (countError) return reply.code(500).send({ error: "ADMINISTRATOR_COUNT_FAILED" });
      if ((count ?? 0) === 0) {
        return reply.code(409).send({ error: "LAST_ADMINISTRATOR_REQUIRED" });
      }
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await auth.supabase
      .from("organization_members")
      .update({
        status: parsedBody.data.status,
        ended_at: parsedBody.data.status === "INACTIVE" ? now.slice(0, 10) : null,
        updated_at: now,
        updated_by: auth.user.id,
      })
      .eq("id", member.id)
      .eq("organization_id", organization.id)
      .select(
        "id,status,member_type,job_title,professional_council,professional_registration,joined_at,ended_at,updated_at",
      )
      .single();

    if (updateError) {
      request.log.error({ code: updateError.code }, "Failed to update member status");
      return reply.code(500).send({ error: "MEMBER_UPDATE_FAILED" });
    }
    return reply.send({ data: updated });
  });

  // ==========================================================
  // POST /api/v1/members/:memberId/roles
  // ==========================================================

  app.post(
    "/api/v1/members/:memberId/roles",
    async (request, reply) => {
      const auth = await requireAuthenticatedUser(request);
      if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });

      const parsedParams = memberParamsSchema.safeParse(request.params);
      if (!parsedParams.success) return reply.code(400).send({ error: "INVALID_MEMBER_ID" });

      const parsedBody = createMemberRoleSchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.code(400).send({
          error: "INVALID_MEMBER_ROLE_DATA",
          details: parsedBody.error.flatten(),
        });
      }

      const contextResult = await loadContext(auth, reply);
      if (!contextResult.ok) return contextResult.response;
      const { organization, permissions } = contextResult.context;
      if (!permissions.includes("user.manage_roles")) {
        return reply.code(403).send({ error: "PERMISSION_DENIED" });
      }

      const { data: member, error: memberError } = await auth.supabase
        .from("organization_members")
        .select("id")
        .eq("id", parsedParams.data.memberId)
        .eq("organization_id", organization.id)
        .maybeSingle();

      if (memberError) return reply.code(500).send({ error: "MEMBER_READ_FAILED" });
      if (!member) return reply.code(404).send({ error: "MEMBER_NOT_FOUND" });

      const { data: role, error: roleError } = await auth.supabase
        .from("roles")
        .select("id, code, name, description")
        .eq("id", parsedBody.data.role_id)
        .eq("status", "ACTIVE")
        .is("deleted_at", null)
        .or(`organization_id.eq.${organization.id},organization_id.is.null`)
        .maybeSingle();

      if (roleError) return reply.code(500).send({ error: "ROLE_READ_FAILED" });
      if (!role) return reply.code(404).send({ error: "ROLE_NOT_FOUND" });
      if (
        role.code === "ADMINISTRATOR" &&
        !permissions.includes("role.manage")
      ) {
        return reply.code(403).send({ error: "ROLE_ASSIGNMENT_FORBIDDEN" });
      }

      const insertPayload: Record<string, unknown> = {
        organization_member_id: member.id,
        role_id: role.id,
        ends_at: parsedBody.data.ends_at ?? null,
        created_by: auth.user.id,
        updated_by: auth.user.id,
      };
      if (parsedBody.data.starts_at) insertPayload.starts_at = parsedBody.data.starts_at;

      const { data: assignment, error: insertError } = await auth.supabase
        .from("member_roles")
        .insert(insertPayload)
        .select("id, organization_member_id, role_id, starts_at, ends_at, created_at")
        .single();

      if (insertError?.code === "23505") {
        return reply.code(409).send({ error: "MEMBER_ROLE_ALREADY_ACTIVE" });
      }
      if (insertError) return reply.code(500).send({ error: "MEMBER_ROLE_CREATE_FAILED" });

      return reply.code(201).send({ ...assignment, role });
    }
  );

  // ==========================================================
  // PATCH /api/v1/members/:memberId/roles/:memberRoleId/end
  // ==========================================================

  app.patch(
    "/api/v1/members/:memberId/roles/:memberRoleId/end",
    async (request, reply) => {
      const auth = await requireAuthenticatedUser(request);
      if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });

      const parsedParams = memberRoleParamsSchema.safeParse(request.params);
      if (!parsedParams.success) return reply.code(400).send({ error: "INVALID_MEMBER_ROLE_ID" });

      const parsedBody = endMemberRoleSchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.code(400).send({
          error: "INVALID_MEMBER_ROLE_DATA",
          details: parsedBody.error.flatten(),
        });
      }

      const contextResult = await loadContext(auth, reply);
      if (!contextResult.ok) return contextResult.response;
      const { organization, permissions } = contextResult.context;
      if (!permissions.includes("user.manage_roles")) {
        return reply.code(403).send({ error: "PERMISSION_DENIED" });
      }

      const { data: member, error: memberError } = await auth.supabase
        .from("organization_members")
        .select("id")
        .eq("id", parsedParams.data.memberId)
        .eq("organization_id", organization.id)
        .maybeSingle();

      if (memberError) return reply.code(500).send({ error: "MEMBER_READ_FAILED" });
      if (!member) return reply.code(404).send({ error: "MEMBER_NOT_FOUND" });

      const { data: assignment, error: assignmentError } = await auth.supabase
        .from("member_roles")
        .select("id, role_id, starts_at, role:roles(code)")
        .eq("id", parsedParams.data.memberRoleId)
        .eq("organization_member_id", member.id)
        .is("ends_at", null)
        .maybeSingle();

      if (assignmentError) return reply.code(500).send({ error: "MEMBER_ROLE_READ_FAILED" });
      if (!assignment) return reply.code(404).send({ error: "ACTIVE_MEMBER_ROLE_NOT_FOUND" });
      if (parsedBody.data.ends_at < assignment.starts_at) {
        return reply.code(409).send({ error: "MEMBER_ROLE_END_BEFORE_START" });
      }

      const assignmentRole = singleRelation(assignment.role);
      if (assignmentRole?.code === "ADMINISTRATOR") {
        if (!permissions.includes("role.manage")) {
          return reply.code(403).send({ error: "ROLE_ASSIGNMENT_FORBIDDEN" });
        }

        const { count, error: countError } = await auth.supabase
          .from("member_roles")
          .select("id, organization_member:organization_members!inner(organization_id)", {
            count: "exact",
            head: true,
          })
          .eq("role_id", assignment.role_id)
          .is("ends_at", null)
          .eq("organization_member.organization_id", organization.id)
          .neq("organization_member_id", member.id);

        if (countError) {
          return reply.code(500).send({ error: "ADMINISTRATOR_COUNT_FAILED" });
        }
        if ((count ?? 0) === 0) {
          return reply.code(409).send({ error: "LAST_ADMINISTRATOR_ROLE_REQUIRED" });
        }
      }

      const { data: updated, error: updateError } = await auth.supabase
        .from("member_roles")
        .update({
          ends_at: parsedBody.data.ends_at,
          updated_at: new Date().toISOString(),
          updated_by: auth.user.id,
        })
        .eq("id", assignment.id)
        .eq("organization_member_id", member.id)
        .is("ends_at", null)
        .select("id, organization_member_id, role_id, starts_at, ends_at, updated_at")
        .single();

      if (updateError) return reply.code(500).send({ error: "MEMBER_ROLE_END_FAILED" });
      return reply.send(updated);
    }
  );
}
