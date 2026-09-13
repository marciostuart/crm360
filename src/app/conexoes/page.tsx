import { redirect } from "next/navigation";
import AppShell from "@/components/app-shell";
import { getCurrentSession } from "@/lib/auth/session";
import { isManager } from "@/lib/auth/require-session";
import ConnectionsClient from "./connections-client";

export const dynamic = "force-dynamic";
export default async function ConnectionsPage() { const session = await getCurrentSession(); if (!session) redirect("/login"); return <AppShell session={session}><><div className="page-heading"><div><h2>WhatsApp</h2><p className="muted">Conexões protegidas pela Evolution API.</p></div></div><ConnectionsClient canManage={isManager(session)} /></></AppShell>; }
