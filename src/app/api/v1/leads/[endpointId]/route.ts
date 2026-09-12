import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db, withTransaction, type DbRow } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { leadPayloadSchema, normalizePhone } from "@/lib/leads/schema";
import { verifyLeadSignature } from "@/lib/webhooks/hmac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ endpointId: string }> };

function error(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: Request, context: RouteContext) {
  const { endpointId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(endpointId)) return error("Endpoint inválido.", 404);
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 64 * 1024) return error("Payload muito grande.", 413);

  const [endpoints] = await db().execute<DbRow[]>(
    `SELECT id, tenant_id, secret_ciphertext FROM lead_webhook_endpoints
      WHERE endpoint_id = ? AND active = TRUE LIMIT 1`,
    [endpointId],
  );
  const endpoint = endpoints[0];
  if (!endpoint) return error("Endpoint não encontrado.", 404);

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > 64 * 1024) return error("Payload muito grande.", 413);
  let secret: string;
  try {
    secret = decryptSecret(String(endpoint.secret_ciphertext));
  } catch {
    return error("Endpoint indisponível.", 503);
  }

  const validSignature = verifyLeadSignature(rawBody, {
    timestamp: request.headers.get("x-m7-timestamp"),
    nonce: request.headers.get("x-m7-nonce"),
    signature: request.headers.get("x-m7-signature"),
  }, secret);
  if (!validSignature) return error("Assinatura inválida.", 401);

  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length > 191) return error("Idempotency-Key obrigatório.", 422);
  let jsonBody: unknown;
  try {
    jsonBody = JSON.parse(rawBody);
  } catch {
    return error("Payload JSON inválido.", 422);
  }
  const parsed = leadPayloadSchema.safeParse(jsonBody);
  if (!parsed.success) return error("Payload de lead inválido.", 422);
  const payload = parsed.data;
  const phone = normalizePhone(payload.phone);
  if (phone.length < 8 || phone.length > 20) return error("Telefone inválido.", 422);

  try {
    const result = await withTransaction(async (connection) => {
      const [existingRows] = await connection.execute<DbRow[]>(
        "SELECT id FROM lead_webhook_events WHERE endpoint_id = ? AND idempotency_key = ? FOR UPDATE",
        [Number(endpoint.id), idempotencyKey],
      );
      if (existingRows[0]) return { duplicate: true };

      const [contacts] = await connection.execute<DbRow[]>(
        `SELECT id FROM contacts WHERE tenant_id = ? AND (phone = ? OR (? IS NOT NULL AND external_id = ?))
         ORDER BY CASE WHEN phone = ? THEN 0 ELSE 1 END LIMIT 1 FOR UPDATE`,
        [Number(endpoint.tenant_id), phone, payload.external_id ?? null, payload.external_id ?? null, phone],
      );
      let contactId: number;
      if (contacts[0]) {
        contactId = Number(contacts[0].id);
        await connection.execute(
          `UPDATE contacts SET name = ?, phone = ?, email = COALESCE(?, email),
              external_id = COALESCE(?, external_id), source = COALESCE(?, source),
              notes = COALESCE(?, notes), custom_fields = COALESCE(?, custom_fields)
            WHERE id = ? AND tenant_id = ?`,
          [payload.name, phone, payload.email ?? null, payload.external_id ?? null, payload.source ?? null,
            payload.notes ?? null, payload.custom_fields ? JSON.stringify(payload.custom_fields) : null,
            contactId, Number(endpoint.tenant_id)],
        );
      } else {
        const [inserted] = await connection.execute<any>(
          `INSERT INTO contacts (tenant_id, external_id, name, phone, email, source, notes, custom_fields)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [Number(endpoint.tenant_id), payload.external_id ?? null, payload.name, phone, payload.email ?? null,
            payload.source ?? null, payload.notes ?? null, payload.custom_fields ? JSON.stringify(payload.custom_fields) : null],
        );
        contactId = Number(inserted.insertId);
      }

      await connection.execute(
        `INSERT INTO lead_webhook_events (endpoint_id, tenant_id, idempotency_key, external_id, payload, status)
         VALUES (?, ?, ?, ?, ?, 'accepted')`,
        [Number(endpoint.id), Number(endpoint.tenant_id), idempotencyKey, payload.external_id ?? null, JSON.stringify({ ...payload, phone })],
      );
      return { duplicate: false, contactId, eventId: randomUUID() };
    });
    if (result.duplicate) return NextResponse.json({ ok: true, duplicate: true });
    return NextResponse.json({ ok: true, contact_id: result.contactId }, { status: 202 });
  } catch {
    return error("Não foi possível processar o lead.", 500);
  }
}
