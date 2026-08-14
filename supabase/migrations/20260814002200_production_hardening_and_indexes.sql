-- Production hardening: covering indexes, policy consolidation and RLS init-plan.

create index if not exists audit_events_person_idx on audit.audit_events(actor_person_id);
create index if not exists organization_members_user_profile_idx on public.organization_members(user_profile_id);
create index if not exists person_addresses_organization_idx on public.person_addresses(organization_id);
create index if not exists person_relationships_organization_idx on public.person_relationships(organization_id);
create index if not exists project_units_organization_idx on public.project_units(organization_id);
create index if not exists payment_events_donation_idx on public.payment_events(donation_id);
create index if not exists project_team_person_idx on public.project_team_members(person_id);
create index if not exists clinical_cases_beneficiary_idx on public.clinical_supervision_cases(beneficiary_person_id);
create index if not exists clinical_cases_assigned_technical_idx on public.clinical_supervision_cases(assigned_technical_person_id) where assigned_technical_person_id is not null;
create index if not exists clinical_sessions_organization_idx on public.clinical_supervision_sessions(organization_id);
create index if not exists clinical_sessions_supervisor_idx on public.clinical_supervision_sessions(supervisor_person_id);
create index if not exists neuro_intakes_respondent_idx on public.neurodivergent_intakes(respondent_person_id) where respondent_person_id is not null;
create index if not exists neuro_profiles_person_idx on public.neurodivergent_profiles(person_id);
create index if not exists data_consents_intake_idx on public.data_consents(intake_id) where intake_id is not null;
create index if not exists data_consents_consenter_idx on public.data_consents(consented_by_person_id);
create index if not exists care_requests_intake_idx on public.care_requests(intake_id) where intake_id is not null;
create index if not exists care_requests_assigned_person_idx on public.care_requests(assigned_person_id) where assigned_person_id is not null;
create index if not exists privacy_requests_person_idx on public.privacy_requests(person_id);

drop index if exists public.member_roles_one_open_assignment;

drop policy if exists retention_reviews_schedule on public.data_retention_reviews;
drop policy if exists retention_reviews_write on public.data_retention_reviews;
create policy retention_reviews_insert on public.data_retention_reviews
for insert to authenticated
with check (
  internal.has_permission(organization_id,'privacy.manage')
  or internal.has_permission(organization_id,'neurodivergent_profile.manage')
);

drop policy if exists user_profiles_read_self on public.user_profiles;
create policy user_profiles_read_self on public.user_profiles
for select to authenticated
using ((select auth.uid()) = auth_user_id);

drop policy if exists persons_read_as_organization_member on public.persons;
drop policy if exists roles_read_for_member_administration on public.roles;

drop policy if exists member_roles_read_by_user_permission on public.member_roles;
drop policy if exists member_roles_read_authorized on public.member_roles;
create policy member_roles_read_authorized on public.member_roles
for select to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.id = member_roles.organization_member_id
      and om.status = 'ACTIVE'
      and (
        om.user_profile_id = internal.current_user_profile_id()
        or internal.has_permission(om.organization_id,'user.read')
      )
  )
);

drop policy if exists organization_members_read_by_user_permission on public.organization_members;
drop policy if exists organization_members_read_authorized on public.organization_members;
create policy organization_members_read_authorized on public.organization_members
for select to authenticated
using (
  status = 'ACTIVE'
  and (
    user_profile_id = internal.current_user_profile_id()
    or internal.has_permission(organization_id,'user.read')
  )
);

drop policy if exists user_profiles_read_as_organization_member on public.user_profiles;
drop policy if exists user_profiles_read_authorized on public.user_profiles;
create policy user_profiles_read_authorized on public.user_profiles
for select to authenticated
using (
  exists (
    select 1
    from public.organization_members target_member
    join public.organization_members current_member
      on current_member.organization_id = target_member.organization_id
     and current_member.status = 'ACTIVE'
    where target_member.user_profile_id = user_profiles.id
      and target_member.status = 'ACTIVE'
      and current_member.user_profile_id = internal.current_user_profile_id()
      and internal.has_permission(target_member.organization_id,'user.read')
  )
);
