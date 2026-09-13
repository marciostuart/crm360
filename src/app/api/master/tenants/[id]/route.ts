import { NextResponse } from "next/server";
import { z } from "zod";
import { db, type DbRow } from "@/lib/db";
import { getMasterSession } from "@/lib/auth/master-session";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/http";
import { positiveId } from "@/lib/request";
import { writeMasterAudit } from "@/lib/master/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

const tenantSchema = z.object({
  name: z.string().trim().min(2).max(160), slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), status: z.enum(["trial", "active", "suspended", "cancelled"]), plan_id: z.coerce.number().int().positive().nullable(),
  legal_name: z.string().trim().max(160).nullable(), document: z.string().trim().max(32).nullable(), contact_email: z.string().trim().email().max(254).nullable(), contact_phone: z.string().trim().max(32).nullable(), website: z.string().trim().max(255).nullable(), postal_code: z.string().trim().max(16).nullable(), address: z.string().trim().max(255).nullable(), city: z.string().trim().max(120).nullable(), state: z.string().trim().length(2).toUpperCase().nullable(),
});

async function getTenant(id: number) {
  const [rows] = await db().execute<DbRow[]>("SELECT t.id, t.public_id, t.name, t.legal_name, t.slug, t.document, t.plan_id, p.name AS plan_name, t.contact_email, t.contact_phone, t.website, t.postal_code, t.address, t.city, t.state, t.status, t.created_at, t.updated_at FROM tenants t LEFT JOIN plans p ON p.id = t.plan_id WHERE t.id = ? LIMIT 1", [id]);
  return rows[0];
}

export async function GET(_: Request, context: Context) {
  const master = await getMasterSession(); if (!master) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const id = positiveId((await context.params).id); if (!id) return NextResponse.json({ error: "Empresa inválida." }, { status: 422 });
  const tenant = await getTenant(id); if (!tenant) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  const [users] = await db().execute<DbRow[]>("SELECT id, name, email, CASE role WHEN 'owner' THEN 'admin' WHEN 'supervisor' THEN 'manager' WHEN 'attendant' THEN 'operator' ELSE role END AS role, status, last_login_at, created_at FROM users WHERE tenant_id = ? ORDER BY id", [id]);
  const [counts] = await db().execute<DbRow[]>(`SELECT (SELECT COUNT(*) FROM contacts WHERE tenant_id = ?) AS contacts_count, (SELECT COUNT(*) FROM conversations WHERE tenant_id = ?) AS conversations_count, (SELECT COUNT(*) FROM deals WHERE tenant_id = ?) AS deals_count, (SELECT COUNT(*) FROM evolution_connections WHERE tenant_id = ?) AS connections_count`, [id, id, id, id]);
  return NextResponse.json({ ok: true, tenant, users, counts: counts[0] ?? {} });
}

export async function PATCH(request: Request, context: Context) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
  const master = await getMasterSession(); if (!master) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const id = positiveId((await context.params).id); if (!id) return NextResponse.json({ error: "Empresa inválida." }, { status: 422 });
  const current = await getTenant(id); if (!current) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const input = tenantSchema.safeParse({ ...current, ...body }); if (!input.success) return NextResponse.json({ error: "Dados cadastrais inválidos." }, { status: 422 });
  try {
    if (input.data.plan_id !== null) { const [plans] = await db().execute<DbRow[]>("SELECT id FROM plans WHERE id = ? AND active = TRUE LIMIT 1", [input.data.plan_id]); if (!plans[0]) return NextResponse.json({ error: "Plano inválido ou inativo." }, { status: 422 }); }
    await db().execute(`UPDATE tenants SET name = ?, legal_name = ?, slug = ?, document = ?, contact_email = ?, contact_phone = ?, website = ?, postal_code = ?, address = ?, city = ?, state = ?, status = ?, plan_id = ? WHERE id = ?`, [input.data.name, input.data.legal_name || null, input.data.slug, input.data.document || null, input.data.contact_email || null, input.data.contact_phone || null, input.data.website || null, input.data.postal_code || null, input.data.address || null, input.data.city || null, input.data.state || null, input.data.status, input.data.plan_id, id]);
    await writeMasterAudit(master.id, "tenant.update", id, request, { status: input.data.status });
    return NextResponse.json({ ok: true });
  } catch (error) { if ((error as { code?: string }).code === "ER_DUP_ENTRY") return NextResponse.json({ error: "Este slug já está em uso." }, { status: 409 }); return NextResponse.json({ error: "Não foi possível atualizar a empresa." }, { status: 500 }); }
}

export async function DELETE(request: Request, context: Context) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
  const master = await getMasterSession(); if (!master) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const id = positiveId((await context.params).id); if (!id) return NextResponse.json({ error: "Empresa inválida." }, { status: 422 });
  const tenant = await getTenant(id); if (!tenant) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  const body = await request.json().catch(() => null) as { confirmation?: unknown } | null;
  if (body?.confirmation !== tenant.slug) return NextResponse.json({ error: "Digite o slug da empresa para confirmar a exclusão." }, { status: 422 });
  await writeMasterAudit(master.id, "tenant.delete", id, request, { slug: tenant.slug, name: tenant.name });
  await db().execute("DELETE FROM tenants WHERE id = ?", [id]);
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request, context: Context) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
  const master = await getMasterSession(); if (!master) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const id = positiveId((await context.params).id); if (!id) return NextResponse.json({ error: "Empresa inválida." }, { status: 422 });
  const [users] = await db().execute<DbRow[]>("SELECT u.id, u.name FROM users u JOIN tenants t ON t.id = u.tenant_id WHERE u.tenant_id = ? AND u.status = 'active' AND t.status IN ('trial', 'active') AND u.role IN ('admin', 'owner') ORDER BY u.id LIMIT 1", [id]);
  if (!users[0]) return NextResponse.json({ error: "A empresa não possui um administrador ativo." }, { status: 422 });
  const token = await createSession(Number(users[0].id), id, master.id);
  await writeMasterAudit(master.id, "tenant.impersonate", id, request, { user_id: Number(users[0].id) });
  const response = NextResponse.json({ ok: true, redirect: "/dashboard" });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}
