import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM360",
  description: "CRM multi-tenant com integração WhatsApp",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
