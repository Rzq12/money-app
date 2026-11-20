import 'dart:async';

import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';

import '../data/money.dart';
import '../data/store.dart';
import '../i18n.dart';
import '../sync/sync.dart';
import '../widgets/sync_badge.dart';

/// Read-only list of the current book's transactions, newest first, grouped by day.
/// The full Ledger (period navigation, editing, record button) arrives in Phase 3.
class LedgerScreen extends StatefulWidget {
  const LedgerScreen({super.key, required this.store, required this.engine});
  final RecordStore store;
  final SyncEngine engine;

  @override
  State<LedgerScreen> createState() => _LedgerScreenState();
}

class _LedgerScreenState extends State<LedgerScreen> {
  StreamSubscription<Object>? _errors;

  @override
  void initState() {
    super.initState();
    final store = widget.store;
    _errors = store.errors.listen((_) => _notify('storageFull'));
    if (store.loadErrors.isNotEmpty) {
      store.loadErrors.clear();
      WidgetsBinding.instance.addPostFrameCallback((_) => _notify('storageRecovered'));
    }
  }

  void _notify(String key) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr('${widget.store.settings['lang']}', key))));
  }

  @override
  void dispose() {
    _errors?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: widget.store,
        builder: (context, _) {
          final records = widget.store.records;
          final settings = widget.store.settings;
          final lang = '${settings['lang']}';
          final bookId = settings['bookId'] ?? 'book-default';
          final bills = live(records, 'bill').where((b) => (b['bookId'] ?? 'book-default') == bookId).toList()
            ..sort((a, b) => ((b['time'] as num?) ?? 0).compareTo((a['time'] as num?) ?? 0));
          final theme = Theme.of(context);
          return Scaffold(
            body: SafeArea(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                    child: Row(children: [
                      Expanded(child: Text(tr(lang, 'ledger'), style: theme.textTheme.headlineSmall)),
                      SyncBadge(engine: widget.engine, lang: lang),
                    ]),
                  ),
                  Expanded(
                    child: bills.isEmpty
                        ? _Empty(lang: lang)
                        : ListView(padding: const EdgeInsets.only(bottom: 24), children: _rows(bills, records, settings, lang, theme)),
                  ),
                ],
              ),
            ),
          );
        },
      );

  List<Widget> _rows(List<Rec> bills, Map<String, Rec> records, Map<String, Object?> settings, String lang, ThemeData theme) {
    final dayFmt = DateFormat('EEEE, d MMMM yyyy', lang == 'id' ? 'id_ID' : 'en_US');
    final out = <Widget>[];
    String? lastDay;
    for (final b in bills) {
      final time = DateTime.fromMillisecondsSinceEpoch(((b['time'] as num?) ?? 0).toInt());
      final day = dayFmt.format(time);
      if (day != lastDay) {
        lastDay = day;
        out.add(Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
          child: Text(day, style: theme.textTheme.labelLarge?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
        ));
      }
      out.add(_BillRow(bill: b, records: records, lang: lang, base: '${settings['currency'] ?? 'IDR'}'));
    }
    return out;
  }
}

class _BillRow extends StatelessWidget {
  const _BillRow({required this.bill, required this.records, required this.lang, required this.base});
  final Rec bill;
  final Map<String, Rec> records;
  final String lang, base;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final type = bill['type'];
    final account = records[bill['accountId']];
    final category = records[bill['categoryId']];
    final title = type == 'transfer' ? '${nameOf(account, lang)} → ${nameOf(records[bill['toAccountId']], lang)}' : nameOf(category, lang);
    final note = '${bill['note'] ?? ''}'.trim();
    final currency = (account?['currency'] as String?) ?? base;
    final amount = formatMoney((bill['amount'] as num?) ?? 0, currency, lang);
    final color = _hex(category?['color'] as String?) ?? theme.colorScheme.outline;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(children: [
        // Drawn category icons come with the design system (Phase 2); a colour dot stands in for now.
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(color: color.withValues(alpha: 0.16), shape: BoxShape.circle),
          alignment: Alignment.center,
          child: Container(width: 12, height: 12, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: theme.textTheme.bodyLarge, overflow: TextOverflow.ellipsis),
            if (note.isNotEmpty) Text(note, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant), overflow: TextOverflow.ellipsis),
          ]),
        ),
        const SizedBox(width: 12),
        Text(type == 'income' ? '+$amount' : amount, style: theme.textTheme.bodyLarge?.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
      ]),
    );
  }
}

Color? _hex(String? s) {
  if (s == null || !RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(s)) return null;
  return Color(0xff000000 | int.parse(s.substring(1), radix: 16));
}

class _Empty extends StatelessWidget {
  const _Empty({required this.lang});
  final String lang;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(tr(lang, 'noBill'), style: theme.textTheme.titleMedium, textAlign: TextAlign.center),
          const SizedBox(height: 8),
          Text(tr(lang, 'addFirst'), style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant), textAlign: TextAlign.center),
        ]),
      ),
    );
  }
}
