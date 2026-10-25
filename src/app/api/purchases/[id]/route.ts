import { z } from "zod";
import { requireActor } from "@/server/auth";
import { getOwnedPurchase, toPurchaseDTO } from "@/server/db";
import { DomainError, handle, ok } from "@/server/http";


// Owned purchase status from the database only (no provider call).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle("purchase.get", async () => {
    const actor = await requireActor();
    const { id } = await ctx.params;
    if (!z.string().uuid().safeParse(id).success) throw new DomainError("PURCHASE_NOT_FOUND");
    const p = await getOwnedPurchase(actor.id, id);
    if (!p) throw new DomainError("PURCHASE_NOT_FOUND");
    return ok({ purchase: toPurchaseDTO(p) });
  });
}
