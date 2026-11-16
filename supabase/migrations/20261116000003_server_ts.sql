-- Devices pull by server time, so a device with a slow clock cannot hide its writes behind another
-- device's pull cursor. updated_at (device time) still decides which write wins.
create or replace function public.kasku_touch() returns trigger
language plpgsql as $$ begin new.server_ts = clock_timestamp(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['user_settings', 'books', 'accounts', 'categories', 'members', 'goals', 'recurring', 'bills', 'bill_tags',
    'budgets', 'holdings', 'debts', 'debt_payments', 'rules', 'splits', 'split_people', 'split_items', 'rates'] loop
    execute format('alter table public.%I add column if not exists server_ts timestamptz not null default clock_timestamp()', t);
    execute format('drop trigger if exists kasku_touch on public.%I', t);
    execute format('create trigger kasku_touch before insert or update on public.%I for each row execute function public.kasku_touch()', t);
    execute format('create index if not exists %I on public.%I (user_id, server_ts)', t || '_pull', t);
  end loop;
end $$;
