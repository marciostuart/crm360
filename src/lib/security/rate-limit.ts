type Entry = { count: number; resetAt: number };
const entries = new Map<string, Entry>();

export function clientIp(request: Request): string {
  return (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown").slice(0, 64);
}

export function rateLimit(request: Request, bucket: string, limit: number, windowMs: number): { allowed: boolean; retryAfter: number } {
  const now = Date.now(); const key = `${bucket}:${clientIp(request)}`; const current = entries.get(key);
  if (!current || current.resetAt <= now) { entries.set(key, { count: 1, resetAt: now + windowMs }); return { allowed: true, retryAfter: 0 }; }
  current.count++;
  return { allowed: current.count <= limit, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
}
