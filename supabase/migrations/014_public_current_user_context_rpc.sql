begin;

create or replace function public.current_user_context()
returns jsonb
language sql
stable
security invoker
set search_path = public, internal, auth, pg_temp
as $$
  select internal.current_user_context();
$$;

revoke all on function public.current_user_context() from public;
revoke all on function public.current_user_context() from anon;
grant execute on function public.current_user_context() to authenticated;

comment on function public.current_user_context() is
'Controlled RPC wrapper that returns only the context of the authenticated ID Gestao user.';

commit;
