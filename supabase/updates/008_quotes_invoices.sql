-- ============================================================================
-- Update 8 — run once in Supabase → SQL Editor (safe to run again).
--  • Quotes, change orders and invoices for each project.
--  • Line items are saved inside each document (line_items), so a document
--    always re-prints exactly as it was saved.
--  • Once a document leaves Draft, its contents and price are locked by the
--    database. Only its status can move forward (sent → approved, issued →
--    void, …). To change a sent quote, make a new one.
--  • financial_events keeps the history: created, sent, approved, declined,
--    issued, voided — who and when.
--  • Access: only the owner/admin can see or change these. A project's
--    customer can see that project's documents once they're sent/issued
--    (never drafts), and can approve or decline a sent quote or change order
--    through respond_to_financial_document(). Workers can't see them.
-- ============================================================================

-- ── Quotes ──────────────────────────────────────────────────────────────────
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  customer_id uuid references public.people(id) on delete set null,
  number text not null,
  title text,
  status text not null default 'draft' check (status in ('draft','sent','approved','declined','expired')),
  line_items jsonb not null default '[]'::jsonb,
  tax_rate numeric(6,3) not null default 0 check (tax_rate >= 0 and tax_rate < 100),
  subtotal numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  exclusions text,
  terms text,
  issue_date date not null default current_date,
  valid_until date,
  -- Company, customer and property details frozen when the quote is sent.
  snapshot jsonb,
  sent_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.people(id) on delete set null,
  declined_at timestamptz,
  declined_by uuid references public.people(id) on delete set null,
  decline_reason text,
  created_by uuid references public.people(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, number)
);
create index if not exists idx_quotes_project on public.quotes(project_id, created_at);

-- ── Change orders ───────────────────────────────────────────────────────────
create table if not exists public.change_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete restrict,
  customer_id uuid references public.people(id) on delete set null,
  number text not null,
  title text,
  description text,
  status text not null default 'draft' check (status in ('draft','sent','approved','declined')),
  line_items jsonb not null default '[]'::jsonb,
  tax_rate numeric(6,3) not null default 0 check (tax_rate >= 0 and tax_rate < 100),
  subtotal numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  terms text,
  issue_date date not null default current_date,
  snapshot jsonb,
  sent_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.people(id) on delete set null,
  declined_at timestamptz,
  declined_by uuid references public.people(id) on delete set null,
  decline_reason text,
  created_by uuid references public.people(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, number)
);
create index if not exists idx_change_orders_project on public.change_orders(project_id, created_at);

-- ── Invoices ────────────────────────────────────────────────────────────────
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete restrict,
  change_order_ids uuid[] not null default '{}',
  customer_id uuid references public.people(id) on delete set null,
  number text not null,
  title text,
  status text not null default 'draft' check (status in ('draft','issued','void')),
  line_items jsonb not null default '[]'::jsonb,
  tax_rate numeric(6,3) not null default 0 check (tax_rate >= 0 and tax_rate < 100),
  subtotal numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  payment_instructions text,
  invoice_date date not null default current_date,
  due_date date,
  snapshot jsonb,
  issued_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  created_by uuid references public.people(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, number)
);
create index if not exists idx_invoices_project on public.invoices(project_id, created_at);

-- ── History ─────────────────────────────────────────────────────────────────
create table if not exists public.financial_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  document_type text not null check (document_type in ('quote','change_order','invoice')),
  document_id uuid not null,
  event_type text not null check (event_type in ('created','sent','approved','declined','expired','issued','voided')),
  actor_id uuid references public.people(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_financial_events_doc on public.financial_events(document_id, created_at);

-- company_id comes from the project, like the other project tables
do $$
declare t text;
begin
  foreach t in array array['quotes','change_orders','invoices','financial_events'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_company', t);
    execute format('create trigger %I before insert or update of project_id on public.%I for each row execute function public.set_company_from_project()', t || '_company', t);
  end loop;
  foreach t in array array['quotes','change_orders','invoices'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

-- ── Lock documents once they leave Draft ───────────────────────────────────
-- After a document is sent/issued only these columns may change, and the
-- status may only move forward.
create or replace function public.lock_financial_document()
returns trigger language plpgsql as $$
declare
  status_cols text[] := array['status','sent_at','approved_at','approved_by','declined_at','declined_by',
                              'decline_reason','issued_at','voided_at','void_reason','updated_at'];
  allowed text[];
begin
  if old.status = 'draft' then
    if TG_TABLE_NAME = 'invoices' then allowed := array['draft','issued'];
    else allowed := array['draft','sent'];
    end if;
  elsif TG_TABLE_NAME = 'invoices' then
    allowed := case old.status when 'issued' then array['issued','void'] else array[old.status] end;
  else
    allowed := case old.status
      when 'sent' then array['sent','approved','declined','expired']
      else array[old.status] end;
  end if;

  if not (new.status = any(allowed)) then
    raise exception 'This % is % and can''t be changed to %.', replace(rtrim(TG_TABLE_NAME, 's'), '_', ' '), old.status, new.status;
  end if;

  if old.status <> 'draft'
     and (to_jsonb(new) - status_cols) is distinct from (to_jsonb(old) - status_cols) then
    raise exception 'This document was already sent, so its contents can''t be changed. Make a new one instead.';
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['quotes','change_orders','invoices'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_lock', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.lock_financial_document()', t || '_lock', t);
  end loop;
end $$;

-- ── Access rules ────────────────────────────────────────────────────────────
alter table public.quotes enable row level security;
alter table public.change_orders enable row level security;
alter table public.invoices enable row level security;
alter table public.financial_events enable row level security;

do $$
declare t text;
begin
  foreach t in array array['quotes','change_orders'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select using (
      public.is_staff(company_id) or (status <> ''draft'' and public.is_project_customer(project_id)))', t || '_select', t);
  end loop;
  foreach t in array array['quotes','change_orders','invoices'] loop
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('create policy %I on public.%I for insert with check (
      public.is_staff((select company_id from public.projects where id = project_id)))', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('create policy %I on public.%I for update using (public.is_staff(company_id)) with check (public.is_staff(company_id))', t || '_update', t);
    -- Only drafts can be deleted; sent documents stay on record.
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for delete using (public.is_staff(company_id) and status = ''draft'')', t || '_delete', t);
  end loop;
end $$;

drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices for select using (
  public.is_staff(company_id) or (status = 'issued' and public.is_project_customer(project_id))
);

drop policy if exists financial_events_select on public.financial_events;
create policy financial_events_select on public.financial_events for select using (
  public.is_staff(company_id)
  or (public.is_project_customer(project_id) and event_type <> 'created')
);
drop policy if exists financial_events_insert on public.financial_events;
create policy financial_events_insert on public.financial_events for insert with check (
  public.is_staff((select company_id from public.projects where id = project_id))
);

-- ── Customer approves or declines a sent quote / change order ──────────────
create or replace function public.respond_to_financial_document(
  p_type text, p_id uuid, p_approve boolean, p_note text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.my_person_id();
  doc record;
  label text;
  staff record;
begin
  if p_type = 'quote' then
    select id, company_id, project_id, status, number, valid_until into doc from public.quotes where id = p_id;
    label := 'Quote';
  elsif p_type = 'change_order' then
    select id, company_id, project_id, status, number, null::date as valid_until into doc from public.change_orders where id = p_id;
    label := 'Change order';
  else
    return jsonb_build_object('success', false, 'error', 'invalid_type');
  end if;

  if doc.id is null or me is null or not public.is_project_customer(doc.project_id) then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;
  if doc.status <> 'sent' then
    return jsonb_build_object('success', false, 'error', 'not_open', 'status', doc.status);
  end if;
  if p_approve and doc.valid_until is not null and doc.valid_until < current_date then
    return jsonb_build_object('success', false, 'error', 'expired');
  end if;

  if p_type = 'quote' then
    if p_approve then
      update public.quotes set status = 'approved', approved_at = now(), approved_by = me where id = p_id;
    else
      update public.quotes set status = 'declined', declined_at = now(), declined_by = me, decline_reason = nullif(trim(p_note), '') where id = p_id;
    end if;
  else
    if p_approve then
      update public.change_orders set status = 'approved', approved_at = now(), approved_by = me where id = p_id;
    else
      update public.change_orders set status = 'declined', declined_at = now(), declined_by = me, decline_reason = nullif(trim(p_note), '') where id = p_id;
    end if;
  end if;

  insert into public.financial_events (company_id, project_id, document_type, document_id, event_type, actor_id, note)
  values (doc.company_id, doc.project_id, p_type, p_id,
          case when p_approve then 'approved' else 'declined' end, me, nullif(trim(p_note), ''));

  -- In-app alert for the owner/admins
  for staff in
    select person_id from public.company_members
    where company_id = doc.company_id and role in ('owner','admin') and status = 'active'
  loop
    insert into public.app_notifications (company_id, recipient_id, event_type, title, body, linked_entity_type, linked_entity_id)
    values (doc.company_id, staff.person_id,
            case when p_approve then 'quote_approved' else 'quote_declined' end,
            label || ' ' || doc.number || case when p_approve then ' approved' else ' declined' end,
            coalesce((select name from public.projects where id = doc.project_id), ''),
            p_type, p_id::text);
  end loop;

  return jsonb_build_object('success', true);
end;
$$;

revoke execute on function public.respond_to_financial_document(text, uuid, boolean, text) from public, anon;
grant execute on function public.respond_to_financial_document(text, uuid, boolean, text) to authenticated;

-- ── Live updates ────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['quotes','change_orders','invoices','financial_events'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
