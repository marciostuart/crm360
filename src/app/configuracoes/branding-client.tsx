"use client";

import { useState } from "react";

export default function BrandingClient({ brandColor, hasLogo, logoVersion }: { brandColor: string; hasLogo: boolean; logoVersion: string }) {
  const [color, setColor] = useState(brandColor);
  const [file, setFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setMessage("");
    if (file && file.size > 1_500_000) { setMessage("A logo deve ter no máximo 1,5 MB."); return; }
    setSaving(true);
    const form = new FormData(); form.set("brand_color", color); form.set("remove_logo", String(removeLogo)); if (file) form.set("logo", file);
    const response = await fetch("/api/settings/branding", { method: "POST", body: form }); const data = await response.json();
    setSaving(false); if (!response.ok) { setMessage(data.error ?? "Não foi possível salvar."); return; }
    window.location.reload();
  }
  const logoSrc = hasLogo ? `/api/settings/logo?v=${encodeURIComponent(logoVersion)}` : "/logo.webp";
  return <form className="branding-form" onSubmit={save}>
    <div className="branding-preview"><img src={logoSrc} alt="Logo atual do CRM" /><div><strong>Logo da empresa</strong><span className="muted">PNG, JPEG ou WebP até 1,5 MB.</span></div></div>
    <label className="upload-control"><span className="material-symbols-rounded">upload</span> Escolher nova logo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setRemoveLogo(false); }} /></label>
    {file && <span className="file-selected">{file.name}</span>}
    {hasLogo && <label className="checkbox-control"><input type="checkbox" checked={removeLogo} onChange={(event) => setRemoveLogo(event.target.checked)} /> Remover logo personalizada</label>}
    <div className="color-control"><label htmlFor="brand-color">Cor padrão</label><div><input id="brand-color" type="color" value={color} onChange={(event) => setColor(event.target.value)} /><input aria-label="Código hexadecimal da cor" value={color} pattern="^#[0-9a-fA-F]{6}$" onChange={(event) => setColor(event.target.value)} /></div></div>
    <div className="form-actions"><button className="button" disabled={saving}>{saving ? "Salvando…" : "Salvar identidade"}</button>{message && <span className="error-inline" role="alert">{message}</span>}</div>
  </form>;
}
