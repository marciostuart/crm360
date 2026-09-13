import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { db, type DbRow } from "@/lib/db";
import { isAdmin, requireSession } from "@/lib/auth/require-session";
import { isSameOrigin } from "@/lib/http";
import { apiError, jsonBody } from "@/lib/request";
import { checkTenantLimit } from "@/lib/billing/limits";
import { writeTenantAudit } from "@/lib/security/tenant-audit";
import { issueAccountToken } from "@/lib/auth/account-tokens";
import { sendAccountEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const userSchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(128),
  role: z.enum(["admin", "manager", "operator"]),
});

export async function GET() {
  try {
    const session = await requireSession();
    if (!isAdmin(session)) return apiError("Sem permissão.", 403);
    const [rows] = await db().execute<DbRow[]>(
      `SELECT id, name, email,
              CASE role WHEN 'owner' THEN 'admin' WHEN 'supervisor' THEN 'manager' WHEN 'attendant' THEN 'operator' ELSE role END AS role,
              status, created_at
         FROM users WHERE tenant_id = ? ORDER BY created_at ASC, id ASC`,
      [session.tenantId],
    );
    return NextResponse.json({ ok: true, users: rows });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    return apiError(unauthorized ? "Não autorizado." : "Não foi possível listar a equipe.", unauthorized ? 401 : 500);
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError("Origem não autorizada.", 403);
  try {
    const session = await requireSession();
    if (!isAdmin(session)) return apiError("Sem permissão.", 403);
    const parsed = userSchema.safeParse(await jsonBody(request));
    if (!parsed.success) return apiError("Dados do usuário inválidos. Use uma senha com pelo menos 12 caracteres.", 422);
    const capacity = await checkTenantLimit(session.tenantId, "max_users");
    if (!capacity.allowed) return apiError(`Limite do plano atingido: máximo de ${capacity.limit} usuários.`, 409);
    const passwordHash = await hash(parsed.data.password, 12);
    const [result] = await db().execute<any>(
      "INSERT INTO users (tenant_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)",
      [session.tenantId, parsed.data.name, parsed.data.email, passwordHash, parsed.data.role],
    );
    await writeTenantAudit({ tenantId: session.tenantId, userId: session.userId, action: "user.created", entityType: "user", entityId: result.insertId, metadata: { role: parsed.data.role }, request });
    const token = await issueAccountToken(Number(result.insertId), "verify_email", 24);
    await sendAccountEmail({ to: parsed.data.email, name: parsed.data.name, subject: "Confirme seu e-mail no CRM360", title: "Confirme seu e-mail", message: "Seu usuário foi criado. Confirme este endereço para ativar seu acesso ao CRM360.", actionLabel: "Confirmar e-mail", actionUrl: `${new URL(request.url).origin}/api/auth/verify-email/${token}` });
    return NextResponse.json({ ok: true, id: Number(result.insertId) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "SMTP_NOT_CONFIGURED") return apiError("Usuário criado, mas o SMTP ainda não está configurado para enviar a confirmação.", 503);
    if ((error as { code?: string }).code === "ER_DUP_ENTRY") return apiError("Este e-mail já está cadastrado.", 409);
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    return apiError(unauthorized ? "Não autorizado." : "Não foi possível cadastrar o usuário.", unauthorized ? 401 : 500);
  }
}
