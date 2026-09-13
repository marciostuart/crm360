import { NextResponse } from "next/server";
import { randomBytes, randomUUID } from "node:crypto";
import { db, type DbRow } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { getCurrentSession } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/require-session";
import { isSameOrigin } from "@/lib/http";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentSession();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  let rows: DbRow[];
  try {
    const [result] = await db().execute<DbRow[]>(
      "SELECT endpoint_id, active, mode, field_mapping, tags, allowed_hosts, sample_updated_at, created_at, rotated_at FROM lead_webhook_endpoints WHERE tenant_id = ? ORDER BY created_at DESC",
      [session.tenantId],
    );
    rows = result;
  } catch {
    const [result] = await db().execute<DbRow[]>(
      "SELECT endpoint_id, active, created_at, rotated_at FROM lead_webhook_endpoints WHERE tenant_id = ? ORDER BY created_at DESC",
      [session.tenantId],
    );
    rows = result.map((row) => ({ ...row, mode: "active", field_mapping: null, tags: [], allowed_hosts: [] }));
  }
  return NextResponse.json({ endpoints: rows });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
  const session = await getCurrentSession();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  const endpointId = randomUUID();
  // Kept encrypted for schema compatibility; new endpoints use the source-host policy.
  const internalSecret = randomBytes(32).toString("base64url");
  await db().execute(
    "INSERT INTO lead_webhook_endpoints (tenant_id, endpoint_id, secret_ciphertext) VALUES (?, ?, ?)",
    [session.tenantId, endpointId, encryptSecret(internalSecret)],
  );
  return NextResponse.json({
    endpoint_id: endpointId,
    url: `${serverEnv().APP_URL.replace(/\/$/, "")}/api/v1/leads/${endpointId}`,
    warning: "Configure ao menos um domínio de origem autorizado antes de enviar o primeiro payload.",
  }, { status: 201 });
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
  const session = await getCurrentSession();
  if (!session || !isAdmin(session)) return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  const body = await request.json().catch(() => null) as { endpoint_id?: unknown } | null;
  const endpointId = typeof body?.endpoint_id === "string" ? body.endpoint_id : "";
  if (!/^[0-9a-f-]{36}$/i.test(endpointId)) return NextResponse.json({ error: "Endpoint inválido." }, { status: 422 });
  const [result] = await db().execute<any>(
    "DELETE FROM lead_webhook_endpoints WHERE endpoint_id = ? AND tenant_id = ?",
    [endpointId, session.tenantId],
  );
  if (!result.affectedRows) return NextResponse.json({ error: "Endpoint não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
