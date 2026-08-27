alter table public.organization_members
  add column if not exists member_type text,
  add column if not exists job_title text,
  add column if not exists professional_council text,
  add column if not exists professional_registration text;

alter table public.organization_members
  drop constraint if exists organization_members_member_type_check,
  add constraint organization_members_member_type_check check (
    member_type is null or member_type in (
      'TECHNICAL_PROFESSIONAL',
      'ADMINISTRATIVE_PROFESSIONAL'
    )
  ),
  drop constraint if exists organization_members_job_title_length_check,
  add constraint organization_members_job_title_length_check check (
    job_title is null or char_length(job_title) between 2 and 120
  ),
  drop constraint if exists organization_members_professional_fields_check,
  add constraint organization_members_professional_fields_check check (
    member_type is distinct from 'TECHNICAL_PROFESSIONAL'
    or (
      professional_council is not null
      and btrim(professional_council) <> ''
      and professional_registration is not null
      and btrim(professional_registration) <> ''
    )
  );

create or replace function public.provision_invited_member(
  p_organization_id uuid,
  p_auth_user_id uuid,
  p_email text,
  p_full_name text,
  p_person_id uuid,
  p_profile_id uuid,
  p_member_id uuid,
  p_role_id uuid,
  p_actor_id uuid,
  p_member_type text,
  p_job_title text,
  p_professional_council text,
  p_professional_registration text
) returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,audit
as $$
declare
  v_role public.roles;
begin
  if p_member_type not in ('TECHNICAL_PROFESSIONAL', 'ADMINISTRATIVE_PROFESSIONAL') then
    raise exception 'INVALID_MEMBER_TYPE' using errcode='23514';
  end if;

  if p_member_type = 'TECHNICAL_PROFESSIONAL'
     and (nullif(btrim(p_professional_council), '') is null
       or nullif(btrim(p_professional_registration), '') is null) then
    raise exception 'PROFESSIONAL_REGISTRATION_REQUIRED' using errcode='23514';
  end if;

  select * into v_role
  from public.roles
  where id=p_role_id
    and deleted_at is null
    and (organization_id is null or organization_id=p_organization_id);
  if not found then
    raise exception 'ROLE_NOT_FOUND' using errcode='P0002';
  end if;

  insert into public.persons(
    id,organization_id,person_type,full_name,occupation,primary_email,status,created_by,updated_by
  ) values (
    p_person_id,p_organization_id,'INDIVIDUAL',p_full_name,p_job_title,lower(p_email),'ACTIVE',p_actor_id,p_actor_id
  );

  insert into public.user_profiles(
    id,auth_user_id,person_id,email,status,created_by,updated_by
  ) values (
    p_profile_id,p_auth_user_id,p_person_id,lower(p_email),'ACTIVE',p_actor_id,p_actor_id
  );

  insert into public.organization_members(
    id,organization_id,user_profile_id,person_id,status,joined_at,
    member_type,job_title,professional_council,professional_registration,
    created_by,updated_by
  ) values (
    p_member_id,p_organization_id,p_profile_id,p_person_id,'ACTIVE',current_date,
    p_member_type,p_job_title,
    case when p_member_type='TECHNICAL_PROFESSIONAL' then p_professional_council else null end,
    case when p_member_type='TECHNICAL_PROFESSIONAL' then p_professional_registration else null end,
    p_actor_id,p_actor_id
  );

  insert into public.member_roles(
    organization_member_id,role_id,starts_at,created_by,updated_by
  ) values (
    p_member_id,p_role_id,current_date,p_actor_id,p_actor_id
  );

  insert into audit.audit_events(
    organization_id,actor_auth_user_id,action,resource_type,resource_id,metadata
  ) values (
    p_organization_id,p_actor_id,'MEMBER_INVITED','organization_member',p_member_id,
    jsonb_build_object(
      'role_code',v_role.code,
      'member_type',p_member_type,
      'job_title',p_job_title,
      'professional_council',p_professional_council,
      'professional_registration',p_professional_registration
    )
  );

  return jsonb_build_object(
    'member_id',p_member_id,
    'person_id',p_person_id,
    'profile_id',p_profile_id
  );
end
$$;

revoke all on function public.provision_invited_member(
  uuid,uuid,text,text,uuid,uuid,uuid,uuid,uuid,text,text,text,text
) from public,anon,authenticated;
grant execute on function public.provision_invited_member(
  uuid,uuid,text,text,uuid,uuid,uuid,uuid,uuid,text,text,text,text
) to service_role;
