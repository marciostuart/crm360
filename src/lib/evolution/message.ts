import { createHash } from "node:crypto";

export type NormalizedEvolutionMessage = {
  externalId: string;
  phone: string;
  contactName: string;
  content: string;
  type: "text" | "image" | "audio" | "video" | "file";
  fromMe: boolean;
};

function firstObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function textFrom(raw: Record<string, any>, message: Record<string, any>): string {
  return String(raw.text ?? raw.content?.text ?? message.conversation ?? message.extendedTextMessage?.text ??
    message.imageMessage?.caption ?? message.videoMessage?.caption ?? message.documentMessage?.caption ?? "");
}

export function normalizeEvolutionMessages(payload: Record<string, any>): NormalizedEvolutionMessage[] {
  const source = payload.data ?? payload.messages ?? payload.message;
  const rawMessages = Array.isArray(source) ? source : source ? [source] : [];
  return rawMessages.flatMap((candidate) => {
    const raw = firstObject(candidate);
    const key = firstObject(raw.key);
    const remoteJid = String(key.remoteJid ?? raw.remoteJid ?? raw.sender ?? raw.chatid ?? "");
    if (!remoteJid || remoteJid.includes("@g.us") || remoteJid.includes("status@")) return [];
    const phone = remoteJid.split("@")[0].replace(/\D/g, "");
    if (phone.length < 8 || phone.length > 20) return [];
    const message = firstObject(raw.message);
    const rawType = String(raw.messageType ?? raw.type ?? (Object.keys(message)[0] || "conversation")).toLowerCase();
    const type: NormalizedEvolutionMessage["type"] = rawType.includes("image") ? "image" : rawType.includes("audio") ? "audio" : rawType.includes("video") ? "video" : rawType.includes("document") || rawType.includes("file") ? "file" : "text";
    const rawId = String(key.id ?? raw.messageId ?? raw.id ?? "");
    const externalId = rawId || `evo_${createHash("sha256").update(JSON.stringify(raw)).digest("hex").slice(0, 48)}`;
    return [{ externalId, phone, contactName: String(raw.pushName ?? raw.senderName ?? phone).slice(0, 160), content: textFrom(raw, message) || `[${type}]`, type, fromMe: Boolean(key.fromMe ?? raw.fromMe) }];
  });
}
