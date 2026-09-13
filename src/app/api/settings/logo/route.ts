import { NextResponse } from "next/server";
import { db, type DbRow } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return new NextResponse(null, { status: 401 });
  const [rows] = await db().execute<DbRow[]>("SELECT logo_data, logo_mime FROM tenants WHERE id = ? LIMIT 1", [session.tenantId]);
  const logo = rows[0];
  if (!logo?.logo_data) return new NextResponse(null, { status: 404 });
  return new NextResponse(logo.logo_data as BodyInit, {
    status: 200,
    headers: { "Content-Type": String(logo.logo_mime || "image/webp"), "Cache-Control": "private, max-age=300" },
  });
}
