import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { db } from "../src/lib/db";

const migration = await readFile(resolve(process.cwd(), "db/migrations/0001_initial.sql"), "utf8");
const statements = migration.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
const connection = await db().getConnection();
try {
  await connection.beginTransaction();
  for (const statement of statements) await connection.query(statement);
  await connection.commit();
  console.log(`Migração aplicada: ${statements.length} instruções.`);
} catch (error) {
  await connection.rollback();
  console.error("Falha na migração.");
  process.exitCode = 1;
} finally {
  connection.release();
  await db().end();
}
