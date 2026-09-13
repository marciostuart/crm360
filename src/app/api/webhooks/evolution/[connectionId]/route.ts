import { NextResponse } from "next/server";
import { db, type DbRow } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { constantTimeEqual } from "@/lib/webhooks/hmac";
import { normalizeEvolutionMessages } from "@/lib/evolution/message";
import { apiError } from "@/lib/request";
import { withTransaction } from "@/lib/db";
import { centralRateLimit } from "@/lib/security/central-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ connectionId: string }> };

export async function POST(request: Request, context: Context) {
  const connectionId = (await context.params).connectionId;
  if (!/^[0-9a-f-]{36}$/i.test(connectionId)) return apiError("Conexão inválida.", 404);
  const suppliedSecret = request.headers.get("x-m7-evolution-token") ?? "";
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 256 * 1024) return apiError("Payload muito grande.", 413);
  if (!suppliedSecret || suppliedSecret.length > 200) return apiError("Não autorizado.", 401);
  const [connections] = await db().execute<DbRow[]>(
    "SELECT id, tenant_id, instance_name, webhook_secret_ciphertext FROM evolution_connections WHERE public_id = ? LIMIT 1",
    [connectionId],
  );
  const connection = connections[0];
  if (!connection) return apiError("Conexão não encontrada.", 404);
  try {
    if (!constantTimeEqual(suppliedSecret, decryptSecret(String(connection.webhook_secret_ciphertext)))) return apiError("Não autorizado.", 401);
  } catch { return apiError("Não autorizado.", 401); }

  const limited = await centralRateLimit(request, `evolution:${connectionId}`, 300, 60_000);
  if (!limited.allowed) return apiError("Muitas requisições. Aguarde.", 429);
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > 256 * 1024) return apiError("Payload muito grande.", 413);
  let payload: Record<string, any> | null = null;
  try { payload = JSON.parse(rawBody); } catch { return apiError("Payload invÃ¡lido.", 422); }
  if (!payload || typeof payload !== "object") return apiError("Payload inválido.", 422);
  const event = String(payload.event ?? payload.type ?? "").toLowerCase().replace(/[._-]/g, "");
  if (event.includes("connectionupdate")) {
    const state = String(payload.data?.state ?? payload.data?.instance?.state ?? "unknown").toLowerCase();
    await db().execute("UPDATE evolution_connections SET status = ? WHERE id = ? AND tenant_id = ?", [state.slice(0, 40), Number(connection.id), Number(connection.tenant_id)]);
    return NextResponse.json({ ok: true });
  }
  if (!event.includes("messagesupsert") && !event.includes("messagesupdate") && !event.includes("messages")) return NextResponse.json({ ok: true, ignored: true });

  const messages = normalizeEvolutionMessages(payload);
  try {
    const saved = await withTransaction(async (transaction) => {
      let count = 0;
      for (const message of messages) {
        const [contactResult] = await transaction.execute<any>(
          `INSERT INTO contacts (tenant_id, name, phone, source)
           VALUES (?, ?, ?, 'whatsapp')
           ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), name = IF(VALUES(name) <> '', VALUES(name), name)`,
          [Number(connection.tenant_id), message.contactName, message.phone],
        );
        const contactId = Number(contactResult.insertId || contactResult?.insertId);
        if (!contactId) continue;
        const [conversationResult] = await transaction.execute<any>(
          `INSERT INTO conversations (tenant_id, contact_id, evolution_connection_id, status, last_message_at)
           VALUES (?, ?, ?, 'open', NOW(3))
           ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), updated_at = NOW(3)`,
          [Number(connection.tenant_id), contactId, Number(connection.id)],
        );
        const conversationId = Number(conversationResult.insertId || conversationResult?.insertId);
        if (!conversationId) continue;
        const [insertResult] = await transaction.execute<any>(
          `INSERT IGNORE INTO messages (conversation_id, external_message_id, direction, type, content)
           VALUES (?, ?, ?, ?, ?)`,
          [conversationId, message.externalId, message.fromMe ? "outbound" : "inbound", message.type, message.content.slice(0, 10000)],
        );
        if (insertResult.affectedRows) {
          await transaction.execute(
            `UPDATE conversations SET last_message_at = NOW(3), unread_count = unread_count + ?
             WHERE id = ? AND tenant_id = ?`,
            [message.fromMe ? 0 : 1, conversationId, Number(connection.tenant_id)],
          );
          count++;
        }
      }
      return count;
    });
    return NextResponse.json({ ok: true, saved });
  } catch {
    return apiError("Não foi possível processar o evento.", 500);
  }
}
