# Kasku+ (Flutter)

Aplikasi Android dan iOS Kasku+ dalam Flutter. Datanya sama dengan versi web (tabel Supabase yang sama). Rencana migrasinya ada di [docs/superpowers/plans/2026-11-19-flutter-mobile-migration.md](../docs/superpowers/plans/2026-11-19-flutter-mobile-migration.md).

## Persiapan

1. Pasang [Flutter](https://docs.flutter.dev/get-started/install) versi stable.
2. Salin `env/example.json` menjadi `env/dev.json` (DB dev) dan, nanti, `env/prod.json` (DB prod). Isi `SUPABASE_URL` dan `SUPABASE_ANON_KEY`. Kedua file ini tidak ikut di-commit.

## Perintah

Jalankan dari folder `mobile/`:

| Perintah | Fungsi |
| --- | --- |
| `flutter test` | Semua test |
| `flutter analyze` | Cek kode |
| `flutter run --dart-define-from-file=env/dev.json` | Jalankan di emulator/HP dengan DB dev |
| `flutter build apk --dart-define-from-file=env/prod.json` | Build APK dengan DB prod |

## Isi folder

- `lib/data/`: penyimpanan lokal (`store.dart`), file di perangkat (`disk.dart`), data awal, format uang
- `lib/sync/`: REST ke Supabase (`api.dart`), login (`session.dart`), pemetaan tabel (`kinds.dart`), sinkron dua arah (`sync.dart`)
- `lib/screens/`, `lib/widgets/`: tampilan
- `test/sync/fake_postgrest.dart`: server Supabase tiruan untuk test sinkron
