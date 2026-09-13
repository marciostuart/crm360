ALTER TABLE tenants
  ADD COLUMN webhook_payload_retention_days SMALLINT UNSIGNED NOT NULL DEFAULT 90;

CREATE TABLE IF NOT EXISTS request_rate_limits (
  bucket VARCHAR(40) NOT NULL,
  client_hash CHAR(64) NOT NULL,
  request_count INT UNSIGNED NOT NULL DEFAULT 0,
  reset_at DATETIME(3) NOT NULL,
  PRIMARY KEY (bucket, client_hash),
  KEY ix_rate_limit_reset (reset_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tenant_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id VARCHAR(191) NULL,
  metadata JSON NULL,
  ip_address VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_tenant_audit_tenant_date (tenant_id, created_at),
  CONSTRAINT fk_tenant_audit_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_tenant_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
