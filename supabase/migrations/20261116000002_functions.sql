-- Starter data, server-side totals and the AI usage counter.

-- Starter data for one user; ids match the app's built-in ids, so reruns change nothing.
create or replace function public.seed_user_for(p uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into user_settings (user_id) values (p) on conflict do nothing;
  insert into books (user_id, id, names, icon, sort) values
    (p, 'book-default', '{"id":"Buku harian","en":"Daily ledger"}', 'notebook', 0)
  on conflict do nothing;
  insert into accounts (user_id, id, type, names, icon, color, currency, sort) values
    (p, 'acc-cash', 'cash', '{"id":"Tunai","en":"Cash"}', 'cash', '#29bc9b', 'IDR', 0),
    (p, 'acc-bank', 'debit', '{"id":"Kartu debit","en":"Debit card"}', 'card', '#0070f3', 'IDR', 1),
    (p, 'acc-ewallet', 'ewallet', '{"id":"Dompet digital","en":"E-wallet"}', 'ewallet', '#7928ca', 'IDR', 2)
  on conflict do nothing;
  insert into members (user_id, id, names, icon, sort) values
    (p, 'mem-me', '{"id":"Diri sendiri","en":"Myself"}', 'person', 0),
    (p, 'mem-partner', '{"id":"Pasangan","en":"Partner"}', 'heart', 1),
    (p, 'mem-child', '{"id":"Anak","en":"Child"}', 'child', 2),
    (p, 'mem-parent', '{"id":"Orang tua","en":"Parent"}', 'elder', 3)
  on conflict do nothing;
  insert into categories (user_id, id, type, names, icon, color, sort) values
    (p, 'cat-food', 'expense', '{"id":"Makan","en":"Food"}', 'food', '#f5a623', 0),
    (p, 'cat-daily', 'expense', '{"id":"Harian","en":"Daily"}', 'toiletries', '#00dfd8', 1),
    (p, 'cat-traffic', 'expense', '{"id":"Transportasi","en":"Transport"}', 'bus', '#29bc9b', 2),
    (p, 'cat-social', 'expense', '{"id":"Sosial","en":"Social"}', 'cheers', '#7928ca', 3),
    (p, 'cat-home', 'expense', '{"id":"Rumah","en":"Housing"}', 'house', '#ab570a', 4),
    (p, 'cat-gift', 'expense', '{"id":"Hadiah","en":"Gift"}', 'gift', '#ff0080', 5),
    (p, 'cat-phone', 'expense', '{"id":"Komunikasi","en":"Phone"}', 'phone', '#0070f3', 6),
    (p, 'cat-dress', 'expense', '{"id":"Pakaian","en":"Clothes"}', 'shirt', '#ff4d4d', 7),
    (p, 'cat-fun', 'expense', '{"id":"Rekreasi","en":"Fun"}', 'game', '#eb367f', 8),
    (p, 'cat-beauty', 'expense', '{"id":"Kecantikan","en":"Beauty"}', 'lipstick', '#4c2889', 9),
    (p, 'cat-medical', 'expense', '{"id":"Medis","en":"Medical"}', 'pill', '#c50000', 10),
    (p, 'cat-tax', 'expense', '{"id":"Pajak","en":"Tax"}', 'tax', '#a1a1a1', 11),
    (p, 'cat-edu', 'expense', '{"id":"Pendidikan","en":"Education"}', 'book', '#50e3c2', 12),
    (p, 'cat-baby', 'expense', '{"id":"Bayi","en":"Baby"}', 'bottle', '#f9cb28', 13),
    (p, 'cat-pet', 'expense', '{"id":"Peliharaan","en":"Pet"}', 'cat', '#888888', 14),
    (p, 'cat-travel', 'expense', '{"id":"Bepergian","en":"Travel"}', 'plane', '#0761d1', 15),
    (p, 'cat-wage', 'income', '{"id":"Gaji","en":"Salary"}', 'moneybag', '#f5a623', 0),
    (p, 'cat-bonus', 'income', '{"id":"Bonus","en":"Bonus"}', 'medal', '#7928ca', 1),
    (p, 'cat-invest', 'income', '{"id":"Investasi","en":"Investment"}', 'chartUp', '#29bc9b', 2),
    (p, 'cat-parttime', 'income', '{"id":"Kerja sampingan","en":"Side job"}', 'briefcase', '#0070f3', 3),
    (p, 'cat-other-in', 'income', '{"id":"Lainnya","en":"Other"}', 'coins', '#888888', 4)
  on conflict do nothing;
end $$;
revoke all on function public.seed_user_for(uuid) from public;

-- Called by the app on first load, in case the sign-up trigger did not run.
create or replace function public.seed_user() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  perform seed_user_for(auth.uid());
end $$;
revoke all on function public.seed_user() from public;
grant execute on function public.seed_user() to authenticated;

create or replace function public.seed_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform seed_user_for(new.id);
  return new;
end $$;
drop trigger if exists kasku_seed_new_user on auth.users;
create trigger kasku_seed_new_user after insert on auth.users for each row execute function public.seed_new_user();

-- Amount in the main currency, using the saved manual rate (1 when none, as the app does).
create or replace function public.to_base(p_user uuid, p_currency text, p_amount numeric) returns numeric
language sql stable set search_path = public as $$
  select p_amount * case
    when p_currency is null or p_currency = coalesce((select currency from user_settings where user_id = p_user), 'IDR') then 1
    else coalesce((select rate from rates where user_id = p_user and code = p_currency and not deleted and rate > 0), 1) end
$$;

-- Income, expense and breakdowns for local dates [p_from, p_to] in the user's time zone. Transfers excluded.
create or replace function public.totals(p_from date, p_to date, p_book text default null) returns jsonb
language sql stable set search_path = public as $$
  with st as (
    select coalesce(s.currency, 'IDR') as cur, coalesce(s.tz, 'Asia/Jakarta') as tz, coalesce(s.lang, 'id') as lang
    from (select 1) one left join user_settings s on s.user_id = auth.uid()
  ), b as (
    select bl.type, bl.category_id, bl.account_id, to_base(bl.user_id, a.currency, bl.amount) as base,
      (bl.time at time zone st.tz)::date as day
    from bills bl cross join st
    left join accounts a on a.user_id = bl.user_id and a.id = bl.account_id
    where bl.user_id = auth.uid() and not bl.deleted and bl.type in ('expense', 'income')
      and bl.time >= (p_from::timestamp at time zone st.tz) and bl.time < ((p_to + 1)::timestamp at time zone st.tz)
      and (p_book is null or coalesce(bl.book_id, 'book-default') = p_book)
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to, 'currency', (select cur from st),
    'income', coalesce((select round(sum(base), 2) from b where type = 'income'), 0),
    'expense', coalesce((select round(sum(base), 2) from b where type = 'expense'), 0),
    'count', (select count(*) from b),
    'by_category', coalesce((select jsonb_agg(x order by x->>'type', (x->>'total')::numeric desc) from (
      select jsonb_build_object('type', b.type, 'category_id', b.category_id,
        'name', coalesce(c.name, c.names->>(select lang from st), c.names->>'id', b.category_id),
        'total', round(sum(b.base), 2), 'count', count(*)) as x
      from b left join categories c on c.user_id = auth.uid() and c.id = b.category_id
      group by b.type, b.category_id, c.name, c.names) q), '[]'::jsonb),
    'by_account', coalesce((select jsonb_agg(x order by (x->>'expense')::numeric desc) from (
      select jsonb_build_object('account_id', b.account_id,
        'name', coalesce(a.name, a.names->>(select lang from st), a.names->>'id', b.account_id),
        'income', round(coalesce(sum(b.base) filter (where b.type = 'income'), 0), 2),
        'expense', round(coalesce(sum(b.base) filter (where b.type = 'expense'), 0), 2)) as x
      from b left join accounts a on a.user_id = auth.uid() and a.id = b.account_id
      group by b.account_id, a.name, a.names) q), '[]'::jsonb),
    'by_day', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'income', inc, 'expense', exp) order by day) from (
      select day, round(coalesce(sum(base) filter (where type = 'income'), 0), 2) as inc,
        round(coalesce(sum(base) filter (where type = 'expense'), 0), 2) as exp
      from b group by day) d), '[]'::jsonb)
  )
$$;

-- Spent and limit of every budget for the period containing p_at; weeks start on Sunday, as in the app.
create or replace function public.budget_usage(p_at timestamptz default now()) returns jsonb
language sql stable set search_path = public as $$
  with st as (
    select coalesce(s.tz, 'Asia/Jakarta') as tz, coalesce(s.lang, 'id') as lang, (p_at at time zone coalesce(s.tz, 'Asia/Jakarta')) as loc
    from (select 1) one left join user_settings s on s.user_id = auth.uid()
  ), r as (
    select bg.*, st.tz, st.lang,
      case bg.period
        when 'custom' then bg.start_at
        when 'week' then (st.loc::date - extract(dow from st.loc)::int)::timestamp at time zone st.tz
        when 'year' then date_trunc('year', st.loc) at time zone st.tz
        else date_trunc('month', st.loc) at time zone st.tz end as s0,
      case bg.period
        when 'custom' then bg.end_at + interval '1 day'
        when 'week' then (st.loc::date - extract(dow from st.loc)::int + 7)::timestamp at time zone st.tz
        when 'year' then (date_trunc('year', st.loc) + interval '1 year') at time zone st.tz
        else (date_trunc('month', st.loc) + interval '1 month') at time zone st.tz end as e0
    from budgets bg cross join st
    where bg.user_id = auth.uid() and not bg.deleted
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'budget_id', r.id, 'category_id', r.category_id,
    'name', coalesce(c.name, c.names->>r.lang, c.names->>'id'),
    'period', r.period, 'from', r.s0, 'to', r.e0, 'limit', r.amount,
    'spent', coalesce((select round(sum(to_base(bl.user_id, a.currency, bl.amount)), 2)
      from bills bl left join accounts a on a.user_id = bl.user_id and a.id = bl.account_id
      where bl.user_id = r.user_id and not bl.deleted and bl.type = 'expense'
        and coalesce(bl.book_id, 'book-default') = coalesce(r.book_id, 'book-default')
        and (r.category_id is null or bl.category_id = r.category_id)
        and bl.time >= r.s0 and bl.time < r.e0), 0)
  ) order by r.id), '[]'::jsonb)
  from r left join categories c on c.user_id = r.user_id and c.id = r.category_id
$$;

grant execute on function public.to_base(uuid, text, numeric) to authenticated;
grant execute on function public.totals(date, date, text) to authenticated;
grant execute on function public.budget_usage(timestamptz) to authenticated;

-- Takes one AI request from today's allowance (UTC day). ok=false once the limit is reached.
create or replace function public.ai_take(p_limit integer default 100) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into ai_usage (user_id, day, count) values (auth.uid(), (now() at time zone 'UTC')::date, 1)
  on conflict (user_id, day) do update set count = ai_usage.count + 1 where ai_usage.count < p_limit
  returning count into n;
  if n is null then return jsonb_build_object('ok', false, 'count', p_limit, 'limit', p_limit); end if;
  return jsonb_build_object('ok', true, 'count', n, 'limit', p_limit);
end $$;
revoke all on function public.ai_take(integer) from public;
grant execute on function public.ai_take(integer) to authenticated;
