import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { db, type DbRow } from "@/lib/db";
import { hashSessionToken } from "@/lib/crypto";

export const SESSION_COOKIE = "m7_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

export type CurrentSession = {
  userId: number;
  tenantId: number;
  userName: string;
  userEmail: string;
  role: string;
  tenantName: string;
  brandColor: string;
  hasLogo: boolean;
  brandingUpdatedAt: string;
};

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export async function createSession(userId: number, tenantId: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  await db().execute(
    `INSERT INTO sessions (token_hash, user_id, tenant_id, expires_at)
     VALUES (?, ?, ?, DATE_ADD(NOW(3), INTERVAL 12 HOUR))`,
    [tokenHash, userId, tenantId],
  );
  return token;
}

export async function deleteSession(token: string | undefined): Promise<void> {
  if (!token) return;
  await db().execute("DELETE FROM sessions WHERE token_hash = ?", [hashSessionToken(token)]);
}

export async function getCurrentSession(): Promise<CurrentSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [rows] = await db().execute<DbRow[]>(
    `SELECT s.user_id, s.tenant_id, u.name AS user_name, u.email AS user_email,
            u.role, t.name AS tenant_name,
            COALESCE(t.brand_color, '#344a99') AS brand_color,
            (t.logo_data IS NOT NULL) AS has_logo,
            COALESCE(DATE_FORMAT(t.logo_updated_at, '%Y%m%d%H%i%s'), 'default') AS branding_updated_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id AND u.tenant_id = s.tenant_id
       JOIN tenants t ON t.id = s.tenant_id
      WHERE s.token_hash = ? AND s.expires_at > NOW(3)
        AND u.status = 'active' AND t.status IN ('trial', 'active')
      LIMIT 1`,
    [hashSessionToken(token)],
  );
  const row = rows[0];
  if (!row) return null;
  await db().execute("UPDATE sessions SET last_seen_at = NOW(3) WHERE token_hash = ?", [hashSessionToken(token)]);
  return {
    userId: Number(row.user_id),
    tenantId: Number(row.tenant_id),
    userName: String(row.user_name),
    userEmail: String(row.user_email),
    role: String(row.role),
    tenantName: String(row.tenant_name),
    brandColor: String(row.brand_color),
    hasLogo: Boolean(row.has_logo),
    brandingUpdatedAt: String(row.branding_updated_at),
  };
}
