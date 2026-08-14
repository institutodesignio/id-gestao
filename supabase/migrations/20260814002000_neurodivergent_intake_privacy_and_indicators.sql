-- Modules 7-11: neurodivergent intake, consent, care demands,
-- privacy governance and anonymized indicators.

create table public.neurodivergent_intakes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  person_id uuid not null references public.persons(id) on delete restrict,
  respondent_person_id uuid references public.persons(id) on delete restrict,
  protocol_number text not null unique default ('ND-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  respondent_role text not null check (respondent_role in ('SELF','MOTHER_FATHER','LEGAL_GUARDIAN','CAREGIVER_SUPPORTER','OTHER')),
  respondent_relationship text,
  channel text not null default 'SITE' check (channel in ('IN_PERSON','PAPER','SITE')),
  status text not null default 'DRAFT' check (status in ('DRAFT','SUBMITTED','REVIEWED','DUPLICATE','ARCHIVED')),
  collected_at timestamptz not null default now(),
  submitted_at timestamptz,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid,
  deleted_at timestamptz, deleted_by uuid,
  check ((respondent_role = 'SELF' and respondent_person_id is null) or respondent_role <> 'SELF')
);
create index neuro_intakes_org_status_idx on public.neurodivergent_intakes(organization_id, status, collected_at desc) where deleted_at is null;
create index neuro_intakes_person_idx on public.neurodivergent_intakes(person_id, collected_at desc) where deleted_at is null;

create table public.neurodivergent_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  person_id uuid not null references public.persons(id) on delete restrict,
  intake_id uuid not null unique references public.neurodivergent_intakes(id) on delete restrict,
  identification_status text not null check (identification_status in ('DIAGNOSED','UNDER_EVALUATION','SELF_IDENTIFIED_SUSPECTED','PREFER_NOT_TO_SAY')),
  conditions text[] not null default '{}',
  other_condition text,
  report_status text not null default 'PREFER_NOT_TO_SAY' check (report_status in ('YES','NO','IN_PROGRESS','PREFER_NOT_TO_SAY')),
  education_statuses text[] not null default '{}', education_institution text, school_support_needed text,
  employment_status text check (employment_status in ('WORKING','SEEKING_WORK','ON_LEAVE','RETIRED','NOT_WORKING','NOT_APPLICABLE')),
  service_networks text[] not null default '{}', current_services text,
  waiting_for_service boolean, waiting_details text,
  priority_needs text[] not null default '{}', primary_need_barrier text not null,
  accessibility_supports text[] not null default '{}', accessibility_other text,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid,
  deleted_at timestamptz, deleted_by uuid,
  check (cardinality(priority_needs) <= 5)
);
create index neuro_profiles_org_person_idx on public.neurodivergent_profiles(organization_id, person_id) where deleted_at is null;
create index neuro_profiles_conditions_gin on public.neurodivergent_profiles using gin(conditions);
create index neuro_profiles_priorities_gin on public.neurodivergent_profiles using gin(priority_needs);

create table public.data_consents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  person_id uuid not null references public.persons(id) on delete restrict,
  intake_id uuid references public.neurodivergent_intakes(id) on delete restrict,
  consented_by_person_id uuid not null references public.persons(id) on delete restrict,
  consent_role text not null check (consent_role in ('SELF_ADULT','MOTHER_FATHER','LEGAL_GUARDIAN')),
  term_version text not null,
  sensitive_data_consent boolean not null check (sensitive_data_consent),
  assent_recorded boolean not null default false,
  communication_channels text[] not null default '{}',
  signed_at timestamptz not null,
  revoked_at timestamptz, revocation_reason text,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid,
  check (revoked_at is null or revoked_at >= signed_at)
);
create unique index data_consents_active_unique on public.data_consents(person_id, term_version) where revoked_at is null;
create index data_consents_org_person_idx on public.data_consents(organization_id, person_id, signed_at desc);

create table public.care_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  person_id uuid not null references public.persons(id) on delete restrict,
  intake_id uuid references public.neurodivergent_intakes(id) on delete restrict,
  project_id uuid references public.projects(id) on delete restrict,
  category text not null, description text not null,
  priority text not null default 'NORMAL' check (priority in ('LOW','NORMAL','HIGH','URGENT')),
  status text not null default 'IDENTIFIED' check (status in ('IDENTIFIED','WAITING','REFERRED','IN_SERVICE','COMPLETED','CANCELLED')),
  waiting_since date, referral_destination text, assigned_person_id uuid references public.persons(id) on delete restrict,
  resolved_at timestamptz,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid,
  deleted_at timestamptz, deleted_by uuid,
  check ((status = 'COMPLETED' and resolved_at is not null) or status <> 'COMPLETED')
);
create index care_requests_org_status_idx on public.care_requests(organization_id, status, priority, created_at) where deleted_at is null;
create index care_requests_person_idx on public.care_requests(person_id, created_at desc) where deleted_at is null;
create index care_requests_project_idx on public.care_requests(project_id) where project_id is not null and deleted_at is null;

create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  person_id uuid not null references public.persons(id) on delete restrict,
  request_type text not null check (request_type in ('CONFIRMATION','ACCESS','CORRECTION','SHARING_INFORMATION','REVOCATION','DELETION','ANONYMIZATION')),
  description text, status text not null default 'RECEIVED' check (status in ('RECEIVED','IDENTITY_CHECK','IN_PROGRESS','COMPLETED','DENIED')),
  received_at timestamptz not null default now(), due_at date, completed_at timestamptz,
  decision_reason text,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);
create index privacy_requests_org_status_due_idx on public.privacy_requests(organization_id, status, due_at);

create table public.data_retention_reviews (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  person_id uuid not null references public.persons(id) on delete restrict,
  last_confirmation_at timestamptz not null, review_due_at date not null,
  decision text check (decision in ('KEEP_ACTIVE','ANONYMIZE','DELETE','LEGAL_HOLD')),
  decided_at timestamptz, reason text,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);
create unique index retention_review_open_unique on public.data_retention_reviews(person_id) where decided_at is null;
create index retention_reviews_org_due_idx on public.data_retention_reviews(organization_id, review_due_at) where decided_at is null;

alter table public.neurodivergent_intakes enable row level security;
alter table public.neurodivergent_profiles enable row level security;
alter table public.data_consents enable row level security;
alter table public.care_requests enable row level security;
alter table public.privacy_requests enable row level security;
alter table public.data_retention_reviews enable row level security;
grant select,insert,update on public.neurodivergent_intakes,public.neurodivergent_profiles,public.data_consents,public.care_requests,public.privacy_requests,public.data_retention_reviews to authenticated;

create policy neuro_intakes_read on public.neurodivergent_intakes for select to authenticated using (deleted_at is null and internal.has_permission(organization_id,'neurodivergent_profile.read'));
create policy neuro_intakes_write on public.neurodivergent_intakes for insert to authenticated with check (internal.has_permission(organization_id,'neurodivergent_profile.manage'));
create policy neuro_intakes_update on public.neurodivergent_intakes for update to authenticated using (deleted_at is null and internal.has_permission(organization_id,'neurodivergent_profile.manage')) with check (internal.has_permission(organization_id,'neurodivergent_profile.manage'));
create policy neuro_profiles_read on public.neurodivergent_profiles for select to authenticated using (deleted_at is null and internal.has_permission(organization_id,'neurodivergent_profile.read'));
create policy neuro_profiles_write on public.neurodivergent_profiles for insert to authenticated with check (internal.has_permission(organization_id,'neurodivergent_profile.manage'));
create policy neuro_profiles_update on public.neurodivergent_profiles for update to authenticated using (deleted_at is null and internal.has_permission(organization_id,'neurodivergent_profile.manage')) with check (internal.has_permission(organization_id,'neurodivergent_profile.manage'));
create policy consents_read on public.data_consents for select to authenticated using (internal.has_permission(organization_id,'consent.read'));
create policy consents_write on public.data_consents for insert to authenticated with check (internal.has_permission(organization_id,'consent.manage'));
create policy consents_update on public.data_consents for update to authenticated using (internal.has_permission(organization_id,'consent.manage')) with check (internal.has_permission(organization_id,'consent.manage'));
create policy care_requests_read on public.care_requests for select to authenticated using (deleted_at is null and internal.has_permission(organization_id,'care_request.read'));
create policy care_requests_write on public.care_requests for insert to authenticated with check (internal.has_permission(organization_id,'care_request.manage'));
create policy care_requests_update on public.care_requests for update to authenticated using (deleted_at is null and internal.has_permission(organization_id,'care_request.manage')) with check (internal.has_permission(organization_id,'care_request.manage'));
create policy privacy_requests_read on public.privacy_requests for select to authenticated using (internal.has_permission(organization_id,'privacy.read'));
create policy privacy_requests_write on public.privacy_requests for insert to authenticated with check (internal.has_permission(organization_id,'privacy.manage'));
create policy privacy_requests_update on public.privacy_requests for update to authenticated using (internal.has_permission(organization_id,'privacy.manage')) with check (internal.has_permission(organization_id,'privacy.manage'));
create policy retention_reviews_read on public.data_retention_reviews for select to authenticated using (internal.has_permission(organization_id,'privacy.read'));
create policy retention_reviews_write on public.data_retention_reviews for insert to authenticated with check (internal.has_permission(organization_id,'privacy.manage'));
create policy retention_reviews_update on public.data_retention_reviews for update to authenticated using (internal.has_permission(organization_id,'privacy.manage')) with check (internal.has_permission(organization_id,'privacy.manage'));

insert into public.permissions(code,resource,action,description,is_system) values
('neurodivergent_profile.read','neurodivergent_profile','read','Consultar cadastros neurodivergentes sensíveis.',true),
('neurodivergent_profile.manage','neurodivergent_profile','manage','Gerenciar cadastros neurodivergentes sensíveis.',true),
('consent.read','consent','read','Consultar consentimentos.',true),('consent.manage','consent','manage','Registrar e revogar consentimentos.',true),
('care_request.read','care_request','read','Consultar demandas e encaminhamentos.',true),('care_request.manage','care_request','manage','Gerenciar demandas e encaminhamentos.',true),
('indicator.read','indicator','read','Consultar indicadores anonimizados.',true),
('privacy.read','privacy','read','Consultar solicitações e revisões de privacidade.',true),('privacy.manage','privacy','manage','Gerenciar direitos do titular e retenção.',true)
on conflict (code) do update set description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.organization_id is null and r.code in ('ADMINISTRATOR','MANAGER','TECHNICAL_RESPONSIBLE')
and p.code in ('neurodivergent_profile.read','neurodivergent_profile.manage','consent.read','consent.manage','care_request.read','care_request.manage','indicator.read','privacy.read','privacy.manage') on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.organization_id is null and r.code='TECHNICAL_PROFESSIONAL'
and p.code in ('neurodivergent_profile.read','neurodivergent_profile.manage','consent.read','care_request.read','care_request.manage','indicator.read') on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.organization_id is null and r.code='ADMINISTRATIVE_PROFESSIONAL'
and p.code in ('neurodivergent_profile.read','neurodivergent_profile.manage','consent.read','consent.manage','care_request.read','privacy.read') on conflict do nothing;

create or replace function internal.validate_neurodivergent_references() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if not exists(select 1 from public.persons p where p.id=new.person_id and p.organization_id=new.organization_id and p.deleted_at is null) then raise exception 'INVALID_PERSON_REFERENCE' using errcode='23514'; end if;
  if tg_table_name='neurodivergent_intakes' and new.respondent_person_id is not null and not exists(select 1 from public.persons p where p.id=new.respondent_person_id and p.organization_id=new.organization_id and p.deleted_at is null) then raise exception 'INVALID_RESPONDENT_REFERENCE' using errcode='23514'; end if;
  if tg_table_name='neurodivergent_profiles' and not exists(select 1 from public.neurodivergent_intakes i where i.id=new.intake_id and i.person_id=new.person_id and i.organization_id=new.organization_id and i.deleted_at is null) then raise exception 'INVALID_INTAKE_REFERENCE' using errcode='23514'; end if;
  if tg_table_name='data_consents' and (not exists(select 1 from public.persons p where p.id=new.consented_by_person_id and p.organization_id=new.organization_id and p.deleted_at is null) or (new.intake_id is not null and not exists(select 1 from public.neurodivergent_intakes i where i.id=new.intake_id and i.person_id=new.person_id and i.organization_id=new.organization_id))) then raise exception 'INVALID_CONSENT_REFERENCE' using errcode='23514'; end if;
  if tg_table_name='care_requests' and ((new.intake_id is not null and not exists(select 1 from public.neurodivergent_intakes i where i.id=new.intake_id and i.person_id=new.person_id and i.organization_id=new.organization_id)) or (new.project_id is not null and not exists(select 1 from public.projects p where p.id=new.project_id and p.organization_id=new.organization_id and p.deleted_at is null)) or (new.assigned_person_id is not null and not exists(select 1 from public.persons p where p.id=new.assigned_person_id and p.organization_id=new.organization_id and p.deleted_at is null))) then raise exception 'INVALID_CARE_REFERENCE' using errcode='23514'; end if;
  return new;
end $$;
revoke all on function internal.validate_neurodivergent_references() from public,anon,authenticated;
create trigger neuro_intakes_validate before insert or update on public.neurodivergent_intakes for each row execute function internal.validate_neurodivergent_references();
create trigger neuro_profiles_validate before insert or update on public.neurodivergent_profiles for each row execute function internal.validate_neurodivergent_references();
create trigger data_consents_validate before insert or update on public.data_consents for each row execute function internal.validate_neurodivergent_references();
create trigger care_requests_validate before insert or update on public.care_requests for each row execute function internal.validate_neurodivergent_references();
create trigger privacy_requests_validate before insert or update on public.privacy_requests for each row execute function internal.validate_neurodivergent_references();
create trigger retention_reviews_validate before insert or update on public.data_retention_reviews for each row execute function internal.validate_neurodivergent_references();

create or replace function public.neurodivergent_population_indicators(p_dimension text)
returns table(value text,total bigint) language sql stable security invoker set search_path=pg_catalog,public as $$
  select x.value,count(*) from (
    select unnest(case when p_dimension='condition' then np.conditions when p_dimension='priority_need' then np.priority_needs else '{}'::text[] end) value
    from public.neurodivergent_profiles np where np.deleted_at is null and internal.has_permission(np.organization_id,'indicator.read')
  ) x where p_dimension in ('condition','priority_need') group by x.value having count(*) >= 5 order by count(*) desc,x.value;
$$;
revoke all on function public.neurodivergent_population_indicators(text) from public,anon;
grant execute on function public.neurodivergent_population_indicators(text) to authenticated;

create or replace function public.submit_neurodivergent_intake(p_organization_id uuid,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_intake public.neurodivergent_intakes; v_profile public.neurodivergent_profiles; v_consent public.data_consents;
begin
  if auth.uid() is null or not internal.has_permission(p_organization_id,'neurodivergent_profile.manage') or not internal.has_permission(p_organization_id,'consent.manage') then raise exception 'PERMISSION_DENIED' using errcode='42501'; end if;
  insert into public.neurodivergent_intakes(organization_id,person_id,respondent_person_id,respondent_role,respondent_relationship,channel,status,submitted_at,created_by,updated_by)
  values(p_organization_id,(p_payload->>'person_id')::uuid,nullif(p_payload->>'respondent_person_id','')::uuid,p_payload->>'respondent_role',p_payload->>'respondent_relationship',coalesce(p_payload->>'channel','SITE'),'SUBMITTED',now(),auth.uid(),auth.uid()) returning * into v_intake;
  insert into public.neurodivergent_profiles(organization_id,person_id,intake_id,identification_status,conditions,other_condition,report_status,education_statuses,education_institution,school_support_needed,employment_status,service_networks,current_services,waiting_for_service,waiting_details,priority_needs,primary_need_barrier,accessibility_supports,accessibility_other,created_by,updated_by)
  values(p_organization_id,v_intake.person_id,v_intake.id,p_payload#>>'{profile,identification_status}',array(select jsonb_array_elements_text(coalesce(p_payload#>'{profile,conditions}','[]'))),p_payload#>>'{profile,other_condition}',coalesce(p_payload#>>'{profile,report_status}','PREFER_NOT_TO_SAY'),array(select jsonb_array_elements_text(coalesce(p_payload#>'{profile,education_statuses}','[]'))),p_payload#>>'{profile,education_institution}',p_payload#>>'{profile,school_support_needed}',p_payload#>>'{profile,employment_status}',array(select jsonb_array_elements_text(coalesce(p_payload#>'{profile,service_networks}','[]'))),p_payload#>>'{profile,current_services}',nullif(p_payload#>>'{profile,waiting_for_service}','')::boolean,p_payload#>>'{profile,waiting_details}',array(select jsonb_array_elements_text(coalesce(p_payload#>'{profile,priority_needs}','[]'))),p_payload#>>'{profile,primary_need_barrier}',array(select jsonb_array_elements_text(coalesce(p_payload#>'{profile,accessibility_supports}','[]'))),p_payload#>>'{profile,accessibility_other}',auth.uid(),auth.uid()) returning * into v_profile;
  insert into public.data_consents(organization_id,person_id,intake_id,consented_by_person_id,consent_role,term_version,sensitive_data_consent,assent_recorded,communication_channels,signed_at,created_by,updated_by)
  values(p_organization_id,v_intake.person_id,v_intake.id,(p_payload#>>'{consent,consented_by_person_id}')::uuid,p_payload#>>'{consent,consent_role}',p_payload#>>'{consent,term_version}',true,coalesce((p_payload#>>'{consent,assent_recorded}')::boolean,false),array(select jsonb_array_elements_text(coalesce(p_payload#>'{consent,communication_channels}','[]'))),(p_payload#>>'{consent,signed_at}')::timestamptz,auth.uid(),auth.uid()) returning * into v_consent;
  return jsonb_build_object('intake_id',v_intake.id,'protocol_number',v_intake.protocol_number,'profile_id',v_profile.id,'consent_id',v_consent.id,'status',v_intake.status);
end $$;
revoke all on function public.submit_neurodivergent_intake(uuid,jsonb) from public,anon;
grant execute on function public.submit_neurodivergent_intake(uuid,jsonb) to authenticated;
