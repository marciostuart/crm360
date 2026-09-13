import { NextResponse } from "next/server";
import { z } from "zod";
import { db, type DbRow } from "@/lib/db";
import { isAdmin, requireSession } from "@/lib/auth/require-session";
import { isSameOrigin } from "@/lib/http";
import { parseLeadMapping } from "@/lib/leads/mapping";
import { normalizeAllowedHosts, parseStoredHosts } from "@/lib/webhooks/source-host";
import { writeTenantAudit } from "@/lib/security/tenant-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ endpointId: string }> };

function storedStringArray(value: unknown): string[] {
  if (typeof value === "string") { try { value = JSON.parse(value); } catch { return []; } }
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

const mappingSchema = z.object({
  external_id: z.string().trim().max(191).nullable(),
  name: z.string().trim().max(191).nullable(),
  phone: z.string().trim().max(191).nullable(),
  email: z.string().trim().max(191).nullable(),
  source: z.string().trim().max(191).nullable(),
  notes: z.string().trim().max(191).nullable(),
  custom_fields: z.record(z.string().trim().min(1).max(80), z.string().trim().min(1).max(191)).optional(),
  mode: z.enum(["test", "active"]).optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  allowed_hosts: z.array(z.string().trim().min(1).max(253)).max(20),
});

export async function GET(_: Request, context: Context) {
  const session = await requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  const endpointId = (await context.params).endpointId;
  if (!/^[0-9a-f-]{36}$/i.test(endpointId)) return NextResponse.json({ error: "Endpoint inválido." }, { status: 422 });
  let rows: DbRow[];
  try {
    const [result] = await db().execute<DbRow[]>("SELECT endpoint_id, mode, field_mapping, sample_payload, sample_updated_at, tags, allowed_hosts FROM lead_webhook_endpoints WHERE endpoint_id = ? AND tenant_id = ? LIMIT 1", [endpointId, session.tenantId]);
    rows = result;
  } catch {
    const [result] = await db().execute<DbRow[]>("SELECT endpoint_id, field_mapping FROM lead_webhook_endpoints WHERE endpoint_id = ? AND tenant_id = ? LIMIT 1", [endpointId, session.tenantId]);
    rows = result.map((row) => ({ ...row, mode: "active", sample_payload: null, sample_updated_at: null, tags: [], allowed_hosts: [] }));
  }
  if (!rows[0]) return NextResponse.json({ error: "Endpoint não encontrado." }, { status: 404 });
  return NextResponse.json({
    ok: true,
    endpoint_id: endpointId,
    mode: String(rows[0].mode || "active"),
    field_mapping: parseLeadMapping(rows[0].field_mapping),
    sample_payload: rows[0].sample_payload ?? null,
    sample_updated_at: rows[0].sample_updated_at ?? null,
    tags: storedStringArray(rows[0].tags),
    allowed_hosts: parseStoredHosts(rows[0].allowed_hosts),
  });
}

export async function PATCH(request: Request, context: Context) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
  const session = await requireSession().catch(() => null);
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  if (!isAdmin(session)) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const endpointId = (await context.params).endpointId;
  if (!/^[0-9a-f-]{36}$/i.test(endpointId)) return NextResponse.json({ error: "Endpoint inválido." }, { status: 422 });
  const parsed = mappingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Configuração inválida. Informe ao menos um domínio autorizado." }, { status: 422 });
  const [rows] = await db().execute<DbRow[]>("SELECT id FROM lead_webhook_endpoints WHERE endpoint_id = ? AND tenant_id = ? LIMIT 1", [endpointId, session.tenantId]);
  if (!rows[0]) return NextResponse.json({ error: "Endpoint não encontrado." }, { status: 404 });

  const allowedHosts = normalizeAllowedHosts(parsed.data.allowed_hosts);
  if (allowedHosts.length !== parsed.data.allowed_hosts.length || !allowedHosts.length) return NextResponse.json({ error: "Informe domínios válidos, como integrador.exemplo.com.br." }, { status: 422 });
  const { mode, tags, allowed_hosts: _allowedHosts, ...rawMapping } = parsed.data;
  const mappingData = Object.fromEntries(Object.entries(rawMapping).filter(([, value]) => value !== null && value !== undefined && value !== "" && (!(typeof value === "object") || Object.keys(value).length)));
  const mapping = Object.keys(mappingData).length ? mappingData : null;
  if (mode === "active" && (!mapping?.name || !mapping?.phone)) return NextResponse.json({ error: "Mapeie Nome e Telefone antes de ativar o endpoint." }, { status: 422 });
  await db().execute("UPDATE lead_webhook_endpoints SET field_mapping = ?, mode = COALESCE(?, mode), tags = ?, allowed_hosts = ? WHERE id = ? AND tenant_id = ?", [mapping ? JSON.stringify(mapping) : null, mode ?? null, tags?.length ? JSON.stringify(tags) : null, JSON.stringify(allowedHosts), Number(rows[0].id), session.tenantId]);
  await writeTenantAudit({ tenantId: session.tenantId, userId: session.userId, action: "webhook.updated", entityType: "webhook", entityId: endpointId, metadata: { mode: mode ?? "unchanged", allowed_hosts_count: allowedHosts.length }, request });
  return NextResponse.json({ ok: true, mode: mode ?? "test", allowed_hosts: allowedHosts });
}
