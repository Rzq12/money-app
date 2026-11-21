import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:kasku_plus/data/disk.dart';
import 'package:kasku_plus/data/store.dart';

int t(int y, int m, int d) => DateTime(y, m, d, 12).millisecondsSinceEpoch;

void main() {
  test('fresh store has the default records', () {
    final store = RecordStore(MemoryDisk());
    expect(store.records['cat-food']!['names'], {'id': 'Makan', 'en': 'Food'});
    expect(store.records.length, 29);
    expect(store.settings['lang'], 'id');
    expect(store.settings['bookId'], 'book-default');
  });

  test('default ledger icon matches the web app', () {
    expect(RecordStore(MemoryDisk()).records['book-default']!['icon'], 'notebook');
  });

  test('records file that is not UTF-8 is kept aside and the app still opens', () {
    final dir = Directory.systemTemp.createTempSync('kasku');
    addTearDown(() => dir.deleteSync(recursive: true));
    File('${dir.path}/records.json').writeAsBytesSync([0x7b, 0x22, 0xff, 0xfe, 0x22]);
    final store = RecordStore(FileDisk(dir));
    expect(store.loadErrors, ['records']);
    expect(store.records['cat-food'], isNotNull);
    final names = dir.listSync().map((f) => f.uri.pathSegments.last);
    expect(names.where((n) => n.startsWith('records.unreadable-')), hasLength(1));
  });

  test('wrong-shaped saved files are kept aside instead of crashing', () {
    final disk = MemoryDisk()
      ..entries['records'] = '{"a":5}'
      ..entries['dirty'] = '[1]'
      ..entries['settings'] = '[]';
    final store = RecordStore(disk);
    expect(store.loadErrors, unorderedEquals(['records', 'dirty', 'settings']));
    expect(store.records['a'], isNull);
    expect(store.settings['lang'], 'id');
  });

  test('put stamps updatedAt and marks dirty', () {
    final store = RecordStore(MemoryDisk());
    final saved = store.put({'id': 'x', 'kind': 'bill', 'amount': 1});
    expect(saved, isNotNull);
    expect(store.dirtyIds, contains('x'));
    expect(store.records['x']!['updatedAt'] as num, greaterThan(0));
  });

  test('put merges into the existing record', () {
    final store = RecordStore(MemoryDisk());
    store.put({'id': 'acc-cash', 'initBalance': 5});
    expect(store.records['acc-cash']!['kind'], 'account');
    expect(store.records['acc-cash']!['initBalance'], 5);
  });

  test('records survive a restart from the same disk', () {
    final disk = MemoryDisk();
    RecordStore(disk).put({'id': 'x', 'kind': 'bill', 'amount': 7});
    final again = RecordStore(disk);
    expect(again.records['x']!['amount'], 7);
    expect(again.dirtyIds, contains('x'));
  });

  test('merge keeps the newest updatedAt', () {
    final store = RecordStore(MemoryDisk());
    store.put({'id': 'x', 'kind': 'bill', 'amount': 1}, at: 10);
    store.merge([
      {'id': 'x', 'kind': 'bill', 'amount': 2, 'updatedAt': 5},
    ]);
    expect(store.records['x']!['amount'], 1);
    expect(store.dirtyIds, contains('x'));
    store.merge([
      {'id': 'x', 'kind': 'bill', 'amount': 3, 'updatedAt': 20},
    ]);
    expect(store.records['x']!['amount'], 3);
    expect(store.dirtyIds, isNot(contains('x')));
  });

  test('BUG-009 corrupted records file is kept aside', () {
    final disk = MemoryDisk()..entries['records'] = '{"bill-1":{"id":"bill-1","kind":"bill","amount":5';
    final store = RecordStore(disk);
    expect(store.loadErrors, ['records']);
    store.put({'id': 'x', 'kind': 'bill', 'amount': 1});
    final aside = disk.entries.entries.where((e) => e.key.startsWith('records.unreadable-'));
    expect(aside.single.value, contains('bill-1'));
  });

  test('BUG-008 full disk refuses the save', () async {
    final disk = MemoryDisk();
    final store = RecordStore(disk);
    final errors = <Object>[];
    final sub = store.errors.listen(errors.add);
    disk.full = true;
    expect(store.put({'id': 'y', 'kind': 'bill', 'amount': 1}), isNull);
    expect(store.records.containsKey('y'), isFalse);
    await Future<void>.delayed(Duration.zero);
    expect(errors, hasLength(1));
    await sub.cancel();
  });

  test('edit in flight stays dirty', () {
    final store = RecordStore(MemoryDisk());
    store.put({'id': 'x', 'kind': 'bill', 'amount': 1}, at: 100);
    final sent = store.records['x']!['updatedAt'] as num;
    store.put({'id': 'x', 'amount': 2}, at: 200);
    store.clearDirtyIfUnchanged({'x': sent});
    expect(store.dirtyIds, contains('x'));
    store.clearDirtyIfUnchanged({'x': 200});
    expect(store.dirtyIds, isNot(contains('x')));
  });

  test('an edit always gets a newer updatedAt than the copy it edits', () {
    final store = RecordStore(MemoryDisk());
    final future = DateTime.now().millisecondsSinceEpoch + 100000;
    store.merge([
      {'id': 'x', 'kind': 'bill', 'amount': 1, 'updatedAt': future},
    ]);
    store.put({'id': 'x', 'amount': 2});
    expect(store.records['x']!['updatedAt'] as num, greaterThan(future));
    final first = store.put({'id': 'y', 'kind': 'bill', 'amount': 1})!['updatedAt'] as num;
    final second = store.put({'id': 'y', 'amount': 2})!['updatedAt'] as num;
    expect(second, greaterThan(first));
  });

  test('putMany also stamps an edit after the copy it edits', () {
    final store = RecordStore(MemoryDisk());
    final future = DateTime.now().millisecondsSinceEpoch + 100000;
    store.merge([
      {'id': 'x', 'kind': 'bill', 'amount': 1, 'updatedAt': future},
    ]);
    store.putMany([
      {'id': 'x', 'amount': 2},
    ]);
    expect(store.records['x']!['updatedAt'] as num, greaterThan(future));
  });

  test('localChanges fires on put but not on merge', () async {
    final store = RecordStore(MemoryDisk());
    var n = 0;
    final sub = store.localChanges.listen((_) => n++);
    store.put({'id': 'x', 'kind': 'bill', 'amount': 1});
    store.merge([
      {'id': 'y', 'kind': 'bill', 'amount': 1, 'updatedAt': 5},
    ]);
    await Future<void>.delayed(Duration.zero);
    expect(n, 1);
    await sub.cancel();
  });

  test('resetAll keeps the language and forgets the rest', () {
    final store = RecordStore(MemoryDisk());
    store.setSettings({'lang': 'en', 'currency': 'USD'});
    store.put({'id': 'x', 'kind': 'bill', 'amount': 1});
    store.resetAll();
    expect(store.records.containsKey('x'), isFalse);
    expect(store.dirtyIds, isEmpty);
    expect(store.settings['lang'], 'en');
    expect(store.settings['currency'], 'IDR');
  });

  test('add, edit, delete and transfer balances', () {
    final store = RecordStore(MemoryDisk());
    store.put({'id': 'acc-cash', 'initBalance': 100000});
    final base = {'kind': 'bill', 'bookId': 'book-default', 'time': t(2026, 11, 18)};
    store.put({...base, 'id': 'b1', 'type': 'expense', 'amount': 25000, 'accountId': 'acc-cash', 'categoryId': 'cat-food'});
    store.put({...base, 'id': 'b2', 'type': 'income', 'amount': 10000, 'accountId': 'acc-cash', 'categoryId': 'cat-wage'});
    store.put({...base, 'id': 'b3', 'type': 'transfer', 'amount': 50000, 'accountId': 'acc-cash', 'toAccountId': 'acc-bank'});
    store.put({'id': 'b1', 'amount': 30000});
    store.remove('b2');
    final bal = accountBalances(store.records, 'IDR');
    expect(bal['acc-cash'], 20000);
    expect(bal['acc-bank'], 50000);
  });

  test('transfer IDR -> USD converts at the saved rate', () {
    final store = RecordStore(MemoryDisk());
    store.put({'id': 'acc-usd', 'kind': 'account', 'type': 'debit', 'name': 'USD', 'currency': 'USD', 'initBalance': 0});
    store.put({'id': 'rate-USD', 'kind': 'rate', 'code': 'USD', 'rate': 16000});
    store.put({'id': 't1', 'kind': 'bill', 'type': 'transfer', 'amount': 160000, 'accountId': 'acc-cash', 'toAccountId': 'acc-usd', 'time': t(2026, 11, 18)});
    expect(accountBalances(store.records, 'IDR')['acc-usd'], 10);
  });

  test('BUG-007 no rate, no 1:1 credit', () {
    final store = RecordStore(MemoryDisk());
    store.put({'id': 'acc-usd', 'kind': 'account', 'type': 'debit', 'name': 'USD', 'currency': 'USD', 'initBalance': 0});
    store.put({'id': 't1', 'kind': 'bill', 'type': 'transfer', 'amount': 160000, 'accountId': 'acc-cash', 'toAccountId': 'acc-usd', 'time': t(2026, 11, 18)});
    expect(accountBalances(store.records, 'IDR')['acc-usd'], isNot(160000));
  });

  test('live skips deleted and sorts by order; nameOf picks the language', () {
    final store = RecordStore(MemoryDisk());
    store.remove('acc-bank');
    final accounts = live(store.records, 'account');
    expect(accounts.map((a) => a['id']), ['acc-cash', 'acc-ewallet']);
    expect(nameOf(store.records['acc-cash'], 'en'), 'Cash');
    expect(nameOf(null, 'id'), '—');
  });

  test('newId gives distinct UUIDs', () {
    expect(newId(), isNot(newId()));
    expect(newId(), matches(RegExp(r'^[0-9a-f-]{36}$')));
  });
}
