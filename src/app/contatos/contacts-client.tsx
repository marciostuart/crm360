"use client";

import { useEffect, useState } from "react";

type Contact = { id: number; name: string; phone: string; email?: string | null; source?: string | null; notes?: string | null };
export default function ContactsClient() {
  const [contacts, setContacts] = useState<Contact[]>([]); const [search, setSearch] = useState(""); const [message, setMessage] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  async function load() { const res = await fetch(`/api/contacts?search=${encodeURIComponent(search)}`, { cache: "no-store" }); const data = await res.json(); if (res.ok) setContacts(data.contacts); }
  useEffect(() => { void load(); }, [search]);
  async function create(event: React.FormEvent) { event.preventDefault(); setMessage(""); const res = await fetch("/api/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, email: form.email || null }) }); const data = await res.json(); if (!res.ok) { setMessage(data.error ?? "Não foi possível criar."); return; } setForm({ name: "", phone: "", email: "" }); setMessage("Contato criado."); await load(); }
  async function remove(id: number) { if (!window.confirm("Excluir este contato e suas conversas?")) return; const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" }); if (res.ok) await load(); }
  return <><section className="panel form-panel"><h3>Novo contato</h3><form className="form-grid" onSubmit={create}><input placeholder="Nome" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><input placeholder="Telefone com DDI" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /><input placeholder="E-mail (opcional)" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /><div className="form-actions"><button className="button">Adicionar contato</button>{message && <span className="muted">{message}</span>}</div></form></section>
    <div className="toolbar"><input placeholder="Buscar nome, telefone ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)} /><span className="muted">{contacts.length} exibido(s)</span></div>
    <section className="table-card">{contacts.length === 0 ? <div className="empty">Nenhum contato encontrado.</div> : <table className="data-table"><thead><tr><th>Nome</th><th>Telefone</th><th>E-mail</th><th>Origem</th><th></th></tr></thead><tbody>{contacts.map((contact) => <tr key={contact.id}><td>{contact.name}</td><td>{contact.phone}</td><td>{contact.email || "—"}</td><td>{contact.source || "manual"}</td><td><button className="button danger" onClick={() => remove(contact.id)}>Excluir</button></td></tr>)}</tbody></table>}</section></>;
}
