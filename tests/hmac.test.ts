import assert from "node:assert/strict";
import test from "node:test";
import { signLeadPayload, verifyLeadSignature } from "../src/lib/webhooks/hmac";

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
