import {describe,expect,it} from "vitest";
import {createCareRequestSchema,createPrivacyRequestSchema,submitNeurodivergentIntakeSchema} from "../../src/schemas/neurodivergent-intake.js";
const person="11111111-1111-4111-8111-111111111111";
const valid={person_id:person,respondent_role:"SELF",channel:"SITE",profile:{identification_status:"UNDER_EVALUATION",conditions:["AUTISM"],report_status:"IN_PROGRESS",education_statuses:["HIGH_SCHOOL"],service_networks:["SUS"],priority_needs:["ASSESSMENT_DIAGNOSIS"],primary_need_barrier:"Aguardar avaliação",accessibility_supports:["PLAIN_LANGUAGE"]},consent:{consented_by_person_id:person,consent_role:"SELF_ADULT",term_version:"1.0",sensitive_data_consent:true,assent_recorded:true,communication_channels:["WHATSAPP"],signed_at:"2026-08-14T10:00:00-03:00"}};
describe("neurodivergent intake schemas",()=>{
 it("accepts the complete form contract",()=>expect(submitNeurodivergentIntakeSchema.safeParse(valid).success).toBe(true));
 it("requires a respondent person for third-party answers",()=>expect(submitNeurodivergentIntakeSchema.safeParse({...valid,respondent_role:"LEGAL_GUARDIAN"}).success).toBe(false));
 it("limits priority needs to five",()=>expect(submitNeurodivergentIntakeSchema.safeParse({...valid,profile:{...valid.profile,priority_needs:["PSYCHOLOGY","SPEECH_THERAPY","OCCUPATIONAL_THERAPY","PHYSIOTHERAPY","SCHOOL_SUPPORT","TRANSPORT"]}}).success).toBe(false));
 it("requires explicit sensitive-data consent",()=>expect(submitNeurodivergentIntakeSchema.safeParse({...valid,consent:{...valid.consent,sensitive_data_consent:false}}).success).toBe(false));
 it("requires descriptions for other condition",()=>expect(submitNeurodivergentIntakeSchema.safeParse({...valid,profile:{...valid.profile,conditions:["OTHER"]}}).success).toBe(false));
 it("accepts a care request",()=>expect(createCareRequestSchema.safeParse({person_id:person,category:"PSYCHOLOGY",description:"Atendimento"}).success).toBe(true));
 it("accepts a privacy request",()=>expect(createPrivacyRequestSchema.safeParse({person_id:person,request_type:"ACCESS"}).success).toBe(true));
});
