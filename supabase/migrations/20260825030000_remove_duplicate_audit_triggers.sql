-- Remove legacy audit triggers that duplicated INSERT/UPDATE events.
-- The audit_*_changes triggers remain active and cover INSERT, UPDATE, and DELETE.

drop trigger if exists care_requests_audit on public.care_requests;
drop trigger if exists privacy_requests_audit on public.privacy_requests;
drop trigger if exists retention_reviews_audit on public.data_retention_reviews;
drop trigger if exists neuro_intakes_audit on public.neurodivergent_intakes;
