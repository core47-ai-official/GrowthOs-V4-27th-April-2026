
-- 1) New table: integrations (per-user tokens), isolated and RLS-protected
create table if not exists public.integrations (
  id            bigserial primary key,
  user_id       uuid not null references public.users(id) on delete cascade,
  source        text not null check (source in ('shopify','meta_ads')),
  access_token  text not null,
  refresh_token text,
  -- optional external identifier (e.g., shop domain for Shopify or ad account id for Meta)
  external_id   text,
  connected_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Ensure only one integration per user per source
create unique index if not exists integrations_user_source_unique
  on public.integrations(user_id, source);

-- Helpful lookup index
create index if not exists integrations_user_idx
  on public.integrations(user_id);

-- RLS
alter table public.integrations enable row level security;

-- Policies (granular)
drop policy if exists "Integrations: users can select their own" on public.integrations;
create policy "Integrations: users can select their own"
  on public.integrations for select
  using (auth.uid() = user_id);

drop policy if exists "Integrations: users can insert their own" on public.integrations;
create policy "Integrations: users can insert their own"
  on public.integrations for insert
  with check (auth.uid() = user_id);

drop policy if exists "Integrations: users can update their own" on public.integrations;
create policy "Integrations: users can update their own"
  on public.integrations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Integrations: users can delete their own" on public.integrations;
create policy "Integrations: users can delete their own"
  on public.integrations for delete
  using (auth.uid() = user_id);

-- Keep updated_at fresh on updates
drop trigger if exists trg_integrations_updated_at on public.integrations;
create trigger trg_integrations_updated_at
before update on public.integrations
for each row execute function public.update_updated_at_column();


-- 2) New table: user_metrics (normalized, time-series metrics), isolated and RLS-protected
create table if not exists public.user_metrics (
  id         bigserial primary key,
  user_id    uuid not null references public.users(id) on delete cascade,
  source     text not null check (source in ('shopify','meta_ads')),
  metric     text not null,
  value      numeric not null,
  date       date not null,
  fetched_at timestamptz not null default now(),
  -- one row per user/source/metric/day
  unique (user_id, source, metric, date)
);

-- Performance indexes
create index if not exists user_metrics_user_date_idx
  on public.user_metrics(user_id, date);

create index if not exists user_metrics_user_source_metric_date_idx
  on public.user_metrics(user_id, source, metric, date);

-- RLS
alter table public.user_metrics enable row level security;

-- Policies (granular)
drop policy if exists "User Metrics: users can select their own" on public.user_metrics;
create policy "User Metrics: users can select their own"
  on public.user_metrics for select
  using (auth.uid() = user_id);

drop policy if exists "User Metrics: users can insert their own" on public.user_metrics;
create policy "User Metrics: users can insert their own"
  on public.user_metrics for insert
  with check (auth.uid() = user_id);

drop policy if exists "User Metrics: users can update their own" on public.user_metrics;
create policy "User Metrics: users can update their own"
  on public.user_metrics for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "User Metrics: users can delete their own" on public.user_metrics;
create policy "User Metrics: users can delete their own"
  on public.user_metrics for delete
  using (auth.uid() = user_id);
