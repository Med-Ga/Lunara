import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { ERROR_CODES, type ErrorCode } from "@/shared/contracts";
import { DomainError } from "@/server/http";

/** Calls a lunara_* SQL function. Known domain exceptions become DomainErrors. */
export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await createAdminClient().rpc(fn, args);
  if (error) {
    const code = error.message as ErrorCode;
    if ((ERROR_CODES as readonly string[]).includes(code)) throw new DomainError(code);
    throw new Error(`rpc ${fn}: ${error.code ?? ""} ${error.message}`);
  }
  return data as T;
}

export async function listPackages() {
  const { data, error } = await createAdminClient()
    .from("packages")
    .select("id,destination_id,label,duration_ms,amount_minor,currency")
    .eq("active", true)
    .not("stripe_price_id", "is", null)
    .order("sort_order");
  if (error) throw new Error(`packages: ${error.message}`);
  return (data ?? []).map((p) => ({
    id: p.id as string,
    destinationId: p.destination_id as "mars" | "moon",
    label: p.label as string,
    durationMs: Number(p.duration_ms),
    amountMinor: Number(p.amount_minor),
    currency: p.currency as string,
  }));
}

interface PurchaseRow {
  id: string;
  user_id: string;
  package_id: string;
  destination_id: "mars" | "moon";
  status: string;
  stripe_checkout_id: string | null;
  checkout_url: string | null;
  expected_duration_ms: number;
  expected_amount_minor: number;
  expected_currency: string;
  expected_price_id: string;
  created_at: string;
  credited_at: string | null;
}

export async function getOwnedPurchase(userId: string, id: string): Promise<PurchaseRow | null> {
  const { data, error } = await createAdminClient()
    .from("purchases")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`purchase: ${error.message}`);
  return data as PurchaseRow | null;
}

export async function listOwnedPurchases(userId: string, limit = 5): Promise<PurchaseRow[]> {
  const { data, error } = await createAdminClient()
    .from("purchases")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`purchases: ${error.message}`);
  return (data ?? []) as PurchaseRow[];
}

export function toPurchaseDTO(p: PurchaseRow) {
  return {
    id: p.id,
    packageId: p.package_id,
    destinationId: p.destination_id,
    status: p.status,
    durationMs: Number(p.expected_duration_ms),
    amountMinor: Number(p.expected_amount_minor),
    currency: p.expected_currency,
    createdAt: p.created_at,
    creditedAt: p.credited_at,
  };
}

export type { PurchaseRow };
