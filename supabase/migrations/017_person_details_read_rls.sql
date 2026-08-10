begin;

-- ============================================================
-- PERSON_ADDRESSES
-- ============================================================

alter table public.person_addresses
enable row level security;

drop policy if exists person_addresses_select_authenticated
on public.person_addresses;

create policy person_addresses_select_authenticated
on public.person_addresses
for select
to authenticated
using (
  deleted_at is null

  and organization_id = (
    (
      public.current_user_context()
      -> 'organization'
      ->> 'id'
    )::uuid
  )

  and (
    public.current_user_context()
    -> 'permissions'
  ) ? 'person.read'
);


-- ============================================================
-- PERSON_RELATIONSHIPS
-- ============================================================

alter table public.person_relationships
enable row level security;

drop policy if exists person_relationships_select_authenticated
on public.person_relationships;

create policy person_relationships_select_authenticated
on public.person_relationships
for select
to authenticated
using (
  deleted_at is null

  and organization_id = (
    (
      public.current_user_context()
      -> 'organization'
      ->> 'id'
    )::uuid
  )

  and (
    public.current_user_context()
    -> 'permissions'
  ) ? 'person.read'
);

commit;