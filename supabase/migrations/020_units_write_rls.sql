begin;

alter table public.units
enable row level security;

drop policy if exists units_insert_authorized
on public.units;

create policy units_insert_authorized
on public.units
for insert
to authenticated
with check (
  internal.has_permission(
    organization_id,
    'unit.create'
  )
);

drop policy if exists units_update_authorized
on public.units;

create policy units_update_authorized
on public.units
for update
to authenticated
using (
  deleted_at is null

  and internal.has_permission(
    organization_id,
    'unit.update'
  )

  and internal.has_unit_scope(
    organization_id,
    id
  )
)
with check (
  internal.has_permission(
    organization_id,
    'unit.update'
  )

  and internal.has_unit_scope(
    organization_id,
    id
  )
);

commit;