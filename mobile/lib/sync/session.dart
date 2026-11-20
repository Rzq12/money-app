// Sign-in, sign-up and token refresh against Supabase Auth (GoTrue REST), as in src/sync.js.
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api.dart';

class Session {
  Session({required this.accessToken, required this.refreshToken, required this.expiresAt, required this.userId, this.email});

  final String accessToken, refreshToken, userId;
  final String? email;

  /// Epoch ms when the access token expires.
  final int expiresAt;

  Map<String, Object?> toJson() => {'accessToken': accessToken, 'refreshToken': refreshToken, 'expiresAt': expiresAt, 'userId': userId, 'email': email};

  factory Session.fromJson(Map<String, Object?> j) => Session(
        accessToken: j['accessToken']! as String,
        refreshToken: j['refreshToken']! as String,
        expiresAt: (j['expiresAt']! as num).toInt(),
        userId: j['userId']! as String,
        email: j['email'] as String?,
      );
}

abstract class SessionStore {
  Future<Session?> load();
  Future<void> save(Session? s);
}

/// Tokens in the platform keystore (Android Keystore / iOS Keychain).
class SecureSessionStore implements SessionStore {
  SecureSessionStore({FlutterSecureStorage storage = const FlutterSecureStorage()}) : _storage = storage;
  static const _key = 'kasku.session';
  final FlutterSecureStorage _storage;

  @override
  /// A keystore that cannot be read (common after an Android backup/restore or reinstall) or a
  /// damaged entry means signed out: the entry is dropped and the cached records stay.
  Future<Session?> load() async {
    try {
      final raw = await _storage.read(key: _key);
      return raw == null ? null : Session.fromJson(Map<String, Object?>.from(jsonDecode(raw) as Map));
    } catch (_) {
      try {
        await _storage.delete(key: _key);
      } catch (_) {
        // Nothing more to do; the next sign-in writes a fresh entry.
      }
      return null;
    }
  }

  @override
  Future<void> save(Session? s) => s == null ? _storage.delete(key: _key) : _storage.write(key: _key, value: jsonEncode(s.toJson()));
}

class MemorySessionStore implements SessionStore {
  MemorySessionStore([this.saved]);
  Session? saved;

  @override
  Future<Session?> load() async => saved;

  @override
  Future<void> save(Session? s) async => saved = s;
}

class Auth extends ChangeNotifier {
  Auth(this._api, this._store, {int Function()? now}) : _now = now ?? (() => DateTime.now().millisecondsSinceEpoch);

  final Api _api;
  final SessionStore _store;
  final int Function() _now;
  Session? _session;

  Session? get session => _session;

  /// Reads the saved session; call once at start-up.
  Future<void> load() async {
    _session = await _store.load();
    notifyListeners();
  }

  Future<void> _keep(Object? d) async {
    final m = Map<String, Object?>.from(d! as Map);
    final user = Map<String, Object?>.from(m['user']! as Map);
    await _set(Session(
      accessToken: m['access_token']! as String,
      refreshToken: m['refresh_token']! as String,
      expiresAt: _now() + ((m['expires_in'] as num?) ?? 3600).toInt() * 1000,
      userId: user['id']! as String,
      email: user['email'] as String?,
    ));
  }

  Future<void> _set(Session? s) async {
    _session = s;
    await _store.save(s);
    notifyListeners();
  }

  Future<Session> signIn(String email, String password) async {
    await _keep(await _api.call('/auth/v1/token?grant_type=password', method: 'POST', auth: false, body: {'email': email, 'password': password}));
    return _session!;
  }

  /// Returns null when the project requires e-mail confirmation before the first sign-in.
  Future<Session?> signUp(String email, String password) async {
    final d = await _api.call('/auth/v1/signup', method: 'POST', auth: false, body: {'email': email, 'password': password});
    if (d is! Map || d['access_token'] == null) return null;
    await _keep(d);
    return _session;
  }

  Future<void> recover(String email) => _api.call('/auth/v1/recover', method: 'POST', auth: false, body: {'email': email});

  Future<void> signOut() async {
    try {
      await _api.call('/auth/v1/logout', method: 'POST');
    } catch (_) {
      // Offline or already expired: the local sign-out below still happens.
    }
    await _set(null);
  }

  /// Refreshes the access token a minute before it expires. Returns false when signed out
  /// (no session, or the refresh token was rejected). Network errors are rethrown and the
  /// session is kept, so opening the app offline never signs the user out.
  Future<bool> ensureFresh() async {
    final s = _session;
    if (s == null) return false;
    if (_now() < s.expiresAt - 60000) return true;
    try {
      await _keep(await _api.call('/auth/v1/token?grant_type=refresh_token', method: 'POST', auth: false, body: {'refresh_token': s.refreshToken}));
      return true;
    } on ApiException catch (e) {
      if (e.status == 400 || e.status == 401) {
        await _set(null);
        return false;
      }
      rethrow;
    }
  }

  /// Drops the session without calling the server (the server already rejected the token).
  Future<void> expire() => _set(null);
}
