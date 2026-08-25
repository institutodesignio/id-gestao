import { z } from "zod";

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const money = z.number().positive().max(999_999_999_999.99);
const fundingSource = z.enum(["OWN_FUNDS", "DONATION", "PUBLIC_GRANT", "PRIVATE_GRANT", "PARTNERSHIP", "OTHER"]);

export const createFinanceAccountSchema = z.object({
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(200),
  account_type: z.enum(["BANK", "CASH", "DIGITAL_WALLET", "OTHER"]),
  institution_name: z.string().trim().max(160).nullable().optional(),
  branch_number: z.string().trim().max(40).nullable().optional(),
  account_last_four: z.string().regex(/^\d{4}$/).nullable().optional(),
  opening_balance: z.number().min(-999_999_999_999.99).max(999_999_999_999.99).optional(),
}).strict();

export const createFinanceCategorySchema = z.object({
  parent_id: uuid.nullable().optional(),
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(200),
  category_type: z.enum(["INCOME", "EXPENSE", "BOTH"]),
}).strict();

export const createFinanceCostCenterSchema = z.object({
  project_id: uuid.nullable().optional(),
  unit_id: uuid.nullable().optional(),
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(200),
  valid_from: date.nullable().optional(),
  valid_until: date.nullable().optional(),
}).strict();

export const createFinanceBudgetLineSchema = z.object({
  fiscal_year: z.number().int().min(2000).max(2200),
  project_id: uuid.nullable().optional(),
  cost_center_id: uuid.nullable().optional(),
  category_id: uuid,
  funding_source: fundingSource.optional(),
  planned_amount: z.number().nonnegative().max(999_999_999_999.99),
  notes: z.string().trim().max(2000).nullable().optional(),
}).strict();

export const transactionAllocationSchema = z.object({
  cost_center_id: uuid,
  project_id: uuid.nullable().optional(),
  amount: money,
  description: z.string().trim().max(500).nullable().optional(),
}).strict();

export const createFinanceTransactionSchema = z.object({
  account_id: uuid.nullable().optional(),
  category_id: uuid,
  cost_center_id: uuid.nullable().optional(),
  project_id: uuid.nullable().optional(),
  unit_id: uuid.nullable().optional(),
  counterparty_person_id: uuid.nullable().optional(),
  supporting_document_id: uuid.nullable().optional(),
  transaction_type: z.enum(["INCOME", "EXPENSE"]),
  status: z.enum(["DRAFT", "PENDING_APPROVAL"]).optional(),
  description: z.string().trim().min(1).max(2000),
  amount: money,
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  competence_date: date,
  due_date: date.nullable().optional(),
  funding_source: fundingSource.optional(),
  funding_reference: z.string().trim().max(255).nullable().optional(),
  external_reference: z.string().trim().max(255).nullable().optional(),
  allocations: z.array(transactionAllocationSchema).max(50).optional(),
}).strict().refine((value) => !value.allocations || value.allocations.reduce((sum, item) => sum + item.amount, 0) <= value.amount, {
  message: "Allocation total cannot exceed transaction amount",
  path: ["allocations"],
});

export const updateFinanceTransactionSchema = z.object({
  account_id: uuid.nullable().optional(),
  category_id: uuid.optional(),
  cost_center_id: uuid.nullable().optional(),
  project_id: uuid.nullable().optional(),
  unit_id: uuid.nullable().optional(),
  counterparty_person_id: uuid.nullable().optional(),
  supporting_document_id: uuid.nullable().optional(),
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "CANCELLED"]).optional(),
  description: z.string().trim().min(1).max(2000).optional(),
  amount: money.optional(),
  competence_date: date.optional(),
  due_date: date.nullable().optional(),
  funding_source: fundingSource.optional(),
  funding_reference: z.string().trim().max(255).nullable().optional(),
  external_reference: z.string().trim().max(255).nullable().optional(),
  cancellation_reason: z.string().trim().max(2000).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field must be provided");

export const approveFinanceTransactionSchema = z.object({
  mark_as_paid: z.boolean().optional(),
  paid_at: z.string().datetime({ offset: true }).optional(),
}).strict().refine((value) => !value.mark_as_paid || Boolean(value.paid_at), {
  message: "paid_at is required when mark_as_paid is true",
  path: ["paid_at"],
});

export const reconcileFinanceTransactionSchema = z.object({
  reconciled_at: z.string().datetime({ offset: true }).optional(),
  external_reference: z.string().trim().max(255).nullable().optional(),
}).strict();
