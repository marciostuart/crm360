import { db } from "@/lib/db";
import { clientIp } from "./rate-limit";

export async function writeTenantAudit(input: { tenantId: number; userId?: number | null; action: string; entityType: string; entityId?: string | number | null; metadata?: unknown; request?: Request }) {
  await db().execute(`INSERT INTO tenant_audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)`, [input.tenantId, input.userId ?? null, input.action.slice(0, 80), input.entityType.slice(0, 40), input.entityId == null ? null : String(input.entityId).slice(0, 191), input.metadata == null ? null : JSON.stringify(input.metadata), input.request ? clientIp(input.request) : null]);
}
