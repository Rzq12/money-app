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

## Rilis APK lewat GitHub Releases

Setiap tag versi yang di-push otomatis menjadi rilis berisi APK yang siap diunduh dan dipasang:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Workflow `.github/workflows/release.yml` lalu membangun APK bertanda tangan dan membuat rilis **Kasku+ 1.0.0** berisi `kasku-plus-1.0.0.apk`, plus file `.sha256`. Unduh dari halaman **Releases** di GitHub; di HP, izinkan *Instal aplikasi tidak dikenal* untuk browser/file manager saat pertama kali memasang.

- Versi diambil dari tag: `v1.2.3` → versi `1.2.3`, versionCode `10203`. Tag baru harus lebih tinggi dari sebelumnya, dan minor/patch di bawah 100.
- Secret yang dibutuhkan di repo (*Settings > Secrets and variables > Actions*): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (DB yang dipakai APK rilis), `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
- **Kunci tanda tangan (keystore) tidak boleh hilang atau diganti.** Android hanya mau memasang pembaruan yang ditandatangani kunci yang sama; tanpa kunci lama, pengguna harus menghapus app (dan data lokalnya) dulu. Simpan file keystore dan kata sandinya di tempat aman di luar repo.

## Rilis ke toko aplikasi

- **Android**: di Android Studio, *Build > Generate Signed App Bundle / APK* dengan keystore yang sama, lalu unggah `.aab` ke Google Play Console.
- **iOS**: di Xcode, pilih Team di *Signing & Capabilities*, lalu *Product > Archive* dan unggah ke App Store Connect. (iOS tidak bisa dipasang dari file seperti APK.)

## CI

`.github/workflows/mobile.yml` membangun APK debug (bisa diunduh dari tab Actions) dan memastikan proyek iOS ter-compile. Isi secret `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` di pengaturan repo GitHub.

## Yang berbeda dari versi web

- Ekspor CSV/backup membuka lembar *Share* (simpan ke Files/Drive, kirim ke WhatsApp, dll.), karena WebView tidak bisa mengunduh langsung.
- Tombol back Android menutup dialog yang terbuka, lalu kembali ke halaman sebelumnya, lalu meminimalkan app.
- Warna status bar mengikuti mode terang/gelap di Pengaturan.
- Service worker (offline cache) tidak dipakai; semua file sudah ada di dalam app.
