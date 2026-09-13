import { redirect } from "next/navigation";
import AppShell from "@/components/app-shell";
import { getCurrentSession } from "@/lib/auth/session";
import { db, type DbRow } from "@/lib/db";

export const dynamic = "force-dynamic";

type DashboardData = {
  conversations: number;
  openConversations: number;
  contacts: number;
  deals: number;
  activeConnections: number;
  totalConnections: number;
  pipeline: Array<{ name: string; total: number; amount: number }>;
  team: Array<{ name: string; role: string }>;
};

const asNumber = (value: unknown) => Number(value ?? 0);

async function loadDashboard(tenantId: number): Promise<DashboardData> {
  try {
    const [conversationResult, contactsResult, dealsResult, connectionsResult, pipelineResult, teamResult] = await Promise.all([
      db().execute<DbRow[]>(
        "SELECT COUNT(*) AS total, COALESCE(SUM(status = 'open'), 0) AS open_total FROM conversations WHERE tenant_id = ?",
        [tenantId],
      ),
      db().execute<DbRow[]>("SELECT COUNT(*) AS total FROM contacts WHERE tenant_id = ?", [tenantId]),
      db().execute<DbRow[]>("SELECT COUNT(*) AS total FROM deals WHERE tenant_id = ?", [tenantId]),
      db().execute<DbRow[]>(
        "SELECT COUNT(*) AS total, COALESCE(SUM(status IN ('connected', 'open')), 0) AS active_total FROM evolution_connections WHERE tenant_id = ?",
        [tenantId],
      ),
      db().execute<DbRow[]>(
        `SELECT bs.name, COUNT(d.id) AS total, COALESCE(SUM(d.amount), 0) AS amount
           FROM board_stages bs
           JOIN boards b ON b.id = bs.board_id AND b.tenant_id = ?
           LEFT JOIN deals d ON d.stage_id = bs.id AND d.tenant_id = ?
          GROUP BY bs.id, bs.name, bs.position
          ORDER BY b.id, bs.position`,
        [tenantId, tenantId],
      ),
      db().execute<DbRow[]>(
        "SELECT name, role FROM users WHERE tenant_id = ? AND status = 'active' ORDER BY id LIMIT 8",
        [tenantId],
      ),
    ]);

    const conversations = conversationResult[0][0];
    const connections = connectionsResult[0][0];
    return {
      conversations: asNumber(conversations?.total),
      openConversations: asNumber(conversations?.open_total),
      contacts: asNumber(contactsResult[0][0]?.total),
      deals: asNumber(dealsResult[0][0]?.total),
      activeConnections: asNumber(connections?.active_total),
      totalConnections: asNumber(connections?.total),
      pipeline: (pipelineResult[0] as DbRow[]).map((row) => ({
        name: String(row.name),
        total: asNumber(row.total),
        amount: asNumber(row.amount),
      })),
      team: (teamResult[0] as DbRow[]).map((row) => ({ name: String(row.name), role: String(row.role) })),
    };
  } catch {
    return { conversations: 0, openConversations: 0, contacts: 0, deals: 0, activeConnections: 0, totalConnections: 0, pipeline: [], team: [] };
  }
}

function dateLabel(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date);
}

function roleLabel(role: string) {
  return { owner: "Administrador Sênior", admin: "Administrador", supervisor: "Supervisor", attendant: "Atendente" }[role] ?? role;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const days = [7, 14, 30].includes(Number(params.dias)) ? Number(params.dias) : 7;
  const data = await loadDashboard(session.tenantId);
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - days);
  const money = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <AppShell session={session}>
      <header className="page-header">
        <div className="page-header-info">
          <div className="page-eyebrow"><span className="material-symbols-rounded">space_dashboard</span> Central de atendimento</div>
          <h1>Visão Geral</h1>
          <p>Acompanhe suas métricas e performance em tempo real</p>
        </div>
        <div className="dashboard-header-tools">
          <div className="live-status"><span className="live-status-dot" /> Dados atualizados agora</div>
          <div className="dashboard-filters" aria-label="Período do dashboard">
            {[7, 14, 30].map((period) => (
              <a className={days === period ? "active" : ""} href={`/dashboard?dias=${period}`} key={period}>{period} dias</a>
            ))}
            <span className="filter-separator" />
            <span className="date-range">{dateLabel(startDate)} - {dateLabel(endDate)}</span>
            <a className="btn-refresh-header" href={`/dashboard?dias=${days}`} aria-label="Atualizar dashboard"><span className="material-symbols-rounded">refresh</span></a>
          </div>
        </div>
      </header>

      <section className="dashboard-hero-cards">
        <article className="hero-card hero-card-blue">
          <div className="hero-card-top"><span className="hero-card-title">Conversas</span><span className="hero-card-icon icon-blue material-symbols-rounded">chat</span></div>
          <strong className="hero-card-value">{data.conversations}</strong>
          <span className="hero-card-subtitle">{data.openConversations} abertas agora</span>
        </article>
        <article className="hero-card hero-card-purple">
          <div className="hero-card-top"><span className="hero-card-title">Negócios no CRM</span><span className="hero-card-icon icon-purple material-symbols-rounded">view_kanban</span></div>
          <strong className="hero-card-value">{data.deals}</strong>
          <span className="hero-card-subtitle">Total no pipeline</span>
        </article>
        <article className="hero-card hero-card-green">
          <div className="hero-card-top"><span className="hero-card-title">Contatos</span><span className="hero-card-icon icon-green material-symbols-rounded">contact_page</span></div>
          <strong className="hero-card-value">{data.contacts}</strong>
          <span className="hero-card-subtitle">+0 novos nos últimos {days}d</span>
        </article>
        <article className="hero-card hero-card-orange">
          <div className="hero-card-top"><span className="hero-card-title">WhatsApp conectado</span><span className="hero-card-icon icon-orange material-symbols-rounded">qr_code</span></div>
          <strong className="hero-card-value">{data.activeConnections}<small className="hero-card-total">/{data.totalConnections}</small></strong>
          <span className="hero-card-subtitle">Conexões ativas</span>
        </article>
      </section>

      <section className="bento-grid">
        <article className="dash-card">
          <div className="dash-card-header"><h2 className="dash-card-title"><span className="material-symbols-rounded">show_chart</span>Mensagens</h2><span className="dash-card-note">Enviadas vs Recebidas</span></div>
          <div className="chart-container chart-placeholder"><div className="chart-y-axis"><span>1</span><span>0</span></div><div className="chart-area">{data.conversations === 0 && <span className="chart-empty-label">Sem mensagens no período</span>}</div></div>
          <div className="chart-legend"><span><i className="legend-dot legend-received" />Recebidas</span><span><i className="legend-dot legend-sent" />Enviadas</span></div>
        </article>
        <article className="dash-card pipeline-card">
          <div className="dash-card-header"><h2 className="dash-card-title"><span className="material-symbols-rounded">filter_list</span>Pipeline CRM</h2></div>
          {data.pipeline.length ? <div className="pipeline-list">{data.pipeline.map((stage) => <div className="pipeline-item" key={stage.name}><span className="pipeline-name">{stage.name}</span><span className="pipeline-count">{stage.total} · R$ {money.format(stage.amount)}</span></div>)}</div> : <div className="empty-dashboard"><span className="material-symbols-rounded">view_kanban</span><p>Nenhum quadro CRM criado</p></div>}
        </article>
      </section>

      <section className="bento-grid">
        <article className="dash-card">
          <div className="dash-card-header"><h2 className="dash-card-title"><span className="material-symbols-rounded">bar_chart</span>Conversas por Dia</h2></div>
          <div className="chart-container chart-placeholder"><div className="chart-y-axis"><span>1</span><span>0</span></div><div className="chart-area">{data.conversations === 0 && <span className="chart-empty-label">Sem conversas no período</span>}</div></div>
        </article>
        <article className="dash-card team-card">
          <div className="dash-card-header"><h2 className="dash-card-title"><span className="material-symbols-rounded">group</span>Equipe</h2><span className="dash-card-note">Conexões: {data.activeConnections}/{data.totalConnections} ativas</span></div>
          {data.team.length ? <div className="equipe-table"><div className="equipe-row equipe-heading"><span>ATENDENTE</span><span>ATENDIMENTOS</span><span>MENSAGENS</span></div>{data.team.map((member) => <div className="equipe-row" key={`${member.name}-${member.role}`}><strong>{member.name}</strong><span>0</span><span>0</span></div>)}</div> : <div className="empty-dashboard"><span className="material-symbols-rounded">group</span><p>Nenhum atendente cadastrado</p></div>}
        </article>
      </section>
    </AppShell>
  );
}
