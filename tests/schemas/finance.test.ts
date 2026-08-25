import { describe, expect, it } from "vitest";
import { approveFinanceTransactionSchema, createFinanceAccountSchema, createFinanceTransactionSchema, updateFinanceTransactionSchema } from "../../src/schemas/finance.js";

const category = "11111111-1111-4111-8111-111111111111";
const costCenter = "22222222-2222-4222-8222-222222222222";

describe("Finance schemas", () => {
  it("accepts a multi-tenant financial transaction contract", () => {
    expect(createFinanceTransactionSchema.safeParse({ category_id: category, transaction_type: "EXPENSE", description: "Material de expediente", amount: 150.5, competence_date: "2026-09-01", allocations: [{ cost_center_id: costCenter, amount: 150.5 }] }).success).toBe(true);
  });

  it("rejects allocations above the transaction amount", () => {
    expect(createFinanceTransactionSchema.safeParse({ category_id: category, transaction_type: "EXPENSE", description: "Despesa", amount: 100, competence_date: "2026-09-01", allocations: [{ cost_center_id: costCenter, amount: 120 }] }).success).toBe(false);
  });

  it("requires a payment timestamp when approving as paid", () => {
    expect(approveFinanceTransactionSchema.safeParse({ mark_as_paid: true }).success).toBe(false);
  });

  it("accepts only the last four account digits", () => {
    expect(createFinanceAccountSchema.safeParse({ code: "BANCO", name: "Conta principal", account_type: "BANK", account_last_four: "1234" }).success).toBe(true);
    expect(createFinanceAccountSchema.safeParse({ code: "BANCO", name: "Conta principal", account_type: "BANK", account_last_four: "12345" }).success).toBe(false);
  });

  it("requires a reason when cancelling a transaction", () => {
    expect(updateFinanceTransactionSchema.safeParse({ status: "CANCELLED" }).success).toBe(false);
    expect(updateFinanceTransactionSchema.safeParse({ status: "CANCELLED", cancellation_reason: "Lançamento duplicado" }).success).toBe(true);
  });
});
