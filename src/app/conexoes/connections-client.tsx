"use client";

import { useEffect, useRef, useState } from "react";
import ConfirmationModal from "@/components/confirmation-modal";

type Connection = { public_id: string; name: string; instance_name: string; status: string };
type QrState = { id: string; value: string } | null;

function statusLabel(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "open") return "Conectado";
  if (normalized === "qr_pending") return "Aguardando leitura";
  if (normalized === "connecting") return "Conectando";
  if (normalized === "close" || normalized === "disconnected") return "Desconectado";
  return status;
}

export default function ConnectionsClient({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<Connection[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [qr, setQr] = useState<QrState>(null);
  const [deleteTarget, setDeleteTarget] = useState<Connection | null>(null);
  const [creating, setCreating] = useState(false);
  const refreshInFlight = useRef(false);

  async function load() { const res = await fetch("/api/integrations/evolution/connections", { cache: "no-store" }); const data = await res.json(); if (res.ok) setItems(data.connections); }
  async function updateStatus(id: string, quiet = false) { const res = await fetch(`/api/integrations/evolution/connections/${id}/status`, { cache: "no-store" }); const data = await res.json(); if (res.ok) { setItems((current) => current.map((item) => item.public_id === id ? { ...item, status: data.status } : item)); if (data.status === "open" && qr?.id === id) setQr(null); if (!quiet) setMessage(`Status: ${statusLabel(data.status)}`); return data.status; } return null; }
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (!qr) return; const timer = window.setInterval(async () => { if (refreshInFlight.current) return; refreshInFlight.current = true; try { const currentStatus = await updateStatus(qr.id, true); if (currentStatus !== "open") { const res = await fetch(`/api/integrations/evolution/connections/${qr.id}/connect`, { method: "POST" }); const data = await res.json(); if (res.ok && data.qrcode) setQr({ id: qr.id, value: data.qrcode }); } } finally { refreshInFlight.current = false; } }, 20_000); return () => window.clearInterval(timer); }, [qr]);
  async function create(event: React.FormEvent) { event.preventDefault(); if (creating) return; setCreating(true); setMessage(""); try { const res = await fetch("/api/integrations/evolution/connections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }); const data = await res.json(); if (!res.ok) { setMessage(data.error ?? "Não foi possível criar."); return; } setName(""); setMessage("Conexão criada. Use Conectar para gerar o QR Code."); await load(); } finally { setCreating(false); } }
  async function toggleConnection(item: Connection) { setMessage(""); const res = await fetch(`/api/integrations/evolution/connections/${item.public_id}/connect`, { method: "POST" }); const data = await res.json(); if (!res.ok) { setMessage(data.error ?? "Falha ao alterar a conexão."); return; } if (data.action === "disconnected") { setQr(null); setMessage("WhatsApp desconectado."); } else { setQr(data.qrcode ? { id: item.public_id, value: data.qrcode } : null); setMessage(data.pairing_code ? `Código de pareamento: ${data.pairing_code}` : "QR Code gerado. Ele será atualizado automaticamente se expirar."); } await load(); }
  async function remove() { if (!deleteTarget) return; const target = deleteTarget; const res = await fetch(`/api/integrations/evolution/connections/${target.public_id}`, { method: "DELETE" }); const data = await res.json(); if (!res.ok) { setMessage(data.error ?? "Não foi possível excluir."); return; } if (qr?.id === target.public_id) setQr(null); setDeleteTarget(null); setMessage("Conexão removida da Evolution API e do CRM."); await load(); }
  return <><section className="panel form-panel">{canManage ? <form className="toolbar" onSubmit={create}><input placeholder="Nome da conexão" required value={name} onChange={(e) => setName(e.target.value)} disabled={creating} /><button className="button" type="submit" disabled={creating}>{creating ? "Criando..." : "Adicionar WhatsApp"}</button></form> : <p className="muted">Somente administradores podem criar conexões.</p>}{message && <p className="muted">{message}</p>}{qr && <img className="qr" src={qr.value.startsWith("data:") ? qr.value : `data:image/png;base64,${qr.value}`} alt="QR Code para conectar o WhatsApp" />}</section><section className="table-card">{items.length === 0 ? <div className="empty">Nenhuma conexão cadastrada.</div> : <table className="data-table"><thead><tr><th>Nome</th><th>Instância</th><th>Status</th><th>Ações</th></tr></thead><tbody>{items.map((item) => <tr key={item.public_id}><td>{item.name}</td><td>{item.instance_name}</td><td>{statusLabel(item.status)}</td><td>{canManage && <div className="connection-actions"><button className="button secondary" onClick={() => toggleConnection(item)}>{item.status.toLowerCase() === "open" ? "Desconectar" : "Conectar"}</button><button className="button secondary" onClick={() => updateStatus(item.public_id)}>Atualizar</button><button className="button danger" onClick={() => setDeleteTarget(item)}>Excluir</button></div>}</td></tr>)}</tbody></table>}</section><ConfirmationModal open={Boolean(deleteTarget)} title="Excluir conexão?" description={`A instância ${deleteTarget?.instance_name ?? "selecionada"} será removida da Evolution API e do CRM.`} confirmLabel="Excluir conexão" danger onClose={() => setDeleteTarget(null)} onConfirm={remove} /></>;
}
