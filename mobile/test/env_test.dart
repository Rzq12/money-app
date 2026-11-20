import 'package:flutter_test/flutter_test.dart';
import 'package:kasku_plus/env.dart';

void main() {
  test('baseUrlOf strips trailing slashes', () {
    expect(Env.baseUrlOf('https://x.supabase.co//'), 'https://x.supabase.co');
  });
  test('isConfigured needs both url and key', () {
    expect(Env.isConfigured('', 'k'), isFalse);
    expect(Env.isConfigured('u', ''), isFalse);
    expect(Env.isConfigured('u', 'k'), isTrue);
  });
}
