// In-memory stand-in for the Kasku+ Supabase project: GoTrue password sign-in plus the PostgREST
// query forms the sync engine sends. Mirrors the server rules that matter for sync:
// kasku_lww (an upsert older than the stored row is skipped and left out of the reply) and
// kasku_touch (every written row gets server_ts from the server clock).
import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

typedef Row = Map<String, Object?>;

class FakePostgrest {
  /// table -> rows (each row carries user_id and server_ts).
  final Map<String, List<Row>> tables = {};
  DateTime clock = DateTime.utc(2026, 11, 19, 8);

  /// Every PostgREST call answers 401 while set (expired / revoked token).
  bool unauthorized = false;

  /// Access tokens the server rejects with 401 (a refresh issues a new one).
  final Set<String> revoked = {};
  int _refreshes = 0;

  /// Awaited before an upsert into the named table is applied.
  Future<void> Function(String table)? beforeUpsert;

  final List<http.Request> requests = [];

  late final http.Client client = MockClient(_handle);

  String _tick() {
    clock = clock.add(const Duration(seconds: 1));
    return clock.toIso8601String();
  }

  void advance(Duration d) => clock = clock.add(d);

  List<Row> rows(String table, [String? user]) =>
      (tables[table] ?? const []).where((r) => user == null || r['user_id'] == user).toList();

  Row? row(String table, String user, String id) {
    for (final r in rows(table, user)) {
      if (r['id'] == id) return r;
    }
    return null;
  }

  /// Writes a row as another device would, with a fresh server_ts.
  void seed(String table, String user, Row row) {
    final list = tables.putIfAbsent(table, () => []);
    list.removeWhere((r) => r['user_id'] == user && row.containsKey('id') && r['id'] == row['id']);
    list.add({...row, 'user_id': user, 'server_ts': _tick()});
  }

  /// Rewrites every child row of one parent, as a push from another device does.
  void replaceChildren(String table, String fk, String user, String parentId, List<Row> children) {
    final list = tables.putIfAbsent(table, () => []);
    list.removeWhere((r) => r['user_id'] == user && r[fk] == parentId);
    for (final c in children) {
      list.add({...c, fk: parentId, 'user_id': user, 'server_ts': _tick()});
    }
  }

  http.Response _json(int status, Object? body) =>
      http.Response(body == null ? '' : jsonEncode(body), status, headers: {'content-type': 'application/json'});

  Future<http.Response> _handle(http.Request req) async {
    requests.add(req);
    final path = req.url.path;
    if (path == '/auth/v1/token' && req.url.queryParameters['grant_type'] == 'password') {
      final email = (jsonDecode(req.body) as Map)['email'] as String;
      return _json(200, {'access_token': email, 'refresh_token': 'r-$email', 'expires_in': 3600, 'user': {'id': email, 'email': email}});
    }
    if (path == '/auth/v1/token' && req.url.queryParameters['grant_type'] == 'refresh_token') {
      final user = ((jsonDecode(req.body) as Map)['refresh_token'] as String).replaceFirst('r-', '');
      _refreshes++;
      return _json(200, {'access_token': '$user#$_refreshes', 'refresh_token': 'r-$user', 'expires_in': 3600, 'user': {'id': user, 'email': user}});
    }
    if (path.startsWith('/auth/')) return _json(200, {});
    if (!path.startsWith('/rest/v1/')) return _json(404, {'message': 'not found'});
    final token = (req.headers['Authorization'] ?? '').replaceFirst('Bearer ', '');
    if (unauthorized || revoked.contains(token)) return _json(401, {'message': 'JWT expired', 'code': 'PGRST301'});
    final user = token.split('#').first;
    final table = path.substring('/rest/v1/'.length);
    if (table == 'rpc/seed_user') return _json(204, null);
    final q = req.url.queryParameters;
    final filters = {for (final e in q.entries) if (!const {'select', 'order', 'limit', 'on_conflict'}.contains(e.key)) e.key: e.value};
    bool matches(Row r) => filters.entries.every((f) {
          final v = f.value;
          if (v.startsWith('gt.')) return (r[f.key] as String).compareTo(v.substring(3)) > 0;
          if (v.startsWith('in.(')) {
            final ids = v.substring(4, v.length - 1).split(',').map((s) => s.replaceAll('"', ''));
            return ids.contains(r[f.key]);
          }
          if (v.startsWith('eq.')) return '${r[f.key]}' == v.substring(3);
          return true;
        });

    switch (req.method) {
      case 'GET':
        var list = rows(table, user).where(matches).toList();
        if (q['order'] == 'server_ts.asc') list.sort((a, b) => (a['server_ts'] as String).compareTo(b['server_ts'] as String));
        final limit = int.tryParse(q['limit'] ?? '');
        if (limit != null && list.length > limit) list = list.sublist(0, limit);
        return _json(200, list);
      case 'DELETE':
        tables[table]?.removeWhere((r) => r['user_id'] == user && matches(r));
        return _json(204, null);
      case 'POST':
        final body = [for (final r in jsonDecode(req.body) as List) Map<String, Object?>.from(r as Map)];
        final conflict = q['on_conflict'];
        if (conflict == null) {
          for (final r in body) {
            tables.putIfAbsent(table, () => []).add({...r, 'user_id': user, 'server_ts': _tick()});
          }
          return _json(201, null);
        }
        await beforeUpsert?.call(table);
        final keys = conflict.split(',');
        final written = <Row>[];
        final list = tables.putIfAbsent(table, () => []);
        for (final r in body) {
          final rr = {...r, 'user_id': user};
          final i = list.indexWhere((x) => keys.every((k) => x[k] == rr[k]));
          if (i >= 0 && ((rr['updated_at'] as num?) ?? 0) < ((list[i]['updated_at'] as num?) ?? 0)) continue;
          final stored = {...rr, 'server_ts': _tick()};
          if (i >= 0) {
            list[i] = stored;
          } else {
            list.add(stored);
          }
          written.add({'id': stored['id']});
        }
        final rep = (req.headers['Prefer'] ?? '').contains('return=representation');
        return _json(201, rep ? written : null);
    }
    return _json(405, {'message': 'method'});
  }
}
