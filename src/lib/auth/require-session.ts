import { getCurrentSession, type CurrentSession } from "./session";

export async function requireSession(): Promise<CurrentSession> {
  const session = await getCurrentSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export function isManager(session: CurrentSession): boolean {
  return ["owner", "admin", "supervisor"].includes(session.role);
}
