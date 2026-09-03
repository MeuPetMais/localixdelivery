-- RW-1.3 — Operational health for Localix Rewards

create or replace function public.rewards_operational_health()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  with q as (
    select
      count(*) filter (where status='PENDING')::int as pending,
      count(*) filter (where status='FAILED' and attempts < max_attempts)::int as retryable_failed,
      count(*) filter (where status='FAILED' and attempts >= max_attempts)::int as exhausted,
      count(*) filter (where status='PROCESSED' and processed_at >= now()-interval '1 hour')::int as processed_last_hour,
      count(*) filter (where status='PROCESSED' and processed_at >= now()-interval '24 hours')::int as processed_last_24h,
      min(created_at) filter (where status in ('PENDING','FAILED') and attempts < max_attempts) as oldest_actionable_at
    from public.reward_order_event_queue
  ), c as (
    select count(*)::int as clawback_pending
    from public.reward_progress_events
    where event_type='CLAWBACK_PENDING'
  ), s as (
    select coalesce(localix_rewards_enabled,false) as rewards_enabled,
           coalesce(localix_benefits_enabled,false) as benefits_enabled
    from public.platform_settings where id=true limit 1
  ), j as (
    select count(*) filter (where active)::int as active_jobs
    from cron.job where jobname='localix-rewards-order-events'
  )
  select jsonb_build_object(
    'ok', (q.exhausted=0 and j.active_jobs=1),
    'rewards_enabled', s.rewards_enabled,
    'benefits_enabled', s.benefits_enabled,
    'queue', jsonb_build_object(
      'pending',q.pending,
      'retryable_failed',q.retryable_failed,
      'exhausted',q.exhausted,
      'oldest_actionable_at',q.oldest_actionable_at,
      'oldest_actionable_age_seconds',case when q.oldest_actionable_at is null then 0 else extract(epoch from now()-q.oldest_actionable_at)::bigint end,
      'processed_last_hour',q.processed_last_hour,
      'processed_last_24h',q.processed_last_24h
    ),
    'clawback_pending',c.clawback_pending,
    'worker',jsonb_build_object('active_jobs',j.active_jobs),
    'checked_at',now()
  )
  from q,c,s,j;
$$;

revoke all on function public.rewards_operational_health() from public, anon, authenticated;
grant execute on function public.rewards_operational_health() to service_role;