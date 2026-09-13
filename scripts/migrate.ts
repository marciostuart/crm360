import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { db } from "../src/lib/db";

const migrationDirectory = resolve(process.cwd(), "db/migrations");
const files = (await readdir(migrationDirectory)).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
const connection = await db().getConnection();
try {
  await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(120) NOT NULL PRIMARY KEY,
    applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  for (const file of files) {
    const [applied] = await connection.query<any[]>("SELECT version FROM schema_migrations WHERE version = ? LIMIT 1", [file]);
    if (applied[0]) continue;
    const migration = await readFile(resolve(migrationDirectory, file), "utf8");
    const statements = migration.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
    await connection.beginTransaction();
    try {
      for (const statement of statements) await connection.query(statement);
      await connection.query("INSERT INTO schema_migrations (version) VALUES (?)", [file]);
      await connection.commit();
      console.log(`Migração aplicada: ${file}`);
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  }
  console.log("Migrações verificadas com sucesso.");
} catch (error) {
  console.error("Falha na migração.");
  process.exitCode = 1;
} finally {
  connection.release();
  await db().end();
}
