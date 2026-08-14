create policy retention_reviews_schedule on public.data_retention_reviews
for insert to authenticated
with check (internal.has_permission(organization_id,'neurodivergent_profile.manage'));

create or replace function internal.audit_sensitive_change()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,audit as $$
declare v_org uuid; v_id uuid; v_action text;
begin
  v_org := coalesce(new.organization_id,old.organization_id);
  v_id := coalesce(new.id,old.id);
  v_action := tg_op || '_' || upper(tg_table_name);
  insert into audit.audit_events(organization_id,actor_auth_user_id,action,resource_type,resource_id,severity,metadata)
  values(v_org,auth.uid(),v_action,tg_table_name,v_id,'INFO',jsonb_build_object('operation',tg_op,'schema',tg_table_schema));
  return coalesce(new,old);
end $$;
revoke all on function internal.audit_sensitive_change() from public,anon,authenticated;

create trigger neuro_intakes_audit after insert or update on public.neurodivergent_intakes for each row execute function internal.audit_sensitive_change();
create trigger neuro_profiles_audit after insert or update on public.neurodivergent_profiles for each row execute function internal.audit_sensitive_change();
create trigger data_consents_audit after insert or update on public.data_consents for each row execute function internal.audit_sensitive_change();
create trigger care_requests_audit after insert or update on public.care_requests for each row execute function internal.audit_sensitive_change();
create trigger privacy_requests_audit after insert or update on public.privacy_requests for each row execute function internal.audit_sensitive_change();
create trigger retention_reviews_audit after insert or update on public.data_retention_reviews for each row execute function internal.audit_sensitive_change();

create or replace function internal.schedule_data_retention_review()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  insert into public.data_retention_reviews(organization_id,person_id,last_confirmation_at,review_due_at,created_by,updated_by)
  values(new.organization_id,new.person_id,new.signed_at,(new.signed_at at time zone 'UTC')::date + 730,auth.uid(),auth.uid())
  on conflict (person_id) where decided_at is null do update set last_confirmation_at=excluded.last_confirmation_at,review_due_at=excluded.review_due_at,updated_at=now(),updated_by=auth.uid()
  ;
  return new;
end $$;
revoke all on function internal.schedule_data_retention_review() from public,anon,authenticated;
create trigger data_consents_schedule_retention after insert or update of signed_at on public.data_consents for each row when (new.revoked_at is null) execute function internal.schedule_data_retention_review();
