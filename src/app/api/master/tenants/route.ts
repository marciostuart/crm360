import { NextResponse } from "next/server";
import { db, type DbRow } from "@/lib/db";
import { getMasterSession } from "@/lib/auth/master-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const master = await getMasterSession();
  if (!master) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const [rows] = await db().execute<DbRow[]>(
    `SELECT t.id, t.public_id, t.name, t.legal_name, t.slug, t.document, t.plan_id, p.name AS plan_name,
            t.contact_email, t.contact_phone, t.status, t.created_at,
            (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) AS users_count,
            (SELECT COUNT(*) FROM contacts c WHERE c.tenant_id = t.id) AS contacts_count,
            (SELECT COUNT(*) FROM evolution_connections e WHERE e.tenant_id = t.id) AS connections_count,
            (SELECT u.name FROM users u WHERE u.tenant_id = t.id AND u.status = 'active' AND u.role IN ('admin', 'owner') ORDER BY u.id LIMIT 1) AS admin_name
       FROM tenants t LEFT JOIN plans p ON p.id = t.plan_id ORDER BY t.created_at DESC, t.id DESC`,
  );
  return NextResponse.json({ ok: true, tenants: rows });
}
