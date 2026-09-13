import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteSession, SESSION_COOKIE, getCurrentSession } from "@/lib/auth/session";
import { getMasterSession } from "@/lib/auth/master-session";
import { isSameOrigin } from "@/lib/http";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
  if (!await getMasterSession()) return NextResponse.json({ error: "Sessão Master inválida." }, { status: 401 });
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const tenantSession = await getCurrentSession();
  if (token && tenantSession?.isImpersonating) await deleteSession(token);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
