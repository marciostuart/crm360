import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { db, type DbRow } from "@/lib/db";
import { hashSessionToken } from "@/lib/crypto";

export const MASTER_SESSION_COOKIE = "crm360_master_session";
const MASTER_SESSION_TTL_SECONDS = 60 * 60 * 8;

export type MasterSession = { id: number; name: string; email: string };

export function masterSessionCookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/", maxAge: MASTER_SESSION_TTL_SECONDS };
}

export async function createMasterSession(adminId: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db().execute("INSERT INTO platform_admin_sessions (token_hash, platform_admin_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(3), INTERVAL 8 HOUR))", [hashSessionToken(token), adminId]);
  return token;
}

export async function deleteMasterSession(token: string | undefined) {
  if (token) await db().execute("DELETE FROM platform_admin_sessions WHERE token_hash = ?", [hashSessionToken(token)]);
}

export async function getMasterSession(): Promise<MasterSession | null> {
  const token = (await cookies()).get(MASTER_SESSION_COOKIE)?.value;
  if (!token) return null;
  const [rows] = await db().execute<DbRow[]>(
    `SELECT p.id, p.name, p.email
       FROM platform_admin_sessions s JOIN platform_admins p ON p.id = s.platform_admin_id
      WHERE s.token_hash = ? AND s.expires_at > NOW(3) AND p.status = 'active' LIMIT 1`,
    [hashSessionToken(token)],
  );
  const row = rows[0];
  if (!row) return null;
  await db().execute("UPDATE platform_admin_sessions SET last_seen_at = NOW(3) WHERE token_hash = ?", [hashSessionToken(token)]);
  return { id: Number(row.id), name: String(row.name), email: String(row.email) };
}
