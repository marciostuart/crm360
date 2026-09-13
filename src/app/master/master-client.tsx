"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PlansClient from "./plans-client";

type Tenant = { id: number; public_id: string; name: string; legal_name?: string | null; slug: string; document?: string | null; plan_id?: number | null; plan_name?: string | null; contact_email?: string | null; contact_phone?: string | null; status: string; users_count: number; contacts_count: number; connections_count: number; admin_name?: string | null; created_at: string };
type Detail = Tenant & { website?: string | null; postal_code?: string | null; address?: string | null; city?: string | null; state?: string | null; updated_at: string; users: Array<{ id: number; name: string; email: string; role: string; status: string; last_login_at?: string | null }>; counts: Record<string, number> };
type Plan = { id: number; name: string; active: boolean };
type MasterSession = { name: string; email: string };

const statusLabels: Record<string, string> = { trial: "Teste", active: "Ativa", suspended: "Bloqueada", cancelled: "Cancelada" };
const roleLabels: Record<string, string> = { owner: "Admin", admin: "Admin", manager: "Gerente", supervisor: "Gerente", operator: "Operador", attendant: "Operador" };

export default function MasterClient({ session }: { session: MasterSession }) {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);

  async function load() {
    const [response, plansResponse] = await Promise.all([fetch("/api/master/tenants", { cache: "no-store" }), fetch("/api/master/plans", { cache: "no-store" })]);
    if (response.status === 401) { router.replace("/master/login"); return; }
    const data = await response.json(); const plansData = await plansResponse.json();
    if (response.ok) setTenants(data.tenants); if (plansResponse.ok) setPlans(plansData.plans); setLoading(false);
  }
  async function openTenant(id: number) { setMessage(""); const response = await fetch(`/api/master/tenants/${id}`, { cache: "no-store" }); const data = await response.json(); if (response.ok) { setSelected({ ...data.tenant, users: data.users, counts: data.counts }); setEditing(false); } else setMessage(data.error ?? "Não foi possível carregar a empresa."); }
  useEffect(() => { void load(); const refresh = () => { void load(); }; window.addEventListener("crm360-plans-updated", refresh); return () => window.removeEventListener("crm360-plans-updated", refresh); }, []);
  const filtered = useMemo(() => tenants.filter((tenant) => `${tenant.name} ${tenant.legal_name ?? ""} ${tenant.slug} ${tenant.contact_email ?? ""}`.toLowerCase().includes(search.toLowerCase())), [tenants, search]);
  async function save() { if (!selected) return; setMessage(""); const response = await fetch(`/api/master/tenants/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(selected) }); const data = await response.json(); if (!response.ok) { setMessage(data.error ?? "Não foi possível salvar."); return; } setMessage("Dados salvos."); setEditing(false); await load(); await openTenant(selected.id); }
  async function changeStatus(status: string) { if (!selected) return; const response = await fetch(`/api/master/tenants/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...selected, status }) }); const data = await response.json(); if (!response.ok) { setMessage(data.error ?? "Não foi possível alterar o status."); return; } setSelected({ ...selected, status }); await load(); }
  async function impersonate() { if (!selected || !window.confirm(`Acessar ${selected.name} como administrador?`)) return; const response = await fetch(`/api/master/tenants/${selected.id}`, { method: "POST" }); const data = await response.json(); if (!response.ok) { setMessage(data.error ?? "Não foi possível acessar a empresa."); return; } window.location.href = data.redirect; }
  async function remove() { if (!selected) return; const confirmation = window.prompt(`Para excluir, digite o slug exato: ${selected.slug}`); if (confirmation !== selected.slug) return; const response = await fetch(`/api/master/tenants/${selected.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation }) }); const data = await response.json(); if (!response.ok) { setMessage(data.error ?? "Não foi possível excluir."); return; } setSelected(null); setMessage("Empresa excluída."); await load(); }
  async function logout() { await fetch("/api/master/logout", { method: "POST" }); router.replace("/master/login"); }
  function update(field: keyof Detail, value: string) { if (selected) setSelected({ ...selected, [field]: value }); }

  return <main className="master-page">
    <header className="master-topbar"><div className="master-brand"><span className="master-brand-icon material-symbols-rounded">admin_panel_settings</span><div><strong>CRM360 Master</strong><span>Administração da plataforma</span></div></div><div className="master-user"><span><strong>{session.name}</strong><small>{session.email}</small></span><button onClick={logout} className="master-logout">Sair</button></div></header>
    <div className="master-content">
      <div className="master-heading"><div><p className="master-kicker">Visão geral da plataforma</p><h1>Empresas cadastradas</h1><p>Controle tenants, planos, acessos e suporte operacional em um só lugar.</p></div><div className="master-count"><strong>{tenants.length}</strong><span>empresas</span></div></div>
      <PlansClient />
      <div className="master-workspace">
        <section className="master-company-list"><div className="master-search"><span className="material-symbols-rounded">search</span><input placeholder="Buscar empresa, slug ou e-mail" value={search} onChange={(event) => setSearch(event.target.value)} /></div>{loading ? <div className="master-loading">Carregando empresas…</div> : filtered.length === 0 ? <div className="master-empty">Nenhuma empresa encontrada.</div> : <div className="master-list">{filtered.map((tenant) => <button className={`master-company-item ${selected?.id === tenant.id ? "selected" : ""}`} key={tenant.id} onClick={() => openTenant(tenant.id)}><span className="company-avatar">{tenant.name.slice(0, 1).toUpperCase()}</span><span className="company-item-info"><strong>{tenant.name}</strong><small>{tenant.plan_name || "Sem plano"} · {tenant.contact_email || tenant.slug}</small></span><span className={`master-status master-status-${tenant.status}`}>{statusLabels[tenant.status] ?? tenant.status}</span></button>)}</div>}</section>
        <section className="master-detail">{!selected ? <div className="master-detail-empty"><span className="material-symbols-rounded">domain</span><h2>Selecione uma empresa</h2><p>Os dados cadastrais, plano e ações administrativas aparecerão aqui.</p></div> : <>
          <div className="master-detail-header"><div><span className={`master-status master-status-${selected.status}`}>{statusLabels[selected.status] ?? selected.status}</span><h2>{selected.name}</h2><p>/{selected.slug} · criada em {new Date(selected.created_at).toLocaleDateString("pt-BR")}</p></div><div className="master-detail-actions"><button className="master-button primary" onClick={impersonate}><span className="material-symbols-rounded">login</span> Acessar como admin</button><button className="master-button" onClick={() => setEditing(!editing)}><span className="material-symbols-rounded">edit</span> {editing ? "Cancelar" : "Editar"}</button></div></div>
          {message && <div className="master-message">{message}</div>}
          <div className="master-stats"><div><strong>{selected.counts.contacts_count ?? selected.contacts_count}</strong><span>Contatos</span></div><div><strong>{selected.counts.conversations_count ?? 0}</strong><span>Conversas</span></div><div><strong>{selected.counts.deals_count ?? 0}</strong><span>Negócios</span></div><div><strong>{selected.counts.connections_count ?? selected.connections_count}</strong><span>WhatsApp</span></div></div>
          <div className="master-form-grid"><Field label="Nome da empresa" value={selected.name} editing={editing} onChange={(value) => update("name", value)} /><Field label="Razão social" value={selected.legal_name ?? ""} editing={editing} onChange={(value) => update("legal_name", value)} /><Field label="CNPJ/CPF" value={selected.document ?? ""} editing={editing} onChange={(value) => update("document", value)} /><Field label="E-mail" value={selected.contact_email ?? ""} editing={editing} onChange={(value) => update("contact_email", value)} /><Field label="Telefone" value={selected.contact_phone ?? ""} editing={editing} onChange={(value) => update("contact_phone", value)} /><Field label="Website" value={selected.website ?? ""} editing={editing} onChange={(value) => update("website", value)} /><Field label="CEP" value={selected.postal_code ?? ""} editing={editing} onChange={(value) => update("postal_code", value)} /><Field label="Endereço" value={selected.address ?? ""} editing={editing} onChange={(value) => update("address", value)} /><Field label="Cidade" value={selected.city ?? ""} editing={editing} onChange={(value) => update("city", value)} /><Field label="UF" value={selected.state ?? ""} editing={editing} onChange={(value) => update("state", value)} />{editing ? <label className="master-field detail-field"><span>Plano contratado</span><select value={selected.plan_id ?? ""} onChange={(event) => setSelected({ ...selected, plan_id: event.target.value ? Number(event.target.value) : null })}><option value="">Sem plano</option>{plans.filter((plan) => plan.active || plan.id === selected.plan_id).map((plan) => <option value={plan.id} key={plan.id}>{plan.name}</option>)}</select></label> : <Field label="Plano contratado" value={selected.plan_name ?? "Sem plano"} editing={false} onChange={() => undefined} />}</div>
          {editing && <div className="master-edit-actions"><button className="master-button primary" onClick={save}>Salvar alterações</button></div>}
          <div className="master-access-row"><div><h3>Status de acesso</h3><p>Bloquear impede novos logins do tenant.</p></div><select value={selected.status} onChange={(event) => changeStatus(event.target.value)}><option value="trial">Teste</option><option value="active">Ativa</option><option value="suspended">Bloqueada</option><option value="cancelled">Cancelada</option></select></div>
          <div className="master-users"><h3>Usuários da empresa</h3>{selected.users.map((user) => <div className="master-member" key={user.id}><span className="company-avatar small">{user.name.slice(0, 1).toUpperCase()}</span><span><strong>{user.name}</strong><small>{user.email}</small></span><span className={`role-badge role-${user.role}`}>{roleLabels[user.role] ?? user.role}</span></div>)}</div>
          <button className="master-delete" onClick={remove}><span className="material-symbols-rounded">delete</span> Excluir empresa permanentemente</button>
        </>}</section>
      </div>
    </div>
  </main>;
}

function Field({ label, value, editing, onChange }: { label: string; value: string; editing: boolean; onChange: (value: string) => void }) { return <label className="master-field detail-field"><span>{label}</span>{editing ? <input value={value} onChange={(event) => onChange(event.target.value)} /> : <strong>{value || "Não informado"}</strong>}</label>; }
