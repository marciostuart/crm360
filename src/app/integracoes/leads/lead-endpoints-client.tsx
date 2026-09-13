"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import ConfirmationModal from "@/components/confirmation-modal";

type FieldKey = "external_id" | "name" | "phone" | "email" | "source" | "notes";
type FieldMapping = Partial<Record<FieldKey, string | null>> & { custom_fields?: Record<string, string> };
type Endpoint = { endpoint_id: string; active: boolean; created_at: string; mode?: "test" | "active"; field_mapping?: FieldMapping | null; tags?: string[] | string | null; allowed_hosts?: string[] | string | null; sample_updated_at?: string | null };
type Detail = { mode: "test" | "active"; field_mapping: FieldMapping | null; sample_payload: unknown; sample_updated_at: string | null; tags: string[]; allowed_hosts: string[] };
type NewEndpoint = { endpoint_id: string; url: string; signing_secret: string; warning: string };
type SampleItem = { path: string; value: unknown };
type CustomRow = { target: string; path: string };

const mappingFields: Array<[FieldKey, string]> = [["name", "Nome"], ["phone", "Telefone"], ["email", "E-mail"], ["external_id", "ID externo"], ["source", "Origem"], ["notes", "Observações"]];
const emptyMapping = (): Record<FieldKey, string> => ({ name: "", phone: "", email: "", external_id: "", source: "", notes: "" });

function flattenPayload(value: unknown, prefix = "", result: SampleItem[] = [], depth = 0): SampleItem[] {
  if (result.length >= 300 || depth > 8) return result;
  if (value === null || typeof value !== "object") { if (prefix) result.push({ path: prefix, value }); return result; }
  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenPayload(item, prefix ? `${prefix}.${index}` : String(index), result, depth + 1));
    return result;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length && prefix) result.push({ path: prefix, value: {} });
  entries.forEach(([key, item]) => flattenPayload(item, prefix ? `${prefix}.${key}` : key, result, depth + 1));
  return result;
}

function displayValue(value: unknown): string {
  if (typeof value === "string") return value.length > 160 ? `${value.slice(0, 157)}...` : value;
  try { const text = JSON.stringify(value); return text.length > 160 ? `${text.slice(0, 157)}...` : text; } catch { return "[indisponível]"; }
}

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string") { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? asArray(parsed) : []; } catch { return []; } }
  return [];
}

function parseSample(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return null; }
}

export default function LeadEndpointsClient() {
  const [items, setItems] = useState<Endpoint[]>([]);
  const [created, setCreated] = useState<NewEndpoint | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [mapping, setMapping] = useState<Record<FieldKey, string>>(emptyMapping());
  const [customRows, setCustomRows] = useState<CustomRow[]>([]);
  const [hostsText, setHostsText] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/integrations/leads/endpoints", { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (res.ok) setItems(data.endpoints ?? []);
  }

  function applyDetail(data: Detail, resetForm: boolean) {
    setDetail(data);
    if (!resetForm) return;
    const next = data.field_mapping ?? {};
    const nextMapping = emptyMapping();
    mappingFields.forEach(([field]) => { nextMapping[field] = typeof next[field] === "string" ? next[field] as string : ""; });
    setMapping(nextMapping);
    setCustomRows(Object.entries(next.custom_fields ?? {}).map(([target, path]) => ({ target, path })));
    setHostsText((data.allowed_hosts ?? []).join("\n"));
    setTagsText((data.tags ?? []).join(", "));
  }

  async function fetchDetail(endpointId: string, resetForm: boolean) {
    const res = await fetch(`/api/integrations/leads/endpoints/${endpointId}`, { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok) { setMessage(data?.error ?? "Não foi possível carregar a configuração."); return; }
    applyDetail(data, resetForm);
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!selected) return;
    const timer = window.setInterval(() => { void fetchDetail(selected, false); }, 5000);
    return () => window.clearInterval(timer);
  }, [selected]);

  const sampleItems = useMemo(() => detail?.sample_payload == null ? [] : flattenPayload(parseSample(detail.sample_payload)), [detail?.sample_payload]);
  const sampleOptions = useMemo(() => sampleItems.map((item) => item.path), [sampleItems]);

  async function create() {
    setMessage("");
    const res = await fetch("/api/integrations/leads/endpoints", { method: "POST" });
    const data = await res.json().catch(() => null);
    if (!res.ok) { setMessage(data?.error ?? "Não foi possível criar o endpoint."); return; }
    setCreated(data);
    await load();
    setSelected(data.endpoint_id);
    await fetchDetail(data.endpoint_id, true);
  }

  async function removeConfirmed(endpointId: string) {
    setMessage("");
    const res = await fetch("/api/integrations/leads/endpoints", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint_id: endpointId }) });
    const data = await res.json().catch(() => null);
    if (!res.ok) { setMessage(data?.error ?? "Não foi possível excluir."); return; }
    if (created?.endpoint_id === endpointId) setCreated(null);
    if (selected === endpointId) { setSelected(null); setDetail(null); }
    await load();
  }
  function remove(endpointId: string) { setDeleteTarget(endpointId); }

  async function configure(endpoint: Endpoint) {
    setMessage("");
    setSelected(endpoint.endpoint_id);
    await fetchDetail(endpoint.endpoint_id, true);
  }

  async function refreshSample() {
    if (!selected) return;
    setRefreshing(true);
    await fetchDetail(selected, false);
    setRefreshing(false);
  }

  function pathsWithCurrentValue(): string[] {
    return [...new Set([...sampleOptions, ...Object.values(mapping).filter(Boolean), ...customRows.map((row) => row.path).filter(Boolean)])];
  }

  async function saveConfiguration(event: FormEvent, requestedMode: "test" | "active") {
    event.preventDefault();
    if (!selected) return;
    setMessage("");
    const custom: Record<string, string> = {};
    for (const row of customRows) {
      if ((row.target && !row.path) || (!row.target && row.path)) { setMessage("Complete ou remova todos os campos adicionais."); return; }
      if (row.target && row.path) custom[row.target.trim()] = row.path.trim();
    }
    const allowedHosts = hostsText.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean);
    const tags = [...new Set(tagsText.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean))];
    if (!allowedHosts.length) { setMessage("Informe ao menos um domínio de origem autorizado."); return; }
    setSaving(true);
    const res = await fetch(`/api/integrations/leads/endpoints/${selected}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...mappingFields.reduce((result, [field]) => ({ ...result, [field]: mapping[field] || null }), {}), custom_fields: custom, mode: requestedMode, tags, allowed_hosts: allowedHosts }),
    });
    const data = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) { setMessage(data?.error ?? "Não foi possível salvar a configuração."); return; }
    setMessage(requestedMode === "active" ? "Endpoint ativado em produção com segurança." : "Configuração salva. O endpoint continua em TESTE.");
    await Promise.all([load(), fetchDetail(selected, false)]);
  }

  const currentPaths = pathsWithCurrentValue();
  return <>
    <section className="panel form-panel endpoint-create-panel">
      <div><h3>Captura de leads por endpoint</h3><p className="muted">Todo endpoint inicia em TESTE. O primeiro payload autorizado vira uma amostra para você mapear, sem criar contato.</p></div>
      <button className="button" onClick={create}>Gerar endpoint</button>
      {message && !selected && <p className="error">{message}</p>}
      {created && <div className="secret-result"><p><strong>URL de recebimento</strong></p><div className="secret-box">{created.url}</div><p><strong>Segredo de assinatura HMAC (exibido uma única vez)</strong></p><div className="secret-box">{created.signing_secret}</div><p className="muted">{created.warning} Todas as requisições devem enviar timestamp, nonce, idempotency-key e X-M7-Signature.</p></div>}
    </section>

    <section className="table-card endpoint-table-wrap">
      {items.length === 0 ? <div className="empty">Nenhum endpoint criado.</div> : <table className="data-table"><thead><tr><th>Endpoint</th><th>Modo</th><th>Amostra</th><th>Criado em</th><th>Ações</th></tr></thead><tbody>{items.map((item) => { const mode = item.mode === "active" ? "active" : "test"; return <tr key={item.endpoint_id}><td className="endpoint-id">{item.endpoint_id}</td><td><span className={`status-badge ${mode === "active" ? "status-active" : "status-test"}`}>{mode === "active" ? "produção" : "TESTE"}</span></td><td>{item.sample_updated_at ? <span className="mapping-ready">recebida</span> : <span className="muted">aguardando payload</span>}</td><td>{new Date(item.created_at).toLocaleString("pt-BR")}</td><td><div className="endpoint-actions"><button className="button secondary" onClick={() => configure(item)}>Configurar</button><button className="button danger" onClick={() => remove(item.endpoint_id)}>Excluir</button></div></td></tr>; })}</tbody></table>}
    </section>

    {selected && detail && <section className="endpoint-mapping-card">
      <div className="settings-section-heading"><div><h3>Configuração do endpoint <span className={`status-badge ${detail.mode === "active" ? "status-active" : "status-test"}`}>{detail.mode === "active" ? "produção" : "TESTE"}</span></h3><p className="muted">Defina a origem autorizada, receba uma amostra e associe cada item ao cadastro do lead.</p></div><div className="endpoint-toolbar"><button className="button secondary" onClick={refreshSample} disabled={refreshing}>{refreshing ? "Atualizando…" : "Atualizar amostra"}</button><button className="button secondary" onClick={() => { setSelected(null); setDetail(null); }}>Fechar</button></div></div>

      <div className="endpoint-security-note"><span className="material-symbols-rounded">public</span><div><strong>Trava por domínio de origem</strong><p>O webhook aceita apenas requisições que informem um domínio autorizado em <code>Origin</code>, <code>Referer</code> ou <code>X-CRM-Source-Host</code>. O domínio de destino não identifica o remetente.</p></div></div>

      {detail.sample_payload == null ? <div className="endpoint-sample-empty"><span className="material-symbols-rounded">sensors</span><strong>Aguardando o payload de teste</strong><p>Configure o domínio abaixo e envie um payload. Ele será exibido aqui sem criar nenhum contato.</p></div> : <div className="endpoint-sample-panel"><div><strong>Itens encontrados na amostra</strong><span className="muted">{sampleItems.length} campos disponíveis{detail.sample_updated_at ? ` · ${new Date(detail.sample_updated_at).toLocaleString("pt-BR")}` : ""}</span></div><div className="sample-items">{sampleItems.map((item) => <div className="sample-item" key={item.path}><code>{item.path}</code><span>{displayValue(item.value)}</span></div>)}</div><details className="sample-raw"><summary>Ver payload bruto</summary><pre>{JSON.stringify(parseSample(detail.sample_payload), null, 2)}</pre></details></div>}

      <form className="mapping-form" onSubmit={(event) => saveConfiguration(event, detail.mode === "active" ? "active" : "test")}>
        <div className="mapping-config-grid"><label>Domínios autorizados <span className="muted">(um por linha)</span><textarea rows={3} value={hostsText} onChange={(event) => setHostsText(event.target.value)} placeholder="integrador.exemplo.com.br" /></label><label>Tags fixas <span className="muted">(separadas por vírgula)</span><input value={tagsText} onChange={(event) => setTagsText(event.target.value)} placeholder="novo-lead, campanha-2026" /></label></div>
        <div className="mapping-fields"><h4>Mapeamento do cadastro</h4>{mappingFields.map(([field, label]) => <label key={field}>{label}<select value={mapping[field]} onChange={(event) => setMapping({ ...mapping, [field]: event.target.value })}><option value="">Não mapear</option>{currentPaths.map((path) => <option value={path} key={`${field}-${path}`}>{path}</option>)}</select></label>)}</div>
        <div className="custom-mapping"><div className="custom-mapping-heading"><div><h4>Campos adicionais</h4><p className="muted">Crie campos personalizados usando os itens da amostra.</p></div><button type="button" className="button secondary" onClick={() => setCustomRows([...customRows, { target: "", path: "" }])}>Adicionar campo</button></div>{customRows.map((row, index) => <div className="custom-mapping-row" key={index}><input value={row.target} onChange={(event) => setCustomRows(customRows.map((item, itemIndex) => itemIndex === index ? { ...item, target: event.target.value } : item))} placeholder="Nome do campo no CRM" /><select value={row.path} onChange={(event) => setCustomRows(customRows.map((item, itemIndex) => itemIndex === index ? { ...item, path: event.target.value } : item))}><option value="">Selecione o item do payload</option>{currentPaths.map((path) => <option value={path} key={`${index}-${path}`}>{path}</option>)}</select><button type="button" className="icon-button danger-icon" aria-label="Remover campo" onClick={() => setCustomRows(customRows.filter((_, itemIndex) => itemIndex !== index))}><span className="material-symbols-rounded">delete</span></button></div>)}</div>
        <div className="mapping-actions"><button className="button secondary" disabled={saving}>{saving ? "Salvando…" : "Salvar configuração"}</button>{detail.mode === "test" && <button type="button" className="button" disabled={saving} onClick={(event) => void saveConfiguration(event as unknown as FormEvent, "active")}>Ativar em produção</button>}{message && <span className="muted">{message}</span>}</div>
      </form>
    </section>}
    <ConfirmationModal open={Boolean(deleteTarget)} title="Excluir endpoint?" description="Os eventos recebidos por este endpoint também serão removidos." confirmLabel="Excluir endpoint" danger onClose={() => setDeleteTarget(null)} onConfirm={async () => { if (deleteTarget) await removeConfirmed(deleteTarget); setDeleteTarget(null); }} />
  </>;
}
