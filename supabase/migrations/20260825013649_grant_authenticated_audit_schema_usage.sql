-- The audit reader remains protected by table RLS and audit.read.
-- SECURITY INVOKER also requires authenticated users to traverse the schema.
grant usage on schema audit to authenticated;
