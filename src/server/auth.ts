import "server-only";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DomainError } from "@/server/http";

export interface Actor {
  id: string;
  email: string | null;
}

/** Verifies the user with Supabase Auth (not just the cookie) and returns the actor. */
export async function getActor(): Promise<Actor | null> {
  await connection(); // per-request: never prerender auth-dependent output
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw new DomainError("UNAUTHENTICATED");
  return actor;
}
