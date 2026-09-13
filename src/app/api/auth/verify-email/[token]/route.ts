import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { consumeAccountToken } from "@/lib/auth/account-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const consumed = await consumeAccountToken(token, "verify_email");
  if (!consumed) return NextResponse.redirect(new URL("/login?email_verification=invalid", _request.url));
  await db().execute("UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW(3)) WHERE id = ?", [consumed.userId]);
  return NextResponse.redirect(new URL("/login?email_verification=success", _request.url));
}
