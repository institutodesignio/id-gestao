import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { requireAuthenticatedUser } from "../auth.js";

import {
  createPersonRelationshipSchema,
  updatePersonRelationshipSchema,
} from "../schemas/person-relationships.js";

const personParamsSchema = z.object({
  id: z.string().uuid(),
});

const relationshipParamsSchema =
  z.object({
    id: z.string().uuid(),
    relationshipId:
      z.string().uuid(),
  });

const contextSchema = z.object({
  organization: z.object({
    id: z.string().uuid(),
  }),

  permissions: z.array(z.string()),
});

export async function personRelationshipsRoutes(
  app: FastifyInstance
) {
  app.post(
    "/api/v1/persons/:id/relationships",
    async (request, reply) => {
      const auth =
        await requireAuthenticatedUser(request);

      if (!auth.ok) {
        return reply
          .code(auth.statusCode)
          .send({
            error: auth.error,
          });
      }

      const parsedParams =
        personParamsSchema.safeParse(
          request.params
        );

      if (!parsedParams.success) {
        return reply
          .code(400)
          .send({
            error:
              "INVALID_PERSON_ID",
          });
      }

      const parsedBody =
        createPersonRelationshipSchema.safeParse(
          request.body
        );

      if (!parsedBody.success) {
        return reply
          .code(400)
          .send({
            error:
              "INVALID_RELATIONSHIP_DATA",
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
          "person.create"
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

      const payload =
        parsedBody.data;

      if (
        id ===
        payload.related_person_id
      ) {
        return reply
          .code(400)
          .send({
            error:
              "PERSON_RELATIONSHIP_SELF_REFERENCE",
          });
      }

      const {
        data: persons,
        error: personsError,
      } = await auth.supabase
        .from("persons")
        .select("id")
        .in("id", [
          id,
          payload.related_person_id,
        ])
        .eq(
          "organization_id",
          organization.id
        )
        .is("deleted_at", null);

      if (personsError) {
        return reply
          .code(500)
          .send({
            error:
              "PERSON_READ_FAILED",
          });
      }

      if (
        !persons ||
        persons.length !== 2
      ) {
        return reply
          .code(404)
          .send({
            error:
              "RELATIONSHIP_PERSON_NOT_FOUND",
          });
      }

      const {
        data,
        error,
      } = await auth.supabase
        .from(
          "person_relationships"
        )
        .insert({
          organization_id:
            organization.id,

          person_id: id,

          related_person_id:
            payload.related_person_id,

          relationship_type:
            payload.relationship_type,

          is_legal_guardian:
            payload.is_legal_guardian ??
            false,

          is_financial_responsible:
            payload.is_financial_responsible ??
            false,

          starts_at:
            payload.starts_at ??
            null,

          ends_at:
            payload.ends_at ??
            null,

          notes:
            payload.notes ??
            null,

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
          },
          "Failed to create person relationship"
        );

        if (
          error.code ===
          "23514"
        ) {
          return reply
            .code(400)
            .send({
              error:
                "PERSON_RELATIONSHIP_CONSTRAINT_VIOLATION",
            });
        }

        return reply
          .code(500)
          .send({
            error:
              "PERSON_RELATIONSHIP_CREATE_FAILED",
          });
      }

      return reply
        .code(201)
        .send({ data });
    }
  );

  app.patch(
    "/api/v1/persons/:id/relationships/:relationshipId",
    async (request, reply) => {
      const auth =
        await requireAuthenticatedUser(request);

      if (!auth.ok) {
        return reply
          .code(auth.statusCode)
          .send({
            error: auth.error,
          });
      }

      const parsedParams =
        relationshipParamsSchema.safeParse(
          request.params
        );

      if (!parsedParams.success) {
        return reply
          .code(400)
          .send({
            error:
              "INVALID_RELATIONSHIP_ID",
          });
      }

      const parsedBody =
        updatePersonRelationshipSchema.safeParse(
          request.body
        );

      if (!parsedBody.success) {
        return reply
          .code(400)
          .send({
            error:
              "INVALID_RELATIONSHIP_DATA",
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
          "person.update"
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
        id,
        relationshipId,
      } = parsedParams.data;

      const {
        data: existingRelationship,
        error: existingError,
      } = await auth.supabase
        .from(
          "person_relationships"
        )
        .select(`
          id,
          related_person_id,
          starts_at,
          ends_at
        `)
        .eq(
          "id",
          relationshipId
        )
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
        .maybeSingle();

      if (existingError) {
        return reply
          .code(500)
          .send({
            error:
              "PERSON_RELATIONSHIP_READ_FAILED",
          });
      }

      if (
        !existingRelationship
      ) {
        return reply
          .code(404)
          .send({
            error:
              "PERSON_RELATIONSHIP_NOT_FOUND",
          });
      }

      const update =
        parsedBody.data;

      const startsAt = update.starts_at !== undefined
        ? update.starts_at
        : existingRelationship.starts_at;
      const endsAt = update.ends_at !== undefined
        ? update.ends_at
        : existingRelationship.ends_at;

      if (startsAt && endsAt && endsAt < startsAt) {
        return reply.code(400).send({
          error: "INVALID_RELATIONSHIP_DATA",
          details: {
            formErrors: [],
            fieldErrors: {
              ends_at: ["ends_at cannot be before starts_at"],
            },
          },
        });
      }

      const resultingRelatedPersonId =
        update.related_person_id ??
        existingRelationship.related_person_id;

      if (
        resultingRelatedPersonId === id
      ) {
        return reply
          .code(400)
          .send({
            error:
              "PERSON_RELATIONSHIP_SELF_REFERENCE",
          });
      }

      if (
        update.related_person_id
      ) {
        const {
          data: relatedPerson,
          error:
            relatedPersonError,
        } = await auth.supabase
          .from("persons")
          .select("id")
          .eq(
            "id",
            update.related_person_id
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

        if (
          relatedPersonError
        ) {
          return reply
            .code(500)
            .send({
              error:
                "PERSON_READ_FAILED",
            });
        }

        if (!relatedPerson) {
          return reply
            .code(404)
            .send({
              error:
                "RELATED_PERSON_NOT_FOUND",
            });
        }
      }

      const {
        data,
        error,
      } = await auth.supabase
        .from(
          "person_relationships"
        )
        .update({
          ...update,

          updated_by:
            auth.user.id,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          relationshipId
        )
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
        .select()
        .single();

      if (error) {
        return reply
          .code(500)
          .send({
            error:
              "PERSON_RELATIONSHIP_UPDATE_FAILED",
          });
      }

      return reply.send({
        data,
      });
    }
  );
}
