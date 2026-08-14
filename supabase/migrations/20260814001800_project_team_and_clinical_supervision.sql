create table public.project_team_members (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict, person_id uuid not null references public.persons(id) on delete restrict,
  role_title text not null check (char_length(btrim(role_title)) between 1 and 120), starts_at date not null default current_date,
  ends_at date, notes text, created_at timestamptz not null default now(), created_by uuid, updated_at timestamptz not null default now(),
  updated_by uuid, deleted_at timestamptz, deleted_by uuid, check (ends_at is null or ends_at >= starts_at)
);
create unique index project_team_active_unique on public.project_team_members(project_id, person_id) where deleted_at is null and ends_at is null;
create index project_team_org_project_idx on public.project_team_members(organization_id, project_id) where deleted_at is null;

create table public.clinical_supervision_cases (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict, beneficiary_person_id uuid not null references public.persons(id) on delete restrict,
  assigned_technical_person_id uuid references public.persons(id) on delete restrict,
  status text not null default 'OPEN' check (status in ('OPEN','IN_FOLLOW_UP','PAUSED','CLOSED')),
  priority text not null default 'NORMAL' check (priority in ('LOW','NORMAL','HIGH','URGENT')),
  summary text not null check (char_length(btrim(summary)) between 1 and 2000), opened_at timestamptz not null default now(), closed_at timestamptz,
  created_at timestamptz not null default now(), created_by uuid, updated_at timestamptz not null default now(), updated_by uuid, deleted_at timestamptz, deleted_by uuid,
  check ((status = 'CLOSED' and closed_at is not null) or (status <> 'CLOSED' and closed_at is null))
);
create unique index clinical_case_open_unique on public.clinical_supervision_cases(project_id, beneficiary_person_id) where deleted_at is null and status <> 'CLOSED';
create index clinical_cases_org_status_idx on public.clinical_supervision_cases(organization_id, status, opened_at desc) where deleted_at is null;

create table public.clinical_supervision_sessions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  case_id uuid not null references public.clinical_supervision_cases(id) on delete restrict, supervisor_person_id uuid not null references public.persons(id) on delete restrict,
  scheduled_at timestamptz not null, status text not null default 'SCHEDULED' check (status in ('SCHEDULED','COMPLETED','CANCELLED','NO_SHOW')),
  notes text, created_at timestamptz not null default now(), created_by uuid, updated_at timestamptz not null default now(), updated_by uuid
);
create index clinical_sessions_case_date_idx on public.clinical_supervision_sessions(case_id, scheduled_at desc);

alter table public.project_team_members enable row level security;
alter table public.clinical_supervision_cases enable row level security;
alter table public.clinical_supervision_sessions enable row level security;
grant select, insert, update on public.project_team_members, public.clinical_supervision_cases, public.clinical_supervision_sessions to authenticated;

create policy project_team_read on public.project_team_members for select to authenticated using (deleted_at is null and internal.has_permission(organization_id,'project.read') and internal.has_project_scope(organization_id,project_id));
create policy project_team_insert on public.project_team_members for insert to authenticated with check (internal.has_permission(organization_id,'project.manage_team') and internal.has_project_scope(organization_id,project_id));
create policy project_team_update on public.project_team_members for update to authenticated using (internal.has_permission(organization_id,'project.manage_team') and internal.has_project_scope(organization_id,project_id)) with check (internal.has_permission(organization_id,'project.manage_team') and internal.has_project_scope(organization_id,project_id));
create policy clinical_cases_read on public.clinical_supervision_cases for select to authenticated using (deleted_at is null and internal.has_permission(organization_id,'clinical_supervision.read') and internal.has_project_scope(organization_id,project_id));
create policy clinical_cases_insert on public.clinical_supervision_cases for insert to authenticated with check (internal.has_permission(organization_id,'clinical_supervision.manage') and internal.has_project_scope(organization_id,project_id));
create policy clinical_cases_update on public.clinical_supervision_cases for update to authenticated using (deleted_at is null and internal.has_permission(organization_id,'clinical_supervision.manage') and internal.has_project_scope(organization_id,project_id)) with check (internal.has_permission(organization_id,'clinical_supervision.manage') and internal.has_project_scope(organization_id,project_id));
create policy clinical_sessions_read on public.clinical_supervision_sessions for select to authenticated using (internal.has_permission(organization_id,'clinical_supervision.read') and exists(select 1 from public.clinical_supervision_cases c where c.id=case_id and c.organization_id=organization_id and internal.has_project_scope(organization_id,c.project_id)));
create policy clinical_sessions_insert on public.clinical_supervision_sessions for insert to authenticated with check (internal.has_permission(organization_id,'clinical_supervision.manage') and exists(select 1 from public.clinical_supervision_cases c where c.id=case_id and c.organization_id=organization_id and internal.has_project_scope(organization_id,c.project_id)));
create policy clinical_sessions_update on public.clinical_supervision_sessions for update to authenticated using (internal.has_permission(organization_id,'clinical_supervision.manage') and exists(select 1 from public.clinical_supervision_cases c where c.id=case_id and c.organization_id=organization_id and internal.has_project_scope(organization_id,c.project_id))) with check (internal.has_permission(organization_id,'clinical_supervision.manage'));

insert into public.permissions(code,resource,action,description,is_system) values
('clinical_supervision.read','clinical_supervision','read','Consultar a Central de Supervisão Clínica.',true),
('clinical_supervision.manage','clinical_supervision','manage','Gerenciar casos e sessões de supervisão clínica.',true)
on conflict (code) do update set description=excluded.description;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.organization_id is null and r.code in ('ADMINISTRATOR','MANAGER','TECHNICAL_RESPONSIBLE') and p.code in ('clinical_supervision.read','clinical_supervision.manage')
on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.organization_id is null and r.code='TECHNICAL_PROFESSIONAL' and p.code='clinical_supervision.read'
on conflict do nothing;

create or replace function internal.validate_project_clinical_references() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if tg_table_name='project_team_members' and (not exists(select 1 from public.projects where id=new.project_id and organization_id=new.organization_id and deleted_at is null) or not exists(select 1 from public.persons where id=new.person_id and organization_id=new.organization_id and deleted_at is null)) then raise exception 'INVALID_ORGANIZATION_REFERENCE' using errcode='23514'; end if;
  if tg_table_name='clinical_supervision_cases' and (not exists(select 1 from public.projects where id=new.project_id and organization_id=new.organization_id and deleted_at is null and has_clinical_care) or not exists(select 1 from public.persons where id=new.beneficiary_person_id and organization_id=new.organization_id and deleted_at is null) or (new.assigned_technical_person_id is not null and not exists(select 1 from public.persons where id=new.assigned_technical_person_id and organization_id=new.organization_id and deleted_at is null))) then raise exception 'INVALID_CLINICAL_REFERENCE' using errcode='23514'; end if;
  if tg_table_name='clinical_supervision_sessions' and (not exists(select 1 from public.clinical_supervision_cases where id=new.case_id and organization_id=new.organization_id and deleted_at is null) or not exists(select 1 from public.persons where id=new.supervisor_person_id and organization_id=new.organization_id and deleted_at is null)) then raise exception 'INVALID_CLINICAL_SESSION_REFERENCE' using errcode='23514'; end if;
  return new;
end $$;
revoke all on function internal.validate_project_clinical_references() from public,anon,authenticated;
create trigger project_team_validate before insert or update on public.project_team_members for each row execute function internal.validate_project_clinical_references();
create trigger clinical_cases_validate before insert or update on public.clinical_supervision_cases for each row execute function internal.validate_project_clinical_references();
create trigger clinical_sessions_validate before insert or update on public.clinical_supervision_sessions for each row execute function internal.validate_project_clinical_references();
