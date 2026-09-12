import assert from "node:assert/strict";
import test from "node:test";
import { signLeadPayload, verifyLeadSignature } from "../src/lib/webhooks/hmac";
import { normalizeEvolutionMessages } from "../src/lib/evolution/message";

test("aceita assinatura HMAC válida", () => {
  const body = JSON.stringify({ name: "Ana", phone: "5531999999999" });
  const timestamp = "1700000000";
  const nonce = "nonce-1";
  const signature = signLeadPayload(body, timestamp, nonce, "secret");
  assert.equal(verifyLeadSignature(body, { timestamp, nonce, signature }, "secret", 1700000000), true);
});

test("rejeita corpo alterado, segredo incorreto e replay temporal", () => {
  const body = "{}";
  const timestamp = "1700000000";
  const nonce = "nonce-1";
  const signature = signLeadPayload(body, timestamp, nonce, "secret");
  assert.equal(verifyLeadSignature("{\"alterado\":true}", { timestamp, nonce, signature }, "secret", 1700000000), false);
  assert.equal(verifyLeadSignature(body, { timestamp, nonce, signature }, "wrong", 1700000000), false);
  assert.equal(verifyLeadSignature(body, { timestamp, nonce, signature }, "secret", 1700000401), false);
});

test("normaliza mensagem individual e ignora grupos", () => {
  const result = normalizeEvolutionMessages({
    event: "messages.upsert",
    data: [
      { key: { id: "msg-1", remoteJid: "5531999999999@s.whatsapp.net", fromMe: false }, pushName: "Ana", message: { conversation: "Olá" }, messageType: "conversation" },
      { key: { id: "group-1", remoteJid: "123@g.us", fromMe: false }, message: { conversation: "grupo" } },
    ],
  });
  assert.equal(result.length, 1);
  assert.deepEqual(result[0], { externalId: "msg-1", phone: "5531999999999", contactName: "Ana", content: "Olá", type: "text", fromMe: false });
});
