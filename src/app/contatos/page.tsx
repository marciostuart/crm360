import { redirect } from "next/navigation";
import AppShell from "@/components/app-shell";
import { getCurrentSession } from "@/lib/auth/session";
import ContactsClient from "./contacts-client";

export const dynamic = "force-dynamic";
export default async function ContactsPage() {
  const session = await getCurrentSession(); if (!session) redirect("/login");
  return <AppShell session={session}><><div className="page-heading"><div><h2>Contatos</h2><p className="muted">Leads e contatos do seu tenant.</p></div></div><ContactsClient /></></AppShell>;
}
