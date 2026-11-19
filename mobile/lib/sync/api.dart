// Plain REST client for Supabase (GoTrue auth + PostgREST), as src/sync.js uses fetch. No SDK.
import 'dart:convert';

import 'package:http/http.dart' as http;

class ApiException implements Exception {
  ApiException(this.status, this.message, [this.code]);
  final int status;
  final String message;
  final String? code;

  @override
  String toString() => 'ApiException($status${code == null ? '' : ', $code'}): $message';
}

class Api {
  Api(this._client, {required String baseUrl, required this.anonKey, required this.token, this.timeout = const Duration(seconds: 30)})
      : baseUrl = baseUrl.replaceAll(RegExp(r'/+$'), '');

  final http.Client _client;
  final String baseUrl;
  final String anonKey;

  /// Current access token, sent as the bearer on authorized calls.
  final String? Function() token;

  /// Longest wait for a response; a stalled connection otherwise blocks sync until restart.
  final Duration timeout;

  /// Sends one request and returns the decoded JSON body (null when empty, the raw text when the
  /// body is not JSON). Throws [ApiException] on a non-2xx status and [TimeoutException] when the
  /// server does not answer within [timeout]; network errors pass through.
  Future<Object?> call(String path, {String method = 'GET', Object? body, bool auth = true, Map<String, String> headers = const {}}) async {
    final h = {'apikey': anonKey, 'Content-Type': 'application/json', ...headers};
    final tok = auth ? token() : null;
    if (tok != null) h['Authorization'] = 'Bearer $tok';
    final req = http.Request(method, Uri.parse(baseUrl + path))..headers.addAll(h);
    if (body != null) req.body = jsonEncode(body);
    final res = await http.Response.fromStream(await _client.send(req).timeout(timeout)).timeout(timeout);
    final text = utf8.decode(res.bodyBytes);
    Object? data;
    try {
      data = text.isEmpty ? null : jsonDecode(text);
    } on FormatException {
      data = text;
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      final m = data is Map ? data : const {};
      final msg = m['msg'] ?? m['error_description'] ?? m['message'] ?? m['error'] ?? 'HTTP ${res.statusCode}';
      throw ApiException(res.statusCode, '$msg', (m['error_code'] ?? m['code'])?.toString());
    }
    return data;
  }
}
