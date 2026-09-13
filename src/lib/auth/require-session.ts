import { getCurrentSession, type CurrentSession } from "./session";

export async function requireSession(): Promise<CurrentSession> {
  const session = await getCurrentSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export function isAdmin(session: CurrentSession): boolean {
  return ["owner", "admin"].includes(session.role);
}

export function isManager(session: CurrentSession): boolean {
  return isAdmin(session) || ["manager", "supervisor"].includes(session.role);
}
