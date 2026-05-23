export interface WorkerCounts {
  mandor: number;
  tukangBatu: number;
  tukangPlafond: number;
  tukangKeramik: number;
  tukangBesi: number;
  pekerja: number;
  total: number;
}

export interface DailyReport {
  no: number;
  tanggalRaw: string;
  tanggalParsed: {
    hari: string;
    tanggalStr: string;
  };
  uraianKegiatan: string[];
  material: string;
  pekerjaRaw: string;
  pekerjaParsed: WorkerCounts;
  cuaca: {
    pagi: string;
    siang: string;
    sore: string;
  };
}

export interface MetricSummary {
  totalMandor: number;
  totalTukangBatu: number;
  totalTukangPlafond: number;
  totalTukangKeramik: number;
  totalTukangBesi: number;
  totalPekerjaGeneral: number;
  maxWorkersInDay: number;
  averageWorkers: number;
  rainyDaysCount: number;
}

export interface AIAnalysis {
  statusKemajuan: string;
  analisisKendala: string;
  analisisResumberdaya: string;
  rekomendasi: string[];
  isFallback?: boolean;
}

export interface WeeklyProgressCategory {
  code: string;
  name: string;
  weight: number;
  progress: number[];
}

export interface WeeklyProgressResponse {
  success: boolean;
  headers: string[];
  rencana: number[];
  riil: number[];
  deviasi: number[];
  categories: WeeklyProgressCategory[];
}

