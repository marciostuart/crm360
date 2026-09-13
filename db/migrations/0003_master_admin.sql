CREATE TABLE IF NOT EXISTS platform_admins (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  status ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
  failed_login_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME(3) NULL,
  last_login_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_platform_admin_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS platform_admin_sessions (
  token_hash CHAR(64) NOT NULL,
  platform_admin_id BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (token_hash),
  KEY ix_platform_sessions_expiry (expires_at),
  CONSTRAINT fk_platform_sessions_admin FOREIGN KEY (platform_admin_id) REFERENCES platform_admins(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE sessions
  ADD COLUMN platform_admin_id BIGINT UNSIGNED NULL,
  ADD KEY ix_sessions_platform_admin (platform_admin_id),
  ADD CONSTRAINT fk_sessions_platform_admin FOREIGN KEY (platform_admin_id) REFERENCES platform_admins(id) ON DELETE SET NULL;

ALTER TABLE tenants
  ADD COLUMN legal_name VARCHAR(160) NULL,
  ADD COLUMN document VARCHAR(32) NULL,
  ADD COLUMN contact_email VARCHAR(254) NULL,
  ADD COLUMN contact_phone VARCHAR(32) NULL,
  ADD COLUMN website VARCHAR(255) NULL,
  ADD COLUMN postal_code VARCHAR(16) NULL,
  ADD COLUMN address VARCHAR(255) NULL,
  ADD COLUMN city VARCHAR(120) NULL,
  ADD COLUMN state CHAR(2) NULL;

CREATE TABLE IF NOT EXISTS platform_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  platform_admin_id BIGINT UNSIGNED NULL,
  tenant_id BIGINT UNSIGNED NULL,
  action VARCHAR(80) NOT NULL,
  metadata JSON NULL,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_platform_audit_tenant (tenant_id, created_at),
  CONSTRAINT fk_platform_audit_admin FOREIGN KEY (platform_admin_id) REFERENCES platform_admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
