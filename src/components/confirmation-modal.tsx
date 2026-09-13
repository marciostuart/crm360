"use client";

import { useEffect, useState } from "react";

type Props = { open: boolean; title: string; description: string; confirmLabel?: string; danger?: boolean; confirmationText?: string; onClose: () => void; onConfirm: (confirmation?: string) => void | Promise<void> };

export default function ConfirmationModal({ open, title, description, confirmLabel = "Confirmar", danger = false, confirmationText, onClose, onConfirm }: Props) {
  const [value, setValue] = useState(""); const [pending, setPending] = useState(false);
  useEffect(() => { if (open) { setValue(""); setPending(false); } }, [open]);
  useEffect(() => { if (!open) return; const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !pending) onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [open, pending, onClose]);
  if (!open) return null;
  async function submit() { if (confirmationText && value !== confirmationText) return; setPending(true); try { await onConfirm(value); } finally { setPending(false); } }
  return <div className="crm-modal-backdrop" role="presentation" onMouseDown={() => !pending && onClose()}><section className="crm-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="crm-confirm-title" onMouseDown={(event) => event.stopPropagation()}><span className={`crm-confirm-icon material-symbols-rounded ${danger ? "danger" : ""}`}>{danger ? "warning" : "help"}</span><h2 id="crm-confirm-title">{title}</h2><p>{description}</p>{confirmationText && <label>Digite <strong>{confirmationText}</strong> para confirmar<input autoFocus value={value} onChange={(event) => setValue(event.target.value)} /></label>}<div><button type="button" onClick={onClose} disabled={pending}>Cancelar</button><button type="button" className={danger ? "danger" : ""} disabled={pending || Boolean(confirmationText && value !== confirmationText)} onClick={submit}>{pending ? "Processando…" : confirmLabel}</button></div></section></div>;
}
