-- Dewi medewerkermodus (07-11): medewerkers met toegangscode, sessietokens, login-/checkfuncties.
-- Alleen aanroepbaar met de service-role (n8n). Codes (bcrypt) en tokens (sha256) alleen gehasht.
-- Zo toegepast op project jucubuoftjehwancegma op 2026-11-07.

create table if not exists public.hdb_ai_staff (
  id          bigint generated always as identity primary key,
  name        text not null unique check (name = lower(btrim(name)) and name <> ''),
  display_name text not null,
  code_hash   text not null,
  perms       text[] not null default array['labels'],
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create table if not exists public.hdb_ai_staff_sessions (
  token_hash  text primary key,
  staff_id    bigint not null references public.hdb_ai_staff(id) on delete cascade,
  ip_hash     text,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index if not exists hdb_ai_staff_sessions_exp on public.hdb_ai_staff_sessions(expires_at);
alter table public.hdb_ai_staff enable row level security;
alter table public.hdb_ai_staff_sessions enable row level security;

alter table public.hdb_ai_events drop constraint hdb_ai_events_kind_check,
  add constraint hdb_ai_events_kind_check check (kind = any (array['msg','verify_fail','error','staff_fail']));

-- Medewerker toevoegen of code wijzigen (oude sessies verlopen direct):
--   select public.hdb_ai_staff_set('<naam>', '<Weergavenaam>', '<code 4-8 cijfers>');
create or replace function public.hdb_ai_staff_set(p_name text, p_display text, p_code text, p_perms text[] default array['labels'])
returns jsonb language plpgsql set search_path to 'public', 'extensions' as $$
begin
  if p_code !~ '^\d{4,8}$' then raise exception 'code moet 4-8 cijfers zijn'; end if;
  insert into public.hdb_ai_staff(name, display_name, code_hash, perms)
  values (lower(btrim(p_name)), p_display, extensions.crypt(p_code, extensions.gen_salt('bf', 10)), p_perms)
  on conflict (name) do update set display_name = excluded.display_name, code_hash = excluded.code_hash,
    perms = excluded.perms, active = true, updated_at = now();
  update public.hdb_ai_staff_sessions s set expires_at = now() from public.hdb_ai_staff m
   where s.staff_id = m.id and m.name = lower(btrim(p_name)) and s.expires_at > now();
  return jsonb_build_object('ok', true, 'name', lower(btrim(p_name)));
end $$;

-- Login: max 5 foute pogingen per uur per IP en per naam. Token 10 uur geldig.
create or replace function public.hdb_ai_staff_login(p_name text, p_code text, p_ip_hash text)
returns jsonb language plpgsql set search_path to 'public', 'extensions' as $$
declare m public.hdb_ai_staff; nm text := lower(btrim(coalesce(p_name, ''))); tok text; n_ip int; n_nm int; ttl interval := interval '10 hours';
begin
  select count(*) into n_ip from public.hdb_ai_events where ip_hash = p_ip_hash and kind = 'staff_fail' and created_at >= now() - interval '1 hour';
  select count(*) into n_nm from public.hdb_ai_events where ip_hash = 'name:' || nm and kind = 'staff_fail' and created_at >= now() - interval '1 hour';
  if n_ip >= 5 or n_nm >= 5 then return jsonb_build_object('ok', false, 'reason', 'locked'); end if;
  select * into m from public.hdb_ai_staff where name = nm and active;
  if m.id is null or m.code_hash <> extensions.crypt(coalesce(p_code, ''), m.code_hash) then
    insert into public.hdb_ai_events(ip_hash, kind) values (p_ip_hash, 'staff_fail'), ('name:' || nm, 'staff_fail');
    return jsonb_build_object('ok', false, 'reason', 'invalid', 'left', greatest(0, 4 - greatest(n_ip, n_nm)));
  end if;
  tok := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.hdb_ai_staff_sessions(token_hash, staff_id, ip_hash, expires_at)
  values (encode(extensions.digest(tok, 'sha256'), 'hex'), m.id, p_ip_hash, now() + ttl);
  return jsonb_build_object('ok', true, 'name', m.name, 'display_name', m.display_name, 'perms', m.perms,
    'token', tok, 'expires_at', now() + ttl);
end $$;

create or replace function public.hdb_ai_staff_check(p_token text)
returns jsonb language sql stable set search_path to 'public', 'extensions' as $$
  select coalesce((
    select jsonb_build_object('ok', true, 'name', m.name, 'display_name', m.display_name, 'perms', m.perms, 'expires_at', s.expires_at)
    from public.hdb_ai_staff_sessions s join public.hdb_ai_staff m on m.id = s.staff_id
    where s.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex') and s.expires_at > now() and m.active
  ), jsonb_build_object('ok', false));
$$;

create or replace function public.hdb_ai_staff_logout(p_token text)
returns jsonb language sql set search_path to 'public', 'extensions' as $$
  with u as (update public.hdb_ai_staff_sessions set expires_at = now()
    where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex') and expires_at > now() returning 1)
  select jsonb_build_object('ok', true, 'ended', (select count(*) from u));
$$;

revoke execute on function public.hdb_ai_staff_set(text, text, text, text[]), public.hdb_ai_staff_login(text, text, text),
  public.hdb_ai_staff_check(text), public.hdb_ai_staff_logout(text) from public, anon, authenticated;

-- Medewerkers zelf zijn rechtstreeks in de database aangemaakt (codes horen niet in deze repo).

-- Vaste etiketnamen per SKU (overschrijft de automatische naam "TYPE + MODEL"), te zetten via Dewi
create table if not exists public.hdb_ai_label_names (
  sku text primary key,
  name text not null check (length(name) between 1 and 60),
  set_by text,
  updated_at timestamptz not null default now()
);
alter table public.hdb_ai_label_names enable row level security;

create or replace function public.hdb_ai_label_names_for(p_skus text[])
returns jsonb language sql stable set search_path to 'public' as $$
  select coalesce(jsonb_object_agg(sku, name), '{}'::jsonb) from public.hdb_ai_label_names where sku = any(p_skus);
$$;

create or replace function public.hdb_ai_label_name_set(p_sku text, p_name text, p_by text)
returns jsonb language plpgsql set search_path to 'public' as $$
declare s text := upper(btrim(coalesce(p_sku,''))); n text := upper(btrim(coalesce(p_name,'')));
begin
  if s = '' or n = '' then return jsonb_build_object('ok', false, 'error', 'sku of naam leeg'); end if;
  insert into public.hdb_ai_label_names(sku, name, set_by) values (s, left(n, 60), p_by)
  on conflict (sku) do update set name = excluded.name, set_by = excluded.set_by, updated_at = now();
  return jsonb_build_object('ok', true, 'sku', s, 'name', left(n, 60));
end $$;

revoke execute on function public.hdb_ai_label_names_for(text[]), public.hdb_ai_label_name_set(text,text,text) from public, anon, authenticated;
