begin;

-- ============================================================
-- PROJECT.DELETE
--
-- Cria a permissão formal de exclusão lógica de projetos.
-- Atribui aos mesmos papéis que já possuem unit.delete.
-- ============================================================

insert into public.permissions (
  code,
  resource,
  action,
  description,
  is_system
)
select
  'project.delete',
  'project',
  'delete',
  'Excluir logicamente projetos.',
  true
where not exists (
  select 1
  from public.permissions
  where code = 'project.delete'
);

-- ============================================================
-- ROLE PERMISSIONS
--
-- Replica para project.delete os mesmos papéis que já possuem
-- unit.delete.
-- ============================================================

insert into public.role_permissions (
  role_id,
  permission_id
)
select
  source_rp.role_id,
  target_permission.id
from public.role_permissions source_rp
join public.permissions source_permission
  on source_permission.id = source_rp.permission_id
join public.permissions target_permission
  on target_permission.code = 'project.delete'
where source_permission.code = 'unit.delete'
  and not exists (
    select 1
    from public.role_permissions existing_rp
    where existing_rp.role_id = source_rp.role_id
      and existing_rp.permission_id = target_permission.id
  );

commit;