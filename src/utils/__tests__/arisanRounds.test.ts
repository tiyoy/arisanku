import { describe, it, expect } from 'vitest';
import { withEntryPayment, withMemberPayments, withAllPayments } from '../arisanRounds';
import { fixtureGroup, round } from './fixtures';

// Semantik pembayaran mengikuti app lama: status disimpan sebagai boolean
// (true/false), bukan dengan menghapus key — seluruh UI membaca
// `!!round.payments[id]` sehingga `false` dan `undefined` setara.
describe('operasi pembayaran per putaran (key = entry id)', () => {
  it('withEntryPayment hanya mengubah entry yang dituju', () => {
    const out = withEntryPayment(round({ payments: { 1: true } }), 3, true);
    expect(out.payments).toEqual({ 1: true, 3: true });
    expect(out.roundNumber).toBe(1);
  });

  it('withEntryPayment false mengubah status menjadi belum lunas', () => {
    const out = withEntryPayment(round({ payments: { 1: true, 3: true } }), 3, false);
    expect(out.payments).toEqual({ 1: true, 3: false });
  });

  it('withMemberPayments mengubah semua entry milik anggota tersebut', () => {
    const g = fixtureGroup();
    const out = withMemberPayments(round({ payments: { 1: true } }), g.members[1], true);
    expect(out.payments).toEqual({ 1: true, 2: true, 3: true });
  });

  it('withMemberPayments false membatalkan semua entry anggota itu', () => {
    const g = fixtureGroup();
    const out = withMemberPayments(
      round({ payments: { 1: true, 2: true, 3: true } }),
      g.members[1],
      false,
    );
    expect(out.payments).toEqual({ 1: true, 2: false, 3: false });
  });

  it('withAllPayments mengubah seluruh entry di grup', () => {
    const g = fixtureGroup();
    const out = withAllPayments(round(), g, true);
    expect(out.payments).toEqual({ 1: true, 2: true, 3: true });
    const cleared = withAllPayments(
      round({ payments: { 1: true, 2: true, 3: true } }),
      g,
      false,
    );
    expect(cleared.payments).toEqual({ 1: false, 2: false, 3: false });
  });
});
