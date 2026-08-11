begin;

drop policy if exists units_soft_delete_authorized
on public.units;

create policy units_soft_delete_authorized
on public.units
for update
to authenticated
using (
  deleted_at is null

  and internal.has_permission(
    organization_id,
    'unit.delete'
  )

  and internal.has_unit_scope(
    organization_id,
    id
  )
)
with check (
  internal.has_permission(
    organization_id,
    'unit.delete'
  )

  and internal.has_unit_scope(
    organization_id,
    id
  )
);

commit;