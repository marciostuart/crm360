"use client";

import type { CurrentSession } from "@/lib/auth/session";
import type { CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AppShell({ session, children }: { session: CurrentSession; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [darkMode, setDarkMode] = useState(false);
  useEffect(() => {
    const saved = window.localStorage.getItem("crm360-dark-mode") === "true";
    setDarkMode(saved);
    document.documentElement.classList.toggle("dark-mode", saved);
  }, []);
  function toggleDarkMode() {
    const next = !darkMode;
    setDarkMode(next);
    window.localStorage.setItem("crm360-dark-mode", String(next));
    document.documentElement.classList.toggle("dark-mode", next);
  }
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }
  const navItems: Array<{ href: string; icon: string; label: string; disabled?: boolean }> = [
    { href: "/dashboard", icon: "analytics", label: "Dashboard" },
    { href: "/conversas", icon: "chat", label: "Chat" },
    { href: "/crm", icon: "view_kanban", label: "CRM" },
    { href: "/conexoes", icon: "qr_code", label: "Conexões" },
    { href: "/contatos", icon: "contacts", label: "Contatos" },
  ];
  const tenantStyles = { "--tenant-brand": session.brandColor } as CSSProperties;
  const logoSrc = session.hasLogo ? `/api/settings/logo?v=${encodeURIComponent(session.brandingUpdatedAt)}` : "/logo.webp";
  return <div className="app-shell" style={tenantStyles}>
    <aside className="sidebar">
      <div className="sidebar-header"><a className="sidebar-logo-link" href="/dashboard"><img className="sidebar-logo-img" src={logoSrc} alt="CRM360" /></a></div>
      <nav className="sidebar-menu" aria-label="Navegação principal">
        {navItems.map((item) => <a key={item.label} className={`nav-link menu-item ${pathname === item.href ? "active" : ""} ${item.disabled ? "disabled" : ""}`} href={item.href} aria-disabled={item.disabled || undefined} title={item.disabled ? `${item.label} indisponível nesta fase` : item.label} onClick={item.disabled ? (event) => event.preventDefault() : undefined}>
          <span className="menu-icon material-symbols-rounded">{item.icon}</span><span className="nav-label menu-text">{item.label}</span>
        </a>)}
        <div className="sidebar-nav-divider" />
        {(session.role === "owner" || session.role === "admin") && <a className={`nav-link menu-item ${pathname === "/configuracoes" ? "active" : ""}`} href="/configuracoes" title="Configurações"><span className="menu-icon material-symbols-rounded">settings</span><span className="nav-label menu-text">Configurações</span></a>}
      </nav>
      <div className="sidebar-footer">
        <div className="version-text">Versão atual: CRM360</div>
        <button className="menu-item theme-toggle-item" onClick={toggleDarkMode} type="button"><span className="menu-icon material-symbols-rounded">dark_mode</span><span className="menu-text">Modo Escuro</span><span className="theme-switch"><span className={`slider ${darkMode ? "checked" : ""}`} /></span></button>
        <button className="menu-item logout-item" onClick={logout} type="button"><span className="menu-icon material-symbols-rounded">logout</span><span className="menu-text">Sair</span></button>
      </div>
    </aside>
    <main className="main">{children}</main>
  </div>;
}
