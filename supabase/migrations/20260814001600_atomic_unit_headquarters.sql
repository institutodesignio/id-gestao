begin;
create or replace function internal.enforce_single_unit_headquarters()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,internal,auth
as $$
begin
  if new.is_headquarters is true and (tg_op='INSERT' or old.is_headquarters is distinct from true) then
    if auth.uid() is not null and not internal.has_permission(new.organization_id,
      case when tg_op='INSERT' then 'unit.create' else 'unit.update' end) then
      raise exception 'PERMISSION_DENIED' using errcode='42501';
    end if;
    update public.units set is_headquarters=false,updated_at=now(),updated_by=coalesce(auth.uid(),new.updated_by)
    where organization_id=new.organization_id and id<>new.id and is_headquarters=true and deleted_at is null;
  end if;
  return new;
end
$$;
revoke all on function internal.enforce_single_unit_headquarters() from public,anon,authenticated;
drop trigger if exists units_single_headquarters_before_write on public.units;
create trigger units_single_headquarters_before_write before insert or update of is_headquarters on public.units
for each row execute function internal.enforce_single_unit_headquarters();
commit;
