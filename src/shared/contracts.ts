// Shared DTOs, runtime validators and error vocabulary (client + server safe).
import { z } from "zod";

export type SessionStatus = "ACTIVE" | "ENDED" | "INTERRUPTED" | "EXPIRED";
export type PurchaseStatus = "PENDING" | "CREDITED" | "UNPAID" | "CHECKOUT_EXPIRED";

export interface SessionSnapshot {
  id: string;
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
}

export interface AccountSnapshot {
  serverNow: number;
  balanceMs: number;
  accountRevision: number;
  session: SessionSnapshot | null;
  replayed?: boolean;
}

export interface PackageDTO {
  id: string;
  label: string;
  durationMs: number;
  amountMinor: number;
  currency: string;
}

export interface PurchaseDTO {
  id: string;
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
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiError {
  error: { code: ErrorCode; message: string; requestId: string };
}

const uuid = z.string().uuid();
const token = z.string().regex(/^[0-9a-f]{64}$/, "controller token must be 64 hex chars");

export const startSessionInput = z.object({
  destinationId: z.literal("mars"),
  requestKey: uuid,
  controllerToken: token,
});
export const heartbeatInput = z.object({
  controllerToken: token,
  generation: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  seq: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
});
export const takeoverInput = z.object({
  expectedGeneration: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  controllerToken: token,
  takeoverKey: uuid,
});
export const stopInput = z.object({
  controllerToken: token,
  generation: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
});
export const checkoutInput = z.object({
  packageId: z.string().min(1).max(64),
  requestKey: uuid,
});

export function formatPrice(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: currency.toUpperCase() }).format(
    amountMinor / 100,
  );
}

export function formatDuration(ms: number): string {
  const min = Math.round(ms / 60000);
  return min === 1 ? "1 minute" : `${min} minutes`;
}
