import { NextResponse } from "next/server";
import { db, type DbRow } from "@/lib/db";
import { requireSession } from "@/lib/auth/require-session";
import { contactInputSchema } from "@/lib/contacts/schema";
import { normalizePhone } from "@/lib/leads/schema";
import { apiError, jsonBody } from "@/lib/request";
import { isSameOrigin } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const url = new URL(request.url);
    const rawSearch = url.searchParams.get("search")?.trim() ?? "";
    const search = rawSearch.slice(0, 120);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50) || 50, 1), 100);
    const offset = Math.max(Number(url.searchParams.get("offset") ?? 0) || 0, 0);
    const like = `%${search}%`;
    const [rows] = await db().execute<DbRow[]>(
      `SELECT id, external_id, name, phone, email, source, notes, custom_fields, created_at, updated_at
         FROM contacts WHERE tenant_id = ?
           AND (? = '' OR name LIKE ? OR phone LIKE ? OR email LIKE ?)
        ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
      [session.tenantId, search, like, like, like, limit, offset],
    );
    return NextResponse.json({ ok: true, contacts: rows });
  } catch (error) {
    return apiError(error instanceof Error && error.message === "UNAUTHORIZED" ? "Não autorizado." : "Não foi possível listar contatos.", error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500);
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError("Origem não autorizada.", 403);
  try {
    const session = await requireSession();
    const parsed = contactInputSchema.safeParse(await jsonBody(request));
    if (!parsed.success) return apiError("Dados do contato inválidos.", 422);
    const input = parsed.data;
    const phone = normalizePhone(input.phone);
    if (phone.length < 8 || phone.length > 20) return apiError("Telefone inválido.", 422);
    const [result] = await db().execute<any>(
      `INSERT INTO contacts (tenant_id, external_id, name, phone, email, source, notes, custom_fields)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [session.tenantId, input.external_id ?? null, input.name, phone, input.email ?? null,
        input.source ?? null, input.notes ?? null, input.custom_fields ? JSON.stringify(input.custom_fields) : null],
    );
    return NextResponse.json({ ok: true, id: Number(result.insertId) }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "ER_DUP_ENTRY") return apiError("Já existe um contato com este telefone.", 409);
    return apiError(error instanceof Error && error.message === "UNAUTHORIZED" ? "Não autorizado." : "Não foi possível criar o contato.", error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500);
  }
}
