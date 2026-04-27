-- Ensure idempotent upserts for metrics sync
create unique index if not exists user_metrics_unique_user_source_metric_date
  on public.user_metrics (user_id, source, metric, date);
