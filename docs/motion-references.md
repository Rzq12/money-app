# Referensi motion Kasku+

Dasar untuk lapisan animasi Kasku+. Setiap pola punya ID (`M1`, `M2`, ...). Commit animasi nanti menyebut ID itu, jadi tiap animasi bisa dilacak ke baris di sini.

## Cara membaca tabel ini

- **Sumber.** Referensi dikumpulkan lewat pencarian di situs galeri pada 18 Nov 2026. Untuk sebagian besar shot, yang bisa dibaca hanya judul, tag, dan deskripsi desainer. Klip videonya tidak diputar frame demi frame. Jadi kolom "Apa yang diambil" mencatat **pola gerak** dari referensi (arah, urutan, efek, kapan dipicu).
- **Angka durasi dan easing tidak disalin dari referensi.** Angka itu dipilih supaya cocok dengan aturan proyek: micro 100–200ms, halaman/sheet 200–350ms, maksimum 600ms kecuali count-up dan efek sukses. Easing default `--ease: cubic-bezier(.16, 1, .3, 1)` yang sudah ada.
- **Token durasi baru yang diusulkan:** `--dur-1: .15s` (micro), `--dur-2: .25s` (masuk/keluar elemen, halaman), `--dur-3: .4s` (chart, progress). Semua animasi baru memakai token ini.
- **Yang tidak disalin:** gambar, aset, atau Lottie dari situs-situs ini. Semuanya digambar ulang dengan CSS.

## Dasar yang sudah ada (dipertahankan)

| Sudah ada | Dipakai di | Jadi dasar untuk |
|---|---|---|
| `@keyframes up` (naik 24px + fade) | `.sheet`, `.dialog` | M1, M7, M15, M27, M36 |
| `@keyframes fade` | `.sheet-wrap` | M15, M16 |
| `grow-y`, `grow-x`, `sweep` | `.tb i`, `.bar i`, `.donut` | M19, M20, M22 |
| `fresh` | `.bill.fresh` | M5 |
| `skel` | `.skel-lines i` | M41 |
| `useTween` | angka hero | M6, M21, M29 |
| Blok `prefers-reduced-motion` | global | semua pola baru |

## 1. Pindah halaman (`App.jsx`, `.main`)

| ID | Referensi (judul + URL) | Situs | Apa yang diambil |
|---|---|---|---|
| M1 | [Smooth Navigation Transition – Oliver King](https://dribbble.com/shots/25779941-Smooth-Navigation-Transition) | Dribbble | Gabungan fade opacity dengan geser pendek searah navigasi. Diambil: halaman baru masuk dari 10px di bawah ke posisinya + fade, `--dur-2`, `--ease`. Tanpa animasi keluar. |
| M1 | [Vue iOS-like transition – Nico Prat](https://dribbble.com/shots/4751446-Vue-iOS-like-transition) | Dribbble | Transisi dipicu oleh perubahan route, bukan per komponen. Diambil: animasi dipasang di `.main` dengan `key={path}`, jadi tiap halaman memakai satu aturan yang sama. |
| M1 | [Transitions collection](https://www.awwwards.com/awwwards/collections/transitions/) | Awwwards | Definisi Awwwards: transisi menjaga kontinuitas visual antar view. Diambil: geser kecil saja, karena geser lebar di situs finance (EA Financial, Moto Finance) terasa dekoratif dan memperlambat. |

## 2. Bottom nav dan sidebar

| ID | Referensi | Situs | Apa yang diambil |
|---|---|---|---|
| M2 | [Animated sliding tab bar – Virgil Pana](https://dribbble.com/shots/976474-Animated-sliding-tab-bar) | Dribbble | Indikator aktif yang bergeser ke tab baru, bukan muncul tiba-tiba. Diambil: pill tipis di atas ikon aktif, `transform: translateX` ke tab tujuan, `--dur-2`. |
| M2 | [Tab Bar active animation – Aaron Iker](https://dribbble.com/shots/6856687-Tab-Bar-active-animation) | Dribbble | Animasi aktif yang sadar arah (dari kiri atau kanan). Diambil: indikator bergeser dari posisi tab lama, bukan memudar di tempat. |
| M3 | [Tab Bar Animation with animated icons – CMARIX](https://dribbble.com/shots/19695926-Tab-Bar-Animation-with-animated-icons) | Dribbble | Ikon tab aktif ikut bereaksi. Diambil: ikon aktif `scale(1.08)` + warna teks, `--dur-1`. Di sidebar desktop: background item aktif bertransisi, tanpa scale. Tanpa Lottie. |
| M4 | [Framer fab animation – Luka Drezga](https://dribbble.com/shots/3139912-Framer-fab-animation) | Dribbble | FAB punya state tekan yang jelas sebelum aksinya muncul. Diambil: `.fab:active` `scale(.92)`, lepas kembali dengan `--ease`, `--dur-1`. |
| M4 | [Floating action button / Plus Button Animation](https://dribbble.com/search/fab-button) | Dribbble | Ikon plus ikut berputar saat ditekan. Diambil: ikon plus berputar 90° saat `:active`. Sheet tetap terbuka seketika, tidak menunggu putaran selesai. |

## 3. Ledger / Catatan

| ID | Referensi | Situs | Apa yang diambil |
|---|---|---|---|
| M5 | [Monarch iOS – Adding a transaction](https://mobbin.com/explore/flows/dea78d5a-79fd-4668-9fc1-27e1351f3139) | Mobbin | Setelah form disimpan, transaksi baru muncul di daftar. Diambil: baris baru diberi highlight, memperkuat `fresh` yang sudah ada. Hanya baris baru itu, tidak seluruh daftar. |
| M5 | [Origin Financial – Creating a transaction](https://nicelydone.club/examples/flows/create) | Nicely Done | Drawer form → daftar dan angka ringkasan terbarui. Diambil: total hero ikut count-up setelah simpan (M6). |
| M6 | [Simple Animated Number Counter – Howard Pinsky](https://dribbble.com/shots/5486566-Simple-Animated-Number-Counter) | Dribbble | Angka menghitung ke nilai baru. Diambil: semua angka hero (`.hero-big`, `.hero-row`, `.hero-budget`) memakai `useTween`. Tidak memakai rolling digit per kolom, karena terlalu rumit untuk format Rupiah. |
| M6 | [Rolling Counter – Allan Grinshtein](https://dribbble.com/shots/689944-Rolling-Counter) | Dribbble | Perubahan angka dibuat terlihat. Diambil sebagai alasan memakai count-up, bukan teknik rolling-nya. |
| M7 | [Monzo iOS](https://pageflows.com/monzo/) dan [N26 – transaction history](https://nicelydone.club/examples/tags/transaction-history) | PageFlows, Nicely Done | Daftar transaksi dikelompokkan per hari/bulan dan muncul utuh. Diambil: stagger ringan saja, maks 8 baris pertama, jeda 30ms per baris, `up` 8px + fade `--dur-2`. Baris ke-9 dan seterusnya langsung tampil. |
| M7 | [Skeleton Loading for a Finance App – Isaac Sanchez](https://dribbble.com/shots/12105359-Skeleton-Loading-for-a-Finance-App) | Dribbble | Daftar transaksi muncul dari atas ke bawah. Diambil: urutan stagger mengikuti urutan baca. |
| M8 | [Calendar scroll – Vitaly Silkin](https://dribbble.com/shots/2786759-Calendar-scroll) | Dribbble | Ganti bulan lewat tombol, isi kalender bergeser. Desainer mencatat geser berlawanan arah membingungkan. Diambil: grid masuk dari kanan saat "bulan berikut", dari kiri saat "bulan sebelumnya", 16px + fade, `--dur-2`. Dipicu lewat tombol `PeriodNav`. |
| M8 | [Date change transition – Gabriel Valdivia](https://dribbble.com/shots/703153-Date-change-transition-animation) | Dribbble | Arah gerak tanggal mengikuti arah navigasi. Diambil: arah dibaca dari perbandingan anchor lama dan baru. |
| M9 | [Playground: Swipe to delete – 10Clouds](https://dribbble.com/shots/6051554-Playground-Swipe-to-delete) | Dribbble | Baris yang dihapus mengecil lalu daftar menutup celahnya. Diambil: baris memudar + `scaleY` ke 0 dalam `--dur-2`, lalu benar-benar dihapus dari store. Tidak menambah gestur swipe. |
| M9 | [Swipe to Remove Interaction – Howard Pinsky](https://dribbble.com/shots/6533327-Swipe-to-Remove-Interaction) | Dribbble | Baris di bawahnya naik mengisi celah, tidak melompat. Diambil sebagai target. Kalau butuh animasi `height`, dibatasi satu baris dan ≤ 200ms. |

## 4. BillEditor (sheet input transaksi)

| ID | Referensi | Situs | Apa yang diambil |
|---|---|---|---|
| M10 | [Numpad tag – Expense input flow, Amount Insertion](https://dribbble.com/tags/numpad?page=2) | Dribbble | Keypad adalah input utama. Tiap tekan harus terasa. Diambil: `.key:active` `scale(.94)` + background `--track`, kembali `--dur-1`. Tidak ada delay sebelum digit masuk. |
| M10 | [Cash App iOS – Adding cash](https://mobbin.com/explore/flows/a40620bc-68ad-481f-8522-4667a325a4e5) | Mobbin | Layar keypad besar dengan nominal sebagai fokus. Diambil: nominal di display yang bereaksi, bukan keypad-nya (M11). |
| M11 | [Counter {gif animation} – Daniel Nicolae](https://dribbble.com/shots/1388485-Counter-gif-animation) | Dribbble | Angka yang berubah terasa "bouncy". Diambil: display nominal `scale(1.04)` → 1 selama 120ms tiap tekan. Animasi di-restart dengan mengganti `key`, tanpa menunggu yang sebelumnya selesai. |
| M12 | [Navbar Segmented Controls Animation – Jardson Almeida](https://dribbble.com/shots/2473987-Navbar-Segmented-Controls-Animation) | Dribbble | Selector bergeser antar opsi. Diambil: tab Pengeluaran / Pemasukan / Transfer memakai indikator geser yang sama dengan `Segmented` (M33). Isi di bawahnya fade `--dur-1`. |
| M13 | [Confirmation checkbox animation – Michiel Gerbranda](https://dribbble.com/shots/2888283-Confirmation-checkbox-animation) | Dribbble | Pilihan yang terpilih diberi konfirmasi kecil. Diambil: `.cat-cell` terpilih: ikon `scale(.9)` → 1 + background accent, `--dur-1`. |
| M13 | [Expense Tracker App – MindInventory](https://dribbble.com/shots/4414019-Expense-Tracker-App) | Dribbble | Grid kategori ikon sebagai langkah pilih. Diambil: hanya sel yang dipilih yang bergerak, grid lainnya diam. |
| M14 | [Progress checkmark – Aaron Iker](https://dribbble.com/shots/6701516-Progress-checkmark) | Dribbble | Tombol berubah isi dengan crossfade, bukan ganti teks mendadak. Diambil: tombol `ok` saat berganti `=` ↔ `Selesai`: label baru masuk 4px dari bawah + fade, `--dur-1`. |

## 5. Sheet dan dialog (`Sheet`, `.dialog`, `ConfirmHost`)

| ID | Referensi | Situs | Apa yang diambil |
|---|---|---|---|
| M15 | [Bottom Sheet Confirmation – Dmitrii Ziuzin](https://dribbble.com/shots/4418635-Bottom-Sheet-Confirmation) | Dribbble | Sheet konfirmasi transaksi naik dari bawah dan turun lagi saat ditutup. Diambil: animasi tutup = kebalikan `up`. Sheet turun 24px + fade, backdrop fade, `--dur-2`. Unmount setelah `animationend`, dengan fallback timer. |
| M15 | [Origin Financial – drawer form](https://nicelydone.club/examples/flows/create) | Nicely Done | Drawer menutup lalu daftar terbarui. Diambil: urutan tutup sheet → baris baru `fresh`. |
| M16 | [Material Design – Bottom Sheet Filter – Dmytro Danylyk](https://dribbble.com/shots/4343142-Material-Design-Bottom-Sheet-Filter) | Dribbble | Sheet bisa ditarik ke bawah. Diambil: drag-to-dismiss khusus mobile pada `.sheet-head`. Sheet mengikuti jari (`translateY`). Lepas di atas 30% tinggi atau dengan flick cepat → tutup. Di bawah itu → kembali ke posisi. |
| M16 | [Bottom sheet tag – Prototype: Bottom Sheet Filters](https://dribbble.com/tags/bottom_sheet) | Dribbble | Backdrop memudar sebanding dengan jarak tarik. Diambil: opacity backdrop mengikuti progres drag. |
| M17 | [Login animation feedback – Top That for inUse](https://dribbble.com/shots/2135124-Login-animation-feedback-Error-and-Success) | Dribbble | Feedback muncul singkat lalu memudar. Diambil: `.dialog` masuk `scale(.96)` → 1 + fade, keluar kebalikannya, `--dur-1`. |

## 6. Analysis / Laporan

| ID | Referensi | Situs | Apa yang diambil |
|---|---|---|---|
| M18 | [Donut chart interactive animation – ByeWind](https://dribbble.com/shots/23175231-Donut-chart-interactive-animation) | Dribbble | Segmen donut bereaksi saat disentuh. Diambil: segmen aktif menebal (stroke-width +2) dan segmen lain turun ke opacity .4, `--dur-1`. |
| M18 | [Copilot iOS – Recurring dashboard (donut)](https://mobbin.com/explore/screens/bec12df5-c54e-4c3f-8de0-903c0586b3e8) | Mobbin | Donut berdampingan dengan daftar. Memilih segmen menyorot baris terkait. Diambil: highlight dua arah donut ↔ baris kategori. |
| M19 | [Animating donut – jackie ho / Wealthfront](https://dribbble.com/shots/2920627-Animating-donut) | Dribbble | Donut berputar mengisi saat data berganti. Diambil: saat ganti periode, `stroke-dasharray` bertransisi ke nilai baru (sudah ada `transition`), tanpa `sweep` ulang dari nol. |
| M20 | [Investment Overview (HeyDay) / Bar chart animation](https://dribbble.com/search/bar-chart-animation) | Dribbble | Bar tumbuh dari dasar dan berubah tinggi saat data berganti. Diambil: saat ganti periode/segmen, bar bertransisi `scaleY` ke nilai baru, bukan diulang dari 0. |
| M20 | [Chart Hoverstate – Dreamten](https://dribbble.com/tags/chart%20animation) | Dribbble | Bar yang disentuh disorot, bar lain diredupkan. Diambil: `.tb` aktif opacity 1, bar lain .5, `--dur-1`. |
| M21 | [Animated Loading Circle with Number Counter – Lev Otinov](https://dribbble.com/shots/4485299-Animated-Loading-Circle-with-Number-Counter) | Dribbble | Angka di tengah lingkaran menghitung bersamaan dengan lingkaran. Diambil: total di tengah donut memakai `useTween`. |

## 7. Money.jsx (Budgets, Goals, Debts, Recurring, Rules)

| ID | Referensi | Situs | Apa yang diambil |
|---|---|---|---|
| M22 | [Mr. Cashly goals screen – Taras Migulko](https://dribbble.com/shots/25336580-Mr-Cashly-goals-screen) | Dribbble | Bar progress tujuan terisi beranimasi saat layar dibuka. Diambil: `Progress` terisi dari 0 dengan `scaleX` (menggantikan animasi `width`), `--dur-3`. |
| M22 | [Monzo – Creating a pot](https://pageflows.com/post/ios/creating-a-pot/monzo/) | PageFlows | Pot/tabungan menampilkan progres ke target. Diambil: bar terisi pelan agar progres terbaca, bukan sekadar muncul. |
| M23 | [Goal completion animation – Fiasco](https://dribbble.com/shots/8171138-Goal-completion-animation) | Dribbble | Saat target tercapai ada momen perayaan. Diambil: bar mencapai 100% → satu kilau (pseudo-element gradient bergeser `translateX`) + ikon cek `scale` pop, 500ms, sekali saja. |
| M23 | [Completion Animation – Prabhakar Bind](https://dribbble.com/PrabhakarBind/collections/1485599-Completion-Animation) | Dribbble | Perayaan yang kecil dan sekali jalan. Diambil: tidak ada confetti (terlalu berat untuk WebView). Cukup kilau + pop. Budget yang terlewati: bar berubah merah dengan transisi warna, tanpa goyang. |
| M24 | [Toggle Switch Animation tag](https://dribbble.com/tags/toggle-switch-animation) dan [Micro-animation for Toggle Switch – Mikhail Voloshin](https://dribbble.com/shots/7498947-Micro-animation-for-Toggle-Switch-Webflow-Lottie) | Dribbble | Knob meluncur dengan sedikit melebar saat ditekan. Diambil: knob `.switch::after` pindah lewat `translateX` (menggantikan `left`), melebar 4px saat `:active`, `--dur-2`. |
| M25 | [List Interaction – Yonghee Kim](https://dribbble.com/tags/swipe_to_delete) | Dribbble | Daftar muncul dan disusun ulang dengan gerak lembut. Diambil: Debts, Recurring, Rules memakai stagger yang sama dengan M7 (maks 8 item). |
| M25 | [Monarch Android – Adding a recurring transaction](https://mobbin.com/explore/flows/bc65b341-cf30-4aed-95a7-7534eff6dcc0) | Mobbin | Item berulang yang baru ditambahkan langsung terlihat di daftarnya. Diambil: item baru di Recurring memakai `fresh` (M5). |

## 8. Tools.jsx

| ID | Referensi | Situs | Apa yang diambil |
|---|---|---|---|
| M26 | [Mobile Trading App animation – Ronas IT](https://dribbble.com/shots/24386504-Mobile-Trading-App-animation) | Dribbble | Merah/hijau untuk arah harga. Diambil: harga naik → background hijau pudar 600ms. Harga turun → merah. Dipicu saat nilai berubah. |
| M26 | [Stock Market App Animation – Vektora](https://dribbble.com/shots/25081098-Stock-Market-App-Animation) | Dribbble | Data real-time sebagai fokus. Diambil: `.live-dot` berdenyut (`scale` + opacity ring, 1.6s infinite) hanya saat live aktif. Dimatikan di reduced motion. |
| M27 | [Interaction – chat "send message" animation – Daniele De Santis](https://dribbble.com/shots/10759295-Interaction-chat-send-message-animation) | Dribbble | Bubble terkirim naik dari input ke log. Diambil: `.bubble` baru `up` 12px + fade, `--dur-2`, origin dari sisi pengirim. |
| M27 | [Chat Animation – Denis Duarte / wallapop](https://dribbble.com/shots/3018087-Chat-Animation-Dribbble-Phone) | Dribbble | Status pesan berganti bertahap. Diambil: `.proposal` (kartu usulan transaksi) muncul setelah bubble, jeda 80ms per kartu. |
| M28 | [Tribe – Typing Indicator Animation – Mark Lamb](https://dribbble.com/shots/3987561-Tribe-Typing-Indicator-Animation) | Dribbble | Tiga titik memantul bergantian. Diambil: 3 titik, `translateY(-3px)` + opacity, jeda 150ms per titik, loop 1s, selama AI memproses. |
| M28 | [Typing Indicator – Rodolpho Henrique](https://dribbble.com/shots/3072839-Typing-Indicator) | Dribbble | Indikator untuk chat bot (bukan manusia). Diambil: indikator tampil di bubble AI kosong, lalu bubble itu diisi jawaban, tidak diganti bubble baru. |
| M29 | [Simple counter with animation – Artur Sedlukha](https://dribbble.com/shots/5896460-Simple-counter-with-animation) | Dribbble | Hasil hitungan berganti dengan animasi singkat. Diambil: hasil Split, KPR, PPh memakai `useTween` 300ms saat input berubah. |
| M29 | [Simple Animated Number Counter – Howard Pinsky](https://dribbble.com/shots/5486566-Simple-Animated-Number-Counter) | Dribbble | Count-up yang sama dengan hero (M6), supaya satu keluarga. |

## 9. Import dan Backup

| ID | Referensi | Situs | Apa yang diambil |
|---|---|---|---|
| M30 | [Confirmation checkbox animation – Michiel Gerbranda](https://dribbble.com/shots/2888283-Confirmation-checkbox-animation) | Dribbble | Dibuat khusus sebagai feedback positif setelah upload selesai. Diambil: ikon cek digambar (`stroke-dashoffset` → 0, 400ms) dalam lingkaran yang `scale` pop. |
| M30 | [95 SaaS Success Notification examples](https://www.saasframe.io/patterns/success-state) | SaaSFrame | Status sukses dari toast sampai layar penuh. Diambil: status sukses impor inline di halaman, bukan layar penuh. |
| M31 | [Password error animation – Aaron Iker](https://dribbble.com/shots/5180423-Password-error-animation) | Dribbble | Error ditandai dengan gerak dan warna. Diambil: gagal impor → ikon alert goyang horizontal kecil (±4px, 3x, 300ms) + warna `--neg`. |
| M31 | [Login Error Animation – Jimmy Young](https://dribbble.com/shots/2195179-Login-Error-Animation) | Dribbble | Goyang singkat sebagai tanda gagal. Diambil: satu keyframe `shake` dipakai bersama Import dan Auth (M37). |
| M32 | [Skeleton Loading Animation – Shane Doyle](https://dribbble.com/shots/7056106-Skeleton-Loading-Animation-FREE-DOWNLOAD) | Dribbble | Progres yang tidak pasti ditunjukkan dengan gerak berulang. Diambil: progres impor memakai bar indeterminate (segmen bergeser `translateX`, loop) sampai ada angka, lalu bar determinate `scaleX`. |
| M32 | [Progress checkmark – Aaron Iker](https://dribbble.com/shots/6701516-Progress-checkmark) | Dribbble | Indikator progres yang berakhir jadi tanda cek. Diambil: bar progres selesai → diganti ikon sukses M30. |

## 10. Settings, Hub, Wallet

| ID | Referensi | Situs | Apa yang diambil |
|---|---|---|---|
| M33 | [Twicket Segmented Control – Danny Saltaren](https://dribbble.com/shots/2976216-Twicket-Segmented-Control) | Dribbble | Selector adalah satu objek yang bergerak antar opsi. Diambil: `Segmented` mendapat satu elemen indikator (`.seg-i`) yang digeser dengan `transform` dan `width` diukur sekali, `--dur-2`. Tanpa fisika/inersia. |
| M33 | [Wise design system](https://styles.refero.design/style/367c0c6e-73a7-441c-a8ff-91d139ac60dc) | Refero | Switcher pill di halaman finance, opsi aktif berupa isian warna. Diambil: indikator berupa isian pill (`--surface` + `--e2`), bukan garis bawah. |
| M34 | [Apple Wallet spells](https://designspells.com/apps/apple-wallet) | Design Spells | Detail kecil yang tidak menghalangi apa pun. Diambil: `.swatch` terpilih `scale(1.15)` + ring accent mengembang, `--dur-1`. |
| M34 | [Buddy iOS – Creating a wallet](https://mobbin.com/flows/d203497d-5346-498f-b9c9-52331f4b4669) | Mobbin | Pilihan warna/ikon dompet saat membuat dompet. Diambil: pemilih ikon (`IconPicker`, `.icon-opt`) memakai pola terpilih yang sama dengan swatch. |
| M35 | [Toggle Switch Animation with Dark and Light mode – Tornike Rostiashvili](https://dribbble.com/shots/25421926-Toggle-Switch-Animation-with-Dark-and-Light-mode) | Dribbble | Seluruh UI berpindah terang ↔ gelap dengan transisi, bukan kedipan. Diambil: saat ganti tema/accent, `background-color`, `color`, dan `box-shadow` bertransisi `--dur-2` lewat class sementara `.theming` di `<html>` (dilepas setelah 300ms, supaya transisi warna tidak aktif terus). |
| M35 | [Animated theme switch – Mohammad Sharifi](https://dribbble.com/shots/16526529-Animated-theme-switch) | Dribbble | Ganti tema terasa satu gerakan. Diambil: hanya crossfade warna, tanpa efek lingkaran menyebar (butuh View Transitions/clip-path, terlalu berat). |

## 11. AuthScreen

| ID | Referensi | Situs | Apa yang diambil |
|---|---|---|---|
| M36 | [Revolut Onboarding Flow](https://pageflows.com/post/ios/onboarding/revolut/) dan [Monzo Onboarding Flow](https://pageflows.com/post/ios/onboarding/monzo/) | PageFlows | Layar masuk yang tenang dengan satu kartu/form sebagai fokus. Diambil: `.auth-card` `up` 16px + fade, `--dur-3`, sekali saat mount. |
| M36 | [Lulo Bank – Clay Global](https://www.behance.net/gallery/203081353/Lulo-Bank) | Behance | Micro-interaction dipakai di seluruh app bank untuk memperkuat brand. Diambil: logo di atas kartu masuk 60ms lebih dulu dari form (stagger 2 langkah). |
| M37 | [Login Error – Tobias Arréhn / ustwo](https://dribbble.com/shots/1767825-Login-Error) | Dribbble | Tombol login "menggeleng" saat gagal. Diambil: kartu goyang horizontal ±6px, 3 kali, 360ms. Fokus tetap di field. |
| M37 | [Password error & success animation – Aaron Iker](https://dribbble.com/shots/10491392-Password-error-success-animation) | Dribbble | Error dan loading di tombol yang sama. Diambil: tombol loading menampilkan spinner kecil (rotate loop) dan label pudar, lebar tombol tetap. |

## 12. Status global (`SyncBadge`, `notify`, `Empty`, skeleton)

| ID | Referensi | Situs | Apa yang diambil |
|---|---|---|---|
| M38 | [Copilot Money iOS – Notifications](https://mobbin.com/explore/screens/2bd2aca5-489f-4f9a-9e14-8175b753144c) | Mobbin | Status ditampilkan kecil dan diam. Diambil: ikon cloud `SyncBadge` berdenyut opacity (1 → .5, 1.2s loop) hanya saat syncing. Selesai → cek kecil fade in. |
| M38 | [Login animation feedback – Top That for inUse](https://dribbble.com/shots/2135124-Login-animation-feedback-Error-and-Success) | Dribbble | Tanda cek muncul sebentar lalu memudar. Diambil: cek "tersinkron" fade in, lalu kembali ke ikon biasa setelah 1.5s. |
| M39 | [Resend (Sonner toast CSS)](https://www.saasframe.io/saas/resend) | SaaSFrame | Toast masuk dari tepi layar dan menumpuk dengan transisi. Diambil: `notify` berupa info dialog. Masuk `up` + `scale(.96)`, keluar fade `--dur-1` (pakai M17). Tidak mengubah `notify` jadi toast non-modal, karena itu mengubah perilaku. |
| M39 | [Search screens – Toast Notification tags](https://www.saasframe.io/search-screens?15a1e33a_page=8&15a1e346_page=10&1e71c912_page=11&38bc1106_page=6) | SaaSFrame | Toast singkat untuk konfirmasi ringan. Diambil: animasinya pendek (≤ 200ms) supaya tidak terasa menghalangi. |
| M40 | [Empty States Animations – Anton Tkachev / UI8](https://dribbble.com/shots/6135587-Empty-States-Animations) | Dribbble | Empty state hidup dengan ilustrasi bergerak. Diambil versi minimal: ikon `Empty` masuk `scale(.9)` → 1 + fade, lalu satu ayunan kecil (rotate ±4°) sekali. Tanpa Lottie. |
| M40 | [Tumbleweed empty state animation – Japi](https://dribbble.com/shots/6364054-Tumbleweed-empty-state-animation) | Dribbble | Gerak satu kali yang memberi karakter. Diambil: tidak looping. |
| M41 | [Ramp design system](https://styles.refero.design/style/b38702a0-75ab-474c-9106-00b624535825) | Refero | Warna abu netral khusus untuk skeleton. Diambil: tetap `--track` dan pulse opacity `skel` yang sudah ada. Tidak memakai shimmer gradient bergerak. |
| M41 | [Skeleton Loading for a Finance App – Isaac Sanchez](https://dribbble.com/shots/12105359-Skeleton-Loading-for-a-Finance-App) | Dribbble | Skeleton berbentuk seperti baris transaksi. Diambil: `.skel-lines` dipakai di daftar yang memuat. Saat data datang, konten memakai stagger M7. |

## 13. Elemen umum (tombol, input)

| ID | Referensi | Situs | Apa yang diambil |
|---|---|---|---|
| M42 | [Microinteractions II – Oleg Frolov](https://www.behance.net/gallery/52792777/Microinteractions-II) | Behance | Satu bahasa tekan yang sama di semua kontrol. Diambil: `.btn`, `.icon-btn`, `.text-btn`, `.chip`, `.wide-btn`, `.row`, `.bill`: `:active` `scale(.97)` + background `--track`, transisi `--dur-1`. |
| M42 | [Ramp design system](https://styles.refero.design/style/b38702a0-75ab-474c-9106-00b624535825) | Refero | Kontrol finance yang tenang dan presisi. Diambil: scale tekan tidak lebih kecil dari .94, tidak ada bounce berlebihan. |
| M43 | [Bottom sheet tag – Customer Details (fintech payment form)](https://dribbble.com/tags/bottom_sheet) | Dribbble | Form pembayaran di sheet dengan field yang bereaksi saat fokus. Diambil: `.field input:focus` ring accent 2px, `box-shadow` transisi `--dur-1` (transisi box-shadow sudah ada, cukup dirapikan ke token). |
| M43 | [Fey – Setting up payment method](https://nicelydone.club/examples/flows/ff0c2e28-0ed7-4a69-b748-467cec14e934) | Nicely Done | Form finance yang menandai field aktif dengan jelas. Diambil: ring fokus memakai warna accent, bukan biru bawaan browser. |

## Rekap situs

| Situs | Status | Dipakai untuk |
|---|---|---|
| Dribbble | Bisa diakses (judul, tag, deskripsi) | Hampir semua bagian |
| Behance | Bisa diakses | Auth, elemen umum |
| Mobbin | Hanya judul dan deskripsi flow. Layar penuh dan video butuh login | Ledger, BillEditor, Analysis, Money, Wallet, status sync |
| PageFlows | Bisa diakses (daftar layar + timestamp video) | Ledger, Goals, Auth |
| Nicely Done | Bisa diakses | Ledger, sheet, input |
| Awwwards | Bisa diakses | Pindah halaman |
| Refero | Bisa diakses (halaman style). Library pola penuh berbayar | Segmented, skeleton, elemen umum |
| Design Spells | Bisa diakses | Swatch tema |
| SaaSFrame | Bisa diakses | Import sukses, toast |
| UI Sources | Bisa diakses, tapi tidak ada konten finance yang relevan | Tidak dipakai |
| Collect UI | Bisa diakses, tapi pencarian toast/sukses tidak menemukan apa-apa | Tidak dipakai |
| The App Fuel, Design Vault, UI Design Daily, Layers, UI Bits | Belum dicari | Bisa ditambah kalau perlu referensi lain |
| SaaSpo, Land-book, Landingfolio, Lapa Ninja, Pure Landing, One Page Love, SiteSee, Curated.design, Brutalist Websites | Belum dicari. Isinya kebanyakan screenshot statis landing page, jadi sedikit yang relevan untuk motion di dalam app | — |

9 situs berbeda dipakai di tabel: Dribbble, Behance, Mobbin, PageFlows, Nicely Done, Awwwards, Refero, Design Spells, SaaSFrame.

## Sengaja tidak dianimasikan

- **Halaman lama saat keluar.** Butuh menahan dua halaman sekaligus. Halaman baru masuk saja sudah cukup.
- **Gestur swipe-to-delete.** Belum ada di app dan termasuk perubahan perilaku. Yang dianimasikan hanya hilangnya baris (M9).
- **Confetti, Lottie, efek lingkaran saat ganti tema.** Terlalu berat untuk WebView HP murah dan butuh aset atau dependency baru.
- **Rolling digit per kolom.** Format Rupiah dengan pemisah ribuan membuat ini rumit. Count-up `useTween` sudah memberi efek yang sama.
