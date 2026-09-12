import { NextResponse } from "next/server";

export function apiError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function jsonBody(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}

export function positiveId(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
