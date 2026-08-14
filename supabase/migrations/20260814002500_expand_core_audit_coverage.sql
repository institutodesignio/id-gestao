do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'units', 'persons', 'person_addresses', 'person_relationships',
    'projects', 'project_units', 'project_team_members',
    'clinical_supervision_cases', 'clinical_supervision_sessions',
    'organization_members', 'neurodivergent_intakes', 'care_requests',
    'privacy_requests', 'data_retention_reviews'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'audit_' || table_name || '_changes', table_name);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function internal.audit_sensitive_change()',
      'audit_' || table_name || '_changes', table_name
    );
  end loop;
end $$;
