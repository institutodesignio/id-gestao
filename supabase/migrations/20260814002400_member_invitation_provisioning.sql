insert into public.permissions(code,resource,action,description,is_system)
values('user.invite','user','invite','Convidar e provisionar novos membros institucionais.',true)
on conflict (code) do update set description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.organization_id is null and r.code='ADMINISTRATOR' and p.code='user.invite'
on conflict do nothing;

create or replace function public.provision_invited_member(
  p_organization_id uuid,p_auth_user_id uuid,p_email text,p_full_name text,
  p_person_id uuid,p_profile_id uuid,p_member_id uuid,p_role_id uuid,p_actor_id uuid
) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,audit as $$
declare v_role public.roles;
begin
  select * into v_role from public.roles where id=p_role_id and deleted_at is null and (organization_id is null or organization_id=p_organization_id);
  if not found then raise exception 'ROLE_NOT_FOUND' using errcode='P0002'; end if;
  insert into public.persons(id,organization_id,person_type,full_name,primary_email,status,created_by,updated_by)
  values(p_person_id,p_organization_id,'INDIVIDUAL',p_full_name,lower(p_email),'ACTIVE',p_actor_id,p_actor_id);
  insert into public.user_profiles(id,auth_user_id,person_id,email,status,created_by,updated_by)
  values(p_profile_id,p_auth_user_id,p_person_id,lower(p_email),'ACTIVE',p_actor_id,p_actor_id);
  insert into public.organization_members(id,organization_id,user_profile_id,person_id,status,joined_at,created_by,updated_by)
  values(p_member_id,p_organization_id,p_profile_id,p_person_id,'ACTIVE',current_date,p_actor_id,p_actor_id);
  insert into public.member_roles(organization_member_id,role_id,starts_at,created_by,updated_by)
  values(p_member_id,p_role_id,current_date,p_actor_id,p_actor_id);
  insert into audit.audit_events(organization_id,actor_auth_user_id,action,resource_type,resource_id,metadata)
  values(p_organization_id,p_actor_id,'MEMBER_INVITED','organization_member',p_member_id,jsonb_build_object('role_code',v_role.code));
  return jsonb_build_object('member_id',p_member_id,'person_id',p_person_id,'profile_id',p_profile_id);
end $$;
revoke all on function public.provision_invited_member(uuid,uuid,text,text,uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.provision_invited_member(uuid,uuid,text,text,uuid,uuid,uuid,uuid,uuid) to service_role;
