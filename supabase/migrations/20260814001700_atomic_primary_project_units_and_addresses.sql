-- Make primary-unit and primary-address transitions atomic.
-- The trigger runs in the same transaction as the requested insert/update,
-- so a failed write cannot leave the parent without its previous primary row.

create or replace function internal.enforce_single_primary_project_unit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, internal
as $$
begin
  if new.is_primary is not true then
    return new;
  end if;

  if auth.uid() is null
     or not internal.has_permission(new.organization_id, 'project.update')
     or not internal.has_project_scope(new.organization_id, new.project_id) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  update public.project_units
     set is_primary = false,
         updated_at = now(),
         updated_by = auth.uid()
   where organization_id = new.organization_id
     and project_id = new.project_id
     and id <> new.id
     and is_primary = true;

  return new;
end;
$$;

revoke all on function internal.enforce_single_primary_project_unit() from public, anon, authenticated;

drop trigger if exists project_units_single_primary_before_write on public.project_units;
create trigger project_units_single_primary_before_write
before insert or update of is_primary on public.project_units
for each row
when (new.is_primary is true)
execute function internal.enforce_single_primary_project_unit();

create or replace function internal.enforce_single_primary_person_address()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, internal
as $$
begin
  if new.is_primary is not true or new.deleted_at is not null then
    return new;
  end if;

  if auth.uid() is null
     or not internal.has_permission(new.organization_id, 'person.update') then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  update public.person_addresses
     set is_primary = false,
         updated_at = now(),
         updated_by = auth.uid()
   where organization_id = new.organization_id
     and person_id = new.person_id
     and id <> new.id
     and is_primary = true
     and deleted_at is null;

  return new;
end;
$$;

revoke all on function internal.enforce_single_primary_person_address() from public, anon, authenticated;

drop trigger if exists person_addresses_single_primary_before_write on public.person_addresses;
create trigger person_addresses_single_primary_before_write
before insert or update of is_primary, deleted_at on public.person_addresses
for each row
when (new.is_primary is true and new.deleted_at is null)
execute function internal.enforce_single_primary_person_address();
