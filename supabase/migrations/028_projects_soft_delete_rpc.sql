begin;

create or replace function public.soft_delete_project(
  p_project_id uuid
)
returns public.projects
language plpgsql
security definer
set search_path = public, internal
as $$
declare
  v_project public.projects;
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
  -- CARREGAR PROJETO
  -- ==========================================================

  select *
  into v_project
  from public.projects
  where id = p_project_id
    and organization_id = v_organization_id
    and deleted_at is null;

  if not found then
    raise exception 'PROJECT_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  -- ==========================================================
  -- AUTORIZAÇÃO
  -- ==========================================================

  if not internal.has_permission(
    v_organization_id,
    'project.delete'
  ) then
    raise exception 'PERMISSION_DENIED'
      using errcode = '42501';
  end if;

  if not internal.has_project_scope(
    v_organization_id,
    p_project_id
  ) then
    raise exception 'PROJECT_SCOPE_DENIED'
      using errcode = '42501';
  end if;

  -- ==========================================================
  -- SOFT DELETE
  -- ==========================================================

  update public.projects
  set
    deleted_at = now(),
    deleted_by = v_user_id,
    updated_at = now(),
    updated_by = v_user_id
  where id = p_project_id
    and organization_id = v_organization_id
    and deleted_at is null
  returning *
  into v_project;

  return v_project;
end;
$$;

revoke execute
on function public.soft_delete_project(uuid)
from public;

revoke execute
on function public.soft_delete_project(uuid)
from anon;

grant execute
on function public.soft_delete_project(uuid)
to authenticated;

commit;