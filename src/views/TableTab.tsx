import React, { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  ColumnDef,
  flexRender,
} from '@tanstack/react-table';
import { useArisan } from '../context/ArisanContext';
import { ArisanMember, ArisanEntry } from '../types/arisan';
import { formatRupiah } from '../utils/currency';
import { totalEntries, unpaidEntries, findEntry, displayEntryName } from '../utils/arisanStats';
import { CustomSelect, SelectOption } from '../components/ui/CustomSelect';
import { EditMemberModal } from '../components/modals/EditMemberModal';
import {
  Search,
  XCircle,
  Crown,
  Send,
  CheckCheck,
  RotateCcw,
  UserPlus,
  Phone,
  AlertCircle,
  Ticket,
  Edit,
} from 'lucide-react';

interface TableTabProps {
  onOpenReminderModal: () => void;
}

export const TableTab: React.FC<TableTabProps> = ({ onOpenReminderModal }) => {
  const {
    activeGroup,
    setRound,
    toggleMemberPayment,
    markAllPaid,
    addMember,
    removeMember,
    updateMember,
    toggleEntryWon,
  } = useArisan();

  const [globalFilter, setGlobalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
const [showAddMember, setShowAddMember] = useState(false);
const [newMemberName, setNewMemberName] = useState('');
const [newMemberPhone, setNewMemberPhone] = useState('');
const [newMemberUndian, setNewMemberUndian] = useState('');
const [addMemberError, setAddMemberError] = useState<string | null>(null);
const [showEditMember, setShowEditMember] = useState(false);
const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
const editingMember = editingMemberId
  ? activeGroup.members.find((m) => m.id === editingMemberId)
  : null;

  if (!activeGroup) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center text-slate-500">
        Silakan pilih atau buat arisan terlebih dahulu.
      </div>
    );
  }

  const currentRoundNum = activeGroup.currentRound;
  const currentRound = activeGroup.rounds[currentRoundNum] || {
    roundNumber: currentRoundNum,
    isDrawn: false,
    winnerIds: [],
    payments: {},
  };

  // Member terpilih seluruhnya lunas di putaran ini (setiap entri).
  const isMemberPaid = (member: ArisanMember): boolean =>
    member.entries.every((e) => !!currentRound.payments[e.id]);

  // Filter members based on status filter & global search
  const filteredData = useMemo(() => {
    return activeGroup.members.filter((member) => {
      const paid = isMemberPaid(member);
      if (statusFilter === 'paid' && !paid) return false;
      if (statusFilter === 'unpaid' && paid) return false;

      if (globalFilter.trim()) {
        const query = globalFilter.toLowerCase();
        const hasMatch =
          member.name.toLowerCase().includes(query) ||
          (member.phone && member.phone.includes(query)) ||
          member.entries.some((e) => e.name.toLowerCase().includes(query));
        return hasMatch;
      }
      return true;
    });
  }, [activeGroup.members, currentRound.payments, statusFilter, globalFilter]);

  const totalMembers = activeGroup.members.length;
  const paidMembersCount = filteredData.filter(isMemberPaid).length;
  const unpaidMembersCount = totalMembers - paidMembersCount;

  // Total uang terkumpul (entri yang lunas × iuran per entri)
  const paidEntryCount = totalEntries(activeGroup) - unpaidEntries(activeGroup, currentRound).length;
  const collectedAmount = paidEntryCount * activeGroup.dues;
  const targetAmount = totalEntries(activeGroup) * activeGroup.dues;

  // Define TanStack Table columns
  const columns = useMemo<ColumnDef<ArisanMember>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'No',
        cell: (info) => (
          <span className="font-bold text-slate-400 text-xs">{info.row.index + 1}.</span>
        ),
      },
      {
        accessorKey: 'name',
        header: 'Nama Peserta',
        cell: (info) => {
          const member = info.row.original;
          const entryCount = member.entries.length;
          const entryDue = entryCount * activeGroup.dues;
          const wonEntries = member.entries.filter((e) => e.hasWon);
          return (
            <div className="min-w-0">
          <div className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-1.5">
            <span className="min-w-0 truncate">{member.name}</span>
            <button
              type="button"
              onClick={() => {
                setEditingMemberId(member.id);
                setShowEditMember(true);
              }}
              className="ml-1 p-1 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded hover:bg-slate-100 dark:hover:bg-slate-700/40 transition flex-shrink-0"
              title="Edit nama & undian anggota">
              <Edit className="w-3 h-3" />
            </button>
          </div>
                {entryCount > 1 && (
                  <span
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold flex-shrink-0"
                  >
                    <Ticket className="w-2.5 h-2.5 flex-shrink-0" />
                    {entryCount} undian
                  </span>
                )}
                {wonEntries.length > 0 && (
                  <span
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 text-[10px] font-extrabold flex-shrink-0"
                    title={`Pemenang Putaran ke-${wonEntries[0].wonInRound || ''}`}
                  >
                    <Crown className="w-2.5 h-2.5 text-amber-500 fill-amber-400" />
                    Menang
                  </span>
                )}
              {member.phone && (
                <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                  <Phone className="w-3 h-3 text-slate-400" />
                  {member.phone}
                </div>
              )}
              <div className="flex flex-wrap gap-1 mt-1">
                {member.entries.map((e) => {
                  const found = findEntry(activeGroup, e.id);
                  const label = found ? displayEntryName(found) : e.name;
                  const isPaid = !!currentRound.payments[e.id];
                  return (
                    <span
                      key={e.id}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium border flex-shrink-0 cursor-pointer transition ${
                        e.hasWon
                          ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-700/60 hover:bg-amber-100'
                          : isPaid
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-700/60 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-300 dark:border-rose-700/60 hover:bg-rose-100'
                      }`}
                      onClick={() => toggleEntryWon(member.id, e.id)}
                      title={
                        e.hasWon
                          ? `Sudah menang (Putaran ${e.wonInRound}) — klik untuk batal`
                          : `Tandai ${label} sudah menang — klik untuk tandai`
                      }
                    >
                      {e.hasWon ? '✔👑 ' : '✔ '}{label}
                    </span>
                  );
                })}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                {entryCount} × {formatRupiah(activeGroup.dues)} = {formatRupiah(entryDue)}
                / putaran
              </div>
            </div>
          );
        },
      },
      {
        id: 'paymentStatus',
        header: 'Status Iuran',
        cell: (info) => {
          const member = info.row.original;
          const paidEntries = member.entries.filter((e) => !!currentRound.payments[e.id]);
          const isPaid = paidEntries.length === member.entries.length;

          return (
            <button
              onClick={() => toggleMemberPayment(member.id)}
              className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-sm min-h-[38px] ${
                isPaid
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 hover:bg-emerald-200'
                  : paidEntries.length > 0
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 hover:bg-amber-200'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 hover:bg-rose-200'
              }`}
              title="Klik untuk mengubah status pembayaran semua nama undian anggota ini">
              {isPaid ? (
                <>
                  <span className="font-bold">Lunas</span>
                </>
              ) : paidEntries.length > 0 ? (
                <>
                  <span className="font-bold">Sebagian</span>
                </>
              ) : (
                <>
                  <span className="font-bold">Belum</span>
                </>
              )}
              <span>{paidEntries.length}/{member.entries.length} Nama</span>
            </button>
          );
        },
      },
    ],
    [currentRound.payments, toggleMemberPayment, activeGroup.dues]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const roundOptions: SelectOption[] = Object.keys(activeGroup.rounds).map(
    (r) => ({
      value: parseInt(r, 10),
      label: `Putaran ke-${r}${
        activeGroup.rounds[parseInt(r, 10)]?.isDrawn ? ' ✓ (Selesai)' : ''
      }`,
      description: activeGroup.rounds[parseInt(r, 10)]?.isDrawn
        ? 'Pemenang sudah diundi'
        : 'Sedang berjalan',
    })
  );

  const handleCreateMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) {
      setAddMemberError('Nama peserta wajib diisi ya, Bu!');
      return;
    }
    const entryNames =
      parseUndianInput(newMemberUndian).length > 0
        ? parseUndianInput(newMemberUndian)
        : undefined;
    addMember({ name: newMemberName.trim(), phone: newMemberPhone.trim(), entryNames });
    setNewMemberName('');
    setNewMemberPhone('');
    setNewMemberUndian('');
    setAddMemberError(null);
    setShowAddMember(false);
  };

  const parseUndianInput = (text: string): string[] => {
    return text.split(',').map((t) => t.trim()).filter(Boolean);
  };

  const undianCountPreview = parseUndianInput(newMemberUndian).length || 1;

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-3 pb-24 space-y-3 animate-fadeIn">
      {/* Top Controls: Round Picker with CustomSelect */}
      <div className="p-4 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3">
        <div className="flex-1">
          <CustomSelect
            label="Pilih Putaran Arisan"
            value={currentRoundNum}
            onChange={(val) => setRound(Number(val))}
            options={roundOptions}
          />
        </div>

        <div className="text-right pt-5">
          <span className="text-[10px] text-slate-400 block font-medium">
            Iuran per Nama Undian
          </span>
          <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
            {formatRupiah(activeGroup.dues)}
          </span>
        </div>
      </div>

      {/* Summary cards: total uang & terkumpul */}
      <div className="grid grid-cols-2 gap-3 px-1">
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-700/60">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">
            Total Nama Undian
          </span>
          <span className="text-base font-extrabold text-slate-800 dark:text-slate-100">
            {totalEntries(activeGroup)} Nama
          </span>
        </div>
        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50">
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold block">
            Terkumpul / Putaran Ini
          </span>
          <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-300">
            {formatRupiah(collectedAmount)}
          </span>
        </div>
      </div>

      {/* Search Bar & Add Button */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama peserta atau nama undian..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-800 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
          />
        </div>

        <button
          onClick={() => setShowAddMember(!showAddMember)}
          className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 transition flex items-center gap-1 text-xs font-bold shadow-sm"
          title="Tambah Peserta Baru">
          <UserPlus className="w-4 h-4" />
        </button>
      </div>

      {/* Form Tambah Peserta Cepat (Collapsible) */}
      {showAddMember && (
        <form
          onSubmit={handleCreateMember}
          className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 space-y-2.5 animate-fadeIn text-left">
          <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
            + Tambah Anggota Baru ke Arisan
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Nama Peserta (cth: Ibu Linda)"
              value={newMemberName}
              onChange={(e) => {
                setNewMemberName(e.target.value);
                setAddMemberError(null);
              }}
              className={`flex-1 px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border text-slate-900 dark:text-slate-100 focus:outline-none font-medium ${
                addMemberError
                  ? 'border-2 border-rose-500'
                  : 'border-slate-200 dark:border-slate-700 focus:ring-1 focus:ring-emerald-500'
              }`} />
            <input
              type="tel"
              placeholder="No WA (opsional)"
              value={newMemberPhone}
              onChange={(e) => setNewMemberPhone(e.target.value)}
              className="w-24 px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            <input
              type="text"
              placeholder="Nama undian (pisahkan koma, cth: Sisil, Andi)"
              value={newMemberUndian}
              onChange={(e) => {
                setNewMemberUndian(e.target.value);
                setAddMemberError(null);
              }}
              className="flex-1 min-w-0 px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium" />
          </div>
          {newMemberName.trim() && (
            <div className="text-[11px] flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
              {undianCountPreview} undian × {formatRupiah(activeGroup.dues)} ={" "}
              {formatRupiah(undianCountPreview * activeGroup.dues)}
            </div>
          )}

          {addMemberError && (
            <div className="text-xs text-rose-500 font-semibold flex items-center gap-1.5 animate-fadeIn">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{addMemberError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setShowAddMember(false);
                setAddMemberError(null);
              }}
              className="px-3 py-1.5 text-xs text-slate-500 font-semibold hover:text-slate-700">
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs bg-emerald-600 text-white rounded-xl font-bold shadow-sm hover:bg-emerald-700">
              Simpan
            </button>
          </div>
        </form>
      )}

      {/* Filter Tabs: Semua, Belum Bayar, Lunas */}
      <div className="flex bg-slate-100 dark:bg-slate-800/70 p-1 rounded-2xl gap-1 text-xs">
        <button
          onClick={() => setStatusFilter('all')}
          className={`flex-1 py-1.5 rounded-xl font-bold transition flex items-center justify-center gap-1 ${
            statusFilter === 'all'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}>
          Semua ({totalMembers})
        </button>

        <button
          onClick={() => setStatusFilter('unpaid')}
          className={`flex-1 py-1.5 rounded-xl font-bold transition flex items-center justify-center gap-1 ${
            statusFilter === 'unpaid'
              ? 'bg-rose-500 text-white shadow-sm'
              : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50/50'
          }`}>
          Belum ({unpaidMembersCount})
        </button>

        <button
          onClick={() => setStatusFilter('paid')}
          className={`flex-1 py-1.5 rounded-xl font-bold transition flex items-center justify-center gap-1 ${
            statusFilter === 'paid'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50/50'
          }`}>
          Lunas ({paidMembersCount})
        </button>
      </div>

      {/* Bulk Actions for Bendahara */}
      <div className="flex items-center justify-between text-xs px-1">
        <div className="flex items-center gap-2">
          <button
            onClick={() => markAllPaid(true)}
            className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:underline"
            title="Tandai semua nama undian lunas di putaran ini">
            <CheckCheck className="w-3.5 h-3.5" />
            Tandai Semua Lunas
          </button>
          <span className="text-slate-300">|</span>
          <button
            onClick={() => markAllPaid(false)}
            className="text-[11px] font-medium text-slate-500 hover:text-rose-500 flex items-center gap-1"
            title="Reset pembayaran ke belum bayar">
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </div>

        {unpaidMembersCount > 0 && (
          <button
            onClick={onOpenReminderModal}
            className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
            <Send className="w-3 h-3" />
            Kirim Tagihan WA
          </button>
        )}
      </div>

      {/* TanStack Table Card Container */}
      <div
        data-tour="table-section"
        className="bg-white dark:bg-slate-800/90 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {table.getRowModel().rows.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Tidak ada peserta yang cocok dengan filter atau pencarian.
            </div>
          ) : (
            table.getRowModel().rows.map((row) => (
              <div
                key={row.id}
                className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-700/20 transition">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {flexRender(row.getVisibleCells()[0].column.columnDef.cell, row.getVisibleCells()[0].getContext())}
                  {flexRender(row.getVisibleCells()[1].column.columnDef.cell, row.getVisibleCells()[1].getContext())}
                </div>
                <div className="flex-shrink-0">
                  {flexRender(row.getVisibleCells()[2].column.columnDef.cell, row.getVisibleCells()[2].getContext())}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Target total reminder */}
      <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-2 text-xs">
        <span className="text-slate-500 dark:text-slate-400">
          Target total iuran putaran ini:
        </span>
        <span className="font-extrabold text-slate-800 dark:text-slate-100">
          {formatRupiah(targetAmount)}
        </span>
        {activeGroup.administrator.wages > 0 && (
          <span className="text-slate-400 text-[10px]">
            (termasuk kas pengelola {formatRupiah(activeGroup.administrator.wages)})
          </span>
        )}
      </div>

      {/* Modal Edit Peserta */}
      {editingMember && (
        <EditMemberModal
          isOpen={showEditMember}
          member={editingMember}
          dues={activeGroup.dues}
          onClose={() => {
            setShowEditMember(false);
            setEditingMemberId(null);
          }}
          onSave={() => {
            setShowEditMember(false);
            setEditingMemberId(null);
          }}
        />
      )}
    </div>
  );
};
