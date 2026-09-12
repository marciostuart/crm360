import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import LogoutButton from "./logout-button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return <div className="app-shell">
    <aside className="sidebar"><a className="sidebar-brand" href="/dashboard">M7CRM</a>
      <nav><a className="nav-link active" href="/dashboard"><span>▦</span><span className="nav-label">Dashboard</span></a>
        <a className="nav-link" href="#contatos"><span>◉</span><span className="nav-label">Contatos</span></a>
        <a className="nav-link" href="#crm"><span>◇</span><span className="nav-label">CRM</span></a>
        <a className="nav-link" href="#conversas"><span>◌</span><span className="nav-label">Conversas</span></a>
      </nav>
    </aside>
    <main className="main"><header className="topbar"><div><h1>Olá, {session.userName}</h1><p className="muted">{session.tenantName}</p></div><div><span className="user-chip">{session.userEmail}</span> <LogoutButton /></div></header>
      <section className="metric-grid"><article className="metric-card"><span className="muted">Contatos</span><strong>0</strong></article><article className="metric-card"><span className="muted">Conversas abertas</span><strong>0</strong></article><article className="metric-card"><span className="muted">Negócios no CRM</span><strong>0</strong></article></section>
      <div className="notice">A fundação segura do Web App está ativa. Os módulos de contatos, CRM, conversas e conexão Evolution serão incorporados nesta mesma interface.</div>
    </main>
  </div>;
}
