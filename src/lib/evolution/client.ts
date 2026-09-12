import { serverEnv } from "@/lib/env";

export class EvolutionApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const env = serverEnv();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${env.EVOLUTION_API_URL.replace(/\/$/, "")}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { apikey: env.EVOLUTION_API_KEY, "Content-Type": "application/json", ...(init.headers ?? {}) },
      cache: "no-store",
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new EvolutionApiError(response.status, "A Evolution API recusou a solicitação.");
    return body as T;
  } finally { clearTimeout(timeout); }
}

export function getConnectionState(instanceName: string) {
  return request<{ instance?: { state?: string }; state?: string }>(`/instance/connectionState/${encodeURIComponent(instanceName)}`);
}

export function sendText(instanceName: string, number: string, text: string) {
  return request(`/message/sendText/${encodeURIComponent(instanceName)}`, { method: "POST", body: JSON.stringify({ number, text }) });
}

export function configureWebhook(instanceName: string, url: string) {
  return request(`/webhook/set/${encodeURIComponent(instanceName)}`, { method: "POST", body: JSON.stringify({ webhook: { enabled: true, url, byEvents: false, base64: false, events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"] } }) });
}
