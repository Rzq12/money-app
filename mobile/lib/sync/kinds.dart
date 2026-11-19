// Record kind <-> Postgres table mapping, a port of KINDS in src/sync.js. Both apps must write the
// same rows, so every column, default and child table here matches the web app exactly.
import '../data/store.dart';

enum Conv { num, time }

class ColSpec {
  const ColSpec(this.field, this.column, [this.conv, this.def]);
  final String field, column;
  final Conv? conv;

  /// Sent when the record has no value for [field].
  final Object? def;
}

typedef Row = Map<String, Object?>;

class ChildSpec {
  const ChildSpec(this.table, this.fk, this.rows, this.fold);
  final String table, fk;

  /// Child rows for one parent, without user_id / fk / updated_at (the sync engine adds those).
  final List<Row> Function(Rec rec) rows;

  /// Writes the child rows back into the parent record.
  final void Function(Rec rec, List<Row> rows) fold;
}

class KindSpec {
  const KindSpec(this.table, this.cols, [this.children = const []]);
  final String table;
  final List<ColSpec> cols;
  final List<ChildSpec> children;
}

num _n(Object? v) => v is num ? v : num.tryParse('$v') ?? 0;

/// Epoch ms (or a date string) to an ISO-8601 UTC string; empty values to null.
String? isoTime(Object? v) {
  if (v == null || v == '') return null;
  if (v is num) return DateTime.fromMillisecondsSinceEpoch(v.round(), isUtc: true).toIso8601String();
  return DateTime.parse('$v').toUtc().toIso8601String();
}

/// A timestamptz from PostgREST back to epoch ms.
int? msTime(Object? v) => v == null ? null : DateTime.parse('$v').millisecondsSinceEpoch;

List<Row> _list(Object? v) => [for (final x in (v as List?) ?? const []) Map<String, Object?>.from(x as Map)];
List<Row> _byIdx(List<Row> rows) => [...rows]..sort((a, b) => _n(a['idx']).compareTo(_n(b['idx'])));

const _named = [ColSpec('name', 'name'), ColSpec('names', 'names'), ColSpec('icon', 'icon'), ColSpec('color', 'color'), ColSpec('order', 'sort', Conv.num, 0)];

final Map<String, KindSpec> kinds = {
  'book': const KindSpec('books', _named),
  'account': const KindSpec('accounts', [..._named, ColSpec('type', 'type', null, 'cash'), ColSpec('note', 'note'), ColSpec('currency', 'currency', null, 'IDR'), ColSpec('initBalance', 'init_balance', Conv.num, 0), ColSpec('archived', 'archived', null, false)]),
  'category': const KindSpec('categories', [..._named, ColSpec('type', 'type', null, 'expense')]),
  'member': const KindSpec('members', _named),
  'rate': const KindSpec('rates', [ColSpec('code', 'code'), ColSpec('rate', 'rate', Conv.num, 0)]),
  'goal': const KindSpec('goals', [ColSpec('name', 'name'), ColSpec('target', 'target', Conv.num), ColSpec('accountId', 'account_id'), ColSpec('due', 'due', Conv.time), ColSpec('order', 'sort', Conv.num, 0)]),
  'recurring': const KindSpec('recurring', [ColSpec('type', 'type'), ColSpec('amount', 'amount', Conv.num), ColSpec('bookId', 'book_id'), ColSpec('accountId', 'account_id'), ColSpec('toAccountId', 'to_account_id'), ColSpec('categoryId', 'category_id'), ColSpec('memberId', 'member_id'), ColSpec('note', 'note'), ColSpec('freq', 'freq'), ColSpec('next', 'next_at', Conv.time), ColSpec('day', 'day', Conv.num), ColSpec('active', 'active', null, true)]),
  'rule': const KindSpec('rules', [ColSpec('keyword', 'keyword'), ColSpec('categoryId', 'category_id'), ColSpec('order', 'sort', Conv.num, 0)]),
  'budget': const KindSpec('budgets', [ColSpec('bookId', 'book_id'), ColSpec('categoryId', 'category_id'), ColSpec('amount', 'amount', Conv.num), ColSpec('period', 'period', null, 'month'), ColSpec('start', 'start_at', Conv.time), ColSpec('end', 'end_at', Conv.time)]),
  'holding': const KindSpec('holdings', [ColSpec('type', 'type'), ColSpec('name', 'name'), ColSpec('symbol', 'symbol'), ColSpec('units', 'units', Conv.num), ColSpec('buyPrice', 'buy_price', Conv.num), ColSpec('price', 'price', Conv.num), ColSpec('priceAt', 'price_at', Conv.num), ColSpec('order', 'sort', Conv.num, 0)]),
  'debt': KindSpec('debts', const [ColSpec('dir', 'dir'), ColSpec('person', 'person'), ColSpec('amount', 'amount', Conv.num), ColSpec('note', 'note'), ColSpec('due', 'due', Conv.time), ColSpec('time', 'time', Conv.time)], [
    ChildSpec('debt_payments', 'debt_id',
        (r) => [for (final (i, p) in _list(r['payments']).indexed) {'idx': i, 'amount': p['amount'], 'time': isoTime(p['time'])}],
        (rec, rows) => rec['payments'] = [for (final p in _byIdx(rows)) {'amount': _n(p['amount']), 'time': msTime(p['time'])}]),
  ]),
  'split': KindSpec('splits', const [ColSpec('title', 'title'), ColSpec('taxPct', 'tax_pct', Conv.num, 0), ColSpec('servicePct', 'service_pct', Conv.num, 0), ColSpec('time', 'time', Conv.time)], [
    ChildSpec('split_people', 'split_id', (r) {
      final paid = (r['paid'] as List?) ?? const [];
      return [for (final (i, name) in ((r['people'] as List?) ?? const []).indexed) {'idx': i, 'name': name, 'paid': i < paid.length && paid[i] == true}];
    }, (rec, rows) {
      final sorted = _byIdx(rows);
      rec['people'] = [for (final p in sorted) p['name']];
      rec['paid'] = [for (final p in sorted) p['paid'] == true];
    }),
    ChildSpec('split_items', 'split_id',
        (r) => [for (final (i, it) in _list(r['items']).indexed) {'idx': i, 'name': it['name'], 'price': it['price'], 'who': it['who'] ?? const []}],
        (rec, rows) => rec['items'] = [for (final it in _byIdx(rows)) {'name': it['name'], 'price': _n(it['price']), 'who': it['who'] ?? const []}]),
  ]),
  'bill': KindSpec('bills', const [ColSpec('type', 'type'), ColSpec('amount', 'amount', Conv.num, 0), ColSpec('time', 'time', Conv.time), ColSpec('bookId', 'book_id'), ColSpec('accountId', 'account_id'), ColSpec('toAccountId', 'to_account_id'), ColSpec('categoryId', 'category_id'), ColSpec('memberId', 'member_id'), ColSpec('note', 'note'), ColSpec('hasPhoto', 'has_photo', null, false), ColSpec('goalId', 'goal_id'), ColSpec('recurringId', 'recurring_id'), ColSpec('createdAt', 'created_at', Conv.num)], [
    ChildSpec('bill_tags', 'bill_id',
        (r) => [for (final tag in {...((r['tags'] as List?) ?? const [])}) {'tag': tag}],
        (rec, rows) => rec['tags'] = [for (final x in rows) x['tag']]),
  ]),
};

/// Referenced tables go first so foreign keys hold within one push.
const kindOrder = ['book', 'account', 'category', 'member', 'rate', 'goal', 'recurring', 'rule', 'budget', 'holding', 'debt', 'split', 'bill'];

Row toRow(Rec rec, KindSpec spec, String userId) {
  final row = <String, Object?>{'user_id': userId, 'id': rec['id'], 'updated_at': _n(rec['updatedAt']).round(), 'deleted': rec['deleted'] == true};
  for (final c in spec.cols) {
    Object? v = rec[c.field];
    if (c.conv == Conv.time) {
      v = isoTime(v);
    } else if (c.conv == Conv.num && v != null && v != '') {
      v = v is num ? v : num.tryParse('$v');
    }
    if (v == null || v == '' || (v is double && v.isNaN)) v = c.def;
    row[c.column] = v;
  }
  return row;
}

Rec fromRow(Row row, KindSpec spec, String kind) {
  final rec = <String, Object?>{'id': row['id'], 'kind': kind, 'updatedAt': _n(row['updated_at']), 'deleted': row['deleted'] == true};
  for (final c in spec.cols) {
    final v = row[c.column];
    if (v == null) continue;
    rec[c.field] = switch (c.conv) {
      Conv.time => msTime(v),
      Conv.num => _n(v),
      null => v,
    };
  }
  return rec;
}

bool _blank(Object? v) => v == null || v == '' || v == false || (v is List && v.isEmpty);

bool _deepEq(Object? a, Object? b) {
  if (a is Map && b is Map) {
    return a.length == b.length && a.keys.every((k) => b.containsKey(k) && _deepEq(a[k], b[k]));
  }
  if (a is List && b is List) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (!_deepEq(a[i], b[i])) return false;
    }
    return true;
  }
  return a == b;
}

/// Same content, ignoring updatedAt; empty values (null, '', false, []) count as equal.
bool sameContent(Rec a, Rec b) =>
    b.keys.every((k) => k == 'updatedAt' || (_blank(a[k]) && _blank(b[k])) || _deepEq(a[k], b[k]));
