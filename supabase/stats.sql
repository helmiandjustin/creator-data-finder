-- Run this once in Supabase SQL Editor.
-- The function returns only aggregated overview data to the browser.
create or replace function public.get_creator_stats()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with clock as (
  select (now() at time zone 'Asia/Jakarta')::date as today
), bounds as (
  select
    date_trunc('month', today)::date as current_start,
    (date_trunc('month', today) - interval '1 month')::date as previous_start,
    (date_trunc('month', today) + interval '1 month')::date as next_start
  from clock
), daily as (
  select c.record_date as date, count(*)::integer as count
  from public.creators c, bounds b
  where c.record_date >= b.current_start
    and c.record_date < b.next_start
  group by c.record_date
  order by c.record_date
)
select jsonb_build_object(
  'total', (select count(*) from public.creators),
  'current_month', (select count(*) from public.creators c, bounds b where c.record_date >= b.current_start and c.record_date < b.next_start),
  'previous_month', (select count(*) from public.creators c, bounds b where c.record_date >= b.previous_start and c.record_date < b.current_start),
  'daily', coalesce((select jsonb_agg(jsonb_build_object('date', date, 'count', count) order by date) from daily), '[]'::jsonb)
);
$$;

grant execute on function public.get_creator_stats() to authenticated;
