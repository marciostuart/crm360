import { redirect } from "next/navigation";
import AppShell from "@/components/app-shell";
import { isAdmin } from "@/lib/auth/require-session";
import { getCurrentSession } from "@/lib/auth/session";
import BrandingClient from "./branding-client";
import TeamClient from "./team-client";
import LeadEndpointsClient from "../integracoes/leads/lead-endpoints-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!isAdmin(session)) redirect("/dashboard");
  return <AppShell session={session}><div className="settings-page">
    <header className="page-heading settings-heading"><div><div className="page-eyebrow"><span className="material-symbols-rounded">settings</span> Administração</div><h2>Configurações</h2><p className="muted">Gerencie a identidade, a equipe e as integrações do seu espaço.</p></div></header>
    <div className="settings-grid">
      <section className="settings-section"><div className="settings-section-heading"><div><h3>Identidade do CRM</h3><p className="muted">Personalize a marca que sua equipe verá no sistema.</p></div><span className="settings-heading-icon material-symbols-rounded">palette</span></div><BrandingClient brandColor={session.brandColor} hasLogo={session.hasLogo} logoVersion={session.brandingUpdatedAt} /></section>
      <section className="settings-section"><div className="settings-section-heading"><div><h3>Usuários e permissões</h3><p className="muted">Somente administradores podem cadastrar membros.</p></div><span className="settings-heading-icon material-symbols-rounded">group</span></div><TeamClient /></section>
      <section className="settings-section settings-section-wide"><div className="settings-section-heading"><div><h3>Webhooks de leads</h3><p className="muted">Crie endpoints protegidos para receber leads deste tenant.</p></div><span className="settings-heading-icon material-symbols-rounded">webhook</span></div><LeadEndpointsClient /></section>
    </div>
  </div></AppShell>;
}
