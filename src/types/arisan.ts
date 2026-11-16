export type PaymentPeriodType = 'mingguan' | 'bulanan' | 'harian';

// Satuan peserta undian: 1 nama undian = 1 slot.
// Satu anggota boleh memiliki lebih dari 1 nama undian (multi-undian).
export interface ArisanEntry {
  id: number;
  name: string; // nama yang diundi, tidak boleh kosong
  hasWon: boolean;
  wonInRound?: number;
}

export interface ArisanMember {
  id: number;
  name: string; // nama asli pemilik
  phone: string;
  notes?: string;
  entries: ArisanEntry[]; // WAJIB 1..N (invarian dijaga migrasi & context)
}

export type PaymentMode = 'per_entry' | 'per_member';

export interface RoundPaymentStatus {
  memberId: number;
  paid: boolean;
  paidAt?: string;
}

export interface ArisanRound {
  roundNumber: number;
  isDrawn: boolean;
  drawnAt?: string;
  winnerIds: number[]; // berisi ENTRY id (bukan member id)
  payments: Record<number, boolean>; // key = ENTRY id
}

export interface ArisanGroup {
  id: string;
  name: string;
  administrator: {
    manager: string;
    wages: number; // kas / jasa pengelola per putaran
  };
  dues: number; // iuran per nama undian
  winnersCount: number; // pemenang per putaran
  periodType: PaymentPeriodType;
  periodInterval: number; // misal setiap 1 bulan / 2 minggu
  paymentMode: PaymentMode; // cara input pencatatan iuran di UI
  createdAt: string;
  members: ArisanMember[];
  currentRound: number;
  rounds: Record<number, ArisanRound>; // roundNumber -> round data
}

export interface ArisanActivityLog {
  id: string;
  groupId: string;
  text: string;
  type: 'payment' | 'lottery' | 'create' | 'system';
  timestamp: string;
}

export interface ArisanAppState {
  groups: ArisanGroup[];
  activeGroupId: string | null;
  activityLogs: ArisanActivityLog[];
  theme: 'light' | 'dark';
}
