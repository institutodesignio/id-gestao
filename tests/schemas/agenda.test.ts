import { describe, expect, it } from "vitest";
import { createAppointmentSchema, createAvailabilitySchema, updateAppointmentSchema } from "../../src/schemas/agenda.js";

const beneficiary = "11111111-1111-4111-8111-111111111111";
const professional = "22222222-2222-4222-8222-222222222222";

describe("Agenda schemas", () => {
  it("accepts an offset-aware appointment", () => {
    expect(createAppointmentSchema.safeParse({ beneficiary_person_id: beneficiary, professional_member_id: professional, appointment_type: "Atendimento", starts_at: "2026-09-01T09:00:00-03:00", ends_at: "2026-09-01T10:00:00-03:00" }).success).toBe(true);
  });

  it("rejects an appointment whose end precedes its start", () => {
    expect(createAppointmentSchema.safeParse({ beneficiary_person_id: beneficiary, professional_member_id: professional, appointment_type: "Atendimento", starts_at: "2026-09-01T10:00:00-03:00", ends_at: "2026-09-01T09:00:00-03:00" }).success).toBe(false);
  });

  it("rejects availability with an invalid weekday", () => {
    expect(createAvailabilitySchema.safeParse({ organization_member_id: professional, weekday: 7, start_time: "09:00", end_time: "10:00" }).success).toBe(false);
  });

  it("rejects empty appointment updates", () => {
    expect(updateAppointmentSchema.safeParse({}).success).toBe(false);
  });

  it("requires an explanation for cancellation and no-show states", () => {
    expect(updateAppointmentSchema.safeParse({ status: "CANCELLED" }).success).toBe(false);
    expect(updateAppointmentSchema.safeParse({ status: "CANCELLED", cancellation_reason: "Solicitação da família" }).success).toBe(true);
    expect(updateAppointmentSchema.safeParse({ status: "NO_SHOW" }).success).toBe(false);
    expect(updateAppointmentSchema.safeParse({ status: "NO_SHOW", no_show_notes: "Ausência registrada após contato" }).success).toBe(true);
  });
});
