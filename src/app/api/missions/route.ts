import { connection } from "next/server";
import { z } from "zod";
import { requireActor } from "@/server/auth";
import { DomainError, handle, ok } from "@/server/http";
import { listMissions } from "@/server/missions/service";

// Owned mission archive, newest first, bounded pages (cursor = startedAt of the last item).
export async function GET(req: Request) {
  await connection();
  return handle("missions.list", async () => {
    const actor = await requireActor();
    const before = new URL(req.url).searchParams.get("before");
    if (before && !z.string().regex(/^\d{10,14}$/).safeParse(before).success) throw new DomainError("VALIDATION_FAILED");
    const items = await listMissions(actor, before ? new Date(Number(before)).toISOString() : null, 10);
    return ok({ missions: items, nextBefore: items.length === 10 ? items[items.length - 1].startedAt : null });
  });
}
