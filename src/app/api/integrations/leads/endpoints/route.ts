import { NextResponse } from "next/server";
import { randomBytes, randomUUID } from "node:crypto";
import { db, type DbRow } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { getCurrentSession } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/http";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function allowed(role: string) { return role === "owner" || role === "admin"; }

export async function GET() {
  const session = await getCurrentSession();
  if (!session || !allowed(session.role)) return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  const [rows] = await db().execute<DbRow[]>(
    "SELECT endpoint_id, active, created_at, rotated_at FROM lead_webhook_endpoints WHERE tenant_id = ? ORDER BY created_at DESC",
    [session.tenantId],
  );
  return NextResponse.json({ endpoints: rows });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
  const session = await getCurrentSession();
  if (!session || !allowed(session.role)) return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  const endpointId = randomUUID();
  const secret = randomBytes(32).toString("base64url");
  await db().execute(
    "INSERT INTO lead_webhook_endpoints (tenant_id, endpoint_id, secret_ciphertext) VALUES (?, ?, ?)",
    [session.tenantId, endpointId, encryptSecret(secret)],
  );
  return NextResponse.json({
    endpoint_id: endpointId,
    secret,
    url: `${serverEnv().APP_URL.replace(/\/$/, "")}/api/v1/leads/${endpointId}`,
    warning: "Exiba e armazene este segredo agora. Ele não será mostrado novamente.",
  }, { status: 201 });
}
