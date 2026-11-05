-- HDB AI klantassistent — log + rate-limit tabellen (service_role-only)
create table if not exists public.hdb_ai_messages (
  id bigserial primary key,
  session_id text not null,
  role text not null check (role in ('user','assistant')),
  content text not null,
  lang text,
  tools text[],
  verified_order text,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists hdb_ai_messages_session_idx on public.hdb_ai_messages (session_id, created_at);
create index if not exists hdb_ai_messages_created_idx on public.hdb_ai_messages (created_at);

create table if not exists public.hdb_ai_events (
  id bigserial primary key,
  ip_hash text not null,
  kind text not null check (kind in ('msg','verify_fail','error')),
  created_at timestamptz not null default now()
);
create index if not exists hdb_ai_events_ip_idx on public.hdb_ai_events (ip_hash, kind, created_at);

alter table public.hdb_ai_messages enable row level security;
alter table public.hdb_ai_events enable row level security;
revoke all on public.hdb_ai_messages from anon, authenticated;
revoke all on public.hdb_ai_events from anon, authenticated;
revoke all on sequence public.hdb_ai_messages_id_seq from anon, authenticated;
revoke all on sequence public.hdb_ai_events_id_seq from anon, authenticated;

comment on table public.hdb_ai_messages is 'HDB AI klantassistent (edge function hdb-ai): gesprekslog. Bevat klant-PII -> 30 dagen bewaard (cron hdb-ai-retentie).';
comment on table public.hdb_ai_events is 'HDB AI klantassistent: rate-limit/verificatie-events per gehashte IP. 2 dagen bewaard.';

select cron.schedule('hdb-ai-retentie', '17 3 * * *', $$
  delete from public.hdb_ai_messages where created_at < now() - interval '30 days';
  delete from public.hdb_ai_events where created_at < now() - interval '2 days';
$$);
