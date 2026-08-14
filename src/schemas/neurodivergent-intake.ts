import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const uuid = z.string().uuid();
const condition = z.enum(["AUTISM","ADHD","DYSLEXIA","DYSCALCULIA","DCD_DYSPRAXIA","TOURETTE","GIFTEDNESS","INTELLECTUAL_DISABILITY","OTHER"]);
const education = z.enum(["EARLY_CHILDHOOD","ELEMENTARY","HIGH_SCHOOL","EJA","HIGHER_TECHNICAL","NOT_ENROLLED","NOT_APPLICABLE"]);
const network = z.enum(["SUS","EDUCATION","SOCIAL_ASSISTANCE","PRIVATE_INSURANCE","NGO","NONE"]);
const need = z.enum(["ASSESSMENT_DIAGNOSIS","PSYCHOLOGY","SPEECH_THERAPY","OCCUPATIONAL_THERAPY","PHYSIOTHERAPY","PSYCHOPEDAGOGY","SCHOOL_SUPPORT","PROFESSIONAL_INCLUSION","FAMILY_GUIDANCE","BENEFITS_RIGHTS","SOCIAL_LEISURE","TRANSPORT","OTHER"]);
const support = z.enum(["PLAIN_LANGUAGE","VISUAL_SUPPORT","SENSORY_ADAPTED_ENVIRONMENT","INTERPRETER","COMPANION","MOBILITY","OTHER"]);

export const submitNeurodivergentIntakeSchema = z.object({
  person_id: uuid,
  respondent_person_id: uuid.nullable().optional(),
  respondent_role: z.enum(["SELF","MOTHER_FATHER","LEGAL_GUARDIAN","CAREGIVER_SUPPORTER","OTHER"]),
  respondent_relationship: optionalText(120),
  channel: z.enum(["IN_PERSON","PAPER","SITE"]).default("SITE"),
  profile: z.object({
    identification_status: z.enum(["DIAGNOSED","UNDER_EVALUATION","SELF_IDENTIFIED_SUSPECTED","PREFER_NOT_TO_SAY"]),
    conditions: z.array(condition).max(9).default([]), other_condition: optionalText(500),
    report_status: z.enum(["YES","NO","IN_PROGRESS","PREFER_NOT_TO_SAY"]).default("PREFER_NOT_TO_SAY"),
    education_statuses: z.array(education).max(7).default([]), education_institution: optionalText(200), school_support_needed: optionalText(1000),
    employment_status: z.enum(["WORKING","SEEKING_WORK","ON_LEAVE","RETIRED","NOT_WORKING","NOT_APPLICABLE"]).nullable().optional(),
    service_networks: z.array(network).max(6).default([]), current_services: optionalText(2000), waiting_for_service: z.boolean().nullable().optional(), waiting_details: optionalText(1000),
    priority_needs: z.array(need).max(5), primary_need_barrier: z.string().trim().min(1).max(2000),
    accessibility_supports: z.array(support).max(7).default([]), accessibility_other: optionalText(500),
  }).strict(),
  consent: z.object({
    consented_by_person_id: uuid, consent_role: z.enum(["SELF_ADULT","MOTHER_FATHER","LEGAL_GUARDIAN"]),
    term_version: z.string().trim().min(1).max(40), sensitive_data_consent: z.literal(true),
    assent_recorded: z.boolean().default(false), communication_channels: z.array(z.enum(["WHATSAPP","PHONE","EMAIL"])).max(3).default([]),
    signed_at: z.string().datetime({ offset: true }),
  }).strict(),
}).strict().superRefine((data, ctx) => {
  if (data.respondent_role === "SELF" && data.respondent_person_id) ctx.addIssue({ code:z.ZodIssueCode.custom,path:["respondent_person_id"],message:"Self respondent must not repeat person id" });
  if (data.respondent_role !== "SELF" && !data.respondent_person_id) ctx.addIssue({ code:z.ZodIssueCode.custom,path:["respondent_person_id"],message:"Respondent person is required" });
  if (data.profile.conditions.includes("OTHER") && !data.profile.other_condition) ctx.addIssue({ code:z.ZodIssueCode.custom,path:["profile","other_condition"],message:"Other condition must be described" });
  if (data.profile.accessibility_supports.includes("OTHER") && !data.profile.accessibility_other) ctx.addIssue({ code:z.ZodIssueCode.custom,path:["profile","accessibility_other"],message:"Other support must be described" });
});

export const intakeQuerySchema = z.object({ status: z.enum(["DRAFT","SUBMITTED","REVIEWED","DUPLICATE","ARCHIVED"]).optional(), person_id: uuid.optional(), page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(100).default(20) });
export const revokeConsentSchema = z.object({ reason:z.string().trim().min(1).max(1000) }).strict();

export const createCareRequestSchema = z.object({ person_id:uuid,intake_id:uuid.nullable().optional(),project_id:uuid.nullable().optional(),category:z.string().trim().min(1).max(120),description:z.string().trim().min(1).max(2000),priority:z.enum(["LOW","NORMAL","HIGH","URGENT"]).optional(),status:z.enum(["IDENTIFIED","WAITING","REFERRED","IN_SERVICE","COMPLETED","CANCELLED"]).optional(),waiting_since:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),referral_destination:optionalText(300),assigned_person_id:uuid.nullable().optional() }).strict();
export const updateCareRequestSchema = createCareRequestSchema.omit({person_id:true,intake_id:true}).partial().refine(v=>Object.keys(v).length>0,"At least one field must be provided");

export const createPrivacyRequestSchema = z.object({person_id:uuid,request_type:z.enum(["CONFIRMATION","ACCESS","CORRECTION","SHARING_INFORMATION","REVOCATION","DELETION","ANONYMIZATION"]),description:optionalText(2000),due_at:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()}).strict();
export const updatePrivacyRequestSchema = z.object({status:z.enum(["RECEIVED","IDENTITY_CHECK","IN_PROGRESS","COMPLETED","DENIED"]).optional(),due_at:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),decision_reason:optionalText(2000)}).strict().refine(v=>Object.keys(v).length>0,"At least one field must be provided");
export const decideRetentionReviewSchema = z.object({decision:z.enum(["KEEP_ACTIVE","ANONYMIZE","DELETE","LEGAL_HOLD"]),reason:z.string().trim().min(1).max(2000)}).strict();
