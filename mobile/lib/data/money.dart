import 'package:intl/intl.dart';

String _locale(String lang) => lang == 'id' ? 'id_ID' : 'en_US';

/// Currency with 0 to 2 decimals, matching formatMoney in src/store.js (Intl.NumberFormat):
/// "Rp 1.234,5" in Indonesian, "$1,234.5" in English, minus sign before the symbol.
String formatMoney(num value, String currency, String lang) {
  final loc = _locale(lang);
  final v = value.isFinite ? value : 0;
  final symbol = NumberFormat.simpleCurrency(locale: loc, name: currency).currencySymbol;
  final digits = NumberFormat('#,##0.##', loc).format(v.abs());
  // id-ID puts a no-break space after the symbol; en-US only after a letter code such as "IDR".
  final gap = lang == 'id' || RegExp(r'[A-Za-z]$').hasMatch(symbol) ? ' ' : '';
  final negative = v < 0 && digits.replaceAll(RegExp(r'[^1-9]'), '').isNotEmpty;
  return '${negative ? '-' : ''}$symbol$gap$digits';
}
