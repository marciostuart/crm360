import { randomUUID } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { clientIp } from "./rate-limit";

export async function verifyTurnstile(request: Request, token: unknown, action: string): Promise<boolean> {
  if (typeof token !== "string" || token.length < 1 || token.length > 2048) return false;
  const body = new URLSearchParams({ secret: serverEnv().TURNSTILE_SECRET_KEY, response: token, remoteip: clientIp(request), idempotency_key: randomUUID() });
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(5000), cache: "no-store" });
    const result = await response.json() as { success?: boolean; action?: string; hostname?: string };
    const hostname = new URL(serverEnv().APP_URL).hostname;
    return result.success === true && result.action === action && result.hostname === hostname;
  } catch { return false; }
}
