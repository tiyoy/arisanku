import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from "react";
import {
  ArisanAppState,
  ArisanGroup,
  ArisanMember,
  ArisanActivityLog,
  ArisanRound,
  PaymentMode,
} from "../types/arisan";
import { sound } from "../utils/sound";
import { migrateLegacyState } from "../utils/arisanMigration";
import {
  EntryWithOwner,
  displayEntryName,
  drawCandidates,
  findEntry,
  nextEntryId,
  pickWinnerEntries,
  sanitizeEntryNames,
  totalEntries,
  totalRoundsNeeded,
} from "../utils/arisanStats";
import {
  withAllPayments,
  withEntryPayment,
  withMemberPayments,
} from "../utils/arisanRounds";

interface NewMemberInput {
  name: string;
  phone?: string;
  entryNames?: string[];
}

interface ArisanContextType {
  state: ArisanAppState;
  activeGroup: ArisanGroup | null;
  createGroup: (data: {
    name: string;
    manager: string;
    wages: number;
    dues: number;
    winnersCount: number;
    periodType: "mingguan" | "bulanan" | "harian";
    paymentMode: PaymentMode;
    members: NewMemberInput[];
  }) => void;
  updateGroup: (group: ArisanGroup) => void;
  deleteGroup: (groupId: string) => void;
  setActiveGroupId: (id: string) => void;
  setRound: (roundNumber: number) => void;
  togglePayment: (entryId: number, targetRound?: number) => void;
  toggleMemberPayment: (memberId: number, targetRound?: number) => void;
  markAllPaid: (paid: boolean, targetRound?: number) => void;
  drawLottery: (targetRound?: number) => EntryWithOwner[];
  resetCurrentRoundLottery: (targetRound?: number) => void;
  addMember: (member: NewMemberInput) => void;
  removeMember: (memberId: number) => void;
  addEntry: (memberId: number, name: string) => { ok: boolean; message?: string };
  removeEntry: (memberId: number, entryId: number) => { ok: boolean; message?: string };
  renameEntry: (
    memberId: number,
    entryId: number,
    name: string,
  ) => { ok: boolean; message?: string };
  updateMember: (memberId: number, data: { name?: string; phone?: string }) => void;
  toggleEntryWon: (
    memberId: number,
    entryId: number,
    targetRound?: number,
  ) => void;
  setPaymentMode: (mode: PaymentMode) => void;
  toggleTheme: () => void;
  exportBackup: () => void;
  importBackup: (jsonContent: string) => { success: boolean; message: string };
  resetAllData: () => void;
  loadSampleData: () => void;
}

const STORAGE_KEY = "arisanku_v2_storage";
// Legacy key dari versi lama (ArisanBae) — tetap dibaca agar data lama tidak hilang
const LEGACY_STORAGE_KEY = "arisanbae_v2_storage";

const makeRound = (roundNumber: number): ArisanRound => ({
  roundNumber,
  isDrawn: false,
  winnerIds: [],
  payments: {},
});

/** Bangun daftar putaran grup — hanya BERTAMBAH, tidak pernah berkurang. */
const ensureRounds = (group: ArisanGroup): ArisanGroup => {
  const existingMax = Object.keys(group.rounds).reduce(
    (max, key) => Math.max(max, parseInt(key, 10)),
    0,
  );
  const needed = totalRoundsNeeded(group);
  const target = Math.max(existingMax, needed);
  const rounds = { ...group.rounds };
  for (let i = 1; i <= target; i++) {
    if (!rounds[i]) rounds[i] = makeRound(i);
  }
  return { ...group, rounds };
};

// Optional demo group if user wants to test
const DEMO_SAMPLE_GROUP: ArisanGroup = {
  id: "demo-arisan-rt05",
  name: "Arisan Rahat RT 05",
  administrator: {
    manager: "Ibu Nilma",
    wages: 50000,
  },
  dues: 100000,
  winnersCount: 1,
  periodType: "bulanan",
  periodInterval: 1,
  paymentMode: "per_entry",
  createdAt: new Date().toISOString(),
  currentRound: 1,
  members: [
    {
      id: 1,
      name: "Ibu Siti Aminah",
      phone: "081234567890",
      entries: [{ id: 1, name: "Ibu Siti Aminah", hasWon: false }],
    },
    {
      id: 2,
      name: "Ibu Nurul Hidayah",
      phone: "081234567891",
      entries: [{ id: 2, name: "Ibu Nurul Hidayah", hasWon: false }],
    },
    {
      id: 3,
      name: "Ibu Dewi Sartika",
      phone: "081234567892",
      entries: [{ id: 3, name: "Ibu Dewi Sartika", hasWon: false }],
    },
    {
      id: 4,
      name: "Ibu Fatimah Zahra",
      phone: "081234567893",
      entries: [{ id: 4, name: "Ibu Fatimah Zahra", hasWon: false }],
    },
    {
      id: 5,
      name: "Ibu Sri Wahyuni",
      phone: "081234567894",
      entries: [{ id: 5, name: "Ibu Sri Wahyuni", hasWon: false }],
    },
    {
      id: 6,
      name: "Ibu Linda Marlina",
      phone: "081234567895",
      entries: [{ id: 6, name: "Ibu Linda Marlina", hasWon: false }],
    },
  ],
  rounds: {
    1: {
      roundNumber: 1,
      isDrawn: false,
      winnerIds: [],
      payments: { 1: true, 2: true, 3: false, 4: true, 5: false, 6: false },
    },
    2: { roundNumber: 2, isDrawn: false, winnerIds: [], payments: {} },
    3: { roundNumber: 3, isDrawn: false, winnerIds: [], payments: {} },
    4: { roundNumber: 4, isDrawn: false, winnerIds: [], payments: {} },
    5: { roundNumber: 5, isDrawn: false, winnerIds: [], payments: {} },
    6: { roundNumber: 6, isDrawn: false, winnerIds: [], payments: {} },
  },
};

// Default state is cleanly empty (No pre-filled arisan melati)
const DEFAULT_STATE: ArisanAppState = {
  groups: [],
  activeGroupId: null,
  activityLogs: [],
  theme: "light",
};

const ArisanContext = createContext<ArisanContextType | undefined>(undefined);

export const ArisanProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<ArisanAppState>(() => {
    if (typeof window === "undefined") return DEFAULT_STATE;
    try {
      const saved =
        localStorage.getItem(STORAGE_KEY) ||
        localStorage.getItem(LEGACY_STORAGE_KEY);
      if (saved) {
        return migrateLegacyState(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to parse saved state:", e);
    }
    return DEFAULT_STATE;
  });

  // Sync with localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save state to localStorage:", e);
    }
  }, [state]);

  // Apply dark mode class to html document
  useEffect(() => {
    if (state.theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [state.theme]);

  // Active Group helper
  const activeGroup = useMemo(() => {
    if (!state.activeGroupId) return state.groups[0] || null;
    return (
      state.groups.find((g) => g.id === state.activeGroupId) ||
      state.groups[0] ||
      null
    );
  }, [state.groups, state.activeGroupId]);

  const toggleTheme = () => {
    setState((prev) => ({
      ...prev,
      theme: prev.theme === "light" ? "dark" : "light",
    }));
  };

  const createGroup = (data: {
    name: string;
    manager: string;
    wages: number;
    dues: number;
    winnersCount: number;
    periodType: "mingguan" | "bulanan" | "harian";
    paymentMode: PaymentMode;
    members: NewMemberInput[];
  }) => {
    const groupId = "group-" + Date.now();
    let entryIdCounter = 0;
    const members: ArisanMember[] = data.members.map((m, idx) => {
      const names = sanitizeEntryNames(m.entryNames || []);
      const entryList = (names.length > 0 ? names : [m.name.trim()]).map(
        (name) => ({ id: ++entryIdCounter, name, hasWon: false }),
      );
      return {
        id: idx + 1,
        name: m.name.trim(),
        phone: m.phone ? m.phone.trim() : "",
        entries: entryList,
      };
    });

    const baseGroup: ArisanGroup = {
      id: groupId,
      name: data.name.trim(),
      administrator: {
        manager: data.manager.trim() || "Ibu Bendahara",
        wages: data.wages || 0,
      },
      dues: data.dues,
      winnersCount: data.winnersCount || 1,
      periodType: data.periodType,
      periodInterval: 1,
      paymentMode: data.paymentMode || "per_entry",
      createdAt: new Date().toISOString(),
      currentRound: 1,
      members,
      rounds: {},
    };
    const newGroup = ensureRounds(baseGroup);

    const newLog: ArisanActivityLog = {
      id: "log-" + Date.now(),
      groupId,
      text: `Grup arisan "${newGroup.name}" berhasil dibuat oleh ${newGroup.administrator.manager}.`,
      type: "create",
      timestamp: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      groups: [newGroup, ...prev.groups],
      activeGroupId: groupId,
      activityLogs: [newLog, ...prev.activityLogs],
    }));
  };

  const updateGroup = (updatedGroup: ArisanGroup) => {
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === updatedGroup.id ? updatedGroup : g,
      ),
    }));
  };

  const deleteGroup = (groupId: string) => {
    setState((prev) => {
      const remaining = prev.groups.filter((g) => g.id !== groupId);
      return {
        ...prev,
        groups: remaining,
        activeGroupId: remaining.length > 0 ? remaining[0].id : null,
      };
    });
  };

  const setActiveGroupId = (id: string) => {
    setState((prev) => ({ ...prev, activeGroupId: id }));
  };

  const setRound = (roundNumber: number) => {
    if (!activeGroup) return;
    updateGroup({
      ...activeGroup,
      currentRound: roundNumber,
    });
  };

  const togglePayment = (entryId: number, targetRound?: number) => {
    if (!activeGroup) return;
    const rNum = targetRound ?? activeGroup.currentRound;
    const round = activeGroup.rounds[rNum] || makeRound(rNum);
    const currentStatus = !!round.payments[entryId];
    const newStatus = !currentStatus;

    sound.playPop();

    const found = findEntry(activeGroup, entryId);
    const label = found
      ? displayEntryName(found)
      : `Nama Undian #${entryId}`;

    const newLog: ArisanActivityLog = {
      id: "log-" + Date.now(),
      groupId: activeGroup.id,
      text: newStatus
        ? `${label} melunasi iuran Putaran ${rNum}.`
        : `Status lunas ${label} dibatalkan di Putaran ${rNum}.`,
      type: "payment",
      timestamp: new Date().toISOString(),
    };

    const updatedGroup: ArisanGroup = {
      ...activeGroup,
      rounds: {
        ...activeGroup.rounds,
        [rNum]: withEntryPayment(round, entryId, newStatus),
      },
    };

    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === updatedGroup.id ? updatedGroup : g,
      ),
      activityLogs: [newLog, ...prev.activityLogs],
    }));
  };

  const toggleMemberPayment = (memberId: number, targetRound?: number) => {
    if (!activeGroup) return;
    const member = activeGroup.members.find((m) => m.id === memberId);
    if (!member || member.entries.length === 0) return;

    const rNum = targetRound ?? activeGroup.currentRound;
    const round = activeGroup.rounds[rNum] || makeRound(rNum);
    // Mode per orang: jika ada entry yang belum lunas -> tandai semua lunas,
    // selain itu batalkan semuanya.
    const hasUnpaid = member.entries.some((e) => !round.payments[e.id]);
    const newStatus = hasUnpaid;

    sound.playPop();

    const newLog: ArisanActivityLog = {
      id: "log-" + Date.now(),
      groupId: activeGroup.id,
      text: newStatus
        ? `${member.name} melunasi iuran ${member.entries.length} nama undian di Putaran ${rNum}.`
        : `Status lunas ${member.name} dibatalkan untuk semua nama undian di Putaran ${rNum}.`,
      type: "payment",
      timestamp: new Date().toISOString(),
    };

    const updatedGroup: ArisanGroup = {
      ...activeGroup,
      rounds: {
        ...activeGroup.rounds,
        [rNum]: withMemberPayments(round, member, newStatus),
      },
    };

    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === updatedGroup.id ? updatedGroup : g,
      ),
      activityLogs: [newLog, ...prev.activityLogs],
    }));
  };

  const markAllPaid = (paid: boolean, targetRound?: number) => {
    if (!activeGroup) return;
    const rNum = targetRound ?? activeGroup.currentRound;
    const round = activeGroup.rounds[rNum] || makeRound(rNum);

    sound.playPop();

    const total = totalEntries(activeGroup);
    const newLog: ArisanActivityLog = {
      id: "log-" + Date.now(),
      groupId: activeGroup.id,
      text: paid
        ? `Semua nama undian (${total}) ditandai lunas untuk Putaran ${rNum}.`
        : `Status iuran semua nama undian direset ke belum bayar untuk Putaran ${rNum}.`,
      type: "payment",
      timestamp: new Date().toISOString(),
    };

    const updatedGroup: ArisanGroup = {
      ...activeGroup,
      rounds: {
        ...activeGroup.rounds,
        [rNum]: withAllPayments(round, activeGroup, paid),
      },
    };

    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === updatedGroup.id ? updatedGroup : g,
      ),
      activityLogs: [newLog, ...prev.activityLogs],
    }));
  };

  const drawLottery = (targetRound?: number): EntryWithOwner[] => {
    if (!activeGroup) return [];
    const rNum = targetRound ?? activeGroup.currentRound;
    const round = activeGroup.rounds[rNum];
    if (!round) return [];

    // Kandidat: nama undian yang belum pernah menang di putaran mana pun
    // (proteksi ganda hasWon + catatan winnerIds, lihat drawCandidates).
    const candidates = drawCandidates(activeGroup);
    if (candidates.length === 0) return [];

    const picked = pickWinnerEntries(candidates, activeGroup.winnersCount);
    const pickedIds = new Set(picked.map((p) => p.id));

    sound.playWinnerFanfare();

    // Update entries pemenang
    const updatedMembers = activeGroup.members.map((m) => ({
      ...m,
      entries: m.entries.map((e) =>
        pickedIds.has(e.id) ? { ...e, hasWon: true, wonInRound: rNum } : e,
      ),
    }));

    const updatedGroup: ArisanGroup = {
      ...activeGroup,
      members: updatedMembers,
      rounds: {
        ...activeGroup.rounds,
        [rNum]: {
          ...round,
          isDrawn: true,
          drawnAt: new Date().toISOString(),
          winnerIds: picked.map((p) => p.id),
        },
      },
    };

    const winnerLabels = picked
      .map((p) => {
        const found = findEntry(activeGroup, p.id);
        return found ? displayEntryName(found) : p.name;
      })
      .join(", ");
    const newLog: ArisanActivityLog = {
      id: "log-" + Date.now(),
      groupId: activeGroup.id,
      text: `🎉 Putaran ${rNum} diundi! Selamat kepada: ${winnerLabels}`,
      type: "lottery",
      timestamp: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === updatedGroup.id ? updatedGroup : g,
      ),
      activityLogs: [newLog, ...prev.activityLogs],
    }));

    // Kembalikan pasangan entry + pemilik untuk tampilan pengumuman
    return picked
      .map((p) => findEntry(updatedGroup, p.id))
      .filter((x): x is EntryWithOwner => x !== null);
  };

  const resetCurrentRoundLottery = (targetRound?: number) => {
    if (!activeGroup) return;
    const rNum = targetRound ?? activeGroup.currentRound;
    const round = activeGroup.rounds[rNum];
    if (!round || !round.isDrawn) return;

    const roundWinnerIds = new Set(round.winnerIds || []);

    // Status "menang" hanya dihapus jika entry tidak juga tercatat menang
    // di putaran lain (menjaga konsistensi data impor lama).
    const wonInOtherRound = new Set<number>();
    Object.values(activeGroup.rounds).forEach((r) => {
      if (r.isDrawn && r.roundNumber !== rNum) {
        (r.winnerIds || []).forEach((id) => {
          if (roundWinnerIds.has(id)) wonInOtherRound.add(id);
        });
      }
    });

    const updatedMembers = activeGroup.members.map((m) => ({
      ...m,
      entries: m.entries.map((e) =>
        roundWinnerIds.has(e.id) && !wonInOtherRound.has(e.id)
          ? { ...e, hasWon: false, wonInRound: undefined }
          : e,
      ),
    }));

    const updatedGroup: ArisanGroup = {
      ...activeGroup,
      members: updatedMembers,
      rounds: {
        ...activeGroup.rounds,
        [rNum]: {
          ...round,
          isDrawn: false,
          drawnAt: undefined,
          winnerIds: [],
        },
      },
    };

    const newLog: ArisanActivityLog = {
      id: "log-" + Date.now(),
      groupId: activeGroup.id,
      text: `Hasil undian Putaran ${rNum} telah direset ulang.`,
      type: "system",
      timestamp: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === updatedGroup.id ? updatedGroup : g,
      ),
      activityLogs: [newLog, ...prev.activityLogs],
    }));
  };

  const addMember = (newMember: NewMemberInput) => {
    if (!activeGroup) return;
    const nextId =
      activeGroup.members.reduce((max, m) => Math.max(max, m.id), 0) + 1;

    let nextEntry = nextEntryId(activeGroup);
    const names = sanitizeEntryNames(newMember.entryNames || []);
    const entryList = (names.length > 0 ? names : [newMember.name.trim()]).map(
      (name) => ({ id: nextEntry++, name, hasWon: false }),
    );

    const memberObj: ArisanMember = {
      id: nextId,
      name: newMember.name.trim(),
      phone: newMember.phone ? newMember.phone.trim() : "",
      entries: entryList,
    };

    const updatedMembers = [...activeGroup.members, memberObj];
    const updatedGroup = ensureRounds({ ...activeGroup, members: updatedMembers });

    updateGroup(updatedGroup);
  };

  const removeMember = (memberId: number) => {
    if (!activeGroup) return;
    const updatedMembers = activeGroup.members.filter((m) => m.id !== memberId);
    updateGroup({
      ...activeGroup,
      members: updatedMembers,
    });
  };

  const addEntry = (memberId: number, name: string) => {
    if (!activeGroup) return { ok: false, message: "Arisan aktif tidak ditemukan." };
    const member = activeGroup.members.find((m) => m.id === memberId);
    if (!member) return { ok: false, message: "Anggota tidak ditemukan." };

    const [clean] = sanitizeEntryNames([name]);
    if (!clean) {
      return { ok: false, message: "Nama undian tidak boleh kosong ya, Bu!" };
    }
    const duplicated = member.entries.some(
      (e) => e.name.trim().toLowerCase() === clean.toLowerCase(),
    );
    if (duplicated) {
      return {
        ok: false,
        message: "Nama undian itu sudah ada untuk anggota ini, Bu.",
      };
    }

    const entryId = nextEntryId(activeGroup);
    const updatedMembers = activeGroup.members.map((m) =>
      m.id === memberId
        ? {
            ...m,
            entries: [...m.entries, { id: entryId, name: clean, hasWon: false }],
          }
        : m,
    );

    const updatedGroup = ensureRounds({ ...activeGroup, members: updatedMembers });
    updateGroup(updatedGroup);
    return { ok: true };
  };

  const removeEntry = (memberId: number, entryId: number) => {
    if (!activeGroup) return { ok: false, message: "Arisan aktif tidak ditemukan." };
    const member = activeGroup.members.find((m) => m.id === memberId);
    if (!member) return { ok: false, message: "Anggota tidak ditemukan." };

    const target = member.entries.find((e) => e.id === entryId);
    if (!target) return { ok: false, message: "Nama undian tidak ditemukan." };
    if (target.hasWon) {
      return {
        ok: false,
        message: "Nama undian yang sudah pernah menang tidak bisa dihapus, Bu.",
      };
    }
    if (member.entries.length <= 1) {
      return {
        ok: false,
        message: "Setiap anggota minimal punya 1 nama undian, Bu.",
      };
    }

    // Bersihkan key pembayaran entry ini dari semua putaran
    const cleanedRounds: Record<number, ArisanRound> = {};
    Object.entries(activeGroup.rounds).forEach(([key, r]) => {
      const { [entryId]: _removed, ...payments } = r.payments;
      void _removed;
      cleanedRounds[parseInt(key, 10)] = { ...r, payments };
    });

    const updatedMembers = activeGroup.members.map((m) =>
      m.id === memberId
        ? { ...m, entries: m.entries.filter((e) => e.id !== entryId) }
        : m,
    );

    updateGroup({
      ...activeGroup,
      members: updatedMembers,
      rounds: cleanedRounds,
    });
    return { ok: true };
  };

  const renameEntry = (
    memberId: number,
    entryId: number,
    name: string,
  ): { ok: boolean; message?: string } => {
    if (!activeGroup) return { ok: false, message: "Arisan aktif tidak ditemukan." };
    const member = activeGroup.members.find((m) => m.id === memberId);
    if (!member) return { ok: false, message: "Anggota tidak ditemukan." };

    const [clean] = sanitizeEntryNames([name]);
    if (!clean) {
      return { ok: false, message: "Nama undian tidak boleh kosong ya, Bu!" };
    }

    const duplicated = member.entries.some(
      (e) => e.id !== entryId && e.name.trim().toLowerCase() === clean.toLowerCase(),
    );
    if (duplicated) {
      return {
        ok: false,
        message: "Nama undian itu sudah ada untuk anggota ini, Bu.",
      };
    }

    const updatedMembers = activeGroup.members.map((m) =>
      m.id === memberId
        ? {
            ...m,
            entries: m.entries.map((e) =>
              e.id === entryId ? { ...e, name: clean } : e,
            ),
          }
        : m,
    );

    updateGroup({ ...activeGroup, members: updatedMembers });
    return { ok: true };
  };

  const updateMember = (
    memberId: number,
    data: { name?: string; phone?: string },
  ) => {
    if (!activeGroup) return;
    updateGroup({
      ...activeGroup,
      members: activeGroup.members.map((m) =>
        m.id === memberId
          ? {
              ...m,
              name: data.name !== undefined ? data.name.trim() : m.name,
              phone: data.phone !== undefined ? (data.phone || "").trim() : m.phone,
            }
          : m,
      ),
    });
  };

  const toggleEntryWon = (
    memberId: number,
    entryId: number,
    targetRound?: number,
  ) => {
    if (!activeGroup) return;
    const rNum = targetRound ?? activeGroup.currentRound;
    const member = activeGroup.members.find((m) => m.id === memberId);
    if (!member) return;

    const entry = member.entries.find((e) => e.id === entryId);
    if (!entry) return;

    const newWon = !entry.hasWon;

    sound.playPop();

    const updatedMembers = activeGroup.members.map((m) =>
      m.id === memberId
        ? {
            ...m,
            entries: m.entries.map((e) =>
              e.id === entryId
                ? { ...e, hasWon: newWon, wonInRound: newWon ? rNum : undefined }
                : e,
            ),
          }
        : m,
    );

    const foundLabel = entry.name;
    const newLog: ArisanActivityLog = {
      id: "log-" + Date.now(),
      groupId: activeGroup.id,
      text: newWon
        ? `${foundLabel} ditandai sudah pernah menang (Putaran ${rNum}).`
        : `Tandai menang ${foundLabel} dibatalkan.`,
      type: "system",
      timestamp: new Date().toISOString(),
    };

    const updatedGroup: ArisanGroup = {
      ...activeGroup,
      members: updatedMembers,
    };

    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === updatedGroup.id ? updatedGroup : g,
      ),
      activityLogs: [newLog, ...prev.activityLogs],
    }));
  };

  const setPaymentMode = (mode: PaymentMode) => {
    if (!activeGroup) return;
    updateGroup({ ...activeGroup, paymentMode: mode });
  };

  const exportBackup = () => {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const filename = `arisanku_cadangan_${new Date().toISOString().slice(0, 10)}.json`;
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importBackup = (
    jsonContent: string,
  ): { success: boolean; message: string } => {
    try {
      const parsed = JSON.parse(jsonContent);

      // Check if it's v2 format
      if (parsed && Array.isArray(parsed.groups)) {
        const migrated = migrateLegacyState(parsed as ArisanAppState);
        setState(migrated);
        return { success: true, message: "Data arisan berhasil dipulihkan!" };
      }

      // Check if it's v1 legacy format (has `arisan` object)
      const legacyArisan = parsed.arisan || parsed;
      if (
        legacyArisan &&
        legacyArisan.name &&
        Array.isArray(legacyArisan.members)
      ) {
        let entryIdCounter = 0;
        void entryIdCounter;
        const convertedMembers: ArisanMember[] = legacyArisan.members.map(
          (m: any, idx: number) => ({
            id: m.id || idx + 1,
            name: m.name,
            phone: m.telp || m.phone || "",
            // 1 entry per anggota dengan id = member id agar payments/winnerIds
            // hasil konversi (berbasis member id) tetap cocok.
            entries: [
              {
                id: m.id || idx + 1,
                name: m.name,
                hasWon: !!m.winner,
                wonInRound: m.winner_ke,
              },
            ],
          }),
        );
        void entryIdCounter;

        const convertedRounds: Record<number, ArisanRound> = {};
        if (legacyArisan.schedule) {
          Object.entries(legacyArisan.schedule).forEach(
            ([rNumStr, scheduleList]: [string, any]) => {
              const rNum = parseInt(rNumStr, 10);
              const payments: Record<number, boolean> = {};
              const winners: number[] = [];
              if (Array.isArray(scheduleList)) {
                scheduleList.forEach((s: any) => {
                  payments[s.id] = !!s.paid;
                  if (s.winner) winners.push(s.id);
                });
              }
              convertedRounds[rNum] = {
                roundNumber: rNum,
                isDrawn: winners.length > 0,
                winnerIds: winners,
                payments,
              };
            },
          );
        }

        const newGroup: ArisanGroup = {
          id: "imported-" + Date.now(),
          name: legacyArisan.name,
          administrator: {
            manager: legacyArisan.administrator?.manager || "Ibu Pengelola",
            wages: legacyArisan.administrator?.wages || 0,
          },
          dues: legacyArisan.dues || 100000,
          winnersCount: parseInt(legacyArisan.winners_count, 10) || 1,
          periodType: "bulanan",
          periodInterval: 1,
          paymentMode: "per_entry",
          createdAt: new Date().toISOString(),
          currentRound: legacyArisan.arisan_ke || 1,
          members: convertedMembers,
          rounds: convertedRounds,
        };

        setState((prev) => ({
          ...prev,
          groups: [newGroup, ...prev.groups],
          activeGroupId: newGroup.id,
          activityLogs: [
            {
              id: "log-" + Date.now(),
              groupId: newGroup.id,
              text: `Data Arisan "${newGroup.name}" berhasil diimpor dari versi lama.`,
              type: "system",
              timestamp: new Date().toISOString(),
            },
            ...prev.activityLogs,
          ],
        }));

        return {
          success: true,
          message: `Arisan "${newGroup.name}" berhasil diimpor!`,
        };
      }

      return { success: false, message: "Format file JSON tidak dikenali." };
    } catch (e: any) {
      return { success: false, message: "Gagal membaca file: " + e.message };
    }
  };

  const resetAllData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setState(DEFAULT_STATE);
  };

  const loadSampleData = () => {
    setState({
      groups: [DEMO_SAMPLE_GROUP],
      activeGroupId: DEMO_SAMPLE_GROUP.id,
      activityLogs: [
        {
          id: "log-sample-1",
          groupId: DEMO_SAMPLE_GROUP.id,
          text: "Grup demo Arisan Rahat RT 05 dimuat.",
          type: "create",
          timestamp: new Date().toISOString(),
        },
      ],
      theme: "light",
    });
  };

  return (
    <ArisanContext.Provider
      value={{
        state,
        activeGroup,
        createGroup,
        updateGroup,
        deleteGroup,
        setActiveGroupId,
        setRound,
        togglePayment,
        toggleMemberPayment,
        markAllPaid,
        drawLottery,
        resetCurrentRoundLottery,
        addMember,
        removeMember,
        addEntry,
        removeEntry,
        renameEntry,
        updateMember,
        toggleEntryWon,
        setPaymentMode,
        toggleTheme,
        exportBackup,
        importBackup,
        resetAllData,
        loadSampleData,
      }}>
      {children}
    </ArisanContext.Provider>
  );
};

export const useArisan = () => {
  const context = useContext(ArisanContext);
  if (!context) {
    throw new Error("useArisan must be used within an ArisanProvider");
  }
  return context;
};
