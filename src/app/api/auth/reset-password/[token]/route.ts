import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { isSameOrigin } from "@/lib/http";
import { jsonBody, apiError } from "@/lib/request";
import { centralRateLimit } from "@/lib/security/central-rate-limit";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { consumeAccountToken } from "@/lib/auth/account-tokens";

const schema = z.object({ password: z.string().min(12).max(128), turnstileToken: z.string().max(2048) });

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  if (!isSameOrigin(request)) return apiError("Origem não autorizada.", 403);
  const limited = await centralRateLimit(request, "reset-password", 5, 15 * 60_000);
  if (!limited.allowed) return apiError("Muitas tentativas. Aguarde alguns minutos.", 429);
  const parsed = schema.safeParse(await jsonBody(request));
  if (!parsed.success || !await verifyTurnstile(request, parsed.success ? parsed.data.turnstileToken : "", "reset-password")) return apiError("Verificação de segurança inválida.", 403);
  const { token } = await context.params;
  const consumed = await consumeAccountToken(token, "reset_password");
  if (!consumed) return apiError("Link inválido ou expirado.", 422);
  await db().execute("UPDATE users SET password_hash = ?, email_verified_at = COALESCE(email_verified_at, NOW(3)), failed_login_attempts = 0, locked_until = NULL WHERE id = ?", [await hash(parsed.data.password, 12), consumed.userId]);
  await db().execute("DELETE FROM sessions WHERE user_id = ?", [consumed.userId]);
  return NextResponse.json({ ok: true });
}
