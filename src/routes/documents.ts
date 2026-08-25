import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuthenticatedUser } from "../auth.js";
import { createAdminSupabaseClient } from "../plugins/supabase.js";
import {
  createDocumentSchema,
  createDocumentSignatureSchema,
  createDocumentTemplateSchema,
  createDocumentVersionSchema,
  requestDocumentUploadSchema,
  updateDocumentSchema,
  updateDocumentSignatureSchema,
  updateDocumentTemplateSchema,
} from "../schemas/documents.js";

const idParams = z.object({ id: z.string().uuid() });
const signatureParams = z.object({ id: z.string().uuid(), signatureId: z.string().uuid() });
const documentQuery = z.object({
  status: z.enum(["DRAFT", "READY_FOR_APPROVAL", "APPROVED", "SIGNED", "ARCHIVED", "VOID"]).optional(),
  category: z.string().trim().max(80).optional(),
  classification: z.enum(["INTERNAL", "CONFIDENTIAL", "CLINICAL", "FINANCIAL"]).optional(),
  person_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
});
const contextSchema = z.object({ organization: z.object({ id: z.string().uuid() }), permissions: z.array(z.string()) });

async function context(auth: any, reply: FastifyReply) {
  const { data, error } = await auth.supabase.rpc("current_user_context");
  const parsed = contextSchema.safeParse(data);
  if (error || !parsed.success) return { ok: false as const, response: reply.code(403).send({ error: "USER_CONTEXT_UNAVAILABLE" }) };
  return { ok: true as const, data: parsed.data };
}

function safeFilename(filename: string) {
  return filename.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180) || "document";
}

export async function documentRoutes(app: FastifyInstance) {
  app.get("/api/v1/document-templates", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request); if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("document.read")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const { data, error } = await auth.supabase.from("document_templates").select("id,code,title,category,version,status,field_schema,requires_approval,requires_signature,created_at,updated_at").eq("organization_id", ctx.data.organization.id).is("deleted_at", null).order("code").order("version", { ascending: false });
    if (error) return reply.code(500).send({ error: "DOCUMENT_TEMPLATES_LIST_FAILED" });
    return reply.send({ data: data ?? [] });
  });

  app.post("/api/v1/document-templates", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request); if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const body = createDocumentTemplateSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "INVALID_DOCUMENT_TEMPLATE_DATA", details: body.error.flatten() });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("document.create")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const { data, error } = await auth.supabase.from("document_templates").insert({ organization_id: ctx.data.organization.id, ...body.data, version: body.data.version ?? 1, field_schema: body.data.field_schema ?? {}, requires_approval: body.data.requires_approval ?? true, requires_signature: body.data.requires_signature ?? false, created_by: auth.user.id, updated_by: auth.user.id }).select().single();
    if (error?.code === "23505") return reply.code(409).send({ error: "DOCUMENT_TEMPLATE_VERSION_EXISTS" });
    if (error) return reply.code(500).send({ error: "DOCUMENT_TEMPLATE_CREATE_FAILED" });
    return reply.code(201).send({ data });
  });

  app.patch("/api/v1/document-templates/:id", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request); if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const params = idParams.safeParse(request.params); const body = updateDocumentTemplateSchema.safeParse(request.body);
    if (!params.success) return reply.code(400).send({ error: "INVALID_DOCUMENT_TEMPLATE_ID" });
    if (!body.success) return reply.code(400).send({ error: "INVALID_DOCUMENT_TEMPLATE_DATA", details: body.error.flatten() });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("document.update")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const { data, error } = await auth.supabase.from("document_templates").update({ ...body.data, updated_at: new Date().toISOString(), updated_by: auth.user.id }).eq("id", params.data.id).eq("organization_id", ctx.data.organization.id).is("deleted_at", null).select().maybeSingle();
    if (error) return reply.code(500).send({ error: "DOCUMENT_TEMPLATE_UPDATE_FAILED" });
    if (!data) return reply.code(404).send({ error: "DOCUMENT_TEMPLATE_NOT_FOUND" });
    return reply.send({ data });
  });

  app.get("/api/v1/documents", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request); if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const query = documentQuery.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "INVALID_QUERY_PARAMETERS" });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("document.read")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    let db = auth.supabase.from("documents").select("id,template_id,person_id,project_id,unit_id,appointment_id,clinical_case_id,category,classification,title,description,status,current_version,approved_at,signed_at,voided_at,void_reason,created_at,updated_at").eq("organization_id", ctx.data.organization.id).is("deleted_at", null);
    if (query.data.status) db = db.eq("status", query.data.status);
    if (query.data.category) db = db.eq("category", query.data.category);
    if (query.data.classification) db = db.eq("classification", query.data.classification);
    if (query.data.person_id) db = db.eq("person_id", query.data.person_id);
    if (query.data.project_id) db = db.eq("project_id", query.data.project_id);
    const { data, error } = await db.order("updated_at", { ascending: false });
    if (error) return reply.code(500).send({ error: "DOCUMENTS_LIST_FAILED" });
    return reply.send({ data: data ?? [], filters: query.data });
  });

  app.post("/api/v1/documents", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request); if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const body = createDocumentSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "INVALID_DOCUMENT_DATA", details: body.error.flatten() });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("document.create")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    if (body.data.classification === "CLINICAL" && !ctx.data.permissions.includes("clinical_record.create")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const { data, error } = await auth.supabase.from("documents").insert({ organization_id: ctx.data.organization.id, ...body.data, classification: body.data.classification ?? "INTERNAL", created_by: auth.user.id, updated_by: auth.user.id }).select().single();
    if (error?.code === "23514") return reply.code(400).send({ error: error.message });
    if (error) return reply.code(500).send({ error: "DOCUMENT_CREATE_FAILED" });
    return reply.code(201).send({ data });
  });

  app.get("/api/v1/documents/:id", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request); if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const params = idParams.safeParse(request.params); if (!params.success) return reply.code(400).send({ error: "INVALID_DOCUMENT_ID" });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("document.read")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const { data, error } = await auth.supabase.from("documents").select("*,document_versions(*),document_signatures(*)").eq("id", params.data.id).eq("organization_id", ctx.data.organization.id).is("deleted_at", null).maybeSingle();
    if (error) return reply.code(500).send({ error: "DOCUMENT_READ_FAILED" });
    if (!data) return reply.code(404).send({ error: "DOCUMENT_NOT_FOUND" });
    return reply.send({ data });
  });

  app.patch("/api/v1/documents/:id", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request); if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const params = idParams.safeParse(request.params); const body = updateDocumentSchema.safeParse(request.body);
    if (!params.success) return reply.code(400).send({ error: "INVALID_DOCUMENT_ID" });
    if (!body.success) return reply.code(400).send({ error: "INVALID_DOCUMENT_DATA", details: body.error.flatten() });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    const required = body.data.status === "APPROVED" ? "document.approve" : body.data.status === "SIGNED" ? "document.sign" : "document.update";
    if (!ctx.data.permissions.includes(required)) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const now = new Date().toISOString();
    const transition = body.data.status === "APPROVED" ? { approved_at: now, approved_by_auth_user_id: auth.user.id }
      : body.data.status === "SIGNED" ? { signed_at: now }
      : body.data.status === "VOID" ? { voided_at: now }
      : {};
    const { data, error } = await auth.supabase.from("documents").update({ ...body.data, ...transition, updated_at: now, updated_by: auth.user.id }).eq("id", params.data.id).eq("organization_id", ctx.data.organization.id).is("deleted_at", null).select().maybeSingle();
    if (error?.code === "42501") return reply.code(403).send({ error: error.message });
    if (error) return reply.code(500).send({ error: "DOCUMENT_UPDATE_FAILED" });
    if (!data) return reply.code(404).send({ error: "DOCUMENT_NOT_FOUND" });
    return reply.send({ data });
  });

  app.post("/api/v1/documents/:id/versions", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request); if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const params = idParams.safeParse(request.params); const body = createDocumentVersionSchema.safeParse(request.body);
    if (!params.success) return reply.code(400).send({ error: "INVALID_DOCUMENT_ID" });
    if (!body.success) return reply.code(400).send({ error: "INVALID_DOCUMENT_VERSION_DATA", details: body.error.flatten() });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("document.update")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const { data: document, error: readError } = await auth.supabase.from("documents").select("id,current_version").eq("id", params.data.id).eq("organization_id", ctx.data.organization.id).is("deleted_at", null).maybeSingle();
    if (readError) return reply.code(500).send({ error: "DOCUMENT_READ_FAILED" });
    if (!document) return reply.code(404).send({ error: "DOCUMENT_NOT_FOUND" });
    const version = document.current_version + 1;
    const filename = body.data.original_filename ? safeFilename(body.data.original_filename) : null;
    const storagePath = filename ? `${ctx.data.organization.id}/${document.id}/${version}/${filename}` : null;
    const { data, error } = await auth.supabase.from("document_versions").insert({ organization_id: ctx.data.organization.id, document_id: document.id, version_number: version, content: body.data.content ?? {}, storage_bucket: storagePath ? "id-gestao-documents" : null, storage_path: storagePath, original_filename: body.data.original_filename ?? null, mime_type: body.data.mime_type ?? null, file_size_bytes: body.data.file_size_bytes ?? null, checksum_sha256: body.data.checksum_sha256 ?? null, change_summary: body.data.change_summary ?? null, created_by: auth.user.id }).select().single();
    if (error?.code === "23505") return reply.code(409).send({ error: "DOCUMENT_VERSION_CONFLICT" });
    if (error?.code === "23514") return reply.code(400).send({ error: error.message });
    if (error) return reply.code(500).send({ error: "DOCUMENT_VERSION_CREATE_FAILED" });
    return reply.code(201).send({ data });
  });

  app.post("/api/v1/documents/:id/upload-url", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request); if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const params = idParams.safeParse(request.params); const body = requestDocumentUploadSchema.safeParse(request.body);
    if (!params.success) return reply.code(400).send({ error: "INVALID_DOCUMENT_ID" });
    if (!body.success) return reply.code(400).send({ error: "INVALID_UPLOAD_REQUEST", details: body.error.flatten() });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("document.update")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const { data: document } = await auth.supabase.from("documents").select("id,current_version").eq("id", params.data.id).eq("organization_id", ctx.data.organization.id).is("deleted_at", null).maybeSingle();
    if (!document) return reply.code(404).send({ error: "DOCUMENT_NOT_FOUND" });
    if (body.data.version_number !== document.current_version + 1) return reply.code(409).send({ error: "DOCUMENT_VERSION_CONFLICT" });
    const admin = createAdminSupabaseClient(); if (!admin) return reply.code(503).send({ error: "ADMIN_CLIENT_NOT_CONFIGURED" });
    const path = `${ctx.data.organization.id}/${document.id}/${body.data.version_number}/${safeFilename(body.data.filename)}`;
    const { data, error } = await admin.storage.from("id-gestao-documents").createSignedUploadUrl(path);
    if (error) return reply.code(500).send({ error: "DOCUMENT_UPLOAD_URL_FAILED" });
    return reply.send({ data: { ...data, path, bucket: "id-gestao-documents", mime_type: body.data.mime_type, expires_in_seconds: 7200 } });
  });

  app.get("/api/v1/documents/:id/download-url", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request); if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const params = idParams.safeParse(request.params); if (!params.success) return reply.code(400).send({ error: "INVALID_DOCUMENT_ID" });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("document.export")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const { data: document } = await auth.supabase.from("documents").select("id,current_version").eq("id", params.data.id).eq("organization_id", ctx.data.organization.id).is("deleted_at", null).maybeSingle();
    if (!document) return reply.code(404).send({ error: "DOCUMENT_NOT_FOUND" });
    const { data: version } = await auth.supabase.from("document_versions").select("storage_bucket,storage_path,original_filename").eq("document_id", document.id).eq("version_number", document.current_version).maybeSingle();
    if (!version?.storage_path || !version.storage_bucket) return reply.code(404).send({ error: "DOCUMENT_FILE_NOT_FOUND" });
    const admin = createAdminSupabaseClient(); if (!admin) return reply.code(503).send({ error: "ADMIN_CLIENT_NOT_CONFIGURED" });
    const { data, error } = await admin.storage.from(version.storage_bucket).createSignedUrl(version.storage_path, 300, { download: version.original_filename ?? true });
    if (error) return reply.code(500).send({ error: "DOCUMENT_DOWNLOAD_URL_FAILED" });
    return reply.send({ data: { ...data, expires_in_seconds: 300 } });
  });

  app.post("/api/v1/documents/:id/signatures", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request); if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const params = idParams.safeParse(request.params); const body = createDocumentSignatureSchema.safeParse(request.body);
    if (!params.success) return reply.code(400).send({ error: "INVALID_DOCUMENT_ID" });
    if (!body.success) return reply.code(400).send({ error: "INVALID_DOCUMENT_SIGNATURE_DATA", details: body.error.flatten() });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("document.sign")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const { data, error } = await auth.supabase.from("document_signatures").insert({ organization_id: ctx.data.organization.id, document_id: params.data.id, ...body.data, signer_auth_user_id: auth.user.id, metadata: body.data.metadata ?? {}, created_by: auth.user.id, updated_by: auth.user.id }).select().single();
    if (error?.code === "23514") return reply.code(400).send({ error: error.message });
    if (error) return reply.code(500).send({ error: "DOCUMENT_SIGNATURE_CREATE_FAILED" });
    return reply.code(201).send({ data });
  });

  app.patch("/api/v1/documents/:id/signatures/:signatureId", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request); if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const params = signatureParams.safeParse(request.params); const body = updateDocumentSignatureSchema.safeParse(request.body);
    if (!params.success) return reply.code(400).send({ error: "INVALID_DOCUMENT_SIGNATURE_ID" });
    if (!body.success) return reply.code(400).send({ error: "INVALID_DOCUMENT_SIGNATURE_DATA" });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("document.sign")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const now = new Date().toISOString();
    const transition = body.data.status === "SIGNED" ? { signed_at: now } : body.data.status === "REVOKED" ? { revoked_at: now } : {};
    const { data, error } = await auth.supabase.from("document_signatures").update({ ...body.data, ...transition, updated_at: now, updated_by: auth.user.id }).eq("id", params.data.signatureId).eq("document_id", params.data.id).eq("organization_id", ctx.data.organization.id).select().maybeSingle();
    if (error) return reply.code(500).send({ error: "DOCUMENT_SIGNATURE_UPDATE_FAILED" });
    if (!data) return reply.code(404).send({ error: "DOCUMENT_SIGNATURE_NOT_FOUND" });
    return reply.send({ data });
  });
}
