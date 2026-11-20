import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:kasku_plus/sync/kinds.dart';

int t(int y, int m, int d, [int h = 12]) => DateTime(y, m, d, h).millisecondsSinceEpoch;

Map<String, Object?> wire(Map<String, Object?> row) => Map<String, Object?>.from(jsonDecode(jsonEncode(row)) as Map);

void main() {
  test('round trip keeps every saved field', () {
    // Same samples as tests/data.test.js > sync row mapping.
    final samples = <String, Map<String, Object?>>{
      'bill': {'id': 'b', 'kind': 'bill', 'type': 'transfer', 'amount': 12.5, 'time': t(2026, 11, 18), 'bookId': 'book-default', 'accountId': 'acc-cash', 'toAccountId': 'acc-bank', 'categoryId': null, 'memberId': 'mem-me', 'note': 'x', 'hasPhoto': true, 'goalId': 'g', 'recurringId': 'r', 'createdAt': 5, 'updatedAt': 9, 'deleted': false},
      'account': {'id': 'a', 'kind': 'account', 'type': 'credit', 'name': 'Kartu \u{1F600}', 'icon': 'card', 'color': '#000000', 'currency': 'USD', 'initBalance': -10.25, 'note': 'n', 'order': 3, 'archived': true, 'updatedAt': 9, 'deleted': false},
      'recurring': {'id': 'r', 'kind': 'recurring', 'type': 'expense', 'amount': 1, 'bookId': 'b', 'accountId': 'a', 'toAccountId': null, 'categoryId': 'c', 'memberId': 'mem-me', 'note': '', 'freq': 'monthly', 'next': t(2026, 12, 1, 9), 'day': 1, 'active': false, 'updatedAt': 9, 'deleted': false},
      'budget': {'id': 'bu', 'kind': 'budget', 'bookId': 'b', 'categoryId': null, 'amount': 5, 'period': 'custom', 'start': t(2026, 11, 1, 0), 'end': t(2026, 11, 30, 0), 'updatedAt': 9, 'deleted': false},
      'holding': {'id': 'h', 'kind': 'holding', 'type': 'kripto', 'name': 'BTC', 'symbol': 'BTC', 'units': 0.00000001, 'buyPrice': 1, 'price': 2, 'priceAt': 7, 'order': 1, 'updatedAt': 9, 'deleted': false},
    };
    for (final MapEntry(key: kind, value: r) in samples.entries) {
      final back = fromRow(wire(toRow(r, kinds[kind]!, 'u')), kinds[kind]!, kind);
      for (final MapEntry(:key, :value) in r.entries) {
        if (value == null || value == '') continue;
        expect([kind, key, back[key]], [kind, key, value]);
      }
    }
  });

  test('toRow fills defaults and owner columns', () {
    final row = toRow({'id': 'a', 'kind': 'account', 'updatedAt': 9.4}, kinds['account']!, 'u');
    expect(row['user_id'], 'u');
    expect(row['updated_at'], 9);
    expect(row['deleted'], false);
    expect(row['type'], 'cash');
    expect(row['currency'], 'IDR');
    expect(row['init_balance'], 0);
    expect(row['sort'], 0);
    expect(row['note'], isNull);
  });

  test('children round trip', () {
    final debt = {'id': 'd', 'kind': 'debt', 'payments': [{'amount': 5, 'time': t(2026, 11, 2)}, {'amount': 7.5, 'time': t(2026, 11, 3)}], 'updatedAt': 1};
    final dch = kinds['debt']!.children.single;
    final drows = dch.rows(debt).map(wire).toList().reversed.toList();
    final dback = <String, Object?>{};
    dch.fold(dback, drows);
    expect(dback['payments'], debt['payments']);

    final split = {'id': 's', 'kind': 'split', 'people': ['Ana', 'Budi'], 'paid': [true, false], 'items': [{'name': 'Nasi', 'price': 20000, 'who': [0, 1]}, {'name': 'Teh', 'price': 5000, 'who': [1]}], 'updatedAt': 1};
    final sback = <String, Object?>{};
    for (final ch in kinds['split']!.children) {
      ch.fold(sback, ch.rows(split).map(wire).toList().reversed.toList());
    }
    expect(sback['people'], ['Ana', 'Budi']);
    expect(sback['paid'], [true, false]);
    expect(sback['items'], split['items']);

    final bch = kinds['bill']!.children.single;
    expect(bch.rows({'tags': ['a', 'a', 'b']}), [{'tag': 'a'}, {'tag': 'b'}]);
  });

  test('push order puts referenced tables first', () {
    expect(kindOrder, ['book', 'account', 'category', 'member', 'rate', 'goal', 'recurring', 'rule', 'budget', 'holding', 'debt', 'split', 'bill']);
    expect(kindOrder.toSet(), kinds.keys.toSet());
  });

  test('sameContent treats null, empty string, false and [] as equal', () {
    expect(sameContent({'a': null, 'b': 1, 'updatedAt': 1}, {'a': '', 'b': 1, 'updatedAt': 2}), isTrue);
    expect(sameContent({'tags': <String>[]}, {'tags': null, 'x': false}), isTrue);
    expect(sameContent({'b': 1}, {'b': 2}), isFalse);
    expect(sameContent({'tags': ['a']}, {'tags': ['a']}), isTrue);
  });
}
