# Flutter Mobile Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Capacitor-wrapped React app on Android and iOS with a native Flutter app that reads and writes the same Supabase data, without Swift or Kotlin app code.

**Architecture:** A new Flutter project in `mobile/` sits next to the React web app, which stays the web/PWA client. The Flutter app ports the local-first model one to one: a records map with `updatedAt` and `deleted` per record, a dirty set, newest-write-wins merge, and the same PostgREST push/pull against the existing tables (`supabase/migrations/`). Nothing changes on the server. The Capacitor `android/` and `ios/` folders are removed only at cutover (Phase 5).

**Tech Stack:** Flutter (stable, Dart ≥ 3.8), `http`, `path_provider`, `flutter_secure_storage`, `connectivity_plus`, `intl`, `uuid`. Built-in `ChangeNotifier` for state, with no state library, which matches the "no state library" rule in `memory-bank/standards/tech-stack.md`. Plain REST, no `supabase_flutter` SDK, which matches the "no ORM / plain fetch" rule in `memory-bank/standards/data-stack.md`.

**Spec:** There is no separate spec. The behaviour to match is the current app: `src/store.js`, `src/sync.js`, `src/logic.js`, and the screens in `src/*.jsx`, plus `memory-bank/standards/*.md` and `MOBILE.md`. The existing Vitest suites (`tests/*.test.js`) define the required behaviour. Where a Dart test below cites a JS test, it must assert the same values.

## Phases

The migration covers several independent subsystems, so it is split into five plans. **This document fully details Phase 1 only.** Each later phase gets its own plan file, written when the phase before it is merged.

| Phase | Delivers (each is shippable/testable on its own) | Plan |
| --- | --- | --- |
| 1. Foundation | `mobile/` project; record store; Supabase auth + two-way sync; sign-in screen; read-only ledger list; CI | this file |
| 2. Design system | Colour/spacing tokens from `src/styles.css`, bundled Geist fonts, in-house icon renderer generated from `src/icons.js` data, brand logos (`src/brands/*.svg` via `flutter_svg`), `Sheet`, `Segmented`, `PeriodNav`, dark mode + accent, motion that respects reduce-motion | `…-flutter-phase2-design-system.md` |
| 3. Core money | Port of `src/logic.js` with parity tests from `tests/money.test.js` / `tests/fixes.test.js`; Ledger + BillEditor; Analysis; Wallet/Settings; recurring runner after first sync; bottom nav (Ledger, Laporan, record button, Dompet, Lainnya) | `…-flutter-phase3-core.md` |
| 4. Tools | Budgets, Goals, Debts, Recurring, Rules, Portfolio + quotes, Split, KPR, PPh 21, Import (CSV/XLSX), Backup/Restore (share sheet + file picker, same JSON v3 format), receipt photos stored as local files, AI chat + ChatBubble through the `ai` Edge Function | `…-flutter-phase4-tools.md` |
| 5. Cutover | Release workflow builds the Flutter APK with the **same applicationId `com.kasku.plus` and the same keystore**, so it installs as an update over the Capacitor APK; iOS bundle id stays `com.kasku.plus`; remove `android/`, `ios/`, `capacitor.config.json`, `@capacitor/*` deps and `src/native.js`; rewrite `MOBILE.md` | `…-flutter-phase5-cutover.md` |

**Cutover risk (Phase 5):** The Capacitor app keeps unsynced edits in WebView `localStorage`, and the Flutter app cannot read it. Synced data is safe because the Flutter app pulls everything after sign-in. Before Phase 5 ships, the last Capacitor release notes must tell users to open the app online once, so pending changes reach the server, before updating.

## Global Constraints

- Flutter project lives in `mobile/`; package name `kasku_plus`; Android `applicationId` and iOS `PRODUCT_BUNDLE_IDENTIFIER` are both `com.kasku.plus`.
- No Swift, Objective-C, Kotlin or Java app code. Generated platform runners from `flutter create` stay as generated.
- No emoji anywhere in the interface. All icons are in-house (24px grid, 1.5px stroke, round caps). No icon library, which rules out Material `Icons.*` for record and nav icons.
- Supabase config comes from `--dart-define-from-file=env/dev.json` (dev DB) or `env/prod.json` (prod DB), with keys `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Both files are gitignored. `env/example.json` is committed.
- Wire format is unchanged: table/column names, `updated_at` in epoch ms, `server_ts` pull cursor, `(user_id, id)` keys, `deleted` flag. The web app and the Flutter app must be able to sync the same account at the same time.
- UI languages: Indonesian (`id`, default) and English (`en`). Both must always have the same keys. Strings are copied verbatim from `src/i18n.js`.
- Supported currencies and default records (ids, names, colours, order) are exactly those in `src/store.js` (`defaultRecords`, `CURRENCIES`, `ACCENTS`).
- Every change is committed, pushed, and opened or updated as a PR against `main` (project workflow).

## Review Focus

1. **Opening offline with an expired token.** The app must show cached records immediately. A failed token refresh while offline must not sign the user out or clear data. Only HTTP 400/401 from the refresh endpoint signs out. Covered in Tasks 4 and 6.
2. **Edit made while a push is in flight.** The record must stay in the dirty set (`updatedAt` compared at clear time). Covered in Tasks 2 and 5.
3. **Device clock behind the server.** Pull uses `server_ts` with a 60 s overlap, never `updated_at`, so rows written by a slow-clock device are still pulled. Covered in Task 5.
4. **Signing in to a different account on the same phone.** The local copy is reset before the first pull (`adoptOwner`), so account A's records never get pushed into account B. Covered in Task 5.
5. **Corrupted or unwritable local file.** An unreadable `records.json` is kept aside, never overwritten. A failed write leaves memory and disk identical, and the user gets a "storage full" notice. Covered in Task 2.

---

### Task 1: Flutter project scaffold, config, and CI

**Files:**
- Create: `mobile/` via `flutter create --org com.kasku --project-name kasku_plus --platforms android,ios mobile`, then set Android `applicationId "com.kasku.plus"` in `mobile/android/app/build.gradle(.kts)` and iOS `PRODUCT_BUNDLE_IDENTIFIER = com.kasku.plus` in `mobile/ios/Runner.xcodeproj/project.pbxproj`; display name `Kasku+` on both
- Create: `mobile/lib/env.dart`
- Create: `mobile/env/example.json`, and add `mobile/env/*.json` plus `!mobile/env/example.json` to `.gitignore`
- Create: `.github/workflows/flutter.yml`
- Test: `mobile/test/env_test.dart`

**Interfaces:**
- Produces: `class Env { static const String supabaseUrl; static const String supabaseKey; static String get baseUrl; static bool get configured; static String baseUrlOf(String raw); static bool isConfigured(String url, String key); }`

- [ ] **Step 1:** Run `flutter create` as above. Delete the counter demo from `lib/main.dart` and `test/widget_test.dart`, then add deps: `flutter pub add http path_provider flutter_secure_storage connectivity_plus intl uuid`. Set `environment: sdk: ^3.8.0` in `pubspec.yaml`.
- [ ] **Step 2: Write the failing test** `mobile/test/env_test.dart`: `Env.baseUrlOf('https://x.supabase.co//') == 'https://x.supabase.co'`; `Env.isConfigured('', 'k') == false`; `Env.isConfigured('u', 'k') == true`.
- [ ] **Step 3:** Run `cd mobile && flutter test test/env_test.dart`. Expected: FAIL (no `Env`).
- [ ] **Step 4:** Implement `lib/env.dart` with `String.fromEnvironment('SUPABASE_URL')` / `('SUPABASE_ANON_KEY')`. The getters delegate to the pure helpers.
- [ ] **Step 5:** Run `flutter test` and `flutter analyze`. Expected: all pass, `No issues found!`.
- [ ] **Step 6:** Write `.github/workflows/flutter.yml`, triggered on `pull_request` and `push` to `main` with `paths: ['mobile/**', '.github/workflows/flutter.yml']`. All jobs use `defaults.run.working-directory: mobile`.
  - Job `test` (ubuntu): `subosito/flutter-action@v2` with `channel: stable` and `cache: true`, then `flutter pub get`, `flutter analyze`, `flutter test`.
  - Job `android` (ubuntu, needs test): Java 21 temurin, `flutter build apk --debug --dart-define=SUPABASE_URL=${{ secrets.VITE_SUPABASE_URL }} --dart-define=SUPABASE_ANON_KEY=${{ secrets.VITE_SUPABASE_ANON_KEY }}`, upload `mobile/build/app/outputs/flutter-apk/app-debug.apk` as `kasku-flutter-debug-apk`.
  - Job `ios` (macos-15, needs test): `flutter build ios --simulator --debug --no-codesign` with the same defines.
- [ ] **Step 7: Commit, push, PR**: `git add mobile .github/workflows/flutter.yml .gitignore && git commit -m "mobile: Flutter project scaffold and CI"`.

### Task 2: Local record store

**Files:**
- Create: `mobile/lib/data/disk.dart`, which holds `Disk`, `FileDisk` and `MemoryDisk` (the test double)
- Create: `mobile/lib/data/defaults.dart`, a port of `defaultRecords()`, `ACCENTS`, `CURRENCIES` and the default settings from `src/store.js`
- Create: `mobile/lib/data/store.dart`
- Test: `mobile/test/data/store_test.dart`

**Interfaces:**
- Produces:
  - `typedef Rec = Map<String, Object?>;` A record carries `id`, `kind`, `updatedAt` (a `num`, because merge may add 0.001), optional `deleted`, and kind-specific fields named exactly as in `src/store.js` / `KINDS` in `src/sync.js`.
  - `abstract class Disk { String? read(String key); void writeAll(Map<String, String> entries); void keepAside(String key, String raw); }` `writeAll` is synchronous and all-or-nothing: `FileDisk` writes each `<key>.json.tmp`, then renames. It throws on failure. `MemoryDisk` has `bool full` to simulate failure and `Map<String, String> entries` for inspection.
  - `class RecordStore extends ChangeNotifier`, with `RecordStore(Disk disk)`, `Map<String, Rec> get records`, `Map<String, Object?> get settings`, `Rec? put(Rec rec, {num? at})`, `Rec? remove(String id)`, `bool putMany(List<Rec> recs, {bool keepTime = false})`, `bool merge(List<Rec> incoming, {bool markDirty = false})`, `bool setSettings(Map<String, Object?> patch)`, `List<String> get dirtyIds`, `void clearDirtyIfUnchanged(Map<String, num> sentAt)` (clears an id only when its current `updatedAt` equals the sent one), `void resetAll()`, `Stream<void> get localChanges` (fires on put/putMany only), `Stream<Object> get errors`, `final List<String> loadErrors`.
  - Free functions in `store.dart`: `List<Rec> live(Map<String, Rec> records, String kind)` (non-deleted, sorted by `order`), `String nameOf(Rec? r, String lang)`, `Map<String, double> accountBalances(Map<String, Rec> records, String baseCurrency)`, `String newId()` (UUID v4).
- Disk keys: `records`, `settings`, `dirty`. An unreadable value is kept as `<key>.unreadable-<epochMs>`.

- [ ] **Step 1: Write the failing tests** in `store_test.dart`, one `test()` each:
  - `fresh store has the default records`: `records['cat-food']!['names']` equals `{'id': 'Makan', 'en': 'Food'}`, and there are 29 default records.
  - `put stamps updatedAt and marks dirty`: after `put({'id':'x','kind':'bill','amount':1})`, `dirtyIds` contains `'x'` and `updatedAt > 0`.
  - `merge keeps the newest updatedAt`: local `updatedAt: 10`; merging the same id at `5` leaves it; merging at `20` replaces it and, with `markDirty: false`, removes the id from `dirtyIds`.
  - `BUG-009 corrupted records file is kept aside`: `MemoryDisk` holds `records` = `'{"bill-1":{"id":"bill-1","kind":"bill","amount":5'`. After opening and one `put`, some key starting with `records.unreadable-` contains `bill-1`, and `loadErrors` equals `['records']`.
  - `BUG-008 full disk refuses the save`: with `disk.full = true`, `put` returns `null`, `records.containsKey('y')` is false, and `errors` emits once.
  - `edit in flight stays dirty` (Review Focus 2): `put` x, capture `updatedAt` as `sent`, `put` x again, `clearDirtyIfUnchanged({'x': sent})`. Assert `dirtyIds` contains `'x'`.
  - `transfer IDR -> USD converts at the saved rate` and `BUG-007 no rate, no 1:1 credit`: same fixtures and expected balances as the two tests of those names in `tests/money.test.js` (lines 45–60).
- [ ] **Step 2:** Run `flutter test test/data/store_test.dart`. Expected: FAIL (missing types).
- [ ] **Step 3:** Implement `disk.dart`, `defaults.dart` and `store.dart`, following `src/store.js` method by method: commit-then-emit, write failure restores the old copy, built-in icons restored on load.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit, push**: `git commit -m "mobile: local-first record store"`.

### Task 3: Record ⇄ table row mapping

**Files:**
- Create: `mobile/lib/sync/kinds.dart`
- Test: `mobile/test/sync/kinds_test.dart`

**Interfaces:**
- Consumes: `Rec` (Task 2).
- Produces: `enum Conv { num, time }`; `class ColSpec { final String field, column; final Conv? conv; final Object? def; }`; `class ChildSpec { final String table, fk; final List<Map<String, Object?>> Function(Rec) rows; final void Function(Rec, List<Map<String, Object?>>) fold; }`; `class KindSpec { final String table; final List<ColSpec> cols; final List<ChildSpec> children; }`; `final Map<String, KindSpec> kinds`; `const List<String> kindOrder = ['book','account','category','member','rate','goal','recurring','rule','budget','holding','debt','split','bill']`; `Map<String, Object?> toRow(Rec rec, KindSpec spec, String userId)`; `Rec fromRow(Map<String, Object?> row, KindSpec spec, String kind)`; `bool sameContent(Rec a, Rec b)`.
- Every column list, default and child fold is copied from `KINDS` in `src/sync.js`. Time columns are ISO-8601 UTC strings on the wire and epoch ms in records.

- [ ] **Step 1: Write the failing tests**:
  - `round trip keeps every saved field`: use the exact `samples` object from `tests/data.test.js` › `sync row mapping` (bill, account, recurring, budget, holding). JSON-encode and decode the row before calling `fromRow`. Every non-null, non-empty field must come back equal.
  - `children round trip`: a debt with two payments, and a split with two people, two items and `paid: [true, false]`, survive `rows` → `fold`.
  - `sameContent treats null, '', false and [] as equal`.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement `kinds.dart`.
- [ ] **Step 4:** Run it. Expected: PASS.
- [ ] **Step 5: Commit, push**: `git commit -m "mobile: sync row mapping"`.

### Task 4: Supabase REST client and session

**Files:**
- Create: `mobile/lib/sync/api.dart`
- Create: `mobile/lib/sync/session.dart`
- Test: `mobile/test/sync/session_test.dart`

**Interfaces:**
- Consumes: `Env.baseUrl` / `Env.supabaseKey` (Task 1).
- Produces:
  - `class ApiException implements Exception { final int status; final String? code; final String message; }`
  - `class Api { Api(http.Client client, {required String baseUrl, required String anonKey, required String? Function() token}); Future<Object?> call(String path, {String method = 'GET', Object? body, bool auth = true, Map<String, String> headers = const {}}); }` It sends `apikey`, JSON content type and `Authorization: Bearer <token>` when `auth`. The error message is taken from `msg`, then `error_description`, `message`, `error`, else `HTTP <status>`. The code comes from `error_code`, else `code`.
  - `class Session { String accessToken, refreshToken; int expiresAt; String userId; String? email; }` with `toJson` / `fromJson`.
  - `abstract class SessionStore { Future<Session?> load(); Future<void> save(Session? s); }`, with `SecureSessionStore` (backed by `flutter_secure_storage`, key `kasku.session`) and `MemorySessionStore` for tests.
  - `class Auth { Auth(Api api, SessionStore store); Session? get session; Future<Session> signIn(String email, String password); Future<Session?> signUp(String email, String password) /* null = confirmation e-mail sent */; Future<void> recover(String email); Future<void> signOut(); Future<bool> ensureFresh(); }` `ensureFresh` refreshes when `now >= expiresAt - 60000`. On refresh HTTP 400/401 it clears the session and returns false. Any other failure (offline, 5xx) rethrows and keeps the session.
- Endpoints, exactly as `src/sync.js`: `/auth/v1/token?grant_type=password`, `/auth/v1/signup`, `/auth/v1/recover`, `/auth/v1/logout`, `/auth/v1/token?grant_type=refresh_token`.

- [ ] **Step 1: Write the failing tests** with `package:http/testing.dart` `MockClient`:
  - `signIn stores the session`: the mock returns `{"access_token":"a","refresh_token":"r","expires_in":3600,"user":{"id":"u1","email":"e"}}`, and `MemorySessionStore` then holds `userId == 'u1'`.
  - `signUp without access_token means confirm`: returns null.
  - `error message comes from msg`: a 400 `{"msg":"Invalid login credentials","error_code":"invalid_credentials"}` throws an `ApiException` with `status == 400` and `code == 'invalid_credentials'`.
  - `offline refresh keeps the session` (Review Focus 1): with an expired session and a mock that throws `SocketException`, `ensureFresh()` throws and the session is still saved.
  - `refresh 400 signs out`: `ensureFresh()` returns false and the session is null.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement `api.dart` and `session.dart`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit, push**: `git commit -m "mobile: Supabase auth over REST"`.

### Task 5: Sync engine

**Files:**
- Create: `mobile/lib/sync/sync.dart`
- Create: `mobile/test/sync/fake_postgrest.dart`, an in-memory PostgREST behind `MockClient`. It supports the query forms `sync.dart` sends (`select=*`, `order=server_ts.asc`, `limit`, `server_ts=gt.`, `id=in.()`, `<fk>=in.()`, `on_conflict=user_id,id`, DELETE), applies the `kasku_lww` rule (keeps the row with the higher `updated_at` and leaves it out of the reply), and sets `server_ts` from its own clock.
- Test: `mobile/test/sync/sync_test.dart`

**Interfaces:**
- Consumes: `RecordStore`, `Disk` (Task 2); `kinds`, `kindOrder`, `toRow`, `fromRow`, `sameContent` (Task 3); `Api`, `Auth` (Task 4).
- Produces: `enum SyncPhase { off, idle, syncing, offline, error }`; `class SyncStatus { final SyncPhase phase; final String error; final int pending; final DateTime? lastSync; }`; `class SyncEngine extends ChangeNotifier { SyncEngine(RecordStore store, Api api, Auth auth, Disk disk); SyncStatus get status; Future<void> syncNow(); Future<void> afterSignIn(Session s); Future<void> signOut(); Future<void> resetLocal(); void start(); void afterFirstSync(void Function() fn); }`. Sync state (`owner`, per-table `cursors`, `lastSync`, `settingsAt`, `settingsDirty`) persists through `Disk` key `sync`.
- Behaviour is copied from `src/sync.js`, with these constants: page 1000; overlap 60 000 ms; push chunks of 200 rows; child replace in chunks of 100 (DELETE `<fk>=in.(…)` then POST); retry backoff starting at 2 000 ms, doubling, max 60 000 ms; local-change debounce 1 200 ms; periodic sync every 30 s while the app is resumed.
- Triggers: `store.localChanges`, `AppLifecycleListener.onResume`, and `connectivity_plus` reporting online. Concurrent `syncNow` calls coalesce into one follow-up run.
- Settings row: `lang`, `currency`, `theme`→`accent`, `dark`, `bookId`→`book_id`, upserted to `user_settings?on_conflict=user_id`. `tz` is the device IANA zone when available, else `'Asia/Jakarta'`.
- `afterSignIn` resets the store when `owner != userId`, then calls `rpc/seed_user` (errors ignored), then `syncNow`.

- [ ] **Step 1: Write the failing tests** against `fake_postgrest.dart`:
  - `push then pull round trip`: put a bill and sync. A second store on a second engine for the same user pulls it with equal fields.
  - `server keeps a newer row`: the fake holds bill b at `updated_at` 200, while the local store has b at 100 and dirty. After sync, the local b equals the server copy and is not dirty.
  - `slow clock still pulled` (Review Focus 3): device B writes with `updatedAt` one hour in the past. Device A, having already pulled once, gets it on its next sync.
  - `edit during push stays dirty` (Review Focus 2): the fake delays the bills upsert, and the test calls `store.put` on the same id before it resolves. After sync the id is in `dirtyIds`.
  - `child-only change is accepted`: a server debt gains a payment with the same parent `updated_at`. After pull, the local debt has 2 payments.
  - `switching accounts resets local data` (Review Focus 4): sign in as u1 and create bill x, then `afterSignIn` as u2. `records['x']` is absent, and the fake holds no x under u2.
  - `401 during sync signs out without wiping records`: `status.phase == SyncPhase.off` and records are still present.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement `sync.dart`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit, push**: `git commit -m "mobile: two-way Supabase sync"`.

### Task 6: Sign-in screen and read-only ledger

**Files:**
- Create: `mobile/lib/i18n.dart`, holding `id`/`en` maps for the strings these screens show, copied verbatim with the same key names from `src/i18n.js` (`appName`, `email`, `password`, `signIn`, `signUp`, `offline`, `syncing`, `synced`, and the ledger/empty-state keys `Ledger.jsx` uses)
- Create: `mobile/lib/app.dart` (root: `AuthScreen` when `auth.session == null`, else `LedgerScreen`), `mobile/lib/screens/auth_screen.dart`, `mobile/lib/screens/ledger_screen.dart`, `mobile/lib/widgets/sync_badge.dart`
- Modify: `mobile/lib/main.dart`, which opens `FileDisk` under `getApplicationSupportDirectory()`, builds the store, auth and engine, calls `engine.start()`, and runs the app
- Test: `mobile/test/i18n_test.dart`, `mobile/test/screens/ledger_screen_test.dart`

**Interfaces:**
- Consumes: everything from Tasks 2 to 5.
- Produces: `const Map<String, Map<String, String>> dict` and `String tr(String lang, String key)`. In debug, `tr` asserts that the key exists.
- Ledger list in this phase: live bills of `settings['bookId']`, newest `time` first, grouped by local day. Each row shows category name (`nameOf`), note, and amount via `NumberFormat.currency(locale: lang == 'id' ? 'id_ID' : 'en_US', name: <account currency>)` with 0 to 2 decimals, matching `formatMoney` in `src/store.js`. Icons are a plain coloured circle until Phase 2.

- [ ] **Step 1: Write the failing tests**:
  - `id and en have the same keys`.
  - `ledger shows bills of the current book newest first`: pump `LedgerScreen` with two bills on different days in `book-default` plus one in another book. Two rows appear, the newer first, and the other book's bill is absent.
  - `ledger opens with cached data while offline` (Review Focus 1): the engine's `Api` mock throws `SocketException`. The rows still render and the badge shows `tr(lang, 'offline')`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement the files above.
- [ ] **Step 4:** Run `flutter test` and `flutter analyze`. Expected: all pass.
- [ ] **Step 5: Manual check on an emulator**: run `flutter run --dart-define-from-file=env/dev.json` and sign in with the dev-DB test account. Bills recorded in the web app (`npm run dev`) must appear on the phone within 30 s. Attach a screenshot to the PR.
- [ ] **Step 6: Commit, push, update PR**: `git commit -m "mobile: sign-in and read-only ledger"`.

---

Phase 1 is done when CI (`flutter.yml`) is green on Android and iOS and the manual check in Task 6 passes. Then write the Phase 2 plan.
