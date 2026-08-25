import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuthenticatedUser } from "../auth.js";
import {
  createAppointmentSchema,
  createAvailabilitySchema,
  updateAppointmentSchema,
  updateAvailabilitySchema,
} from "../schemas/agenda.js";

const idParams = z.object({ id: z.string().uuid() });
const appointmentQuery = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  status: z.enum(["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
  project_id: z.string().uuid().optional(),
  beneficiary_person_id: z.string().uuid().optional(),
  professional_member_id: z.string().uuid().optional(),
});
const availabilityQuery = z.object({
  organization_member_id: z.string().uuid().optional(),
  weekday: z.coerce.number().int().min(0).max(6).optional(),
  active: z.enum(["true", "false"]).optional(),
});
const contextSchema = z.object({ organization: z.object({ id: z.string().uuid() }), permissions: z.array(z.string()) });

async function context(auth: any, reply: FastifyReply) {
  const { data, error } = await auth.supabase.rpc("current_user_context");
  const parsed = contextSchema.safeParse(data);
  if (error || !parsed.success) return { ok: false as const, response: reply.code(403).send({ error: "USER_CONTEXT_UNAVAILABLE" }) };
  return { ok: true as const, data: parsed.data };
}

export async function agendaRoutes(app: FastifyInstance) {
  app.get("/api/v1/appointments", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const query = appointmentQuery.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "INVALID_QUERY_PARAMETERS", details: query.error.flatten() });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("appointment.read")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    let db = auth.supabase.from("appointments").select("id,unit_id,project_id,care_request_id,beneficiary_person_id,professional_member_id,appointment_type,starts_at,ends_at,timezone,status,delivery_mode,location_detail,administrative_notes,confirmation_notes,cancellation_reason,no_show_notes,source,external_calendar_id,external_event_id,recurrence_key,confirmed_at,completed_at,cancelled_at,created_at,updated_at").eq("organization_id", ctx.data.organization.id).is("deleted_at", null);
    if (query.data.from) db = db.gte("starts_at", query.data.from);
    if (query.data.to) db = db.lt("starts_at", query.data.to);
    if (query.data.status) db = db.eq("status", query.data.status);
    if (query.data.project_id) db = db.eq("project_id", query.data.project_id);
    if (query.data.beneficiary_person_id) db = db.eq("beneficiary_person_id", query.data.beneficiary_person_id);
    if (query.data.professional_member_id) db = db.eq("professional_member_id", query.data.professional_member_id);
    const { data, error } = await db.order("starts_at");
    if (error) return reply.code(500).send({ error: "APPOINTMENTS_LIST_FAILED" });
    return reply.send({ data: data ?? [], filters: query.data });
  });

  app.post("/api/v1/appointments", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const body = createAppointmentSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "INVALID_APPOINTMENT_DATA", details: body.error.flatten() });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("appointment.create")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const { data, error } = await auth.supabase.from("appointments").insert({
      organization_id: ctx.data.organization.id,
      ...body.data,
      status: "SCHEDULED",
      timezone: body.data.timezone ?? "America/Sao_Paulo",
      delivery_mode: body.data.delivery_mode ?? "IN_PERSON",
      source: body.data.source ?? "INTERNAL",
      created_by: auth.user.id,
      updated_by: auth.user.id,
    }).select().single();
    if (error?.code === "23P01") return reply.code(409).send({ error: "APPOINTMENT_TIME_CONFLICT" });
    if (error?.code === "23514") return reply.code(400).send({ error: error.message });
    if (error?.code === "23505") return reply.code(409).send({ error: "APPOINTMENT_EXTERNAL_EVENT_EXISTS" });
    if (error) return reply.code(500).send({ error: "APPOINTMENT_CREATE_FAILED" });
    return reply.code(201).send({ data });
  });

  app.patch("/api/v1/appointments/:id", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const params = idParams.safeParse(request.params);
    const body = updateAppointmentSchema.safeParse(request.body);
    if (!params.success) return reply.code(400).send({ error: "INVALID_APPOINTMENT_ID" });
    if (!body.success) return reply.code(400).send({ error: "INVALID_APPOINTMENT_DATA", details: body.error.flatten() });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    const permission = body.data.status === "CONFIRMED" ? "appointment.confirm" : "appointment.update";
    if (!ctx.data.permissions.includes(permission)) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const now = new Date().toISOString();
    const transition = body.data.status === "CONFIRMED" ? { confirmed_at: now }
      : body.data.status === "COMPLETED" ? { completed_at: now }
      : body.data.status === "CANCELLED" ? { cancelled_at: now }
      : {};
    const { data, error } = await auth.supabase.from("appointments").update({ ...body.data, ...transition, updated_at: now, updated_by: auth.user.id }).eq("id", params.data.id).eq("organization_id", ctx.data.organization.id).is("deleted_at", null).select().maybeSingle();
    if (error?.code === "23P01") return reply.code(409).send({ error: "APPOINTMENT_TIME_CONFLICT" });
    if (error?.code === "23514") return reply.code(400).send({ error: error.message });
    if (error) return reply.code(500).send({ error: "APPOINTMENT_UPDATE_FAILED" });
    if (!data) return reply.code(404).send({ error: "APPOINTMENT_NOT_FOUND" });
    return reply.send({ data });
  });

  app.get("/api/v1/appointment-availability", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const query = availabilityQuery.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "INVALID_QUERY_PARAMETERS" });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("appointment.read")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    let db = auth.supabase.from("professional_availability").select("id,organization_member_id,unit_id,project_id,weekday,start_time,end_time,timezone,valid_from,valid_until,is_active,created_at,updated_at").eq("organization_id", ctx.data.organization.id).is("deleted_at", null);
    if (query.data.organization_member_id) db = db.eq("organization_member_id", query.data.organization_member_id);
    if (query.data.weekday !== undefined) db = db.eq("weekday", query.data.weekday);
    if (query.data.active !== undefined) db = db.eq("is_active", query.data.active === "true");
    const { data, error } = await db.order("weekday").order("start_time");
    if (error) return reply.code(500).send({ error: "AVAILABILITY_LIST_FAILED" });
    return reply.send({ data: data ?? [] });
  });

  app.post("/api/v1/appointment-availability", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const body = createAvailabilitySchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "INVALID_AVAILABILITY_DATA", details: body.error.flatten() });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("appointment.create")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const { data, error } = await auth.supabase.from("professional_availability").insert({ organization_id: ctx.data.organization.id, ...body.data, timezone: body.data.timezone ?? "America/Sao_Paulo", created_by: auth.user.id, updated_by: auth.user.id }).select().single();
    if (error?.code === "23514") return reply.code(400).send({ error: error.message });
    if (error) return reply.code(500).send({ error: "AVAILABILITY_CREATE_FAILED" });
    return reply.code(201).send({ data });
  });

  app.patch("/api/v1/appointment-availability/:id", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const params = idParams.safeParse(request.params);
    const body = updateAvailabilitySchema.safeParse(request.body);
    if (!params.success) return reply.code(400).send({ error: "INVALID_AVAILABILITY_ID" });
    if (!body.success) return reply.code(400).send({ error: "INVALID_AVAILABILITY_DATA", details: body.error.flatten() });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("appointment.update")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const { data, error } = await auth.supabase.from("professional_availability").update({ ...body.data, updated_at: new Date().toISOString(), updated_by: auth.user.id }).eq("id", params.data.id).eq("organization_id", ctx.data.organization.id).is("deleted_at", null).select().maybeSingle();
    if (error?.code === "23514") return reply.code(400).send({ error: error.message });
    if (error) return reply.code(500).send({ error: "AVAILABILITY_UPDATE_FAILED" });
    if (!data) return reply.code(404).send({ error: "AVAILABILITY_NOT_FOUND" });
    return reply.send({ data });
  });
}
