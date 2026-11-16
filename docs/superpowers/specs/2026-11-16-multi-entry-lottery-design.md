# Spesifikasi Fitur: Multi-Undian (1 Orang, Banyak Nama Undian)

Tanggal: 2026-11-16 · Status: Disetujui (desain) · Project: ArisanKu

## 1. Latar Belakang & Tujuan

Saat ini 1 anggota arisan = 1 slot undian dengan 1 nama. Beberapa anggota ingin
ikut undian lebih dari 1 kali memakai nama undian berbeda (mis. Bu Siti ikut 2
undian dengan nama **Sisil** dan **Andi**), dengan konsekuensi iuran yang dibayar
dikali jumlah undian (2 × Rp 100.000 = Rp 200.000 otomatis).

Fitur ini menambahkan konsep **nama undian (entry)** sebagai satuan peserta
undian, di dalam data anggota (member).

## 2. Keputusan yang Disepakati dengan Pemilik Aplikasi

1. **Satuan undian**: 1 nama undian = 1 slot peserta penuh. Anti-menang-dobel
   berlaku **per nama undian** (Sisil hanya bisa menang 1x), tetapi pemiliknya
   boleh menang beberapa kali lewat nama undian berbeda (Andi boleh menang lagi).
2. **Pencatatan iuran**: ada pengaturan per grup `paymentMode`:
   - `per_entry` — tiap nama undian punya status lunas sendiri;
   - `per_member` — satu aksi mencakup semua nama undian milik orang itu
     sekaligus.
   Data pembayaran **selalu disimpan per nama undian**; mode hanya mengubah
   cara input di UI. Default grup baru: `per_entry`.
3. **Tempat input nama undian**: saat membuat arisan baru (mode ketik manual)
   **dan** dari Tabel Iuran (tambah/hapus nama undian anggota yang sudah ada).
4. **Nama asli vs alias**: jika anggota memiliki daftar nama undian, nama asli
   anggota **tidak ikut diundi** — ia hanya tampil sebagai pemilik. Anggota
   tanpa nama undian tambahan otomatis memiliki 1 nama undian = nama aslinya.
5. Pendekatan teknis: **Opsi B (nested)** — entries tersarang di dalam member,
   bukan baris terpisah dengan label pemilik.

## 3. Model Data (`src/types/arisan.ts`)

```ts
export interface ArisanEntry {
  id: number;              // unik per grup; namespace terpisah dari member.id
  name: string;            // nama yang diundi, tidak boleh kosong
  hasWon: boolean;
  wonInRound?: number;
}

export interface ArisanMember {
  id: number;
  name: string;            // nama asli pemilik
  phone: string;
  notes?: string;
  entries: ArisanEntry[];  // WAJIB 1..N (invarian yang dijaga)
}

export type PaymentMode = 'per_entry' | 'per_member';

export interface ArisanRound {
  roundNumber: number;
  isDrawn: boolean;
  drawnAt?: string;
  winnerIds: number[];                 // berisi ENTRY id (bukan member id)
  payments: Record<number, boolean>;   // key = ENTRY id
}

export interface ArisanGroup {
  // ...field lama tetap...
  paymentMode: PaymentMode;
}
```

Konvensi ID: `entry.id` dan `member.id` berada di namespace berbeda dan tidak
pernah dicampur dalam satu map. Anggota lama hasil migrasi memakai
`entry.id = member.id` demi kompatibilitas riwayat; entry baru mengambil
`max(semua entry.id di grup) + 1`.

## 4. Migrasi Data Lama

Fungsi murni `migrateLegacyState(state)` dijalankan saat memuat dari
localStorage (key baru & legacy key) dan saat `importBackup`:

- Anggota tanpa `entries` atau `entries` tidak array/kosong → dibuat
  `entries = [{ id: member.id, name: member.name, hasWon: member.hasWon,
  wonInRound: member.wonInRound }]`.
- Grup tanpa `paymentMode` → `paymentMode: 'per_entry'`.
- `round.winnerIds`/`payments` **tidak diubah** (sudah cocok karena
  `entry.id = member.id` untuk data lama).
- Migrasi idempotent: state yang sudah format baru lolos tanpa perubahan.

## 5. Matematika & Selektor (fungsi murni, diuji Vitest)

Di `src/utils/arisanStats.ts` (file baru):

| Fungsi | Definisi |
|---|---|
| `totalEntries(group)` | `Σ member.entries.length` |
| `memberDue(group, member)` | `group.dues × member.entries.length` |
| `totalPrize(group)` | `group.dues × totalEntries − administrator.wages` |
| `prizePerWinner(group)` | `floor(totalPrize / winnersCount)` |
| `totalRoundsNeeded(group)` | `max(1, ceil(totalEntries / winnersCount))` |
| `unpaidEntries(group, round)` | entries dengan `payments[entry.id] !== true` |
| `drawCandidates(group)` | entries `!hasWon` dan tidak ada di `winnerIds` putaran mana pun yang `isDrawn` (proteksi ganda sama seperti versi lama, kini per entry) |

Semua tampilan dan pesan WA memakai selektor ini — tidak ada perhitungan
duplikat tersebar di komponen.

## 6. Perubahan Context (`src/context/ArisanContext.tsx`)

- `createGroup`: terima `members: Array<{ name; phone?; entryNames?: string[] }>`.
  `entryNames` (setelah trim, min 1 nama) menjadi daftar entries; kosong →
  1 entry bernama nama anggota.
- `addMember`: dukungan `entryNames` sama dengan di atas; jumlah putaran grup
  dihitung ulang dari `totalEntries`.
- `addEntry(memberId, name)` — baru: tambah 1 nama undian; nama divalidasi
  tidak kosong; putaran dihitung ulang.
- `removeEntry(memberId, entryId)` — baru: hanya boleh jika entry belum
  pernah menang (`!hasWon`); key pembayaran entry dihapus dari semua putaran.
- `togglePayment(entryId, round?)` — kini toggle **per entry**.
- `toggleMemberPayment(memberId, round?)` — baru: mode `per_member`; jika ada
  entry belum lunas → tandai semua lunas, selain itu batalkan semua.
- `markAllPaid(paid, round?)` — set semua **entry** di putaran itu.
- `drawLottery(round?)` — kandidat dari `drawCandidates`, ambil
  `min(winnersCount, kandidat)` acak; pemenang ditandai pada entry;
  `round.winnerIds` berisi entry id; log memuat nama undian + pemilik.
- `resetCurrentRoundLottery(round?)` — reset `hasWon` entry pemenang putaran
  tersebut, dengan guard lama: entry yang juga menang di putaran lain tidak
  direset.
- `setPaymentMode(mode)` — baru: ubah `paymentMode` grup aktif via
  `updateGroup`.
- `setRound`/`removeMember` — perilaku lama; `removeMember` ikut menghapus
  semua entry-nya. Jumlah putaran grup **hanya bertambah, tidak pernah
  berkurang** — riwayat putaran yang sudah ada (termasuk yang terisi pemenang)
  tetap tersimpan apa pun yang terjadi pada anggota/entry.

## 7. Perubahan Tampilan

### 7.1 CreateArisanModal
- Langkah 2: tambah pilihan **Mode Pencatatan Iuran** (per nama undian /
  per orang sekaligus) dengan penjelasan singkat.
- Langkah 3 mode manual: kolom opsional **"Nama undian (pisah koma)"** per
  baris anggota; kosong = 1 nama = nama peserta. Helper text menjelaskan
  contoh: `Sisil, Andi` → 2 undian, iuran otomatis ×2.
- Langkah 3 mode Tempel dari WA: tetap 1 baris = 1 anggota 1 nama undian;
  helper text mengarahkan menambah alias lewat Tabel Iuran.

### 7.2 TableTab
- 1 baris = 1 anggota: nama asli + badge jumlah undian (chips nama undian,
  contoh `Sisil`, `Andi`) + iuran putaran `memberDue`.
- Status iuran: mode `per_entry` → tombol kecil per nama undian (lunas/belum);
  mode `per_member` → 1 tombol utama seperti versi lama memanggil
  `toggleMemberPayment`. Kedua mode menampilkan ringkasan `x/y lunas`.
- Aksi per baris: tambah nama undian (inline input) dan hapus nama undian
  yang belum menang.
- Header: pengalih `paymentMode` (dipanggil `setPaymentMode`), counter
  `Semua/Belum/Lunas` berbasis entry.
- Pencarian tetap mencakup nama anggota, no WA, **dan nama undian**.

### 7.3 LotteryTab
- Banner: `X nama undian berkesempatan` (bukan jumlah orang); hadiah =
  `prizePerWinner`.
- Kandidat berjalan pada animasi & daftar "Belum Pernah Menang" = nama undian
  dengan chip pemilik (`Sisil · Bu Siti`).
- Pemenang tampil `Sisil (Bu Siti)`; pesan "semua sudah menang" bila kandidat 0.
- Gerbang undian: semua entry di putaran aktif harus lunas (sama di kedua mode).

### 7.4 HomeTab & HistoryTab
- Ringkasan/pemenang terakhir memakai nama undian + pemilik; statistik
  "sudah menang" = jumlah entry; riwayat putaran menampilkan pemenang
  per nama undian; total tagihan memakai `memberDue`.

### 7.5 WinnerAnnouncementModal, WhatsAppReminderModal, utils/whatsapp.ts
- Pengumuman pemenang: daftar nama undian + pemilik.
- Pengingat tagihan: per anggota — daftar nama undian belum lunas + total
  (`dues × jumlah belum lunas`); rekap riwayat memakai nama undian.
- Tanda tangan pesan tetap "ArisanKu".

### 7.6 Teks bantuan & README
- FAQ Bubu (`offlineFaq.ts`), TourGuide/SpotlightTour, dan README diperbarui
  menjelaskan fitur multi-undian.

## 8. Kas Batas (Edge Cases)

- Nama undian kosong/whitespace → ditolak dengan pesan inline.
- Nama undian duplikat (antar anggota) → diizinkan; UI selalu menampilkan
  pemilik agar tak membingungkan.
- `winnersCount` > kandidat tersisa → ambil `min` (perilaku lama dipertahankan).
- Semua entry sudah menang → tombol undi diganti pesan selesai.
- Ganti `paymentMode` di tengah arisan → data per-entry tetap utuh; hanya
  bentuk input yang berubah.
- Hapus anggota → semua entry-nya hilang; putaran/hadiah dihitung ulang.
- Impor cadangan v2 lama & format v1 → melewati migrasi yang sama.

## 9. Strategi Pengujian

- **Vitest** (instal baru) untuk logika murni: migrasi state, selektor
  statistik, `drawLottery` (anti-menang-dobel per entry), toggle pembayaran
  dua mode, reset undian. Fungsi dibuat murni (state in → state out) agar
  mudah diuji.
- `tsc && vite build` harus lulus; verifikasi manual alur utama via dev
  server: buat arisan dengan Bu Siti 2 undian → cek iuran 200k, undi 2
  putaran berbeda menang lewat 2 nama berbeda, dan Sisil tak bisa menang 2x.

## 10. Di Luar Cakupan (Out of Scope)

- Migrasi ke backend/server (tetap localStorage).
- Edit nama asli anggota & no WA dari Tabel (fitur sudah ada atau jadi tugas
  lain — tidak diganggu).
- Syntax alias otomatis di mode Tempel dari WA (mis. `Bu Siti (Sisil, Andi)`).
- Pembayaran sebagian/parsial (tetap biner lunas/belum per entry).
