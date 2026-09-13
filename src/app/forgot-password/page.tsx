"use client";

import Link from "next/link";
import { useState } from "react";
import Turnstile from "@/components/turnstile";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [token, setToken] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setError(""); setMessage(""); if (!token) { setError("Confirme a verificação de segurança."); return; } setLoading(true); const response = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, turnstileToken: token }) }); const data = await response.json(); setLoading(false); if (!response.ok) { setError(data.error ?? "Não foi possível solicitar a recuperação."); return; } setMessage(data.message); }
  return <main className="auth-page"><section className="auth-card"><div className="brand">CRM360</div><h1>Recuperar senha</h1><p className="muted">Informe seu e-mail e enviaremos um link seguro.</p><form onSubmit={submit}><div className="field"><label htmlFor="email">E-mail</label><input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div><Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""} action="forgot-password" onToken={setToken} />{error && <div className="error" role="alert">{error}</div>}{message && <div className="notice" role="status">{message}</div>}<button className="primary-button" disabled={loading}>{loading ? "Enviando..." : "Enviar link"}</button></form><div className="auth-footer"><Link href="/login">Voltar para o login</Link></div></section></main>;
}
