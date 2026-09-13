import { stdin as input, stdout as output } from "node:process";
import { hash } from "bcryptjs";
import { db } from "../src/lib/db";

const email = process.argv[2]?.trim().toLowerCase();
const name = process.argv[3]?.trim() || "CRM360 Master";
if (!email || !/^\S+@\S+\.\S+$/.test(email)) { console.error("Uso: npm run master:create -- admin@dominio.com \"Nome\""); process.exit(1); }
function readHidden(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    output.write(prompt);
    let value = "";
    const onData = (chunk: Buffer) => {
      for (const character of chunk.toString()) {
        if (character === "\u0003") { input.setRawMode?.(false); input.pause(); process.exit(130); }
        if (character === "\r" || character === "\n") { input.setRawMode?.(false); input.pause(); input.removeListener("data", onData); output.write("\n"); resolve(value); return; }
        if (character === "\u007f") { value = value.slice(0, -1); continue; }
        value += character;
      }
    };
    input.setRawMode?.(true); input.resume(); input.on("data", onData);
  });
}
const password = await readHidden("Senha Master (mínimo 12 caracteres): ");
if (password.length < 12 || password.length > 128) { console.error("A senha deve ter entre 12 e 128 caracteres."); process.exit(1); }
try {
  const passwordHash = await hash(password, 12);
  await db().execute(
    `INSERT INTO platform_admins (name, email, password_hash, status) VALUES (?, ?, ?, 'active')
     ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash), status = 'active', locked_until = NULL, failed_login_attempts = 0`,
    [name, email, passwordHash],
  );
  console.log("Master Admin criado ou atualizado com sucesso.");
} finally { await db().end(); }
