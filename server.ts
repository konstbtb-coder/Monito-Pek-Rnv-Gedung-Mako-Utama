import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// CSV Parsing Logic (supports multiline fields with quotes)
function parseCSV(text: string): string[][] {
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
function parseWorkerCounts(workerStr: string) {
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

  // Split by common delimiters (semicoolon or comma)
  const parts = workerStr.split(/[;,]/);

  for (let part of parts) {
    part = part.trim().toLowerCase();
    if (!part) continue;

    // Clean brackets or other characters but keep matching keywords
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
function cleanActivities(rawActivity: string): string[] {
  if (!rawActivity) return [];
  return rawActivity
    .split('\n')
    .map(line => line.trim())
    // Remove numerical bullet listings, e.g., "1. Pengecatan" -> "Pengecatan", or dashes "- Plester" -> "Plester"
    .map(line => line.replace(/^[\d+.\-\s]+/, ''))
    .filter(line => line.length > 0);
}

// Parse Google Sheet Tanggal (e.g. "Rabu-08-April-2026")
function parseDate(dateStr: string) {
  if (!dateStr) return { hari: 'Tidak Ada', tanggalStr: '-' };
  const parts = dateStr.split('-');
  if (parts.length >= 2) {
    const hari = parts[0];
    const rest = parts.slice(1).join(' ');
    return { hari, tanggalStr: rest };
  }
  return { hari: 'Hari', tanggalStr: dateStr };
}

// Fetch and API Route setup
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSVt1_mMr78TcXZ6wRBatp61hSXe5zbBu6iUwkWsi0UaQpTxtls1Vw0tEFNHPlSCHsvQ1_ET4NDfS9j/pub?gid=313978686&single=true&output=csv';
const SHEET_TSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSqQdgFPW0r0KXFGwV-b6b7lFwjqg-r4iSFXHXIoAhoy8lkidYRXNnLSAXpe9Ny16FC6D3rUbEkiLNH/pub?gid=10019249&single=true&output=tsv';

app.get("/api/weekly-progress", async (req, res) => {
  try {
    const response = await fetch(SHEET_TSV_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch weekly progress sheet: ${response.statusText}`);
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
    const categories: { code: string; name: string; weight: number; progress: number[] }[] = [];

    // Header row is index 0
    if (rows.length > 0) {
      const headerCells = rows[0];
      // Dates start at index 3
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

    res.json({
      success: true,
      headers,
      rencana,
      riil,
      deviasi,
      categories
    });
  } catch (error: any) {
    console.error("Error in /api/weekly-progress:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});


app.get("/api/reports", async (req, res) => {
  try {
    const response = await fetch(SHEET_CSV_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch sheet: ${response.statusText}`);
    }
    const csvContent = await response.text();
    const rows = parseCSV(csvContent);

    // Header validation and filtering out empty / NaN id rows
    // Columns found: Column 0: No, Column 1: Tanggal, Column 2: Uraian Kegiatan, Column 3: Pekerja (actual column ordering in rows has Pekerja in col 3, Material in col 4 as seen in inspection)
    const validReports = rows
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

    // Sort by Number (Chronological order)
    validReports.sort((a, b) => a.no - b.no);

    res.json({
      success: true,
      count: validReports.length,
      data: validReports
    });
  } catch (error: any) {
    console.error("Error in /api/reports:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Simple in-memory cache for API analyses to bypass rate limits
let cachedAnalysis: any = null;
let cachedReportDataHash: string = "";
let geminiExhaustedUntil = 0; // Epoch timestamp representing when the cooling-down finishes

function getSimpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
}

function generateFallbackAnalysis(reports: any[]) {
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
    
    const w = r.cuaca || {};
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

// Gemini-Powered AI report study
app.post("/api/analyze", async (req, res) => {
  try {
    const { reportData } = req.body;

    if (!reportData || !Array.isArray(reportData) || reportData.length === 0) {
      return res.status(400).json({ success: false, error: "Report data is required" });
    }

    // Check in-memory Cache representation
    const currentDataStr = JSON.stringify(reportData);
    const currentHash = getSimpleHash(currentDataStr);
    
    if (cachedAnalysis && cachedReportDataHash === currentHash) {
      console.log("[Cache Hit] Returning cached Gemini analysis.");
      return res.json({
        success: true,
        analysis: cachedAnalysis
      });
    }

    const dataPrompt = reportData.map(r => `
Hari/Tanggal: ${r.tanggalRaw} (No: ${r.no})
Pekerjaan: ${r.uraianKegiatan.join(', ')}
Pekerja: ${r.pekerjaRaw} (Total: ${r.pekerjaParsed.total} Pekerja)
Material Masuk/Pakai: ${r.material}
Cuaca (Pagi/Siang/Sore): ${r.cuaca.pagi} | ${r.cuaca.siang} | ${r.cuaca.sore}
---`).join('\n');

    const systemPrompt = `Anda adalah Asisten AI Manajemen Konstruksi Profesional. Tugas Anda adalah membantu Penanggung Jawab Proyek mempelajari data laporan harian 7 hari terakhir dari proyek "Gedung Mako Utama" ini dan memberikan evaluasi komprehensif dalam bahasa Indonesia yang ringkas, elegan, dan profesional. 

Kembalikan jawaban dalam format JSON yang valid dengan properti sebagai berikut:
{
  "statusKemajuan": "Format paragraf evaluasi kemajuan proyek berdasarkan uraian kegiatan (1-2 paragraf singkat).",
  "analisisKendala": "Ulasan dampak cuaca (seperti hujan) dan kecukupan material terhadap tingkat produktivitas pekerjaan (1-2 paragraf singkat).",
  "analisisResumberdaya": "Evaluasi alokasi tenaga kerja (seperti komposisi tukang & pekerja) dan efisiensinya terhadap daftar kegiatan (1-2 paragraf singkat).",
  "rekomendasi": ["Rekomendasi poin ke-1", "Rekomendasi poin ke-2", "Rekomendasi poin ke-3", "Rekomendasi poin ke-4"]
}

Jangan tambahkan teks pengantar atau penutup di luar JSON. Pastikan output JSON murni dan dapat diparse.`;

    let finalAnalysis: any;
    const apiKeyMissing = !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.trim() === "" || process.env.GEMINI_API_KEY === "YOUR_GEMINI_API_KEY";
    const circuitBreakerActive = Date.now() < geminiExhaustedUntil;

    if (apiKeyMissing) {
      console.log("[ApiKey Check] GEMINI_API_KEY is not configured. Switching immediately to the elegant local heuristic fallback engine.");
      finalAnalysis = generateFallbackAnalysis(reportData);
      // Cache this result
      cachedAnalysis = finalAnalysis;
      cachedReportDataHash = currentHash;
    } else if (circuitBreakerActive) {
      const remainingSecs = Math.ceil((geminiExhaustedUntil - Date.now()) / 1000);
      console.log(`[Circuit Breaker Active] Gemini API is currently cooling down (${remainingSecs}s remaining). Directly served by local fallback engine.`);
      finalAnalysis = generateFallbackAnalysis(reportData);
      // Serve from current data hash
      cachedAnalysis = finalAnalysis;
      cachedReportDataHash = currentHash;
    } else {
      try {
        console.log("Calling Gemini API with model gemini-3.5-flash...");
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `Berikut adalah rincian data laporan harian Pekerjaan Gedung Mako Utama selama 7 hari terakhir:\n\n${dataPrompt}`,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                statusKemajuan: { type: Type.STRING },
                analisisKendala: { type: Type.STRING },
                analisisResumberdaya: { type: Type.STRING },
                rekomendasi: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
              required: ["statusKemajuan", "analisisKendala", "analisisResumberdaya", "rekomendasi"]
            }
          }
        });

        const resultText = response.text || "{}";
        finalAnalysis = JSON.parse(resultText);
        finalAnalysis.isFallback = false;

        // Save to cache
        cachedAnalysis = finalAnalysis;
        cachedReportDataHash = currentHash;
        console.log("Successfully cached fresh Gemini analysis.");

      } catch (geminiError: any) {
        // Activate circuit-breaker: cooldown for 5 minutes (300,000 ms)
        geminiExhaustedUntil = Date.now() + 5 * 60 * 1000;
        
        console.warn(`[Gemini API Warning] Quota/API error occurred. Activating circuit-breaker cooldown for 5 mins. Error:`, geminiError.message || geminiError);
        console.log("Invoking elegant local heuristic analyzer fallback...");
        
        finalAnalysis = generateFallbackAnalysis(reportData);
        
        // Cache the fallback so we avoid hitting Gemini repeatedly
        cachedAnalysis = finalAnalysis;
        cachedReportDataHash = currentHash;
      }
    }

    res.json({
      success: true,
      analysis: finalAnalysis
    });

  } catch (error: any) {
    console.error("General Error in /api/analyze:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Configure Vite integration or Static paths
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
