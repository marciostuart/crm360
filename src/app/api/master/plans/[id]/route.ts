import { NextResponse } from "next/server";
import { z } from "zod";
import { db, type DbRow } from "@/lib/db";
import { getMasterSession } from "@/lib/auth/master-session";
import { isSameOrigin } from "@/lib/http";
import { positiveId } from "@/lib/request";
import { writeMasterAudit } from "@/lib/master/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const schema = z.object({ name: z.string().trim().min(2).max(120), slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), description: z.string().trim().max(255).nullable(), price_cents: z.coerce.number().int().min(0).max(200_000_000), max_users: z.coerce.number().int().min(0).max(1_000_000), max_connections: z.coerce.number().int().min(0).max(1_000_000), max_contacts: z.coerce.number().int().min(0).max(10_000_000), max_boards: z.coerce.number().int().min(0).max(1_000_000), max_deals: z.coerce.number().int().min(0).max(10_000_000), max_messages_month: z.coerce.number().int().min(0).max(100_000_000), active: z.coerce.boolean() });

export async function PATCH(request: Request, context: Context) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
  const master = await getMasterSession(); if (!master) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const id = positiveId((await context.params).id); if (!id) return NextResponse.json({ error: "Plano inválido." }, { status: 422 });
  const [currentRows] = await db().execute<DbRow[]>("SELECT * FROM plans WHERE id = ? LIMIT 1", [id]); if (!currentRows[0]) return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });
  const parsed = schema.safeParse({ ...currentRows[0], ...await request.json().catch(() => null) }); if (!parsed.success) return NextResponse.json({ error: "Dados do plano inválidos." }, { status: 422 });
  try { await db().execute("UPDATE plans SET name = ?, slug = ?, description = ?, price_cents = ?, max_users = ?, max_connections = ?, max_contacts = ?, max_boards = ?, max_deals = ?, max_messages_month = ?, active = ? WHERE id = ?", [parsed.data.name, parsed.data.slug, parsed.data.description || null, parsed.data.price_cents, parsed.data.max_users, parsed.data.max_connections, parsed.data.max_contacts, parsed.data.max_boards, parsed.data.max_deals, parsed.data.max_messages_month, parsed.data.active, id]); await writeMasterAudit(master.id, "plan.update", null, request, { plan_id: id, active: parsed.data.active }); return NextResponse.json({ ok: true }); } catch (error) { if ((error as { code?: string }).code === "ER_DUP_ENTRY") return NextResponse.json({ error: "Este slug de plano já está em uso." }, { status: 409 }); return NextResponse.json({ error: "Não foi possível atualizar o plano." }, { status: 500 }); }
}

export async function DELETE(request: Request, context: Context) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
  const master = await getMasterSession(); if (!master) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const id = positiveId((await context.params).id); if (!id) return NextResponse.json({ error: "Plano inválido." }, { status: 422 });
  const [assigned] = await db().execute<DbRow[]>("SELECT COUNT(*) AS total FROM tenants WHERE plan_id = ?", [id]); if (Number(assigned[0]?.total ?? 0) > 0) return NextResponse.json({ error: "Este plano está atribuído a empresas. Desative-o ou troque o plano antes de excluir." }, { status: 409 });
  const [result] = await db().execute<any>("DELETE FROM plans WHERE id = ?", [id]); if (!result.affectedRows) return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });
  await writeMasterAudit(master.id, "plan.delete", null, request, { plan_id: id }); return NextResponse.json({ ok: true });
}
