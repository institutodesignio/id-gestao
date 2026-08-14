drop policy if exists clinical_sessions_read on public.clinical_supervision_sessions;
drop policy if exists clinical_sessions_insert on public.clinical_supervision_sessions;
drop policy if exists clinical_sessions_update on public.clinical_supervision_sessions;

create policy clinical_sessions_read on public.clinical_supervision_sessions
for select to authenticated
using (
  internal.has_permission(clinical_supervision_sessions.organization_id, 'clinical_supervision.read')
  and exists (
    select 1 from public.clinical_supervision_cases c
    where c.id = clinical_supervision_sessions.case_id
      and c.organization_id = clinical_supervision_sessions.organization_id
      and c.deleted_at is null
      and internal.has_project_scope(c.organization_id, c.project_id)
  )
);

create policy clinical_sessions_insert on public.clinical_supervision_sessions
for insert to authenticated
with check (
  internal.has_permission(clinical_supervision_sessions.organization_id, 'clinical_supervision.manage')
  and exists (
    select 1 from public.clinical_supervision_cases c
    where c.id = clinical_supervision_sessions.case_id
      and c.organization_id = clinical_supervision_sessions.organization_id
      and c.deleted_at is null
      and internal.has_project_scope(c.organization_id, c.project_id)
  )
);

create policy clinical_sessions_update on public.clinical_supervision_sessions
for update to authenticated
using (
  internal.has_permission(clinical_supervision_sessions.organization_id, 'clinical_supervision.manage')
  and exists (
    select 1 from public.clinical_supervision_cases c
    where c.id = clinical_supervision_sessions.case_id
      and c.organization_id = clinical_supervision_sessions.organization_id
      and c.deleted_at is null
      and internal.has_project_scope(c.organization_id, c.project_id)
  )
)
with check (
  internal.has_permission(clinical_supervision_sessions.organization_id, 'clinical_supervision.manage')
  and exists (
    select 1 from public.clinical_supervision_cases c
    where c.id = clinical_supervision_sessions.case_id
      and c.organization_id = clinical_supervision_sessions.organization_id
      and c.deleted_at is null
      and internal.has_project_scope(c.organization_id, c.project_id)
  )
);
