-- LUNARA core schema: accounts, catalog, purchases, payment events, exploration sessions.
-- All time is integer milliseconds; all money is integer minor units.
-- Every mutation goes through a function that locks the account row first
-- (lock order: account -> session -> purchase -> event) and samples clock_timestamp()
-- AFTER the lock. Functions are executable by service_role only.

create table if not exists public.accounts (
  user_id uuid primary key references auth.users(id) on delete restrict,
  balance_ms bigint not null default 0 check (balance_ms >= 0 and balance_ms <= 31536000000),
  revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.packages (
  id text primary key,
  label text not null,
  duration_ms bigint not null check (duration_ms > 0),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  stripe_price_id text unique,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.accounts(user_id) on delete restrict,
  package_id text not null references public.packages(id),
  request_key uuid not null,
  stripe_checkout_id text unique,
  checkout_url text,
  status text not null default 'PENDING'
    check (status in ('PENDING','CREDITED','UNPAID','CHECKOUT_EXPIRED')),
  expected_price_id text not null,
  expected_duration_ms bigint not null check (expected_duration_ms > 0),
  expected_amount_minor bigint not null check (expected_amount_minor > 0),
  expected_currency text not null,
  credited_ms bigint not null default 0,
  credited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, request_key),
  check ((status = 'CREDITED' and credited_ms = expected_duration_ms and credited_at is not null)
      or (status <> 'CREDITED' and credited_ms = 0 and credited_at is null))
);
create index if not exists purchases_user_created on public.purchases (user_id, created_at desc);

create table if not exists public.payment_events (
  stripe_event_id text primary key,
  event_type text not null,
  stripe_checkout_id text,
  purchase_id uuid references public.purchases(id),
  livemode boolean not null,
  outcome text not null check (outcome in ('PROCESSED','IGNORED','REJECTED')),
  reason_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz not null default now()
);

create table if not exists public.exploration_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.accounts(user_id) on delete restrict,
  destination_id text not null check (destination_id = 'mars'),
  start_request_key uuid not null,
  status text not null check (status in ('ACTIVE','ENDED','INTERRUPTED','EXPIRED')),
  started_at timestamptz not null,
  accounted_through timestamptz not null,
  lease_deadline timestamptz not null,
  ended_at timestamptz,
  end_reason text,
  consumed_ms bigint not null default 0 check (consumed_ms >= 0),
  controller_hash text not null,
  controller_generation bigint not null default 1 check (controller_generation >= 1),
  last_heartbeat_seq bigint not null default 0 check (last_heartbeat_seq >= 0),
  last_takeover_key uuid,
  created_at timestamptz not null default now(),
  unique (user_id, start_request_key),
  check ((status = 'ACTIVE') = (ended_at is null)),
  check (accounted_through >= started_at),
  check (ended_at is null or ended_at >= started_at)
);
create unique index if not exists one_active_session_per_account
  on public.exploration_sessions (user_id) where status = 'ACTIVE';
create index if not exists sessions_user_started on public.exploration_sessions (user_id, started_at desc);

-- RLS on, no policies: anon/authenticated get nothing. Server uses service_role.
alter table public.accounts enable row level security;
alter table public.packages enable row level security;
alter table public.purchases enable row level security;
alter table public.payment_events enable row level security;
alter table public.exploration_sessions enable row level security;
revoke all on public.accounts, public.packages, public.purchases, public.payment_events,
  public.exploration_sessions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------

create or replace function public.lunara_ms(t timestamptz) returns bigint
language sql immutable as $$ select floor(extract(epoch from t) * 1000)::bigint $$;

create or replace function public.lunara_ts(ms bigint) returns timestamptz
language sql immutable as $$ select to_timestamp(ms / 1000.0) $$;

-- Ensure the account exists and lock it. Returns the locked row.
create or replace function public.lunara_lock_account(p_user uuid)
returns public.accounts
language plpgsql set search_path = '' as $$
declare a public.accounts;
begin
  insert into public.accounts (user_id) values (p_user) on conflict (user_id) do nothing;
  select * into a from public.accounts where user_id = p_user for update;
  return a;
end $$;

-- Settle the account's ACTIVE session (if any) up to min(now, lease, exhaustion).
-- Must be called with the account row already locked. Returns current db ms.
create or replace function public.lunara_reconcile(p_user uuid)
returns bigint
language plpgsql set search_path = '' as $$
declare
  s public.exploration_sessions;
  b bigint;
  n bigint := public.lunara_ms(clock_timestamp());
  a bigint; l bigint; e bigint; c bigint; t bigint; d bigint;
begin
  select * into s from public.exploration_sessions
    where user_id = p_user and status = 'ACTIVE' for update;
  if not found then return n; end if;

  select balance_ms into b from public.accounts where user_id = p_user;
  a := public.lunara_ms(s.accounted_through);
  l := public.lunara_ms(s.lease_deadline);
  n := greatest(n, a);
  e := a + b;
  c := least(l, e);
  t := least(n, c);
  d := greatest(0, t - a);

  update public.accounts
     set balance_ms = balance_ms - d, revision = revision + 1, updated_at = now()
   where user_id = p_user;

  if n >= c then
    update public.exploration_sessions
       set consumed_ms = consumed_ms + d,
           accounted_through = public.lunara_ts(t),
           status = case when e <= l then 'EXPIRED' else 'INTERRUPTED' end,
           end_reason = case when e <= l then 'BALANCE_EXHAUSTED' else 'LEASE_EXPIRED' end,
           ended_at = public.lunara_ts(c)
     where id = s.id;
  else
    update public.exploration_sessions
       set consumed_ms = consumed_ms + d, accounted_through = public.lunara_ts(t)
     where id = s.id;
  end if;
  return n;
end $$;

-- Build the JSON snapshot returned by every operation.
create or replace function public.lunara_snapshot(p_user uuid, p_now bigint, p_session uuid default null)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  acc public.accounts;
  s public.exploration_sessions;
  auth_until bigint;
begin
  select * into acc from public.accounts where user_id = p_user;
  if p_session is not null then
    select * into s from public.exploration_sessions where id = p_session and user_id = p_user;
  else
    select * into s from public.exploration_sessions where user_id = p_user
      order by (status = 'ACTIVE') desc, started_at desc limit 1;
  end if;

  if s.id is not null and s.status = 'ACTIVE' then
    auth_until := least(public.lunara_ms(s.lease_deadline),
                        public.lunara_ms(s.accounted_through) + acc.balance_ms);
  end if;

  return jsonb_build_object(
    'serverNow', p_now,
    'balanceMs', acc.balance_ms,
    'accountRevision', acc.revision,
    'session', case when s.id is null then null else jsonb_build_object(
      'id', s.id,
      'status', s.status,
      'startedAt', public.lunara_ms(s.started_at),
      'accountedThrough', public.lunara_ms(s.accounted_through),
      'leaseDeadline', public.lunara_ms(s.lease_deadline),
      'authorizedUntil', auth_until,
      'endedAt', case when s.ended_at is null then null else public.lunara_ms(s.ended_at) end,
      'endReason', s.end_reason,
      'consumedMs', s.consumed_ms,
      'controllerGeneration', s.controller_generation,
      'heartbeatSeq', s.last_heartbeat_seq
    ) end
  );
end $$;

-- ---------------------------------------------------------------------------
-- Public (service_role) operations
-- ---------------------------------------------------------------------------

create or replace function public.lunara_account_snapshot(p_user uuid)
returns jsonb
language plpgsql set search_path = '' as $$
declare n bigint;
begin
  perform public.lunara_lock_account(p_user);
  n := public.lunara_reconcile(p_user);
  return public.lunara_snapshot(p_user, n);
end $$;

create or replace function public.lunara_start_session(
  p_user uuid, p_destination text, p_request_key uuid, p_controller_hash text, p_lease_ms bigint)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  n bigint; acc public.accounts; s public.exploration_sessions; new_id uuid;
begin
  if p_destination <> 'mars' then
    raise exception 'UNSUPPORTED_DESTINATION' using errcode = 'P0001';
  end if;
  perform public.lunara_lock_account(p_user);
  n := public.lunara_reconcile(p_user);

  -- Replay of the same start request: return the original session, never a new one.
  select * into s from public.exploration_sessions
    where user_id = p_user and start_request_key = p_request_key;
  if found then
    if s.controller_hash <> p_controller_hash and s.controller_generation = 1 then
      raise exception 'START_KEY_REUSED' using errcode = 'P0001';
    end if;
    return public.lunara_snapshot(p_user, n, s.id) || jsonb_build_object('replayed', true);
  end if;

  if exists (select 1 from public.exploration_sessions where user_id = p_user and status = 'ACTIVE') then
    raise exception 'SESSION_ALREADY_ACTIVE' using errcode = 'P0001';
  end if;
  select * into acc from public.accounts where user_id = p_user;
  if acc.balance_ms <= 0 then
    raise exception 'INSUFFICIENT_BALANCE' using errcode = 'P0001';
  end if;

  insert into public.exploration_sessions (
    user_id, destination_id, start_request_key, status, started_at, accounted_through,
    lease_deadline, controller_hash, controller_generation, last_heartbeat_seq)
  values (p_user, 'mars', p_request_key, 'ACTIVE', public.lunara_ts(n), public.lunara_ts(n),
    public.lunara_ts(n + p_lease_ms), p_controller_hash, 1, 0)
  returning id into new_id;

  update public.accounts set revision = revision + 1, updated_at = now() where user_id = p_user;
  return public.lunara_snapshot(p_user, n, new_id);
end $$;

create or replace function public.lunara_heartbeat(
  p_user uuid, p_session uuid, p_controller_hash text, p_generation bigint, p_seq bigint, p_lease_ms bigint)
returns jsonb
language plpgsql set search_path = '' as $$
declare n bigint; s public.exploration_sessions;
begin
  perform public.lunara_lock_account(p_user);
  n := public.lunara_reconcile(p_user);
  select * into s from public.exploration_sessions where id = p_session and user_id = p_user for update;
  if not found then raise exception 'SESSION_NOT_FOUND' using errcode = 'P0001'; end if;
  if s.controller_generation <> p_generation or s.controller_hash <> p_controller_hash then
    raise exception 'STALE_CONTROLLER' using errcode = 'P0001';
  end if;
  if s.status <> 'ACTIVE' then
    return public.lunara_snapshot(p_user, n, s.id);  -- terminal: no renewal
  end if;
  if p_seq > s.last_heartbeat_seq then
    update public.exploration_sessions
       set last_heartbeat_seq = p_seq, lease_deadline = public.lunara_ts(n + p_lease_ms)
     where id = s.id;
  end if;  -- duplicate/old sequence: state only, no extension
  return public.lunara_snapshot(p_user, n, s.id);
end $$;

create or replace function public.lunara_takeover(
  p_user uuid, p_session uuid, p_expected_generation bigint, p_new_hash text,
  p_takeover_key uuid, p_lease_ms bigint)
returns jsonb
language plpgsql set search_path = '' as $$
declare n bigint; s public.exploration_sessions;
begin
  perform public.lunara_lock_account(p_user);
  n := public.lunara_reconcile(p_user);
  select * into s from public.exploration_sessions where id = p_session and user_id = p_user for update;
  if not found then raise exception 'SESSION_NOT_FOUND' using errcode = 'P0001'; end if;
  -- Exact retry of the winning takeover: return state without incrementing again.
  if s.last_takeover_key = p_takeover_key and s.controller_hash = p_new_hash then
    return public.lunara_snapshot(p_user, n, s.id);
  end if;
  if s.status <> 'ACTIVE' then
    return public.lunara_snapshot(p_user, n, s.id);
  end if;
  if s.controller_generation <> p_expected_generation then
    raise exception 'STALE_CONTROLLER' using errcode = 'P0001';
  end if;
  update public.exploration_sessions
     set controller_hash = p_new_hash,
         controller_generation = controller_generation + 1,
         last_heartbeat_seq = 0,
         last_takeover_key = p_takeover_key,
         lease_deadline = public.lunara_ts(n + p_lease_ms)
   where id = s.id;
  return public.lunara_snapshot(p_user, n, s.id);
end $$;

-- Controller stop (p_controller_hash given) or owner-level End (p_controller_hash null).
create or replace function public.lunara_stop_session(
  p_user uuid, p_session uuid, p_controller_hash text, p_generation bigint)
returns jsonb
language plpgsql set search_path = '' as $$
declare n bigint; s public.exploration_sessions;
begin
  perform public.lunara_lock_account(p_user);
  n := public.lunara_reconcile(p_user);
  select * into s from public.exploration_sessions where id = p_session and user_id = p_user for update;
  if not found then raise exception 'SESSION_NOT_FOUND' using errcode = 'P0001'; end if;
  if s.status <> 'ACTIVE' then
    return public.lunara_snapshot(p_user, n, s.id);  -- idempotent terminal result
  end if;
  if p_controller_hash is not null
     and (s.controller_hash <> p_controller_hash or s.controller_generation <> p_generation) then
    raise exception 'STALE_CONTROLLER' using errcode = 'P0001';
  end if;
  -- reconcile already charged through n; close exactly at n
  update public.exploration_sessions
     set status = 'ENDED', ended_at = public.lunara_ts(n),
         end_reason = case when p_controller_hash is null then 'OWNER_ENDED' else 'USER_EXIT' end
   where id = s.id;
  update public.accounts set revision = revision + 1, updated_at = now() where user_id = p_user;
  return public.lunara_snapshot(p_user, n, s.id);
end $$;

-- Reserve (or reuse) a purchase intent with frozen package economics.
create or replace function public.lunara_reserve_purchase(p_user uuid, p_package text, p_request_key uuid)
returns jsonb
language plpgsql set search_path = '' as $$
declare n bigint; pk public.packages; p public.purchases;
begin
  perform public.lunara_lock_account(p_user);
  n := public.lunara_reconcile(p_user);
  select * into p from public.purchases where user_id = p_user and request_key = p_request_key;
  if found then
    if p.package_id <> p_package then
      raise exception 'REQUEST_KEY_REUSED' using errcode = 'P0001';
    end if;
  else
    if exists (select 1 from public.exploration_sessions where user_id = p_user and status = 'ACTIVE') then
      raise exception 'SESSION_ALREADY_ACTIVE' using errcode = 'P0001';
    end if;
    select * into pk from public.packages where id = p_package and active and stripe_price_id is not null;
    if not found then raise exception 'PACKAGE_UNAVAILABLE' using errcode = 'P0001'; end if;
    insert into public.purchases (user_id, package_id, request_key, expected_price_id,
      expected_duration_ms, expected_amount_minor, expected_currency)
    values (p_user, pk.id, p_request_key, pk.stripe_price_id, pk.duration_ms, pk.amount_minor, pk.currency)
    returning * into p;
  end if;
  return to_jsonb(p);
end $$;

create or replace function public.lunara_bind_checkout(p_user uuid, p_purchase uuid, p_checkout text, p_url text)
returns jsonb
language plpgsql set search_path = '' as $$
declare p public.purchases;
begin
  perform public.lunara_lock_account(p_user);
  select * into p from public.purchases where id = p_purchase and user_id = p_user for update;
  if not found then raise exception 'PURCHASE_NOT_FOUND' using errcode = 'P0001'; end if;
  if p.stripe_checkout_id is not null and p.stripe_checkout_id <> p_checkout then
    raise exception 'CHECKOUT_MISMATCH' using errcode = 'P0001';
  end if;
  update public.purchases set stripe_checkout_id = p_checkout,
      checkout_url = coalesce(p_url, checkout_url), updated_at = now()
   where id = p.id returning * into p;
  return to_jsonb(p);
end $$;

-- Atomic, once-only fulfillment. Caller has ALREADY verified the Stripe facts
-- (signature, paid, test mode, price, quantity, currency, total, metadata binding).
-- p_event_id may be null for the authenticated recheck path.
create or replace function public.lunara_fulfill_purchase(
  p_user uuid, p_purchase uuid, p_checkout text, p_amount_total bigint, p_currency text,
  p_price_id text, p_event_id text, p_event_type text)
returns jsonb
language plpgsql set search_path = '' as $$
declare n bigint; p public.purchases; outcome text;
begin
  perform public.lunara_lock_account(p_user);
  n := public.lunara_reconcile(p_user);  -- settle prior use before adding credit
  select * into p from public.purchases where id = p_purchase and user_id = p_user for update;
  if not found then raise exception 'PURCHASE_NOT_FOUND' using errcode = 'P0001'; end if;

  if p_event_id is not null and exists (select 1 from public.payment_events where stripe_event_id = p_event_id) then
    return jsonb_build_object('outcome', 'DUPLICATE_EVENT', 'purchase', to_jsonb(p));
  end if;

  if p.stripe_checkout_id is not null and p.stripe_checkout_id <> p_checkout then
    outcome := 'REJECTED_CHECKOUT_MISMATCH';
  elsif p.expected_amount_minor <> p_amount_total or p.expected_currency <> lower(p_currency)
        or p.expected_price_id <> p_price_id then
    outcome := 'REJECTED_ECONOMICS_MISMATCH';
  elsif p.status = 'CREDITED' then
    outcome := 'ALREADY_CREDITED';
  else
    update public.purchases
       set status = 'CREDITED', credited_ms = expected_duration_ms, credited_at = now(),
           stripe_checkout_id = p_checkout, updated_at = now()
     where id = p.id returning * into p;
    update public.accounts
       set balance_ms = balance_ms + p.expected_duration_ms, revision = revision + 1, updated_at = now()
     where user_id = p_user;
    outcome := 'CREDITED';
  end if;

  if p_event_id is not null then
    insert into public.payment_events (stripe_event_id, event_type, stripe_checkout_id, purchase_id,
      livemode, outcome, reason_code)
    values (p_event_id, p_event_type, p_checkout, p.id, false,
      case when outcome like 'REJECTED%' then 'REJECTED' when outcome = 'CREDITED' then 'PROCESSED' else 'IGNORED' end,
      outcome);
  end if;
  return jsonb_build_object('outcome', outcome, 'purchase', to_jsonb(p));
end $$;

-- Mark an uncredited purchase as UNPAID / CHECKOUT_EXPIRED. Never reverses CREDITED.
create or replace function public.lunara_mark_purchase(
  p_user uuid, p_purchase uuid, p_status text, p_event_id text, p_event_type text, p_checkout text)
returns jsonb
language plpgsql set search_path = '' as $$
declare p public.purchases;
begin
  if p_status not in ('UNPAID','CHECKOUT_EXPIRED') then
    raise exception 'BAD_STATUS' using errcode = 'P0001';
  end if;
  perform public.lunara_lock_account(p_user);
  select * into p from public.purchases where id = p_purchase and user_id = p_user for update;
  if not found then raise exception 'PURCHASE_NOT_FOUND' using errcode = 'P0001'; end if;
  if p_event_id is not null and exists (select 1 from public.payment_events where stripe_event_id = p_event_id) then
    return to_jsonb(p);
  end if;
  if p.status <> 'CREDITED' then
    update public.purchases set status = p_status, updated_at = now() where id = p.id returning * into p;
  end if;
  if p_event_id is not null then
    insert into public.payment_events (stripe_event_id, event_type, stripe_checkout_id, purchase_id, livemode, outcome, reason_code)
    values (p_event_id, p_event_type, p_checkout, p.id, false, 'PROCESSED', p_status);
  end if;
  return to_jsonb(p);
end $$;

-- Record an event we refused before reaching a purchase (e.g. livemode, unknown purchase).
create or replace function public.lunara_record_event(
  p_event_id text, p_event_type text, p_checkout text, p_livemode boolean, p_outcome text, p_reason text)
returns void
language sql set search_path = '' as $$
  insert into public.payment_events (stripe_event_id, event_type, stripe_checkout_id, livemode, outcome, reason_code)
  values (p_event_id, p_event_type, p_checkout, p_livemode, p_outcome, p_reason)
  on conflict (stripe_event_id) do nothing;
$$;

-- Lock down function execution to service_role only.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname like 'lunara\_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

grant select, insert, update on public.accounts, public.purchases, public.payment_events,
  public.exploration_sessions to service_role;
grant select on public.packages to service_role;
