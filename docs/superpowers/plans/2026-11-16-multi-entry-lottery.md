# Multi-Undian (Multi-Entry) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Satuan undian berpindah dari "anggota" ke "nama undian (entry)" yang tersarang di dalam anggota, sehingga 1 orang bisa daftar N nama undian (iuran otomatis ×N) dan menang maksimal 1x per nama undian.

**Architecture:** Model data `ArisanMember.entries: ArisanEntry[]`; seluruh perhitungan & selektor diekstrak ke fungsi murni (`arisanMigration.ts`, `arisanStats.ts`, `arisanRounds.ts`) yang diuji Vitest; context & tampilan memakai selektor tersebut; `round.payments`/`round.winnerIds` berpindah dari memberId ke entryId; data lama dimigrasi idempoten (entry.id = member.id lama agar riwayat tetap cocok).

**Tech Stack:** React 18 + TypeScript, Vite 6, Vitest (baru), Tailwind 3.

**Spec:** `docs/superpowers/specs/2026-11-16-multi-entry-lottery-design.md`

## Global Constraints

- Project BUKAN repo git: tidak ada langkah `git commit` — langkah akhir tiap task adalah checkpoint verifikasi yang tercantum.
- Branding & copy UI: **ArisanKu**, bahasa Indonesia, gaya kalimat santun ("Ibu").
- localStorage: kunci baru `arisanku_v2_storage`, fallback lama `arisanbae_v2_storage` (jangan diubah).
- Tidak menambah dependency selain devDependency **vitest**.
- Invarian spec: `member.entries.length >= 1`; jumlah putaran grup hanya bertambah; nama undian tidak boleh kosong (trim); nama duplikat antar anggota diizinkan; entry yang pernah menang tidak boleh dihapus.
- Semua tampilan/angka memakai selektor dari `arisanStats.ts` — tanpa duplikasi rumus di komponen.
- Perintah: test `npx vitest run`, type-check `npx tsc --noEmit`, build `npm run build`.

## Review Focus

1. Cadangan JSON dengan `entries: []` (array kosong) atau `entries` bukan array → migrasi tetap membuat 1 entry dari nama anggota. → Test Task 1.
2. Impor format v1 lama (anggota `winner`) → entry pemenang tak boleh diundi lagi walau `hasWon` tidak sinkron. → Test Task 2 (`drawCandidates`) + wiring Task 3.
3. `paymentMode` diganti di tengah arisan dengan pembayaran parsial → data per-entry utuh, UI mencerminkan kebenaran tersimpan. → Test Task 2 (`withMemberPayments`) + verifikasi Task 4.
4. `winnersCount` > kandidat tersisa → hanya mengundi yang tersedia (min). → Test Task 2.
5. Nama undian whitespace/duplikat dalam satu daftar → trim, buang kosong, dedupe; daftar kosong ditolak dengan pesan inline. → Test Task 2 (`sanitizeEntryNames`) + validasi Task 4/7.

---

### Task 1: Tipe Data + Migrasi Legacy

**Files:**
- Modify: `src/types/arisan.ts`
- Create: `src/utils/arisanMigration.ts`
- Test: `src/utils/__tests__/arisanMigration.test.ts`
- Modify: `package.json` (script `"test": "vitest run"`; devDep vitest)

**Interfaces:**
- Produces: `ArisanEntry { id:number; name:string; hasWon:boolean; wonInRound?:number }`, `PaymentMode = 'per_entry' | 'per_member'`, `ArisanMember { id; name; phone; notes?; entries: ArisanEntry[] }` (hapus `hasWon`/`wonInRound` dari member), `ArisanGroup.paymentMode: PaymentMode`, `migrateLegacyState(state: ArisanAppState): ArisanAppState`.

- [ ] **Step 1: Install vitest & script test**

`npm i -D vitest` lalu tambah `"test": "vitest run"` di scripts. (Tidak perlu config file — vitest membaca `vite.config.ts`.)

- [ ] **Step 2: Write the failing tests** — `src/utils/__tests__/arisanMigration.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { migrateLegacyState } from '../arisanMigration';
import { ArisanAppState } from '../../types/arisan';

const legacyState = (): ArisanAppState => ({
  groups: [{
    id: 'g1', name: 'Arisan RT 05',
    administrator: { manager: 'Ibu Nilma', wages: 50000 },
    dues: 100000, winnersCount: 1, periodType: 'bulanan', periodInterval: 1,
    createdAt: '2026-01-01', currentRound: 1,
    members: [
      { id: 1, name: 'Ibu Siti', phone: '081', hasWon: true, wonInRound: 1 },
      { id: 2, name: 'Ibu Nurul', phone: '082', hasWon: false },
    ],
    rounds: { 1: { roundNumber: 1, isDrawn: true, winnerIds: [1], payments: { 1: true } } },
  } as any],
  activeGroupId: 'g1', activityLogs: [], theme: 'light',
});

describe('migrateLegacyState', () => {
  it('membuat 1 entry per anggota dengan id & nama sama, membawa hasWon/wonInRound', () => {
    const s = migrateLegacyState(legacyState());
    const [m1, m2] = s.groups[0].members;
    expect(m1.entries).toEqual([{ id: 1, name: 'Ibu Siti', hasWon: true, wonInRound: 1 }]);
    expect(m2.entries).toEqual([{ id: 2, name: 'Ibu Nurul', hasWon: false, wonInRound: undefined }]);
    expect((m1 as any).hasWon).toBeUndefined();
  });
  it('mengisi paymentMode per_entry dan menjaga rounds apa adanya', () => {
    const s = migrateLegacyState(legacyState());
    expect(s.groups[0].paymentMode).toBe('per_entry');
    expect(s.groups[0].rounds[1]).toEqual({ roundNumber: 1, isDrawn: true, winnerIds: [1], payments: { 1: true } });
  });
  it('idempoten', () => {
    const once = migrateLegacyState(legacyState());
    expect(migrateLegacyState(once)).toEqual(once);
  });
  it('entries array kosong / bukan array tetap dimigrasi', () => {
    const s = legacyState();
    (s.groups[0].members[0] as any).entries = [];
    const out = migrateLegacyState(s);
    expect(out.groups[0].members[0].entries).toHaveLength(1);
    expect(out.groups[0].members[0].entries[0].name).toBe('Ibu Siti');
  });
});
```

- [ ] **Step 3: Run test — verify FAIL** — `npx vitest run src/utils/__tests__/arisanMigration.test.ts` → FAIL (modul/tipe belum ada).

- [ ] **Step 4: Implement** — tulis `ArisanEntry`, `PaymentMode`, ubah `ArisanMember` (hapus `hasWon`/`wonInRound`, tambah `entries` wajib), tambah `paymentMode` pada `ArisanGroup`; `migrateLegacyState` murni & idempoten sesuai spec §4 (entries `!Array.isArray || length===0` → 1 entry id=member.id; `paymentMode ?? 'per_entry'`; rounds tidak disentuh).

- [ ] **Step 5: Run test — verify PASS** (4 test hijau). **Checkpoint:** `npx vitest run` hijau; `npx tsc --noEmit` boleh error HANYA di views/modals/context yang belum diubah (daftar: `ArisanContext.tsx`, `TableTab.tsx`, `LotteryTab.tsx`, `HomeTab.tsx`, `HistoryTab.tsx`, `WhatsAppReminderModal.tsx`, `WinnerAnnouncementModal.tsx`, `CreateArisanModal.tsx`).

### Task 2: Selektor Statistik + Operasi Putaran (fungsi murni)

**Files:**
- Create: `src/utils/arisanStats.ts`, `src/utils/arisanRounds.ts`
- Test: `src/utils/__tests__/arisanStats.test.ts`, `src/utils/__tests__/arisanRounds.test.ts`

**Interfaces:**
- Consumes: tipe dari Task 1.
- Produces:
  - `totalEntries(g): number`; `memberDue(g, m): number`; `totalPrize(g): number`; `prizePerWinner(g): number`; `totalRoundsNeeded(g): number`
  - `unpaidEntries(g, round): ArisanEntry[]`; `drawCandidates(g): ArisanEntry[]`; `pickWinnerEntries(candidates, winnersCount): ArisanEntry[]`; `nextEntryId(g): number`
  - `sanitizeEntryNames(names: string[]): string[]` (trim, buang kosong, dedupe case-insensitive; boleh hasil `[]`)
  - `interface EntryWithOwner { entry: ArisanEntry; member: ArisanMember }`; `findEntry(g, entryId): EntryWithOwner | null`; `displayEntryName(e: EntryWithOwner): string` → `member.entries.length > 1 ? "${entry.name} (${member.name})" : member.name`
  - `withEntryPayment(round, entryId, paid): ArisanRound`; `withMemberPayments(round, member, paid): ArisanRound`; `withAllPayments(round, g, paid): ArisanRound`

- [ ] **Step 1: Write the failing tests** — fixture grup: dues `100000`, wages `50000`, winnersCount `1`; members: M1 id 1 (1 entry id 1 "Bu Siti"), M2 id 2 (2 entries: id 2 "Sisil" hasWon true, id 3 "Andi").

```ts
// arisanStats.test.ts (ringkas, nilai pasti)
totalEntries(g) === 3
memberDue(g, m2) === 200000; memberDue(g, m1) === 100000
totalPrize(g) === 250000          // 100000*3 - 50000
prizePerWinner(g) === 250000
totalRoundsNeeded({...g, winnersCount: 1}) === 3; winnersCount 2 → 2; winnersCount 5 → 1
unpaidEntries(g, round({payments:{1:true}})) → ids [2,3]
drawCandidates(g) → ids [1,3]     // Sisil (hasWon) tereliminasi
// case impor: entry id 1 hasWon=false tapi tercatat winnerIds di round isDrawn → tereliminasi juga
pickWinnerEntries(candidates, 2) → length 2, semua unik & subset kandidat
pickWinnerEntries(candidates, 99) → length kandidat
nextEntryId(g) === 4
sanitizeEntryNames([' Sisil ','', '  ', 'sisil', 'Andi']) → ['Sisil','Andi']
displayEntryName(m2-entrySisil) === 'Sisil (Bu Siti)'; displayEntryName(m1-entry) === 'Bu Siti'
// arisanRounds.test.ts
withEntryPayment(round,3,true) → hanya payments[3]=true, lainnya utuh
withMemberPayments(round,m2,true) → payments[2] & payments[3] true
withAllPayments(round,g,true) → payments[1..3] true
```

- [ ] **Step 2: Run — verify FAIL** — `npx vitest run src/utils/__tests__` → FAIL (modul belum ada).

- [ ] **Step 3: Implement** kedua file sesuai Interfaces. `drawCandidates`: `!hasWon && !previousWinnerIds.has(id)` dengan `previousWinnerIds` = union `winnerIds` semua round `isDrawn` (spec §5). `pickWinnerEntries`: salin array, shuffle `sort(() => 0.5 - Math.random())`, `slice(0, min(winnersCount, candidates.length))`.

- [ ] **Step 4: Run — verify PASS. Checkpoint:** `npx vitest run` hijau.

### Task 3: Rewire Context (`ArisanContext.tsx`)

**Files:**
- Modify: `src/context/ArisanContext.tsx`

**Interfaces:**
- Consumes: `migrateLegacyState` (Task 1), semua fungsi Task 2.
- Produces (kontrak untuk Tasks 4–7):
  - `state` dimuat via `migrateLegacyState(JSON.parse(saved))` (kunci baru + legacy fallback tetap).
  - `createGroup(data: { name; manager; wages; dues; winnersCount; periodType; paymentMode: PaymentMode; members: Array<{ name; phone?; entryNames?: string[] }> })`
  - `addMember(member: { name; phone?; entryNames?: string[] })`
  - `addEntry(memberId: number, name: string): { ok: boolean; message?: string }` — tolak nama kosong (`sanitizeEntryNames` → `[]`), entry baru id = `nextEntryId(g)`, hitung ulang putaran `max(round terbesar existing, totalRoundsNeeded)`
  - `removeEntry(memberId: number, entryId: number): { ok: boolean; message?: string }` — tolak jika `entry.hasWon`; bersihkan key pembayaran entry dari semua putaran
  - `togglePayment(entryId: number, targetRound?: number)` (per entry) ; `toggleMemberPayment(memberId: number, targetRound?: number)` ; `markAllPaid(paid, targetRound?)` (semua entry) ; `setPaymentMode(mode: PaymentMode)`
  - `drawLottery(targetRound?): EntryWithOwner[]` — kandidat `drawCandidates`, pemenang `pickWinnerEntries`, tandai `entry.hasWon/wonInRound`, simpan `winnerIds` (entryId) di round, log "Selamat kepada: {displayEntryName}".
  - `resetCurrentRoundLottery(targetRound?)` — reset `hasWon` entry pemenang putaran tsb KECUALI entry yang juga menang di putaran lain.
  - `totalRounds` grup baru saat createGroup: `max(1, ceil(totalEntries / winnersCount))`.
  - `importBackup`: jalankan `migrateLegacyState` pada hasil parse format v2; jalur v1 membuat 1 entry per anggota (id = member.id) agar `payments`/`winnerIds` hasil konversi tetap cocok.
  - `DEMO_SAMPLE_GROUP` ikut format baru (tiap anggota 1 entry id = member.id, `paymentMode: 'per_entry'`).

- [ ] **Step 1: Implement** rewiring penuh (hapus logika lama berbasis memberId: filter `!m.hasWon`, map pemenang, dst).
- [ ] **Step 2: Checkpoint** — `npx vitest run` tetap hijau; `npx tsc --noEmit` error HANYA di file views/modals daftar Task 1 Step 5. `npm run build` BELUM wajib hijau di sini.

### Task 4: TableTab — Badge Undian, Iuran 2 Mode, Kelola Nama Undian

**Files:**
- Modify: `src/views/TableTab.tsx`

**Interfaces:**
- Consumes: `addEntry`, `removeEntry`, `togglePayment`, `toggleMemberPayment`, `setPaymentMode`, `activeGroup.paymentMode`, `memberDue`, `displayEntryName`, `unpaidEntries`, `sanitizeEntryNames`.

- [ ] **Step 1: Implement**:
  - Baris = anggota: nama asli + badge `N undian` + chips nama undian; nominal iuran baris = `memberDue`.
  - Kolom status: `per_entry` → tombol kecil per nama undian (panggil `togglePayment(entryId)`); `per_member` → 1 tombol utama memanggil `toggleMemberPayment(memberId)`; keduanya menampilkan ringkasan `x/y lunas`.
  - Header: pengalih mode iuran (2 tombol pill, panggil `setPaymentMode`) + label "Iuran per Nama Undian".
  - Aksi baris: tombol tambah nama undian → inline input + validasi (`sanitizeEntryNames` kosong → pesan error inline); tombol hapus per chip yang `!hasWon` (ikon trash, konfirmasi inline) memanggil `removeEntry`.
  - Counter tab Semua/Belum/Lunas & filter berbasis entry (`currentRound.payments[entry.id]`); pencarian mencakup nama undian.
- [ ] **Step 2: Checkpoint** — `npx tsc --noEmit`: error tersisa hanya di `LotteryTab.tsx`, `HomeTab.tsx`, `HistoryTab.tsx`, `WhatsAppReminderModal.tsx`, `WinnerAnnouncementModal.tsx`, `CreateArisanModal.tsx`; `npx vitest run` hijau.

### Task 5: LotteryTab — Undi per Nama Undian

**Files:**
- Modify: `src/views/LotteryTab.tsx`

**Interfaces:**
- Consumes: `drawCandidates`, `unpaidEntries`, `prizePerWinner`, `displayEntryName`, `drawLottery` (kini `EntryWithOwner[]`).

- [ ] **Step 1: Implement**:
  - Banner: `${drawCandidates(g).length} nama undian berkesempatan`; hadiah `prizePerWinner`.
  - Animasi roll: sampel nama dari `drawCandidates` via `displayEntryName`.
  - Gerbang lunas: `unpaidEntries(g, currentRound).length > 0` → kunci tombol (card peringatan lama dipertahankan, hitungan berbasis entry).
  - Daftar "Belum Pernah Menang": chip per entry (label `displayEntryName`).
  - `recentWinners: EntryWithOwner[]`; pemenang tampil `displayEntryName`; state `resetCurrentRoundLottery` & modal pemenang menerima daftar itu.
- [ ] **Step 2: Checkpoint** — `npx tsc --noEmit`: error tersisa hanya `HomeTab.tsx`, `HistoryTab.tsx`, `WhatsAppReminderModal.tsx`, `WinnerAnnouncementModal.tsx`, `CreateArisanModal.tsx`; `npx vitest run` hijau.

### Task 6: HomeTab + HistoryTab

**Files:**
- Modify: `src/views/HomeTab.tsx`, `src/views/HistoryTab.tsx`

**Interfaces:**
- Consumes: `displayEntryName`, `memberDue`, `totalEntries`, `unpaidEntries` (Task 2); data pemenang dari `round.winnerIds` via `findEntry`.

- [ ] **Step 1: Implement**:
  - HomeTab: pemenang terakhir & ringkasan memakai nama undian + pemilik; hitungan belum bayar & total tagihan dari entry (`unpaidEntries.length`, `dues × totalEntries − wages`).
  - HistoryTab: riwayat putaran me-render pemenang per entry (nama undian — pemilik); statistik "sudah menang" = jumlah entry `hasWon`; rekap teks WA memakai label entry.
- [ ] **Step 2: Checkpoint** — `npx tsc --noEmit`: error tersisa hanya `WhatsAppReminderModal.tsx`, `WinnerAnnouncementModal.tsx`, `CreateArisanModal.tsx`; `npx vitest run` hijau.

### Task 7: Modals + Pesan WhatsApp

**Files:**
- Modify: `src/components/modals/CreateArisanModal.tsx`, `src/components/modals/WinnerAnnouncementModal.tsx`, `src/components/modals/WhatsAppReminderModal.tsx`, `src/utils/whatsapp.ts`

**Interfaces:**
- Consumes: `createGroup` (kontrak Task 3, termasuk `paymentMode`), `memberDue`, `unpaidEntries`, `displayEntryName`, `totalPrize`, `prizePerWinner`.

- [ ] **Step 1: Implement**:
  - CreateArisanModal — Step 2: CustomSelect "Mode Pencatatan Iuran" (`per_entry`: "Per Nama Undian", `per_member`: "Per Orang Sekaligus") dengan 1 baris penjelasan; kirim ke `createGroup`. Step 3 manual: input opsional per baris "Nama undian (pisah koma)" → `entryNames`; helper text contoh `Sisil, Andi → 2 undian, iuran otomatis ×2`. Mode Tempel WA: helper text mengarahkan tambah alias via Tabel. Minimal peserta tetap 2 anggota.
  - WinnerAnnouncementModal: props `winners: EntryWithOwner[]`; tampil `displayEntryName` + identitas pemilik; pesan WA tetap memakai builder dari `whatsapp.ts`.
  - WhatsAppReminderModal & `whatsapp.ts`: reminder per anggota = daftar nama undian belum lunas + total `dues × (belum lunas milik anggota)`; pengumuman pemenang = daftar `displayEntryName`; tanda tangan tetap "ArisanKu".
- [ ] **Step 2: Checkpoint** — `npx tsc --noEmit` LENKAP tanpa error; `npx vitest run` hijau.

### Task 8: Teks Bantuan, README, Verifikasi Akhir

**Files:**
- Modify: `src/data/offlineFaq.ts`, `src/components/ui/TourGuide.tsx`, `src/components/ui/SpotlightTour.tsx`, `README.md`

- [ ] **Step 1: Implement**:
  - FAQ Bubu: tambah 1 QA "Bisa daftar lebih dari 1 undian?" (contoh Bu Siti → Sisil & Andi, iuran ×2, bisa menang per nama undian) + perbarui QA terkait undi/tabel bila menyebut "1 orang 1 nama".
  - TourGuide/SpotlightTour: selipkan 1 kalimat pengantar fitur di teks panduan tabel/undian.
  - README: section fitur baru di Ringkasan Fitur + 1 paragraf cara pakai.
- [ ] **Step 2: Verifikasi akhir** — `npx vitest run` hijau; `npm run build` **PASS**.
- [ ] **Step 3: Verifikasi manual (dev server)** — `npm run dev`, alur: buat arisan (Bu Siti + entryNames `Sisil, Andi`) → tabel tampil 2 undian iuran 200k → undi putaran 1 & putaran 2 lewat 2 nama berbeda (Sisil & Andi menang terpisah) → coba undi lagi: Sisil/Andi tidak muncul lagi sebagai kandidat → ganti mode iuran di header tabel: data per-entry tetap utuh → buat cadangan & impor kembali: data tetap utuh.
