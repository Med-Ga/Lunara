import "server-only";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import type { ErrorCode } from "@/shared/contracts";
import { serverEnv } from "@/server/env";

const STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN_ORIGIN: 403,
  VALIDATION_FAILED: 422,
  NOT_FOUND: 404,
  SESSION_NOT_FOUND: 404,
  PURCHASE_NOT_FOUND: 404,
  SESSION_ALREADY_ACTIVE: 409,
  INSUFFICIENT_BALANCE: 409,
  UNSUPPORTED_DESTINATION: 422,
  STALE_CONTROLLER: 409,
  START_KEY_REUSED: 409,
  REQUEST_KEY_REUSED: 409,
  PACKAGE_UNAVAILABLE: 409,
  CHECKOUT_MISMATCH: 409,
  PAYMENT_PROVIDER_UNAVAILABLE: 503,
  SERVICE_UNAVAILABLE: 503,
};

const MESSAGES: Partial<Record<ErrorCode, string>> = {
  UNAUTHENTICATED: "Please log in again.",
  SESSION_ALREADY_ACTIVE: "An exploration session is already active on this account.",
  INSUFFICIENT_BALANCE: "You have no exploration time left. Buy a package to continue.",
  STALE_CONTROLLER: "This tab no longer controls the session.",
  PACKAGE_UNAVAILABLE: "That package is not available.",
  PAYMENT_PROVIDER_UNAVAILABLE: "The payment provider could not be reached. Nothing was charged or credited.",
  SERVICE_UNAVAILABLE: "The service is temporarily unavailable. Please retry.",
};

export class DomainError extends Error {
  constructor(
    public code: ErrorCode,
    message?: string,
  ) {
    super(message ?? code);
  }
}

const NO_STORE = { "Cache-Control": "private, no-store" };

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

export function fail(code: ErrorCode, message?: string) {
  const requestId = crypto.randomUUID();
  return NextResponse.json(
    { error: { code, message: message ?? MESSAGES[code] ?? code, requestId } },
    { status: STATUS[code], headers: NO_STORE },
  );
}

/** Wraps a handler: maps domain errors to safe responses and logs the rest without secrets. */
export async function handle(op: string, fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof DomainError) return fail(e.code);
    const requestId = crypto.randomUUID();
    console.error(`[lunara] ${op} failed requestId=${requestId}`, e instanceof Error ? e.message : "unknown");
    return NextResponse.json(
      { error: { code: "SERVICE_UNAVAILABLE", message: MESSAGES.SERVICE_UNAVAILABLE, requestId } },
      { status: 503, headers: NO_STORE },
    );
  }
}

/** Same-origin check for cookie-authenticated mutations (CSRF defense). */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  const allowed = new Set([serverEnv.appOrigin]);
  if (host) {
    allowed.add(`https://${host}`);
    allowed.add(`http://${host}`);
  }
  if (!origin || !allowed.has(origin)) throw new DomainError("FORBIDDEN_ORIGIN");
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const text = await req.text();
  if (text.length > 4096) throw new DomainError("VALIDATION_FAILED");
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new DomainError("VALIDATION_FAILED");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new DomainError("VALIDATION_FAILED");
  return parsed.data;
}
