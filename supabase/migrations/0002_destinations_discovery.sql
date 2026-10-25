-- LUNARA 2.0: per-destination balances (Mars, Moon), destination-specific packages,
-- mission telemetry, geological observations and mission reports.
-- Backward compatible and safe to re-run. Runs in one transaction (db-migrate applies
-- each file as a single multi-statement query; wrap explicitly for psql users too).

begin;

-- Serialize with every lunara_* function (they all lock an account row first).
lock table public.accounts in share row exclusive mode;

-- ---------------------------------------------------------------------------
-- Destinations on catalog, purchases and sessions
-- ---------------------------------------------------------------------------
alter table public.packages add column if not exists destination_id text not null default 'mars';
alter table public.packages drop constraint if exists packages_destination_check;
alter table public.packages add constraint packages_destination_check check (destination_id in ('mars','moon'));

alter table public.purchases add column if not exists destination_id text;
-- Legacy purchases resolve their destination from the trusted package record (all legacy packages are Mars).
update public.purchases p set destination_id = k.destination_id
  from public.packages k where k.id = p.package_id and p.destination_id is null;
alter table public.purchases alter column destination_id set not null;
alter table public.purchases drop constraint if exists purchases_destination_check;
alter table public.purchases add constraint purchases_destination_check check (destination_id in ('mars','moon'));

alter table public.exploration_sessions drop constraint if exists exploration_sessions_destination_id_check;
alter table public.exploration_sessions drop constraint if exists exploration_sessions_destination_check;
alter table public.exploration_sessions add constraint exploration_sessions_destination_check
  check (destination_id in ('mars','moon'));

-- ---------------------------------------------------------------------------
-- Per-destination balances. accounts.balance_ms is retired (locked at 0).
-- ---------------------------------------------------------------------------
create table if not exists public.destination_balances (
  user_id uuid not null references public.accounts(user_id) on delete restrict,
  destination_id text not null check (destination_id in ('mars','moon')),
  balance_ms bigint not null default 0 check (balance_ms >= 0 and balance_ms <= 31536000000),
  updated_at timestamptz not null default now(),
  primary key (user_id, destination_id)
);

alter table public.accounts add column if not exists balance_migrated_at timestamptz;
alter table public.accounts drop constraint if exists accounts_legacy_balance_retired;

-- Backfill: legacy unused time becomes the SAME duration of Mars time. Moon starts at 0.
-- Only rows not yet migrated are touched, so re-running never duplicates credit.
insert into public.destination_balances (user_id, destination_id, balance_ms)
  select user_id, 'mars', balance_ms from public.accounts where balance_migrated_at is null
  on conflict (user_id, destination_id) do update
    set balance_ms = public.destination_balances.balance_ms + excluded.balance_ms, updated_at = now();
insert into public.destination_balances (user_id, destination_id, balance_ms)
  select user_id, 'moon', 0 from public.accounts
  on conflict (user_id, destination_id) do nothing;
update public.accounts set balance_ms = 0, balance_migrated_at = now(), revision = revision + 1
  where balance_migrated_at is null;

-- Any stale writer that still targets the old column now fails (and rolls back) instead of
-- silently crediting an abandoned balance source.
alter table public.accounts add constraint accounts_legacy_balance_retired check (balance_ms = 0);

-- ---------------------------------------------------------------------------
-- Mission data (a mission IS an exploration session)
-- ---------------------------------------------------------------------------
create table if not exists public.mission_telemetry (
  session_id uuid primary key references public.exploration_sessions(id) on delete restrict,
  user_id uuid not null references public.accounts(user_id) on delete restrict,
  distance_mu double precision not null default 0 check (distance_mu >= 0),
  sampled_ms bigint not null default 0 check (sampled_ms >= 0),
  accepted_count int not null default 0,
  rejected_count int not null default 0,
  last_segment uuid,
  last_seg_dist double precision not null default 0,
  last_seg_ms bigint not null default 0,
  last_x double precision,
  last_z double precision,
  last_heading double precision,
  last_at timestamptz
);

create table if not exists public.observations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.exploration_sessions(id) on delete restrict,
  user_id uuid not null references public.accounts(user_id) on delete restrict,
  destination_id text not null check (destination_id in ('mars','moon')),
  site_id text not null,
  dataset_version text not null,
  snapshot jsonb not null,
  x double precision not null,
  z double precision not null,
  scanned_at timestamptz not null default now(),
  unique (session_id, site_id)
);
create index if not exists observations_user on public.observations (user_id, scanned_at desc);

create table if not exists public.mission_reports (
  session_id uuid primary key references public.exploration_sessions(id) on delete restrict,
  user_id uuid not null references public.accounts(user_id) on delete restrict,
  status text not null check (status in ('READY','FAILED')),
  report jsonb,
  error text,
  generated_at timestamptz not null default now(),
  check ((status = 'READY') = (report is not null))
);

alter table public.destination_balances enable row level security;
alter table public.mission_telemetry enable row level security;
alter table public.observations enable row level security;
alter table public.mission_reports enable row level security;
revoke all on public.destination_balances, public.mission_telemetry, public.observations,
  public.mission_reports from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Core functions (replaced in place so old callers get the new semantics)
-- ---------------------------------------------------------------------------

create or replace function public.lunara_lock_account(p_user uuid)
returns public.accounts
language plpgsql set search_path = '' as $$
declare a public.accounts;
begin
  insert into public.accounts (user_id, balance_migrated_at) values (p_user, now())
    on conflict (user_id) do nothing;
  select * into a from public.accounts where user_id = p_user for update;
  insert into public.destination_balances (user_id, destination_id) values (p_user, 'mars'), (p_user, 'moon')
    on conflict (user_id, destination_id) do nothing;
  return a;
end $$;

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

  select balance_ms into b from public.destination_balances
    where user_id = p_user and destination_id = s.destination_id for update;
  a := public.lunara_ms(s.accounted_through);
  l := public.lunara_ms(s.lease_deadline);
  n := greatest(n, a);
  e := a + b;
  c := least(l, e);
  t := least(n, c);
  d := greatest(0, t - a);

  update public.destination_balances set balance_ms = balance_ms - d, updated_at = now()
   where user_id = p_user and destination_id = s.destination_id;
  update public.accounts set revision = revision + 1, updated_at = now() where user_id = p_user;

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

create or replace function public.lunara_snapshot(p_user uuid, p_now bigint, p_session uuid default null)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  acc public.accounts;
  s public.exploration_sessions;
  bal jsonb;
  sbal bigint;
  auth_until bigint;
  tel public.mission_telemetry;
  scanned jsonb;
begin
  select * into acc from public.accounts where user_id = p_user;
  select coalesce(jsonb_object_agg(destination_id, balance_ms), '{}'::jsonb) into bal
    from public.destination_balances where user_id = p_user;
  if p_session is not null then
    select * into s from public.exploration_sessions where id = p_session and user_id = p_user;
  else
    select * into s from public.exploration_sessions where user_id = p_user
      order by (status = 'ACTIVE') desc, started_at desc limit 1;
  end if;

  if s.id is not null then
    sbal := coalesce((bal ->> s.destination_id)::bigint, 0);
    if s.status = 'ACTIVE' then
      auth_until := least(public.lunara_ms(s.lease_deadline), public.lunara_ms(s.accounted_through) + sbal);
    end if;
    select * into tel from public.mission_telemetry where session_id = s.id;
    select coalesce(jsonb_agg(site_id order by scanned_at), '[]'::jsonb) into scanned
      from public.observations where session_id = s.id;
  end if;

  return jsonb_build_object(
    'serverNow', p_now,
    'balances', bal,
    -- legacy field: balance of the session's destination (Mars when no session)
    'balanceMs', coalesce(sbal, (bal ->> 'mars')::bigint, 0),
    'accountRevision', acc.revision,
    'session', case when s.id is null then null else jsonb_build_object(
      'id', s.id,
      'destinationId', s.destination_id,
      'status', s.status,
      'startedAt', public.lunara_ms(s.started_at),
      'accountedThrough', public.lunara_ms(s.accounted_through),
      'leaseDeadline', public.lunara_ms(s.lease_deadline),
      'authorizedUntil', auth_until,
      'endedAt', case when s.ended_at is null then null else public.lunara_ms(s.ended_at) end,
      'endReason', s.end_reason,
      'consumedMs', s.consumed_ms,
      'controllerGeneration', s.controller_generation,
      'heartbeatSeq', s.last_heartbeat_seq,
      'distanceMu', coalesce(tel.distance_mu, 0),
      'sampledMs', coalesce(tel.sampled_ms, 0),
      'scannedSites', scanned
    ) end
  );
end $$;

create or replace function public.lunara_start_session(
  p_user uuid, p_destination text, p_request_key uuid, p_controller_hash text, p_lease_ms bigint)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  n bigint; b bigint; s public.exploration_sessions; new_id uuid;
begin
  if p_destination not in ('mars','moon') then
    raise exception 'UNSUPPORTED_DESTINATION' using errcode = 'P0001';
  end if;
  perform public.lunara_lock_account(p_user);
  n := public.lunara_reconcile(p_user);

  select * into s from public.exploration_sessions
    where user_id = p_user and start_request_key = p_request_key;
  if found then
    if s.destination_id <> p_destination
       or (s.controller_hash <> p_controller_hash and s.controller_generation = 1) then
      raise exception 'START_KEY_REUSED' using errcode = 'P0001';
    end if;
    return public.lunara_snapshot(p_user, n, s.id) || jsonb_build_object('replayed', true);
  end if;

  -- One active session per ACCOUNT, across all destinations.
  if exists (select 1 from public.exploration_sessions where user_id = p_user and status = 'ACTIVE') then
    raise exception 'SESSION_ALREADY_ACTIVE' using errcode = 'P0001';
  end if;
  select balance_ms into b from public.destination_balances
    where user_id = p_user and destination_id = p_destination;
  if coalesce(b, 0) <= 0 then
    raise exception 'INSUFFICIENT_BALANCE' using errcode = 'P0001';
  end if;

  insert into public.exploration_sessions (
    user_id, destination_id, start_request_key, status, started_at, accounted_through,
    lease_deadline, controller_hash, controller_generation, last_heartbeat_seq)
  values (p_user, p_destination, p_request_key, 'ACTIVE', public.lunara_ts(n), public.lunara_ts(n),
    public.lunara_ts(n + p_lease_ms), p_controller_hash, 1, 0)
  returning id into new_id;
  insert into public.mission_telemetry (session_id, user_id) values (new_id, p_user);

  update public.accounts set revision = revision + 1, updated_at = now() where user_id = p_user;
  return public.lunara_snapshot(p_user, n, new_id);
end $$;

-- Applies an idempotent telemetry checkpoint to an ACTIVE session (caller holds the account lock).
-- p_tel: {segment uuid, dist cumulative-in-segment, ms cumulative-in-segment, x, z, heading}.
create or replace function public.lunara_apply_telemetry(
  p_session public.exploration_sessions, p_now bigint, p_tel jsonb, p_max_speed double precision)
returns void
language plpgsql set search_path = '' as $$
declare
  t public.mission_telemetry;
  seg uuid; dist double precision; ms bigint; x double precision; z double precision; hd double precision;
  d_dist double precision; d_ms bigint; elapsed bigint; allowed double precision; jump double precision;
  ok boolean := true;
begin
  if p_tel is null or p_session.status <> 'ACTIVE' then return; end if;
  begin
    seg := (p_tel->>'segment')::uuid;
    dist := (p_tel->>'dist')::double precision;
    ms := (p_tel->>'ms')::bigint;
    x := (p_tel->>'x')::double precision;
    z := (p_tel->>'z')::double precision;
    hd := (p_tel->>'heading')::double precision;
  exception when others then return;  -- malformed telemetry never affects billing
  end;
  if seg is null or dist is null or ms is null or x is null or z is null
     or dist < 0 or ms < 0 or dist = 'Infinity'::float8 or dist <> dist then return; end if;

  insert into public.mission_telemetry (session_id, user_id) values (p_session.id, p_session.user_id)
    on conflict (session_id) do nothing;
  select * into t from public.mission_telemetry where session_id = p_session.id for update;

  if t.last_segment is distinct from seg then
    d_dist := dist; d_ms := ms;
  else
    d_dist := dist - t.last_seg_dist; d_ms := ms - t.last_seg_ms;
  end if;
  if d_dist < 0 or d_ms < 0 then
    update public.mission_telemetry set rejected_count = rejected_count + 1 where session_id = t.session_id;
    return;  -- stale / reordered checkpoint
  end if;

  elapsed := p_now - public.lunara_ms(coalesce(t.last_at, p_session.started_at));
  allowed := p_max_speed * greatest(elapsed, 0) / 1000.0 * 1.25 + 2;
  if d_dist > allowed or d_ms > elapsed + 2000 then ok := false; end if;
  if t.last_x is not null then
    jump := sqrt(power(x - t.last_x, 2) + power(z - t.last_z, 2));
    if jump > allowed then ok := false; end if;  -- teleport / implausible jump: not distance
  end if;

  update public.mission_telemetry set
    distance_mu = distance_mu + case when ok then d_dist else 0 end,
    sampled_ms = sampled_ms + case when ok then d_ms else 0 end,
    accepted_count = accepted_count + case when ok then 1 else 0 end,
    rejected_count = rejected_count + case when ok then 0 else 1 end,
    last_segment = seg, last_seg_dist = dist, last_seg_ms = ms,
    last_x = x, last_z = z, last_heading = hd, last_at = public.lunara_ts(p_now)
  where session_id = t.session_id;
end $$;

drop function if exists public.lunara_heartbeat(uuid, uuid, text, bigint, bigint, bigint);
create or replace function public.lunara_heartbeat(
  p_user uuid, p_session uuid, p_controller_hash text, p_generation bigint, p_seq bigint, p_lease_ms bigint,
  p_telemetry jsonb default null, p_max_speed double precision default 10)
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
    return public.lunara_snapshot(p_user, n, s.id);  -- terminal: no renewal, no telemetry
  end if;
  if p_seq > s.last_heartbeat_seq then
    update public.exploration_sessions
       set last_heartbeat_seq = p_seq, lease_deadline = public.lunara_ts(n + p_lease_ms)
     where id = s.id;
    perform public.lunara_apply_telemetry(s, n, p_telemetry, p_max_speed);
  end if;
  return public.lunara_snapshot(p_user, n, s.id);
end $$;

drop function if exists public.lunara_stop_session(uuid, uuid, text, bigint);
create or replace function public.lunara_stop_session(
  p_user uuid, p_session uuid, p_controller_hash text, p_generation bigint,
  p_telemetry jsonb default null, p_max_speed double precision default 10)
returns jsonb
language plpgsql set search_path = '' as $$
declare n bigint; s public.exploration_sessions;
begin
  perform public.lunara_lock_account(p_user);
  n := public.lunara_reconcile(p_user);
  select * into s from public.exploration_sessions where id = p_session and user_id = p_user for update;
  if not found then raise exception 'SESSION_NOT_FOUND' using errcode = 'P0001'; end if;
  if s.status <> 'ACTIVE' then
    return public.lunara_snapshot(p_user, n, s.id);
  end if;
  if p_controller_hash is not null
     and (s.controller_hash <> p_controller_hash or s.controller_generation <> p_generation) then
    raise exception 'STALE_CONTROLLER' using errcode = 'P0001';
  end if;
  -- Final checkpoint is accepted only while the session is still active (finalization boundary).
  if p_controller_hash is not null then
    perform public.lunara_apply_telemetry(s, n, p_telemetry, p_max_speed);
  end if;
  update public.exploration_sessions
     set status = 'ENDED', ended_at = public.lunara_ts(n),
         end_reason = case when p_controller_hash is null then 'OWNER_ENDED' else 'USER_EXIT' end
   where id = s.id;
  update public.accounts set revision = revision + 1, updated_at = now() where user_id = p_user;
  return public.lunara_snapshot(p_user, n, s.id);
end $$;

-- Reserve a purchase: destination comes from the trusted package row.
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
    insert into public.purchases (user_id, package_id, destination_id, request_key, expected_price_id,
      expected_duration_ms, expected_amount_minor, expected_currency)
    values (p_user, pk.id, pk.destination_id, p_request_key, pk.stripe_price_id, pk.duration_ms,
      pk.amount_minor, pk.currency)
    returning * into p;
  end if;
  return to_jsonb(p);
end $$;

-- Once-only fulfillment against the purchase's own frozen snapshot and destination.
create or replace function public.lunara_fulfill_purchase(
  p_user uuid, p_purchase uuid, p_checkout text, p_amount_total bigint, p_currency text,
  p_price_id text, p_event_id text, p_event_type text)
returns jsonb
language plpgsql set search_path = '' as $$
declare n bigint; p public.purchases; outcome text;
begin
  perform public.lunara_lock_account(p_user);
  n := public.lunara_reconcile(p_user);
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
    update public.destination_balances
       set balance_ms = balance_ms + p.expected_duration_ms, updated_at = now()
     where user_id = p_user and destination_id = p.destination_id;
    update public.accounts set revision = revision + 1, updated_at = now() where user_id = p_user;
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

-- ---------------------------------------------------------------------------
-- Observations
-- ---------------------------------------------------------------------------
-- Site data (destination, coordinates, radius, snapshot) is resolved by the server from its
-- trusted dataset and passed in; the browser only supplies its current position.
create or replace function public.lunara_record_observation(
  p_user uuid, p_session uuid, p_controller_hash text, p_generation bigint,
  p_site_id text, p_site_destination text, p_site_x double precision, p_site_z double precision,
  p_site_radius double precision, p_dataset_version text, p_snapshot jsonb,
  p_x double precision, p_z double precision,
  p_spawn_x double precision, p_spawn_z double precision, p_max_speed double precision)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  n bigint; s public.exploration_sessions; t public.mission_telemetry; o public.observations;
  elapsed bigint; allowed double precision; ref_x double precision; ref_z double precision;
begin
  perform public.lunara_lock_account(p_user);
  n := public.lunara_reconcile(p_user);  -- closes the session first if its cutoff has passed
  select * into s from public.exploration_sessions where id = p_session and user_id = p_user for update;
  if not found then raise exception 'SESSION_NOT_FOUND' using errcode = 'P0001'; end if;
  if s.controller_generation <> p_generation or s.controller_hash <> p_controller_hash then
    raise exception 'STALE_CONTROLLER' using errcode = 'P0001';
  end if;

  -- Retry of an already-saved scan returns the saved observation (even after closure).
  select * into o from public.observations where session_id = s.id and site_id = p_site_id;
  if found then return jsonb_build_object('outcome', 'ALREADY_SAVED', 'observation', to_jsonb(o)); end if;

  if s.status <> 'ACTIVE' then raise exception 'SESSION_NOT_ACTIVE' using errcode = 'P0001'; end if;
  if s.destination_id <> p_site_destination then raise exception 'WRONG_DESTINATION' using errcode = 'P0001'; end if;
  if sqrt(power(p_x - p_site_x, 2) + power(p_z - p_site_z, 2)) > p_site_radius then
    raise exception 'OUT_OF_RANGE' using errcode = 'P0001';
  end if;

  -- Plausibility against the last accepted position (or spawn when none yet).
  select * into t from public.mission_telemetry where session_id = s.id;
  if t.last_at is not null then
    ref_x := t.last_x; ref_z := t.last_z; elapsed := n - public.lunara_ms(t.last_at);
  else
    ref_x := p_spawn_x; ref_z := p_spawn_z; elapsed := n - public.lunara_ms(s.started_at);
  end if;
  allowed := p_max_speed * greatest(elapsed, 0) / 1000.0 * 1.25 + case when t.last_at is null then 130 else 4 end;
  if sqrt(power(p_x - ref_x, 2) + power(p_z - ref_z, 2)) > allowed then
    raise exception 'IMPLAUSIBLE_POSITION' using errcode = 'P0001';
  end if;

  insert into public.observations (session_id, user_id, destination_id, site_id, dataset_version, snapshot, x, z, scanned_at)
  values (s.id, p_user, s.destination_id, p_site_id, p_dataset_version, p_snapshot, p_site_x, p_site_z, public.lunara_ts(n))
  on conflict (session_id, site_id) do nothing
  returning * into o;
  if o.id is null then
    select * into o from public.observations where session_id = s.id and site_id = p_site_id;
    return jsonb_build_object('outcome', 'ALREADY_SAVED', 'observation', to_jsonb(o));
  end if;
  return jsonb_build_object('outcome', 'SAVED', 'observation', to_jsonb(o));
end $$;

-- ---------------------------------------------------------------------------
-- Missions, reports, archive
-- ---------------------------------------------------------------------------
create or replace function public.lunara_mission_data(p_user uuid, p_session uuid)
returns jsonb
language plpgsql set search_path = '' as $$
declare s public.exploration_sessions; t public.mission_telemetry; r public.mission_reports; obs jsonb;
begin
  select * into s from public.exploration_sessions where id = p_session and user_id = p_user;
  if not found then raise exception 'SESSION_NOT_FOUND' using errcode = 'P0001'; end if;
  select * into t from public.mission_telemetry where session_id = s.id;
  select * into r from public.mission_reports where session_id = s.id;
  select coalesce(jsonb_agg(to_jsonb(o) order by o.scanned_at), '[]'::jsonb) into obs
    from public.observations o where o.session_id = s.id;
  return jsonb_build_object(
    'session', jsonb_build_object(
      'id', s.id, 'destinationId', s.destination_id, 'status', s.status,
      'startedAt', public.lunara_ms(s.started_at),
      'endedAt', case when s.ended_at is null then null else public.lunara_ms(s.ended_at) end,
      'endReason', s.end_reason, 'consumedMs', s.consumed_ms),
    'telemetry', case when t.session_id is null then null else jsonb_build_object(
      'distanceMu', t.distance_mu, 'sampledMs', t.sampled_ms,
      'acceptedCount', t.accepted_count, 'rejectedCount', t.rejected_count) end,
    'observations', obs,
    'report', case when r.session_id is null then null else jsonb_build_object(
      'status', r.status, 'report', r.report, 'error', r.error,
      'generatedAt', public.lunara_ms(r.generated_at)) end
  );
end $$;

-- Saves the canonical report for a CLOSED mission. READY reports are immutable;
-- a FAILED attempt may be replaced by a later successful retry.
create or replace function public.lunara_save_report(
  p_user uuid, p_session uuid, p_status text, p_report jsonb, p_error text)
returns jsonb
language plpgsql set search_path = '' as $$
declare s public.exploration_sessions; r public.mission_reports;
begin
  select * into s from public.exploration_sessions where id = p_session and user_id = p_user;
  if not found then raise exception 'SESSION_NOT_FOUND' using errcode = 'P0001'; end if;
  if s.status = 'ACTIVE' then raise exception 'SESSION_NOT_CLOSED' using errcode = 'P0001'; end if;
  insert into public.mission_reports (session_id, user_id, status, report, error, generated_at)
  values (s.id, p_user, p_status, p_report, p_error, now())
  on conflict (session_id) do update
    set status = excluded.status, report = excluded.report, error = excluded.error, generated_at = now()
    where public.mission_reports.status = 'FAILED';
  select * into r from public.mission_reports where session_id = s.id;
  return jsonb_build_object('status', r.status, 'report', r.report, 'error', r.error,
    'generatedAt', public.lunara_ms(r.generated_at));
end $$;

create or replace function public.lunara_list_missions(p_user uuid, p_limit int, p_before timestamptz default null)
returns jsonb
language sql set search_path = '' as $$
  select coalesce(jsonb_agg(m order by (m->>'startedAt')::bigint desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', s.id, 'destinationId', s.destination_id, 'status', s.status,
      'startedAt', public.lunara_ms(s.started_at),
      'endedAt', case when s.ended_at is null then null else public.lunara_ms(s.ended_at) end,
      'endReason', s.end_reason, 'consumedMs', s.consumed_ms,
      'observationCount', (select count(*) from public.observations o where o.session_id = s.id),
      'hasTelemetry', exists (select 1 from public.mission_telemetry t where t.session_id = s.id),
      'reportStatus', (select r.status from public.mission_reports r where r.session_id = s.id)
    ) as m
    from public.exploration_sessions s
    where s.user_id = p_user and (p_before is null or s.started_at < p_before)
    order by s.started_at desc
    limit least(greatest(p_limit, 1), 50)
  ) x;
$$;

-- Lock down every lunara_* function to service_role only (covers new ones).
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

grant select, insert, update on public.destination_balances, public.mission_telemetry,
  public.observations, public.mission_reports to service_role;
grant select, insert, update on public.packages to service_role;

commit;
