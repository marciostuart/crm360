import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteMasterSession, MASTER_SESSION_COOKIE } from "@/lib/auth/master-session";

export async function POST() {
  const store = await cookies();
  await deleteMasterSession(store.get(MASTER_SESSION_COOKIE)?.value);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(MASTER_SESSION_COOKIE);
  return response;
}
