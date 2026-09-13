import { io, type Socket } from "socket.io-client";
import { db, type DbRow } from "@/lib/db";
import { serverEnv } from "@/lib/env";

export type EvolutionRealtimeEvent = { event: string; state?: string; qrcode?: string };
type Listener = (event: EvolutionRealtimeEvent) => void;
type Channel = { socket: Socket; listeners: Set<Listener> };
const channels = new Map<string, Channel>();

function normalize(eventName: string, payload: unknown): EvolutionRealtimeEvent {
  const value = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const data = (value.data && typeof value.data === "object" ? value.data : value) as Record<string, unknown>;
  const qr = (data.qrcode && typeof data.qrcode === "object" ? data.qrcode : {}) as Record<string, unknown>;
  const instance = data.instance && typeof data.instance === "object" ? data.instance as Record<string, unknown> : {};
  const state = data.state ?? instance.state;
  const qrcode = qr.base64 ?? data.base64;
  return { event: eventName, ...(state ? { state: String(state).toLowerCase() } : {}), ...(qrcode ? { qrcode: String(qrcode) } : {}) };
}

function publish(instanceName: string, eventName: string, payload: unknown) {
  const channel = channels.get(instanceName);
  if (!channel) return;
  const event = normalize(eventName, payload);
  if (event.state) void db().execute("UPDATE evolution_connections SET status = ? WHERE instance_name = ?", [event.state.slice(0, 40), instanceName]);
  else if (event.qrcode) void db().execute("UPDATE evolution_connections SET status = 'qr_pending' WHERE instance_name = ?", [instanceName]);
  channel.listeners.forEach((listener) => listener(event));
}

export function subscribeEvolution(instanceName: string, listener: Listener) {
  let channel = channels.get(instanceName);
  if (!channel) {
    const env = serverEnv();
    const socket = io(`${env.EVOLUTION_API_URL.replace(/\/$/, "")}/${encodeURIComponent(instanceName)}`, {
      transports: ["websocket"],
      extraHeaders: { apikey: env.EVOLUTION_API_KEY },
      reconnection: true,
    });
    channel = { socket, listeners: new Set() };
    channels.set(instanceName, channel);
    ["connection.update", "CONNECTION_UPDATE"].forEach((name) => socket.on(name, (payload) => publish(instanceName, name, payload)));
    ["qrcode.updated", "QRCODE_UPDATED"].forEach((name) => socket.on(name, (payload) => publish(instanceName, name, payload)));
  }
  channel.listeners.add(listener);
  return () => {
    const current = channels.get(instanceName);
    if (!current) return;
    current.listeners.delete(listener);
    if (current.listeners.size === 0) { current.socket.disconnect(); channels.delete(instanceName); }
  };
}

export async function findEvolutionInstance(publicId: string, tenantId: number) {
  const [rows] = await db().execute<DbRow[]>("SELECT instance_name FROM evolution_connections WHERE public_id = ? AND tenant_id = ?", [publicId, tenantId]);
  return rows[0]?.instance_name ? String(rows[0].instance_name) : null;
}
