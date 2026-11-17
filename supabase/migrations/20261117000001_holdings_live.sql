-- Live portfolio prices: holdings gain a market code and two more types.
--   symbol: IDX code (BBCA), foreign ticker (AAPL), crypto code (BTC), or XAU for gold that follows the world price.
--   saham_luar = stocks listed outside Indonesia, kripto = crypto.
alter table public.holdings add column if not exists symbol text;

alter table public.holdings drop constraint if exists holdings_type_check;
alter table public.holdings add constraint holdings_type_check
  check (type in ('saham', 'saham_luar', 'kripto', 'reksadana', 'emas'));

-- Crypto is held in fractions down to 1 satoshi (0.00000001).
alter table public.holdings alter column units type numeric(24, 8);
