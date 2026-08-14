insert into public.permissions(code,resource,action,description,is_system)
values('audit.read','audit','read','Consultar trilha institucional de auditoria.',true)
on conflict (code) do update set description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.organization_id is null and r.code in ('ADMINISTRATOR','MANAGER') and p.code='audit.read'
on conflict do nothing;

grant select on audit.audit_events to authenticated;
create policy audit_events_read_authorized on audit.audit_events
for select to authenticated
using (
  organization_id is not null
  and internal.has_permission(organization_id,'audit.read')
);

create or replace function public.audit_events_page(p_page integer default 1,p_limit integer default 50,p_resource_type text default null)
returns table(id uuid,action text,resource_type text,resource_id uuid,severity audit.audit_event_severity,reason text,metadata jsonb,occurred_at timestamptz,total_count bigint)
language sql stable security invoker set search_path=pg_catalog,public,audit as $$
  select ae.id,ae.action,ae.resource_type,ae.resource_id,ae.severity,ae.reason,ae.metadata,ae.occurred_at,count(*) over()
  from audit.audit_events ae
  where (p_resource_type is null or ae.resource_type=p_resource_type)
  order by ae.occurred_at desc
  offset ((greatest(p_page,1)-1)*least(greatest(p_limit,1),100))
  limit least(greatest(p_limit,1),100);
$$;
revoke all on function public.audit_events_page(integer,integer,text) from public,anon;
grant execute on function public.audit_events_page(integer,integer,text) to authenticated;
