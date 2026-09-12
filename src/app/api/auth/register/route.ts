import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withTransaction } from "@/lib/db";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

const registrationSchema = z.object({
  company: z.string().trim().min(2).max(160),
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(128),
});

export async function POST(request: Request) {
  const parsed = registrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados de cadastro inválidos." }, { status: 422 });

  const { company, name, email, password } = parsed.data;
  const passwordHash = await hash(password, 12);
  const slug = `${company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${randomUUID().slice(0, 8)}`;

  try {
    const result = await withTransaction(async (connection) => {
      const [tenant] = await connection.execute<any>(
        "INSERT INTO tenants (public_id, name, slug) VALUES (?, ?, ?)",
        [randomUUID(), company, slug],
      );
      const tenantId = Number(tenant.insertId);
      const [user] = await connection.execute<any>(
        "INSERT INTO users (tenant_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, 'owner')",
        [tenantId, name, email, passwordHash],
      );
      const [board] = await connection.execute<any>(
        "INSERT INTO boards (tenant_id, name, description) VALUES (?, 'Funil de vendas', 'Quadro inicial do CRM')",
        [tenantId],
      );
      const boardId = Number(board.insertId);
      await connection.query(
        "INSERT INTO board_stages (board_id, name, position) VALUES (?, 'Novo', 0), (?, 'Em atendimento', 1), (?, 'Ganho', 2), (?, 'Perdido', 3)",
        [boardId, boardId, boardId, boardId],
      );
      return { tenantId, userId: Number(user.insertId) };
    });
    const token = await createSession(result.userId, result.tenantId);
    const response = NextResponse.json({ ok: true }, { status: 201 });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ER_DUP_ENTRY") return NextResponse.json({ error: "Não foi possível concluir o cadastro." }, { status: 409 });
    return NextResponse.json({ error: "Não foi possível concluir o cadastro." }, { status: 500 });
  }
}
