begin;

-- ============================================================
-- PROJECTS — SECURITY HARDENING
-- ============================================================

-- Remove todo acesso direto anônimo.
revoke all privileges
on table public.projects
from anon;

-- Remove privilégios amplos atuais de authenticated.
revoke all privileges
on table public.projects
from authenticated;

-- ============================================================
-- LEITURA
-- A RLS existente continua decidindo quais projetos são visíveis.
-- ============================================================

grant select
on table public.projects
to authenticated;

-- ============================================================
-- INSERT
--
-- Campos de tenant/auditoria serão preenchidos pela API.
-- deleted_at/deleted_by não ficam disponíveis.
-- ============================================================

grant insert (
  organization_id,
  name,
  slug,
  short_name,
  description,
  status,
  starts_at,
  ends_at,
  has_clinical_care,
  created_by,
  updated_at,
  updated_by
)
on table public.projects
to authenticated;

-- ============================================================
-- UPDATE
--
-- Não permitir alteração direta de:
-- id
-- organization_id
-- created_at
-- created_by
-- deleted_at
-- deleted_by
-- ============================================================

grant update (
  name,
  slug,
  short_name,
  description,
  status,
  starts_at,
  ends_at,
  has_clinical_care,
  updated_at,
  updated_by
)
on table public.projects
to authenticated;

-- ============================================================
-- RLS — INSERT
-- ============================================================

drop policy if exists projects_insert_authorized
on public.projects;

create policy projects_insert_authorized
on public.projects
for insert
to authenticated
with check (
  internal.has_permission(
    organization_id,
    'project.create'
  )
);

-- ============================================================
-- RLS — UPDATE
-- ============================================================

drop policy if exists projects_update_authorized
on public.projects;

create policy projects_update_authorized
on public.projects
for update
to authenticated
using (
  deleted_at is null

  and internal.has_permission(
    organization_id,
    'project.update'
  )

  and internal.has_project_scope(
    organization_id,
    id
  )
)
with check (
  internal.has_permission(
    organization_id,
    'project.update'
  )

  and internal.has_project_scope(
    organization_id,
    id
  )
);

commit;