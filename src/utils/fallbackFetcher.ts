import { DailyReport, WeeklyProgressResponse, WeeklyProgressCategory, AIAnalysis } from "../types";

export const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSVt1_mMr78TcXZ6wRBatp61hSXe5zbBu6iUwkWsi0UaQpTxtls1Vw0tEFNHPlSCHsvQ1_ET4NDfS9j/pub?gid=313978686&single=true&output=csv';
export const SHEET_TSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSqQdgFPW0r0KXFGwV-b6b7lFwjqg-r4iSFXHXIoAhoy8lkidYRXNnLSAXpe9Ny16FC6D3rUbEkiLNH/pub?gid=10019249&single=true&output=tsv';

// CSV Parsing Logic (supports multiline fields with quotes)
export function parseCSV(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          cell += '"';
          i++; // Skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(cell.trim());
        cell = '';
      } else if (char === '\r' || char === '\n') {
        if (char === '\r' && nextChar === '\n') {
          i++; // Skip \n
        }
        row.push(cell.trim());
        result.push(row);
        row = [];
        cell = '';
      } else {
        cell += char;
      }
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell.trim());
    result.push(row);
  }
  return result;
}

// Resilient worker count parsing
export function parseWorkerCounts(workerStr: string) {
  const counts = {
    mandor: 0,
    tukangBatu: 0,
    tukangPlafond: 0,
    tukangKeramik: 0,
    tukangBesi: 0,
    pekerja: 0,
    total: 0
  };

  if (!workerStr) return counts;

  // Split by common delimiters (semicolon or comma)
  const parts = workerStr.split(/[;,]/);

  for (let part of parts) {
    part = part.trim().toLowerCase();
    if (!part) continue;

    const numMatch = part.match(/\d+/);
    if (!numMatch) continue;
    const num = parseInt(numMatch[0], 10);

    if (part.includes('mandor')) {
      counts.mandor += num;
    } else if (part.includes('batu') || part.includes('tk. batu')) {
      counts.tukangBatu += num;
    } else if (part.includes('plafond') || part.includes('tk. plafond') || part.includes('gipsum') || part.includes('gypsum')) {
      counts.tukangPlafond += num;
    } else if (part.includes('keramik') || part.includes('tk. keramik') || part.includes('ubin')) {
      counts.tukangKeramik += num;
    } else if (part.includes('besi') || part.includes('tk. besi')) {
      counts.tukangBesi += num;
    } else if (part.includes('pekerja') || part.includes('pk.') || part.includes('kuli') || part.includes('helper')) {
      counts.pekerja += num;
    }
  }

  counts.total = counts.mandor + counts.tukangBatu + counts.tukangPlafond + counts.tukangKeramik + counts.tukangBesi + counts.pekerja;
  return counts;
}

// Cleans individual activity points
export function cleanActivities(rawActivity: string): string[] {
  if (!rawActivity) return [];
  return rawActivity
    .split('\n')
    .map(line => line.trim())
    .map(line => line.replace(/^[\d+.\-\s]+/, ''))
    .filter(line => line.length > 0);
}

// Parse Google Sheet Tanggal (e.g. "Rabu-08-April-2026")
export function parseDate(dateStr: string) {
  if (!dateStr) return { hari: 'Tidak Ada', tanggalStr: '-' };
  const parts = dateStr.split('-');
  if (parts.length >= 2) {
    const hari = parts[0];
    const rest = parts.slice(1).join(' ');
    return { hari, tanggalStr: rest };
  }
  return { hari: 'Hari', tanggalStr: dateStr };
}

// Heuristic fallback analysis generator
export function generateLocalFallbackAnalysis(reports: DailyReport[]): AIAnalysis {
  const totalDays = reports.length;
  const allActivitiesSet = new Set<string>();
  let totalWorkers = 0;
  let rainDays = 0;
  let cloudyDays = 0;
  let sunnyDays = 0;
  let cementCount = 0;
  let sandCount = 0;
  let ironCount = 0;

  reports.forEach(r => {
    if (r.uraianKegiatan && Array.isArray(r.uraianKegiatan)) {
      r.uraianKegiatan.forEach((act: string) => allActivitiesSet.add(act));
    }
    const workerParsed = r.pekerjaParsed || { total: 0 };
    totalWorkers += workerParsed.total || 0;
    
    const w = r.cuaca || { pagi: '', siang: '', sore: '' };
    const hasRain = [w.pagi, w.siang, w.sore].some(c => c && c.toLowerCase().includes('hujan'));
    const hasCloud = [w.pagi, w.siang, w.sore].some(c => c && c.toLowerCase().includes('mendung'));
    
    if (hasRain) {
      rainDays++;
    } else if (hasCloud) {
      cloudyDays++;
    } else {
      sunnyDays++;
    }

    const matStr = (r.material || '').toLowerCase();
    if (matStr.includes('semen')) cementCount++;
    if (matStr.includes('pasir')) sandCount++;
    if (matStr.includes('besi') || matStr.includes('baja') || matStr.includes('wiremesh')) ironCount++;
  });

  const avgWorkers = totalDays > 0 ? (totalWorkers / totalDays).toFixed(1) : "0";
  const uniqueActivities = Array.from(allActivitiesSet);
  const coreWorks = uniqueActivities.slice(0, 3).join(', ');

  let statusKemajuan = "";
  if (totalDays > 0) {
    statusKemajuan = `Proses pemantauan mencatat kemajuan pekerjaan yang berkelanjutan selama ${totalDays} hari terakhir. Fokus pengerjaan utama mencakup sub-kegiatan seperti ${coreWorks || "pekerjaan struktur utama"}. Secara akumulatif, seluruh program target harian terlaksana dengan koordinasi lapangan yang termonitor dengan baik.`;
  } else {
    statusKemajuan = "Belum ada rekaman laporan harian konstruksi yang terdaftar untuk periode pemantauan ini.";
  }

  let analisisKendala = "";
  if (rainDays > 0) {
    analisisKendala = `Teridentifikasi adanya kendala cuaca berupa turunnya hujan pada ${rainDays} hari dari total periode laporan harian. Intensitas hujan terutama di siang/sore hari membatasi kecepatan pemasangan material di area terbuka. Pasokan material utama seperti ${cementCount > 0 ? 'Semen' : ''} ${sandCount > 0 ? ', Pasir' : ''} dan ${ironCount > 0 ? 'Besi Struktur' : 'elemen baja'} berjalan lancar, namun diperlukan optimalisasi proteksi material kering saat hujan mendadak demi menjaga ketahanan campuran beton.`;
  } else {
    analisisKendala = `Kondisi cuaca secara umum didominasi cuaca kondusif (${sunnyDays} hari cerah) yang mendukung produktivitas puncak pengerjaan outdoor. Faktor logistik material seperti ketersediaan semen dan pasir terpantau stabil tanpa kendala suplai yang berarti, memberikan jaminan kesinambungan operasional harian.`;
  }

  const analisisResumberdaya = `Rata-rata kehadiran harian mencapai ${avgWorkers} personil pekerja per hari. Distribusi peran antara Mandor, Tukang, dan Pekerja Pendukung dinilai cukup proporsional untuk mengimbangi beban kerja harian. Namun, untuk mengantisipasi potensi percepatan S-Curve, direkomendasikan penambahan tukang tersertifikasi pada sektor finishing interior guna menjaga sinkronisasi waktu rencana.`;

  const rekomendasi = [
    "Menyusun skema kerja shift fleksibel atau pemindahan pekerja ke zona indoor/semi-indoor apabila terjadi cuaca hujan tiba-tiba di siang/sore hari.",
    "Memperketat pengosongan genangan air di area basah struktur dan menerapkan cover terpal tahan air (tarpaulin) untuk proteksi tumpukan semen/pasir di lapangan.",
    `Mempertahankan rasio optimal tenaga kerja harian (saat ini ${avgWorkers} personil/hari) dan merinci absensi kehadiran spesialis (tukang keramik/batu) untuk akselerasi modul klasifikasi tertentu.`,
    "Menyelaraskan pasokan pengiriman logistik beton ready-mix dengan timeline pengecoran untuk meminimalkan risiko keterlambatan pengerasan di truk mixer."
  ];

  return {
    statusKemajuan,
    analisisKendala,
    analisisResumberdaya,
    rekomendasi,
    isFallback: true
  };
}

// Client-side Direct Google Sheets JSON extract helper for Daily Reports
export async function fetchDailyReportsDirectly(): Promise<DailyReport[]> {
  const response = await fetch(SHEET_CSV_URL);
  if (!response.ok) {
    throw new Error(`Direct Google Sheets fetch failed: ${response.statusText}`);
  }
  const csvContent = await response.text();
  const rows = parseCSV(csvContent);

  const validReports: DailyReport[] = rows
    .filter(row => row.length >= 5 && row[0] !== '' && !isNaN(Number(row[0])))
    .map(row => {
      const no = Number(row[0]);
      const tanggalRaw = row[1] || '';
      const uraianRaw = row[2] || '';
      const pekerjaRaw = row[3] || '';
      const materialRaw = row[4] || '';
      const pagi = row[5] || 'Cerah';
      const siang = row[6] || 'Cerah';
      const sore = row[7] || 'Cerah';

      return {
        no,
        tanggalRaw,
        tanggalParsed: parseDate(tanggalRaw),
        uraianKegiatan: cleanActivities(uraianRaw),
        material: materialRaw,
        pekerjaRaw,
        pekerjaParsed: parseWorkerCounts(pekerjaRaw),
        cuaca: { pagi, siang, sore }
      };
    });

  validReports.sort((a, b) => a.no - b.no);
  return validReports;
}

// Client-side Direct Google Sheets JSON extract helper for Weekly Progress S-Curve
export async function fetchWeeklyProgressDirectly(): Promise<WeeklyProgressResponse> {
  const response = await fetch(SHEET_TSV_URL);
  if (!response.ok) {
    throw new Error(`Direct Google Sheets TSV fetch failed: ${response.statusText}`);
  }
  const tsvContent = await response.text();
  const rows = tsvContent.split("\n").map(line => {
    return line.split("\t").map(cell => {
      let trimmed = cell.trim();
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        trimmed = trimmed.substring(1, trimmed.length - 1).trim();
      }
      return trimmed;
    });
  });

  const parsePercentage = (val: string): number => {
    if (!val) return 0;
    const cleaned = val.replace(/%/g, '').replace(/,/g, '.').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  let headers: string[] = [];
  let rencanaRow: string[] = [];
  let riilRow: string[] = [];
  let deviasiRow: string[] = [];
  const categories: WeeklyProgressCategory[] = [];

  if (rows.length > 0) {
    const headerCells = rows[0];
    headers = headerCells.slice(3).filter(h => h.trim() !== '');
  }

  rows.forEach(row => {
    if (row.length < 2) return;
    const col0 = row[0] ? row[0].trim() : '';
    const col1 = row[1] ? row[1].trim() : '';
    const col2 = row[2] ? row[2].trim() : '';

    if (col1 === 'Progres Total Rencana' && rencanaRow.length === 0) {
      rencanaRow = row;
    } else if (col1 === 'Progres Total Riil' && riilRow.length === 0) {
      riilRow = row;
    } else if (col1 === 'Deviasi' && deviasiRow.length === 0) {
      deviasiRow = row;
    } else if (/^[A-K]$/.test(col0) && col1 !== '' && col1 !== 'REKAPITULASI BOBOT PEKERJAAN' && col2 !== '') {
      const weight = parsePercentage(col2);
      const progress = row.slice(3).map(val => parsePercentage(val));
      categories.push({
        code: col0,
        name: col1,
        weight,
        progress
      });
    }
  });

  const rencana = headers.map((_, idx) => parsePercentage(rencanaRow[idx + 3] || ''));
  const riil = headers.map((_, idx) => parsePercentage(riilRow[idx + 3] || ''));
  const deviasi = headers.map((_, idx) => parsePercentage(deviasiRow[idx + 3] || ''));

  return {
    success: true,
    headers,
    rencana,
    riil,
    deviasi,
    categories
  };
}
