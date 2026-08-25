-- Production hardening for agenda, documents, and finance.

-- Cover every foreign key introduced by the operational modules. Besides
-- improving joins, these indexes avoid long parent-table locks on updates and
-- deletions.
create index if not exists appointments_care_request_fk_idx on public.appointments(care_request_id);
create index if not exists appointments_unit_fk_idx on public.appointments(unit_id);

create index if not exists document_signatures_document_fk_idx on public.document_signatures(document_id);
create index if not exists document_signatures_version_fk_idx on public.document_signatures(document_version_id);
create index if not exists document_signatures_signer_fk_idx on public.document_signatures(signer_person_id);
create index if not exists documents_appointment_fk_idx on public.documents(appointment_id);
create index if not exists documents_clinical_case_fk_idx on public.documents(clinical_case_id);
create index if not exists documents_template_fk_idx on public.documents(template_id);
create index if not exists documents_unit_fk_idx on public.documents(unit_id);

create index if not exists finance_budget_category_fk_idx on public.finance_budget_lines(category_id);
create index if not exists finance_budget_cost_center_fk_idx on public.finance_budget_lines(cost_center_id);
create index if not exists finance_budget_project_fk_idx on public.finance_budget_lines(project_id);
create index if not exists finance_categories_parent_fk_idx on public.finance_categories(parent_id);
create index if not exists finance_cost_centers_project_fk_idx on public.finance_cost_centers(project_id);
create index if not exists finance_cost_centers_unit_fk_idx on public.finance_cost_centers(unit_id);
create index if not exists finance_allocations_cost_center_fk_idx on public.finance_transaction_allocations(cost_center_id);
create index if not exists finance_allocations_organization_fk_idx on public.finance_transaction_allocations(organization_id);
create index if not exists finance_allocations_project_fk_idx on public.finance_transaction_allocations(project_id);
create index if not exists finance_transactions_account_fk_idx on public.finance_transactions(account_id);
create index if not exists finance_transactions_category_fk_idx on public.finance_transactions(category_id);
create index if not exists finance_transactions_cost_center_fk_idx on public.finance_transactions(cost_center_id);
create index if not exists finance_transactions_counterparty_fk_idx on public.finance_transactions(counterparty_person_id);
create index if not exists finance_transactions_document_fk_idx on public.finance_transactions(supporting_document_id);
create index if not exists finance_transactions_unit_fk_idx on public.finance_transactions(unit_id);

create index if not exists professional_availability_member_fk_idx on public.professional_availability(organization_member_id);
create index if not exists professional_availability_project_fk_idx on public.professional_availability(project_id);
create index if not exists professional_availability_unit_fk_idx on public.professional_availability(unit_id);

-- A status that represents an exception or cancellation must preserve its
-- operational explanation. Constraints live in the database so every client
-- receives the same guarantee.
alter table public.appointments
  add constraint appointments_cancellation_reason_required
  check (status <> 'CANCELLED' or nullif(btrim(cancellation_reason), '') is not null) not valid;
alter table public.appointments validate constraint appointments_cancellation_reason_required;

alter table public.appointments
  add constraint appointments_no_show_notes_required
  check (status <> 'NO_SHOW' or nullif(btrim(no_show_notes), '') is not null) not valid;
alter table public.appointments validate constraint appointments_no_show_notes_required;

alter table public.documents
  add constraint documents_void_reason_required
  check (status <> 'VOID' or nullif(btrim(void_reason), '') is not null) not valid;
alter table public.documents validate constraint documents_void_reason_required;

alter table public.finance_transactions
  add constraint finance_transactions_cancellation_reason_required
  check (status <> 'CANCELLED' or nullif(btrim(cancellation_reason), '') is not null) not valid;
alter table public.finance_transactions validate constraint finance_transactions_cancellation_reason_required;

-- Allocations were already protected on insert/update. This complementary
-- guard prevents reducing a transaction below allocations that already exist.
create or replace function internal.prevent_finance_amount_below_allocations()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_allocated numeric(14,2);
begin
  if new.amount is distinct from old.amount then
    perform pg_advisory_xact_lock(hashtextextended(new.id::text, 0));
    select coalesce(sum(a.amount), 0)
      into v_allocated
    from public.finance_transaction_allocations a
    where a.transaction_id = new.id;

    if v_allocated > new.amount then
      raise exception 'ALLOCATION_EXCEEDS_TRANSACTION_AMOUNT' using errcode = '23514';
    end if;
  end if;
  return new;
end
$$;

revoke all on function internal.prevent_finance_amount_below_allocations() from public, anon, authenticated;

create trigger finance_transactions_allocation_guard
before update of amount on public.finance_transactions
for each row execute function internal.prevent_finance_amount_below_allocations();
