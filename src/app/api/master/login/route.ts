import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { z } from "zod";
import { db, type DbRow } from "@/lib/db";
import { createMasterSession, MASTER_SESSION_COOKIE, masterSessionCookieOptions } from "@/lib/auth/master-session";
import { isSameOrigin } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(1).max(128) });
const genericError = () => NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return genericError();
  try {
    const [rows] = await db().execute<DbRow[]>("SELECT id, password_hash, status, locked_until FROM platform_admins WHERE email = ? LIMIT 1", [parsed.data.email]);
    const admin = rows[0];
    if (!admin || String(admin.status) !== "active" || (admin.locked_until && new Date(String(admin.locked_until)).getTime() > Date.now())) return genericError();
    if (!await compare(parsed.data.password, String(admin.password_hash))) {
      await db().execute(
        `UPDATE platform_admins SET failed_login_attempts = failed_login_attempts + 1,
         locked_until = CASE WHEN failed_login_attempts + 1 >= 5 THEN DATE_ADD(NOW(3), INTERVAL 15 MINUTE) ELSE locked_until END WHERE id = ?`,
        [Number(admin.id)],
      );
      return genericError();
    }
    await db().execute("UPDATE platform_admins SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW(3) WHERE id = ?", [Number(admin.id)]);
    const token = await createMasterSession(Number(admin.id));
    const response = NextResponse.json({ ok: true });
    response.cookies.set(MASTER_SESSION_COOKIE, token, masterSessionCookieOptions());
    return response;
  } catch {
    return NextResponse.json({ error: "Painel Master indisponível até a migração de segurança ser aplicada." }, { status: 503 });
  }
}
