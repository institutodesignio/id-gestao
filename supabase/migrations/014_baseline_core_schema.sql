begin;
create schema if not exists internal;
create schema if not exists audit;
create type audit.audit_event_severity as enum ('INFO', 'WARNING', 'CRITICAL');
create type public.membership_status as enum ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ENDED');
create type public.organization_status as enum ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED');
create type public.person_status as enum ('ACTIVE', 'INACTIVE', 'ARCHIVED');
create type public.person_type as enum ('INDIVIDUAL', 'ORGANIZATION');
create type public.project_status as enum ('PLANNING', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'COMPLETED', 'CANCELLED', 'ARCHIVED');
create type public.role_status as enum ('ACTIVE', 'INACTIVE', 'ARCHIVED');
create type public.scope_type as enum ('ORGANIZATION', 'UNIT', 'PROJECT', 'SELF');
create type public.unit_status as enum ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED');
create type public.user_profile_status as enum ('ACTIVE', 'INACTIVE', 'BLOCKED');
create table audit.audit_events (id uuid not null default gen_random_uuid(),
  organization_id uuid,
  actor_auth_user_id uuid,
  actor_user_profile_id uuid,
  actor_person_id uuid,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  severity audit.audit_event_severity not null default 'INFO'::audit.audit_event_severity,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  occurred_at timestamp with time zone not null default now());

create table public.donations (id uuid not null default gen_random_uuid(),
  donor_name text,
  donor_email text,
  amount numeric(10,2) not null,
  currency text default 'BRL'::text,
  payment_method text,
  status text default 'pending'::text,
  pagbank_order_id text,
  pagbank_payment_id text,
  checkout_url text,
  qr_code text,
  created_at timestamp without time zone default now(),
  updated_at timestamp without time zone default now());

create table public.donors (id uuid not null default gen_random_uuid(),
  name text,
  email text,
  phone text,
  total_donated numeric(10,2) default 0,
  created_at timestamp without time zone default now());

create table public.member_roles (id uuid not null default gen_random_uuid(),
  organization_member_id uuid not null,
  role_id uuid not null,
  starts_at date not null default CURRENT_DATE,
  ends_at date,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_at timestamp with time zone not null default now(),
  updated_by uuid);

create table public.member_scopes (id uuid not null default gen_random_uuid(),
  organization_member_id uuid not null,
  scope_type scope_type not null,
  unit_id uuid,
  project_id uuid,
  starts_at date not null default CURRENT_DATE,
  ends_at date,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_at timestamp with time zone not null default now(),
  updated_by uuid);

create table public.organization_members (id uuid not null default gen_random_uuid(),
  organization_id uuid not null,
  user_profile_id uuid not null,
  person_id uuid not null,
  status membership_status not null default 'ACTIVE'::membership_status,
  joined_at date not null default CURRENT_DATE,
  ended_at date,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_at timestamp with time zone not null default now(),
  updated_by uuid);

create table public.organizations (id uuid not null default gen_random_uuid(),
  legal_name text not null,
  trade_name text,
  slug text not null,
  cnpj text,
  email text,
  phone text,
  website text,
  status organization_status not null default 'ACTIVE'::organization_status,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_at timestamp with time zone not null default now(),
  updated_by uuid,
  deleted_at timestamp with time zone,
  deleted_by uuid);

create table public.payment_events (id uuid not null default gen_random_uuid(),
  donation_id uuid,
  event_type text,
  payload jsonb,
  created_at timestamp without time zone default now());

create table public.permissions (id uuid not null default gen_random_uuid(),
  code text not null,
  resource text not null,
  action text not null,
  description text,
  is_system boolean not null default true,
  created_at timestamp with time zone not null default now());

create table public.person_addresses (id uuid not null default gen_random_uuid(),
  organization_id uuid not null,
  person_id uuid not null,
  address_type text not null default 'PRIMARY'::text,
  postal_code text,
  street text,
  street_number text,
  address_complement text,
  neighborhood text,
  city text,
  state_code text,
  country_code text not null default 'BR'::text,
  is_primary boolean not null default false,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_at timestamp with time zone not null default now(),
  updated_by uuid,
  deleted_at timestamp with time zone,
  deleted_by uuid);

create table public.person_relationships (id uuid not null default gen_random_uuid(),
  organization_id uuid not null,
  person_id uuid not null,
  related_person_id uuid not null,
  relationship_type text not null,
  is_legal_guardian boolean not null default false,
  is_financial_responsible boolean not null default false,
  starts_at date,
  ends_at date,
  notes text,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_at timestamp with time zone not null default now(),
  updated_by uuid,
  deleted_at timestamp with time zone,
  deleted_by uuid);

create table public.persons (id uuid not null default gen_random_uuid(),
  organization_id uuid not null,
  person_type person_type not null,
  full_name text not null,
  preferred_name text,
  birth_date date,
  gender text,
  marital_status text,
  nationality text,
  occupation text,
  cpf text,
  cnpj text,
  rg text,
  rg_issuer text,
  nis text,
  primary_email text,
  primary_phone text,
  status person_status not null default 'ACTIVE'::person_status,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_at timestamp with time zone not null default now(),
  updated_by uuid,
  deleted_at timestamp with time zone,
  deleted_by uuid);

create table public.project_units (id uuid not null default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  unit_id uuid not null,
  starts_at date,
  ends_at date,
  is_primary boolean not null default false,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_at timestamp with time zone not null default now(),
  updated_by uuid);

create table public.projects (id uuid not null default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  slug text not null,
  short_name text,
  description text,
  status project_status not null default 'PLANNING'::project_status,
  starts_at date,
  ends_at date,
  has_clinical_care boolean not null default false,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_at timestamp with time zone not null default now(),
  updated_by uuid,
  deleted_at timestamp with time zone,
  deleted_by uuid);

create table public.role_permissions (id uuid not null default gen_random_uuid(),
  role_id uuid not null,
  permission_id uuid not null,
  created_at timestamp with time zone not null default now(),
  created_by uuid);

create table public.roles (id uuid not null default gen_random_uuid(),
  organization_id uuid,
  code text not null,
  name text not null,
  description text,
  is_system boolean not null default false,
  status role_status not null default 'ACTIVE'::role_status,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_at timestamp with time zone not null default now(),
  updated_by uuid,
  deleted_at timestamp with time zone,
  deleted_by uuid);

create table public.units (id uuid not null default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  slug text not null,
  description text,
  email text,
  phone text,
  postal_code text,
  street text,
  street_number text,
  address_complement text,
  neighborhood text,
  city text,
  state_code text,
  country_code text not null default 'BR'::text,
  is_headquarters boolean not null default false,
  status unit_status not null default 'ACTIVE'::unit_status,
  created_at timestamp with time zone not null default now(),
  created_by uuid,
  updated_at timestamp with time zone not null default now(),
  updated_by uuid,
  deleted_at timestamp with time zone,
  deleted_by uuid);

create table public.user_profiles (id uuid not null default gen_random_uuid(),
  auth_user_id uuid not null,
  person_id uuid not null,
  email text not null,
  identity_provider text not null default 'GOOGLE'::text,
  status user_profile_status not null default 'ACTIVE'::user_profile_status,
  last_login_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now());
alter table audit.audit_events add constraint audit_events_pkey PRIMARY KEY (id);
alter table public.donations add constraint donations_pkey PRIMARY KEY (id);
alter table public.donors add constraint donors_pkey PRIMARY KEY (id);
alter table public.member_roles add constraint member_roles_pkey PRIMARY KEY (id);
alter table public.member_scopes add constraint member_scopes_pkey PRIMARY KEY (id);
alter table public.organization_members add constraint organization_members_pkey PRIMARY KEY (id);
alter table public.organizations add constraint organizations_pkey PRIMARY KEY (id);
alter table public.payment_events add constraint payment_events_pkey PRIMARY KEY (id);
alter table public.permissions add constraint permissions_pkey PRIMARY KEY (id);
alter table public.person_addresses add constraint person_addresses_pkey PRIMARY KEY (id);
alter table public.person_relationships add constraint person_relationships_pkey PRIMARY KEY (id);
alter table public.persons add constraint persons_pkey PRIMARY KEY (id);
alter table public.project_units add constraint project_units_pkey PRIMARY KEY (id);
alter table public.projects add constraint projects_pkey PRIMARY KEY (id);
alter table public.role_permissions add constraint role_permissions_pkey PRIMARY KEY (id);
alter table public.roles add constraint roles_pkey PRIMARY KEY (id);
alter table public.units add constraint units_pkey PRIMARY KEY (id);
alter table public.user_profiles add constraint user_profiles_pkey PRIMARY KEY (id);
alter table public.donors add constraint donors_email_key UNIQUE (email);
alter table public.organization_members add constraint organization_members_unique UNIQUE (organization_id, user_profile_id);
alter table public.permissions add constraint permissions_code_key UNIQUE (code);
alter table public.project_units add constraint project_units_unique UNIQUE (project_id, unit_id);
alter table public.role_permissions add constraint role_permissions_unique UNIQUE (role_id, permission_id);
alter table public.user_profiles add constraint user_profiles_auth_user_id_key UNIQUE (auth_user_id);
alter table audit.audit_events add constraint audit_events_action_not_blank CHECK (btrim(action) <> ''::text);
alter table audit.audit_events add constraint audit_events_resource_type_not_blank CHECK (btrim(resource_type) <> ''::text);
alter table public.donations add constraint donations_payment_method_check CHECK (payment_method = ANY (ARRAY['pix'::text, 'credit_card'::text, 'debit_card'::text]));
alter table public.donations add constraint donations_status_check CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'refunded'::text]));
alter table public.member_roles add constraint member_roles_dates_valid CHECK (ends_at IS NULL OR ends_at >= starts_at);
alter table public.member_scopes add constraint member_scopes_dates_valid CHECK (ends_at IS NULL OR ends_at >= starts_at);
alter table public.member_scopes add constraint member_scopes_shape_valid CHECK (scope_type = 'ORGANIZATION'::scope_type AND unit_id IS NULL AND project_id IS NULL OR scope_type = 'UNIT'::scope_type AND unit_id IS NOT NULL AND project_id IS NULL OR scope_type = 'PROJECT'::scope_type AND unit_id IS NULL AND project_id IS NOT NULL OR scope_type = 'SELF'::scope_type AND unit_id IS NULL AND project_id IS NULL);
alter table public.organization_members add constraint organization_members_dates_valid CHECK (ended_at IS NULL OR ended_at >= joined_at);
alter table public.organizations add constraint organizations_cnpj_format CHECK (cnpj IS NULL OR cnpj ~ '^[0-9]{14}$'::text);
alter table public.organizations add constraint organizations_legal_name_not_blank CHECK (btrim(legal_name) <> ''::text);
alter table public.organizations add constraint organizations_slug_not_blank CHECK (btrim(slug) <> ''::text);
alter table public.permissions add constraint permissions_action_not_blank CHECK (btrim(action) <> ''::text);
alter table public.permissions add constraint permissions_code_not_blank CHECK (btrim(code) <> ''::text);
alter table public.permissions add constraint permissions_resource_not_blank CHECK (btrim(resource) <> ''::text);
alter table public.person_addresses add constraint person_addresses_country_code_format CHECK (country_code ~ '^[A-Z]{2}$'::text);
alter table public.person_addresses add constraint person_addresses_postal_code_format CHECK (postal_code IS NULL OR postal_code ~ '^[0-9]{8}$'::text);
alter table public.person_addresses add constraint person_addresses_state_code_format CHECK (state_code IS NULL OR state_code ~ '^[A-Z]{2}$'::text);
alter table public.person_relationships add constraint person_relationships_not_self CHECK (person_id <> related_person_id);
alter table public.person_relationships add constraint person_relationships_type_not_blank CHECK (btrim(relationship_type) <> ''::text);
alter table public.persons add constraint persons_cnpj_format CHECK (cnpj IS NULL OR cnpj ~ '^[0-9]{14}$'::text);
alter table public.persons add constraint persons_cpf_format CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$'::text);
alter table public.persons add constraint persons_full_name_not_blank CHECK (btrim(full_name) <> ''::text);
alter table public.persons add constraint persons_individual_document_rule CHECK (person_type <> 'INDIVIDUAL'::person_type OR cnpj IS NULL);
alter table public.persons add constraint persons_organization_document_rule CHECK (person_type <> 'ORGANIZATION'::person_type OR cpf IS NULL);
alter table public.project_units add constraint project_units_dates_valid CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at);
alter table public.projects add constraint projects_dates_valid CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at);
alter table public.projects add constraint projects_name_not_blank CHECK (btrim(name) <> ''::text);
alter table public.projects add constraint projects_slug_not_blank CHECK (btrim(slug) <> ''::text);
alter table public.roles add constraint roles_code_not_blank CHECK (btrim(code) <> ''::text);
alter table public.roles add constraint roles_name_not_blank CHECK (btrim(name) <> ''::text);
alter table public.units add constraint units_country_code_format CHECK (country_code ~ '^[A-Z]{2}$'::text);
alter table public.units add constraint units_name_not_blank CHECK (btrim(name) <> ''::text);
alter table public.units add constraint units_postal_code_format CHECK (postal_code IS NULL OR postal_code ~ '^[0-9]{8}$'::text);
alter table public.units add constraint units_slug_not_blank CHECK (btrim(slug) <> ''::text);
alter table public.units add constraint units_state_code_format CHECK (state_code IS NULL OR state_code ~ '^[A-Z]{2}$'::text);
alter table public.user_profiles add constraint user_profiles_email_not_blank CHECK (btrim(email) <> ''::text);
alter table public.user_profiles add constraint user_profiles_identity_provider_not_blank CHECK (btrim(identity_provider) <> ''::text);
alter table audit.audit_events add constraint audit_events_organization_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;
alter table audit.audit_events add constraint audit_events_person_fk FOREIGN KEY (actor_person_id) REFERENCES persons(id) ON UPDATE CASCADE ON DELETE RESTRICT;
alter table audit.audit_events add constraint audit_events_user_profile_fk FOREIGN KEY (actor_user_profile_id) REFERENCES user_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT;
alter table public.member_roles add constraint member_roles_member_fk FOREIGN KEY (organization_member_id) REFERENCES organization_members(id) ON UPDATE CASCADE ON DELETE RESTRICT;
alter table public.member_roles add constraint member_roles_role_fk FOREIGN KEY (role_id) REFERENCES roles(id) ON UPDATE CASCADE ON DELETE RESTRICT;
alter table public.member_scopes add constraint member_scopes_member_fk FOREIGN KEY (organization_member_id) REFERENCES organization_members(id) ON UPDATE CASCADE ON DELETE RESTRICT;
alter table public.member_scopes add constraint member_scopes_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE CASCADE ON DELETE RESTRICT;
alter table public.member_scopes add constraint member_scopes_unit_fk FOREIGN KEY (unit_id) REFERENCES units(id) ON UPDATE CASCADE ON DELETE RESTRICT;
alter table public.organization_members add constraint organization_members_organization_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;
alter table public.organization_members add constraint organization_members_person_fk FOREIGN KEY (person_id) REFERENCES persons(id) ON UPDATE CASCADE ON DELETE RESTRICT;
alter table public.organization_members add constraint organization_members_user_profile_fk FOREIGN KEY (user_profile_id) REFERENCES user_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT;
alter table public.payment_events add constraint payment_events_donation_id_fkey FOREIGN KEY (donation_id) REFERENCES donations(id);
alter table public.person_addresses add constraint person_addresses_organization_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;
alter table public.person_addresses add constraint person_addresses_person_fk FOREIGN KEY (person_id) REFERENCES persons(id) ON UPDATE CASCADE ON DELETE RESTRICT;
alter table public.person_relationships add constraint person_relationships_organization_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;
alter table public.person_relationships add constraint person_relationships_person_fk FOREIGN KEY (person_id) REFERENCES persons(id) ON UPDATE CASCADE ON DELETE RESTRICT;
alter table public.person_relationships add constraint person_relationships_related_person_fk FOREIGN KEY (related_person_id) REFERENCES persons(id) ON UPDATE CASCADE ON DELETE RESTRICT;
alter table public.persons add constraint persons_organization_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;
alter table public.project_units add constraint project_units_organization_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;
alter table public.project_units add constraint project_units_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON UPDATE CASCADE ON DELETE RESTRICT;
alter table public.project_units add constraint project_units_unit_fk FOREIGN KEY (unit_id) REFERENCES units(id) ON UPDATE CASCADE ON DELETE RESTRICT;
alter table public.projects add constraint projects_organization_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;
alter table public.role_permissions add constraint role_permissions_permission_fk FOREIGN KEY (permission_id) REFERENCES permissions(id) ON UPDATE CASCADE ON DELETE CASCADE;
alter table public.role_permissions add constraint role_permissions_role_fk FOREIGN KEY (role_id) REFERENCES roles(id) ON UPDATE CASCADE ON DELETE CASCADE;
alter table public.roles add constraint roles_organization_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;
alter table public.units add constraint units_organization_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;
alter table public.user_profiles add constraint user_profiles_auth_user_fk FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;
alter table public.user_profiles add constraint user_profiles_person_fk FOREIGN KEY (person_id) REFERENCES persons(id) ON UPDATE CASCADE ON DELETE RESTRICT;
CREATE INDEX audit_events_action_idx ON audit.audit_events USING btree (action, occurred_at DESC);
CREATE INDEX audit_events_actor_idx ON audit.audit_events USING btree (actor_user_profile_id, occurred_at DESC);
CREATE INDEX audit_events_org_time_idx ON audit.audit_events USING btree (organization_id, occurred_at DESC);
CREATE INDEX audit_events_person_idx ON audit.audit_events USING btree (actor_person_id);
CREATE INDEX audit_events_resource_idx ON audit.audit_events USING btree (resource_type, resource_id, occurred_at DESC);
CREATE UNIQUE INDEX member_roles_active_unique ON public.member_roles USING btree (organization_member_id, role_id) WHERE (ends_at IS NULL);
CREATE INDEX member_roles_member_idx ON public.member_roles USING btree (organization_member_id);
CREATE INDEX member_roles_role_idx ON public.member_roles USING btree (role_id);
CREATE INDEX member_scopes_member_idx ON public.member_scopes USING btree (organization_member_id);
CREATE INDEX member_scopes_project_idx ON public.member_scopes USING btree (project_id) WHERE (project_id IS NOT NULL);
CREATE INDEX member_scopes_unit_idx ON public.member_scopes USING btree (unit_id) WHERE (unit_id IS NOT NULL);
CREATE INDEX organization_members_org_idx ON public.organization_members USING btree (organization_id, status);
CREATE INDEX organization_members_person_idx ON public.organization_members USING btree (person_id);
CREATE INDEX organization_members_user_profile_idx ON public.organization_members USING btree (user_profile_id);
CREATE UNIQUE INDEX organizations_cnpj_unique ON public.organizations USING btree (cnpj) WHERE ((cnpj IS NOT NULL) AND (deleted_at IS NULL));
CREATE UNIQUE INDEX organizations_slug_unique ON public.organizations USING btree (lower(slug)) WHERE (deleted_at IS NULL);
CREATE INDEX organizations_status_idx ON public.organizations USING btree (status) WHERE (deleted_at IS NULL);
CREATE INDEX payment_events_donation_idx ON public.payment_events USING btree (donation_id);
CREATE INDEX permissions_resource_action_idx ON public.permissions USING btree (resource, action);
CREATE UNIQUE INDEX person_addresses_one_primary ON public.person_addresses USING btree (person_id) WHERE (is_primary AND (deleted_at IS NULL));
CREATE INDEX person_addresses_organization_idx ON public.person_addresses USING btree (organization_id);
CREATE INDEX person_addresses_person_idx ON public.person_addresses USING btree (person_id) WHERE (deleted_at IS NULL);
CREATE INDEX person_relationships_organization_idx ON public.person_relationships USING btree (organization_id);
CREATE INDEX person_relationships_person_idx ON public.person_relationships USING btree (person_id) WHERE (deleted_at IS NULL);
CREATE INDEX person_relationships_related_idx ON public.person_relationships USING btree (related_person_id) WHERE (deleted_at IS NULL);
CREATE INDEX persons_email_idx ON public.persons USING btree (organization_id, lower(primary_email)) WHERE ((primary_email IS NOT NULL) AND (deleted_at IS NULL));
CREATE INDEX persons_name_idx ON public.persons USING btree (organization_id, lower(full_name)) WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX persons_org_cnpj_unique ON public.persons USING btree (organization_id, cnpj) WHERE ((cnpj IS NOT NULL) AND (deleted_at IS NULL));
CREATE UNIQUE INDEX persons_org_cpf_unique ON public.persons USING btree (organization_id, cpf) WHERE ((cpf IS NOT NULL) AND (deleted_at IS NULL));
CREATE INDEX persons_organization_idx ON public.persons USING btree (organization_id) WHERE (deleted_at IS NULL);
CREATE INDEX persons_status_idx ON public.persons USING btree (organization_id, status) WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX project_units_one_primary_per_project ON public.project_units USING btree (project_id) WHERE is_primary;
CREATE INDEX project_units_organization_idx ON public.project_units USING btree (organization_id);
CREATE INDEX project_units_project_idx ON public.project_units USING btree (project_id);
CREATE INDEX project_units_unit_idx ON public.project_units USING btree (unit_id);
CREATE INDEX projects_org_clinical_idx ON public.projects USING btree (organization_id, has_clinical_care) WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX projects_org_slug_unique ON public.projects USING btree (organization_id, lower(slug)) WHERE (deleted_at IS NULL);
CREATE INDEX projects_org_status_idx ON public.projects USING btree (organization_id, status) WHERE (deleted_at IS NULL);
CREATE INDEX role_permissions_permission_idx ON public.role_permissions USING btree (permission_id);
CREATE INDEX role_permissions_role_idx ON public.role_permissions USING btree (role_id);
CREATE UNIQUE INDEX roles_org_code_unique ON public.roles USING btree (organization_id, lower(code)) WHERE ((organization_id IS NOT NULL) AND (deleted_at IS NULL));
CREATE INDEX roles_org_status_idx ON public.roles USING btree (organization_id, status) WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX roles_system_code_unique ON public.roles USING btree (lower(code)) WHERE ((organization_id IS NULL) AND (deleted_at IS NULL));
CREATE INDEX units_city_idx ON public.units USING btree (organization_id, city) WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX units_one_headquarters_per_org ON public.units USING btree (organization_id) WHERE (is_headquarters AND (deleted_at IS NULL));
CREATE UNIQUE INDEX units_org_slug_unique ON public.units USING btree (organization_id, lower(slug)) WHERE (deleted_at IS NULL);
CREATE INDEX units_organization_idx ON public.units USING btree (organization_id) WHERE (deleted_at IS NULL);
CREATE INDEX units_status_idx ON public.units USING btree (organization_id, status) WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX user_profiles_email_unique ON public.user_profiles USING btree (lower(email));
CREATE UNIQUE INDEX user_profiles_person_unique ON public.user_profiles USING btree (person_id);
commit;

