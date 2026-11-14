# Mechanics taken from the original (Money+ 6.9.0, package com.zotiger.accountbook)

## What could be decompiled

The APK is a Flutter app. Its business logic is compiled Dart (`lib/<abi>/libapp.so`), and that
library is **not in this base APK**. It ships in a split APK that wasn't provided
(evidence ev_3108b2d8…: "No Flutter libraries"). The `native_*` tools refuse the file ("An Android
app is not native machine code"), so there are no native function addresses. The app's own Java
code in `classes.dex` is just three classes, all read in full:

| Class | Methods | What it is |
|---|---|---|
| `com.zotiger.accountbook.MainActivity` | `<init>`, `g(z4.c)` | Flutter host activity; just registers plugins |
| `com.zotiger.accountbook.TodayWidgetProvider` | `a`, `b`, `c`, `onReceive`, `onUpdate` | small "today" home-screen widget |
| `com.zotiger.accountbook.TodayWidgetMediumProvider` | `a`, `b`, `c`, `d`, `onReceive`, `onUpdate` | medium "weekly pulse" widget |

Addresses below are Dalvik method references plus bytecode offsets (evidence ids in brackets).

## Rules and values

### 1. Money formatting — `TodayWidgetProvider->a(String currency, double v)` [ev_25007755…]
- `NumberFormat.getCurrencyInstance()` with the bill currency,
  `setMinimumFractionDigits(0)` (0x000d), `setMaximumFractionDigits(2)` (0x0010).
- If that throws, it uses US locale with the same digits. If that fails too: `"$0"` for 0, else `"$%.2f"`.
- **Applied:** `formatMoney()` in `src/store.js` uses min 0 / max 2 digits for every currency
  (it used to force 2 or 0 depending on the currency).

### 2. Weekly totals use whole numbers — `TodayWidgetMediumProvider->c(String)` [ev_f32a5966…]
- `todayExpendStr` and `weekTotalStr` are formatted with `setMaximumFractionDigits(0)` (0x00a5, 0x00bf).
- `weekTotalStr` = sum of the 7 `weeklyPulse` values (loop 0x0087–0x0091).
- When `weeklyPulse` is missing it's 7 zeros (0x0030–0x0040).
- `todayExpend` drops to 0 when the snapshot `time` isn't today (same year, month, day; 0x0049–0x0080).
- **Applied:** `formatMoney(v, …, {whole: true})` and `weeklyPulse()` in `src/Ledger.jsx`.

### 3. Today / month reset — `TodayWidgetProvider->c(Context, String)` [ev_1876e253…]
- Reads `todayExpend`, `todayIncome`, `monthExpend`, `monthIncome`, `currencyCode` (default `"USD"`),
  `time` and `theme` (default `0xFFF06292`, offset 0x0037).
- Different year or month → all four values become 0 (0x007e). Same month but a different day → only the
  two "today" values become 0 (0x0079).
- **Applied:** the website always computes today's and this month's totals from the bills, relative to
  the current date, so the numbers reset the same way. The default theme stays `#F06292`.

### 4. Week start — `TodayWidgetMediumProvider->d(long)` [ev_a4e7ce63…]
- With no stored start: today, stepped back one day at a time until `DAY_OF_WEEK == getFirstDayOfWeek()`
  (0x0015–0x0025), then time set to 00:00:00.000 (0x0028–0x003a).
- The first day comes from the **locale** (Sunday for id-ID and en-US).
- **Applied:** `firstDayOfWeek()` in `src/store.js`. `periodRange('week')` (`src/ui.jsx`), the analysis
  week and the calendar's column order all use it. Before this the week started on Monday.

### 5. Weekly pulse chart — `TodayWidgetMediumProvider->a(JSONArray, long)` [ev_0d6a71d2…]
- Canvas 400 × 200 (0x0004/0x0006). Labels are 16 px bold, white, centred (0x001f–0x002f).
- Scale: `max = max(1.0, values)` (0x0043–0x0053).
- Plot area: bottom = 200 − 30 (0x00aa), usable height = bottom − 16.
- Bar width = (400 − 2·16 − 6·12) / 7, gap 12 (0x00b0–0x00c5). Bar height = max(6, usable · v / max) (0x00f6).
- Rounded rect with radius 6 (0x00f4, 0x011e).
- Bar colour: white. Alpha 255 for today, 0xCC for other days with spending, 0x26 for days with none (0x0103–0x0112).
- Day label: `SimpleDateFormat("EEEEE")` (narrow weekday) at y = 200 − 8, alpha 255 for today, 0x80 otherwise (0x012a–0x0152).
- The highlighted index = whole days between the week start and today (0x009c–0x00a2).
- **Applied:** `WeeklyPulse` in `src/Ledger.jsx` draws an SVG with exactly these numbers, on a card in the theme colour.

### 6. Data model — bundled `assets/flutter_assets/assets/app.db`
- Tables used: `account_book`, `account` (account_type, currency_code, balance, bill_day, refund_day…),
  `category` (type, icon, index, group_id), `member`, `bill` (bill_type, account_id, member_id,
  account_book_id, category_id, createtime, money, note, transfer_to_id), and `budget` (periodType default 2 = monthly).
- The website's records mirror these, adding `updatedAt`/`deleted` so devices can sync.
- Default categories, members and account types come from `assets/i18n/*.json` (`basedata.*`, `accounts.*`).

## Not recoverable from this file
Screen layouts, the keypad, the analysis maths, budget carry-over (`budget.allow_carry_over`,
`carry_over_strategy`) and smart prediction all live in the missing `libapp.so`. Those parts of the
website are estimates built from the strings and the database tables.
