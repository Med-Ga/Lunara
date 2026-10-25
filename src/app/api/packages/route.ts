import { connection } from "next/server";
import { listPackages } from "@/server/db";
import { handle, ok } from "@/server/http";


export async function GET() {
  await connection();
  return handle("packages", async () => ok({ packages: await listPackages(), testMode: true }));
}
