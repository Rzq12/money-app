import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:kasku_plus/sync/api.dart';
import 'package:kasku_plus/sync/session.dart';

const tokenBody = '{"access_token":"a","refresh_token":"r","expires_in":3600,"user":{"id":"u1","email":"e"}}';

http.Response json(int status, String body) => http.Response(body, status, headers: {'content-type': 'application/json'});

Session expired() => Session(accessToken: 'old', refreshToken: 'r0', expiresAt: 1000, userId: 'u1', email: 'e');

({Auth auth, MemorySessionStore store, List<http.Request> sent}) setup(Future<http.Response> Function(http.Request) handler, {Session? session}) {
  final sent = <http.Request>[];
  final store = MemorySessionStore(session);
  late Auth auth;
  final api = Api(MockClient((r) {
    sent.add(r);
    return handler(r);
  }), baseUrl: 'https://x.supabase.co', anonKey: 'anon', token: () => auth.session?.accessToken);
  auth = Auth(api, store, now: () => 10_000_000);
  return (auth: auth, store: store, sent: sent);
}

void main() {
  test('signIn stores the session', () async {
    final s = setup((r) async => json(200, tokenBody));
    await s.auth.signIn('e', 'p');
    expect(s.store.saved?.userId, 'u1');
    expect(s.auth.session?.expiresAt, 10_000_000 + 3600 * 1000);
    final req = s.sent.single;
    expect(req.url.toString(), 'https://x.supabase.co/auth/v1/token?grant_type=password');
    expect(req.headers['apikey'], 'anon');
    expect(req.headers.containsKey('Authorization'), isFalse);
    expect(jsonDecode(req.body), {'email': 'e', 'password': 'p'});
  });

  test('signUp without access_token means confirm', () async {
    final s = setup((r) async => json(200, '{"id":"u1","email":"e"}'));
    expect(await s.auth.signUp('e', 'p'), isNull);
    expect(s.auth.session, isNull);
  });

  test('error message comes from msg', () async {
    final s = setup((r) async => json(400, '{"msg":"Invalid login credentials","error_code":"invalid_credentials"}'));
    await expectLater(
      s.auth.signIn('e', 'bad'),
      throwsA(isA<ApiException>().having((e) => e.status, 'status', 400).having((e) => e.code, 'code', 'invalid_credentials').having((e) => e.message, 'message', 'Invalid login credentials')),
    );
  });

  test('authorized calls send the bearer token', () async {
    final s = setup((r) async => json(200, '[]'), session: Session(accessToken: 'tok', refreshToken: 'r', expiresAt: 99_000_000, userId: 'u1'));
    await s.auth.load();
    final api = Api(MockClient((r) async {
      s.sent.add(r);
      return json(200, '[]');
    }), baseUrl: 'https://x.supabase.co/', anonKey: 'anon', token: () => s.auth.session?.accessToken);
    expect(await api.call('/rest/v1/books?select=*'), isEmpty);
    expect(s.sent.last.headers['Authorization'], 'Bearer tok');
    expect(s.sent.last.url.toString(), 'https://x.supabase.co/rest/v1/books?select=*');
  });

  test('fresh token is not refreshed', () async {
    final s = setup((r) async => json(500, '{}'), session: Session(accessToken: 'a', refreshToken: 'r', expiresAt: 10_000_000 + 120_000, userId: 'u1'));
    await s.auth.load();
    expect(await s.auth.ensureFresh(), isTrue);
    expect(s.sent, isEmpty);
  });

  test('token within a minute of expiry is refreshed', () async {
    final s = setup((r) async => json(200, tokenBody), session: expired());
    await s.auth.load();
    expect(await s.auth.ensureFresh(), isTrue);
    expect(s.sent.single.url.query, 'grant_type=refresh_token');
    expect(jsonDecode(s.sent.single.body), {'refresh_token': 'r0'});
    expect(s.store.saved?.accessToken, 'a');
  });

  test('offline refresh keeps the session', () async {
    final s = setup((r) async => throw const SocketException('offline'), session: expired());
    await s.auth.load();
    await expectLater(s.auth.ensureFresh(), throwsA(isA<SocketException>()));
    expect(s.auth.session?.accessToken, 'old');
    expect(s.store.saved?.accessToken, 'old');
  });

  test('refresh 400 signs out', () async {
    final s = setup((r) async => json(400, '{"error":"invalid_grant"}'), session: expired());
    await s.auth.load();
    expect(await s.auth.ensureFresh(), isFalse);
    expect(s.auth.session, isNull);
    expect(s.store.saved, isNull);
  });

  test('a request that never answers times out', () async {
    final api = Api(MockClient((r) => Completer<http.Response>().future), baseUrl: 'https://x.supabase.co', anonKey: 'anon', token: () => null, timeout: const Duration(milliseconds: 50));
    await expectLater(api.call('/rest/v1/books'), throwsA(isA<TimeoutException>()));
  });

  test('an unreadable keystore means signed out, not a crash', () async {
    final storage = _ThrowingStorage();
    final store = SecureSessionStore(storage: storage);
    expect(await store.load(), isNull);
    expect(storage.deleted, isTrue);
  });

  test('signOut clears the session even when logout fails', () async {
    final s = setup((r) async => throw const SocketException('offline'), session: expired());
    await s.auth.load();
    await s.auth.signOut();
    expect(s.auth.session, isNull);
    expect(s.store.saved, isNull);
  });
}

/// Keystore that fails to decrypt, as after an Android backup/restore or reinstall.
class _ThrowingStorage extends FlutterSecureStorage {
  bool deleted = false;

  @override
  Future<String?> read({
    required String key,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) async =>
      throw PlatformException(code: 'Exception', message: 'BAD_DECRYPT');

  @override
  Future<void> delete({
    required String key,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) async =>
      deleted = true;
}
