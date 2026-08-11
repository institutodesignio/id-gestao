begin;

-- ============================================================
-- UNITS — SOFT DELETE RPC PERMISSIONS
--
-- A operação de soft delete só pode ser chamada por usuários
-- autenticados.
-- ============================================================

revoke execute
on function public.soft_delete_unit(uuid)
from public;

revoke execute
on function public.soft_delete_unit(uuid)
from anon;

grant execute
on function public.soft_delete_unit(uuid)
to authenticated;

commit;