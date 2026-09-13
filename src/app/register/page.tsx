"use client";

import Link from "next/link";
import { useState } from "react";
import Turnstile from "@/components/turnstile";

export default function RegisterPage() {
  const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [loading, setLoading] = useState(false); const [turnstileToken, setTurnstileToken] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage(""); setLoading(true);
    const form = new FormData(event.currentTarget); if (!turnstileToken) { setError("Confirme a verificação de segurança."); setLoading(false); return; }
    try {
      const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...Object.fromEntries(form), turnstileToken }) });
      if (!response.ok) { const body = await response.json().catch(() => ({})); setError(body.error ?? "Não foi possível criar a conta."); return; }
      setMessage("Cadastro realizado. Verifique seu e-mail para ativar o acesso.");
    } catch { setError("Não foi possível conectar ao sistema."); } finally { setLoading(false); }
  }
  return <main className="auth-page"><section className="auth-card">
    <div className="brand">CRM360</div><h1>Criar ambiente</h1><p className="muted">Seu primeiro usuário será o proprietário do tenant.</p>
    <form onSubmit={submit}>
      <div className="field"><label htmlFor="company">Empresa</label><input id="company" name="company" required maxLength={160} /></div>
      <div className="field"><label htmlFor="name">Seu nome</label><input id="name" name="name" required maxLength={160} autoComplete="name" /></div>
      <div className="field"><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" required autoComplete="email" /></div>
      <div className="field"><label htmlFor="password">Senha (mínimo 12 caracteres)</label><input id="password" name="password" type="password" minLength={12} required autoComplete="new-password" /></div>
      <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""} action="register" onToken={setTurnstileToken} />
      {error && <div className="error" role="alert">{error}</div>}{message && <div className="notice" role="status">{message}</div>}
      <button className="primary-button" disabled={loading}>{loading ? "Criando..." : "Criar ambiente"}</button>
    </form>
    <div className="auth-footer">Já possui acesso? <Link href="/login">Entrar</Link></div>
  </section></main>;
}
