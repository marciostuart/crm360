import nodemailer from "nodemailer";
import { serverEnv } from "@/lib/env";

const sender = "suporte@360bh.com.br";

function escapeHtml(value: string) {
  return value.replace(/[&<>'\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" })[character] ?? character);
}

function transporter() {
  const env = serverEnv();
  if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_USER || !env.SMTP_PASSWORD) throw new Error("SMTP_NOT_CONFIGURED");
  return nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE, auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } });
}

export async function sendAccountEmail(options: { to: string; name: string; subject: string; title: string; message: string; actionLabel: string; actionUrl: string }) {
  const safeName = escapeHtml(options.name);
  const safeMessage = escapeHtml(options.message);
  await transporter().sendMail({ from: `CRM360 Suporte <${sender}>`, to: options.to, subject: options.subject, text: `${options.title}\n\nOlá, ${options.name}.\n\n${options.message}\n\n${options.actionLabel}: ${options.actionUrl}\n\nSe você não solicitou esta mensagem, ignore este e-mail.`, html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#18212f"><h2>${options.title}</h2><p>Olá, ${safeName}.</p><p>${safeMessage}</p><p><a href="${options.actionUrl}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#344a99;color:#fff;text-decoration:none">${options.actionLabel}</a></p><p style="color:#64748b;font-size:12px">Se você não solicitou esta mensagem, ignore este e-mail.</p></div>` });
}
