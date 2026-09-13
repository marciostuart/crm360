import { db } from "@/lib/db";

export async function writeMasterAudit(masterAdminId: number, action: string, tenantId: number | null, request: Request, metadata: Record<string, unknown> = {}) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = (forwarded || request.headers.get("x-real-ip") || "").slice(0, 45) || null;
  await db().execute(
    "INSERT INTO platform_audit_logs (platform_admin_id, tenant_id, action, metadata, ip_address) VALUES (?, ?, ?, ?, ?)",
    [masterAdminId, tenantId, action.slice(0, 80), JSON.stringify(metadata), ip],
  );
}
