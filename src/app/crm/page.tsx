import { redirect } from "next/navigation";
import AppShell from "@/components/app-shell";
import { getCurrentSession } from "@/lib/auth/session";
import CrmClient from "./crm-client";

export const dynamic = "force-dynamic";
export default async function CrmPage() { const session = await getCurrentSession(); if (!session) redirect("/login"); return <AppShell session={session}><><div className="page-heading"><div><h2>CRM</h2><p className="muted">Acompanhe seus negócios no funil.</p></div></div><CrmClient /></></AppShell>; }
