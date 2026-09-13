import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth/require-session";
import { contactInputSchema } from "@/lib/contacts/schema";
import { isValidNormalizedPhone, normalizePhone } from "@/lib/leads/schema";
import { apiError, jsonBody, positiveId } from "@/lib/request";
import { isSameOrigin } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  if (!isSameOrigin(request)) return apiError("Origem não autorizada.", 403);
  const id = positiveId((await context.params).id);
  if (!id) return apiError("Contato inválido.", 400);
  try {
    const session = await requireSession();
    const parsed = contactInputSchema.safeParse(await jsonBody(request));
    if (!parsed.success) return apiError("Dados do contato inválidos.", 422);
    const input = parsed.data; const phone = normalizePhone(input.phone);
    if (!isValidNormalizedPhone(phone)) return apiError("Telefone inválido. Informe DDI, DDD e número.", 422);
    const [result] = await db().execute<any>(
      `UPDATE contacts SET external_id = ?, name = ?, phone = ?, email = ?, source = ?, notes = ?, custom_fields = ?
        WHERE id = ? AND tenant_id = ?`,
      [input.external_id ?? null, input.name, phone, input.email ?? null, input.source ?? null, input.notes ?? null,
        input.custom_fields ? JSON.stringify(input.custom_fields) : null, id, session.tenantId],
    );
    if (!result.affectedRows) return apiError("Contato não encontrado.", 404);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if ((error as { code?: string }).code === "ER_DUP_ENTRY") return apiError("Já existe um contato com este telefone.", 409);
    return apiError(error instanceof Error && error.message === "UNAUTHORIZED" ? "Não autorizado." : "Não foi possível atualizar o contato.", error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500);
  }
}

export async function DELETE(request: Request, context: Context) {
  if (!isSameOrigin(request)) return apiError("Origem não autorizada.", 403);
  const id = positiveId((await context.params).id);
  if (!id) return apiError("Contato inválido.", 400);
  try {
    const session = await requireSession();
    const [result] = await db().execute<any>("DELETE FROM contacts WHERE id = ? AND tenant_id = ?", [id, session.tenantId]);
    if (!result.affectedRows) return apiError("Contato não encontrado.", 404);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error instanceof Error && error.message === "UNAUTHORIZED" ? "Não autorizado." : "Não foi possível excluir o contato.", error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500);
  }
}
