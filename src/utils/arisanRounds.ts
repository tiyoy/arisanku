import { ArisanGroup, ArisanMember, ArisanRound } from '../types/arisan';

/** Ubah status lunas satu entry (key payments = entry id). */
export const withEntryPayment = (
  round: ArisanRound,
  entryId: number,
  paid: boolean,
): ArisanRound => ({
  ...round,
  payments: { ...round.payments, [entryId]: paid },
});

/** Ubah status lunas SEMUA entry milik satu anggota (mode per_member). */
export const withMemberPayments = (
  round: ArisanRound,
  member: ArisanMember,
  paid: boolean,
): ArisanRound => {
  const payments = { ...round.payments };
  member.entries.forEach((e) => {
    payments[e.id] = paid;
  });
  return { ...round, payments };
};

/** Ubah status lunas SEMUA entry grup (tandai semua / reset). */
export const withAllPayments = (
  round: ArisanRound,
  group: ArisanGroup,
  paid: boolean,
): ArisanRound => {
  const payments = { ...round.payments };
  group.members.forEach((m) =>
    m.entries.forEach((e) => {
      payments[e.id] = paid;
    }),
  );
  return { ...round, payments };
};
