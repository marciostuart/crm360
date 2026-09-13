"use client";

import type { CurrentSession } from "@/lib/auth/session";
import { useRouter } from "next/navigation";

export default function AppShell({ session, children }: { session: CurrentSession; children: React.ReactNode }) {
  const router = useRouter();
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }
  return <div className="app-shell">
    <aside className="sidebar"><a className="sidebar-brand" href="/dashboard">CRM360</a><nav>
      <a className="nav-link" href="/dashboard"><span>▦</span><span className="nav-label">Dashboard</span></a>
      <a className="nav-link" href="/contatos"><span>◉</span><span className="nav-label">Contatos</span></a>
      <a className="nav-link" href="/crm"><span>◇</span><span className="nav-label">CRM</span></a>
      <a className="nav-link" href="/conversas"><span>◌</span><span className="nav-label">Conversas</span></a>
      <a className="nav-link" href="/conexoes"><span>◍</span><span className="nav-label">WhatsApp</span></a>
      {(session.role === "owner" || session.role === "admin") && <a className="nav-link" href="/integracoes/leads"><span>⌁</span><span className="nav-label">Webhooks</span></a>}
    </nav></aside>
    <main className="main"><header className="topbar"><div><h1>CRM360</h1><p className="muted">{session.tenantName}</p></div><div><span className="user-chip">{session.userName}</span> <button className="logout" onClick={logout}>Sair</button></div></header>{children}</main>
  </div>;
}
