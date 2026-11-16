import { describe, it, expect } from 'vitest';
import {
  totalEntries,
  memberDue,
  totalPrize,
  prizePerWinner,
  totalRoundsNeeded,
  unpaidEntries,
  drawCandidates,
  pickWinnerEntries,
  nextEntryId,
  sanitizeEntryNames,
  findEntry,
  displayEntryName,
  EntryWithOwner,
} from '../arisanStats';
import { ArisanGroup } from '../../types/arisan';
import { fixtureGroup, round } from './fixtures';

describe('statistik grup multi-undian', () => {
  it('totalEntries menjumlahkan seluruh entry', () => {
    expect(totalEntries(fixtureGroup())).toBe(3);
  });

  it('memberDue = dues × jumlah entry anggota', () => {
    const g = fixtureGroup();
    expect(memberDue(g, g.members[1])).toBe(200000);
    expect(memberDue(g, g.members[0])).toBe(100000);
  });

  it('dana iuran anggota dengan multi-undian dikalikan lipat jumlah undian (studi kasus Bu Siti: 2 undian × 100k = 200k)', () => {
    const g = {
      ...fixtureGroup(),
      members: [
        {
          id: 1,
          name: 'Bu Siti',
          phone: '081',
          entries: [
            { id: 1, name: 'Sisil', hasWon: false },
            { id: 2, name: 'Andi', hasWon: false },
          ],
        },
      ],
    } as ArisanGroup;
    expect(memberDue(g, g.members[0])).toBe(200000);
    expect(totalPrize(g)).toBe(100000 * 2 - g.administrator.wages);
  });

  it('totalPrize = dues × totalEntries − wages', () => {
    expect(totalPrize(fixtureGroup())).toBe(250000);
  });

  it('prizePerWinner = floor(totalPrize / winnersCount)', () => {
    const base = fixtureGroup();
    const g = {
      ...base,
      winnersCount: 2,
      administrator: { ...base.administrator, wages: 0 },
    } as ArisanGroup;
    // 100000 * 3 / 2 = 150000
    expect(prizePerWinner(g)).toBe(150000);
  });

  it('totalRoundsNeeded = ceil(totalEntries / winnersCount), minimal 1', () => {
    expect(totalRoundsNeeded({ ...fixtureGroup(), winnersCount: 1 } as ArisanGroup)).toBe(3);
    expect(totalRoundsNeeded({ ...fixtureGroup(), winnersCount: 2 } as ArisanGroup)).toBe(2);
    expect(totalRoundsNeeded({ ...fixtureGroup(), winnersCount: 5 } as ArisanGroup)).toBe(1);
  });

  it('unpaidEntries mengembalikan entry yang belum lunas', () => {
    const g = fixtureGroup();
    expect(unpaidEntries(g, round({ payments: { 1: true } })).map((e) => e.id)).toEqual([2, 3]);
    expect(unpaidEntries(g, round())).toHaveLength(3);
  });
});

describe('drawCandidates (anti menang 2x per entry)', () => {
  it('mengeliminasi entry yang hasWon', () => {
    expect(drawCandidates(fixtureGroup()).map((e) => e.id)).toEqual([1, 3]);
  });

  it('mengeliminasi entry yang tercatat winnerIds di putaran yang sudah diundi walau hasWon false (proteksi data impor)', () => {
    const g = fixtureGroup();
    (g.members[0].entries[0] as { hasWon: boolean }).hasWon = false; // id 1 belum "resmi"
    g.rounds = { 1: round({ isDrawn: true, winnerIds: [1] }) };
    expect(drawCandidates(g).map((e) => e.id)).toEqual([3]);
  });
});

describe('pickWinnerEntries', () => {
  it('mengembalikan jumlah pemenang sesuai winnersCount, unik, subset kandidat', () => {
    const candidates = drawCandidates(fixtureGroup());
    const picked = pickWinnerEntries(candidates, 2);
    expect(picked).toHaveLength(2);
    const ids = new Set(picked.map((p) => p.id));
    expect(ids.size).toBe(2);
    picked.forEach((p) => expect(candidates).toContain(p));
  });

  it('winnersCount melebihi kandidat → ambil semua kandidat', () => {
    const candidates = drawCandidates(fixtureGroup());
    expect(pickWinnerEntries(candidates, 99)).toHaveLength(candidates.length);
  });

  it('kandidat kosong → array kosong', () => {
    expect(pickWinnerEntries([], 1)).toEqual([]);
  });
});

describe('utilitas entry', () => {
  it('nextEntryId = max entry id + 1', () => {
    expect(nextEntryId(fixtureGroup())).toBe(4);
  });

  it('sanitizeEntryNames: trim, buang kosong, dedupe case-insensitive', () => {
    expect(sanitizeEntryNames([' Sisil ', '', '  ', 'sisil', 'Andi'])).toEqual([
      'Sisil',
      'Andi',
    ]);
    expect(sanitizeEntryNames(['   '])).toEqual([]);
  });

  it('findEntry menemukan entry + pemilik; null jika tidak ada', () => {
    const g = fixtureGroup();
    const found: EntryWithOwner | null = findEntry(g, 3);
    expect(found?.member.id).toBe(2);
    expect(found?.entry.name).toBe('Andi');
    expect(findEntry(g, 999)).toBeNull();
  });

  it('displayEntryName: alias tampil dengan pemilik, nama tunggal tampil polos', () => {
    const g = fixtureGroup();
    const sisil = findEntry(g, 2)!;
    const m1 = findEntry(g, 1)!;
    expect(displayEntryName(sisil)).toBe('Sisil (Bu Ani)');
    expect(displayEntryName(m1)).toBe('Bu Siti');
  });
});
