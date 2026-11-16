import { describe, it, expect } from 'vitest';
import { migrateLegacyState } from '../arisanMigration';
import { ArisanAppState } from '../../types/arisan';

const legacyState = (): ArisanAppState =>
  ({
    groups: [
      {
        id: 'g1',
        name: 'Arisan RT 05',
        administrator: { manager: 'Ibu Nilma', wages: 50000 },
        dues: 100000,
        winnersCount: 1,
        periodType: 'bulanan',
        periodInterval: 1,
        createdAt: '2026-01-01',
        currentRound: 1,
        members: [
          { id: 1, name: 'Ibu Siti', phone: '081', hasWon: true, wonInRound: 1 },
          { id: 2, name: 'Ibu Nurul', phone: '082', hasWon: false },
        ],
        rounds: {
          1: { roundNumber: 1, isDrawn: true, winnerIds: [1], payments: { 1: true } },
        },
      },
    ],
    activeGroupId: 'g1',
    activityLogs: [],
    theme: 'light',
  }) as unknown as ArisanAppState;

describe('migrateLegacyState', () => {
  it('membuat 1 entry per anggota dengan id & nama sama, membawa hasWon/wonInRound', () => {
    const s = migrateLegacyState(legacyState());
    const [m1, m2] = s.groups[0].members;
    expect(m1.entries).toEqual([
      { id: 1, name: 'Ibu Siti', hasWon: true, wonInRound: 1 },
    ]);
    expect(m2.entries).toEqual([
      { id: 2, name: 'Ibu Nurul', hasWon: false, wonInRound: undefined },
    ]);
    expect((m1 as unknown as Record<string, unknown>).hasWon).toBeUndefined();
  });

  it('mengisi paymentMode per_entry dan menjaga rounds apa adanya', () => {
    const s = migrateLegacyState(legacyState());
    expect(s.groups[0].paymentMode).toBe('per_entry');
    expect(s.groups[0].rounds[1]).toEqual({
      roundNumber: 1,
      isDrawn: true,
      winnerIds: [1],
      payments: { 1: true },
    });
  });

  it('idempoten', () => {
    const once = migrateLegacyState(legacyState());
    expect(migrateLegacyState(once)).toEqual(once);
  });

  it('entries array kosong / bukan array tetap dimigrasi', () => {
    const s = legacyState();
    (s.groups[0].members[0] as unknown as Record<string, unknown>).entries = [];
    const out = migrateLegacyState(s);
    expect(out.groups[0].members[0].entries).toHaveLength(1);
    expect(out.groups[0].members[0].entries[0].name).toBe('Ibu Siti');
  });

  it('grup tanpa paymentMode tapi entries sudah valid tetap lolos tanpa perubahan entries', () => {
    const s = legacyState();
    s.groups[0].members = [
      {
        id: 1,
        name: 'Ibu Siti',
        phone: '081',
        entries: [{ id: 1, name: 'Sisil', hasWon: true, wonInRound: 1 }],
      },
    ];
    const out = migrateLegacyState(s);
    expect(out.groups[0].members[0].entries).toEqual([
      { id: 1, name: 'Sisil', hasWon: true, wonInRound: 1 },
    ]);
    expect(out.groups[0].paymentMode).toBe('per_entry');
  });
});
