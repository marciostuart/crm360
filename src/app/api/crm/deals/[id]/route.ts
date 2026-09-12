import { NextResponse } from "next/server";
import { db, type DbRow } from "@/lib/db";
import { requireSession } from "@/lib/auth/require-session";
import { apiError, jsonBody, positiveId } from "@/lib/request";
import { isSameOrigin } from "@/lib/http";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const updateSchema = z.object({ stage_id: z.number().int().positive().optional(), name: z.string().trim().min(1).max(200).optional(), amount: z.number().min(0).max(999999999).optional(), notes: z.string().max(10000).nullable().optional(), position: z.number().int().min(0).max(100000).optional() });

export async function PATCH(request: Request, context: Context) {
  if (!isSameOrigin(request)) return apiError("Origem não autorizada.", 403);
  const id = positiveId((await context.params).id); if (!id) return apiError("Negócio inválido.", 400);
  try {
    const session = await requireSession(); const parsed = updateSchema.safeParse(await jsonBody(request));
    if (!parsed.success) return apiError("Dados do negócio inválidos.", 422);
    const [dealRows] = await db().execute<DbRow[]>("SELECT id, board_id FROM deals WHERE id = ? AND tenant_id = ?", [id, session.tenantId]);
    const deal = dealRows[0]; if (!deal) return apiError("Negócio não encontrado.", 404);
    if (parsed.data.stage_id) {
      const [stage] = await db().execute<DbRow[]>("SELECT id FROM board_stages WHERE id = ? AND board_id = ?", [parsed.data.stage_id, Number(deal.board_id)]);
      if (!stage[0]) return apiError("Etapa inválida.", 422);
    }
    const input = parsed.data;
    const fields: string[] = []; const values: any[] = [];
    for (const [column, value] of Object.entries({ stage_id: input.stage_id, name: input.name, amount: input.amount, notes: input.notes, position: input.position })) {
      if (value !== undefined) { fields.push(`${column} = ?`); values.push(value); }
    }
    if (!fields.length) return NextResponse.json({ ok: true });
    values.push(id, session.tenantId); await db().execute(`UPDATE deals SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, values);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    return apiError(unauthorized ? "Não autorizado." : "Não foi possível atualizar o negócio.", unauthorized ? 401 : 500);
  }
}

export async function DELETE(request: Request, context: Context) {
  if (!isSameOrigin(request)) return apiError("Origem não autorizada.", 403);
  const id = positiveId((await context.params).id); if (!id) return apiError("Negócio inválido.", 400);
  try {
    const session = await requireSession(); const [result] = await db().execute<any>("DELETE FROM deals WHERE id = ? AND tenant_id = ?", [id, session.tenantId]);
    if (!result.affectedRows) return apiError("Negócio não encontrado.", 404);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    return apiError(unauthorized ? "Não autorizado." : "Não foi possível excluir o negócio.", unauthorized ? 401 : 500);
  }
}
