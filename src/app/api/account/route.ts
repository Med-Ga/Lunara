import { connection } from "next/server";
import { requireActor } from "@/server/auth";
import { handle, ok } from "@/server/http";
import { policy, sessions } from "@/server/sessions/service";


// Effective balance + session status. Reconciles, never extends a lease.
export async function GET() {
  await connection();
  return handle("account", async () => {
    const actor = await requireActor();
    const snap = await sessions.snapshot(actor.id);
    return ok({ ...snap, policy: policy(), email: actor.email });
  });
}
