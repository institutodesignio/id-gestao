-- Files are accessible only through short-lived URLs issued by the backend
-- after checking document.export and the parent document RLS policy. Keeping
-- direct authenticated Storage policies would let a client bypass those
-- application-level checks by calling the Storage API itself.
drop policy if exists id_gestao_documents_read on storage.objects;
drop policy if exists id_gestao_documents_insert on storage.objects;
drop policy if exists id_gestao_documents_update on storage.objects;
