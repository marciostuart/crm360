import assert from "node:assert/strict";
import test from "node:test";
import { mapIncomingLead } from "../src/lib/leads/mapping";
import { isAllowedSourceHost } from "../src/lib/webhooks/source-host";
import { isValidNormalizedPhone, normalizePhone, phoneLookupCandidates } from "../src/lib/leads/schema";

test("mapeia campos aninhados e itens de array para o lead", () => {
  const payload = { lead: { full_name: "Ana", phones: [{ value: "+55 (31) 99999-0000" }], company: "360" } };
  const result = mapIncomingLead(payload, { name: "lead.full_name", phone: "lead.phones.0.value", custom_fields: { empresa: "lead.company" } });
  assert.deepEqual(result, { name: "Ana", phone: "+55 (31) 99999-0000", custom_fields: { empresa: "360" } });
});

test("aceita apenas domínio de origem configurado", () => {
  const allowed = ["integrador.exemplo.com.br"];
  assert.equal(isAllowedSourceHost(new Request("https://crm.360bh.com.br/api/v1/leads/id", { headers: { Origin: "https://integrador.exemplo.com.br" } }), allowed), true);
  assert.equal(isAllowedSourceHost(new Request("https://crm.360bh.com.br/api/v1/leads/id", { headers: { Origin: "https://outro.exemplo.com.br" } }), allowed), false);
  assert.equal(isAllowedSourceHost(new Request("https://crm.360bh.com.br/api/v1/leads/id"), allowed), false);
});

test("normaliza telefone brasileiro para DDI, DDD e número", () => {
  assert.equal(normalizePhone("(31) 98021-3332"), "5531980213332");
  assert.equal(normalizePhone("+55 (31) 98021-3332"), "5531980213332");
  assert.equal(normalizePhone("0055 31 98021-3332"), "5531980213332");
  assert.equal(isValidNormalizedPhone("5531980213332"), true);
  assert.equal(isValidNormalizedPhone("980213332"), false);
  assert.deepEqual(phoneLookupCandidates("5531980213332"), ["5531980213332", "31980213332"]);
});
