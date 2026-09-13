import { db, type DbRow } from "@/lib/db";

type LimitKey = "max_users" | "max_connections" | "max_contacts" | "max_boards" | "max_deals";

export async function checkTenantLimit(tenantId: number, key: LimitKey, additional = 1): Promise<{ allowed: boolean; limit: number | null }> {
  try {
    const [rows] = await db().execute<DbRow[]>(
      `SELECT p.${key} AS plan_limit,
              CASE '${key}'
                WHEN 'max_users' THEN (SELECT COUNT(*) FROM users WHERE tenant_id = ? AND status <> 'cancelled')
                WHEN 'max_connections' THEN (SELECT COUNT(*) FROM evolution_connections WHERE tenant_id = ?)
                WHEN 'max_contacts' THEN (SELECT COUNT(*) FROM contacts WHERE tenant_id = ?)
                WHEN 'max_boards' THEN (SELECT COUNT(*) FROM boards WHERE tenant_id = ?)
                WHEN 'max_deals' THEN (SELECT COUNT(*) FROM deals WHERE tenant_id = ?)
              END AS current_total
         FROM tenants t LEFT JOIN plans p ON p.id = t.plan_id AND p.active = TRUE
        WHERE t.id = ? LIMIT 1`,
      [tenantId, tenantId, tenantId, tenantId, tenantId, tenantId],
    );
    const row = rows[0];
    if (!row || row.plan_limit == null || Number(row.plan_limit) === 0) return { allowed: true, limit: row?.plan_limit == null ? null : 0 };
    const limit = Number(row.plan_limit);
    return { allowed: Number(row.current_total ?? 0) + additional <= limit, limit };
  } catch {
    // Limits are optional until the billing migration is applied; never block the CRM in that window.
    return { allowed: true, limit: null };
  }
}
