import 'dart:async';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:material_ui/material_ui.dart';

import '../data/store.dart' show StorageFullException;
import '../i18n.dart';
import '../sync/api.dart';
import '../sync/session.dart';
import '../sync/sync.dart';

enum _Mode { signIn, signUp, reset }

/// Sign in, sign up or reset the password, as AuthScreen in src/More.jsx.
class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key, required this.auth, required this.engine, required this.lang});
  final Auth auth;
  final SyncEngine engine;
  final String lang;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  _Mode _mode = _Mode.signIn;
  bool _busy = false;
  String? _error;
  String? _ok;

  String t(String key) => tr(widget.lang, key);

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  String _explain(ApiException e) {
    final m = '${e.message} ${e.code ?? ''}';
    if (RegExp('invalid login|invalid_credentials', caseSensitive: false).hasMatch(m)) return t('authBad');
    if (RegExp('not confirmed', caseSensitive: false).hasMatch(m)) return t('authUnconfirmed');
    if (RegExp('already registered|already exists', caseSensitive: false).hasMatch(m)) return t('authExists');
    if (e.status == 429) return t('authTooMany');
    return e.message;
  }

  Future<void> _submit() async {
    setState(() {
      _error = null;
      _ok = null;
    });
    if (!widget.engine.configured) return setState(() => _error = t('notConfigured'));
    final email = _email.text.trim();
    final pw = _password.text;
    if (_mode != _Mode.reset && pw.length < 8) return setState(() => _error = t('authShort'));
    setState(() => _busy = true);
    try {
      switch (_mode) {
        case _Mode.signIn:
          await widget.engine.afterSignIn(await widget.auth.signIn(email, pw));
        case _Mode.signUp:
          final s = await widget.auth.signUp(email, pw);
          if (s == null) {
            _ok = t('authCheckMail');
            _mode = _Mode.signIn;
          } else {
            await widget.engine.afterSignIn(s);
          }
        case _Mode.reset:
          await widget.auth.recover(email);
          _ok = t('authResetSent');
          _mode = _Mode.signIn;
      }
    } on StorageFullException {
      _error = t('storageFull');
    } on ApiException catch (e) {
      _error = _explain(e);
    } on SocketException {
      _error = t('authOffline');
    } on http.ClientException {
      _error = t('authOffline');
    } on TimeoutException {
      _error = t('authOffline');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final title = switch (_mode) { _Mode.signIn => t('signInTitle'), _Mode.signUp => t('signUpTitle'), _Mode.reset => t('resetTitle') };
    final action = switch (_mode) { _Mode.signIn => t('signIn'), _Mode.signUp => t('signUp'), _Mode.reset => t('resetSend') };
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: AutofillGroup(
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Text(title, style: theme.textTheme.headlineSmall),
                  const SizedBox(height: 8),
                  Text(_mode == _Mode.reset ? t('resetIntro') : t('authIntro'), style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                  const SizedBox(height: 24),
                  TextField(
                    key: const Key('email'),
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    autofillHints: const [AutofillHints.email],
                    autocorrect: false,
                    decoration: InputDecoration(labelText: t('email'), border: const OutlineInputBorder()),
                  ),
                  if (_mode != _Mode.reset) ...[
                    const SizedBox(height: 12),
                    TextField(
                      key: const Key('password'),
                      controller: _password,
                      obscureText: true,
                      autofillHints: [_mode == _Mode.signUp ? AutofillHints.newPassword : AutofillHints.password],
                      decoration: InputDecoration(labelText: t('password'), border: const OutlineInputBorder()),
                      onSubmitted: (_) => _submit(),
                    ),
                  ],
                  if (_error != null || _ok != null) ...[
                    const SizedBox(height: 12),
                    Semantics(
                      liveRegion: true,
                      child: Text(_error ?? _ok!, style: theme.textTheme.bodyMedium?.copyWith(color: _error != null ? theme.colorScheme.error : theme.colorScheme.primary)),
                    ),
                  ],
                  const SizedBox(height: 20),
                  FilledButton(key: const Key('submit'), onPressed: _busy ? null : _submit, child: Text(action)),
                  const SizedBox(height: 8),
                  if (_mode == _Mode.signIn) TextButton(onPressed: () => setState(() => _mode = _Mode.reset), child: Text(t('forgot'))),
                  TextButton(
                    onPressed: () => setState(() => _mode = _mode == _Mode.signUp ? _Mode.signIn : _Mode.signUp),
                    child: Text(_mode == _Mode.signUp ? t('haveAccount') : t('noAccount')),
                  ),
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
