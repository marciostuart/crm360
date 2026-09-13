import { NextResponse } from "next/server";
import { db, type DbRow } from "@/lib/db";
import { requireSession, isManager } from "@/lib/auth/require-session";
import { deleteInstance, EvolutionApiError } from "@/lib/evolution/client";
import { apiError } from "@/lib/request";
import { isSameOrigin } from "@/lib/http";
import { writeTenantAudit } from "@/lib/security/tenant-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return apiError("Origem não autorizada.", 403);
  const publicId = (await context.params).id;
  if (!/^[0-9a-f-]{36}$/i.test(publicId)) return apiError("Conexão inválida.", 400);
  try {
    const session = await requireSession();
    if (!isManager(session)) return apiError("Sem permissão.", 403);
    const [rows] = await db().execute<DbRow[]>("SELECT id, instance_name FROM evolution_connections WHERE public_id = ? AND tenant_id = ?", [publicId, session.tenantId]);
    if (!rows[0]) return apiError("Conexão não encontrada.", 404);
    try { await deleteInstance(String(rows[0].instance_name)); } catch (error) { if (!(error instanceof EvolutionApiError) || error.status !== 404) return apiError("A conexão não pôde ser removida da Evolution API.", 502); }
    await db().execute("DELETE FROM evolution_connections WHERE id = ? AND tenant_id = ?", [Number(rows[0].id), session.tenantId]);
    await writeTenantAudit({ tenantId: session.tenantId, userId: session.userId, action: "evolution.deleted", entityType: "connection", entityId: publicId, metadata: {}, request });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    return apiError(unauthorized ? "Não autorizado." : "Não foi possível excluir a conexão.", unauthorized ? 401 : 500);
  }
}
