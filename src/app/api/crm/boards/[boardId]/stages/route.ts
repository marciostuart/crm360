import { NextResponse } from "next/server";
import { db, type DbRow } from "@/lib/db";
import { requireSession, isManager } from "@/lib/auth/require-session";
import { stageSchema } from "@/lib/crm/schema";
import { apiError, jsonBody, positiveId } from "@/lib/request";
import { isSameOrigin } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ boardId: string }> };

export async function POST(request: Request, context: Context) {
  if (!isSameOrigin(request)) return apiError("Origem não autorizada.", 403);
  const boardId = positiveId((await context.params).boardId);
  if (!boardId) return apiError("Quadro inválido.", 400);
  try {
    const session = await requireSession();
    if (!isManager(session)) return apiError("Sem permissão.", 403);
    const [boards] = await db().execute<DbRow[]>("SELECT id FROM boards WHERE id = ? AND tenant_id = ?", [boardId, session.tenantId]);
    if (!boards[0]) return apiError("Quadro não encontrado.", 404);
    const parsed = stageSchema.safeParse(await jsonBody(request));
    if (!parsed.success) return apiError("Dados da etapa inválidos.", 422);
    const [result] = await db().execute<any>("INSERT INTO board_stages (board_id, name, position) VALUES (?, ?, ?)", [boardId, parsed.data.name, parsed.data.position ?? 0]);
    return NextResponse.json({ ok: true, id: Number(result.insertId) }, { status: 201 });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    return apiError(unauthorized ? "Não autorizado." : "Não foi possível criar a etapa.", unauthorized ? 401 : 500);
  }
}
