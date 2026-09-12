import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import AppShell from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return <AppShell session={session}><>
      <header className="page-heading"><div><h2>Olá, {session.userName}</h2><p className="muted">Visão geral do seu atendimento.</p></div></header>
      <section className="metric-grid"><article className="metric-card"><span className="muted">Contatos</span><strong>0</strong></article><article className="metric-card"><span className="muted">Conversas abertas</span><strong>0</strong></article><article className="metric-card"><span className="muted">Negócios no CRM</span><strong>0</strong></article></section>
      <div className="notice">A fundação segura do Web App está ativa. Use o menu para gerenciar contatos, CRM, conversas, WhatsApp e webhooks deste tenant.</div>
    </></AppShell>;
}
