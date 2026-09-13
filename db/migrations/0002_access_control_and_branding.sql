ALTER TABLE users
  MODIFY role ENUM('owner', 'admin', 'supervisor', 'attendant', 'manager', 'operator') NOT NULL DEFAULT 'operator';

UPDATE users SET role = 'admin' WHERE role = 'owner';
UPDATE users SET role = 'manager' WHERE role = 'supervisor';
UPDATE users SET role = 'operator' WHERE role = 'attendant';

ALTER TABLE users
  MODIFY role ENUM('admin', 'manager', 'operator') NOT NULL DEFAULT 'operator';

ALTER TABLE tenants
  ADD COLUMN brand_color CHAR(7) NOT NULL DEFAULT '#344a99',
  ADD COLUMN logo_data MEDIUMBLOB NULL,
  ADD COLUMN logo_mime VARCHAR(40) NULL,
  ADD COLUMN logo_updated_at DATETIME(3) NULL;
