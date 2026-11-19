// Two-way sync with the Kasku+ tables in Supabase Postgres, a port of src/sync.js.
// The device keeps a full copy for offline use; local changes queue in the store's dirty set.
// Push sends dirty records (server keeps the newest updated_at); pull fetches rows by server_ts.
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:http/http.dart' as http;

import '../data/disk.dart';
import '../data/store.dart';
import 'api.dart';
import 'kinds.dart';
import 'session.dart';

enum SyncPhase { off, idle, syncing, offline, error }

class SyncStatus {
  const SyncStatus({this.phase = SyncPhase.off, this.error = '', this.pending = 0, this.lastSync});
  final SyncPhase phase;
  final String error;
  final int pending;
  final DateTime? lastSync;
}

const _stateKey = 'sync';
const _page = 1000;
// Each pull starts this far before the saved cursor: a row whose transaction committed late carries
// an earlier server_ts than rows already pulled, and would otherwise be skipped for good.
const _overlap = Duration(seconds: 60);
const _pushChunk = 200;
const _childChunk = 100;
const _debounce = Duration(milliseconds: 1200);
const _periodic = Duration(seconds: 30);
const _maxRetry = 60000;
const _syncedSettings = ['lang', 'currency', 'theme', 'dark', 'bookId'];

int _now() => DateTime.now().millisecondsSinceEpoch;
num _n(Object? v) => v is num ? v : num.tryParse('$v') ?? 0;
String _inList(Iterable<String> ids) => 'in.(${ids.map((id) => '"${id.replaceAll('"', '')}"').join(',')})';
String _q(String v) => Uri.encodeQueryComponent(v);
bool _network(Object e) => e is SocketException || e is http.ClientException || e is TimeoutException || e is HandshakeException;

class SyncEngine extends ChangeNotifier {
  SyncEngine(this.store, this.api, this.auth, this._disk) {
    _loadState();
    _lastSettings = _settingsKey();
    store.addListener(_onStoreChanged);
    _status = SyncStatus(
      phase: auth.session == null ? SyncPhase.off : SyncPhase.idle,
      pending: _pendingCount(),
      lastSync: _lastSync == null ? null : DateTime.fromMillisecondsSinceEpoch(_lastSync!),
    );
  }

  final RecordStore store;
  final Api api;
  final Auth auth;
  final Disk _disk;

  // Persisted sync state (owner of the local copy, pull cursors, settings row version).
  String? _owner;
  Map<String, String> _cursors = {};
  int? _lastSync;
  num _settingsAt = 0;
  bool _settingsDirty = false;

  late SyncStatus _status;
  SyncStatus get status => _status;

  bool get configured => api.baseUrl.isNotEmpty && api.anonKey.isNotEmpty;

  // ---------- state ----------
  void _loadState() {
    final raw = _disk.read(_stateKey);
    if (raw == null) return;
    try {
      final m = Map<String, Object?>.from(jsonDecode(raw) as Map);
      _owner = m['owner'] as String?;
      _cursors = Map<String, String>.from((m['cursors'] as Map?) ?? const {});
      _lastSync = (m['lastSync'] as num?)?.toInt();
      _settingsAt = (m['settingsAt'] as num?) ?? 0;
      _settingsDirty = m['settingsDirty'] == true;
    } on FormatException {
      _disk.keepAside(_stateKey, raw);
    }
  }

  void _saveState() {
    try {
      _disk.writeAll({
        _stateKey: jsonEncode({'owner': _owner, 'cursors': _cursors, 'lastSync': _lastSync, 'settingsAt': _settingsAt, 'settingsDirty': _settingsDirty}),
      });
    } catch (_) {
      // Storage full: the next successful save writes the state again; a stale cursor only re-pulls rows.
    }
  }

  void _resetState({String? owner}) {
    _owner = owner;
    _cursors = {};
    _lastSync = null;
    _settingsAt = 0;
    _settingsDirty = false;
    _saveState();
  }

  int _pendingCount() => store.dirtyIds.length + (_settingsDirty ? 1 : 0);

  void _setStatus({SyncPhase? phase, String? error}) {
    _status = SyncStatus(
      phase: phase ?? _status.phase,
      error: error ?? _status.error,
      pending: _pendingCount(),
      lastSync: _lastSync == null ? null : DateTime.fromMillisecondsSinceEpoch(_lastSync!),
    );
    notifyListeners();
  }

  // ---------- settings row ----------
  late String _lastSettings;
  bool _applyingRemote = false;
  String _settingsKey() => jsonEncode([for (final k in _syncedSettings) store.settings[k]]);

  void _onStoreChanged() {
    final now = _settingsKey();
    if (now != _lastSettings) {
      _lastSettings = now;
      if (!_applyingRemote && auth.session != null) {
        _settingsAt = _now();
        _settingsDirty = true;
        _saveState();
        _schedule();
      }
    }
    if (_status.pending != _pendingCount()) _setStatus();
  }

  // ---------- account ----------
  /// After a sign-in or sign-up: a different account (or the first sign-in) starts from a clean
  /// local copy, so one account's records are never pushed into another.
  Future<void> afterSignIn(Session s) async {
    if (_owner != s.userId) {
      _applyingRemote = true;
      store.resetAll();
      _applyingRemote = false;
      _lastSettings = _settingsKey();
      _resetState(owner: s.userId);
    }
    _setStatus(phase: SyncPhase.idle, error: '');
    try {
      await api.call('/rest/v1/rpc/seed_user', method: 'POST', body: const {});
    } catch (_) {
      // The sign-up trigger normally seeds the user; this call is only a fallback.
    }
    await syncNow();
  }

  Future<void> signOut() async {
    await auth.signOut();
    _applyingRemote = true;
    store.resetAll();
    _applyingRemote = false;
    _lastSettings = _settingsKey();
    _resetState();
    _setStatus(phase: SyncPhase.off, error: '');
  }

  /// "Erase all data" while signed in: empties this device and downloads the cloud copy again.
  Future<void> resetLocal() async {
    _applyingRemote = true;
    store.resetAll();
    _applyingRemote = false;
    _lastSettings = _settingsKey();
    _resetState(owner: _owner);
    _setStatus();
    if (auth.session != null) await syncNow();
  }

  // ---------- first sync ----------
  // Work that must see the cloud copy first (recurring bills) waits for the first sync attempt of
  // this app session; a failed or offline attempt also releases it, so the app keeps working offline.
  bool _firstDone = false;
  final List<void Function()> _firstWaiters = [];

  void afterFirstSync(void Function() fn) {
    if (_firstDone || !configured || auth.session == null) {
      fn();
    } else {
      _firstWaiters.add(fn);
    }
  }

  void _releaseFirst() {
    if (_firstDone) return;
    _firstDone = true;
    final waiters = [..._firstWaiters];
    _firstWaiters.clear();
    for (final f in waiters) {
      f();
    }
  }

  // ---------- sync ----------
  Future<void>? _running;
  bool _again = false;

  /// Runs one sync; a call while one is running schedules exactly one more run after it.
  Future<void> syncNow() {
    if (_running != null) {
      _again = true;
      return _running!;
    }
    final run = _doSync().whenComplete(() {
      _running = null;
      if (_again) {
        _again = false;
        syncNow();
      }
    });
    return _running = run;
  }

  Future<void> _doSync() async {
    try {
      await _syncOnce();
    } finally {
      _releaseFirst();
    }
  }

  Timer? _timer;
  Timer? _retryTimer;
  int _retryDelay = 2000;

  void _schedule([Duration delay = _debounce]) {
    _setStatus();
    _timer?.cancel();
    _timer = Timer(delay, syncNow);
  }

  Future<void> _syncOnce() async {
    if (!configured || auth.session == null) return;
    _setStatus(phase: SyncPhase.syncing, error: '');
    try {
      if (!await auth.ensureFresh()) {
        _setStatus(phase: SyncPhase.off);
        return;
      }
      await _push();
      await _pull();
      _lastSync = _now();
      _saveState();
      _setStatus(phase: SyncPhase.idle, error: '');
      _retryDelay = 2000;
    } on ApiException catch (e) {
      if (e.status == 401) {
        await auth.expire();
        _setStatus(phase: SyncPhase.off, error: e.message);
        return;
      }
      _retry(SyncPhase.error, e.message);
    } catch (e) {
      _retry(_network(e) ? SyncPhase.offline : SyncPhase.error, '$e');
    }
  }

  void _retry(SyncPhase phase, String error) {
    _setStatus(phase: phase, error: error);
    _retryTimer?.cancel();
    _retryTimer = Timer(Duration(milliseconds: _retryDelay), syncNow);
    _retryDelay = (_retryDelay * 2).clamp(0, _maxRetry);
  }

  Future<List<DbRow>> _get(String path) async => [for (final r in (await api.call(path) as List?) ?? const []) Map<String, Object?>.from(r as Map)];

  Future<({List<DbRow> rows, String? cursor})> _pullTable(String table) async {
    final rows = <DbRow>[];
    var cursor = _cursors[table];
    final from = cursor == null ? null : DateTime.tryParse(cursor);
    var after = from == null ? cursor : from.subtract(_overlap).toUtc().toIso8601String();
    while (true) {
      final page = await _get('/rest/v1/$table?select=*&order=server_ts.asc&limit=$_page${after != null ? '&server_ts=${_q('gt.$after')}' : ''}');
      rows.addAll(page);
      if (page.isNotEmpty) {
        cursor = page.last['server_ts'] as String?;
        after = cursor;
      }
      if (page.length < _page) break;
    }
    return (rows: rows, cursor: cursor);
  }

  Future<void> _pull() async {
    final next = <String, String?>{};
    final incoming = <Rec>[];
    for (final kind in kindOrder) {
      final spec = kinds[kind]!;
      final pulled = await _pullTable(spec.table);
      next[spec.table] = pulled.cursor;
      final recs = <String, Rec>{for (final r in pulled.rows) r['id']! as String: fromRow(r, spec, kind)};
      for (final ch in spec.children) {
        final cp = await _pullTable(ch.table);
        next[ch.table] = cp.cursor;
        // Children are rewritten with their parent's updated_at; only that set belongs to the parent now.
        final groups = <String, List<DbRow>>{};
        for (final c in cp.rows) {
          groups.putIfAbsent(c[ch.fk]! as String, () => []).add(c);
        }
        for (final MapEntry(key: pid, value: list) in groups.entries) {
          var rec = recs[pid];
          if (rec == null) {
            final cur = store.records[pid];
            if (cur == null) continue;
            rec = {...cur};
            recs[pid] = rec;
          }
          final at = _n(rec['updatedAt']).round();
          ch.fold(rec, list.where((c) => _n(c['updated_at']) == at).toList());
        }
        for (final r in pulled.rows) {
          if (!groups.containsKey(r['id'])) ch.fold(recs[r['id']]!, []);
        }
      }
      incoming.addAll(recs.values);
    }
    // A child-only change arrives with the parent's own updatedAt; nudge it so merge accepts it.
    // Rows pulled again by the overlap window carry nothing new and are left out.
    final dirtyNow = store.dirtyIds.toSet();
    store.merge([
      for (final r in incoming)
        ...() {
          final cur = store.records[r['id']];
          if (cur == null || _n(cur['updatedAt']).round() != _n(r['updatedAt']) || dirtyNow.contains(r['id'])) return [r];
          return sameContent(cur, r) ? const <Rec>[] : [{...r, 'updatedAt': _n(cur['updatedAt']) + 0.001}];
        }(),
    ]);

    final settingsRows = await _get('/rest/v1/user_settings?select=*');
    final s = settingsRows.isEmpty ? null : settingsRows.first;
    if (s != null && _n(s['updated_at']) > _settingsAt && !_settingsDirty) {
      _applyingRemote = true;
      store.setSettings({
        'lang': s['lang'],
        'currency': s['currency'],
        'dark': s['dark'] == true,
        if (s['accent'] != null) 'theme': s['accent'],
        if (s['book_id'] != null) 'bookId': s['book_id'],
      });
      _applyingRemote = false;
      _lastSettings = _settingsKey();
      _settingsAt = _n(s['updated_at']);
    }
    _cursors = {..._cursors, for (final e in next.entries) if (e.value != null) e.key: e.value!};
  }

  Future<void> _push() async {
    final userId = auth.session!.userId;
    if (_settingsDirty) {
      final st = store.settings;
      // tz is left out so the upsert keeps the zone the web app (or the default) stored.
      await api.call('/rest/v1/user_settings?on_conflict=user_id', method: 'POST', headers: {'Prefer': 'resolution=merge-duplicates,return=minimal'}, body: [
        {'user_id': userId, 'lang': st['lang'], 'currency': st['currency'], 'accent': st['theme'], 'dark': st['dark'] == true, 'book_id': st['bookId'], 'updated_at': _settingsAt.round()},
      ]);
      _settingsDirty = false;
      _saveState();
    }
    final recs = store.records;
    final ids = store.dirtyIds.where((id) => recs[id] != null && kinds.containsKey(recs[id]!['kind'])).toList();
    final sent = <String, num>{};
    for (final kind in kindOrder) {
      final spec = kinds[kind]!;
      final list = [for (final id in ids) if (recs[id]!['kind'] == kind) recs[id]!];
      for (var i = 0; i < list.length; i += _pushChunk) {
        final chunk = list.sublist(i, (i + _pushChunk).clamp(0, list.length));
        // The server keeps a row whose updated_at is newer than the one sent (kasku_lww) and leaves
        // it out of the reply. Those records take the server copy; only written rows get children.
        final written = await api.call('/rest/v1/${spec.table}?on_conflict=user_id,id&select=id',
            method: 'POST', headers: {'Prefer': 'resolution=merge-duplicates,return=representation'}, body: [for (final r in chunk) toRow(r, spec, userId)]);
        final ok = {for (final x in (written as List?) ?? const []) (x as Map)['id']};
        final lost = [for (final r in chunk) if (!ok.contains(r['id'])) r['id']! as String];
        if (lost.isNotEmpty) store.merge(await _fetchByIds(kind, lost));
        final kept = [for (final r in chunk) if (ok.contains(r['id'])) r];
        for (final ch in spec.children) {
          for (var j = 0; j < kept.length; j += _childChunk) {
            final part = kept.sublist(j, (j + _childChunk).clamp(0, kept.length));
            await api.call('/rest/v1/${ch.table}?${ch.fk}=${_q(_inList(part.map((r) => r['id']! as String)))}', method: 'DELETE', headers: {'Prefer': 'return=minimal'});
            final rows = [
              for (final r in part)
                for (final c in ch.rows(r)) {'user_id': userId, ch.fk: r['id'], 'updated_at': _n(r['updatedAt']).round(), ...c},
            ];
            if (rows.isNotEmpty) await api.call('/rest/v1/${ch.table}', method: 'POST', headers: {'Prefer': 'return=minimal'}, body: rows);
          }
        }
        for (final r in kept) {
          sent[r['id']! as String] = _n(r['updatedAt']);
        }
      }
    }
    // A record edited again while its push was in flight stays queued.
    store.clearDirtyIfUnchanged(sent);
  }

  /// Server copies of some records, children included, for records the server refused to overwrite.
  Future<List<Rec>> _fetchByIds(String kind, List<String> ids) async {
    final spec = kinds[kind]!;
    final recs = [for (final r in await _get('/rest/v1/${spec.table}?select=*&id=${_q(_inList(ids))}')) fromRow(r, spec, kind)];
    for (final ch in spec.children) {
      final crow = await _get('/rest/v1/${ch.table}?select=*&${ch.fk}=${_q(_inList(ids))}');
      for (final rec in recs) {
        final at = _n(rec['updatedAt']).round();
        ch.fold(rec, crow.where((c) => c[ch.fk] == rec['id'] && _n(c['updated_at']) == at).toList());
      }
    }
    return recs;
  }

  // ---------- background triggers ----------
  final List<StreamSubscription<Object?>> _subs = [];
  AppLifecycleListener? _lifecycle;
  Timer? _tick;
  bool _resumed = true;

  /// Syncs after edits, when the app returns to the foreground, when the network comes back
  /// ([online] emits true) and every 30 s while the app is in the foreground.
  void start({Stream<bool>? online}) {
    _subs.add(store.localChanges.listen((_) => _schedule()));
    if (online != null) {
      _subs.add(online.listen((on) {
        if (on) {
          syncNow();
        } else if (auth.session != null) {
          _setStatus(phase: SyncPhase.offline);
        }
      }));
    }
    _lifecycle = AppLifecycleListener(
      onResume: () {
        _resumed = true;
        syncNow();
      },
      onHide: () => _resumed = false,
    );
    _tick = Timer.periodic(_periodic, (_) {
      if (_resumed) syncNow();
    });
    if (auth.session != null) syncNow();
  }

  @override
  void dispose() {
    store.removeListener(_onStoreChanged);
    for (final s in _subs) {
      s.cancel();
    }
    _lifecycle?.dispose();
    _tick?.cancel();
    _timer?.cancel();
    _retryTimer?.cancel();
    super.dispose();
  }
}
