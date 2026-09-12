import { NextResponse } from "next/server";
import { db, type DbRow } from "@/lib/db";
import { requireSession } from "@/lib/auth/require-session";
import { getConnectionState } from "@/lib/evolution/client";
import { apiError } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const publicId = (await context.params).id;
  if (!/^[0-9a-f-]{36}$/i.test(publicId)) return apiError("Conexão inválida.", 400);
  try {
    const session = await requireSession();
    const [rows] = await db().execute<DbRow[]>("SELECT id, instance_name FROM evolution_connections WHERE public_id = ? AND tenant_id = ?", [publicId, session.tenantId]);
    if (!rows[0]) return apiError("Conexão não encontrada.", 404);
    const state = await getConnectionState(String(rows[0].instance_name));
    const normalized = String(state.instance?.state ?? state.state ?? "disconnected").toLowerCase();
    await db().execute("UPDATE evolution_connections SET status = ? WHERE id = ? AND tenant_id = ?", [normalized, Number(rows[0].id), session.tenantId]);
    return NextResponse.json({ ok: true, status: normalized });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    return apiError(unauthorized ? "Não autorizado." : "Não foi possível consultar a conexão.", unauthorized ? 401 : 502);
  }
}
