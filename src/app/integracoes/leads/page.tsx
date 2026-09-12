import { redirect } from "next/navigation";
import AppShell from "@/components/app-shell";
import { getCurrentSession } from "@/lib/auth/session";
import LeadEndpointsClient from "./lead-endpoints-client";

export const dynamic = "force-dynamic";
export default async function LeadIntegrationsPage() { const session = await getCurrentSession(); if (!session || !["owner", "admin"].includes(session.role)) redirect("/dashboard"); return <AppShell session={session}><><div className="page-heading"><div><h2>Webhook de leads</h2><p className="muted">Entrada segura de leads para este tenant.</p></div></div><LeadEndpointsClient /></></AppShell>; }
