import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

export type AccountTokenPurpose = "verify_email" | "reset_password";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueAccountToken(userId: number, purpose: AccountTokenPurpose, hours: number) {
  const token = randomBytes(32).toString("base64url");
  await db().execute("DELETE FROM account_action_tokens WHERE user_id = ? AND purpose = ? AND used_at IS NULL", [userId, purpose]);
  await db().execute("INSERT INTO account_action_tokens (user_id, purpose, token_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(3), INTERVAL ? HOUR))", [userId, purpose, hashToken(token), hours]);
  return token;
}

export async function consumeAccountToken(token: string, purpose: AccountTokenPurpose) {
  const connection = await db().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<any[]>("SELECT id, user_id FROM account_action_tokens WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > NOW(3) FOR UPDATE", [hashToken(token), purpose]);
    const row = rows[0];
    if (!row) { await connection.rollback(); return null; }
    await connection.execute("UPDATE account_action_tokens SET used_at = NOW(3) WHERE id = ?", [Number(row.id)]);
    await connection.commit();
    return { userId: Number(row.user_id) };
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}
