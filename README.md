# Kasku+

Aplikasi catatan keuangan pribadi: pemasukan, pengeluaran, dompet/rekening, analisis, dan portofolio. Berjalan sebagai web app (PWA) dan aplikasi Android/iOS, dengan data yang disinkronkan lewat Supabase.

## Fitur

- **Catatan transaksi** dengan kategori, dompet, dan ringkasan harian/mingguan/bulanan
- **Dompet**: rekening bank dan e-wallet Indonesia (BCA, Mandiri, GoPay, OVO, DANA, dll.)
- **Analisis** pengeluaran per periode dan kategori
- **Impor** dari CSV/XLSX atau teks notifikasi bank, pembersihan duplikat, dan backup
- **Alat**: portofolio dengan harga live (Yahoo Finance), patungan (split bill), pencatat via chat, dan kalkulator
- **AI opsional** untuk membaca teks/struk menjadi transaksi; setiap fitur tetap jalan tanpa AI
- **Sinkron dua arah** ke Supabase, tetap bisa dipakai offline
- Bahasa Indonesia dan Inggris, mode terang/gelap

## Teknologi

| Bagian | Stack |
| --- | --- |
| Web | React 18, Vite 5, Vitest |
| Mobile (sekarang) | Capacitor 8, membungkus kode web jadi app Android & iOS |
| Mobile (migrasi) | Flutter, di folder [`mobile/`](mobile/README.md) |
| Backend | Supabase: Postgres, Auth, Edge Functions (`ai`, `quotes`) |

## Mulai

Butuh Node.js 20+.

```bash
npm install
cp .env.example .env.development   # isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY
npx vite                           # dev server dengan DB dev
```

Untuk build produksi, buat juga `.env.production` berisi DB prod. Kedua file `.env.*` tidak ikut di-commit.

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `npx vite` | Dev server lokal |
| `npm run build` | Build web dengan DB prod ke `dist/` |
| `npm run build:dev` | Build web dengan DB dev |
| `npm test` | Jalankan test (Vitest) |
| `npm run check:icons` / `npm run check:emoji` | Cek ikon dan pemakaian emoji |

Perintah Android/iOS (Capacitor), rilis APK, dan CI dijelaskan di [MOBILE.md](MOBILE.md).

## Supabase

- `supabase/migrations/`: skema tabel, fungsi, dan aturan sinkron (yang terbaru menang)
- `supabase/functions/ai`: proxy ke API model yang kompatibel dengan OpenAI. Butuh secret `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, dan opsional `AI_VISION_MODEL`, `AI_DAILY_LIMIT` (default 100 per hari)
- `supabase/functions/quotes`: mengambil harga saham untuk versi web (Yahoo tidak mengizinkan CORS)

## Struktur folder

```
src/           Kode web React (layar, store lokal, sinkron, i18n)
tests/         Test Vitest
mobile/        Aplikasi Flutter (pengganti Capacitor)
android/ ios/  Proyek native Capacitor
supabase/      Migrasi database dan Edge Functions
scripts/       Pembuat dan pengecek ikon
public/        Manifest PWA, service worker, ikon
resources/     Sumber ikon & splash untuk mobile
docs/          Rencana dan catatan desain
```

## Dokumen lain

- [MOBILE.md](MOBILE.md): build Android & iOS, rilis APK lewat GitHub Releases
- [mobile/README.md](mobile/README.md): menjalankan aplikasi Flutter
- [MECHANICS.md](MECHANICS.md): aturan perhitungan (format uang, awal minggu, grafik mingguan) dan asalnya
- [Rencana migrasi Flutter](docs/superpowers/plans/2026-11-19-flutter-mobile-migration.md)
