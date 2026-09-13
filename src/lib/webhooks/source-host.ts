function cleanHost(value: string): string | null {
  let candidate = value.trim().toLowerCase();
  if (!candidate || candidate === "null") return null;
  try {
    candidate = new URL(candidate.includes("://") ? candidate : `https://${candidate}`).hostname.toLowerCase();
  } catch {
    return null;
  }
  candidate = candidate.replace(/^\.+|\.+$/g, "");
  return /^(?:localhost|(?:\d{1,3}\.){3}\d{1,3}|[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)$/.test(candidate) ? candidate : null;
}

export function normalizeAllowedHosts(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => typeof value === "string" ? cleanHost(value) : null).filter((value): value is string => Boolean(value)))].slice(0, 20);
}

export function sourceHostCandidates(request: Request): string[] {
  const candidates: string[] = [];
  for (const value of [request.headers.get("origin"), request.headers.get("referer")]) {
    if (!value) continue;
    try {
      const host = cleanHost(value);
      if (host) candidates.push(host);
    } catch { /* ignore malformed browser headers */ }
  }
  const explicit = request.headers.get("x-crm-source-host");
  const explicitHost = explicit ? cleanHost(explicit) : null;
  if (explicitHost) candidates.push(explicitHost);
  return [...new Set(candidates)];
}

export function isAllowedSourceHost(request: Request, allowedHosts: unknown): boolean {
  const allowed = normalizeAllowedHosts(allowedHosts);
  const candidates = sourceHostCandidates(request);
  return allowed.some((rule) => candidates.some((host) => host === rule || host.endsWith(`.${rule}`)));
}

export function parseStoredHosts(value: unknown): string[] {
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return []; }
  }
  return normalizeAllowedHosts(value);
}
