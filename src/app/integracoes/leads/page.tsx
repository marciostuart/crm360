import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export default async function LeadIntegrationsPage() { const session = await getCurrentSession(); if (!session) redirect("/login"); redirect("/configuracoes"); }
