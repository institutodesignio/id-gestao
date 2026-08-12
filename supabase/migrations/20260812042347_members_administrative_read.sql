begin;

-- ============================================================
-- MEMBERS — ADMINISTRATIVE READ
--
-- Leitura administrativa para usuários com user.read.
-- As policies anteriores de leitura própria são preservadas.
-- ============================================================

alter table public.organization_members
enable row level security;

alter table public.persons
enable row level security;

alter table public.user_profiles
enable row level security;

alter table public.member_roles
enable row level security;

alter table public.roles
enable row level security;

-- A Data API precisa do GRANT antes de avaliar o RLS.
grant select
on table
  public.organization_members,
  public.persons,
  public.user_profiles,
  public.member_roles,
  public.roles
to authenticated;

-- ============================================================
-- ORGANIZATION_MEMBERS
-- ============================================================

drop policy if exists
organization_members_read_by_user_permission
on public.organization_members;

create policy
organization_members_read_by_user_permission
on public.organization_members
for select
to authenticated
using (
  internal.has_permission(
    organization_id,
    'user.read'
  )
);

-- ============================================================
-- PERSONS
--
-- Expõe somente pessoas vinculadas como membros de uma
-- organização na qual o usuário possui user.read.
-- ============================================================

drop policy if exists
persons_read_as_organization_member
on public.persons;

create policy
persons_read_as_organization_member
on public.persons
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.person_id = persons.id
      and om.organization_id =
        persons.organization_id
      and internal.has_permission(
        om.organization_id,
        'user.read'
      )
  )
);

-- ============================================================
-- USER_PROFILES
-- ============================================================

drop policy if exists
user_profiles_read_as_organization_member
on public.user_profiles;

create policy
user_profiles_read_as_organization_member
on public.user_profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.user_profile_id =
      user_profiles.id
      and internal.has_permission(
        om.organization_id,
        'user.read'
      )
  )
);

-- ============================================================
-- MEMBER_ROLES
-- ============================================================

drop policy if exists
member_roles_read_by_user_permission
on public.member_roles;

create policy
member_roles_read_by_user_permission
on public.member_roles
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.id =
      member_roles.organization_member_id
      and internal.has_permission(
        om.organization_id,
        'user.read'
      )
  )
);

-- ============================================================
-- ROLES
--
-- Permite visualizar somente funções atribuídas a membros
-- visíveis ou funções pertencentes à organização autorizada.
-- ============================================================

drop policy if exists
roles_read_for_member_administration
on public.roles;

create policy
roles_read_for_member_administration
on public.roles
for select
to authenticated
using (
  (
    organization_id is not null
    and internal.has_permission(
      organization_id,
      'user.read'
    )
  )
  or exists (
    select 1
    from public.member_roles mr
    join public.organization_members om
      on om.id =
        mr.organization_member_id
    where mr.role_id = roles.id
      and internal.has_permission(
        om.organization_id,
        'user.read'
      )
  )
);

commit;