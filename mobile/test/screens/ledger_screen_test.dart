import 'dart:io';

import 'package:flutter/widgets.dart' show Key;
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:kasku_plus/app.dart';
import 'package:kasku_plus/data/disk.dart';
import 'package:kasku_plus/data/store.dart';
import 'package:kasku_plus/sync/api.dart';
import 'package:kasku_plus/sync/session.dart';
import 'package:kasku_plus/sync/sync.dart';

int at(int y, int m, int d, [int h = 12]) => DateTime(y, m, d, h).millisecondsSinceEpoch;

({RecordStore store, Auth auth, SyncEngine engine}) offlineApp({bool signedIn = true}) {
  final disk = MemoryDisk();
  final store = RecordStore(disk);
  late Auth auth;
  final api = Api(MockClient((r) async => throw const SocketException('offline')), baseUrl: 'https://x.supabase.co', anonKey: 'anon', token: () => auth.session?.accessToken);
  auth = Auth(api, MemorySessionStore(signedIn ? Session(accessToken: 'a', refreshToken: 'r', expiresAt: at(2100, 1, 1), userId: 'u1') : null));
  return (store: store, auth: auth, engine: SyncEngine(store, api, auth, disk));
}

void main() {
  setUpAll(() => initializeDateFormatting());

  testWidgets('ledger shows bills of the current book newest first', (tester) async {
    final app = offlineApp();
    await tester.runAsync(app.auth.load);
    app.store.put({'id': 'old', 'kind': 'bill', 'type': 'expense', 'amount': 15000, 'time': at(2026, 11, 17), 'bookId': 'book-default', 'accountId': 'acc-cash', 'categoryId': 'cat-food', 'note': 'nasi uduk'});
    app.store.put({'id': 'new', 'kind': 'bill', 'type': 'income', 'amount': 5000000, 'time': at(2026, 11, 18), 'bookId': 'book-default', 'accountId': 'acc-cash', 'categoryId': 'cat-wage', 'note': 'gaji'});
    app.store.put({'id': 'other', 'kind': 'bill', 'type': 'expense', 'amount': 1, 'time': at(2026, 11, 18), 'bookId': 'book-2', 'accountId': 'acc-cash', 'categoryId': 'cat-food', 'note': 'buku lain'});
    await tester.pumpWidget(KaskuApp(store: app.store, auth: app.auth, engine: app.engine));

    expect(find.text('gaji'), findsOneWidget);
    expect(find.text('nasi uduk'), findsOneWidget);
    expect(find.text('buku lain'), findsNothing);
    expect(tester.getTopLeft(find.text('gaji')).dy, lessThan(tester.getTopLeft(find.text('nasi uduk')).dy));
    expect(find.text('Gaji'), findsOneWidget);
    expect(find.textContaining('5.000.000'), findsOneWidget);
    app.engine.dispose();
  });

  testWidgets('empty book shows the empty state', (tester) async {
    final app = offlineApp();
    await tester.runAsync(app.auth.load);
    await tester.pumpWidget(KaskuApp(store: app.store, auth: app.auth, engine: app.engine));
    expect(find.text('Belum ada transaksi di periode ini.'), findsOneWidget);
    app.engine.dispose();
  });

  testWidgets('ledger opens with cached data while offline', (tester) async {
    final app = offlineApp();
    await tester.runAsync(app.auth.load);
    app.store.put({'id': 'b', 'kind': 'bill', 'type': 'expense', 'amount': 25000, 'time': at(2026, 11, 18), 'bookId': 'book-default', 'accountId': 'acc-cash', 'categoryId': 'cat-food', 'note': 'kopi'});
    await tester.pumpWidget(KaskuApp(store: app.store, auth: app.auth, engine: app.engine));
    await tester.runAsync(app.engine.syncNow);
    await tester.pump();
    expect(find.text('kopi'), findsOneWidget);
    expect(find.text('Offline · 1 belum terkirim'), findsOneWidget);
    app.engine.dispose();
  });

  testWidgets('signed out shows the sign-in screen', (tester) async {
    final app = offlineApp(signedIn: false);
    await tester.pumpWidget(KaskuApp(store: app.store, auth: app.auth, engine: app.engine));
    expect(find.text('Masuk ke Kasku+'), findsOneWidget);
    expect(find.text('Kata sandi'), findsOneWidget);
    app.engine.dispose();
  });

  testWidgets('sign-in with a full disk says so and stays signed out', (tester) async {
    final disk = MemoryDisk();
    final store = RecordStore(disk);
    late Auth auth;
    final api = Api(MockClient((r) async => http.Response('{"access_token":"u1","refresh_token":"r","expires_in":3600,"user":{"id":"u1"}}', 200)),
        baseUrl: 'https://x.supabase.co', anonKey: 'anon', token: () => auth.session?.accessToken);
    auth = Auth(api, MemorySessionStore());
    final engine = SyncEngine(store, api, auth, disk);
    await tester.pumpWidget(KaskuApp(store: store, auth: auth, engine: engine));
    disk.full = true;
    await tester.enterText(find.byKey(const Key('email')), 'a@b.c');
    await tester.enterText(find.byKey(const Key('password')), 'long enough');
    await tester.runAsync(() async {
      await tester.tap(find.byKey(const Key('submit')));
      await Future<void>.delayed(const Duration(milliseconds: 50));
    });
    await tester.pump();
    expect(auth.session, isNull);
    expect(find.textContaining('Penyimpanan perangkat penuh'), findsOneWidget);
    engine.dispose();
  });

  testWidgets('a TLS failure at sign-in reads as offline', (tester) async {
    final store = RecordStore(MemoryDisk());
    final api = Api(MockClient((r) async => throw const HandshakeException('CERTIFICATE_VERIFY_FAILED')), baseUrl: 'https://x.supabase.co', anonKey: 'anon', token: () => null);
    final auth = Auth(api, MemorySessionStore());
    final engine = SyncEngine(store, api, auth, MemoryDisk());
    await tester.pumpWidget(KaskuApp(store: store, auth: auth, engine: engine));
    await tester.enterText(find.byKey(const Key('email')), 'a@b.c');
    await tester.enterText(find.byKey(const Key('password')), 'long enough');
    await tester.runAsync(() async {
      await tester.tap(find.byKey(const Key('submit')));
      await Future<void>.delayed(const Duration(milliseconds: 50));
    });
    await tester.pump();
    expect(find.text('Butuh koneksi internet untuk masuk pertama kali.'), findsOneWidget);
    engine.dispose();
  });

  testWidgets('a failed save is reported on any screen, not only the ledger', (tester) async {
    final app = offlineApp(signedIn: false);
    final disk = MemoryDisk();
    final store = RecordStore(disk);
    final engine = SyncEngine(store, app.engine.api, app.auth, disk);
    await tester.pumpWidget(KaskuApp(store: store, auth: app.auth, engine: engine));
    disk.full = true;
    store.put({'id': 'x', 'kind': 'bill', 'amount': 1});
    await tester.pump();
    await tester.pump();
    expect(find.textContaining('Penyimpanan perangkat penuh'), findsOneWidget);
    engine.dispose();
    app.engine.dispose();
  });

  testWidgets('short password is refused before any request', (tester) async {
    final requests = <Object>[];
    final store = RecordStore(MemoryDisk());
    final api = Api(MockClient((r) async {
      requests.add(r);
      throw const SocketException('offline');
    }), baseUrl: 'https://x.supabase.co', anonKey: 'anon', token: () => null);
    final auth = Auth(api, MemorySessionStore());
    final engine = SyncEngine(store, api, auth, MemoryDisk());
    await tester.pumpWidget(KaskuApp(store: store, auth: auth, engine: engine));
    await tester.enterText(find.byKey(const Key('email')), 'a@b.c');
    await tester.enterText(find.byKey(const Key('password')), 'short');
    await tester.tap(find.byKey(const Key('submit')));
    await tester.pump();
    expect(find.text('Kata sandi minimal 8 karakter.'), findsOneWidget);
    expect(requests, isEmpty);
    engine.dispose();
  });
}
