import "server-only";
import { createHash } from "node:crypto";
import type { AccountSnapshot, TelemetryInput } from "@/shared/contracts";
import { DESTINATIONS, DESTINATION_IDS, type DestinationId, type GeoSite } from "@/config/destinations";
import { rpc } from "@/server/db";
import { serverEnv } from "@/server/env";
import { DomainError } from "@/server/http";

/** Only hashes of controller tokens are stored or compared server-side. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function policy() {
  return { heartbeatMs: serverEnv.heartbeatMs, leaseMs: serverEnv.leaseMs };
}

// The session's destination is only known inside the transaction, so telemetry plausibility
// uses the fastest destination's speed and the union of traversable bounds (lenient, never billing).
const MAX_SPEED = Math.max(...DESTINATION_IDS.map((d) => DESTINATIONS[d].speed));
const LIMIT = Math.max(...DESTINATION_IDS.flatMap((d) => Object.values(DESTINATIONS[d].bounds).map(Math.abs)));

function telemetryArg(t: TelemetryInput | undefined) {
  if (!t) return null;
  if (Math.abs(t.x) > LIMIT || Math.abs(t.z) > LIMIT) return null; // out of any map: ignore checkpoint
  return t;
}

export const sessions = {
  snapshot: (userId: string) => rpc<AccountSnapshot>("lunara_account_snapshot", { p_user: userId }),

  start: (userId: string, destination: DestinationId, requestKey: string, token: string) =>
    rpc<AccountSnapshot>("lunara_start_session", {
      p_user: userId,
      p_destination: destination,
      p_request_key: requestKey,
      p_controller_hash: hashToken(token),
      p_lease_ms: serverEnv.leaseMs,
    }),

  heartbeat: (
    userId: string,
    sessionId: string,
    token: string,
    generation: number,
    seq: number,
    telemetry?: TelemetryInput,
  ) =>
    rpc<AccountSnapshot>("lunara_heartbeat", {
      p_user: userId,
      p_session: sessionId,
      p_controller_hash: hashToken(token),
      p_generation: generation,
      p_seq: seq,
      p_lease_ms: serverEnv.leaseMs,
      p_telemetry: telemetryArg(telemetry),
      p_max_speed: MAX_SPEED,
    }),

  takeover: (userId: string, sessionId: string, expectedGeneration: number, token: string, key: string) =>
    rpc<AccountSnapshot>("lunara_takeover", {
      p_user: userId,
      p_session: sessionId,
      p_expected_generation: expectedGeneration,
      p_new_hash: hashToken(token),
      p_takeover_key: key,
      p_lease_ms: serverEnv.leaseMs,
    }),

  stop: (
    userId: string,
    sessionId: string,
    token: string | null,
    generation: number | null,
    telemetry?: TelemetryInput,
  ) =>
    rpc<AccountSnapshot>("lunara_stop_session", {
      p_user: userId,
      p_session: sessionId,
      p_controller_hash: token ? hashToken(token) : null,
      p_generation: generation,
      p_telemetry: token ? telemetryArg(telemetry) : null,
      p_max_speed: MAX_SPEED,
    }),

  /** Persist a scan. Site facts come from the server dataset; the browser only supplies its position. */
  recordObservation: (
    userId: string,
    sessionId: string,
    token: string,
    generation: number,
    site: GeoSite,
    x: number,
    z: number,
  ) => {
    const d = DESTINATIONS[site.destinationId];
    return rpc<{ outcome: "SAVED" | "ALREADY_SAVED"; observation: ObservationRow }>("lunara_record_observation", {
      p_user: userId,
      p_session: sessionId,
      p_controller_hash: hashToken(token),
      p_generation: generation,
      p_site_id: site.id,
      p_site_destination: site.destinationId,
      p_site_x: site.x,
      p_site_z: site.z,
      p_site_radius: site.radius,
      p_dataset_version: d.datasetVersion,
      p_snapshot: siteSnapshot(site, d.datasetVersion),
      p_x: x,
      p_z: z,
      p_spawn_x: d.spawn.x,
      p_spawn_z: d.spawn.z,
      p_max_speed: d.speed,
    });
  },
};

export interface ObservationRow {
  id: string;
  session_id: string;
  destination_id: DestinationId;
  site_id: string;
  dataset_version: string;
  snapshot: SiteSnapshot;
  x: number;
  z: number;
  scanned_at: string;
}

export interface SiteSnapshot {
  datasetVersion: string;
  siteId: string;
  name: string;
  category: string;
  description: string;
  attributes: { label: string; value: number; unit: string }[];
  interpretation: string;
  source: "simulated-predefined-dataset";
}

/** Versioned copy of the trusted site data, frozen into the observation row. */
export function siteSnapshot(site: GeoSite, datasetVersion: string): SiteSnapshot {
  return {
    datasetVersion,
    siteId: site.id,
    name: site.name,
    category: site.category,
    description: site.description,
    attributes: site.attributes.map((a) => ({ ...a })),
    interpretation: site.interpretation,
    source: "simulated-predefined-dataset",
  };
}

export function requireDestination(v: unknown): DestinationId {
  if (v === "mars" || v === "moon") return v;
  throw new DomainError("UNSUPPORTED_DESTINATION");
}
