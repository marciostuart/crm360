import { NextResponse } from "next/server";
import { randomBytes, randomUUID } from "node:crypto";
import { db, type DbRow } from "@/lib/db";
import { requireSession, isManager } from "@/lib/auth/require-session";
import { connectionSchema } from "@/lib/evolution/schema";
import { createInstance, configureWebhook } from "@/lib/evolution/client";
import { encryptSecret } from "@/lib/crypto";
import { apiError, jsonBody } from "@/lib/request";
import { isSameOrigin } from "@/lib/http";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireSession();
    const [rows] = await db().execute<DbRow[]>(
      "SELECT public_id, name, instance_name, status, created_at, updated_at FROM evolution_connections WHERE tenant_id = ? ORDER BY created_at DESC",
      [session.tenantId],
    );
    return NextResponse.json({ ok: true, connections: rows });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    return apiError(unauthorized ? "Não autorizado." : "Não foi possível listar conexões.", unauthorized ? 401 : 500);
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError("Origem não autorizada.", 403);
  try {
    const session = await requireSession();
    if (!isManager(session)) return apiError("Sem permissão.", 403);
    const parsed = connectionSchema.safeParse(await jsonBody(request));
    if (!parsed.success) return apiError("Nome da conexão inválido.", 422);

    const instanceName = `m7crm_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
    const created = await createInstance(instanceName);
    const instanceToken = created.token ?? created.hash ?? created.instance?.token;
    if (!instanceToken) return apiError("A Evolution API não retornou o token da instância.", 502);

    const publicId = randomUUID();
    const webhookSecret = randomBytes(32).toString("base64url");
    const [result] = await db().execute<any>(
      `INSERT INTO evolution_connections
        (tenant_id, public_id, name, instance_name, instance_token_ciphertext, webhook_secret_ciphertext, status)
       VALUES (?, ?, ?, ?, ?, ?, 'webhook_pending')`,
      [session.tenantId, publicId, parsed.data.name, instanceName, encryptSecret(String(instanceToken)), encryptSecret(webhookSecret)],
    );

    try {
      await configureWebhook(instanceName, `${serverEnv().APP_URL.replace(/\/$/, "")}/api/webhooks/evolution/${publicId}`, webhookSecret);
      await db().execute("UPDATE evolution_connections SET status = 'disconnected' WHERE id = ? AND tenant_id = ?", [Number(result.insertId), session.tenantId]);
      return NextResponse.json({ ok: true, public_id: publicId, status: "disconnected" }, { status: 201 });
    } catch {
      await db().execute("UPDATE evolution_connections SET status = 'webhook_error' WHERE id = ? AND tenant_id = ?", [Number(result.insertId), session.tenantId]);
      return apiError("Instância criada, mas o webhook seguro não pôde ser configurado.", 502);
    }
  } catch (error) {
    if ((error as { code?: string }).code === "ER_DUP_ENTRY") return apiError("Não foi possível criar a conexão.", 409);
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    return apiError(unauthorized ? "Não autorizado." : "Não foi possível criar a conexão.", unauthorized ? 401 : 500);
  }
}
