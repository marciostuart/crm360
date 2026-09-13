import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withTransaction } from "@/lib/db";
import { isSameOrigin } from "@/lib/http";
import { centralRateLimit } from "@/lib/security/central-rate-limit";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { issueAccountToken } from "@/lib/auth/account-tokens";
import { sendAccountEmail } from "@/lib/email";

const registrationSchema = z.object({
  company: z.string().trim().min(2).max(160),
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(128),
  turnstileToken: z.string().max(2048),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
  const limited = await centralRateLimit(request, "register", 3, 60 * 60_000);
  if (!limited.allowed) return NextResponse.json({ error: "Muitas tentativas. Aguarde antes de criar outro ambiente." }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  const parsed = registrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados de cadastro inválidos." }, { status: 422 });
  if (!await verifyTurnstile(request, parsed.data.turnstileToken, "register")) return NextResponse.json({ error: "Verificação de segurança inválida." }, { status: 403 });

  const { company, name, email, password } = parsed.data;
  const passwordHash = await hash(password, 12);
  const slug = `${company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${randomUUID().slice(0, 8)}`;

  try {
    const result = await withTransaction(async (connection) => {
      const [tenant] = await connection.execute<any>(
        "INSERT INTO tenants (public_id, name, slug) VALUES (?, ?, ?)",
        [randomUUID(), company, slug],
      );
      const tenantId = Number(tenant.insertId);
      const [user] = await connection.execute<any>(
        "INSERT INTO users (tenant_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, 'owner')",
        [tenantId, name, email, passwordHash],
      );
      const [board] = await connection.execute<any>(
        "INSERT INTO boards (tenant_id, name, description) VALUES (?, 'Funil de vendas', 'Quadro inicial do CRM')",
        [tenantId],
      );
      const boardId = Number(board.insertId);
      await connection.query(
        "INSERT INTO board_stages (board_id, name, position) VALUES (?, 'Novo', 0), (?, 'Em atendimento', 1), (?, 'Ganho', 2), (?, 'Perdido', 3)",
        [boardId, boardId, boardId, boardId],
      );
      return { tenantId, userId: Number(user.insertId) };
    });
    const token = await issueAccountToken(result.userId, "verify_email", 24);
    await sendAccountEmail({ to: email, name, subject: "Confirme seu e-mail no CRM360", title: "Confirme seu e-mail", message: "Clique no botão abaixo para confirmar seu endereço e ativar o acesso ao CRM360.", actionLabel: "Confirmar e-mail", actionUrl: `${new URL(request.url).origin}/api/auth/verify-email/${token}` });
    return NextResponse.json({ ok: true, requiresEmailVerification: true }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "SMTP_NOT_CONFIGURED") return NextResponse.json({ error: "O cadastro foi criado, mas o SMTP ainda não está configurado." }, { status: 503 });
    const code = (error as { code?: string }).code;
    if (code === "ER_DUP_ENTRY") return NextResponse.json({ error: "Não foi possível concluir o cadastro." }, { status: 409 });
    return NextResponse.json({ error: "Não foi possível concluir o cadastro." }, { status: 500 });
  }
}
