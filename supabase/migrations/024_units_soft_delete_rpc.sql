begin;

create or replace function public.soft_delete_unit(
  p_unit_id uuid
)
returns public.units
language plpgsql
security definer
set search_path = public, internal
as $$
declare
  v_unit public.units;
  v_user_context jsonb;
  v_organization_id uuid;
  v_user_id uuid;
begin
  -- ==========================================================
  -- CONTEXTO
  -- ==========================================================

  v_user_context := public.current_user_context();

  v_organization_id :=
    ((v_user_context -> 'organization' ->> 'id'))::uuid;

  v_user_id :=
    ((v_user_context -> 'user' ->> 'auth_user_id'))::uuid;

  if v_organization_id is null then
    raise exception 'USER_CONTEXT_UNAVAILABLE'
      using errcode = '42501';
  end if;

  -- ==========================================================
  -- CARREGAR UNIDADE
  -- ==========================================================

  select *
  into v_unit
  from public.units
  where id = p_unit_id
    and organization_id = v_organization_id
    and deleted_at is null;

  if not found then
    raise exception 'UNIT_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  -- ==========================================================
  -- AUTORIZAÇÃO
  -- ==========================================================

  if not internal.has_permission(
    v_organization_id,
    'unit.delete'
  ) then
    raise exception 'PERMISSION_DENIED'
      using errcode = '42501';
  end if;

  if not internal.has_unit_scope(
    v_organization_id,
    p_unit_id
  ) then
    raise exception 'UNIT_SCOPE_DENIED'
      using errcode = '42501';
  end if;

  -- ==========================================================
  -- REGRA DE NEGÓCIO
  -- ==========================================================

  if v_unit.is_headquarters then
    raise exception 'HEADQUARTERS_CANNOT_BE_DELETED'
      using errcode = '23514';
  end if;

  -- ==========================================================
  -- SOFT DELETE
  -- ==========================================================

  update public.units
  set
    deleted_at = now(),
    deleted_by = v_user_id,
    updated_at = now(),
    updated_by = v_user_id
  where id = p_unit_id
    and organization_id = v_organization_id
    and deleted_at is null
  returning *
  into v_unit;

  return v_unit;
end;
$$;

revoke all
on function public.soft_delete_unit(uuid)
from public;

grant execute
on function public.soft_delete_unit(uuid)
to authenticated;

commit;