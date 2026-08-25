import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuthenticatedUser } from "../auth.js";
import {
  approveFinanceTransactionSchema,
  createFinanceAccountSchema,
  createFinanceBudgetLineSchema,
  createFinanceCategorySchema,
  createFinanceCostCenterSchema,
  createFinanceTransactionSchema,
  reconcileFinanceTransactionSchema,
  updateFinanceTransactionSchema,
} from "../schemas/finance.js";

const idParams = z.object({ id: z.string().uuid() });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const financeQuery = z.object({
  from: date.optional(),
  to: date.optional(),
  type: z.enum(["INCOME", "EXPENSE"]).optional(),
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "PAID", "CANCELLED"]).optional(),
  project_id: z.string().uuid().optional(),
  cost_center_id: z.string().uuid().optional(),
});
const budgetQuery = z.object({ fiscal_year: z.coerce.number().int().min(2000).max(2200).optional() });
const summaryQuery = z.object({ from: date, to: date }).refine((value) => value.to >= value.from, { message: "to must not precede from", path: ["to"] });
const contextSchema = z.object({ organization: z.object({ id: z.string().uuid() }), permissions: z.array(z.string()) });

async function context(auth: any, reply: FastifyReply) {
  const { data, error } = await auth.supabase.rpc("current_user_context");
  const parsed = contextSchema.safeParse(data);
  if (error || !parsed.success) return { ok: false as const, response: reply.code(403).send({ error: "USER_CONTEXT_UNAVAILABLE" }) };
  return { ok: true as const, data: parsed.data };
}

export async function financeRoutes(app: FastifyInstance) {
  app.get("/api/v1/finance/setup", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request); if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const query = budgetQuery.safeParse(request.query); if (!query.success) return reply.code(400).send({ error: "INVALID_QUERY_PARAMETERS" });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("finance.read")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    let budgets = auth.supabase.from("finance_budget_lines").select("*").eq("organization_id", ctx.data.organization.id);
    if (query.data.fiscal_year) budgets = budgets.eq("fiscal_year", query.data.fiscal_year);
    const results = await Promise.all([
      auth.supabase.from("finance_accounts").select("*").eq("organization_id", ctx.data.organization.id).is("deleted_at", null).order("code"),
      auth.supabase.from("finance_categories").select("*").eq("organization_id", ctx.data.organization.id).is("deleted_at", null).order("code"),
      auth.supabase.from("finance_cost_centers").select("*").eq("organization_id", ctx.data.organization.id).is("deleted_at", null).order("code"),
      budgets.order("fiscal_year", { ascending: false }),
    ]);
    if (results.some((result) => result.error)) return reply.code(500).send({ error: "FINANCE_SETUP_READ_FAILED" });
    return reply.send({ data: { accounts: results[0].data ?? [], categories: results[1].data ?? [], cost_centers: results[2].data ?? [], budget_lines: results[3].data ?? [] } });
  });

  app.post("/api/v1/finance/accounts", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request); if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const body = createFinanceAccountSchema.safeParse(request.body); if (!body.success) return reply.code(400).send({ error: "INVALID_FINANCE_ACCOUNT_DATA", details: body.error.flatten() });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("finance.create")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const { data, error } = await auth.supabase.from("finance_accounts").insert({ organization_id: ctx.data.organization.id, ...body.data, opening_balance: body.data.opening_balance ?? 0, created_by: auth.user.id, updated_by: auth.user.id }).select().single();
    if (error?.code === "23505") return reply.code(409).send({ error: "FINANCE_ACCOUNT_CODE_EXISTS" });
    if (error) return reply.code(500).send({ error: "FINANCE_ACCOUNT_CREATE_FAILED" });
    return reply.code(201).send({ data });
  });

  app.post("/api/v1/finance/categories", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request); if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const body = createFinanceCategorySchema.safeParse(request.body); if (!body.success) return reply.code(400).send({ error: "INVALID_FINANCE_CATEGORY_DATA", details: body.error.flatten() });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("finance.create")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const { data, error } = await auth.supabase.from("finance_categories").insert({ organization_id: ctx.data.organization.id, ...body.data, created_by: auth.user.id, updated_by: auth.user.id }).select().single();
    if (error?.code === "23505") return reply.code(409).send({ error: "FINANCE_CATEGORY_CODE_EXISTS" });
    if (error?.code === "23514") return reply.code(400).send({ error: error.message });
    if (error) return reply.code(500).send({ error: "FINANCE_CATEGORY_CREATE_FAILED" });
    return reply.code(201).send({ data });
  });

  app.post("/api/v1/finance/cost-centers", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request); if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const body = createFinanceCostCenterSchema.safeParse(request.body); if (!body.success) return reply.code(400).send({ error: "INVALID_FINANCE_COST_CENTER_DATA", details: body.error.flatten() });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("finance.create")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const { data, error } = await auth.supabase.from("finance_cost_centers").insert({ organization_id: ctx.data.organization.id, ...body.data, created_by: auth.user.id, updated_by: auth.user.id }).select().single();
    if (error?.code === "23505") return reply.code(409).send({ error: "FINANCE_COST_CENTER_CODE_EXISTS" });
    if (error?.code === "23514") return reply.code(400).send({ error: error.message });
    if (error) return reply.code(500).send({ error: "FINANCE_COST_CENTER_CREATE_FAILED" });
    return reply.code(201).send({ data });
  });

  app.post("/api/v1/finance/budget-lines", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request); if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const body = createFinanceBudgetLineSchema.safeParse(request.body); if (!body.success) return reply.code(400).send({ error: "INVALID_FINANCE_BUDGET_DATA", details: body.error.flatten() });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("finance.create")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const { data, error } = await auth.supabase.from("finance_budget_lines").insert({ organization_id: ctx.data.organization.id, ...body.data, funding_source: body.data.funding_source ?? "OWN_FUNDS", created_by: auth.user.id, updated_by: auth.user.id }).select().single();
    if (error?.code === "23505") return reply.code(409).send({ error: "FINANCE_BUDGET_LINE_EXISTS" });
    if (error?.code === "23514") return reply.code(400).send({ error: error.message });
    if (error) return reply.code(500).send({ error: "FINANCE_BUDGET_CREATE_FAILED" });
    return reply.code(201).send({ data });
  });

  app.get("/api/v1/finance/transactions", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request); if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const query = financeQuery.safeParse(request.query); if (!query.success) return reply.code(400).send({ error: "INVALID_QUERY_PARAMETERS" });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("finance.read")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    let db = auth.supabase.from("finance_transactions").select("*,finance_transaction_allocations(*)").eq("organization_id", ctx.data.organization.id).is("deleted_at", null);
    if (query.data.from) db = db.gte("competence_date", query.data.from);
    if (query.data.to) db = db.lte("competence_date", query.data.to);
    if (query.data.type) db = db.eq("transaction_type", query.data.type);
    if (query.data.status) db = db.eq("status", query.data.status);
    if (query.data.project_id) db = db.eq("project_id", query.data.project_id);
    if (query.data.cost_center_id) db = db.eq("cost_center_id", query.data.cost_center_id);
    const { data, error } = await db.order("competence_date", { ascending: false }).order("created_at", { ascending: false });
    if (error) return reply.code(500).send({ error: "FINANCE_TRANSACTIONS_LIST_FAILED" });
    return reply.send({ data: data ?? [], filters: query.data });
  });

  app.post("/api/v1/finance/transactions", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request); if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const body = createFinanceTransactionSchema.safeParse(request.body); if (!body.success) return reply.code(400).send({ error: "INVALID_FINANCE_TRANSACTION_DATA", details: body.error.flatten() });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("finance.create")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const { data, error } = await auth.supabase.rpc("create_finance_transaction", { p_organization_id: ctx.data.organization.id, p_payload: body.data });
    if (error?.code === "23514") return reply.code(400).send({ error: error.message });
    if (error?.code === "42501") return reply.code(403).send({ error: "PERMISSION_DENIED" });
    if (error) return reply.code(500).send({ error: "FINANCE_TRANSACTION_CREATE_FAILED" });
    return reply.code(201).send({ data });
  });

  app.patch("/api/v1/finance/transactions/:id", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request); if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const params = idParams.safeParse(request.params); const body = updateFinanceTransactionSchema.safeParse(request.body);
    if (!params.success) return reply.code(400).send({ error: "INVALID_FINANCE_TRANSACTION_ID" });
    if (!body.success) return reply.code(400).send({ error: "INVALID_FINANCE_TRANSACTION_DATA", details: body.error.flatten() });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("finance.update")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const { data, error } = await auth.supabase.from("finance_transactions").update({ ...body.data, updated_at: new Date().toISOString(), updated_by: auth.user.id }).eq("id", params.data.id).eq("organization_id", ctx.data.organization.id).is("deleted_at", null).select().maybeSingle();
    if (error?.code === "23514") return reply.code(400).send({ error: error.message });
    if (error) return reply.code(500).send({ error: "FINANCE_TRANSACTION_UPDATE_FAILED" });
    if (!data) return reply.code(404).send({ error: "FINANCE_TRANSACTION_NOT_FOUND" });
    return reply.send({ data });
  });

  app.post("/api/v1/finance/transactions/:id/approve", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request); if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const params = idParams.safeParse(request.params); const body = approveFinanceTransactionSchema.safeParse(request.body);
    if (!params.success) return reply.code(400).send({ error: "INVALID_FINANCE_TRANSACTION_ID" });
    if (!body.success) return reply.code(400).send({ error: "INVALID_FINANCE_APPROVAL_DATA", details: body.error.flatten() });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("finance.approve")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const now = new Date().toISOString(); const paid = body.data.mark_as_paid === true;
    const { data, error } = await auth.supabase.from("finance_transactions").update({ status: paid ? "PAID" : "APPROVED", approved_at: now, approved_by_auth_user_id: auth.user.id, ...(paid ? { paid_at: body.data.paid_at } : {}), updated_at: now, updated_by: auth.user.id }).eq("id", params.data.id).eq("organization_id", ctx.data.organization.id).in("status", ["DRAFT", "PENDING_APPROVAL", "APPROVED"]).is("deleted_at", null).select().maybeSingle();
    if (error?.code === "42501") return reply.code(403).send({ error: "PERMISSION_DENIED" });
    if (error) return reply.code(500).send({ error: "FINANCE_TRANSACTION_APPROVAL_FAILED" });
    if (!data) return reply.code(404).send({ error: "FINANCE_TRANSACTION_NOT_FOUND_OR_NOT_APPROVABLE" });
    return reply.send({ data });
  });

  app.post("/api/v1/finance/transactions/:id/reconcile", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request); if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const params = idParams.safeParse(request.params); const body = reconcileFinanceTransactionSchema.safeParse(request.body);
    if (!params.success) return reply.code(400).send({ error: "INVALID_FINANCE_TRANSACTION_ID" });
    if (!body.success) return reply.code(400).send({ error: "INVALID_FINANCE_RECONCILIATION_DATA" });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("finance.reconcile")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const now = body.data.reconciled_at ?? new Date().toISOString();
    const { data, error } = await auth.supabase.from("finance_transactions").update({ reconciliation_status: "RECONCILED", reconciled_at: now, reconciled_by_auth_user_id: auth.user.id, external_reference: body.data.external_reference, updated_at: new Date().toISOString(), updated_by: auth.user.id }).eq("id", params.data.id).eq("organization_id", ctx.data.organization.id).eq("status", "PAID").is("deleted_at", null).select().maybeSingle();
    if (error?.code === "42501") return reply.code(403).send({ error: "PERMISSION_DENIED" });
    if (error) return reply.code(500).send({ error: "FINANCE_TRANSACTION_RECONCILIATION_FAILED" });
    if (!data) return reply.code(404).send({ error: "FINANCE_TRANSACTION_NOT_FOUND_OR_NOT_PAID" });
    return reply.send({ data });
  });

  app.get("/api/v1/finance/summary", async (request, reply) => {
    const auth = await requireAuthenticatedUser(request); if (!auth.ok) return reply.code(auth.statusCode).send({ error: auth.error });
    const query = summaryQuery.safeParse(request.query); if (!query.success) return reply.code(400).send({ error: "INVALID_QUERY_PARAMETERS", details: query.error.flatten() });
    const ctx = await context(auth, reply); if (!ctx.ok) return ctx.response;
    if (!ctx.data.permissions.includes("finance.read")) return reply.code(403).send({ error: "PERMISSION_DENIED" });
    const { data, error } = await auth.supabase.rpc("finance_period_summary", { p_organization_id: ctx.data.organization.id, p_from: query.data.from, p_to: query.data.to });
    if (error) return reply.code(500).send({ error: "FINANCE_SUMMARY_FAILED" });
    return reply.send({ data });
  });
}
