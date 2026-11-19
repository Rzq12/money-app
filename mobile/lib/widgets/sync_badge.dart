import 'package:material_ui/material_ui.dart';

import '../i18n.dart';
import '../sync/sync.dart';

/// Sync state in a few words, as SyncBadge in src/More.jsx.
String syncLabel(SyncStatus s, String lang) {
  final unsent = tr(lang, 'unsent').replaceAll('{n}', '${s.pending}');
  return switch (s.phase) {
    SyncPhase.off => tr(lang, 'notConnected'),
    SyncPhase.idle => s.pending > 0 ? unsent : tr(lang, 'synced'),
    SyncPhase.syncing => tr(lang, 'syncing'),
    SyncPhase.offline => s.pending > 0 ? '${tr(lang, 'offline')} · $unsent' : tr(lang, 'offline'),
    SyncPhase.error => tr(lang, 'syncFailed'),
  };
}

class SyncBadge extends StatelessWidget {
  const SyncBadge({super.key, required this.engine, required this.lang});
  final SyncEngine engine;
  final String lang;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: engine,
        builder: (context, _) {
          final s = engine.status;
          final text = Text(syncLabel(s, lang), style: Theme.of(context).textTheme.labelMedium);
          return s.phase == SyncPhase.error && s.error.isNotEmpty ? Tooltip(message: s.error, child: text) : text;
        },
      );
}
