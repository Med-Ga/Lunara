import { z } from "zod";
import { scanInput } from "@/shared/contracts";
import { findSite } from "@/config/destinations";
import { requireActor } from "@/server/auth";
import { assertSameOrigin, DomainError, handle, ok, parseBody } from "@/server/http";
import { sessions } from "@/server/sessions/service";

// Persist a geological scan for the caller's ACTIVE session. Site facts come from the
// server dataset; the browser supplies only the site id and its current position.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle("session.scan", async () => {
    assertSameOrigin(req);
    const actor = await requireActor();
    const { id } = await ctx.params;
    if (!z.string().uuid().safeParse(id).success) throw new DomainError("SESSION_NOT_FOUND");
    const input = await parseBody(req, scanInput);
    const site = findSite(input.siteId);
    if (!site) throw new DomainError("UNKNOWN_SITE");
    const res = await sessions.recordObservation(actor.id, id, input.controllerToken, input.generation, site, input.x, input.z);
    return ok({ outcome: res.outcome, siteId: res.observation.site_id, scannedAt: res.observation.scanned_at });
  });
}
