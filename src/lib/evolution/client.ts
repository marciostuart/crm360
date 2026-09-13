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

export function createInstance(instanceName: string) {
  return request<{ instance?: { token?: string; instanceName?: string }; hash?: string; token?: string }>("/instance/create", {
    method: "POST",
    body: JSON.stringify({ instanceName, integration: "WHATSAPP-BAILEYS", qrcode: true }),
  });
}

export function connectInstance(instanceName: string) {
  return request<{ base64?: string; code?: string; qrcode?: { base64?: string; code?: string } }>(`/instance/connect/${encodeURIComponent(instanceName)}`);
}

export function deleteInstance(instanceName: string) {
  return request(`/instance/delete/${encodeURIComponent(instanceName)}`, { method: "DELETE" });
}

export function logoutInstance(instanceName: string) {
  return request(`/instance/logout/${encodeURIComponent(instanceName)}`, { method: "DELETE" });
}

export function sendText(instanceName: string, number: string, text: string) {
  return request(`/message/sendText/${encodeURIComponent(instanceName)}`, { method: "POST", body: JSON.stringify({ number, text }) });
}

export function configureWebhook(instanceName: string, url: string, webhookSecret: string) {
  return request(`/webhook/set/${encodeURIComponent(instanceName)}`, { method: "POST", body: JSON.stringify({ enabled: true, url, webhook_by_events: false, base64: false, headers: { "X-M7-Evolution-Token": webhookSecret }, events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"] }) });
}

export function configureWebsocket(instanceName: string) {
  return request(`/websocket/set/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    body: JSON.stringify({ enabled: true, events: ["QRCODE_UPDATED", "CONNECTION_UPDATE", "MESSAGES_UPSERT", "MESSAGES_UPDATE"] }),
  });
}
