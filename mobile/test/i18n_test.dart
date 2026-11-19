import 'package:flutter_test/flutter_test.dart';
import 'package:kasku_plus/data/money.dart';
import 'package:kasku_plus/i18n.dart';

String nb(String s) => s.replaceAll(' ', ' ');

void main() {
  test('id and en have the same keys', () {
    expect(dict['id']!.keys.toSet(), dict['en']!.keys.toSet());
  });

  test('tr falls back to Indonesian for an unknown language', () {
    expect(tr('fr', 'signIn'), 'Masuk');
    expect(tr('en', 'signIn'), 'Sign in');
  });

  // Same expectations as tests/money.test.js > formatMoney.
  test('formatMoney: min 0, max 2 decimals', () {
    expect(nb(formatMoney(1234.5, 'IDR', 'id')), 'Rp 1.234,5');
    expect(nb(formatMoney(1234.567, 'IDR', 'id')), 'Rp 1.234,57');
    expect(nb(formatMoney(25000, 'IDR', 'id')), 'Rp 25.000');
    expect(formatMoney(1234.5, 'USD', 'en'), r'$1,234.5');
  });

  test('formatMoney: zero, negative, huge, float noise', () {
    expect(nb(formatMoney(0, 'IDR', 'id')), 'Rp 0');
    expect(nb(formatMoney(-5000, 'IDR', 'id')), '-Rp 5.000');
    expect(nb(formatMoney(1e15, 'IDR', 'id')), 'Rp 1.000.000.000.000.000');
    expect(nb(formatMoney(0.1 + 0.2, 'IDR', 'id')), 'Rp 0,3');
  });
}
