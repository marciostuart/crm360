import { redirect } from "next/navigation";
import AppShell from "@/components/app-shell";
import { getCurrentSession } from "@/lib/auth/session";
import ConversationsClient from "./conversations-client";

export const dynamic = "force-dynamic";
export default async function ConversationsPage() { const session = await getCurrentSession(); if (!session) redirect("/login"); return <AppShell session={session}><><div className="page-heading"><div><h2>Conversas</h2><p className="muted">Atendimento individual integrado ao WhatsApp.</p></div></div><ConversationsClient /></></AppShell>; }
