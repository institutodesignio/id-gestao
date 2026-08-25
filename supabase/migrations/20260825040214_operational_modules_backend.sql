-- Backend-first delivery for Agenda, Documents and Finance.
-- Legacy donors/donations/payment_events remain closed and are not reused.

-- Development was created before two operational primary keys were recorded.
-- Repair them idempotently so the same migration remains valid in both environments.
do $$
begin
  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.care_requests'::regclass and c.contype = 'p'
  ) then
    alter table public.care_requests add constraint care_requests_pkey primary key (id);
  end if;
  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.clinical_supervision_cases'::regclass and c.contype = 'p'
  ) then
    alter table public.clinical_supervision_cases add constraint clinical_supervision_cases_pkey primary key (id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Agenda
-- ---------------------------------------------------------------------------

create table public.professional_availability (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  organization_member_id uuid not null references public.organization_members(id) on delete restrict,
  unit_id uuid references public.units(id) on delete restrict,
  project_id uuid references public.projects(id) on delete restrict,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  timezone text not null default 'America/Sao_Paulo',
  valid_from date not null default current_date,
  valid_until date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  check (end_time > start_time),
  check (valid_until is null or valid_until >= valid_from)
);

create index professional_availability_org_member_idx
  on public.professional_availability(organization_id, organization_member_id, weekday)
  where deleted_at is null and is_active;

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  unit_id uuid references public.units(id) on delete restrict,
  project_id uuid references public.projects(id) on delete restrict,
  care_request_id uuid references public.care_requests(id) on delete restrict,
  beneficiary_person_id uuid not null references public.persons(id) on delete restrict,
  professional_member_id uuid not null references public.organization_members(id) on delete restrict,
  appointment_type text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'America/Sao_Paulo',
  status text not null default 'SCHEDULED'
    check (status in ('SCHEDULED','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW')),
  delivery_mode text not null default 'IN_PERSON'
    check (delivery_mode in ('IN_PERSON','REMOTE','HYBRID')),
  location_detail text,
  administrative_notes text,
  confirmation_notes text,
  cancellation_reason text,
  no_show_notes text,
  source text not null default 'INTERNAL'
    check (source in ('INTERNAL','GOOGLE_CALENDAR','IMPORT')),
  external_calendar_id text,
  external_event_id text,
  recurrence_key text,
  confirmed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  check (ends_at > starts_at)
);

create index appointments_org_period_idx
  on public.appointments(organization_id, starts_at, ends_at)
  where deleted_at is null;
create index appointments_professional_period_idx
  on public.appointments(professional_member_id, starts_at, ends_at)
  where deleted_at is null and status in ('SCHEDULED','CONFIRMED');
create index appointments_beneficiary_idx
  on public.appointments(beneficiary_person_id, starts_at desc)
  where deleted_at is null;
create index appointments_project_idx
  on public.appointments(project_id, starts_at desc)
  where project_id is not null and deleted_at is null;
create unique index appointments_external_event_unique
  on public.appointments(organization_id, external_calendar_id, external_event_id)
  where external_event_id is not null and deleted_at is null;

create or replace function internal.validate_agenda_references()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_table_name = 'professional_availability' then
    if not exists (
      select 1 from public.organization_members om
      where om.id = new.organization_member_id
        and om.organization_id = new.organization_id
        and om.status = 'ACTIVE'
        and (om.ended_at is null or om.ended_at >= current_date)
    ) then
      raise exception 'INVALID_PROFESSIONAL_REFERENCE' using errcode = '23514';
    end if;
    if new.unit_id is not null and not exists (
      select 1 from public.units u
      where u.id = new.unit_id and u.organization_id = new.organization_id and u.deleted_at is null
    ) then raise exception 'INVALID_UNIT_REFERENCE' using errcode = '23514'; end if;
    if new.project_id is not null and not exists (
      select 1 from public.projects p
      where p.id = new.project_id and p.organization_id = new.organization_id and p.deleted_at is null
    ) then raise exception 'INVALID_PROJECT_REFERENCE' using errcode = '23514'; end if;
  else
    if not exists (
      select 1 from public.persons p
      where p.id = new.beneficiary_person_id
        and p.organization_id = new.organization_id
        and p.deleted_at is null
    ) or not exists (
      select 1 from public.organization_members om
      where om.id = new.professional_member_id
        and om.organization_id = new.organization_id
        and om.status = 'ACTIVE'
        and (om.ended_at is null or om.ended_at >= current_date)
    ) then
      raise exception 'INVALID_APPOINTMENT_REFERENCE' using errcode = '23514';
    end if;

    if new.unit_id is not null and not exists (
      select 1 from public.units u
      where u.id = new.unit_id and u.organization_id = new.organization_id and u.deleted_at is null
    ) then raise exception 'INVALID_UNIT_REFERENCE' using errcode = '23514'; end if;

    if new.project_id is not null and not exists (
      select 1 from public.projects p
      where p.id = new.project_id and p.organization_id = new.organization_id and p.deleted_at is null
    ) then raise exception 'INVALID_PROJECT_REFERENCE' using errcode = '23514'; end if;

    if new.care_request_id is not null and not exists (
      select 1 from public.care_requests c
      where c.id = new.care_request_id and c.organization_id = new.organization_id and c.deleted_at is null
    ) then raise exception 'INVALID_CARE_REQUEST_REFERENCE' using errcode = '23514'; end if;

    perform pg_advisory_xact_lock(hashtextextended(new.professional_member_id::text, 0));
    if new.status in ('SCHEDULED','CONFIRMED') and exists (
      select 1 from public.appointments a
      where a.professional_member_id = new.professional_member_id
        and a.id <> new.id
        and a.deleted_at is null
        and a.status in ('SCHEDULED','CONFIRMED')
        and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
    ) then
      raise exception 'APPOINTMENT_TIME_CONFLICT' using errcode = '23P01';
    end if;
  end if;
  return new;
end
$$;

revoke all on function internal.validate_agenda_references() from public, anon, authenticated;

create trigger professional_availability_validate
before insert or update on public.professional_availability
for each row execute function internal.validate_agenda_references();
create trigger appointments_validate
before insert or update on public.appointments
for each row execute function internal.validate_agenda_references();

-- ---------------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------------

create table public.document_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  title text not null,
  category text not null,
  version integer not null default 1 check (version > 0),
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','ARCHIVED')),
  body_template text not null,
  field_schema jsonb not null default '{}'::jsonb,
  requires_approval boolean not null default true,
  requires_signature boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid
);
create unique index document_templates_code_version_unique
  on public.document_templates(organization_id, code, version)
  where deleted_at is null;

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  template_id uuid references public.document_templates(id) on delete restrict,
  person_id uuid references public.persons(id) on delete restrict,
  project_id uuid references public.projects(id) on delete restrict,
  unit_id uuid references public.units(id) on delete restrict,
  appointment_id uuid references public.appointments(id) on delete restrict,
  clinical_case_id uuid references public.clinical_supervision_cases(id) on delete restrict,
  category text not null,
  classification text not null default 'INTERNAL'
    check (classification in ('INTERNAL','CONFIDENTIAL','CLINICAL','FINANCIAL')),
  title text not null,
  description text,
  status text not null default 'DRAFT'
    check (status in ('DRAFT','READY_FOR_APPROVAL','APPROVED','SIGNED','ARCHIVED','VOID')),
  current_version integer not null default 0 check (current_version >= 0),
  approved_at timestamptz,
  approved_by_auth_user_id uuid,
  signed_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  deleted_by uuid
);
create index documents_org_status_idx on public.documents(organization_id, status, category, updated_at desc) where deleted_at is null;
create index documents_person_idx on public.documents(person_id, updated_at desc) where person_id is not null and deleted_at is null;
create index documents_project_idx on public.documents(project_id, updated_at desc) where project_id is not null and deleted_at is null;

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  document_id uuid not null references public.documents(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  content jsonb not null default '{}'::jsonb,
  storage_bucket text,
  storage_path text,
  original_filename text,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  checksum_sha256 text,
  change_summary text,
  created_at timestamptz not null default now(),
  created_by uuid,
  unique(document_id, version_number),
  check ((storage_bucket is null) = (storage_path is null))
);
create index document_versions_org_document_idx on public.document_versions(organization_id, document_id, version_number desc);

create table public.document_signatures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  document_id uuid not null references public.documents(id) on delete restrict,
  document_version_id uuid not null references public.document_versions(id) on delete restrict,
  signer_person_id uuid references public.persons(id) on delete restrict,
  signer_auth_user_id uuid,
  signature_type text not null check (signature_type in ('INTERNAL','GOV_BR','CERTIFICATE','UPLOAD')),
  provider text,
  external_reference text,
  status text not null default 'PENDING' check (status in ('PENDING','SIGNED','DECLINED','REVOKED')),
  requested_at timestamptz not null default now(),
  signed_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index document_signatures_org_status_idx on public.document_signatures(organization_id, status, requested_at);

create or replace function internal.validate_document_references()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_document_id uuid;
begin
  if tg_table_name = 'documents' then
    if new.template_id is not null and not exists (
      select 1 from public.document_templates t where t.id = new.template_id and t.organization_id = new.organization_id and t.deleted_at is null
    ) then raise exception 'INVALID_TEMPLATE_REFERENCE' using errcode = '23514'; end if;
    if new.person_id is not null and not exists (
      select 1 from public.persons p where p.id = new.person_id and p.organization_id = new.organization_id and p.deleted_at is null
    ) then raise exception 'INVALID_PERSON_REFERENCE' using errcode = '23514'; end if;
    if new.project_id is not null and not exists (
      select 1 from public.projects p where p.id = new.project_id and p.organization_id = new.organization_id and p.deleted_at is null
    ) then raise exception 'INVALID_PROJECT_REFERENCE' using errcode = '23514'; end if;
    if new.unit_id is not null and not exists (
      select 1 from public.units u where u.id = new.unit_id and u.organization_id = new.organization_id and u.deleted_at is null
    ) then raise exception 'INVALID_UNIT_REFERENCE' using errcode = '23514'; end if;
    if new.appointment_id is not null and not exists (
      select 1 from public.appointments a where a.id = new.appointment_id and a.organization_id = new.organization_id and a.deleted_at is null
    ) then raise exception 'INVALID_APPOINTMENT_REFERENCE' using errcode = '23514'; end if;
    if new.clinical_case_id is not null and not exists (
      select 1 from public.clinical_supervision_cases c where c.id = new.clinical_case_id and c.organization_id = new.organization_id and c.deleted_at is null
    ) then raise exception 'INVALID_CLINICAL_CASE_REFERENCE' using errcode = '23514'; end if;
    if ((tg_op = 'INSERT' and new.status = 'APPROVED') or
        (tg_op = 'UPDATE' and new.status is distinct from old.status and new.status = 'APPROVED'))
       and not internal.has_permission(new.organization_id, 'document.approve') then
      raise exception 'DOCUMENT_APPROVAL_PERMISSION_REQUIRED' using errcode = '42501';
    end if;
    if ((tg_op = 'INSERT' and new.status = 'SIGNED') or
        (tg_op = 'UPDATE' and new.status is distinct from old.status and new.status = 'SIGNED'))
       and not internal.has_permission(new.organization_id, 'document.sign') then
      raise exception 'DOCUMENT_SIGNATURE_PERMISSION_REQUIRED' using errcode = '42501';
    end if;
  elsif tg_table_name = 'document_versions' then
    v_document_id := new.document_id;
    if not exists (
      select 1 from public.documents d where d.id = v_document_id and d.organization_id = new.organization_id and d.deleted_at is null
    ) then raise exception 'INVALID_DOCUMENT_REFERENCE' using errcode = '23514'; end if;
    if new.storage_path is not null and new.storage_path not like new.organization_id::text || '/' || new.document_id::text || '/%' then
      raise exception 'INVALID_DOCUMENT_STORAGE_PATH' using errcode = '23514';
    end if;
  elsif tg_table_name = 'document_signatures' then
    if not exists (
      select 1 from public.document_versions v
      where v.id = new.document_version_id and v.document_id = new.document_id and v.organization_id = new.organization_id
    ) then raise exception 'INVALID_DOCUMENT_VERSION_REFERENCE' using errcode = '23514'; end if;
    if new.signer_person_id is not null and not exists (
      select 1 from public.persons p where p.id = new.signer_person_id and p.organization_id = new.organization_id and p.deleted_at is null
    ) then raise exception 'INVALID_SIGNER_REFERENCE' using errcode = '23514'; end if;
  end if;
  return new;
end
$$;
revoke all on function internal.validate_document_references() from public, anon, authenticated;

create or replace function internal.update_document_current_version()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.documents
  set current_version = greatest(current_version, new.version_number), updated_at = now(), updated_by = new.created_by
  where id = new.document_id and organization_id = new.organization_id;
  return new;
end
$$;
revoke all on function internal.update_document_current_version() from public, anon, authenticated;

create trigger documents_validate before insert or update on public.documents for each row execute function internal.validate_document_references();
create trigger document_versions_validate before insert or update on public.document_versions for each row execute function internal.validate_document_references();
create trigger document_signatures_validate before insert or update on public.document_signatures for each row execute function internal.validate_document_references();
create trigger document_versions_advance after insert on public.document_versions for each row execute function internal.update_document_current_version();

-- ---------------------------------------------------------------------------
-- Finance (new multi-tenant structures; legacy donation tables stay closed)
-- ---------------------------------------------------------------------------

create table public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  name text not null,
  account_type text not null check (account_type in ('BANK','CASH','DIGITAL_WALLET','OTHER')),
  institution_name text,
  branch_number text,
  account_last_four text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','CLOSED')),
  opening_balance numeric(14,2) not null default 0,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid,
  deleted_at timestamptz, deleted_by uuid
);
create unique index finance_accounts_org_code_unique on public.finance_accounts(organization_id, code) where deleted_at is null;

create table public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  parent_id uuid references public.finance_categories(id) on delete restrict,
  code text not null,
  name text not null,
  category_type text not null check (category_type in ('INCOME','EXPENSE','BOTH')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid,
  deleted_at timestamptz, deleted_by uuid
);
create unique index finance_categories_org_code_unique on public.finance_categories(organization_id, code) where deleted_at is null;

create table public.finance_cost_centers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  project_id uuid references public.projects(id) on delete restrict,
  unit_id uuid references public.units(id) on delete restrict,
  code text not null,
  name text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','CLOSED')),
  valid_from date,
  valid_until date,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid,
  deleted_at timestamptz, deleted_by uuid,
  check (valid_until is null or valid_from is null or valid_until >= valid_from)
);
create unique index finance_cost_centers_org_code_unique on public.finance_cost_centers(organization_id, code) where deleted_at is null;

create table public.finance_budget_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  fiscal_year integer not null check (fiscal_year between 2000 and 2200),
  project_id uuid references public.projects(id) on delete restrict,
  cost_center_id uuid references public.finance_cost_centers(id) on delete restrict,
  category_id uuid not null references public.finance_categories(id) on delete restrict,
  funding_source text not null default 'OWN_FUNDS'
    check (funding_source in ('OWN_FUNDS','DONATION','PUBLIC_GRANT','PRIVATE_GRANT','PARTNERSHIP','OTHER')),
  planned_amount numeric(14,2) not null check (planned_amount >= 0),
  notes text,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);
create unique index finance_budget_lines_business_key_unique
  on public.finance_budget_lines(organization_id, fiscal_year, project_id, cost_center_id, category_id, funding_source)
  nulls not distinct;

create table public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  account_id uuid references public.finance_accounts(id) on delete restrict,
  category_id uuid not null references public.finance_categories(id) on delete restrict,
  cost_center_id uuid references public.finance_cost_centers(id) on delete restrict,
  project_id uuid references public.projects(id) on delete restrict,
  unit_id uuid references public.units(id) on delete restrict,
  counterparty_person_id uuid references public.persons(id) on delete restrict,
  supporting_document_id uuid references public.documents(id) on delete restrict,
  transaction_type text not null check (transaction_type in ('INCOME','EXPENSE')),
  status text not null default 'DRAFT'
    check (status in ('DRAFT','PENDING_APPROVAL','APPROVED','PAID','CANCELLED')),
  reconciliation_status text not null default 'UNRECONCILED'
    check (reconciliation_status in ('UNRECONCILED','RECONCILED')),
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  currency char(3) not null default 'BRL',
  competence_date date not null,
  due_date date,
  paid_at timestamptz,
  funding_source text not null default 'OWN_FUNDS'
    check (funding_source in ('OWN_FUNDS','DONATION','PUBLIC_GRANT','PRIVATE_GRANT','PARTNERSHIP','OTHER')),
  funding_reference text,
  external_reference text,
  approved_at timestamptz,
  approved_by_auth_user_id uuid,
  reconciled_at timestamptz,
  reconciled_by_auth_user_id uuid,
  cancellation_reason text,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid,
  deleted_at timestamptz, deleted_by uuid,
  check ((status = 'PAID' and paid_at is not null) or status <> 'PAID'),
  check ((status in ('APPROVED','PAID') and approved_at is not null) or status not in ('APPROVED','PAID')),
  check ((reconciliation_status = 'RECONCILED' and reconciled_at is not null) or reconciliation_status <> 'RECONCILED')
);
create index finance_transactions_org_period_idx on public.finance_transactions(organization_id, competence_date, transaction_type, status) where deleted_at is null;
create index finance_transactions_project_idx on public.finance_transactions(project_id, competence_date) where project_id is not null and deleted_at is null;
create index finance_transactions_due_idx on public.finance_transactions(organization_id, due_date) where status in ('PENDING_APPROVAL','APPROVED') and deleted_at is null;

create table public.finance_transaction_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  transaction_id uuid not null references public.finance_transactions(id) on delete restrict,
  cost_center_id uuid not null references public.finance_cost_centers(id) on delete restrict,
  project_id uuid references public.projects(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  description text,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);
create index finance_allocations_transaction_idx on public.finance_transaction_allocations(transaction_id);

create or replace function internal.validate_finance_references()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_transaction_amount numeric(14,2);
  v_allocated numeric(14,2);
begin
  if tg_table_name = 'finance_categories' then
    if new.parent_id is not null and not exists (
      select 1 from public.finance_categories c where c.id = new.parent_id and c.organization_id = new.organization_id and c.deleted_at is null
    ) then raise exception 'INVALID_PARENT_CATEGORY_REFERENCE' using errcode = '23514'; end if;
  elsif tg_table_name = 'finance_cost_centers' then
    if new.project_id is not null and not exists (
      select 1 from public.projects p where p.id = new.project_id and p.organization_id = new.organization_id and p.deleted_at is null
    ) then raise exception 'INVALID_PROJECT_REFERENCE' using errcode = '23514'; end if;
    if new.unit_id is not null and not exists (
      select 1 from public.units u where u.id = new.unit_id and u.organization_id = new.organization_id and u.deleted_at is null
    ) then raise exception 'INVALID_UNIT_REFERENCE' using errcode = '23514'; end if;
  elsif tg_table_name = 'finance_budget_lines' then
    if new.project_id is not null and not exists (
      select 1 from public.projects p where p.id = new.project_id and p.organization_id = new.organization_id and p.deleted_at is null
    ) then raise exception 'INVALID_PROJECT_REFERENCE' using errcode = '23514'; end if;
    if new.cost_center_id is not null and not exists (
      select 1 from public.finance_cost_centers c where c.id = new.cost_center_id and c.organization_id = new.organization_id and c.deleted_at is null
    ) then raise exception 'INVALID_COST_CENTER_REFERENCE' using errcode = '23514'; end if;
    if not exists (select 1 from public.finance_categories c where c.id = new.category_id and c.organization_id = new.organization_id and c.deleted_at is null)
    then raise exception 'INVALID_CATEGORY_REFERENCE' using errcode = '23514'; end if;
  elsif tg_table_name = 'finance_transactions' then
    if new.project_id is not null and not exists (
      select 1 from public.projects p where p.id = new.project_id and p.organization_id = new.organization_id and p.deleted_at is null
    ) then raise exception 'INVALID_PROJECT_REFERENCE' using errcode = '23514'; end if;
    if new.unit_id is not null and not exists (
      select 1 from public.units u where u.id = new.unit_id and u.organization_id = new.organization_id and u.deleted_at is null
    ) then raise exception 'INVALID_UNIT_REFERENCE' using errcode = '23514'; end if;
    if new.cost_center_id is not null and not exists (
      select 1 from public.finance_cost_centers c where c.id = new.cost_center_id and c.organization_id = new.organization_id and c.deleted_at is null
    ) then raise exception 'INVALID_COST_CENTER_REFERENCE' using errcode = '23514'; end if;
    if new.account_id is not null and not exists (select 1 from public.finance_accounts a where a.id = new.account_id and a.organization_id = new.organization_id and a.deleted_at is null)
    then raise exception 'INVALID_ACCOUNT_REFERENCE' using errcode = '23514'; end if;
    if not exists (select 1 from public.finance_categories c where c.id = new.category_id and c.organization_id = new.organization_id and c.deleted_at is null and c.category_type in (new.transaction_type,'BOTH'))
    then raise exception 'INVALID_CATEGORY_REFERENCE' using errcode = '23514'; end if;
    if new.counterparty_person_id is not null and not exists (select 1 from public.persons p where p.id = new.counterparty_person_id and p.organization_id = new.organization_id and p.deleted_at is null)
    then raise exception 'INVALID_COUNTERPARTY_REFERENCE' using errcode = '23514'; end if;
    if new.supporting_document_id is not null and not exists (select 1 from public.documents d where d.id = new.supporting_document_id and d.organization_id = new.organization_id and d.deleted_at is null)
    then raise exception 'INVALID_DOCUMENT_REFERENCE' using errcode = '23514'; end if;
    if ((tg_op = 'INSERT' and new.status in ('APPROVED','PAID')) or
        (tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('APPROVED','PAID')))
       and not internal.has_permission(new.organization_id, 'finance.approve') then
      raise exception 'FINANCE_APPROVAL_PERMISSION_REQUIRED' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and new.reconciliation_status is distinct from old.reconciliation_status and new.reconciliation_status = 'RECONCILED'
       and not internal.has_permission(new.organization_id, 'finance.reconcile') then
      raise exception 'FINANCE_RECONCILIATION_PERMISSION_REQUIRED' using errcode = '42501';
    end if;
  elsif tg_table_name = 'finance_transaction_allocations' then
    if not exists (
      select 1 from public.finance_cost_centers c where c.id = new.cost_center_id and c.organization_id = new.organization_id and c.deleted_at is null
    ) then raise exception 'INVALID_COST_CENTER_REFERENCE' using errcode = '23514'; end if;
    if new.project_id is not null and not exists (
      select 1 from public.projects p where p.id = new.project_id and p.organization_id = new.organization_id and p.deleted_at is null
    ) then raise exception 'INVALID_PROJECT_REFERENCE' using errcode = '23514'; end if;
    perform pg_advisory_xact_lock(hashtextextended(new.transaction_id::text, 0));
    select t.amount into v_transaction_amount
    from public.finance_transactions t
    where t.id = new.transaction_id and t.organization_id = new.organization_id and t.deleted_at is null;
    if v_transaction_amount is null then raise exception 'INVALID_TRANSACTION_REFERENCE' using errcode = '23514'; end if;
    select coalesce(sum(a.amount),0) into v_allocated
    from public.finance_transaction_allocations a
    where a.transaction_id = new.transaction_id and a.id <> new.id;
    if v_allocated + new.amount > v_transaction_amount then
      raise exception 'ALLOCATION_EXCEEDS_TRANSACTION_AMOUNT' using errcode = '23514';
    end if;
  end if;
  return new;
end
$$;
revoke all on function internal.validate_finance_references() from public, anon, authenticated;

create trigger finance_categories_validate before insert or update on public.finance_categories for each row execute function internal.validate_finance_references();
create trigger finance_cost_centers_validate before insert or update on public.finance_cost_centers for each row execute function internal.validate_finance_references();
create trigger finance_budget_lines_validate before insert or update on public.finance_budget_lines for each row execute function internal.validate_finance_references();
create trigger finance_transactions_validate before insert or update on public.finance_transactions for each row execute function internal.validate_finance_references();
create trigger finance_allocations_validate before insert or update on public.finance_transaction_allocations for each row execute function internal.validate_finance_references();

create or replace function public.create_finance_transaction(p_organization_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_transaction public.finance_transactions;
  v_allocation jsonb;
begin
  if auth.uid() is null or not internal.has_permission(p_organization_id, 'finance.create') then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  insert into public.finance_transactions(
    organization_id, account_id, category_id, cost_center_id, project_id, unit_id,
    counterparty_person_id, supporting_document_id, transaction_type, status,
    description, amount, currency, competence_date, due_date, funding_source,
    funding_reference, external_reference, created_by, updated_by
  ) values (
    p_organization_id,
    nullif(p_payload->>'account_id','')::uuid,
    (p_payload->>'category_id')::uuid,
    nullif(p_payload->>'cost_center_id','')::uuid,
    nullif(p_payload->>'project_id','')::uuid,
    nullif(p_payload->>'unit_id','')::uuid,
    nullif(p_payload->>'counterparty_person_id','')::uuid,
    nullif(p_payload->>'supporting_document_id','')::uuid,
    p_payload->>'transaction_type',
    coalesce(p_payload->>'status','DRAFT'),
    p_payload->>'description',
    (p_payload->>'amount')::numeric,
    coalesce(p_payload->>'currency','BRL'),
    (p_payload->>'competence_date')::date,
    nullif(p_payload->>'due_date','')::date,
    coalesce(p_payload->>'funding_source','OWN_FUNDS'),
    p_payload->>'funding_reference',
    p_payload->>'external_reference',
    auth.uid(), auth.uid()
  ) returning * into v_transaction;

  for v_allocation in select value from jsonb_array_elements(coalesce(p_payload->'allocations','[]'::jsonb)) loop
    insert into public.finance_transaction_allocations(
      organization_id, transaction_id, cost_center_id, project_id, amount,
      description, created_by, updated_by
    ) values (
      p_organization_id, v_transaction.id,
      (v_allocation->>'cost_center_id')::uuid,
      nullif(v_allocation->>'project_id','')::uuid,
      (v_allocation->>'amount')::numeric,
      v_allocation->>'description', auth.uid(), auth.uid()
    );
  end loop;

  return to_jsonb(v_transaction) || jsonb_build_object(
    'allocations', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from public.finance_transaction_allocations a where a.transaction_id=v_transaction.id), '[]'::jsonb)
  );
end
$$;
revoke all on function public.create_finance_transaction(uuid,jsonb) from public,anon;
grant execute on function public.create_finance_transaction(uuid,jsonb) to authenticated;

create or replace function public.finance_period_summary(p_organization_id uuid, p_from date, p_to date)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select case
    when not internal.has_permission(p_organization_id, 'finance.read') then null
    else jsonb_build_object(
      'from', p_from,
      'to', p_to,
      'income', coalesce(sum(amount) filter (where transaction_type = 'INCOME' and status <> 'CANCELLED'),0),
      'expense', coalesce(sum(amount) filter (where transaction_type = 'EXPENSE' and status <> 'CANCELLED'),0),
      'paid_expense', coalesce(sum(amount) filter (where transaction_type = 'EXPENSE' and status = 'PAID'),0),
      'pending', coalesce(sum(amount) filter (where status in ('DRAFT','PENDING_APPROVAL','APPROVED')),0),
      'transaction_count', count(*) filter (where status <> 'CANCELLED')
    )
  end
  from public.finance_transactions
  where organization_id = p_organization_id
    and competence_date between p_from and p_to
    and deleted_at is null;
$$;
revoke all on function public.finance_period_summary(uuid,date,date) from public, anon;
grant execute on function public.finance_period_summary(uuid,date,date) to authenticated;

-- ---------------------------------------------------------------------------
-- Explicit grants and RLS
-- ---------------------------------------------------------------------------

alter table public.professional_availability enable row level security;
alter table public.appointments enable row level security;
alter table public.document_templates enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.document_signatures enable row level security;
alter table public.finance_accounts enable row level security;
alter table public.finance_categories enable row level security;
alter table public.finance_cost_centers enable row level security;
alter table public.finance_budget_lines enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.finance_transaction_allocations enable row level security;

revoke all on public.professional_availability, public.appointments,
  public.document_templates, public.documents, public.document_versions, public.document_signatures,
  public.finance_accounts, public.finance_categories, public.finance_cost_centers,
  public.finance_budget_lines, public.finance_transactions, public.finance_transaction_allocations
from anon;

grant select, insert, update on public.professional_availability, public.appointments,
  public.document_templates, public.documents, public.document_signatures,
  public.finance_accounts, public.finance_categories, public.finance_cost_centers,
  public.finance_budget_lines, public.finance_transactions, public.finance_transaction_allocations
to authenticated;
grant select, insert on public.document_versions to authenticated;

create policy appointment_availability_read on public.professional_availability for select to authenticated
using (deleted_at is null and internal.has_permission(organization_id,'appointment.read'));
create policy appointment_availability_create on public.professional_availability for insert to authenticated
with check (internal.has_permission(organization_id,'appointment.create'));
create policy appointment_availability_update on public.professional_availability for update to authenticated
using (deleted_at is null and internal.has_permission(organization_id,'appointment.update'))
with check (internal.has_permission(organization_id,'appointment.update'));

create policy appointments_read on public.appointments for select to authenticated
using (deleted_at is null and internal.has_permission(organization_id,'appointment.read'));
create policy appointments_create on public.appointments for insert to authenticated
with check (internal.has_permission(organization_id,'appointment.create'));
create policy appointments_update on public.appointments for update to authenticated
using (deleted_at is null and (internal.has_permission(organization_id,'appointment.update') or internal.has_permission(organization_id,'appointment.confirm')))
with check (internal.has_permission(organization_id,'appointment.update') or internal.has_permission(organization_id,'appointment.confirm'));

create policy document_templates_read on public.document_templates for select to authenticated
using (deleted_at is null and internal.has_permission(organization_id,'document.read'));
create policy document_templates_create on public.document_templates for insert to authenticated
with check (internal.has_permission(organization_id,'document.create'));
create policy document_templates_update on public.document_templates for update to authenticated
using (deleted_at is null and internal.has_permission(organization_id,'document.update'))
with check (internal.has_permission(organization_id,'document.update'));

create policy documents_read on public.documents for select to authenticated
using (deleted_at is null and internal.has_permission(organization_id,'document.read') and (classification <> 'CLINICAL' or internal.has_permission(organization_id,'clinical_record.read')));
create policy documents_create on public.documents for insert to authenticated
with check (internal.has_permission(organization_id,'document.create') and (classification <> 'CLINICAL' or internal.has_permission(organization_id,'clinical_record.create')));
create policy documents_update on public.documents for update to authenticated
using (deleted_at is null and internal.has_permission(organization_id,'document.update') and (classification <> 'CLINICAL' or internal.has_permission(organization_id,'clinical_record.update_draft')))
with check (internal.has_permission(organization_id,'document.update') and (classification <> 'CLINICAL' or internal.has_permission(organization_id,'clinical_record.update_draft')));

create policy document_versions_read on public.document_versions for select to authenticated
using (exists (select 1 from public.documents d where d.id=document_id));
create policy document_versions_create on public.document_versions for insert to authenticated
with check (internal.has_permission(organization_id,'document.update') and exists (select 1 from public.documents d where d.id=document_id));
create policy document_signatures_read on public.document_signatures for select to authenticated
using (exists (select 1 from public.documents d where d.id=document_id));
create policy document_signatures_create on public.document_signatures for insert to authenticated
with check (internal.has_permission(organization_id,'document.sign') and exists (select 1 from public.documents d where d.id=document_id));
create policy document_signatures_update on public.document_signatures for update to authenticated
using (internal.has_permission(organization_id,'document.sign') and exists (select 1 from public.documents d where d.id=document_id))
with check (internal.has_permission(organization_id,'document.sign') and exists (select 1 from public.documents d where d.id=document_id));

create policy finance_accounts_read on public.finance_accounts for select to authenticated using (deleted_at is null and internal.has_permission(organization_id,'finance.read'));
create policy finance_accounts_create on public.finance_accounts for insert to authenticated with check (internal.has_permission(organization_id,'finance.create'));
create policy finance_accounts_update on public.finance_accounts for update to authenticated using (deleted_at is null and internal.has_permission(organization_id,'finance.update')) with check (internal.has_permission(organization_id,'finance.update'));
create policy finance_categories_read on public.finance_categories for select to authenticated using (deleted_at is null and internal.has_permission(organization_id,'finance.read'));
create policy finance_categories_create on public.finance_categories for insert to authenticated with check (internal.has_permission(organization_id,'finance.create'));
create policy finance_categories_update on public.finance_categories for update to authenticated using (deleted_at is null and internal.has_permission(organization_id,'finance.update')) with check (internal.has_permission(organization_id,'finance.update'));
create policy finance_cost_centers_read on public.finance_cost_centers for select to authenticated using (deleted_at is null and internal.has_permission(organization_id,'finance.read'));
create policy finance_cost_centers_create on public.finance_cost_centers for insert to authenticated with check (internal.has_permission(organization_id,'finance.create'));
create policy finance_cost_centers_update on public.finance_cost_centers for update to authenticated using (deleted_at is null and internal.has_permission(organization_id,'finance.update')) with check (internal.has_permission(organization_id,'finance.update'));
create policy finance_budgets_read on public.finance_budget_lines for select to authenticated using (internal.has_permission(organization_id,'finance.read'));
create policy finance_budgets_create on public.finance_budget_lines for insert to authenticated with check (internal.has_permission(organization_id,'finance.create'));
create policy finance_budgets_update on public.finance_budget_lines for update to authenticated using (internal.has_permission(organization_id,'finance.update')) with check (internal.has_permission(organization_id,'finance.update'));
create policy finance_transactions_read on public.finance_transactions for select to authenticated using (deleted_at is null and internal.has_permission(organization_id,'finance.read'));
create policy finance_transactions_create on public.finance_transactions for insert to authenticated with check (internal.has_permission(organization_id,'finance.create'));
create policy finance_transactions_update on public.finance_transactions for update to authenticated using (deleted_at is null and internal.has_permission(organization_id,'finance.update')) with check (internal.has_permission(organization_id,'finance.update'));
create policy finance_allocations_read on public.finance_transaction_allocations for select to authenticated using (internal.has_permission(organization_id,'finance.read'));
create policy finance_allocations_create on public.finance_transaction_allocations for insert to authenticated with check (internal.has_permission(organization_id,'finance.create'));
create policy finance_allocations_update on public.finance_transaction_allocations for update to authenticated using (internal.has_permission(organization_id,'finance.update')) with check (internal.has_permission(organization_id,'finance.update'));

-- Private document bucket. Files are always stored under organization/document/version.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('id-gestao-documents','id-gestao-documents',false,26214400,array['application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function internal.document_storage_organization_id(p_name text)
returns uuid language sql immutable security invoker set search_path=pg_catalog
as $$
  select case when split_part(p_name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then split_part(p_name,'/',1)::uuid else null end;
$$;
revoke all on function internal.document_storage_organization_id(text) from public,anon;
grant execute on function internal.document_storage_organization_id(text) to authenticated;

create policy id_gestao_documents_read on storage.objects for select to authenticated
using (bucket_id='id-gestao-documents' and internal.has_permission(internal.document_storage_organization_id(name),'document.read'));
create policy id_gestao_documents_insert on storage.objects for insert to authenticated
with check (bucket_id='id-gestao-documents' and internal.has_permission(internal.document_storage_organization_id(name),'document.create'));
create policy id_gestao_documents_update on storage.objects for update to authenticated
using (bucket_id='id-gestao-documents' and internal.has_permission(internal.document_storage_organization_id(name),'document.update'))
with check (bucket_id='id-gestao-documents' and internal.has_permission(internal.document_storage_organization_id(name),'document.update'));

-- ---------------------------------------------------------------------------
-- Audit coverage
-- ---------------------------------------------------------------------------

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'professional_availability','appointments','document_templates','documents','document_versions','document_signatures',
    'finance_accounts','finance_categories','finance_cost_centers','finance_budget_lines','finance_transactions','finance_transaction_allocations'
  ] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function internal.audit_sensitive_change()', 'audit_' || table_name || '_changes', table_name);
  end loop;
end $$;

comment on table public.appointments is 'Agenda institucional com confirmação, presença, ausência e integração externa opcional.';
comment on table public.documents is 'Metadados e ciclo de vida de documentos institucionais; arquivos ficam em bucket privado.';
comment on table public.document_versions is 'Versões imutáveis de conteúdo e arquivos documentais.';
comment on table public.finance_transactions is 'Lançamentos financeiros multi-tenant vinculáveis a projeto, unidade, centro de custo e documento.';
comment on table public.finance_budget_lines is 'Orçamento planejado por exercício, projeto, centro de custo, categoria e fonte.';
