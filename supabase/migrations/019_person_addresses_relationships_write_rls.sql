begin;

-- ============================================================
-- ID GESTÃO
-- Migration 019
-- Escrita segura em endereços e relacionamentos de pessoas
-- ============================================================

-- ============================================================
-- PERSON_ADDRESSES
-- ============================================================

alter table public.person_addresses
enable row level security;

drop policy if exists person_addresses_insert_authenticated
on public.person_addresses;

create policy person_addresses_insert_authenticated
on public.person_addresses
for insert
to authenticated
with check (
  organization_id = (
    (
      public.current_user_context()
      -> 'organization'
      ->> 'id'
    )::uuid
  )
  and (
    public.current_user_context()
    -> 'permissions'
  ) ? 'person.create'
);

drop policy if exists person_addresses_update_authenticated
on public.person_addresses;

create policy person_addresses_update_authenticated
on public.person_addresses
for update
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
  ) ? 'person.update'
)
with check (
  organization_id = (
    (
      public.current_user_context()
      -> 'organization'
      ->> 'id'
    )::uuid
  )

  and (
    public.current_user_context()
    -> 'permissions'
  ) ? 'person.update'
);


-- ============================================================
-- PERSON_RELATIONSHIPS
-- ============================================================

alter table public.person_relationships
enable row level security;

drop policy if exists person_relationships_insert_authenticated
on public.person_relationships;

create policy person_relationships_insert_authenticated
on public.person_relationships
for insert
to authenticated
with check (
  organization_id = (
    (
      public.current_user_context()
      -> 'organization'
      ->> 'id'
    )::uuid
  )
  and (
    public.current_user_context()
    -> 'permissions'
  ) ? 'person.create'
);

drop policy if exists person_relationships_update_authenticated
on public.person_relationships;

create policy person_relationships_update_authenticated
on public.person_relationships
for update
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
  ) ? 'person.update'
)
with check (
  organization_id = (
    (
      public.current_user_context()
      -> 'organization'
      ->> 'id'
    )::uuid
  )

  and (
    public.current_user_context()
    -> 'permissions'
  ) ? 'person.update'
);

commit;