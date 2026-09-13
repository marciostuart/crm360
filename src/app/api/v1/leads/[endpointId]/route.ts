import { NextResponse } from "next/server";
import { db, withTransaction, type DbRow } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { isValidNormalizedPhone, leadPayloadSchema, normalizePhone, phoneLookupCandidates } from "@/lib/leads/schema";
import { verifyLeadSignature } from "@/lib/webhooks/hmac";
import { mapIncomingLead, parseLeadMapping } from "@/lib/leads/mapping";
import { isAllowedSourceHost } from "@/lib/webhooks/source-host";
import { checkTenantLimit } from "@/lib/billing/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ endpointId: string }> };

function error(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function jsonValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return null; }
}

function stringArray(value: unknown): string[] {
  const parsed = jsonValue(value);
  if (!Array.isArray(parsed)) return [];
  return [...new Set(parsed.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()))].slice(0, 30);
}

export async function POST(request: Request, context: RouteContext) {
  const { endpointId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(endpointId)) return error("Endpoint inválido.", 404);
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 64 * 1024) return error("Payload muito grande.", 413);

  let endpoints: DbRow[];
  let legacySignatureMode = false;
  try {
    const [rows] = await db().execute<DbRow[]>(
      `SELECT id, tenant_id, secret_ciphertext, field_mapping, mode, tags, allowed_hosts FROM lead_webhook_endpoints
        WHERE endpoint_id = ? AND active = TRUE LIMIT 1`,
      [endpointId],
    );
    endpoints = rows;
  } catch {
    // Existing installations remain usable while the mapping migration is applied.
    legacySignatureMode = true;
    const [rows] = await db().execute<DbRow[]>(
      `SELECT id, tenant_id, secret_ciphertext FROM lead_webhook_endpoints
        WHERE endpoint_id = ? AND active = TRUE LIMIT 1`,
      [endpointId],
    );
    endpoints = rows;
  }
  const endpoint = endpoints[0];
  if (!endpoint) return error("Endpoint não encontrado.", 404);

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > 64 * 1024) return error("Payload muito grande.", 413);
  const mode = String(endpoint.mode ?? "active") === "test" ? "test" : "active";
  const hasHostPolicy = stringArray(endpoint.allowed_hosts).length > 0;

  // New endpoints use a source-domain policy. Legacy endpoints keep HMAC only until migration/configuration.
  if (legacySignatureMode || (mode === "active" && !hasHostPolicy)) {
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
  } else if (!isAllowedSourceHost(request, endpoint.allowed_hosts)) {
    return error("Domínio de origem não autorizado para este endpoint.", 403);
  }

  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length > 191) return error("Idempotency-Key obrigatório.", 422);
  const nonce = request.headers.get("x-m7-nonce")?.trim();
  if (!nonce || nonce.length > 191) return error("Nonce obrigatório.", 422);
  let jsonBody: unknown;
  try {
    jsonBody = JSON.parse(rawBody);
  } catch {
    return error("Payload JSON inválido.", 422);
  }

  const mapping = parseLeadMapping(endpoint.field_mapping);
  const endpointTags = stringArray(endpoint.tags);

  // In TESTE the authenticated-by-domain payload is only a sample. No contact is created or changed.
  if (mode === "test") {
    try {
      const result = await withTransaction(async (connection) => {
        const [existingRows] = await connection.execute<DbRow[]>(
          "SELECT id, idempotency_key, nonce FROM lead_webhook_events WHERE endpoint_id = ? AND (idempotency_key = ? OR nonce = ?) FOR UPDATE",
          [Number(endpoint.id), idempotencyKey, nonce],
        );
        const existing = existingRows[0];
        if (existing) {
          if (String(existing.idempotency_key) === idempotencyKey) return { duplicate: true, replayConflict: false };
          return { duplicate: false, replayConflict: true };
        }
        await connection.execute(
          `INSERT INTO lead_webhook_events (endpoint_id, tenant_id, idempotency_key, nonce, payload, status)
           VALUES (?, ?, ?, ?, ?, 'accepted')`,
          [Number(endpoint.id), Number(endpoint.tenant_id), idempotencyKey, nonce, JSON.stringify(jsonBody)],
        );
        await connection.execute(
          "UPDATE lead_webhook_endpoints SET sample_payload = ?, sample_updated_at = NOW(3) WHERE id = ? AND tenant_id = ?",
          [JSON.stringify(jsonBody), Number(endpoint.id), Number(endpoint.tenant_id)],
        );
        return { duplicate: false, replayConflict: false };
      });
      if (result.duplicate) return NextResponse.json({ ok: true, duplicate: true, test: true });
      if (result.replayConflict) return error("Nonce já utilizado.", 409);
      return NextResponse.json({ ok: true, test: true, message: "Payload recebido em modo teste." }, { status: 202 });
    } catch {
      return error("Não foi possível registrar o payload de teste.", 500);
    }
  }

  const parsed = leadPayloadSchema.safeParse(mapIncomingLead(jsonBody, mapping));
  if (!parsed.success) return error("Payload de lead inválido. Confira o mapeamento de Nome e Telefone.", 422);
  const payload = parsed.data;
  const phone = normalizePhone(payload.phone);
  if (!isValidNormalizedPhone(phone)) return error("Telefone inválido. Informe DDI, DDD e número.", 422);
  const [canonicalPhone, legacyPhone = canonicalPhone] = phoneLookupCandidates(phone);
  const leadTags = [...new Set([...endpointTags, ...(payload.tags ?? [])])].slice(0, 30);

  try {
    const result = await withTransaction(async (connection) => {
      const [existingRows] = await connection.execute<DbRow[]>(
        "SELECT id, idempotency_key, nonce FROM lead_webhook_events WHERE endpoint_id = ? AND (idempotency_key = ? OR nonce = ?) FOR UPDATE",
        [Number(endpoint.id), idempotencyKey, nonce],
      );
      const existing = existingRows[0];
      if (existing) {
        if (String(existing.idempotency_key) === idempotencyKey) return { duplicate: true, replayConflict: false };
        return { duplicate: false, replayConflict: true };
      }

      const [contacts] = await connection.execute<DbRow[]>(
        `SELECT id, tags FROM contacts WHERE tenant_id = ? AND (phone IN (?, ?) OR (? IS NOT NULL AND external_id = ?))
         ORDER BY CASE WHEN phone = ? THEN 0 WHEN phone = ? THEN 1 ELSE 2 END LIMIT 1 FOR UPDATE`,
        [Number(endpoint.tenant_id), canonicalPhone, legacyPhone, payload.external_id ?? null, payload.external_id ?? null, canonicalPhone, legacyPhone],
      );
      let contactId: number;
      if (contacts[0]) {
        contactId = Number(contacts[0].id);
        const mergedTags = [...new Set([...stringArray(contacts[0].tags), ...leadTags])].slice(0, 30);
        await connection.execute(
          `UPDATE contacts SET name = ?, phone = ?, email = COALESCE(?, email),
              external_id = COALESCE(?, external_id), source = COALESCE(?, source),
              notes = COALESCE(?, notes), custom_fields = COALESCE(?, custom_fields),
              tags = COALESCE(?, tags)
            WHERE id = ? AND tenant_id = ?`,
          [payload.name, phone, payload.email ?? null, payload.external_id ?? null, payload.source ?? null,
            payload.notes ?? null, payload.custom_fields ? JSON.stringify(payload.custom_fields) : null,
            mergedTags.length ? JSON.stringify(mergedTags) : null, contactId, Number(endpoint.tenant_id)],
        );
      } else {
        const capacity = await checkTenantLimit(Number(endpoint.tenant_id), "max_contacts");
        if (!capacity.allowed) throw new Error("CONTACT_LIMIT_REACHED");
        const [inserted] = await connection.execute<any>(
          `INSERT INTO contacts (tenant_id, external_id, name, phone, email, source, notes, custom_fields, tags)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [Number(endpoint.tenant_id), payload.external_id ?? null, payload.name, phone, payload.email ?? null,
            payload.source ?? null, payload.notes ?? null, payload.custom_fields ? JSON.stringify(payload.custom_fields) : null,
            leadTags.length ? JSON.stringify(leadTags) : null],
        );
        contactId = Number(inserted.insertId);
      }

      await connection.execute(
        `INSERT INTO lead_webhook_events (endpoint_id, tenant_id, idempotency_key, nonce, external_id, payload, status)
         VALUES (?, ?, ?, ?, ?, ?, 'accepted')`,
        [Number(endpoint.id), Number(endpoint.tenant_id), idempotencyKey, nonce, payload.external_id ?? null, JSON.stringify({ ...payload, phone })],
      );
      return { duplicate: false, replayConflict: false, contactId };
    });
    if (result.duplicate) return NextResponse.json({ ok: true, duplicate: true });
    if (result.replayConflict) return error("Nonce já utilizado.", 409);
    return NextResponse.json({ ok: true, contact_id: result.contactId }, { status: 202 });
  } catch (processingError) {
    if (processingError instanceof Error && processingError.message === "CONTACT_LIMIT_REACHED") {
      return error("Limite de contatos do plano atingido.", 409);
    }
    return error("Não foi possível processar o lead.", 500);
  }
}
