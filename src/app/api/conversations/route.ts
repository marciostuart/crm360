import { NextResponse } from "next/server";
import { db, type DbRow } from "@/lib/db";
import { requireSession } from "@/lib/auth/require-session";
import { apiError } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireSession();
    const [rows] = await db().execute<DbRow[]>(
      `SELECT c.id, c.status, c.unread_count, c.last_message_at, c.updated_at,
              ct.id AS contact_id, ct.name AS contact_name, ct.phone AS contact_phone,
              ec.public_id AS connection_id, ec.name AS connection_name
         FROM conversations c JOIN contacts ct ON ct.id = c.contact_id AND ct.tenant_id = c.tenant_id
         LEFT JOIN evolution_connections ec ON ec.id = c.evolution_connection_id AND ec.tenant_id = c.tenant_id
        WHERE c.tenant_id = ? ORDER BY c.last_message_at DESC, c.updated_at DESC LIMIT 200`,
      [session.tenantId],
    );
    return NextResponse.json({ ok: true, conversations: rows });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    return apiError(unauthorized ? "Não autorizado." : "Não foi possível listar conversas.", unauthorized ? 401 : 500);
  }
}
