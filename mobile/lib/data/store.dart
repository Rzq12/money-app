// Local-first data store, a port of src/store.js. Every record carries an id, a kind, updatedAt and
// a deleted flag so two devices can merge their copies record by record.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';

import 'defaults.dart';
import 'disk.dart';

export 'defaults.dart' show Rec, accents, currencies, defaultRecords;

/// A change could not be written because the device storage is full (or failed).
class StorageFullException implements Exception {
  const StorageFullException();
  @override
  String toString() => 'StorageFullException';
}

const _recKey = 'records';
const _setKey = 'settings';
const _dirtyKey = 'dirty';

int _now() => DateTime.now().millisecondsSinceEpoch;

class RecordStore extends ChangeNotifier {
  RecordStore(this._disk) {
    final loaded = _load(_recKey, (j) => {for (final e in (j! as Map).entries) e.key as String: Map<String, Object?>.from(e.value as Map)});
    _records = {...defaultRecords(), ...?loaded};
    final s = _load(_setKey, (j) => Map<String, Object?>.from(j! as Map));
    var settings = {...defaultSettings, 'themeV': 1, ...?s};
    // Themes saved before the accent became its own setting reset to the default accent once.
    if (settings['themeV'] != 2 || !accents.contains(settings['theme'])) {
      settings = {...settings, 'theme': accents.first, 'themeV': 2};
    }
    _settings = settings;
    _dirty = _load(_dirtyKey, (j) => {for (final id in j! as List) id as String}) ?? {};
  }

  final Disk _disk;
  late Map<String, Rec> _records;
  late Map<String, Object?> _settings;
  late Set<String> _dirty;
  final _changes = StreamController<void>.broadcast(sync: true);
  final _errors = StreamController<Object>.broadcast();

  /// Keys whose saved copy could not be read at start-up (kept aside, never overwritten).
  final List<String> loadErrors = [];

  Map<String, Rec> get records => Map.unmodifiable(_records);
  Map<String, Object?> get settings => Map.unmodifiable(_settings);
  List<String> get dirtyIds => _dirty.toList();

  /// Fires after put / putMany: edits made on this device, which the sync engine pushes.
  Stream<void> get localChanges => _changes.stream;

  /// Fires when a change could not be written (device storage full).
  Stream<Object> get errors => _errors.stream;

  /// Reads and parses one saved blob. Anything unreadable (bytes that are not UTF-8, broken JSON,
  /// JSON of the wrong shape) is kept aside and reported in [loadErrors]; the store then starts
  /// from the defaults for that key instead of failing to open.
  T? _load<T>(String key, T Function(Object? json) parse) {
    String? raw;
    try {
      raw = _disk.read(key);
      if (raw == null) return null;
      return parse(jsonDecode(raw));
    } catch (_) {
      // FileDisk already set aside a file it could not decode (raw is null then).
      if (raw != null) _disk.keepAside(key, raw);
      loadErrors.add(key);
      return null;
    }
  }

  bool _writeFailed = false;

  /// True when the most recent change could not be written (storage full); merge and resetAll
  /// return false both for "nothing to change" and for this, so callers that must know check here.
  bool get writeFailed => _writeFailed;

  void _write(Map<String, Rec> r, Map<String, Object?> s, Set<String> d) {
    _disk.writeAll({_recKey: jsonEncode(r), _setKey: jsonEncode(s), _dirtyKey: jsonEncode(d.toList())});
  }

  // A change reaches the screen only after it is on disk. When the write fails the old copy stays
  // both on disk and in memory, and the error stream tells the user nothing was saved.
  bool _commit(Map<String, Rec> r, Map<String, Object?> s, Set<String> d) {
    try {
      _write(r, s, d);
    } catch (e) {
      try {
        _write(_records, _settings, _dirty);
      } catch (_) {
        // The keys that failed still hold the old copy.
      }
      _errors.add(e);
      _writeFailed = true;
      return false;
    }
    _writeFailed = false;
    _records = r;
    _settings = s;
    _dirty = d;
    return true;
  }

  /// Saves [rec] over the existing record with the same id. [at] sets updatedAt instead of now,
  /// for writes that must not win over a newer edit made on another device. Without [at] the edit
  /// is stamped after the copy it edits, even within the same millisecond or against a copy from a
  /// device whose clock runs ahead, so the sync engine never mistakes it for the version it sent.
  Rec? put(Rec rec, {num? at}) {
    final id = rec['id']! as String;
    final old = _records[id];
    final prev = ((old?['updatedAt'] as num?) ?? 0).floor();
    final now = _now();
    final next = <String, Object?>{...?old, ...rec, 'updatedAt': at ?? (now > prev ? now : prev + 1)};
    if (!_commit({..._records, id: next}, _settings, {..._dirty, id})) return null;
    notifyListeners();
    _changes.add(null);
    return next;
  }

  Rec? remove(String id) => _records.containsKey(id) ? put({'id': id, 'deleted': true}) : null;

  /// Several records in one notification. [keepTime] leaves each record's updatedAt as it was, so a
  /// background refresh never wins over an edit from another device.
  bool putMany(List<Rec> recs, {bool keepTime = false}) {
    final next = {..._records};
    final d = {..._dirty};
    final now = _now();
    for (final rec in recs) {
      final id = rec['id']! as String;
      final old = next[id];
      final prev = ((old?['updatedAt'] as num?) ?? 0).floor();
      next[id] = {...?old, ...rec, 'updatedAt': keepTime && old != null ? (old['updatedAt'] as num? ?? 0) : (now > prev ? now : prev + 1)};
      d.add(id);
    }
    if (!_commit(next, _settings, d)) return false;
    notifyListeners();
    _changes.add(null);
    return true;
  }

  bool setSettings(Map<String, Object?> patch) {
    if (!_commit(_records, {..._settings, ...patch}, _dirty)) return false;
    notifyListeners();
    return true;
  }

  /// Merges records from the cloud or a backup: the newest updatedAt wins.
  bool merge(List<Rec> incoming, {bool markDirty = false}) {
    final recs = {..._records};
    final d = {..._dirty};
    var changed = false;
    for (final r in incoming) {
      final id = r['id']! as String;
      final cur = recs[id];
      if (cur == null || ((r['updatedAt'] as num?) ?? 0) > ((cur['updatedAt'] as num?) ?? 0)) {
        recs[id] = r;
        changed = true;
        markDirty ? d.add(id) : d.remove(id);
      }
    }
    if (!changed) {
      _writeFailed = false;
      return false;
    }
    if (!_commit(recs, _settings, d)) return false;
    notifyListeners();
    return true;
  }

  /// Clears pushed ids, except records edited again while their push was in flight.
  void clearDirtyIfUnchanged(Map<String, num> sentAt) {
    final d = {..._dirty}..removeWhere((id) => sentAt.containsKey(id) && _records[id]?['updatedAt'] == sentAt[id]);
    if (d.length != _dirty.length) _commit(_records, _settings, d);
  }

  /// Back to the starter data, keeping only the language (sign-out, switching accounts).
  /// Returns false when the reset could not be written; the old copy is then still in place.
  bool resetAll() {
    if (!_commit(defaultRecords(), {...defaultSettings, 'lang': _settings['lang']}, {})) return false;
    notifyListeners();
    return true;
  }

  @override
  void dispose() {
    _changes.close();
    _errors.close();
    super.dispose();
  }
}

// ---------- derived helpers ----------

List<Rec> live(Map<String, Rec> records, String kind) =>
    records.values.where((r) => r['kind'] == kind && r['deleted'] != true).toList()
      ..sort((a, b) => ((a['order'] as num?) ?? 0).compareTo((b['order'] as num?) ?? 0));

String nameOf(Rec? r, String lang) {
  if (r == null) return '—';
  final name = r['name'] as String?;
  if (name != null && name.isNotEmpty) return name;
  final names = r['names'] as Map?;
  return (names?[lang] ?? names?['id'] ?? '—') as String;
}

num _n(Object? v) => v is num ? v : num.tryParse('$v') ?? 0;

/// Balances in each account's own currency. A transfer between currencies converts at the saved
/// rates; without a rate for both sides the receiving account is not credited, so an amount is
/// never taken 1:1 across currencies.
Map<String, double> accountBalances(Map<String, Rec> records, String base) {
  final bal = <String, double>{};
  String cur(Object? accId) => (records[accId]?['currency'] as String?) ?? base;
  double? rate(Object? accId) {
    final c = cur(accId);
    if (c == base) return 1;
    final r = records['rate-$c'];
    final v = r == null || r['deleted'] == true ? 0 : _n(r['rate']);
    return v > 0 ? v.toDouble() : null;
  }

  for (final a in live(records, 'account')) {
    bal[a['id']! as String] = _n(a['initBalance']).toDouble();
  }
  for (final b in live(records, 'bill')) {
    final amt = _n(b['amount']).toDouble();
    final from = b['accountId'] as String?;
    if (from == null) continue;
    switch (b['type']) {
      case 'expense':
        bal[from] = (bal[from] ?? 0) - amt;
      case 'income':
        bal[from] = (bal[from] ?? 0) + amt;
      case 'transfer':
        bal[from] = (bal[from] ?? 0) - amt;
        final to = b['toAccountId'] as String?;
        if (to == null) continue;
        final rf = rate(from);
        final rt = rate(to);
        final into = cur(from) == cur(to) ? amt : (rf != null && rt != null ? amt * rf / rt : null);
        if (into != null) bal[to] = (bal[to] ?? 0) + into;
    }
  }
  return bal;
}

const _uuid = Uuid();
String newId() => _uuid.v4();
