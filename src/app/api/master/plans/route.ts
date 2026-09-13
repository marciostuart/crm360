import { NextResponse } from "next/server";
import { z } from "zod";
import { db, type DbRow } from "@/lib/db";
import { getMasterSession } from "@/lib/auth/master-session";
import { isSameOrigin } from "@/lib/http";
import { writeMasterAudit } from "@/lib/master/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const planSchema = z.object({ name: z.string().trim().min(2).max(120), slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), description: z.string().trim().max(255).nullable(), price_cents: z.coerce.number().int().min(0).max(2_000_000_00), max_users: z.coerce.number().int().min(0).max(1_000_000), max_connections: z.coerce.number().int().min(0).max(1_000_000), max_contacts: z.coerce.number().int().min(0).max(10_000_000), max_boards: z.coerce.number().int().min(0).max(1_000_000), max_deals: z.coerce.number().int().min(0).max(10_000_000), max_messages_month: z.coerce.number().int().min(0).max(100_000_000), active: z.coerce.boolean() });

export async function GET() {
  const master = await getMasterSession(); if (!master) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const [plans] = await db().execute<DbRow[]>("SELECT id, name, slug, description, price_cents, max_users, max_connections, max_contacts, max_boards, max_deals, max_messages_month, active, created_at, updated_at FROM plans ORDER BY price_cents, id");
  return NextResponse.json({ ok: true, plans });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
  const master = await getMasterSession(); if (!master) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const parsed = planSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Dados do plano inválidos." }, { status: 422 });
  try {
    const [result] = await db().execute<any>("INSERT INTO plans (name, slug, description, price_cents, max_users, max_connections, max_contacts, max_boards, max_deals, max_messages_month, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [parsed.data.name, parsed.data.slug, parsed.data.description || null, parsed.data.price_cents, parsed.data.max_users, parsed.data.max_connections, parsed.data.max_contacts, parsed.data.max_boards, parsed.data.max_deals, parsed.data.max_messages_month, parsed.data.active]);
    await writeMasterAudit(master.id, "plan.create", null, request, { plan_id: Number(result.insertId), slug: parsed.data.slug });
    return NextResponse.json({ ok: true, id: Number(result.insertId) }, { status: 201 });
  } catch (error) { if ((error as { code?: string }).code === "ER_DUP_ENTRY") return NextResponse.json({ error: "Este slug de plano já está em uso." }, { status: 409 }); return NextResponse.json({ error: "Não foi possível criar o plano." }, { status: 500 }); }
}
