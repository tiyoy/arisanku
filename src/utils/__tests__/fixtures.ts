import { ArisanGroup, ArisanMember, ArisanRound, ArisanEntry } from '../../types/arisan';

// Fixture sesuai plan Task 2: dues 100000, wages 50000, winnersCount 1.
// M1 (id 1): 1 entry id 1 "Bu Siti". M2 (id 2): 2 entries — id 2 "Sisil" (hasWon),
// id 3 "Andi".
export const fixtureGroup = (): ArisanGroup =>
  ({
    id: 'g1',
    name: 'Arisan RT 05',
    administrator: { manager: 'Ibu Nilma', wages: 50000 },
    dues: 100000,
    winnersCount: 1,
    periodType: 'bulanan',
    periodInterval: 1,
    paymentMode: 'per_entry',
    createdAt: '2026-01-01',
    currentRound: 1,
    members: [
      {
        id: 1,
        name: 'Bu Siti',
        phone: '081',
        entries: [{ id: 1, name: 'Bu Siti', hasWon: false }],
      },
      {
        id: 2,
        name: 'Bu Ani',
        phone: '082',
        entries: [
          { id: 2, name: 'Sisil', hasWon: true, wonInRound: 1 },
          { id: 3, name: 'Andi', hasWon: false },
        ],
      },
    ],
    rounds: {},
  }) as unknown as ArisanGroup;

export const round = (overrides: Partial<ArisanRound> = {}): ArisanRound => ({
  roundNumber: 1,
  isDrawn: false,
  winnerIds: [],
  payments: {},
  ...overrides,
});

export const entry = (id: number, name: string, hasWon = false): ArisanEntry => ({
  id,
  name,
  hasWon,
});

export const member = (
  id: number,
  name: string,
  entries: ArisanEntry[],
  phone = '',
): ArisanMember => ({ id, name, phone, entries });
