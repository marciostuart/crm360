"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Turnstile from "@/components/turnstile";

export default function MasterLoginClient({ siteKey }: { siteKey: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!turnstileToken) {
      setError("Confirme a verificação de segurança.");
      return;
    }
    setLoading(true);
    const response = await fetch("/api/master/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, turnstileToken }) });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Não foi possível entrar.");
      return;
    }
    router.replace("/master");
  }

  return <main className="master-auth-page"><section className="master-auth-card"><div className="master-mark"><span className="material-symbols-rounded">admin_panel_settings</span></div><p className="master-kicker">CRM360 · acesso restrito</p><h1>Master Admin</h1><p className="master-description">Área privada de administração da plataforma.</p><form onSubmit={submit}><label className="master-field">E-mail<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="master-field">Senha<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label><Turnstile siteKey={siteKey} action="master-login" onToken={setTurnstileToken} />{error && <div className="error" role="alert">{error}</div>}<button className="button master-submit" disabled={loading}>{loading ? "Validando…" : "Entrar no Master"}</button></form><p className="master-security"><span className="material-symbols-rounded">lock</span> Acesso monitorado e não indexado.</p></section></main>;
}
