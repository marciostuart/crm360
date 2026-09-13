CREATE TABLE IF NOT EXISTS plans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  price_cents INT UNSIGNED NOT NULL DEFAULT 0,
  max_users INT UNSIGNED NOT NULL DEFAULT 0,
  max_connections INT UNSIGNED NOT NULL DEFAULT 0,
  max_contacts INT UNSIGNED NOT NULL DEFAULT 0,
  max_boards INT UNSIGNED NOT NULL DEFAULT 0,
  max_deals INT UNSIGNED NOT NULL DEFAULT 0,
  max_messages_month INT UNSIGNED NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_plans_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE tenants
  ADD COLUMN plan_id BIGINT UNSIGNED NULL,
  ADD KEY ix_tenants_plan (plan_id),
  ADD CONSTRAINT fk_tenants_plan FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE SET NULL;

INSERT INTO plans (name, slug, description, max_users, max_connections, max_contacts, max_boards, max_deals, max_messages_month)
SELECT 'Plano Inicial', 'inicial', 'Limites básicos para começar', 3, 1, 500, 1, 500, 5000
 WHERE NOT EXISTS (SELECT 1 FROM plans WHERE slug = 'inicial');

UPDATE tenants t JOIN plans p ON p.slug = 'inicial' SET t.plan_id = p.id WHERE t.plan_id IS NULL;
