-- Tighten scan position plausibility before the first telemetry checkpoint:
-- allow at most (max speed × time since Start × 1.25) + 12 mu from the validated spawn,
-- instead of a flat 130 mu. Both verified spawns sit on valid ground (no spawn search offset).
begin;

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

  select * into o from public.observations where session_id = s.id and site_id = p_site_id;
  if found then return jsonb_build_object('outcome', 'ALREADY_SAVED', 'observation', to_jsonb(o)); end if;

  if s.status <> 'ACTIVE' then raise exception 'SESSION_NOT_ACTIVE' using errcode = 'P0001'; end if;
  if s.destination_id <> p_site_destination then raise exception 'WRONG_DESTINATION' using errcode = 'P0001'; end if;
  if sqrt(power(p_x - p_site_x, 2) + power(p_z - p_site_z, 2)) > p_site_radius then
    raise exception 'OUT_OF_RANGE' using errcode = 'P0001';
  end if;

  select * into t from public.mission_telemetry where session_id = s.id;
  if t.last_at is not null then
    ref_x := t.last_x; ref_z := t.last_z; elapsed := n - public.lunara_ms(t.last_at);
    allowed := p_max_speed * greatest(elapsed, 0) / 1000.0 * 1.25 + 4;
  else
    ref_x := p_spawn_x; ref_z := p_spawn_z; elapsed := n - public.lunara_ms(s.started_at);
    allowed := p_max_speed * greatest(elapsed, 0) / 1000.0 * 1.25 + 12;
  end if;
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

revoke all on function public.lunara_record_observation(uuid, uuid, text, bigint, text, text, double precision,
  double precision, double precision, text, jsonb, double precision, double precision, double precision,
  double precision, double precision) from public, anon, authenticated;
grant execute on function public.lunara_record_observation(uuid, uuid, text, bigint, text, text, double precision,
  double precision, double precision, text, jsonb, double precision, double precision, double precision,
  double precision, double precision) to service_role;

commit;
