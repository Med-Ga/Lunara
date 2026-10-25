import "server-only";
import { createHash } from "node:crypto";
import type { AccountSnapshot } from "@/shared/contracts";
import { rpc } from "@/server/db";
import { serverEnv } from "@/server/env";

/** Only hashes of controller tokens are stored or compared server-side. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function policy() {
  return { heartbeatMs: serverEnv.heartbeatMs, leaseMs: serverEnv.leaseMs };
}

export const sessions = {
  snapshot: (userId: string) => rpc<AccountSnapshot>("lunara_account_snapshot", { p_user: userId }),

  start: (userId: string, requestKey: string, token: string) =>
    rpc<AccountSnapshot>("lunara_start_session", {
      p_user: userId,
      p_destination: "mars",
      p_request_key: requestKey,
      p_controller_hash: hashToken(token),
      p_lease_ms: serverEnv.leaseMs,
    }),

  heartbeat: (userId: string, sessionId: string, token: string, generation: number, seq: number) =>
    rpc<AccountSnapshot>("lunara_heartbeat", {
      p_user: userId,
      p_session: sessionId,
      p_controller_hash: hashToken(token),
      p_generation: generation,
      p_seq: seq,
      p_lease_ms: serverEnv.leaseMs,
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

  stop: (userId: string, sessionId: string, token: string | null, generation: number | null) =>
    rpc<AccountSnapshot>("lunara_stop_session", {
      p_user: userId,
      p_session: sessionId,
      p_controller_hash: token ? hashToken(token) : null,
      p_generation: generation,
    }),
};
