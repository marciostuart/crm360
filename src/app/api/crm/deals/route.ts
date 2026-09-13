import { NextResponse } from "next/server";
import { db, type DbRow } from "@/lib/db";
import { requireSession } from "@/lib/auth/require-session";
import { dealSchema } from "@/lib/crm/schema";
import { apiError, jsonBody } from "@/lib/request";
import { isSameOrigin } from "@/lib/http";
import { checkTenantLimit } from "@/lib/billing/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError("Origem não autorizada.", 403);
  try {
    const session = await requireSession();
    const parsed = dealSchema.safeParse(await jsonBody(request));
    if (!parsed.success) return apiError("Dados do negócio inválidos.", 422);
    const capacity = await checkTenantLimit(session.tenantId, "max_deals");
    if (!capacity.allowed) return apiError(`Limite do plano atingido: máximo de ${capacity.limit} negócios.`, 409);
    const deal = parsed.data;
    const [valid] = await db().execute<DbRow[]>(
      `SELECT s.id FROM board_stages s JOIN boards b ON b.id = s.board_id
        WHERE s.id = ? AND b.id = ? AND b.tenant_id = ?`,
      [deal.stage_id, deal.board_id, session.tenantId],
    );
    if (!valid[0]) return apiError("Quadro ou etapa inválidos.", 422);
    if (deal.contact_id) {
      const [contact] = await db().execute<DbRow[]>("SELECT id FROM contacts WHERE id = ? AND tenant_id = ?", [deal.contact_id, session.tenantId]);
      if (!contact[0]) return apiError("Contato inválido.", 422);
    }
    const [result] = await db().execute<any>(
      "INSERT INTO deals (tenant_id, board_id, stage_id, contact_id, name, amount, notes, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [session.tenantId, deal.board_id, deal.stage_id, deal.contact_id ?? null, deal.name, deal.amount ?? 0, deal.notes ?? null, deal.position ?? 0],
    );
    return NextResponse.json({ ok: true, id: Number(result.insertId) }, { status: 201 });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    return apiError(unauthorized ? "Não autorizado." : "Não foi possível criar o negócio.", unauthorized ? 401 : 500);
  }
}
