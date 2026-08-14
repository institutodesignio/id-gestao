begin;
grant update(legal_name,trade_name,cnpj,email,phone,website,status,updated_at,updated_by) on public.organizations to authenticated;
drop policy if exists organizations_update_authorized on public.organizations;
create policy organizations_update_authorized on public.organizations for update to authenticated
using (deleted_at is null and internal.has_permission(id,'organization.update'))
with check (internal.has_permission(id,'organization.update'));
commit;
