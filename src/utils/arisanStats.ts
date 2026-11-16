import {
  ArisanEntry,
  ArisanGroup,
  ArisanMember,
  ArisanRound,
} from '../types/arisan';

export interface EntryWithOwner {
  entry: ArisanEntry;
  member: ArisanMember;
}

/** Jumlah seluruh nama undian di grup (Σ member.entries.length). */
export const totalEntries = (g: ArisanGroup): number =>
  g.members.reduce((sum, m) => sum + m.entries.length, 0);

/** Iuran satu anggota di satu putaran = dues × jumlah nama undian miliknya. */
export const memberDue = (g: ArisanGroup, m: ArisanMember): number =>
  g.dues * m.entries.length;

/** Total hadiah kotor grup = dues × totalEntries − uang kas pengelola. */
export const totalPrize = (g: ArisanGroup): number =>
  g.dues * totalEntries(g) - g.administrator.wages;

/** Hadiah bersih per pemenang per putaran. */
export const prizePerWinner = (g: ArisanGroup): number =>
  Math.floor(totalPrize(g) / Math.max(1, g.winnersCount));

/** Jumlah putaran yang dibutuhkan agar semua nama undian menang sekali. */
export const totalRoundsNeeded = (g: ArisanGroup): number =>
  Math.max(1, Math.ceil(totalEntries(g) / Math.max(1, g.winnersCount)));

/** Semua entry di putaran yang belum lunas. */
export const unpaidEntries = (g: ArisanGroup, round: ArisanRound): ArisanEntry[] =>
  g.members.flatMap((m) => m.entries.filter((e) => !round.payments[e.id]));

/** Id semua entry yang pernah menang di putaran mana pun yang sudah diundi. */
const recordedWinnerIds = (g: ArisanGroup): Set<number> => {
  const ids = new Set<number>();
  Object.values(g.rounds).forEach((r) => {
    if (r.isDrawn) (r.winnerIds || []).forEach((id) => ids.add(id));
  });
  return ids;
};

/**
 * Kandidat undian: entry yang BELUM pernah menang.
 * Proteksi ganda (spec §5): flag hasWon + catatan winnerIds semua putaran yang
 * sudah diundi, agar data impor yang tidak sinkron tetap tidak bisa menang 2x.
 */
export const drawCandidates = (g: ArisanGroup): ArisanEntry[] => {
  const previousWinners = recordedWinnerIds(g);
  return g.members
    .flatMap((m) => m.entries)
    .filter((e) => !e.hasWon && !previousWinners.has(e.id));
};

/** Pilih pemenang secara acak dari kandidat (maks winnersCount, maks kandidat). */
export const pickWinnerEntries = (
  candidates: ArisanEntry[],
  winnersCount: number,
): ArisanEntry[] => {
  if (candidates.length === 0) return [];
  const shuffled = [...candidates].sort(() => 0.5 - Math.random());
  const count = Math.min(Math.max(1, winnersCount), candidates.length);
  return shuffled.slice(0, count);
};

/** ID untuk entry baru: max entry id di grup + 1. */
export const nextEntryId = (g: ArisanGroup): number =>
  g.members.reduce((max, m) => Math.max(max, ...m.entries.map((e) => e.id)), 0) + 1;

/** Bersihkan daftar nama undian: trim, buang kosong, dedupe case-insensitive. */
export const sanitizeEntryNames = (names: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  names.forEach((raw) => {
    const name = raw.trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(name);
  });
  return out;
};

/** Cari entry + pemiliknya berdasarkan entry id. */
export const findEntry = (g: ArisanGroup, entryId: number): EntryWithOwner | null => {
  for (const member of g.members) {
    const entry = member.entries.find((e) => e.id === entryId);
    if (entry) return { entry, member };
  }
  return null;
};

/**
 * Label tampilan nama undian: bila anggota punya >1 undian, tampilkan
 * "Nama Undian (Nama Pemilik)"; bila hanya 1, cukup nama anggota.
 */
export const displayEntryName = (e: EntryWithOwner): string =>
  e.member.entries.length > 1 ? `${e.entry.name} (${e.member.name})` : e.member.name;
