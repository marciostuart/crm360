import { NextResponse } from "next/server";
import { z } from "zod";
import { db, type DbRow } from "@/lib/db";
import { isSameOrigin } from "@/lib/http";
import { jsonBody, apiError } from "@/lib/request";
import { centralRateLimit } from "@/lib/security/central-rate-limit";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { issueAccountToken } from "@/lib/auth/account-tokens";
import { sendAccountEmail } from "@/lib/email";

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(254), turnstileToken: z.string().max(2048) });
const generic = { ok: true, message: "Se o e-mail estiver cadastrado, você receberá as instruções em instantes." };

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError("Origem não autorizada.", 403);
  const limited = await centralRateLimit(request, "forgot-password", 3, 60 * 60_000);
  if (!limited.allowed) return apiError("Muitas tentativas. Aguarde alguns minutos.", 429);
  const parsed = schema.safeParse(await jsonBody(request));
  if (!parsed.success || !await verifyTurnstile(request, parsed.success ? parsed.data.turnstileToken : "", "forgot-password")) return apiError("Verificação de segurança inválida.", 403);
  const [rows] = await db().execute<DbRow[]>("SELECT id, name, email FROM users WHERE email = ? AND status = 'active' LIMIT 1", [parsed.data.email]);
  const user = rows[0];
  if (!user) return NextResponse.json(generic);
  try {
    const token = await issueAccountToken(Number(user.id), "reset_password", 1);
    await sendAccountEmail({ to: String(user.email), name: String(user.name), subject: "Recuperação de senha CRM360", title: "Recupere sua senha", message: "Recebemos uma solicitação para criar uma nova senha. O link expira em uma hora.", actionLabel: "Redefinir senha", actionUrl: `${new URL(request.url).origin}/reset-password/${token}` });
  } catch (error) { if (error instanceof Error && error.message === "SMTP_NOT_CONFIGURED") return apiError("Serviço de e-mail temporariamente indisponível.", 503); }
  return NextResponse.json(generic);
}
