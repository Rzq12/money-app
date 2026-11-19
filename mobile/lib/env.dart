/// Supabase project the app talks to, set at build time:
/// `flutter run --dart-define-from-file=env/dev.json` (dev DB) or `env/prod.json` (prod DB).
/// The anon key is public by design; row level security protects the data.
class Env {
  static const String supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const String supabaseKey = String.fromEnvironment('SUPABASE_ANON_KEY');

  static String get baseUrl => baseUrlOf(supabaseUrl);
  static bool get configured => isConfigured(supabaseUrl, supabaseKey);

  static String baseUrlOf(String raw) => raw.replaceAll(RegExp(r'/+$'), '');
  static bool isConfigured(String url, String key) => url.isNotEmpty && key.isNotEmpty;
}
