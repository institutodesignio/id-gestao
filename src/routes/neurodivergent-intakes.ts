import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuthenticatedUser } from "../auth.js";
import { intakeQuerySchema, revokeConsentSchema, submitNeurodivergentIntakeSchema } from "../schemas/neurodivergent-intake.js";

const idParams=z.object({id:z.string().uuid()});
const consentParams=z.object({id:z.string().uuid(),consentId:z.string().uuid()});
const indicatorQuery=z.object({dimension:z.enum(["condition","priority_need"])});
const contextSchema=z.object({organization:z.object({id:z.string().uuid()}),permissions:z.array(z.string())});
async function context(auth:any,reply:FastifyReply){const {data,error}=await auth.supabase.rpc("current_user_context");const parsed=contextSchema.safeParse(data);if(error||!parsed.success)return{ok:false as const,response:reply.code(403).send({error:"USER_CONTEXT_UNAVAILABLE"})};return{ok:true as const,data:parsed.data};}

export async function neurodivergentIntakeRoutes(app:FastifyInstance){
  app.get("/api/v1/neurodivergent-intakes",async(request,reply)=>{
    const auth=await requireAuthenticatedUser(request);if(!auth.ok)return reply.code(auth.statusCode).send({error:auth.error});
    const query=intakeQuerySchema.safeParse(request.query);if(!query.success)return reply.code(400).send({error:"INVALID_QUERY_PARAMETERS",details:query.error.flatten()});
    const ctx=await context(auth,reply);if(!ctx.ok)return ctx.response;if(!ctx.data.permissions.includes("neurodivergent_profile.read"))return reply.code(403).send({error:"PERMISSION_DENIED"});
    const {page,limit,status,person_id}=query.data;let db=auth.supabase.from("neurodivergent_intakes").select("id,person_id,respondent_person_id,protocol_number,respondent_role,channel,status,collected_at,submitted_at,created_at,updated_at",{count:"exact"}).eq("organization_id",ctx.data.organization.id).is("deleted_at",null);
    if(status)db=db.eq("status",status);if(person_id)db=db.eq("person_id",person_id);const {data,error,count}=await db.order("collected_at",{ascending:false}).range((page-1)*limit,page*limit-1);
    if(error)return reply.code(500).send({error:"NEURODIVERGENT_INTAKES_LIST_FAILED"});const total=count??0;return reply.send({data:data??[],pagination:{page,limit,total,totalPages:total?Math.ceil(total/limit):0}});
  });
  app.get("/api/v1/neurodivergent-intakes/:id",async(request,reply)=>{
    const auth=await requireAuthenticatedUser(request);if(!auth.ok)return reply.code(auth.statusCode).send({error:auth.error});const params=idParams.safeParse(request.params);if(!params.success)return reply.code(400).send({error:"INVALID_INTAKE_ID"});
    const ctx=await context(auth,reply);if(!ctx.ok)return ctx.response;if(!ctx.data.permissions.includes("neurodivergent_profile.read"))return reply.code(403).send({error:"PERMISSION_DENIED"});
    const {data,error}=await auth.supabase.from("neurodivergent_intakes").select(`id,person_id,respondent_person_id,protocol_number,respondent_role,respondent_relationship,channel,status,collected_at,submitted_at,neurodivergent_profiles(*),data_consents(id,consented_by_person_id,consent_role,term_version,assent_recorded,communication_channels,signed_at,revoked_at)`).eq("id",params.data.id).eq("organization_id",ctx.data.organization.id).is("deleted_at",null).maybeSingle();
    if(error)return reply.code(500).send({error:"NEURODIVERGENT_INTAKE_READ_FAILED"});if(!data)return reply.code(404).send({error:"NEURODIVERGENT_INTAKE_NOT_FOUND"});return reply.send({data});
  });
  app.post("/api/v1/neurodivergent-intakes/submit",async(request,reply)=>{
    const auth=await requireAuthenticatedUser(request);if(!auth.ok)return reply.code(auth.statusCode).send({error:auth.error});const body=submitNeurodivergentIntakeSchema.safeParse(request.body);if(!body.success)return reply.code(400).send({error:"INVALID_NEURODIVERGENT_INTAKE_DATA",details:body.error.flatten()});
    const ctx=await context(auth,reply);if(!ctx.ok)return ctx.response;if(!ctx.data.permissions.includes("neurodivergent_profile.manage")||!ctx.data.permissions.includes("consent.manage"))return reply.code(403).send({error:"PERMISSION_DENIED"});
    const {data,error}=await auth.supabase.rpc("submit_neurodivergent_intake",{p_organization_id:ctx.data.organization.id,p_payload:body.data});if(error?.code==="23505")return reply.code(409).send({error:"NEURODIVERGENT_INTAKE_CONFLICT"});if(error?.code==="23514")return reply.code(400).send({error:"INVALID_INTAKE_REFERENCE"});if(error)return reply.code(500).send({error:"NEURODIVERGENT_INTAKE_SUBMIT_FAILED"});return reply.code(201).send({data});
  });
  app.patch("/api/v1/neurodivergent-intakes/:id/consents/:consentId/revoke",async(request,reply)=>{
    const auth=await requireAuthenticatedUser(request);if(!auth.ok)return reply.code(auth.statusCode).send({error:auth.error});const params=consentParams.safeParse(request.params);const body=revokeConsentSchema.safeParse(request.body);if(!params.success)return reply.code(400).send({error:"INVALID_CONSENT_ID"});if(!body.success)return reply.code(400).send({error:"INVALID_CONSENT_DATA"});
    const ctx=await context(auth,reply);if(!ctx.ok)return ctx.response;if(!ctx.data.permissions.includes("consent.manage"))return reply.code(403).send({error:"PERMISSION_DENIED"});
    const {data,error}=await auth.supabase.from("data_consents").update({revoked_at:new Date().toISOString(),revocation_reason:body.data.reason,updated_at:new Date().toISOString(),updated_by:auth.user.id}).eq("id",params.data.consentId).eq("intake_id",params.data.id).eq("organization_id",ctx.data.organization.id).is("revoked_at",null).select().maybeSingle();if(error)return reply.code(500).send({error:"CONSENT_REVOCATION_FAILED"});if(!data)return reply.code(404).send({error:"ACTIVE_CONSENT_NOT_FOUND"});return reply.send({data});
  });
  app.get("/api/v1/indicators/neurodivergent-population",async(request,reply)=>{
    const auth=await requireAuthenticatedUser(request);if(!auth.ok)return reply.code(auth.statusCode).send({error:auth.error});const query=indicatorQuery.safeParse(request.query);if(!query.success)return reply.code(400).send({error:"INVALID_INDICATOR_DIMENSION"});const ctx=await context(auth,reply);if(!ctx.ok)return ctx.response;if(!ctx.data.permissions.includes("indicator.read"))return reply.code(403).send({error:"PERMISSION_DENIED"});const {data,error}=await auth.supabase.rpc("neurodivergent_population_indicators",{p_dimension:query.data.dimension});if(error)return reply.code(500).send({error:"INDICATOR_READ_FAILED"});return reply.send({data:data??[],privacy:{minimum_group_size:5,identified_data:false}});
  });
}
