// POST /api/generate  { query: string, force?: boolean }
// Streams newline-delimited JSON AgentEvents while the agent investigates,
// ending with {"type":"done","slug":...} or {"type":"error",...}.

import { runAgent } from "@/lib/agent";
import { rateLimit } from "@/lib/store";
import type { AgentEvent } from "@/lib/types";

export const maxDuration = 300; // Vercel Hobby maximum with Fluid compute
export const dynamic = "force-dynamic";

const PER_IP_PER_HOUR = Number(process.env.RATE_LIMIT_PER_HOUR || 8);
const GLOBAL_PER_DAY = Number(process.env.RATE_LIMIT_PER_DAY || 80);

export async function POST(req: Request) {
  let body: { query?: unknown; force?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Expected JSON body" }, { status: 400 });
  }
  // `null`, arrays and other non-objects parse fine but aren't a request.
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Expected a JSON object like {\"query\": \"Slack\"}" }, { status: 400 });
  }
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (query.length < 2 || query.length > 200) {
    return Response.json({ error: "Enter an app name or website (2–200 characters)." }, { status: 400 });
  }
  const force = body.force === true;

  const ip = (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: AgentEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          /* client went away */
        }
      };
      // Keep proxies from buffering/closing an idle stream during long LLM calls.
      const heartbeat = setInterval(() => emit({ type: "log", message: "…" }), 10_000);
      try {
        // Rate limits only apply to fresh generations; cached hits are free.
        const guard = async () => {
          if (!(await rateLimit(`ip:${ip}`, PER_IP_PER_HOUR, 3600))) {
            throw new Error("You've generated several guides in the last hour. Please try again later (this demo runs on free-tier APIs).");
          }
          if (!(await rateLimit(`global:${new Date().toISOString().slice(0, 10)}`, GLOBAL_PER_DAY, 86400))) {
            throw new Error("The demo's daily generation budget is used up (free-tier APIs). Library guides still work.");
          }
        };
        await runAgent(query, { force }, (e) => {
          emit(e);
        }, guard);
      } catch (e) {
        emit({ type: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
