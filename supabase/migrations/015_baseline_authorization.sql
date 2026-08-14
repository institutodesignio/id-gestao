begin;
CREATE OR REPLACE FUNCTION internal.current_membership_id(p_organization_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
  select om.id
  from public.organization_members om
  join public.user_profiles up on up.id = om.user_profile_id
  where up.auth_user_id = auth.uid()
    and up.status = 'ACTIVE'
    and om.organization_id = p_organization_id
    and om.status = 'ACTIVE'
    and (om.ended_at is null or om.ended_at >= current_date)
  limit 1
$function$
;

CREATE OR REPLACE FUNCTION internal.current_user_context()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_auth_user_id uuid;
  v_profile_id uuid;
  v_member_id uuid;
  v_organization_id uuid;
  v_result jsonb;
BEGIN

  v_auth_user_id := auth.uid();

  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'
      USING ERRCODE = '28000';
  END IF;


  -- ----------------------------------------------------------
  -- PROFILE ATIVO
  -- ----------------------------------------------------------

  SELECT up.id
    INTO v_profile_id
  FROM public.user_profiles up
  WHERE up.auth_user_id = v_auth_user_id
    AND up.status = 'ACTIVE'
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'USER_PROFILE_NOT_FOUND';
  END IF;


  -- ----------------------------------------------------------
  -- MEMBERSHIP ATIVO E VALIDO
  -- ----------------------------------------------------------

  IF (
    SELECT count(*)
    FROM public.organization_members om
    WHERE om.user_profile_id = v_profile_id
      AND om.status = 'ACTIVE'
      AND (
        om.ended_at IS NULL
        OR om.ended_at >= current_date
      )
  ) <> 1 THEN
    RAISE EXCEPTION 'ACTIVE_MEMBERSHIP_NOT_UNIQUE';
  END IF;


  SELECT
    om.id,
    om.organization_id
  INTO
    v_member_id,
    v_organization_id
  FROM public.organization_members om
  WHERE om.user_profile_id = v_profile_id
    AND om.status = 'ACTIVE'
    AND (
      om.ended_at IS NULL
      OR om.ended_at >= current_date
    )
  LIMIT 1;


  -- ----------------------------------------------------------
  -- CONTEXTO COMPLETO
  -- ----------------------------------------------------------

  SELECT jsonb_build_object(

    'user',
    jsonb_build_object(
      'auth_user_id', au.id,
      'profile_id', up.id,
      'person_id', up.person_id,
      'email', up.email,
      'identity_provider', up.identity_provider,
      'status', up.status
    ),

    'organization',
    jsonb_build_object(
      'id', org.id,
      'legal_name', org.legal_name,
      'trade_name', org.trade_name,
      'slug', org.slug,
      'status', org.status
    ),

    'membership',
    jsonb_build_object(
      'id', om.id,
      'status', om.status
    ),

    'roles',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'code', r.code,
            'name', r.name
          )
          ORDER BY r.code
        )
        FROM public.member_roles mr
        JOIN public.roles r
          ON r.id = mr.role_id
        WHERE mr.organization_member_id = om.id
          AND mr.starts_at <= current_date
          AND (
            mr.ends_at IS NULL
            OR mr.ends_at >= current_date
          )
          AND r.status = 'ACTIVE'
          AND r.deleted_at IS NULL
      ),
      '[]'::jsonb
    ),

    'permissions',
    COALESCE(
      (
        SELECT jsonb_agg(
          to_jsonb(perms.code)
          ORDER BY perms.code
        )
        FROM (
          SELECT DISTINCT p.code

          FROM public.member_roles mr

          JOIN public.roles r
            ON r.id = mr.role_id

          JOIN public.role_permissions rp
            ON rp.role_id = r.id

          JOIN public.permissions p
            ON p.id = rp.permission_id

          WHERE mr.organization_member_id = om.id

            AND mr.starts_at <= current_date

            AND (
              mr.ends_at IS NULL
              OR mr.ends_at >= current_date
            )

            AND r.status = 'ACTIVE'
            AND r.deleted_at IS NULL

        ) perms
      ),
      '[]'::jsonb
    ),

    'scopes',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'type', ms.scope_type,
            'unit_id', ms.unit_id,
            'project_id', ms.project_id
          )
          ORDER BY
            ms.scope_type,
            ms.unit_id,
            ms.project_id
        )
        FROM public.member_scopes ms
        WHERE ms.organization_member_id = om.id
          AND ms.starts_at <= current_date
          AND (
            ms.ends_at IS NULL
            OR ms.ends_at >= current_date
          )
      ),
      '[]'::jsonb
    )

  )
  INTO v_result

  FROM public.user_profiles up

  JOIN auth.users au
    ON au.id = up.auth_user_id

  JOIN public.organization_members om
    ON om.user_profile_id = up.id

  JOIN public.organizations org
    ON org.id = om.organization_id

  WHERE up.id = v_profile_id
    AND om.id = v_member_id
    AND org.id = v_organization_id;


  IF v_result IS NULL THEN
    RAISE EXCEPTION 'USER_CONTEXT_NOT_FOUND';
  END IF;


  RETURN v_result;

END;
$function$
;

CREATE OR REPLACE FUNCTION internal.current_user_profile_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
  select up.id from public.user_profiles up
  where up.auth_user_id = auth.uid() and up.status = 'ACTIVE'
  limit 1
$function$
;

CREATE OR REPLACE FUNCTION internal.has_any_active_membership()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
  select exists (
    select 1
    from public.organization_members om
    join public.user_profiles up on up.id = om.user_profile_id
    where up.auth_user_id = auth.uid()
      and up.status = 'ACTIVE'
      and om.status = 'ACTIVE'
      and (om.ended_at is null or om.ended_at >= current_date)
  )
$function$
;

CREATE OR REPLACE FUNCTION internal.has_organization_scope(p_organization_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
  select exists (
    select 1
    from public.organization_members om
    join public.user_profiles up on up.id = om.user_profile_id
    join public.member_scopes ms on ms.organization_member_id = om.id
    where up.auth_user_id = auth.uid() and up.status = 'ACTIVE'
      and om.organization_id = p_organization_id and om.status = 'ACTIVE'
      and ms.scope_type = 'ORGANIZATION'
      and ms.starts_at <= current_date
      and (ms.ends_at is null or ms.ends_at >= current_date)
  )
$function$
;

CREATE OR REPLACE FUNCTION internal.has_permission(p_organization_id uuid, p_permission_code text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
  select exists (
    select 1
    from public.organization_members om
    join public.user_profiles up on up.id = om.user_profile_id
    join public.member_roles mr on mr.organization_member_id = om.id
    join public.roles r on r.id = mr.role_id
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    where up.auth_user_id = auth.uid()
      and up.status = 'ACTIVE'
      and om.organization_id = p_organization_id
      and om.status = 'ACTIVE'
      and (om.ended_at is null or om.ended_at >= current_date)
      and mr.starts_at <= current_date
      and (mr.ends_at is null or mr.ends_at >= current_date)
      and r.status = 'ACTIVE' and r.deleted_at is null
      and p.code = p_permission_code
  )
$function$
;

CREATE OR REPLACE FUNCTION internal.has_project_scope(p_organization_id uuid, p_project_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth', 'internal'
AS $function$
  select internal.has_organization_scope(p_organization_id) or exists (
    select 1
    from public.organization_members om
    join public.user_profiles up on up.id = om.user_profile_id
    join public.member_scopes ms on ms.organization_member_id = om.id
    where up.auth_user_id = auth.uid() and up.status = 'ACTIVE'
      and om.organization_id = p_organization_id and om.status = 'ACTIVE'
      and ms.scope_type = 'PROJECT' and ms.project_id = p_project_id
      and ms.starts_at <= current_date
      and (ms.ends_at is null or ms.ends_at >= current_date)
  )
$function$
;

CREATE OR REPLACE FUNCTION internal.has_role(p_organization_id uuid, p_role_code text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
  select exists (
    select 1
    from public.organization_members om
    join public.user_profiles up on up.id=om.user_profile_id
    join public.member_roles mr on mr.organization_member_id=om.id
    join public.roles r on r.id=mr.role_id
    where up.auth_user_id=auth.uid() and up.status='ACTIVE'
      and om.organization_id=p_organization_id and om.status='ACTIVE'
      and (om.ended_at is null or om.ended_at>=current_date)
      and mr.starts_at<=current_date and (mr.ends_at is null or mr.ends_at>=current_date)
      and r.code=p_role_code and r.status='ACTIVE' and r.deleted_at is null
  )
$function$
;

CREATE OR REPLACE FUNCTION internal.has_unit_scope(p_organization_id uuid, p_unit_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth', 'internal'
AS $function$
  select internal.has_organization_scope(p_organization_id) or exists (
    select 1
    from public.organization_members om
    join public.user_profiles up on up.id = om.user_profile_id
    join public.member_scopes ms on ms.organization_member_id = om.id
    where up.auth_user_id = auth.uid() and up.status = 'ACTIVE'
      and om.organization_id = p_organization_id and om.status = 'ACTIVE'
      and ms.scope_type = 'UNIT' and ms.unit_id = p_unit_id
      and ms.starts_at <= current_date
      and (ms.ends_at is null or ms.ends_at >= current_date)
  )
$function$
;

CREATE OR REPLACE FUNCTION internal.is_active_member(p_organization_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth', 'internal'
AS $function$ select internal.current_membership_id(p_organization_id) is not null $function$
;

CREATE OR REPLACE FUNCTION internal.write_audit_event(p_organization_id uuid, p_action text, p_resource_type text, p_resource_id uuid DEFAULT NULL::uuid, p_severity audit.audit_event_severity DEFAULT 'INFO'::audit.audit_event_severity, p_reason text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb, p_ip_address inet DEFAULT NULL::inet, p_user_agent text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'audit', 'auth'
AS $function$
declare v_event_id uuid; v_profile_id uuid; v_person_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
  if p_organization_id is not null and not internal.is_active_member(p_organization_id) then
    raise exception 'ORGANIZATION_SCOPE_DENIED' using errcode='42501';
  end if;
  select up.id,up.person_id into v_profile_id,v_person_id
  from public.user_profiles up where up.auth_user_id=auth.uid() limit 1;
  insert into audit.audit_events(
    organization_id,actor_auth_user_id,actor_user_profile_id,actor_person_id,
    action,resource_type,resource_id,severity,reason,metadata,ip_address,user_agent
  ) values (
    p_organization_id,auth.uid(),v_profile_id,v_person_id,
    p_action,p_resource_type,p_resource_id,p_severity,p_reason,coalesce(p_metadata,'{}'),p_ip_address,p_user_agent
  ) returning id into v_event_id;
  return v_event_id;
end
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_context()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'internal', 'auth', 'pg_temp'
AS $function$
  SELECT internal.current_user_context();
$function$
;

CREATE OR REPLACE FUNCTION public.hook_restrict_designio_email_domain(event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare v_email text; v_domain text;
begin
  v_email:=event->'user'->>'email';
  v_domain:=lower(split_part(v_email,'@',2));
  if v_domain='institutodesignio.org' then return '{}'::jsonb; end if;
  return jsonb_build_object('error',jsonb_build_object(
    'http_code',403,
    'message','Acesso permitido somente para contas institucionais do Instituto Designio.'
  ));
end
$function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare cmd record;
begin
  for cmd in
    select * from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE','CREATE TABLE AS','SELECT INTO')
      and object_type in ('table','partitioned table')
  loop
    if cmd.schema_name='public' then
      begin
        execute format('alter table if exists %s enable row level security',cmd.object_identity);
      exception when others then
        raise log 'rls_auto_enable: failed to enable RLS on %',cmd.object_identity;
      end;
    end if;
  end loop;
end
$function$
;

CREATE OR REPLACE FUNCTION public.soft_delete_project(p_project_id uuid)
 RETURNS projects
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'internal'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.soft_delete_unit(p_unit_id uuid)
 RETURNS units
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'internal'
AS $function$
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
$function$
;
alter table audit.audit_events enable row level security;
alter table public.donations enable row level security;
alter table public.donors enable row level security;
alter table public.member_roles enable row level security;
alter table public.member_scopes enable row level security;
alter table public.organization_members enable row level security;
alter table public.organizations enable row level security;
alter table public.payment_events enable row level security;
alter table public.permissions enable row level security;
alter table public.person_addresses enable row level security;
alter table public.person_relationships enable row level security;
alter table public.persons enable row level security;
alter table public.project_units enable row level security;
alter table public.projects enable row level security;
alter table public.role_permissions enable row level security;
alter table public.roles enable row level security;
alter table public.units enable row level security;
alter table public.user_profiles enable row level security;
revoke all on all tables in schema public from anon,authenticated;
revoke all on all tables in schema audit from anon,authenticated;
grant all on all tables in schema public to service_role;
grant all on all tables in schema audit to service_role;
grant select on all tables in schema public to authenticated;
grant insert,update on public.persons,public.person_addresses,public.person_relationships,public.organization_members,public.member_roles,public.units,public.projects,public.project_units to authenticated;
create policy member_roles_insert_authorized on public.member_roles as permissive for insert to authenticated with check ((EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.id = member_roles.organization_member_id) AND internal.has_permission(om.organization_id, 'user.manage_roles'::text)))));
create policy member_roles_read_by_user_permission on public.member_roles as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.id = member_roles.organization_member_id) AND internal.has_permission(om.organization_id, 'user.read'::text)))));
create policy member_roles_read_self on public.member_roles as permissive for select to authenticated using ((organization_member_id IN ( SELECT om.id
   FROM organization_members om
  WHERE (om.user_profile_id = internal.current_user_profile_id()))));
create policy member_roles_update_authorized on public.member_roles as permissive for update to authenticated using ((EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.id = member_roles.organization_member_id) AND internal.has_permission(om.organization_id, 'user.manage_roles'::text))))) with check ((EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.id = member_roles.organization_member_id) AND internal.has_permission(om.organization_id, 'user.manage_roles'::text)))));
create policy member_scopes_read_self on public.member_scopes as permissive for select to authenticated using ((organization_member_id IN ( SELECT om.id
   FROM organization_members om
  WHERE (om.user_profile_id = internal.current_user_profile_id()))));
create policy organization_members_insert_authorized on public.organization_members as permissive for insert to authenticated with check (internal.has_permission(organization_id, 'user.create'::text));
create policy organization_members_read_by_user_permission on public.organization_members as permissive for select to authenticated using (internal.has_permission(organization_id, 'user.read'::text));
create policy organization_members_read_self on public.organization_members as permissive for select to authenticated using ((user_profile_id = internal.current_user_profile_id()));
create policy organization_members_update_authorized on public.organization_members as permissive for update to authenticated using (internal.has_permission(organization_id, 'user.update'::text)) with check (internal.has_permission(organization_id, 'user.update'::text));
create policy organizations_read_authorized on public.organizations as permissive for select to authenticated using (((deleted_at IS NULL) AND internal.is_active_member(id) AND internal.has_permission(id, 'organization.read'::text)));
create policy permissions_read_authenticated_member on public.permissions as permissive for select to authenticated using (internal.has_any_active_membership());
create policy person_addresses_insert_authenticated on public.person_addresses as permissive for insert to authenticated with check (((organization_id = (((current_user_context() -> 'organization'::text) ->> 'id'::text))::uuid) AND ((current_user_context() -> 'permissions'::text) ? 'person.create'::text)));
create policy person_addresses_select_authenticated on public.person_addresses as permissive for select to authenticated using (((deleted_at IS NULL) AND (organization_id = (((current_user_context() -> 'organization'::text) ->> 'id'::text))::uuid) AND ((current_user_context() -> 'permissions'::text) ? 'person.read'::text)));
create policy person_addresses_update_authenticated on public.person_addresses as permissive for update to authenticated using (((deleted_at IS NULL) AND (organization_id = (((current_user_context() -> 'organization'::text) ->> 'id'::text))::uuid) AND ((current_user_context() -> 'permissions'::text) ? 'person.update'::text))) with check (((organization_id = (((current_user_context() -> 'organization'::text) ->> 'id'::text))::uuid) AND ((current_user_context() -> 'permissions'::text) ? 'person.update'::text)));
create policy person_relationships_insert_authenticated on public.person_relationships as permissive for insert to authenticated with check (((organization_id = (((current_user_context() -> 'organization'::text) ->> 'id'::text))::uuid) AND ((current_user_context() -> 'permissions'::text) ? 'person.create'::text)));
create policy person_relationships_select_authenticated on public.person_relationships as permissive for select to authenticated using (((deleted_at IS NULL) AND (organization_id = (((current_user_context() -> 'organization'::text) ->> 'id'::text))::uuid) AND ((current_user_context() -> 'permissions'::text) ? 'person.read'::text)));
create policy person_relationships_update_authenticated on public.person_relationships as permissive for update to authenticated using (((deleted_at IS NULL) AND (organization_id = (((current_user_context() -> 'organization'::text) ->> 'id'::text))::uuid) AND ((current_user_context() -> 'permissions'::text) ? 'person.update'::text))) with check (((organization_id = (((current_user_context() -> 'organization'::text) ->> 'id'::text))::uuid) AND ((current_user_context() -> 'permissions'::text) ? 'person.update'::text)));
create policy persons_insert_authenticated on public.persons as permissive for insert to authenticated with check (((organization_id = (((current_user_context() -> 'organization'::text) ->> 'id'::text))::uuid) AND ((current_user_context() -> 'permissions'::text) ? 'person.create'::text)));
create policy persons_read_as_organization_member on public.persons as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.person_id = persons.id) AND (om.organization_id = persons.organization_id) AND internal.has_permission(om.organization_id, 'user.read'::text)))));
create policy persons_select_authenticated on public.persons as permissive for select to authenticated using (((deleted_at IS NULL) AND (organization_id = (((current_user_context() -> 'organization'::text) ->> 'id'::text))::uuid) AND ((current_user_context() -> 'permissions'::text) ? 'person.read'::text)));
create policy persons_update_authenticated on public.persons as permissive for update to authenticated using (((deleted_at IS NULL) AND (organization_id = (((current_user_context() -> 'organization'::text) ->> 'id'::text))::uuid) AND ((current_user_context() -> 'permissions'::text) ? 'person.update'::text))) with check (((organization_id = (((current_user_context() -> 'organization'::text) ->> 'id'::text))::uuid) AND ((current_user_context() -> 'permissions'::text) ? 'person.update'::text)));
create policy project_units_delete_authorized on public.project_units as permissive for delete to authenticated using ((internal.has_permission(organization_id, 'project.update'::text) AND internal.has_project_scope(organization_id, project_id)));
create policy project_units_insert_authorized on public.project_units as permissive for insert to authenticated with check ((internal.has_permission(organization_id, 'project.update'::text) AND internal.has_project_scope(organization_id, project_id) AND internal.has_permission(organization_id, 'unit.read'::text) AND internal.has_unit_scope(organization_id, unit_id)));
create policy project_units_read_authorized on public.project_units as permissive for select to authenticated using ((internal.has_permission(organization_id, 'project.read'::text) AND internal.has_project_scope(organization_id, project_id)));
create policy project_units_update_authorized on public.project_units as permissive for update to authenticated using ((internal.has_permission(organization_id, 'project.update'::text) AND internal.has_project_scope(organization_id, project_id) AND internal.has_unit_scope(organization_id, unit_id))) with check ((internal.has_permission(organization_id, 'project.update'::text) AND internal.has_project_scope(organization_id, project_id) AND internal.has_unit_scope(organization_id, unit_id)));
create policy projects_insert_authorized on public.projects as permissive for insert to authenticated with check (internal.has_permission(organization_id, 'project.create'::text));
create policy projects_read_authorized on public.projects as permissive for select to authenticated using (((deleted_at IS NULL) AND internal.has_permission(organization_id, 'project.read'::text) AND internal.has_project_scope(organization_id, id)));
create policy projects_update_authorized on public.projects as permissive for update to authenticated using (((deleted_at IS NULL) AND internal.has_permission(organization_id, 'project.update'::text) AND internal.has_project_scope(organization_id, id))) with check ((internal.has_permission(organization_id, 'project.update'::text) AND internal.has_project_scope(organization_id, id)));
create policy role_permissions_read_authenticated_member on public.role_permissions as permissive for select to authenticated using (internal.has_any_active_membership());
create policy roles_read_authenticated_member on public.roles as permissive for select to authenticated using (((deleted_at IS NULL) AND internal.has_any_active_membership()));
create policy roles_read_for_member_administration on public.roles as permissive for select to authenticated using ((((organization_id IS NOT NULL) AND internal.has_permission(organization_id, 'user.read'::text)) OR (EXISTS ( SELECT 1
   FROM (member_roles mr
     JOIN organization_members om ON ((om.id = mr.organization_member_id)))
  WHERE ((mr.role_id = roles.id) AND internal.has_permission(om.organization_id, 'user.read'::text))))));
create policy units_insert_authorized on public.units as permissive for insert to authenticated with check (internal.has_permission(organization_id, 'unit.create'::text));
create policy units_read_authorized on public.units as permissive for select to authenticated using (((deleted_at IS NULL) AND internal.has_permission(organization_id, 'unit.read'::text) AND internal.has_unit_scope(organization_id, id)));
create policy units_update_authorized on public.units as permissive for update to authenticated using (((deleted_at IS NULL) AND internal.has_permission(organization_id, 'unit.update'::text) AND internal.has_unit_scope(organization_id, id))) with check ((internal.has_permission(organization_id, 'unit.update'::text) AND internal.has_unit_scope(organization_id, id)));
create policy user_profiles_read_as_organization_member on public.user_profiles as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.user_profile_id = user_profiles.id) AND internal.has_permission(om.organization_id, 'user.read'::text)))));
create policy user_profiles_read_self on public.user_profiles as permissive for select to authenticated using ((auth_user_id = ( SELECT auth.uid() AS uid)));
commit;
