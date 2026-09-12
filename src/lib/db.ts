import mysql, { type PoolConnection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { serverEnv } from "./env";

const globalForDb = globalThis as unknown as { m7Pool?: mysql.Pool };

export function db() {
  if (!globalForDb.m7Pool) {
    const env = serverEnv();
    globalForDb.m7Pool = mysql.createPool({
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: "utf8mb4",
      ssl: env.DB_SSL ? {} : undefined,
      enableKeepAlive: true,
    });
  }
  return globalForDb.m7Pool;
}

export async function withTransaction<T>(callback: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await db().getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export type DbRow = RowDataPacket & Record<string, unknown>;
export type DbResult = ResultSetHeader;
