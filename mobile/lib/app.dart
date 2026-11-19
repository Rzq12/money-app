import 'package:material_ui/material_ui.dart';

import 'data/store.dart';
import 'screens/auth_screen.dart';
import 'screens/ledger_screen.dart';
import 'sync/session.dart';
import 'sync/sync.dart';

/// Root widget: the sign-in screen without a session, the ledger with one.
class KaskuApp extends StatelessWidget {
  const KaskuApp({super.key, required this.store, required this.auth, required this.engine});
  final RecordStore store;
  final Auth auth;
  final SyncEngine engine;

  static const _ink = Color(0xff171717);

  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: Listenable.merge([auth, store]),
        builder: (context, _) {
          final lang = '${store.settings['lang'] ?? 'id'}';
          final dark = store.settings['dark'] == true;
          // Placeholder theme until the design system lands (Phase 2).
          final scheme = ColorScheme.fromSeed(seedColor: _ink, brightness: dark ? Brightness.dark : Brightness.light);
          return MaterialApp(
            title: 'Kasku+',
            debugShowCheckedModeBanner: false,
            locale: Locale(lang),
            theme: ThemeData(colorScheme: scheme, scaffoldBackgroundColor: dark ? Colors.black : const Color(0xfffafafa)),
            home: auth.session == null
                ? AuthScreen(auth: auth, engine: engine, lang: lang)
                : LedgerScreen(store: store, engine: engine),
          );
        },
      );
}
