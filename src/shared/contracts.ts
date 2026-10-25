// Shared DTOs, runtime validators and error vocabulary (client + server safe).
import { z } from "zod";

export type SessionStatus = "ACTIVE" | "ENDED" | "INTERRUPTED" | "EXPIRED";
export type PurchaseStatus = "PENDING" | "CREDITED" | "UNPAID" | "CHECKOUT_EXPIRED";

export interface SessionSnapshot {
  id: string;
  destinationId: "mars" | "moon";
  status: SessionStatus;
  startedAt: number;
  accountedThrough: number;
  leaseDeadline: number;
  authorizedUntil: number | null;
  endedAt: number | null;
  endReason: string | null;
  consumedMs: number;
  controllerGeneration: number;
  heartbeatSeq: number;
  distanceMu: number;
  sampledMs: number;
  scannedSites: string[];
}

export interface AccountSnapshot {
  serverNow: number;
  /** Legacy: balance of the session destination (Mars when no session). Prefer balances. */
  balanceMs: number;
  balances: Partial<Record<"mars" | "moon", number>>;
  accountRevision: number;
  session: SessionSnapshot | null;
  replayed?: boolean;
}

export interface PackageDTO {
  id: string;
  destinationId: "mars" | "moon";
  label: string;
  durationMs: number;
  amountMinor: number;
  currency: string;
}

export interface PurchaseDTO {
  id: string;
  destinationId: "mars" | "moon";
  packageId: string;
  status: PurchaseStatus;
  durationMs: number;
  amountMinor: number;
  currency: string;
  createdAt: string;
  creditedAt: string | null;
}

export interface SessionPolicy {
  heartbeatMs: number;
  leaseMs: number;
}

export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN_ORIGIN",
  "VALIDATION_FAILED",
  "NOT_FOUND",
  "SESSION_NOT_FOUND",
  "PURCHASE_NOT_FOUND",
  "SESSION_ALREADY_ACTIVE",
  "INSUFFICIENT_BALANCE",
  "UNSUPPORTED_DESTINATION",
  "STALE_CONTROLLER",
  "START_KEY_REUSED",
  "REQUEST_KEY_REUSED",
  "PACKAGE_UNAVAILABLE",
  "CHECKOUT_MISMATCH",
  "PAYMENT_PROVIDER_UNAVAILABLE",
  "SERVICE_UNAVAILABLE",
  "SESSION_NOT_ACTIVE",
  "SESSION_NOT_CLOSED",
  "WRONG_DESTINATION",
  "OUT_OF_RANGE",
  "IMPLAUSIBLE_POSITION",
  "UNKNOWN_SITE",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiError {
  error: { code: ErrorCode; message: string; requestId: string };
}

const uuid = z.string().uuid();
const token = z.string().regex(/^[0-9a-f]{64}$/, "controller token must be 64 hex chars");

const coord = z.number().finite().min(-100000).max(100000);

/** Idempotent telemetry checkpoint: cumulative totals within a client segment. */
export const telemetryInput = z.object({
  segment: uuid,
  dist: z.number().finite().min(0).max(1e7),
  ms: z.number().int().min(0).max(1e10),
  x: coord,
  z: coord,
  heading: z.number().finite().min(-1e4).max(1e4),
});
export type TelemetryInput = z.infer<typeof telemetryInput>;

export const startSessionInput = z.object({
  destinationId: z.enum(["mars", "moon"]),
  requestKey: uuid,
  controllerToken: token,
});
export const heartbeatInput = z.object({
  controllerToken: token,
  generation: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  seq: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  telemetry: telemetryInput.optional(),
});
export const takeoverInput = z.object({
  expectedGeneration: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  controllerToken: token,
  takeoverKey: uuid,
});
export const stopInput = z.object({
  controllerToken: token,
  generation: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  telemetry: telemetryInput.optional(),
});
export const scanInput = z.object({
  controllerToken: token,
  generation: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  siteId: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  x: coord,
  z: coord,
});
export const checkoutInput = z.object({
  packageId: z.string().min(1).max(64),
  requestKey: uuid,
});

export function formatPrice(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat(currency.toLowerCase() === "usd" ? "en-US" : "en-IE", { style: "currency", currency: currency.toUpperCase() }).format(
    amountMinor / 100,
  );
}

export function formatDuration(ms: number): string {
  const min = Math.round(ms / 60000);
  return min === 1 ? "1 minute" : `${min} minutes`;
}
