-- Kasku+ relational schema. Every row belongs to one user (user_id) and ids are generated on the
-- device, so keys are (user_id, id). updated_at is the device clock in ms; newest write wins.

create table if not exists public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  lang text not null default 'id' check (lang in ('id', 'en')),
  currency text not null default 'IDR',
  accent text,
  dark boolean not null default false,
  book_id text,
  tz text not null default 'Asia/Jakarta',
  updated_at bigint not null default 0
);

create table if not exists public.books (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  name text, names jsonb, icon text, color text, sort double precision not null default 0,
  updated_at bigint not null default 0, deleted boolean not null default false,
  primary key (user_id, id)
);

create table if not exists public.accounts (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  type text not null default 'cash' check (type in ('cash', 'debit', 'credit', 'ewallet', 'invest', 'receivable', 'payable', 'other')),
  name text, names jsonb, icon text, color text, note text,
  currency text not null default 'IDR',
  init_balance numeric(18, 2) not null default 0,
  archived boolean not null default false,
  sort double precision not null default 0,
  updated_at bigint not null default 0, deleted boolean not null default false,
  primary key (user_id, id)
);

create table if not exists public.categories (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  type text not null check (type in ('expense', 'income')),
  name text, names jsonb, icon text, color text, sort double precision not null default 0,
  updated_at bigint not null default 0, deleted boolean not null default false,
  primary key (user_id, id)
);

create table if not exists public.members (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  name text, names jsonb, icon text, color text, sort double precision not null default 0,
  updated_at bigint not null default 0, deleted boolean not null default false,
  primary key (user_id, id)
);

create table if not exists public.goals (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  name text not null, target numeric(18, 2) not null check (target > 0),
  account_id text, due timestamptz, sort double precision not null default 0,
  updated_at bigint not null default 0, deleted boolean not null default false,
  primary key (user_id, id),
  foreign key (user_id, account_id) references public.accounts (user_id, id)
);

create table if not exists public.recurring (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  type text not null check (type in ('expense', 'income', 'transfer')),
  amount numeric(18, 2) not null check (amount > 0),
  book_id text, account_id text, to_account_id text, category_id text, member_id text, note text,
  freq text not null check (freq in ('daily', 'weekly', 'monthly')),
  next_at timestamptz, day smallint, active boolean not null default true,
  updated_at bigint not null default 0, deleted boolean not null default false,
  primary key (user_id, id),
  foreign key (user_id, account_id) references public.accounts (user_id, id),
  foreign key (user_id, to_account_id) references public.accounts (user_id, id),
  foreign key (user_id, category_id) references public.categories (user_id, id)
);

create table if not exists public.bills (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  type text not null check (type in ('expense', 'income', 'transfer')),
  amount numeric(18, 2) not null check (amount >= 0),
  time timestamptz not null,
  book_id text, account_id text, to_account_id text, category_id text, member_id text,
  note text, has_photo boolean not null default false,
  goal_id text, recurring_id text, created_at bigint,
  updated_at bigint not null default 0, deleted boolean not null default false,
  primary key (user_id, id),
  foreign key (user_id, book_id) references public.books (user_id, id),
  foreign key (user_id, account_id) references public.accounts (user_id, id),
  foreign key (user_id, to_account_id) references public.accounts (user_id, id),
  foreign key (user_id, category_id) references public.categories (user_id, id),
  foreign key (user_id, member_id) references public.members (user_id, id)
);

create table if not exists public.bill_tags (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  bill_id text not null, tag text not null, updated_at bigint not null default 0,
  primary key (user_id, bill_id, tag),
  foreign key (user_id, bill_id) references public.bills (user_id, id) on delete cascade
);

create table if not exists public.budgets (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  book_id text, category_id text,
  amount numeric(18, 2) not null check (amount > 0),
  period text not null default 'month' check (period in ('week', 'month', 'year', 'custom')),
  start_at timestamptz, end_at timestamptz,
  updated_at bigint not null default 0, deleted boolean not null default false,
  primary key (user_id, id),
  foreign key (user_id, category_id) references public.categories (user_id, id)
);

create table if not exists public.holdings (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  type text not null check (type in ('saham', 'reksadana', 'emas')),
  name text not null, units numeric(20, 6) not null, buy_price numeric(18, 2) not null, price numeric(18, 2) not null,
  price_at bigint, sort double precision not null default 0,
  updated_at bigint not null default 0, deleted boolean not null default false,
  primary key (user_id, id)
);

create table if not exists public.debts (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  dir text not null check (dir in ('owe', 'lent')),
  person text not null, amount numeric(18, 2) not null check (amount > 0),
  note text, due timestamptz, time timestamptz,
  updated_at bigint not null default 0, deleted boolean not null default false,
  primary key (user_id, id)
);

create table if not exists public.debt_payments (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  debt_id text not null, idx integer not null,
  amount numeric(18, 2) not null, time timestamptz, updated_at bigint not null default 0,
  primary key (user_id, debt_id, idx),
  foreign key (user_id, debt_id) references public.debts (user_id, id) on delete cascade
);

create table if not exists public.rules (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  keyword text not null, category_id text, sort double precision not null default 0,
  updated_at bigint not null default 0, deleted boolean not null default false,
  primary key (user_id, id),
  foreign key (user_id, category_id) references public.categories (user_id, id)
);

create table if not exists public.splits (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  title text not null, tax_pct numeric(6, 2) not null default 0, service_pct numeric(6, 2) not null default 0, time timestamptz,
  updated_at bigint not null default 0, deleted boolean not null default false,
  primary key (user_id, id)
);

create table if not exists public.split_people (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  split_id text not null, idx integer not null,
  name text not null, paid boolean not null default false, updated_at bigint not null default 0,
  primary key (user_id, split_id, idx),
  foreign key (user_id, split_id) references public.splits (user_id, id) on delete cascade
);

-- `who` lists split_people.idx sharing the item; empty means everyone.
create table if not exists public.split_items (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  split_id text not null, idx integer not null,
  name text not null, price numeric(18, 2) not null, who integer[] not null default '{}', updated_at bigint not null default 0,
  primary key (user_id, split_id, idx),
  foreign key (user_id, split_id) references public.splits (user_id, id) on delete cascade
);

-- 1 unit of `code` equals `rate` units of the user's main currency.
create table if not exists public.rates (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  code text not null, rate numeric(20, 8) not null default 0,
  updated_at bigint not null default 0, deleted boolean not null default false,
  primary key (user_id, id)
);

-- Read by the app; written only by the ai Edge Function through ai_take().
create table if not exists public.ai_usage (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null, count integer not null default 0,
  primary key (user_id, day)
);

create table if not exists public.ai_summaries (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  text text not null, generated_at timestamptz not null default now(),
  primary key (user_id, month)
);

-- Pull cursors and the screens' filters.
create index if not exists books_sync on public.books (user_id, updated_at);
create index if not exists accounts_sync on public.accounts (user_id, updated_at);
create index if not exists categories_sync on public.categories (user_id, updated_at);
create index if not exists members_sync on public.members (user_id, updated_at);
create index if not exists goals_sync on public.goals (user_id, updated_at);
create index if not exists recurring_sync on public.recurring (user_id, updated_at);
create index if not exists bills_sync on public.bills (user_id, updated_at);
create index if not exists bills_time on public.bills (user_id, time);
create index if not exists bills_book_time on public.bills (user_id, book_id, time);
create index if not exists bills_category on public.bills (user_id, category_id);
create index if not exists bill_tags_sync on public.bill_tags (user_id, updated_at);
create index if not exists budgets_sync on public.budgets (user_id, updated_at);
create index if not exists holdings_sync on public.holdings (user_id, updated_at);
create index if not exists debts_sync on public.debts (user_id, updated_at);
create index if not exists debt_payments_sync on public.debt_payments (user_id, updated_at);
create index if not exists rules_sync on public.rules (user_id, updated_at);
create index if not exists splits_sync on public.splits (user_id, updated_at);
create index if not exists split_people_sync on public.split_people (user_id, updated_at);
create index if not exists split_items_sync on public.split_items (user_id, updated_at);
create index if not exists rates_sync on public.rates (user_id, updated_at);

-- Row Level Security: each user sees and writes only their own rows.
do $$
declare t text;
begin
  foreach t in array array['user_settings', 'books', 'accounts', 'categories', 'members', 'goals', 'recurring', 'bills', 'bill_tags',
    'budgets', 'holdings', 'debts', 'debt_payments', 'rules', 'splits', 'split_people', 'split_items', 'rates', 'ai_summaries'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format('create policy own_rows on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

alter table public.ai_usage enable row level security;
drop policy if exists own_rows on public.ai_usage;
create policy own_rows on public.ai_usage for select to authenticated using (user_id = auth.uid());
grant select on public.ai_usage to authenticated;
