-- Correct cross-table trigger branching so each trigger only reads fields
-- that exist on the table that fired it. Applied to development and production
-- after operational browser tests reproduced the failures.
create or replace function internal.validate_project_clinical_references()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_table_name = 'project_team_members' then
    if not exists (
      select 1 from public.projects
      where id = new.project_id
        and organization_id = new.organization_id
        and deleted_at is null
    ) or not exists (
      select 1 from public.persons
      where id = new.person_id
        and organization_id = new.organization_id
        and deleted_at is null
    ) then
      raise exception 'INVALID_ORGANIZATION_REFERENCE' using errcode = '23514';
    end if;
  elsif tg_table_name = 'clinical_supervision_cases' then
    if not exists (
      select 1 from public.projects
      where id = new.project_id
        and organization_id = new.organization_id
        and deleted_at is null
        and has_clinical_care
    ) or not exists (
      select 1 from public.persons
      where id = new.beneficiary_person_id
        and organization_id = new.organization_id
        and deleted_at is null
    ) or (
      new.assigned_technical_person_id is not null
      and not exists (
        select 1 from public.persons
        where id = new.assigned_technical_person_id
          and organization_id = new.organization_id
          and deleted_at is null
      )
    ) then
      raise exception 'INVALID_CLINICAL_REFERENCE' using errcode = '23514';
    end if;
  elsif tg_table_name = 'clinical_supervision_sessions' then
    if not exists (
      select 1 from public.clinical_supervision_cases
      where id = new.case_id
        and organization_id = new.organization_id
        and deleted_at is null
    ) or not exists (
      select 1 from public.persons
      where id = new.supervisor_person_id
        and organization_id = new.organization_id
        and deleted_at is null
    ) then
      raise exception 'INVALID_CLINICAL_SESSION_REFERENCE' using errcode = '23514';
    end if;
  end if;
  return new;
end
$$;

create or replace function internal.validate_neurodivergent_references()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if not exists(
    select 1
    from public.persons p
    where p.id = new.person_id
      and p.organization_id = new.organization_id
      and p.deleted_at is null
  ) then
    raise exception 'INVALID_PERSON_REFERENCE' using errcode = '23514';
  end if;

  if tg_table_name = 'neurodivergent_intakes' then
    if new.respondent_person_id is not null and not exists(
      select 1
      from public.persons p
      where p.id = new.respondent_person_id
        and p.organization_id = new.organization_id
        and p.deleted_at is null
    ) then
      raise exception 'INVALID_RESPONDENT_REFERENCE' using errcode = '23514';
    end if;
  elsif tg_table_name = 'neurodivergent_profiles' then
    if not exists(
      select 1
      from public.neurodivergent_intakes i
      where i.id = new.intake_id
        and i.person_id = new.person_id
        and i.organization_id = new.organization_id
        and i.deleted_at is null
    ) then
      raise exception 'INVALID_INTAKE_REFERENCE' using errcode = '23514';
    end if;
  elsif tg_table_name = 'data_consents' then
    if not exists(
      select 1
      from public.persons p
      where p.id = new.consented_by_person_id
        and p.organization_id = new.organization_id
        and p.deleted_at is null
    ) or (
      new.intake_id is not null and not exists(
        select 1
        from public.neurodivergent_intakes i
        where i.id = new.intake_id
          and i.person_id = new.person_id
          and i.organization_id = new.organization_id
      )
    ) then
      raise exception 'INVALID_CONSENT_REFERENCE' using errcode = '23514';
    end if;
  elsif tg_table_name = 'care_requests' then
    if (
      new.intake_id is not null and not exists(
        select 1
        from public.neurodivergent_intakes i
        where i.id = new.intake_id
          and i.person_id = new.person_id
          and i.organization_id = new.organization_id
      )
    ) or (
      new.project_id is not null and not exists(
        select 1
        from public.projects p
        where p.id = new.project_id
          and p.organization_id = new.organization_id
          and p.deleted_at is null
      )
    ) or (
      new.assigned_person_id is not null and not exists(
        select 1
        from public.persons p
        where p.id = new.assigned_person_id
          and p.organization_id = new.organization_id
          and p.deleted_at is null
      )
    ) then
      raise exception 'INVALID_CARE_REFERENCE' using errcode = '23514';
    end if;
  end if;

  return new;
end
$function$;
