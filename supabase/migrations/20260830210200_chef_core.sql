-- CHEF-IMP-01D — Chef Localix core data model
-- Scope: settings, experiment journeys, sessions, business events and AI usage.
-- Intentionally excludes order attribution, persistent customer memory and raw conversation storage.

begin;

-- -----------------------------------------------------------------------------
-- chef_settings
-- One configuration row per restaurant. Conservative defaults keep Chef disabled.
-- -----------------------------------------------------------------------------
create table public.chef_settings (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  enabled boolean not null default false,
  recommendations_enabled boolean not null default true,
  promotions_enabled boolean not null default true,
  communication_style text not null default 'friendly'
    check (communication_style in ('friendly', 'direct', 'consultative', 'playful')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.chef_settings is
  'Chef Localix configuration per restaurant. Chef remains disabled by default.';

-- -----------------------------------------------------------------------------
-- chef_journeys
-- Independent experiment/journey identity so CONTROL traffic does not depend on
-- opening a Chef session.
-- -----------------------------------------------------------------------------
create table public.chef_journeys (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_id uuid null,
  anonymous_id text null,
  experiment_variant text not null
    check (experiment_variant in ('CONTROL', 'CHEF_V1')),
  assignment_version text not null default 'chef-exp-v1',
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint chef_journeys_actor_present
    check (customer_id is not null or anonymous_id is not null),
  constraint chef_journeys_time_order
    check (ended_at is null or ended_at >= started_at),
  constraint chef_journeys_id_restaurant_unique
    unique (id, restaurant_id)
);

comment on table public.chef_journeys is
  'Restaurant-scoped journey and experiment assignment, including CONTROL journeys.';

create index chef_journeys_restaurant_started_idx
  on public.chef_journeys (restaurant_id, started_at desc);
create index chef_journeys_customer_idx
  on public.chef_journeys (customer_id, started_at desc)
  where customer_id is not null;
create index chef_journeys_anonymous_idx
  on public.chef_journeys (anonymous_id, started_at desc)
  where anonymous_id is not null;
create index chef_journeys_experiment_idx
  on public.chef_journeys (restaurant_id, experiment_variant, started_at desc);

-- -----------------------------------------------------------------------------
-- chef_sessions
-- Created only when the Chef experience is actually opened/started.
-- Composite FK prevents a journey from another restaurant being attached.
-- -----------------------------------------------------------------------------
create table public.chef_sessions (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_id uuid null,
  anonymous_id text null,
  channel text not null default 'text'
    check (channel in ('text')),
  model text null,
  orchestrator_version text not null default 'chef-orch-v1',
  recommendation_version text not null default 'rec-v1',
  status text not null default 'active'
    check (status in ('active', 'completed', 'abandoned', 'error')),
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint chef_sessions_actor_present
    check (customer_id is not null or anonymous_id is not null),
  constraint chef_sessions_time_order
    check (ended_at is null or ended_at >= started_at),
  constraint chef_sessions_id_restaurant_unique
    unique (id, restaurant_id),
  constraint chef_sessions_journey_tenant_fk
    foreign key (journey_id, restaurant_id)
    references public.chef_journeys(id, restaurant_id)
    on delete cascade
);

comment on table public.chef_sessions is
  'Chef Localix interaction sessions. A CONTROL journey has no Chef session.';

create index chef_sessions_journey_idx
  on public.chef_sessions (journey_id, started_at desc);
create index chef_sessions_restaurant_idx
  on public.chef_sessions (restaurant_id, started_at desc);
create index chef_sessions_customer_idx
  on public.chef_sessions (customer_id, started_at desc)
  where customer_id is not null;

-- -----------------------------------------------------------------------------
-- chef_events
-- Structured telemetry only. Raw conversation text is not part of this model.
-- Critical/economic events are intended to be produced server-side.
-- Composite FKs bind journey/session to the same restaurant as the event.
-- -----------------------------------------------------------------------------
create table public.chef_events (
  id uuid primary key default gen_random_uuid(),
  event_key text null,
  journey_id uuid not null,
  session_id uuid null,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_id uuid null,
  anonymous_id text null,
  event_type text not null
    check (event_type in (
      'chef_impression',
      'chef_opened',
      'chef_conversation_started',
      'chef_message_sent',
      'chef_recommendation_requested',
      'chef_recommendation_shown',
      'chef_product_clicked',
      'chef_product_added_to_cart',
      'chef_checkout_started',
      'chef_order_completed',
      'chef_feedback_submitted',
      'chef_tool_error',
      'chef_ai_error',
      'chef_timeout',
      'chef_fallback'
    )),
  source text not null default 'server'
    check (source in ('client', 'server', 'system')),
  product_id uuid null references public.menu_items(id) on delete set null,
  builder_id uuid null references public.builders(id) on delete set null,
  recommendation_id uuid null,
  position smallint null check (position is null or position between 1 and 5),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint chef_events_actor_present
    check (customer_id is not null or anonymous_id is not null),
  constraint chef_events_metadata_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint chef_events_journey_tenant_fk
    foreign key (journey_id, restaurant_id)
    references public.chef_journeys(id, restaurant_id)
    on delete cascade,
  constraint chef_events_session_tenant_fk
    foreign key (session_id, restaurant_id)
    references public.chef_sessions(id, restaurant_id)
);

comment on table public.chef_events is
  'Structured Chef funnel/diagnostic events. Does not store raw conversation by default.';

create unique index chef_events_event_key_uidx
  on public.chef_events (restaurant_id, event_key)
  where event_key is not null;
create index chef_events_journey_idx
  on public.chef_events (journey_id, created_at);
create index chef_events_session_idx
  on public.chef_events (session_id, created_at)
  where session_id is not null;
create index chef_events_restaurant_type_idx
  on public.chef_events (restaurant_id, event_type, created_at desc);
create index chef_events_recommendation_idx
  on public.chef_events (recommendation_id, created_at)
  where recommendation_id is not null;

-- -----------------------------------------------------------------------------
-- chef_ai_usage
-- Technical/economic AI usage telemetry, separated from business events.
-- -----------------------------------------------------------------------------
create table public.chef_ai_usage (
  id uuid primary key default gen_random_uuid(),
  usage_key text null,
  journey_id uuid not null,
  session_id uuid null,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  provider text not null,
  model text not null,
  operation text not null
    check (operation in ('intent_parse', 'conversation_response', 'recommendation_explanation')),
  input_tokens integer null check (input_tokens is null or input_tokens >= 0),
  output_tokens integer null check (output_tokens is null or output_tokens >= 0),
  latency_ms integer null check (latency_ms is null or latency_ms >= 0),
  estimated_cost numeric(14,8) null check (estimated_cost is null or estimated_cost >= 0),
  success boolean not null,
  error_code text null,
  created_at timestamptz not null default now(),
  constraint chef_ai_usage_journey_tenant_fk
    foreign key (journey_id, restaurant_id)
    references public.chef_journeys(id, restaurant_id)
    on delete cascade,
  constraint chef_ai_usage_session_tenant_fk
    foreign key (session_id, restaurant_id)
    references public.chef_sessions(id, restaurant_id)
);

comment on table public.chef_ai_usage is
  'Chef AI provider/model/token/cost/latency telemetry. No raw prompt or response content.';

create unique index chef_ai_usage_usage_key_uidx
  on public.chef_ai_usage (restaurant_id, usage_key)
  where usage_key is not null;
create index chef_ai_usage_session_idx
  on public.chef_ai_usage (session_id, created_at)
  where session_id is not null;
create index chef_ai_usage_restaurant_idx
  on public.chef_ai_usage (restaurant_id, created_at desc);
create index chef_ai_usage_model_idx
  on public.chef_ai_usage (provider, model, created_at desc);

-- -----------------------------------------------------------------------------
-- RLS: deny by default for telemetry. No direct anon/authenticated writes.
-- service_role keeps backend access through its bypass-RLS privilege and grants.
-- -----------------------------------------------------------------------------
alter table public.chef_settings enable row level security;
alter table public.chef_journeys enable row level security;
alter table public.chef_sessions enable row level security;
alter table public.chef_events enable row level security;
alter table public.chef_ai_usage enable row level security;

-- Remove broad Data API privileges first. Grant back only the minimum required.
revoke all on table public.chef_settings from anon, authenticated;
revoke all on table public.chef_journeys from anon, authenticated;
revoke all on table public.chef_sessions from anon, authenticated;
revoke all on table public.chef_events from anon, authenticated;
revoke all on table public.chef_ai_usage from anon, authenticated;

grant all on table public.chef_settings to service_role;
grant all on table public.chef_journeys to service_role;
grant all on table public.chef_sessions to service_role;
grant all on table public.chef_events to service_role;
grant all on table public.chef_ai_usage to service_role;

-- Partners may read/update only their own restaurant Chef settings.
grant select, update on table public.chef_settings to authenticated;

create policy "Restaurant owners can view Chef settings"
  on public.chef_settings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.restaurants r
      where r.id = chef_settings.restaurant_id
        and r.owner_id = (select auth.uid())
    )
  );

create policy "Restaurant owners can update Chef settings"
  on public.chef_settings
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.restaurants r
      where r.id = chef_settings.restaurant_id
        and r.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.restaurants r
      where r.id = chef_settings.restaurant_id
        and r.owner_id = (select auth.uid())
    )
  );

-- No policies are intentionally created for journeys/sessions/events/AI usage.
-- With RLS enabled and anon/authenticated privileges revoked, browser clients
-- cannot read or mutate telemetry directly.

commit;
