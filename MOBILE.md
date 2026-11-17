# Aplikasi Android & iOS

Kasku+ versi HP memakai [Capacitor](https://capacitorjs.com): kode React yang sama dibungkus jadi aplikasi native di `android/` dan `ios/`.

## Persiapan

1. Salin `.env.example` menjadi `.env.development` (DB dev) dan, nanti, `.env.production` (DB prod). Isi `VITE_SUPABASE_URL` serta `VITE_SUPABASE_ANON_KEY`; nilainya ikut dibundel saat build.
2. Android: pasang [Android Studio](https://developer.android.com/studio) (sudah termasuk JDK 21 dan Android SDK).
3. iOS: butuh Mac dengan Xcode 16+.

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `npm run mobile:sync:dev` | Build dengan DB dev lalu salin ke proyek Android & iOS (untuk test) |
| `npm run android:dev` / `npm run ios:dev` | Sync versi DB dev lalu buka di Android Studio / Xcode |
| `npm run mobile:sync` | Build dengan DB prod lalu salin ke proyek Android & iOS |
| `npm run android` | Sync lalu buka di Android Studio |
| `npm run android:run` | Sync lalu jalankan di HP/emulator yang terhubung |
| `npm run ios` | Sync lalu buka di Xcode (Mac) |
| `npm run ios:run` | Sync lalu jalankan di simulator/iPhone (Mac) |
| `npm run mobile:assets` | Buat ulang ikon & splash dari `resources/` |

Ikon sumber di `resources/` dibuat oleh `scripts/icons.mjs` (jalan otomatis saat `npm run build`).

## Rilis

- **Android**: di Android Studio, *Build > Generate Signed App Bundle / APK*, lalu unggah `.aab` ke Google Play Console.
- **iOS**: di Xcode, pilih Team di *Signing & Capabilities*, lalu *Product > Archive* dan unggah ke App Store Connect.
- Naikkan versi di `android/app/build.gradle` (`versionCode`, `versionName`) dan di Xcode (*Version*, *Build*) setiap rilis.

## CI

`.github/workflows/mobile.yml` membangun APK debug (bisa diunduh dari tab Actions) dan memastikan proyek iOS ter-compile. Isi secret `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` di pengaturan repo GitHub.

## Yang berbeda dari versi web

- Ekspor CSV/backup membuka lembar *Share* (simpan ke Files/Drive, kirim ke WhatsApp, dll.), karena WebView tidak bisa mengunduh langsung.
- Tombol back Android menutup dialog yang terbuka, lalu kembali ke halaman sebelumnya, lalu meminimalkan app.
- Warna status bar mengikuti mode terang/gelap di Pengaturan.
- Service worker (offline cache) tidak dipakai; semua file sudah ada di dalam app.
