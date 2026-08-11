begin;

grant insert, update
on table public.units
to authenticated;

commit;