ALTER TABLE lead_webhook_endpoints
  ADD COLUMN mode ENUM('test', 'active') NOT NULL DEFAULT 'test',
  ADD COLUMN sample_payload JSON NULL,
  ADD COLUMN sample_updated_at DATETIME(3) NULL,
  ADD COLUMN tags JSON NULL;

ALTER TABLE contacts
  ADD COLUMN tags JSON NULL;

-- Existing HMAC endpoints were already in production; only newly created endpoints start in TESTE.
UPDATE lead_webhook_endpoints SET mode = 'active' WHERE field_mapping IS NULL AND sample_payload IS NULL;
