import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM360",
  description: "CRM multi-tenant com integração WhatsApp",
  icons: { icon: "/logo.webp", shortcut: "/logo.webp", apple: "/logo.webp" },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><head>
    <script dangerouslySetInnerHTML={{ __html: `
      (function () {
        try {
          var root = document.documentElement;
          var storage = window.localStorage;
          var dark = storage.getItem("crm360-dark-mode") === "true";
          var sidebarCollapsed = storage.getItem("crm360-sidebar-open") === "false";
          root.classList.toggle("dark-mode", dark);
          root.classList.toggle("sidebar-preference-collapsed", sidebarCollapsed);
        } catch (_) {}
      }());
    ` }} />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0&display=swap" rel="stylesheet" />
  </head><body>{children}</body></html>;
}
