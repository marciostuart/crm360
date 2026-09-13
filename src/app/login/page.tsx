"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Turnstile from "@/components/turnstile";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setLoading(true);
    try {
      if (!turnstileToken) { setError("Confirme a verificação de segurança."); return; }
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, turnstileToken }) });
      if (!response.ok) { const body = await response.json().catch(() => ({})); setError(body.error ?? "E-mail ou senha inválidos."); return; }
      router.push("/dashboard"); router.refresh();
    } catch { setError("Não foi possível conectar ao sistema."); }
    finally { setLoading(false); }
  }

  return <main className="auth-page"><section className="auth-card">
    <div className="brand">CRM360</div><h1>Entrar no CRM</h1><p className="muted">Acesse seu ambiente de atendimento.</p>
    <form onSubmit={submit}>
      <div className="field"><label htmlFor="email">E-mail</label><input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div className="field"><label htmlFor="password">Senha</label><input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""} action="login" onToken={setTurnstileToken} />
      {error && <div className="error" role="alert">{error}</div>}
      <button className="primary-button" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
    </form>
    <div className="auth-footer">Ainda não possui conta? <Link href="/register">Criar ambiente</Link></div>
  </section></main>;
}
