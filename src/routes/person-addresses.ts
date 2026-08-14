import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { requireAuthenticatedUser } from "../auth.js";

import {
  createPersonAddressSchema,
  updatePersonAddressSchema,
} from "../schemas/person-addresses.js";

const personParamsSchema = z.object({
  id: z.string().uuid(),
});

const addressParamsSchema = z.object({
  id: z.string().uuid(),
  addressId: z.string().uuid(),
});

const contextSchema = z.object({
  organization: z.object({
    id: z.string().uuid(),
  }),

  permissions: z.array(z.string()),
});

export async function personAddressesRoutes(
  app: FastifyInstance
) {
  app.post(
    "/api/v1/persons/:id/addresses",
    async (request, reply) => {
      const auth =
        await requireAuthenticatedUser(request);

      if (!auth.ok) {
        return reply
          .code(auth.statusCode)
          .send({ error: auth.error });
      }

      const parsedParams =
        personParamsSchema.safeParse(
          request.params
        );

      if (!parsedParams.success) {
        return reply
          .code(400)
          .send({
            error: "INVALID_PERSON_ID",
          });
      }

      const parsedBody =
        createPersonAddressSchema.safeParse(
          request.body
        );

      if (!parsedBody.success) {
        return reply
          .code(400)
          .send({
            error: "INVALID_ADDRESS_DATA",
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
            error: "INVALID_USER_CONTEXT",
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
            error: "PERMISSION_DENIED",
          });
      }

      const { id } =
        parsedParams.data;

      const {
        data: person,
        error: personError,
      } = await auth.supabase
        .from("persons")
        .select("id")
        .eq("id", id)
        .eq(
          "organization_id",
          organization.id
        )
        .is("deleted_at", null)
        .maybeSingle();

      if (personError) {
        return reply
          .code(500)
          .send({
            error: "PERSON_READ_FAILED",
          });
      }

      if (!person) {
        return reply
          .code(404)
          .send({
            error: "PERSON_NOT_FOUND",
          });
      }

      const payload =
        parsedBody.data;

      const {
        data,
        error,
      } = await auth.supabase
        .from("person_addresses")
        .insert({
          organization_id:
            organization.id,

          person_id: id,

          address_type:
            payload.address_type ??
            "PRIMARY",

          postal_code:
            payload.postal_code ??
            null,

          street:
            payload.street ?? null,

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
            payload.city ?? null,

          state_code:
            payload.state_code ??
            null,

          country_code:
            payload.country_code ??
            "BR",

          is_primary:
            payload.is_primary ??
            false,

          created_by: auth.user.id,
          updated_by: auth.user.id,
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
          "Failed to create person address"
        );

        return reply
          .code(500)
          .send({
            error:
              "PERSON_ADDRESS_CREATE_FAILED",
          });
      }

      return reply
        .code(201)
        .send({ data });
    }
  );

  app.patch(
    "/api/v1/persons/:id/addresses/:addressId",
    async (request, reply) => {
      const auth =
        await requireAuthenticatedUser(request);

      if (!auth.ok) {
        return reply
          .code(auth.statusCode)
          .send({ error: auth.error });
      }

      const parsedParams =
        addressParamsSchema.safeParse(
          request.params
        );

      if (!parsedParams.success) {
        return reply
          .code(400)
          .send({
            error:
              "INVALID_ADDRESS_ID",
          });
      }

      const parsedBody =
        updatePersonAddressSchema.safeParse(
          request.body
        );

      if (!parsedBody.success) {
        return reply
          .code(400)
          .send({
            error:
              "INVALID_ADDRESS_DATA",
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
            error: "PERMISSION_DENIED",
          });
      }

      const {
        id,
        addressId,
      } = parsedParams.data;

      const {
        data: existingAddress,
        error: existingError,
      } = await auth.supabase
        .from("person_addresses")
        .select("id")
        .eq("id", addressId)
        .eq("person_id", id)
        .eq(
          "organization_id",
          organization.id
        )
        .is("deleted_at", null)
        .maybeSingle();

      if (existingError) {
        return reply
          .code(500)
          .send({
            error:
              "PERSON_ADDRESS_READ_FAILED",
          });
      }

      if (!existingAddress) {
        return reply
          .code(404)
          .send({
            error:
              "PERSON_ADDRESS_NOT_FOUND",
          });
      }

      const update =
        parsedBody.data;

      const {
        data,
        error,
      } = await auth.supabase
        .from("person_addresses")
        .update({
          ...update,
          updated_by: auth.user.id,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", addressId)
        .eq("person_id", id)
        .eq(
          "organization_id",
          organization.id
        )
        .is("deleted_at", null)
        .select()
        .single();

      if (error) {
        return reply
          .code(500)
          .send({
            error:
              "PERSON_ADDRESS_UPDATE_FAILED",
          });
      }

      return reply.send({
        data,
      });
    }
  );
}
