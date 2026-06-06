-- Seed daily counters from existing order numbers.
-- This migration is idempotent and safe to run after the security migration.
insert into public.order_daily_counters (order_date, last_value)
select
  to_date(substring(order_number from 5 for 8), 'YYYYMMDD') as order_date,
  max(substring(order_number from 14)::integer) as last_value
from public.orders
where order_number ~ '^ORD-[0-9]{8}-[0-9]+$'
group by 1
on conflict (order_date) do update
set last_value = greatest(
  public.order_daily_counters.last_value,
  excluded.last_value
);
