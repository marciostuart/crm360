import { NextResponse } from "next/server";
import { db, type DbRow } from "@/lib/db";
import { requireSession, isManager } from "@/lib/auth/require-session";
import { connectInstance } from "@/lib/evolution/client";
import { apiError } from "@/lib/request";
import { isSameOrigin } from "@/lib/http";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  if (!isSameOrigin(request)) return apiError("Origem não autorizada.", 403);
  const publicId = (await context.params).id;
  if (!/^[0-9a-f-]{36}$/i.test(publicId)) return apiError("Conexão inválida.", 400);
  try {
    const session = await requireSession();
    if (!isManager(session)) return apiError("Sem permissão.", 403);
    const [rows] = await db().execute<DbRow[]>("SELECT id, instance_name FROM evolution_connections WHERE public_id = ? AND tenant_id = ?", [publicId, session.tenantId]);
    if (!rows[0]) return apiError("Conexão não encontrada.", 404);
    const result = await connectInstance(String(rows[0].instance_name));
    await db().execute("UPDATE evolution_connections SET status = 'qr_pending' WHERE id = ? AND tenant_id = ?", [Number(rows[0].id), session.tenantId]);
    return NextResponse.json({ ok: true, qrcode: result.qrcode?.base64 ?? result.base64 ?? null, pairing_code: result.qrcode?.code ?? result.code ?? null });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    return apiError(unauthorized ? "Não autorizado." : "Não foi possível conectar a instância.", unauthorized ? 401 : 502);
  }
}
