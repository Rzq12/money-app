import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:kasku_plus/data/disk.dart';
import 'package:kasku_plus/data/store.dart';
import 'package:kasku_plus/sync/api.dart';
import 'package:kasku_plus/sync/session.dart';
import 'package:kasku_plus/sync/sync.dart';

import 'fake_postgrest.dart';

class Device {
  Device(FakePostgrest server) : disk = MemoryDisk() {
    store = RecordStore(disk);
    api = Api(server.client, baseUrl: 'https://x.supabase.co', anonKey: 'anon', token: () => auth.session?.accessToken);
    auth = Auth(api, MemorySessionStore());
    engine = SyncEngine(store, api, auth, disk);
  }
  final MemoryDisk disk;
  late final RecordStore store;
  late final Api api;
  late final Auth auth;
  late final SyncEngine engine;

  Future<void> signIn(String user) async => engine.afterSignIn(await auth.signIn(user, 'pw'));
}

int t(int y, int m, int d) => DateTime(y, m, d, 12).millisecondsSinceEpoch;

Rec bill(String id, {num amount = 25000}) => {'id': id, 'kind': 'bill', 'type': 'expense', 'amount': amount, 'time': t(2026, 11, 18), 'bookId': 'book-default', 'accountId': 'acc-cash', 'categoryId': 'cat-food', 'tags': ['a']};

void main() {
  test('push then pull round trip', () async {
    final server = FakePostgrest();
    final a = Device(server);
    await a.signIn('u1');
    a.store.put(bill('b1'));
    await a.engine.syncNow();
    expect(a.store.dirtyIds, isEmpty);
    expect(server.row('bills', 'u1', 'b1')?['amount'], 25000);
    expect(server.rows('bill_tags', 'u1').single['tag'], 'a');

    final b = Device(server);
    await b.signIn('u1');
    final got = b.store.records['b1']!;
    for (final k in ['type', 'amount', 'time', 'bookId', 'accountId', 'categoryId', 'tags', 'updatedAt']) {
      expect([k, got[k]], [k, a.store.records['b1']![k]]);
    }
    expect(b.engine.status.phase, SyncPhase.idle);
  });

  test('server keeps a newer row', () async {
    final server = FakePostgrest();
    final a = Device(server);
    await a.signIn('u1');
    a.store.put(bill('b', amount: 1), at: 100);
    server.seed('bills', 'u1', {'id': 'b', 'type': 'expense', 'amount': 99, 'updated_at': 200, 'deleted': false, 'book_id': 'book-default', 'account_id': 'acc-cash'});
    await a.engine.syncNow();
    expect(a.store.records['b']!['amount'], 99);
    expect(a.store.records['b']!['updatedAt'], 200);
    expect(a.store.dirtyIds, isNot(contains('b')));
    expect(server.row('bills', 'u1', 'b')!['amount'], 99);
  });

  test('slow clock still pulled', () async {
    final server = FakePostgrest();
    final a = Device(server);
    await a.signIn('u1');
    final b = Device(server);
    await b.signIn('u1');
    server.advance(const Duration(minutes: 10));
    final hourAgo = DateTime.now().millisecondsSinceEpoch - 3600 * 1000;
    b.store.put(bill('late'), at: hourAgo);
    await b.engine.syncNow();
    await a.engine.syncNow();
    expect(a.store.records['late']?['updatedAt'], hourAgo);
  });

  test('edit during push stays dirty', () async {
    final server = FakePostgrest();
    final a = Device(server);
    await a.signIn('u1');
    a.store.put(bill('b1'));
    final gate = Completer<void>();
    final reached = Completer<void>();
    server.beforeUpsert = (table) async {
      if (table != 'bills') return;
      reached.complete();
      await gate.future;
    };
    final run = a.engine.syncNow();
    await reached.future;
    a.store.put({'id': 'b1', 'amount': 30000});
    server.beforeUpsert = null;
    gate.complete();
    await run;
    expect(a.store.dirtyIds, contains('b1'));
    expect(a.store.records['b1']!['amount'], 30000);
  });

  test('child-only change is accepted', () async {
    final server = FakePostgrest();
    server.seed('debts', 'u1', {'id': 'd', 'dir': 'lend', 'person': 'Ana', 'amount': 100, 'updated_at': 100, 'deleted': false});
    server.replaceChildren('debt_payments', 'debt_id', 'u1', 'd', [
      {'idx': 0, 'amount': 10, 'time': '2026-11-01T05:00:00.000Z', 'updated_at': 100},
    ]);
    final a = Device(server);
    await a.signIn('u1');
    expect((a.store.records['d']!['payments'] as List).length, 1);
    server.advance(const Duration(minutes: 10));
    server.replaceChildren('debt_payments', 'debt_id', 'u1', 'd', [
      {'idx': 0, 'amount': 10, 'time': '2026-11-01T05:00:00.000Z', 'updated_at': 100},
      {'idx': 1, 'amount': 20, 'time': '2026-11-02T05:00:00.000Z', 'updated_at': 100},
    ]);
    await a.engine.syncNow();
    expect((a.store.records['d']!['payments'] as List).map((p) => (p as Map)['amount']), [10, 20]);
    expect(a.store.dirtyIds, isNot(contains('d')));
  });

  test('switching accounts resets local data', () async {
    final server = FakePostgrest();
    final a = Device(server);
    await a.signIn('u1');
    a.store.put(bill('x'));
    await a.signIn('u2');
    expect(a.store.records.containsKey('x'), isFalse);
    expect(a.store.dirtyIds, isEmpty);
    expect(server.row('bills', 'u2', 'x'), isNull);
    expect(server.row('bills', 'u1', 'x'), isNull);
  });

  test('401 during sync signs out without wiping records', () async {
    final server = FakePostgrest();
    final a = Device(server);
    await a.signIn('u1');
    a.store.put(bill('keep'));
    server.unauthorized = true;
    await a.engine.syncNow();
    expect(a.engine.status.phase, SyncPhase.off);
    expect(a.auth.session, isNull);
    expect(a.store.records['keep'], isNotNull);
  });

  test('settings travel between devices', () async {
    final server = FakePostgrest();
    final a = Device(server);
    await a.signIn('u1');
    a.store.setSettings({'lang': 'en', 'currency': 'USD'});
    expect(a.engine.status.pending, 1);
    await a.engine.syncNow();
    expect(server.rows('user_settings', 'u1').single['currency'], 'USD');
    final b = Device(server);
    await b.signIn('u1');
    expect(b.store.settings['lang'], 'en');
    expect(b.store.settings['currency'], 'USD');
  });

  test('a second device sees a delete', () async {
    final server = FakePostgrest();
    final a = Device(server);
    final b = Device(server);
    await a.signIn('u1');
    a.store.put(bill('gone'));
    await a.engine.syncNow();
    await b.signIn('u1');
    expect(b.store.records['gone']?['deleted'], isNot(true));
    a.store.remove('gone');
    await a.engine.syncNow();
    await b.engine.syncNow();
    expect(b.store.records['gone']!['deleted'], isTrue);
  });

  test('sync state survives a restart', () async {
    final server = FakePostgrest();
    final a = Device(server);
    await a.signIn('u1');
    a.store.put(bill('b1'));
    await a.engine.syncNow();
    final again = SyncEngine(a.store, a.api, a.auth, a.disk);
    expect(again.status.lastSync, isNotNull);
    server.requests.clear();
    await again.syncNow();
    final billPull = server.requests.firstWhere((r) => r.method == 'GET' && r.url.path == '/rest/v1/bills');
    expect(billPull.url.queryParameters['server_ts'], startsWith('gt.'));
  });
}
