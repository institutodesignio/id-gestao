-- These legacy finance tables are intentionally outside the current ID Gestão
-- product scope. Explicit deny policies document that decision and prevent
-- authenticated clients from reading or mutating dormant data.

create policy donors_closed_to_authenticated
on public.donors
for all
to authenticated
using (false)
with check (false);

create policy donations_closed_to_authenticated
on public.donations
for all
to authenticated
using (false)
with check (false);

create policy payment_events_closed_to_authenticated
on public.payment_events
for all
to authenticated
using (false)
with check (false);
