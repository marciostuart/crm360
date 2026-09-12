import { serverEnv } from "./env";

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(serverEnv().APP_URL).origin; } catch { return false; }
}
