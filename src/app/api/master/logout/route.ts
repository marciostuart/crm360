import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteMasterSession, MASTER_SESSION_COOKIE } from "@/lib/auth/master-session";
import { isSameOrigin } from "@/lib/http";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
  const store = await cookies();
  await deleteMasterSession(store.get(MASTER_SESSION_COOKIE)?.value);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(MASTER_SESSION_COOKIE);
  return response;
}
