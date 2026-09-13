import { redirect } from "next/navigation";
import { getMasterSession } from "@/lib/auth/master-session";
import MasterClient from "./master-client";

export const dynamic = "force-dynamic";

export default async function MasterPage() {
  const session = await getMasterSession();
  if (!session) redirect("/master/login");
  return <MasterClient session={session} />;
}
