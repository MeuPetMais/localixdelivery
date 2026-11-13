// Internal, opt-in worker. It is NOT scheduled automatically.
// Configure independent secret(s), test in isolated staging and enable a
// trusted scheduler only after financial approval. Never use a browser key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { isClaimableEvent, nextWebhookRetry } from "./retry-policy.ts";

const HEADERS = { "content-type": "application/json" };
const MAX_BATCH = 5;
const LOCK_STALE_MS = 10 * 60_000;

function respond(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return respond({ ok: false, error: "method_not_allowed" }, 405);

  const workerSecret = Deno.env.get("MP_WEBHOOK_RETRY_WORKER_SECRET");
  const replaySecret = Deno.env.get("MP_WEBHOOK_REPLAY_SECRET");
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cutover = Deno.env.get("MP_WEBHOOK_RETRY_CUTOVER");
  const cutoverTime = Date.parse(cutover ?? "");

  // Historical entries require manual gateway reconciliation. An explicit
  // cutover protects pre-rollout webhooks from an unintended automatic replay.
  // No configuration means no financial side effects, even when invoked.
  if (!workerSecret || !replaySecret || !url || !serviceKey || !Number.isFinite(cutoverTime)) {
    return respond({ ok: false, error: "worker_not_configured" }, 503);
  }
  if (req.headers.get("authorization") !== `Bearer ${workerSecret}`) {
    return respond({ ok: false, error: "unauthorized" }, 401);
  }

  const sb = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const now = new Date();
  const staleBefore = new Date(now.getTime() - LOCK_STALE_MS).toISOString();

  // Recover abandoned queue locks. Event-level compare-and-swap below prevents
  // concurrent replays for recently touched webhook events.
  const { error: releaseError } = await sb
    .from("payment_event_queue")
    .update({ locked: false })
    .eq("status", "pending")
    .eq("locked", true)
    .lt("updated_at", staleBefore);
  if (releaseError) return respond({ ok: false, error: "stale_lock_release_failed" }, 503);

  const { data: jobs, error: listError } = await sb
    .from("payment_event_queue")
    .select("id,event_id,retry_count,locked,next_retry,status")
    .gte("created_at", new Date(cutoverTime).toISOString())
    .eq("status", "pending")
    .eq("locked", false)
    .lte("next_retry", now.toISOString())
    .order("next_retry", { ascending: true })
    .limit(MAX_BATCH);
  if (listError) return respond({ ok: false, error: "queue_read_failed" }, 503);

  let completed = 0;
  let retried = 0;
  let deferred = 0;
  let failed = 0;

  for (const job of jobs ?? []) {
    const { data: locked, error: claimError } = await sb
      .from("payment_event_queue")
      .update({ locked: true })
      .eq("id", job.id)
      .eq("status", "pending")
      .eq("locked", false)
      .eq("retry_count", job.retry_count)
      .lte("next_retry", now.toISOString())
      .select("id")
      .maybeSingle();
    if (claimError || !locked) {
      deferred++;
      continue;
    }

    const finish = async (status: string, errorMessage: string | null) => {
      const policy = nextWebhookRetry(Number(job.retry_count ?? 0), new Date());
      const update =
        status === "completed"
          ? { status, locked: false, last_error: null }
          : {
              status: policy.status,
              locked: false,
              retry_count: policy.attempts,
              next_retry: policy.nextRetry,
              last_error: (errorMessage ?? "replay_failed").slice(0, 250),
            };
      const { error } = await sb
        .from("payment_event_queue")
        .update(update)
        .eq("id", job.id)
        .eq("locked", true);
      if (error) throw new Error("queue_finalization_failed");
      if (status === "completed") completed++;
      else if (policy.status === "failed") failed++;
      else retried++;
    };

    try {
      const { data: event, error: eventError } = await sb
        .from("payment_webhook_events")
        .select(
          "id,processed,processing_attempts,updated_at,payload_json,signature,resource_id,event_id,provider",
        )
        .eq("id", job.event_id)
        .single();
      if (eventError || !event || event.provider !== "mercado_pago") {
        await finish("retry", "event_missing_or_untrusted");
        continue;
      }
      if (event.processed === true) {
        await finish("completed", null);
        continue;
      }
      const attempt = Number(event.processing_attempts);
      if (
        !Number.isInteger(attempt) ||
        !isClaimableEvent(event.processed, event.updated_at, new Date())
      ) {
        await finish("retry", "event_claim_not_ready");
        continue;
      }

      // Atomic CAS on the event itself. Different queue rows referencing the
      // same event cannot both claim an event within this short replay lease.
      const cutoff = new Date(Date.now() - 3 * 60_000).toISOString();
      const { data: claimed, error: casError } = await sb
        .from("payment_webhook_events")
        .update({ processing_attempts: attempt + 1 })
        .eq("id", event.id)
        .eq("processed", false)
        .eq("processing_attempts", attempt)
        .lt("updated_at", cutoff)
        .select("id")
        .maybeSingle();
      if (casError || !claimed) {
        await finish("retry", "event_claim_lost");
        continue;
      }

      // Replay only the original persisted event. The webhook then validates
      // the payment against Mercado Pago before any financial transition.
      const target = new URL(`${url.replace(/\/$/, "")}/functions/v1/mp-webhook`);
      if (event.resource_id) target.searchParams.set("data.id", event.resource_id);
      const response = await fetch(target, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-localix-replay-secret": replaySecret,
          ...(event.signature ? { "x-signature": event.signature } : {}),
        },
        body: JSON.stringify(event.payload_json),
        signal: AbortSignal.timeout(30_000),
      });
      const answer = await response.json().catch(() => null);
      const { data: result, error: resultError } = await sb
        .from("payment_webhook_events")
        .select("processed")
        .eq("id", event.id)
        .single();

      if (!resultError && response.ok && answer?.ok === true && result?.processed === true) {
        await finish("completed", null);
      } else {
        await finish("retry", "mp_webhook_replay_not_completed");
      }
    } catch (error) {
      console.error(
        "[mp-webhook-retry] replay failed",
        error instanceof Error ? error.message : "unknown",
      );
      try {
        await finish("retry", "replay_exception");
      } catch (finalizationError) {
        console.error("[mp-webhook-retry] queue finalization failed", finalizationError);
      }
    }
  }

  return respond(
    { ok: failed === 0, scanned: jobs?.length ?? 0, completed, retried, deferred, failed },
    failed > 0 ? 503 : 200,
  );
});
