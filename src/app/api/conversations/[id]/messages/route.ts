import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db, type DbRow, withTransaction } from "@/lib/db";
import { requireSession } from "@/lib/auth/require-session";
import { messageInputSchema } from "@/lib/conversation/schema";
import { sendText } from "@/lib/evolution/client";
import { apiError, jsonBody, positiveId } from "@/lib/request";
import { isSameOrigin } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const id = positiveId((await context.params).id); if (!id) return apiError("Conversa inválida.", 400);
  try {
    const session = await requireSession();
    const [conversations] = await db().execute<DbRow[]>("SELECT id FROM conversations WHERE id = ? AND tenant_id = ?", [id, session.tenantId]);
    if (!conversations[0]) return apiError("Conversa não encontrada.", 404);
    const [messages] = await db().execute<DbRow[]>("SELECT id, external_message_id, direction, type, content, media_url, created_at FROM messages WHERE conversation_id = ? ORDER BY id ASC LIMIT 500", [id]);
    await db().execute("UPDATE conversations SET unread_count = 0 WHERE id = ? AND tenant_id = ?", [id, session.tenantId]);
    return NextResponse.json({ ok: true, messages });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    return apiError(unauthorized ? "Não autorizado." : "Não foi possível carregar mensagens.", unauthorized ? 401 : 500);
  }
}

export async function POST(request: Request, context: Context) {
  if (!isSameOrigin(request)) return apiError("Origem não autorizada.", 403);
  const id = positiveId((await context.params).id); if (!id) return apiError("Conversa inválida.", 400);
  try {
    const session = await requireSession();
    const parsed = messageInputSchema.safeParse(await jsonBody(request));
    if (!parsed.success) return apiError("Mensagem inválida.", 422);
    const [rows] = await db().execute<DbRow[]>(
      `SELECT c.id, ct.phone, ec.instance_name, ec.instance_token_ciphertext
         FROM conversations c JOIN contacts ct ON ct.id = c.contact_id AND ct.tenant_id = c.tenant_id
         JOIN evolution_connections ec ON ec.id = c.evolution_connection_id AND ec.tenant_id = c.tenant_id
        WHERE c.id = ? AND c.tenant_id = ? LIMIT 1`,
      [id, session.tenantId],
    );
    if (!rows[0]) return apiError("Conversa sem conexão válida.", 422);
    let response: any;
    try { response = await sendText(String(rows[0].instance_name), String(rows[0].phone), parsed.data.content); }
    catch { return apiError("A Evolution API não aceitou a mensagem.", 502); }
    const externalId = String(response?.key?.id ?? response?.message?.key?.id ?? response?.id ?? `out_${randomUUID()}`);
    await withTransaction(async (transaction) => {
      await transaction.execute("INSERT IGNORE INTO messages (conversation_id, external_message_id, direction, type, content) VALUES (?, ?, 'outbound', 'text', ?)", [id, externalId, parsed.data.content]);
      await transaction.execute("UPDATE conversations SET last_message_at = NOW(3), updated_at = NOW(3) WHERE id = ? AND tenant_id = ?", [id, session.tenantId]);
    });
    return NextResponse.json({ ok: true, external_message_id: externalId }, { status: 201 });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    return apiError(unauthorized ? "Não autorizado." : "Não foi possível enviar a mensagem.", unauthorized ? 401 : 500);
  }
}
