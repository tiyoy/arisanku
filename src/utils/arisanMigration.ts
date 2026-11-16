import { ArisanAppState, ArisanEntry, ArisanGroup, ArisanMember } from '../types/arisan';

/**
 * Migrasi data lama ke format multi-undian (entries tersarang di member).
 * - Member tanpa entries (atau entries bukan array/kosong) -> 1 entry dengan
 *   id = member.id dan nama = nama member, sehingga riwayat payments/winnerIds
 *   lama (yang memakai member id) tetap cocok tanpa perubahan.
 * - Grup tanpa paymentMode -> 'per_entry'.
 * - Idempoten: state format baru lolos tanpa perubahan.
 */
export function migrateLegacyState(state: ArisanAppState): ArisanAppState {
  const groups: ArisanGroup[] = state.groups.map((group) => {
    const members: ArisanMember[] = group.members.map((member) => {
      const raw = member as ArisanMember & { hasWon?: boolean; wonInRound?: number };
      const validEntries = Array.isArray(member.entries) && member.entries.length > 0;
      if (validEntries) return member;

      const entry: ArisanEntry = {
        id: member.id,
        name: member.name,
        hasWon: !!raw.hasWon,
        wonInRound: raw.wonInRound,
      };
      const { hasWon: _h, wonInRound: _w, ...rest } = raw;
      void _h;
      void _w;
      return { ...rest, entries: [entry] } as ArisanMember;
    });

    return {
      ...group,
      paymentMode: group.paymentMode ?? 'per_entry',
      members,
    };
  });

  return { ...state, groups };
}
