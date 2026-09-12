import { NextResponse } from "next/server";
import { db, type DbRow } from "@/lib/db";
import { requireSession, isManager } from "@/lib/auth/require-session";
import { boardSchema } from "@/lib/crm/schema";
import { apiError, jsonBody } from "@/lib/request";
import { isSameOrigin } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireSession();
    const [boards] = await db().execute<DbRow[]>("SELECT id, name, description, color, created_at FROM boards WHERE tenant_id = ? ORDER BY id", [session.tenantId]);
    const [stages] = await db().execute<DbRow[]>(
      `SELECT s.id, s.board_id, s.name, s.position,
              d.id AS deal_id, d.contact_id, d.name AS deal_name, d.amount, d.notes, d.position AS deal_position,
              c.name AS contact_name, c.phone AS contact_phone
         FROM board_stages s JOIN boards b ON b.id = s.board_id AND b.tenant_id = ?
         LEFT JOIN deals d ON d.stage_id = s.id AND d.tenant_id = ?
         LEFT JOIN contacts c ON c.id = d.contact_id AND c.tenant_id = ?
        ORDER BY s.position, d.position`,
      [session.tenantId, session.tenantId, session.tenantId],
    );
    return NextResponse.json({ ok: true, boards, stages });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    return apiError(unauthorized ? "Não autorizado." : "Não foi possível carregar o CRM.", unauthorized ? 401 : 500);
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError("Origem não autorizada.", 403);
  try {
    const session = await requireSession();
    if (!isManager(session)) return apiError("Sem permissão.", 403);
    const parsed = boardSchema.safeParse(await jsonBody(request));
    if (!parsed.success) return apiError("Dados do quadro inválidos.", 422);
    const [result] = await db().execute<any>("INSERT INTO boards (tenant_id, name, description, color) VALUES (?, ?, ?, ?)", [session.tenantId, parsed.data.name, parsed.data.description ?? null, parsed.data.color ?? "#344a99"]);
    const boardId = Number(result.insertId);
    await db().execute("INSERT INTO board_stages (board_id, name, position) VALUES (?, 'Novo', 0)", [boardId]);
    return NextResponse.json({ ok: true, id: boardId }, { status: 201 });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    return apiError(unauthorized ? "Não autorizado." : "Não foi possível criar o quadro.", unauthorized ? 401 : 500);
  }
}
