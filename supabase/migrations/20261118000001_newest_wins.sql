-- Newest write wins on the server too. An upsert that carries an older updated_at than the stored row
-- is skipped, so a device that comes back online with an old edit can no longer overwrite a newer one.
-- The app sees the skipped row missing from the upsert reply and takes the server copy instead.
-- Runs before kasku_touch (triggers fire in name order), so a skipped row keeps its server_ts.
create or replace function public.kasku_lww() returns trigger
language plpgsql as $$
begin
  if new.updated_at < old.updated_at then return null; end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['user_settings', 'books', 'accounts', 'categories', 'members', 'goals', 'recurring', 'bills',
    'budgets', 'holdings', 'debts', 'rules', 'splits', 'rates'] loop
    execute format('drop trigger if exists kasku_lww on public.%I', t);
    execute format('create trigger kasku_lww before update on public.%I for each row execute function public.kasku_lww()', t);
  end loop;
end $$;
