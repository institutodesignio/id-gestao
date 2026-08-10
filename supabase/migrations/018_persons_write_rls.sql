begin;

-- ============================================================
-- ID GESTÃO
-- Migration 018
-- Escrita segura no módulo Pessoas
-- ============================================================

alter table public.persons
enable row level security;


-- ============================================================
-- INSERT
--
-- Requisitos:
-- - usuário autenticado;
-- - person.create;
-- - organização obrigatoriamente igual à organização
--   do contexto institucional.
-- ============================================================

drop policy if exists persons_insert_authenticated
on public.persons;

create policy persons_insert_authenticated
on public.persons
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


-- ============================================================
-- UPDATE
--
-- USING decide quais registros podem ser alterados.
-- WITH CHECK garante que o registro não possa ser movido
-- para outra organização durante a alteração.
-- ============================================================

drop policy if exists persons_update_authenticated
on public.persons;

create policy persons_update_authenticated
on public.persons
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