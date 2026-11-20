import 'dart:async';

import 'package:material_ui/material_ui.dart';

import 'data/store.dart';
import 'i18n.dart';
import 'screens/auth_screen.dart';
import 'screens/ledger_screen.dart';
import 'sync/session.dart';
import 'sync/sync.dart';

/// Root widget: the sign-in screen without a session, the ledger with one. Storage problems
/// (a save refused because the device is full, a damaged file set aside at start-up) are
/// reported here, so the notice appears whichever screen is open.
class KaskuApp extends StatefulWidget {
  const KaskuApp({super.key, required this.store, required this.auth, required this.engine});
  final RecordStore store;
  final Auth auth;
  final SyncEngine engine;

  @override
  State<KaskuApp> createState() => _KaskuAppState();
}

class _KaskuAppState extends State<KaskuApp> {
  static const _ink = Color(0xff171717);
  final _messenger = GlobalKey<ScaffoldMessengerState>();
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
    final lang = '${widget.store.settings['lang'] ?? 'id'}';
    _messenger.currentState?.showSnackBar(SnackBar(content: Text(tr(lang, key))));
  }

  @override
  void dispose() {
    _errors?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: Listenable.merge([widget.auth, widget.store]),
        builder: (context, _) {
          final lang = '${widget.store.settings['lang'] ?? 'id'}';
          final dark = widget.store.settings['dark'] == true;
          // Placeholder theme until the design system lands (Phase 2).
          final scheme = ColorScheme.fromSeed(seedColor: _ink, brightness: dark ? Brightness.dark : Brightness.light);
          return MaterialApp(
            title: 'Kasku+',
            debugShowCheckedModeBanner: false,
            scaffoldMessengerKey: _messenger,
            locale: Locale(lang),
            theme: ThemeData(colorScheme: scheme, scaffoldBackgroundColor: dark ? Colors.black : const Color(0xfffafafa)),
            home: widget.auth.session == null
                ? AuthScreen(auth: widget.auth, engine: widget.engine, lang: lang)
                : LedgerScreen(store: widget.store, engine: widget.engine),
          );
        },
      );
}
