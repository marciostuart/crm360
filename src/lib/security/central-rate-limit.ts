import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { clientIp } from "./rate-limit";

export async function centralRateLimit(request: Request, bucket: string, limit: number, windowMs: number) {
  const clientHash = createHash("sha256").update(clientIp(request)).digest("hex");
  const resetAt = new Date(Date.now() + windowMs);
  const connection = await db().getConnection();
  try {
    if (Math.random() < 0.01) await connection.execute("DELETE FROM request_rate_limits WHERE reset_at < DATE_SUB(NOW(3), INTERVAL 2 DAY)");
    await connection.execute(`INSERT INTO request_rate_limits (bucket, client_hash, request_count, reset_at) VALUES (?, ?, 1, ?) ON DUPLICATE KEY UPDATE request_count = IF(reset_at <= NOW(3), 1, request_count + 1), reset_at = IF(reset_at <= NOW(3), VALUES(reset_at), reset_at)`, [bucket, clientHash, resetAt]);
    const [rows] = await connection.execute<any[]>("SELECT request_count, reset_at FROM request_rate_limits WHERE bucket = ? AND client_hash = ?", [bucket, clientHash]);
    const row = rows[0];
    return { allowed: Number(row.request_count) <= limit, retryAfter: Math.max(1, Math.ceil((new Date(String(row.reset_at)).getTime() - Date.now()) / 1000)) };
  } finally { connection.release(); }
}
