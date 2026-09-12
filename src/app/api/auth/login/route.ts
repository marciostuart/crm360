import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { z } from "zod";
import { db, type DbRow } from "@/lib/db";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });

  const [rows] = await db().execute<DbRow[]>(
    `SELECT u.id, u.tenant_id, u.password_hash, u.status, u.locked_until,
            t.status AS tenant_status
       FROM users u JOIN tenants t ON t.id = u.tenant_id
      WHERE u.email = ? LIMIT 1`,
    [parsed.data.email],
  );
  const user = rows[0];
  const genericError = () => NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  if (!user || user.status !== "active" || !["trial", "active"].includes(String(user.tenant_status))) return genericError();
  if (user.locked_until && new Date(String(user.locked_until)).getTime() > Date.now()) return genericError();

  const passwordOk = await compare(parsed.data.password, String(user.password_hash));
  if (!passwordOk) {
    await db().execute(
      `UPDATE users
          SET failed_login_attempts = failed_login_attempts + 1,
              locked_until = CASE WHEN failed_login_attempts + 1 >= 5
                                  THEN DATE_ADD(NOW(3), INTERVAL 15 MINUTE)
                                  ELSE locked_until END
        WHERE id = ?`,
      [Number(user.id)],
    );
    return genericError();
  }

  await db().execute("UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW(3) WHERE id = ?", [Number(user.id)]);
  const token = await createSession(Number(user.id), Number(user.tenant_id));
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}
