// Starter data, accents and currencies, identical to src/store.js and src/icons.js (DEFAULT_ICONS)
// so the web app and the phone share the same built-in records.

typedef Rec = Map<String, Object?>;

/// Accent choices; Kasku's own pink first.
const accents = ['#f06292', '#0070f3', '#7928ca', '#ff4d4d', '#f5a623', '#29bc9b', '#171717'];

const currencies = ['IDR', 'USD', 'EUR', 'SGD', 'MYR', 'JPY', 'GBP', 'AUD', 'CNY', 'KRW', 'THB', 'VND', 'PHP', 'INR', 'SAR'];

const defaultSettings = <String, Object?>{
  'lang': 'id',
  'theme': '#f06292',
  'themeV': 2,
  'dark': false,
  'currency': 'IDR',
  'bookId': 'book-default',
  'lastAccountId': 'acc-cash',
};

const _catIcons = {
  'cat-food': 'food', 'cat-daily': 'toiletries', 'cat-traffic': 'bus', 'cat-social': 'cheers', 'cat-home': 'house',
  'cat-gift': 'gift', 'cat-phone': 'phone', 'cat-dress': 'shirt', 'cat-fun': 'game', 'cat-beauty': 'lipstick',
  'cat-medical': 'pill', 'cat-tax': 'tax', 'cat-edu': 'book', 'cat-baby': 'bottle', 'cat-pet': 'cat',
  'cat-travel': 'plane', 'cat-wage': 'moneybag', 'cat-bonus': 'medal', 'cat-invest': 'chartUp',
  'cat-parttime': 'briefcase', 'cat-other-in': 'coins',
};

/// Default icon per wallet type (DEFAULT_ICONS.walletTypes).
const walletTypeIcons = {
  'cash': 'cash', 'debit': 'card', 'credit': 'card', 'ewallet': 'ewallet', 'invest': 'chartUp',
  'receivable': 'handCoin', 'payable': 'invoice', 'other': 'bank',
};

Rec _cat(String id, String type, String color, String idName, String enName, int order) => {
      'id': id, 'kind': 'category', 'type': type, 'icon': _catIcons[id], 'color': color,
      'names': {'id': idName, 'en': enName}, 'order': order, 'updatedAt': 0,
    };

Rec _named(String id, String kind, String idName, String enName, String icon, int order, [Rec extra = const {}]) => {
      'id': id, 'kind': kind, 'names': {'id': idName, 'en': enName}, 'icon': icon, 'order': order, 'updatedAt': 0, ...extra,
    };

/// Fixed ids so fresh installs on two devices share the same starter data.
Map<String, Rec> defaultRecords() {
  final r = <Rec>[
    _named('book-default', 'book', 'Buku harian', 'Daily ledger', 'notebook', 0),
    _named('acc-cash', 'account', 'Tunai', 'Cash', 'cash', 0, {'type': 'cash', 'color': '#29bc9b', 'currency': 'IDR', 'initBalance': 0}),
    _named('acc-bank', 'account', 'Kartu debit', 'Debit card', 'card', 1, {'type': 'debit', 'color': '#0070f3', 'currency': 'IDR', 'initBalance': 0}),
    _named('acc-ewallet', 'account', 'Dompet digital', 'E-wallet', 'ewallet', 2, {'type': 'ewallet', 'color': '#7928ca', 'currency': 'IDR', 'initBalance': 0}),
    _named('mem-me', 'member', 'Diri sendiri', 'Myself', 'person', 0),
    _named('mem-partner', 'member', 'Pasangan', 'Partner', 'heart', 1),
    _named('mem-child', 'member', 'Anak', 'Child', 'child', 2),
    _named('mem-parent', 'member', 'Orang tua', 'Parent', 'elder', 3),
    _cat('cat-food', 'expense', '#f5a623', 'Makan', 'Food', 0),
    _cat('cat-daily', 'expense', '#00dfd8', 'Harian', 'Daily', 1),
    _cat('cat-traffic', 'expense', '#29bc9b', 'Transportasi', 'Transport', 2),
    _cat('cat-social', 'expense', '#7928ca', 'Sosial', 'Social', 3),
    _cat('cat-home', 'expense', '#ab570a', 'Rumah', 'Housing', 4),
    _cat('cat-gift', 'expense', '#ff0080', 'Hadiah', 'Gift', 5),
    _cat('cat-phone', 'expense', '#0070f3', 'Komunikasi', 'Phone', 6),
    _cat('cat-dress', 'expense', '#ff4d4d', 'Pakaian', 'Clothes', 7),
    _cat('cat-fun', 'expense', '#eb367f', 'Rekreasi', 'Fun', 8),
    _cat('cat-beauty', 'expense', '#4c2889', 'Kecantikan', 'Beauty', 9),
    _cat('cat-medical', 'expense', '#c50000', 'Medis', 'Medical', 10),
    _cat('cat-tax', 'expense', '#a1a1a1', 'Pajak', 'Tax', 11),
    _cat('cat-edu', 'expense', '#50e3c2', 'Pendidikan', 'Education', 12),
    _cat('cat-baby', 'expense', '#f9cb28', 'Bayi', 'Baby', 13),
    _cat('cat-pet', 'expense', '#888888', 'Peliharaan', 'Pet', 14),
    _cat('cat-travel', 'expense', '#0761d1', 'Bepergian', 'Travel', 15),
    _cat('cat-wage', 'income', '#f5a623', 'Gaji', 'Salary', 0),
    _cat('cat-bonus', 'income', '#7928ca', 'Bonus', 'Bonus', 1),
    _cat('cat-invest', 'income', '#29bc9b', 'Investasi', 'Investment', 2),
    _cat('cat-parttime', 'income', '#0070f3', 'Kerja sampingan', 'Side job', 3),
    _cat('cat-other-in', 'income', '#888888', 'Lainnya', 'Other', 4),
  ];
  return {for (final x in r) x['id']! as String: x};
}
