import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Calendar, Users, Package, CloudSun, ArrowUpDown, FileSpreadsheet, FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { DailyReport } from '../types';

interface ReportTimelineProps {
  data: DailyReport[];
}

// Translate and map weather widget state with sleek semi-transparent capsules
function getWeatherBadge(weather: string) {
  const normalized = (weather || '').toLowerCase();
  if (normalized.includes('cerah')) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full shadow-xs">
        <span>☀️</span> <span className="capitalize">{weather}</span>
      </span>
    );
  } else if (normalized.includes('awan') || normalized.includes('mendung')) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full shadow-xs">
        <span>☁️</span> <span className="capitalize">{weather}</span>
      </span>
    );
  } else if (normalized.includes('hujan') || normalized.includes('basah')) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full animate-pulse shadow-xs">
        <span>🌧️</span> <span className="capitalize">{weather}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-200 px-2 py-0.5 rounded-full shadow-xs">
      <span>🌤️</span> <span className="capitalize">{weather}</span>
    </span>
  );
}

// Helper to parse Indonesian date strings (e.g., "Rabu-08-April-2026") into a JS Date object
function parseIndonesianDateStringToDate(rawStr: string): Date | null {
  if (!rawStr) return null;
  const clean = rawStr.trim().toLowerCase();
  const parts = clean.split(/[-/\s]+/);
  const dayNamesArr = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu', 'hari'];
  const filteredParts = parts.filter(p => !dayNamesArr.includes(p));
  
  if (filteredParts.length < 3) {
    const attempt = new Date(rawStr);
    return isNaN(attempt.getTime()) ? null : attempt;
  }
  
  const dayNum = parseInt(filteredParts[0], 10);
  const monthStr = filteredParts[1];
  const yearNum = parseInt(filteredParts[2], 10);
  
  const monthMap: Record<string, number> = {
    'januari': 0, 'jan': 0,
    'februari': 1, 'feb': 1,
    'maret': 2, 'mar': 2,
    'april': 3, 'apr': 3,
    'mei': 4, 'may': 4,
    'juni': 5, 'jun': 5,
    'juli': 6, 'jul': 6,
    'agustus': 7, 'agu': 7, 'agt': 7, 'aug': 7,
    'september': 8, 'sep': 8,
    'oktober': 9, 'okt': 9, 'oct': 9,
    'november': 10, 'nov': 10,
    'desember': 11, 'des': 11, 'dec': 11
  };
  
  const monthNum = monthMap[monthStr] !== undefined ? monthMap[monthStr] : -1;
  if (isNaN(dayNum) || monthNum === -1 || isNaN(yearNum)) {
    const attempt = new Date(rawStr);
    return isNaN(attempt.getTime()) ? null : attempt;
  }
  
  return new Date(yearNum, monthNum, dayNum);
}

export function ReportTimeline({ data }: ReportTimelineProps) {
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [sortBy, setSortBy] = useState<'no' | 'workers'>('no');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  const toggleExpand = (no: number) => {
    setExpandedRows(prev => ({
      ...prev,
      [no]: !prev[no]
    }));
  };

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const valA = sortBy === 'no' ? a.no : a.pekerjaParsed.total;
      const valB = sortBy === 'no' ? b.no : b.pekerjaParsed.total;
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });
  }, [data, sortBy, sortDirection]);

  // Client-side CSV Exporter
  const handleExportCSV = () => {
    const headers = [
      'No',
      'Hari',
      'Tanggal',
      'Uraian Kegiatan',
      'Material',
      'Mandor',
      'Tukang Batu',
      'Tukang Plafond',
      'Tukang Keramik',
      'Tukang Besi',
      'Pekerja',
      'Total Pekerja',
      'Cuaca Pagi',
      'Cuaca Siang',
      'Cuaca Sore'
    ];

    const rows = sortedData.map(r => [
      r.no,
      r.tanggalParsed.hari,
      r.tanggalParsed.tanggalStr,
      r.uraianKegiatan.join('; '),
      r.material ? r.material.replace(/\r?\n|\r/g, " ") : '',
      r.pekerjaParsed.mandor,
      r.pekerjaParsed.tukangBatu,
      r.pekerjaParsed.tukangPlafond,
      r.pekerjaParsed.tukangKeramik,
      r.pekerjaParsed.tukangBesi,
      r.pekerjaParsed.pekerja,
      r.pekerjaParsed.total,
      r.cuaca.pagi,
      r.cuaca.siang,
      r.cuaca.sore
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => 
        row.map(val => {
          const text = String(val ?? '');
          if (text.includes(',') || text.includes('"') || text.includes('\n') || text.includes('\r')) {
            return `"${text.replace(/"/g, '""')}"`;
          }
          return text;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Laporan_Harian_Filtered_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Client-side PDF Exporter using jsPDF
  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    let currentPage = 1;

    // Beautiful Executive Brand Colors
    const primaryColor = [15, 23, 42];  // slate-900 (#0f172a)
    const secondaryColor = [71, 85, 105]; // slate-600 (#475569)
    const accentColor = [245, 158, 11]; // amber-500 (#f59e0b)
    const thinBorderColor = [226, 232, 240]; // slate-200 (#e2e8f0)
    const cardBgColor = [248, 250, 252]; // slate-50 (#f8fafc)

    // Helper functions for consistent branding across multiple pages
    const drawWatermark = () => {
      const origFont = doc.getFont().fontName;
      const origSize = doc.getFontSize();
      const origColor = doc.getTextColor();

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(44);
      doc.setTextColor(241, 245, 249); // slate-100 / very light gray
      
      doc.text('DOKUMEN INTEGRAL', 35, 130, { angle: 36 });
      doc.text('JURNAL SIPIL HARIAN', 35, 220, { angle: 36 });

      doc.setFont(origFont);
      doc.setFontSize(origSize);
      doc.setTextColor(origColor);
    };

    const drawPageFooter = (pageNo: number) => {
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.2);
      doc.line(15, pageHeight - 12, 195, pageHeight - 12);
      doc.text(`Halaman ${pageNo}`, 15, pageHeight - 7);
      doc.text('Dokumen Resmi Pemantauan Sipil Konstruksi Mako Digital • Database Jurnal Harian', 195, pageHeight - 7, { align: 'right' });
    };

    // Global Y coordinate tracking
    let y = 15;

    const checkPageBreak = (neededHeight: number) => {
      if (y + neededHeight > pageHeight - 18) {
        drawPageFooter(currentPage);
        doc.addPage();
        currentPage++;
        drawWatermark();
        
        // Dynamic page top headers
        doc.setFillColor(15, 23, 42); // slate-900 header line
        doc.rect(15, 12, 180, 1, 'F');
        
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text('JURNAL DOKUMEN HARIAN PEKERJAAN - KEMAJUAN FISIK', 15, 17);
        
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(100, 116, 139);
        doc.text(`Database Audit Jurnal Harian Lengkap | konstbtb@gmail.com`, 195, 17, { align: 'right' });
        
        y = 23;
      }
    };

    // Calculate aggregated daily statistics for Page 1 Card summary
    const totalDays = sortedData.length;
    let totalWorkers = 0;
    let maxWorkers = 0;
    let rainyDays = 0;
    
    sortedData.forEach(r => {
      const p = r.pekerjaParsed;
      totalWorkers += p.total;
      if (p.total > maxWorkers) maxWorkers = p.total;
      
      const isRainy = 
        r.cuaca.pagi.toLowerCase().includes('hujan') ||
        r.cuaca.siang.toLowerCase().includes('hujan') ||
        r.cuaca.sore.toLowerCase().includes('hujan');
      if (isRainy) {
        rainyDays++;
      }
    });
    
    const averageWorkers = totalDays > 0 ? Math.round((totalWorkers / totalDays) * 10) / 10 : 0;
    const rainyPct = totalDays > 0 ? Math.round((rainyDays / totalDays) * 100) : 0;

    // --- INITIALIZE PAGE 1 ---
    drawWatermark();

    // 1. BRAND HEADER BANNER
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.roundedRect(15, y, 180, 26, 3, 3, 'F');

    // Accent left strip
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.rect(15, y, 4, 26, 'F');

    // Logo Emblem Box
    doc.setFillColor(245, 158, 11); // Amber background
    doc.roundedRect(24, y + 4.5, 12, 12, 2.5, 2.5, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42); // slate-900 text
    doc.text('M', 28.5, y + 11.5);
    doc.setFontSize(4);
    doc.setTextColor(255, 255, 255);
    doc.text('MAKO', 28, y + 15);

    // Title & Subtitles inside text area
    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('LAPORAN HARIAN PEKERJAAN PROYEK', 41, y + 9);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(226, 232, 240); // slate-200
    doc.text('DOKUMEN RESMI JURNAL TIMELINE PEKERJAAN GEDUNG MAKO UTAMA', 41, y + 14);
    
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184); // slate-400
    const printTimeStr = new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });
    doc.text(`Sumber: Sinkronisasi Google Sheets Terfilter \u00a0\u00a0|\u00a0\u00a0 Waktu Cetak: ${printTimeStr} WIB \u00a0\u00a0|\u00a0\u00a0 Operator: konstbtb@gmail.com`, 41, y + 18.5);

    y += 28;

    // 2. PROJECT AGREEMENT DETAILS BOX (BOXED METADATA)
    doc.setFillColor(cardBgColor[0], cardBgColor[1], cardBgColor[2]);
    doc.setDrawColor(thinBorderColor[0], thinBorderColor[1], thinBorderColor[2]);
    doc.setLineWidth(0.2);
    doc.roundedRect(15, y, 180, 26, 2, 2, 'FD');

    // Left marker ribbon
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.rect(15, y, 1.8, 26, 'F');

    // Metadata header
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text('INFORMASI PERJANJIAN & DETAIL KONTRAK PROYEK', 20, y + 4.5);

    // Grid details
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(71, 85, 105);

    doc.setFont('Helvetica', 'bold'); doc.text('Nama Pekerjaan :', 20, y + 10); doc.setFont('Helvetica', 'normal'); doc.text('Pembangunan Gedung Kantor Mako Utama R2', 39, y + 10);
    doc.setFont('Helvetica', 'bold'); doc.text('Lokasi Utama \u00a5 :', 20, y + 14); doc.setFont('Helvetica', 'normal'); doc.text('Komp. Komando Latihan Tempur Daerah Khusus', 39, y + 14);
    doc.setFont('Helvetica', 'bold'); doc.text('Nomor Kontrak :', 20, y + 18); doc.setFont('Helvetica', 'normal'); doc.text('09.KTR/PPK-MAKO/V/2026', 39, y + 18);
    doc.setFont('Helvetica', 'bold'); doc.text('Nilai Anggaran :', 20, y + 22); doc.setFont('Helvetica', 'normal'); doc.text('Rp 12.450.000.000,00 (Dua Belas Miliar Empat Ratus Lima Puluh Juta Rupiah)', 39, y + 22);

    doc.setFont('Helvetica', 'bold'); doc.text('Tahun Anggaran :', 115, y + 10); doc.setFont('Helvetica', 'normal'); doc.text('APBN 2026', 134, y + 10);
    doc.setFont('Helvetica', 'bold'); doc.text('Kontraktor S. :', 115, y + 14); doc.setFont('Helvetica', 'normal'); doc.text('PT Mako Engineering Perkasa', 134, y + 14);
    doc.setFont('Helvetica', 'bold'); doc.text('Konsultan Peng. :', 115, y + 18); doc.setFont('Helvetica', 'normal'); doc.text('CV Pratama Audit Sipilindo', 134, y + 18);
    doc.setFont('Helvetica', 'bold'); doc.text('Status Dokumen :', 115, y + 22); doc.setFont('Helvetica', 'normal'); doc.text('TERVERIFIKASI SISTEM (MAKO-DIGITAL)', 134, y + 22);

    y += 32;

    // 3. THREE DYNAMIC SUMMARY STATS CARDS BLOCK
    const cardWidth = 56.5;
    const cardHeight = 36.5;
    const cardGap = 5.25;

    // CARD 1: Total peninjauan harian
    doc.setFillColor(cardBgColor[0], cardBgColor[1], cardBgColor[2]);
    doc.setDrawColor(thinBorderColor[0], thinBorderColor[1], thinBorderColor[2]);
    doc.setLineWidth(0.2);
    doc.roundedRect(15, y, cardWidth, cardHeight, 1.5, 1.5, 'FD');
    doc.setFillColor(15, 23, 42); // Slate top slice
    doc.rect(15, y, cardWidth, 2.5, 'F');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('TOTAL HARI PENINJAUAN', 19, y + 8);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    doc.text(`${totalDays}`, 19, y + 19);
    doc.setFontSize(7.5);
    doc.text(' Hari Kerja', 19 + doc.getTextWidth(`${totalDays}`), y + 19);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Rincian data harian hasil filter`, 19, y + 25);
    doc.text(`kondisi lapangan konstruksi mako.`, 19, y + 28);
    doc.text(`Mewakili ${totalDays} entitas spreadsheet.`, 19, y + 31);

    // CARD 2: Rata-rata tenaga harian
    let cardX2 = 15 + cardWidth + cardGap;
    doc.setFillColor(cardBgColor[0], cardBgColor[1], cardBgColor[2]);
    doc.setDrawColor(thinBorderColor[0], thinBorderColor[1], thinBorderColor[2]);
    doc.setLineWidth(0.2);
    doc.roundedRect(cardX2, y, cardWidth, cardHeight, 1.5, 1.5, 'FD');
    doc.setFillColor(245, 158, 11); // Amber top slice
    doc.rect(cardX2, y, cardWidth, 2.5, 'F');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('RERATA TENAGA HARIAN', cardX2 + 4, y + 8);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    doc.text(`${averageWorkers}`, cardX2 + 4, y + 19);
    doc.setFontSize(7.5);
    doc.text(' Orang / Hari', cardX2 + 4 + doc.getTextWidth(`${averageWorkers}`), y + 19);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Rata-rata mobilisasi harian`, cardX2 + 4, y + 25);
    doc.text(`seluruh bidang kompetensi tukang.`, cardX2 + 4, y + 28);
    doc.text(`Puncak tertinggi: ${maxWorkers} orang pekerja.`, cardX2 + 4, y + 31);

    // CARD 3: Intensitas Hujan
    let cardX3 = cardX2 + cardWidth + cardGap;
    doc.setFillColor(cardBgColor[0], cardBgColor[1], cardBgColor[2]);
    doc.setDrawColor(thinBorderColor[0], thinBorderColor[1], thinBorderColor[2]);
    doc.setLineWidth(0.2);
    doc.roundedRect(cardX3, y, cardWidth, cardHeight, 1.5, 1.5, 'FD');
    doc.setFillColor(15, 23, 42); // Sky-950 top slice
    doc.rect(cardX3, y, cardWidth, 2.5, 'F');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('KENDALA INTENSITAS HUJAN', cardX3 + 4, y + 8);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    doc.text(`${rainyDays}`, cardX3 + 4, y + 19);
    doc.setFontSize(7.5);
    doc.text(` Hari (${rainyPct}%)`, cardX3 + 4 + doc.getTextWidth(`${rainyDays}`), y + 19);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Jumlah hari kerja produktif`, cardX3 + 4, y + 25);
    doc.text(`tercatat mengalami curah hujan`, cardX3 + 4, y + 28);
    doc.text(`pagi, siang, atau sore hari.`, cardX3 + 4, y + 31);

    y += cardHeight + 8;

    // Section Header: Jurnal Timeline
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('RINCIAN HISTORIS JURNAL HARIAN TERDATA', 15, y);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(15, y + 1.8, 195, y + 1.8);

    y += 6.5;

    // 4. DETAILED TIMELINE BLOCK PROCESSING
    sortedData.forEach((report) => {
      // Structure strings & split to fit width
      const actWords = report.uraianKegiatan || [];
      const formattedTasks = actWords.length > 0
        ? actWords.map(t => `• ${t}`)
        : ['• Tidak ada uraian kegiatan terlaksana yang tercatat.'];
      
      const taskInLines: string[] = [];
      formattedTasks.forEach(task => {
        const lines = doc.splitTextToSize(task, 175);
        taskInLines.push(...lines);
      });

      const matText = report.material || 'Tidak ada sirkulasi pemasukan material konstruksi.';
      const matLines = doc.splitTextToSize(matText, 175);

      const boxHeight = 11.0; // Compact statistics panel height
      
      // Card height calculation:
      // Header: 5.2 | Lab A: 4.5 | Task rows: count*3.1 | Lab B: 3.5 | Mat rows: count*3.1 | Lab C: 3.5 | Box: 11 | Margin: 5
      const estimatedHeight = 5.2 + 4.5 + (taskInLines.length * 3.1) + 3.5 + (matLines.length * 3.1) + 3.5 + boxHeight + 5.0;

      // Smart Block Page-Break Check: places full day block together on one sheet!
      checkPageBreak(estimatedHeight);

      // A. Card Header (Orange stripe indicator + Slate-900 bar)
      doc.setFillColor(245, 158, 11); // Amber
      doc.rect(15, y, 2.0, 5.2, 'F');

      doc.setFillColor(15, 23, 42); // Slate-900 / dark blue
      doc.rect(17.0, y, 178.0, 5.2, 'F');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text(`HARI KE-${report.no}  |  ${report.tanggalParsed.hari.toUpperCase()}, ${report.tanggalParsed.tanggalStr.toUpperCase()}`, 20, y + 3.6);

      // B. Section Content Areas
      let currentY = y + 9.2;

      // 1. PART A: Uraian Kegiatan
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(7.2);
      doc.text('A. URAIAN KEGIATAN / PEKERJAAN TERLAKSANA', 15, currentY);
      currentY += 3.5;

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(51, 65, 85);
      taskInLines.forEach((line) => {
        doc.text(line, 18, currentY);
        currentY += 3.1;
      });

      // 2. PART B: Logistical materials
      currentY += 1.5;
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(7.2);
      doc.text('B. PENGGUNAAN MATERIAL / LOGISTIK', 15, currentY);
      currentY += 3.5;

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(51, 65, 85);
      matLines.forEach((line) => {
        doc.text(line, 18, currentY);
        currentY += 3.1;
      });

      // 3. PART C: Resources mobilization & field conditions
      currentY += 1.5;
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(7.2);
      doc.text('C. SUMBER DAYA & KONDISI LAPANGAN', 15, currentY);
      currentY += 2.5;

      // Card Container background
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.2);
      doc.roundedRect(15, currentY, 180, boxHeight, 1.0, 1.0, 'FD');

      // Row 1: Mobilisasi Pekerja
      let boxY1 = currentY + 4.0;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(71, 85, 105);
      doc.text("Mobilisasi Pekerja", 18, boxY1);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(71, 85, 105);
      const p = report.pekerjaParsed;
      const mpVal = `:  Mandor: ${p.mandor} \u00a0|\u00a0 Tk. Batu: ${p.tukangBatu} \u00a0|\u00a0 Tk. Plafond: ${p.tukangPlafond} \u00a0|\u00a0 Tk. Keramik: ${p.tukangKeramik} \u00a0|\u00a0 Tk. Besi: ${p.tukangBesi} \u00a0|\u00a0 Pekerja: ${p.pekerja} \u00a0|\u00a0 Total: ${p.total} Org`;
      doc.text(mpVal, 38.0, boxY1);

      // Row 2: Kondisi Cuaca harian
      let boxY2 = boxY1 + 4.0;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(71, 85, 105);
      doc.text("Kondisi Cuaca", 18, boxY2);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(71, 85, 105);
      const weatherVal = `:  Pagi: ${report.cuaca.pagi} \u00a0|\u00a0 Siang: ${report.cuaca.siang} \u00a0|\u00a0 Sore: ${report.cuaca.sore}`;
      doc.text(weatherVal, 38.0, boxY2);

      // Advance global coordinates with margin spacer for the next iteration cards
      y = currentY + boxHeight + 5.0;
    });

    // 5. SIGNATURE SPACES BLOCK
    const signatureBlockHeight = 44;
    checkPageBreak(signatureBlockHeight);

    y += 4;
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.2);
    doc.line(15, y, 195, y);
    y += 5.5;

    // Section title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('OTORISASI & VERIFIKASI DOKUMEN HARIAN', 15, y);

    y += 5.5;

    // Left Signature - PT Mako Engineering Perkasa
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text('KONTRAKTOR PELAKSANA', 22, y);
    doc.text('PT MAKO ENGINEERING PERKASA', 22, y + 3.5);

    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(5.5);
    doc.setTextColor(148, 163, 184);
    doc.text('[Dokumen Terverifikasi Digital]', 22, y + 16.5);
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(15, 23, 42);
    doc.text('KURNIAWAN WIBOWO, S.T.', 22, y + 23);
    doc.setFont('Helvetica', 'normal');
    doc.text('Project Manager Utama', 22, y + 26);

    // Right Signature - CV Pratama Audit Sipilindo
    const rightMarginX = 120;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text('KONSULTAN PENGAWAS', rightMarginX, y);
    doc.text('CV PRATAMA AUDIT SIPILINDO', rightMarginX, y + 3.5);

    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(5.5);
    doc.setTextColor(148, 163, 184);
    doc.text('[Dokumen Terverifikasi Digital]', rightMarginX, y + 16.5);
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(15, 23, 42);
    doc.text('IR. ARIEF RAHARDJO, M.T.', rightMarginX, y + 23);
    doc.setFont('Helvetica', 'normal');
    doc.text('Chief Supervision Engineer', rightMarginX, y + 26);

    // Render final footer for the last page
    drawPageFooter(currentPage);

    // Save and Trigger browser download
    doc.save(`Laporan_Dokumen_Harian_Filtered_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Search Result / Stats Control Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-gradient-to-r from-white via-sky-50/10 to-white p-5.5 rounded-3xl border border-sky-100/70 mb-3 shadow-md friendly-card-shadow">
        <div>
          <h4 className="text-base font-black text-slate-800 font-sans flex items-center gap-2">
            <span className="text-xl">📋</span> Daftar Laporan Harian Terperinci
          </h4>
          <p className="text-xs text-slate-500 font-semibold font-sans mt-0.5">Menampilkan {data.length} laporan harian sesuai filter aktif</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Export Action Buttons with 3D tactile push reactions */}
          <div className="flex items-center gap-2 border-r border-[#e2e8f0] pr-3 mr-1">
            <button
              onClick={handleExportCSV}
              title="Ekspor Laporan Filtered ke format CSV"
              className="btn-3d-active flex items-center gap-1.5 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 hover:text-emerald-950 rounded-2xl border border-emerald-200/60 text-xs font-extrabold cursor-pointer transition-all shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Ekspor CSV</span>
            </button>
            <button
              onClick={handleExportPDF}
              title="Ekspor Laporan Filtered ke format PDF Elektronik"
              className="btn-3d-active flex items-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100/80 text-rose-800 hover:text-rose-950 rounded-2xl border border-rose-250/60 text-xs font-extrabold cursor-pointer transition-all shadow-xs"
            >
              <FileText className="w-3.5 h-3.5 text-rose-600" />
              <span>Ekspor PDF</span>
            </button>
          </div>

          {/* Sort field dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">Urutkan:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'no' | 'workers')}
              className="bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 outline-none appearance-none cursor-pointer hover:border-slate-350 transition-colors"
            >
              <option value="no">Hari Laporan (No)</option>
              <option value="workers">Jumlah Tenaga</option>
            </select>
          </div>

          {/* Sort direction toggle button */}
          <button
            onClick={() => setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-705 hover:text-slate-900 rounded-xl border border-slate-200 text-xs font-extrabold cursor-pointer transition-colors"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-amber-500" />
            <span>{sortDirection === 'desc' ? 'Terbaru ↓' : 'Terlama ↑'}</span>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {sortedData.map((report, idx) => {
          const isExpanded = expandedRows[report.no] ?? idx === 0; // Default expand the first item
          const reportDate = parseIndonesianDateStringToDate(report.tanggalRaw);
          const isLate = reportDate ? (Date.now() - reportDate.getTime() > 24 * 60 * 60 * 1000) : false;
          return (
            <div 
              key={report.no} 
              className={`bg-white border rounded-3xl transition-all duration-350 ${
                isExpanded 
                  ? 'border-amber-400 shadow-lg shadow-amber-500/5 ring-1 ring-amber-300' 
                  : 'border-slate-100 shadow-xs hover:border-rose-200/80 hover:shadow-md hover:-translate-y-0.5'
              } overflow-hidden`}
            >
              {/* Card Header (Clickable for Expand Toggle) */}
              <div 
                onClick={() => toggleExpand(report.no)}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none"
              >
                <div className="flex items-start sm:items-center gap-4">
                  <div className={`p-3 rounded-2xl flex-shrink-0 text-center flex flex-col justify-center min-w-[75px] transition-all duration-350 ${
                    isExpanded 
                      ? 'bg-gradient-to-br from-amber-450 to-amber-600 text-white shadow-md shadow-amber-500/20' 
                      : 'bg-slate-50 text-slate-705 border border-slate-200/80'
                  }`}>
                    <span className={`text-[9px] font-black uppercase tracking-wider block font-mono ${isExpanded ? 'text-amber-50' : 'text-slate-400'}`}>Hari ke</span>
                    <span className="text-2xl font-black block font-display leading-none mt-1">{report.no}</span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-xs font-extrabold text-slate-800 font-sans flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        {report.tanggalRaw}
                      </span>
                      {isLate && (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest bg-rose-50 text-rose-600 border border-rose-200/60 px-2.5 py-0.5 rounded-lg shadow-2xs">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
                          </span>
                          <span>Laporan Terlambat</span>
                        </span>
                      )}
                    </div>
                    {/* Tiny activities preview if collapsed */}
                    {!isExpanded && (
                      <p className="text-xs text-slate-500 font-sans font-medium line-clamp-1 max-w-lg">
                        {report.uraianKegiatan.join(' • ')}
                      </p>
                    )}
                    {isExpanded && (
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-700 border border-emerald-200/60 font-black uppercase tracking-wider px-2.5 py-0.5 rounded-lg inline-block font-mono">
                        Pekerjaan Aktif
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-5 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                  {/* Weather Indicators */}
                  <div className="flex gap-2.5 flex-wrap">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[9px] text-slate-400 font-extrabold uppercase font-mono tracking-wider">Pagi</span>
                      {getWeatherBadge(report.cuaca.pagi)}
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[9px] text-slate-400 font-extrabold uppercase font-mono tracking-wider">Siang</span>
                      {getWeatherBadge(report.cuaca.siang)}
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[9px] text-slate-400 font-extrabold uppercase font-mono tracking-wider">Sore</span>
                      {getWeatherBadge(report.cuaca.sore)}
                    </div>
                  </div>

                  <div className="text-slate-400 hover:text-slate-800 transition-colors">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>
              </div>

              {/* Card Body (Details in expanded view) */}
              {isExpanded && (
                <div className="border-t border-slate-100 p-5 bg-slate-50/70 rounded-b-2xl grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in text-slate-800">
                  {/* Left Column: Tasks Punchlist */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                      <input 
                        type="checkbox" 
                        checked={true} 
                        readOnly 
                        className="rounded text-amber-550 focus:ring-amber-500 w-4 h-4 bg-white border-slate-300"
                      />
                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">Uraian Pekerjaan Terlaksana</h5>
                    </div>
                    <div className="space-y-2.5">
                      {report.uraianKegiatan && report.uraianKegiatan.length > 0 ? (
                        report.uraianKegiatan.map((task, tidx) => (
                          <div key={tidx} className="flex gap-2.5 items-start">
                            <span className="h-4 w-4 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center text-[10px] font-bold mt-0.5 flex-shrink-0">✓</span>
                            <span className="text-xs text-slate-700 leading-relaxed font-sans font-medium">{task}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-500 font-sans italic">Tidak ada rincian kegiatan spesifik terdokumentasi.</p>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Deployment, Materials and Weather Alerts */}
                  <div className="space-y-5">
                    {/* Deployment Detail */}
                    <div className="bg-white border border-slate-150 rounded-xl p-4 shadow-xs">
                      <h5 className="text-[10px] font-bold text-slate-550 uppercase tracking-widest font-mono flex items-center gap-1.5 mb-3.5">
                        <Users className="w-3.5 h-3.5 text-amber-600" />
                        Mobilisasi Pekerja ({report.pekerjaParsed.total} Org)
                      </h5>
                      <div className="grid grid-cols-3 gap-2.5">
                        <div className="bg-slate-50 p-2 rounded-lg text-center border border-slate-100">
                          <span className="text-[10px] text-slate-550 font-semibold block">Mandor</span>
                          <span className="text-sm font-black text-slate-800 mt-0.5 block">{report.pekerjaParsed.mandor}</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg text-center border border-slate-100">
                          <span className="text-[10px] text-slate-550 font-semibold block">Tk. Batu</span>
                          <span className="text-sm font-black text-slate-800 mt-0.5 block">{report.pekerjaParsed.tukangBatu}</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg text-center border border-slate-100">
                          <span className="text-[10px] text-slate-550 font-semibold block">Tk. Plafond</span>
                          <span className="text-sm font-black text-slate-800 mt-0.5 block">{report.pekerjaParsed.tukangPlafond}</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg text-center border border-slate-100">
                          <span className="text-[10px] text-slate-550 font-semibold block">Tk. Keramik</span>
                          <span className="text-sm font-black text-slate-800 mt-0.5 block">{report.pekerjaParsed.tukangKeramik}</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg text-center border border-slate-100">
                          <span className="text-[10px] text-slate-550 font-semibold block">Tk. Besi</span>
                          <span className="text-sm font-black text-slate-800 mt-0.5 block">{report.pekerjaParsed.tukangBesi}</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg text-center border border-slate-100">
                          <span className="text-[10px] text-slate-550 font-semibold block">Pekerja</span>
                          <span className="text-sm font-black text-slate-800 mt-0.5 block">{report.pekerjaParsed.pekerja}</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 italic mt-3 font-sans border-t border-slate-100 pt-2.5">
                        Draf asal: {report.pekerjaRaw || '-'}
                      </p>
                    </div>

                    {/* Materials Detail */}
                    <div className="bg-white border border-slate-150 rounded-xl p-4 shadow-xs">
                      <h5 className="text-[10px] font-bold text-slate-550 uppercase tracking-widest font-mono flex items-center gap-1.5 mb-2.5">
                        <Package className="w-3.5 h-3.5 text-blue-500" />
                        Logistik & Penggunaan Material
                      </h5>
                      <p className="text-xs text-slate-700 leading-relaxed font-sans font-semibold">
                        {report.material || (
                          <span className="text-slate-400 italic">Tidak ada sirkulasi material terekam hari ini.</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
