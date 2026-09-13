import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url(),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_NAME: z.string().regex(/^[A-Za-z0-9_]+$/),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_SSL: z.enum(["true", "false"]).default("true").transform((value) => value === "true"),
  SESSION_SECRET: z.string().min(32),
  APP_ENCRYPTION_KEY: z.string().min(1),
  EVOLUTION_API_URL: z.string().url(),
  EVOLUTION_API_KEY: z.string().min(1),
  TURNSTILE_SITE_KEY: z.string().min(1),
  TURNSTILE_SECRET_KEY: z.string().min(1),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: z.enum(["true", "false"]).default("true").transform((value) => value === "true"),
});

let cached: z.infer<typeof envSchema> | undefined;

export function serverEnv() {
  if (!cached) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      throw new Error("Configuração de ambiente inválida. Verifique as variáveis do servidor.");
    }
    cached = result.data;
  }
  return cached;
}

export function encryptionKey(): Buffer {
  const key = Buffer.from(serverEnv().APP_ENCRYPTION_KEY, "base64");
  if (key.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY deve ser uma chave base64 de 32 bytes.");
  }
  return key;
}
