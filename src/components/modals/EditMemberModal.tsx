import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useArisan } from '../../context/ArisanContext';
import { ArisanMember } from '../../types/arisan';
import { sanitizeEntryNames } from '../../utils/arisanStats';
import { formatRupiah } from '../../utils/currency';
import {
  X,
  Save,
  Plus,
  Trash2,
  User,
  Ticket,
  Crown,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';

interface EditMemberModalProps {
  isOpen: boolean;
  member: ArisanMember;
  dues: number;
  onClose: () => void;
  onSave: () => void;
}

export const EditMemberModal: React.FC<EditMemberModalProps> = ({
  isOpen,
  member,
  dues,
  onClose,
  onSave,
}) => {
  const { addEntry, removeEntry, renameEntry, updateMember } = useArisan();

  const [editName, setEditName] = useState(member.name);
  const [editPhone, setEditPhone] = useState(member.phone);
  const [entries, setEntries] = useState(
    member.entries.map((e) => ({ id: e.id, name: e.name, hasWon: e.hasWon })),
  );
  const [newEntryName, setNewEntryName] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const entryCount = entries.length;
  const memberTotal = dues * entryCount;

  const canRemove = (index: number): boolean =>
    entryCount > 1 && !entries[index].hasWon;

  const handleRenameEntry = (index: number, val: string) => {
    setEntries((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], name: val.trim() };
      return copy;
    });
    setError(null);
  };

  const handleRemoveEntry = (index: number) => {
    const target = entries[index];
    if (!canRemove(index)) return;
    const result = removeEntry(member.id, target.id);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setEntries((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const handleAddEntry = () => {
    const [clean] = sanitizeEntryNames([newEntryName]);
    if (!clean) {
      setError('Nama undian tidak boleh kosong ya, Bu!');
      return;
    }
    const duplicated = entries.some(
      (e) => e.name.trim().toLowerCase() === clean.toLowerCase(),
    );
    if (duplicated) {
      setError('Nama undian itu sudah ada untuk anggota ini, Bu.');
      return;
    }
    const result = addEntry(member.id, clean);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setEntries((prev) => [...prev, { id: -1, name: clean, hasWon: false }]);
    setNewEntryName('');
    setError(null);
  };

  const handleSave = () => {
    const nameClean = editName.trim();
    if (!nameClean) {
      setError('Nama peserta wajib diisi ya, Bu!');
      return;
    }

    // Validasi nama undian di dalam modal (non-kosong & unik)
    const cleaned = entries
      .map((e) => e.name.trim())
      .filter((n) => n.length > 0);
    if (cleaned.length === 0) {
      setError('Minimal harus ada 1 nama undian ya, Bu!');
      return;
    }
    const seen = new Set<string>();
    for (const n of cleaned) {
      const key = n.toLowerCase();
      if (seen.has(key)) {
        setError('Nama undian tidak boleh duplikat ya, Bu!');
        return;
      }
      seen.add(key);
    }

    // 1. Ubah nama/nomor WA anggota
    if (nameClean !== member.name || editPhone !== member.phone) {
      updateMember(member.id, { name: nameClean, phone: editPhone });
    }

    // 2. Ubah nama entri yang lama
    entries.forEach((e) => {
      const original = member.entries.find((o) => o.id === e.id);
      if (original && e.name.trim() !== original.name) {
        const res = renameEntry(member.id, e.id, e.name.trim());
        if (!res.ok) setError(res.message);
      }
    });

    // 3. Hapus entri yang sudah dihapus di modal (handleRemoveEntry sudah
    //    memanggil removeEntry saat diklik, jadi sisa di state adalah yang
    //    ingin dipertahankan). Tidak perlu aksi tambahan di sini.

    onSave();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 flex-shrink-0" />
            <div>
              <h3 className="font-extrabold text-base leading-tight">
                Edit Peserta
              </h3>
              <p className="text-xs text-emerald-100 font-medium">
                Ubah nama & nama undian
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white/90 hover:text-white transition"
            aria-label="Tutup">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="p-5 overflow-y-auto flex-1 flex flex-col space-y-4">
          {/* Nama Peserta */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Nama Peserta <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-4 py-3 text-sm rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>

          {/* No WA */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Nomor WhatsApp (opsional)
            </label>
            <input
              type="tel"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              className="w-full px-4 py-3 text-sm rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="081234567890"
            />
          </div>

          {/* Daftar Nama Undian */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  Nama Undian
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Minimal 1 nama undian. Tambah atau hapus sesuai keinginan.
                </p>
              </div>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                {entryCount} undian
              </span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {entries.map((entry, idx) => {
                const disabled = !canRemove(idx);
                return (
                  <div
                    key={String(entry.id)}
                    className="flex items-center gap-2">
                    <input
                      type="text"
                      value={entry.name}
                      onChange={(e) => handleRenameEntry(idx, e.target.value)}
                      className="flex-1 min-w-0 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                    />
                    {entry.hasWon && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300 flex-shrink-0">
                        <Crown className="w-2.5 h-2.5" /> Menang
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveEntry(idx)}
                      disabled={disabled}
                      title={
                        disabled
                          ? entryCount <= 1
                            ? 'Minimal 1 nama undian wajib tersisa'
                            : 'Nama undian yang sudah menang tidak boleh dihapus'
                          : 'Hapus nama undian'
                      }
                      className={`p-1.5 rounded-lg flex-shrink-0 transition ${
                        disabled
                          ? 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                          : 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                      }`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newEntryName}
                onChange={(e) => setNewEntryName(e.target.value)}
                placeholder="Tambah nama undian baru (cth: Budi)"
                className="flex-1 min-w-0 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
              />
              <button
                type="button"
                onClick={handleAddEntry}
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex-shrink-0 transition active:scale-95"
                title="Tambah nama undian">
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Pratinjau dana */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-tight">
                  Total Iuran Anggota per Putaran
                </span>
                <div className="text-lg font-black text-slate-800 dark:text-slate-100">
                  {formatRupiah(memberTotal)}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  {entryCount} nama undian
                </span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {formatRupiah(dues)} / undian
                </span>
              </div>
            </div>
            {entryCount > 1 && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                Dana otomatis dikalikan lipat jumlah undian anggota ini.
              </p>
            )}
          </div>

          {error && (
            <div className="text-xs text-rose-500 font-semibold flex items-center gap-1.5 animate-fadeIn">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </form>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/50">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800/50 transition">
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 transition active:scale-98">
            <Save className="w-4 h-4" />
            Simpan Perubahan
          </button>
        </div>
      </motion.div>
    </div>
  );
};
