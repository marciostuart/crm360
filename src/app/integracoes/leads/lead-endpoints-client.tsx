"use client";

import { useEffect, useState } from "react";
type Endpoint = { endpoint_id: string; active: boolean; created_at: string }; type NewEndpoint = { endpoint_id: string; secret: string; url: string; warning: string };
export default function LeadEndpointsClient() { const [items, setItems] = useState<Endpoint[]>([]); const [created, setCreated] = useState<NewEndpoint | null>(null); const [message, setMessage] = useState("");
  async function load() { const res = await fetch("/api/integrations/leads/endpoints", { cache: "no-store" }); const data = await res.json(); if (res.ok) setItems(data.endpoints); }
  useEffect(() => { void load(); }, []);
  async function create() { setMessage(""); const res = await fetch("/api/integrations/leads/endpoints", { method: "POST" }); const data = await res.json(); if (!res.ok) { setMessage(data.error ?? "Não foi possível criar."); return; } setCreated(data); await load(); }
  return <><section className="panel form-panel"><h3>Endpoint por tenant</h3><p className="muted">O segredo é mostrado uma única vez. Guarde-o no sistema emissor.</p><button className="button" onClick={create}>Gerar endpoint</button>{message && <p className="error">{message}</p>}{created && <div style={{ marginTop: 16 }}><p><strong>URL</strong></p><div className="secret-box">{created.url}</div><p><strong>Segredo HMAC</strong></p><div className="secret-box">{created.secret}</div><p className="muted">{created.warning}</p></div>}</section><section className="table-card">{items.length === 0 ? <div className="empty">Nenhum endpoint criado.</div> : <table className="data-table"><thead><tr><th>Endpoint</th><th>Status</th><th>Criado em</th></tr></thead><tbody>{items.map((item) => <tr key={item.endpoint_id}><td>{item.endpoint_id}</td><td>{item.active ? "ativo" : "inativo"}</td><td>{new Date(item.created_at).toLocaleString("pt-BR")}</td></tr>)}</tbody></table>}</section></>;
}
