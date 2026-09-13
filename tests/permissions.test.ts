import assert from "node:assert/strict";
import test from "node:test";
import { isAdmin, isManager } from "../src/lib/auth/require-session";
import type { CurrentSession } from "../src/lib/auth/session";

function session(role: string): CurrentSession {
  return { userId: 1, tenantId: 1, userName: "Teste", userEmail: "teste@example.com", role, tenantName: "Tenant", brandColor: "#344a99", hasLogo: false, brandingUpdatedAt: "default" };
}

test("somente admin gerencia usuários, endpoints e identidade", () => {
  assert.equal(isAdmin(session("admin")), true);
  assert.equal(isAdmin(session("manager")), false);
  assert.equal(isAdmin(session("operator")), false);
});

test("gerente mantém acesso operacional, operador não recebe permissão administrativa", () => {
  assert.equal(isManager(session("admin")), true);
  assert.equal(isManager(session("manager")), true);
  assert.equal(isManager(session("operator")), false);
});
