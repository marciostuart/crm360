import { requireSession } from "@/lib/auth/require-session";
import { findEvolutionInstance, subscribeEvolution } from "@/lib/evolution/realtime";
import { apiError } from "@/lib/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const instanceName = await findEvolutionInstance((await context.params).id, session.tenantId);
    if (!instanceName) return apiError("Conexão não encontrada.", 404);
    const encoder = new TextEncoder();
    let close: (() => void) | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: unknown) => controller.enqueue(encoder.encode(`event: evolution\ndata: ${JSON.stringify(event)}\n\n`));
        send({ connected: true });
        close = subscribeEvolution(instanceName, send);
        heartbeat = setInterval(() => controller.enqueue(encoder.encode(": heartbeat\n\n")), 20_000);
        request.signal.addEventListener("abort", () => { close?.(); if (heartbeat) clearInterval(heartbeat); try { controller.close(); } catch {} }, { once: true });
      },
      cancel() { close?.(); if (heartbeat) clearInterval(heartbeat); },
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    return apiError(unauthorized ? "Não autorizado." : "Não foi possível abrir o canal em tempo real.", unauthorized ? 401 : 502);
  }
}
