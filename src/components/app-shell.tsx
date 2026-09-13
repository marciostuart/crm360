"use client";

import type { CurrentSession } from "@/lib/auth/session";
import type { CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

export default function AppShell({ session, children }: { session: CurrentSession; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [operatorStatus, setOperatorStatus] = useState<"available" | "away">("available");
  const profileRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const saved = window.localStorage.getItem("crm360-dark-mode") === "true";
    setDarkMode(saved);
    setSidebarOpen(window.localStorage.getItem("crm360-sidebar-open") !== "false");
    setOperatorStatus(window.localStorage.getItem("crm360-operator-status") === "away" ? "away" : "available");
    document.documentElement.classList.toggle("dark-mode", saved);
  }, []);
  useEffect(() => {
    function closeProfile(event: MouseEvent) { if (!profileRef.current?.contains(event.target as Node)) setProfileOpen(false); }
    document.addEventListener("mousedown", closeProfile);
    return () => document.removeEventListener("mousedown", closeProfile);
  }, []);
  function toggleDarkMode() {
    const next = !darkMode;
    setDarkMode(next);
    window.localStorage.setItem("crm360-dark-mode", String(next));
    document.documentElement.classList.toggle("dark-mode", next);
  }
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }
  async function returnToMaster() { await fetch("/api/master/return", { method: "POST" }); window.location.href = "/master"; }
  const navItems: Array<{ href: string; icon: string; label: string; disabled?: boolean }> = [
    { href: "/dashboard", icon: "analytics", label: "Dashboard" },
    { href: "/conversas", icon: "chat", label: "Chat" },
    { href: "/crm", icon: "view_kanban", label: "CRM" },
    { href: "/conexoes", icon: "qr_code", label: "Conexões" },
    { href: "/contatos", icon: "contacts", label: "Contatos" },
  ];
  const tenantStyles = { "--tenant-brand": session.brandColor } as CSSProperties;
  const logoSrc = session.hasLogo ? `/api/settings/logo?v=${encodeURIComponent(session.brandingUpdatedAt)}` : "/logo.webp";
  const initials = useMemo(() => session.userName.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "U", [session.userName]);
  function changeStatus(status: "available" | "away") { setOperatorStatus(status); window.localStorage.setItem("crm360-operator-status", status); setProfileOpen(false); }
  function toggleSidebar() { const next = !sidebarOpen; setSidebarOpen(next); window.localStorage.setItem("crm360-sidebar-open", String(next)); }
  return <div className={`app-shell ${sidebarOpen ? "sidebar-expanded" : "sidebar-collapsed"}`} style={tenantStyles}>
    <aside className="sidebar">
      <button type="button" className="sidebar-collapse-control" onClick={toggleSidebar} aria-label={sidebarOpen ? "Recolher menu" : "Expandir menu"}><span className="material-symbols-rounded">{sidebarOpen ? "left_panel_close" : "left_panel_open"}</span></button>
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
    <main className="main">
      <header className="app-topbar">
        <div className="app-topbar-workspace"><span className="workspace-dot" />{session.tenantName}</div>
        <div className="app-topbar-actions">
          <button className="topbar-icon-button" type="button" aria-label="Notificações" title="Notificações"><span className="material-symbols-rounded">notifications</span><i /></button>
          <button className="topbar-icon-button" type="button" aria-label="Ajuda" title="Ajuda"><span className="material-symbols-rounded">help</span></button>
          <div className="profile-menu" ref={profileRef}>
            <button className="profile-trigger" type="button" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen} aria-label="Abrir menu do perfil"><span>{initials}</span><i className={operatorStatus} /></button>
            {profileOpen && <div className="profile-popover">
              <div className="profile-summary"><span className="profile-large-avatar">{initials}</span><div><strong>{session.userName}</strong><small>{session.userEmail}</small><a href="/configuracoes">Ir para o perfil</a></div></div>
              <div className="profile-divider" />
              <button type="button" className={operatorStatus === "available" ? "selected" : ""} onClick={() => changeStatus("available")}><span className="status-mark available material-symbols-rounded">check</span>Disponível{operatorStatus === "available" && <span className="material-symbols-rounded selected-check">done</span>}</button>
              <button type="button" className={operatorStatus === "away" ? "selected" : ""} onClick={() => changeStatus("away")}><span className="status-mark away material-symbols-rounded">schedule</span>Ausente{operatorStatus === "away" && <span className="material-symbols-rounded selected-check">done</span>}</button>
              <div className="profile-divider" />
              <a href="/configuracoes"><span className="material-symbols-rounded">language</span>Idioma <b>PT-BR</b></a>
              <a href="/configuracoes"><span className="material-symbols-rounded">shield</span>Opções de login</a>
              <div className="profile-divider" />
              <button type="button" className="profile-logout" onClick={logout}><span className="material-symbols-rounded">logout</span>Sair</button>
            </div>}
          </div>
        </div>
      </header>
      {session.isImpersonating && <div className="impersonation-bar"><span className="material-symbols-rounded">support_agent</span><span>Modo suporte ativo em <strong>{session.tenantName}</strong></span><button type="button" onClick={returnToMaster}>Voltar ao Master</button></div>}{children}
    </main>
  </div>;
}
