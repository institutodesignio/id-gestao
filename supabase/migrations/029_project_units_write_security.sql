begin;

-- ============================================================
-- PROJECT_UNITS — SECURITY HARDENING
-- ============================================================

revoke all privileges
on table public.project_units
from anon;

revoke all privileges
on table public.project_units
from authenticated;

-- Leitura continua controlada pela RLS.
grant select
on table public.project_units
to authenticated;

-- ============================================================
-- INSERT
-- ============================================================

grant insert (
  organization_id,
  project_id,
  unit_id,
  starts_at,
  ends_at,
  is_primary,
  created_by,
  updated_at,
  updated_by
)
on table public.project_units
to authenticated;

-- ============================================================
-- UPDATE
--
-- IDs estruturais não podem ser alterados.
-- ============================================================

grant update (
  starts_at,
  ends_at,
  is_primary,
  updated_at,
  updated_by
)
on table public.project_units
to authenticated;

-- ============================================================
-- DELETE
--
-- Associação pode ser removida fisicamente.
-- project_units é tabela associativa e não possui soft-delete.
-- ============================================================

grant delete
on table public.project_units
to authenticated;

-- ============================================================
-- INSERT POLICY
-- ============================================================

drop policy if exists project_units_insert_authorized
on public.project_units;

create policy project_units_insert_authorized
on public.project_units
for insert
to authenticated
with check (
  internal.has_permission(
    organization_id,
    'project.update'
  )

  and internal.has_project_scope(
    organization_id,
    project_id
  )

  and internal.has_permission(
    organization_id,
    'unit.read'
  )

  and internal.has_unit_scope(
    organization_id,
    unit_id
  )
);

-- ============================================================
-- UPDATE POLICY
-- ============================================================

drop policy if exists project_units_update_authorized
on public.project_units;

create policy project_units_update_authorized
on public.project_units
for update
to authenticated
using (
  internal.has_permission(
    organization_id,
    'project.update'
  )

  and internal.has_project_scope(
    organization_id,
    project_id
  )

  and internal.has_unit_scope(
    organization_id,
    unit_id
  )
)
with check (
  internal.has_permission(
    organization_id,
    'project.update'
  )

  and internal.has_project_scope(
    organization_id,
    project_id
  )

  and internal.has_unit_scope(
    organization_id,
    unit_id
  )
);

-- ============================================================
-- DELETE POLICY
-- ============================================================

drop policy if exists project_units_delete_authorized
on public.project_units;

create policy project_units_delete_authorized
on public.project_units
for delete
to authenticated
using (
  internal.has_permission(
    organization_id,
    'project.update'
  )

  and internal.has_project_scope(
    organization_id,
    project_id
  )
);

-- ============================================================
-- UMA ÚNICA UNIDADE PRINCIPAL POR PROJETO
-- ============================================================

create unique index if not exists
project_units_one_primary_per_project
on public.project_units (
  project_id
)
where is_primary = true;

commit;