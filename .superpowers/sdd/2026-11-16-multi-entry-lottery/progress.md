# SDD ledger — plan: docs/superpowers/plans/2026-11-16-multi-entry-lottery.md

Setup rulings:
- Ruling: Project bukan repo git → tidak ada worktree/branch/commit; checkpoint verifikasi per task menggantikan commit (disetujui di Global Constraints plan & disetujui user saat review plan). Workspace ledger dibuat manual di `<project>/.superpowers/sdd/2026-11-16-multi-entry-lottery/` karena skrip sdd-workspace tidak tersedia. — Cost if wrong: riwayat hanya di ledger + file, bukan git log.

Pre-flight scan (shared interfaces):
- T1→T2: tipe ArisanEntry/PaymentMode/entries/paymentMode — konsisten.
- T1+T2→T3: migrateLegacyState + selektor/round ops — konsisten dengan kontrak context.
- T3→T4/T5/T6/T7: kontrak context (createGroup+paymentMode, addEntry/removeEntry {ok,message}, togglePayment(entryId), toggleMemberPayment, drawLottery→EntryWithOwner[], setPaymentMode) — konsisten.
- T2→T5/T6/T7: displayEntryName/memberDue/unpaidEntries/drawCandidates/prizePerWinner/totalEntries/findEntry — konsisten.
- Checkpoint tsc: urutan error mengecil (Table→Lottery→Home/History→Modals) — konsisten.
- Hasil: TIDAK ada konflik.

Task 1: complete (tests: npx vitest run → 5/5 pass; checkpoint tsc: error hanya di ArisanContext.tsx, HistoryTab.tsx, LotteryTab.tsx, TableTab.tsx — sesuai daftar yang belum diubah; Ruling kecil: syntax test `as typeof s.groups[0].members` tidak diparse tsc → dihapus, plus 2 cast `as unknown as Record<string, unknown>` karena TS2352)

Task 2: complete (tests: npx vitest run → 25/5 pass: 5 migrasi + 15 stats + 5 rounds; Ruling: (1) test prizePerWinner — `wages` wajib bersarang di `administrator.wages` sesuai tipe, blok test plan ambigu; (2) semantik pembayaran `false` = SET false bukan hapus key, mengikuti app lama karena seluruh UI membaca `!!payments[id]`, pembersihan key hanya di removeEntry (Task 3); (3) fixture dipindah ke `__tests__/fixtures.ts` agar describe tidak ikut tereksekusi saat diimpor file test lain)
