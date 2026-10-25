import { createClient } from "@/lib/supabase/server";
import { getActor } from "@/server/auth";
import { assertSameOrigin, handle, ok } from "@/server/http";
import { sessions } from "@/server/sessions/service";

// Safe logout: end the active session (if any) before signing out.
export async function POST(req: Request) {
  return handle("logout", async () => {
    assertSameOrigin(req);
    const actor = await getActor();
    if (actor) {
      try {
        const snap = await sessions.snapshot(actor.id);
        if (snap.session?.status === "ACTIVE") await sessions.stop(actor.id, snap.session.id, null, null);
      } catch (e) {
        console.error("[lunara] logout stop failed; lease cutoff applies", (e as Error).message);
      }
    }
    const supabase = await createClient();
    await supabase.auth.signOut();
    return ok({ ok: true });
  });
}
