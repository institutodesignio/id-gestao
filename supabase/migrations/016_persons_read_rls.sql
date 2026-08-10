-- ============================================================
-- ID GESTÃO
-- Migration 016
-- RLS de leitura do módulo Pessoas
--
-- Objetivo:
--   Permitir SELECT em public.persons somente quando:
--   1. existir contexto institucional válido;
--   2. o usuário possuir person.read;
--   3. a pessoa pertencer à organização do usuário;
--   4. o registro não estiver removido logicamente.
-- ============================================================

begin;

-- ============================================================
-- 1. Garantir RLS ativo
-- ============================================================

alter table public.persons
enable row level security;


-- ============================================================
-- 2. Remover policy anterior, se existir
--    Torna a migration reaplicável durante desenvolvimento.
-- ============================================================

drop policy if exists persons_select_authenticated
on public.persons;


-- ============================================================
-- 3. Policy de leitura
-- ============================================================

create policy persons_select_authenticated
on public.persons
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