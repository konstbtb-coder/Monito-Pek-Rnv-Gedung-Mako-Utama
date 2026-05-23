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
    
    const primaryColor = [15, 23, 42];  // #0f172a
    const secondaryColor = [71, 85, 105]; // #475569
    const accentColor = [245, 158, 11]; // #f59e0b
    
    // Set up header document metadata
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('LAPORAN HARIAN PEKERJAAN PROYEK', 14, 20);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')}  |  User: konstbtb@gmail.com`, 14, 26);
    doc.text(`Filter Aktif: ${sortedData.length} Hari Kerja Terpilih`, 14, 31);
    
    // Draw visual accent line separator
    doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.setLineWidth(1.5);
    doc.line(14, 34, 196, 34);
    
    let yPosition = 42;
    const pageHeight = doc.internal.pageSize.height;
    
    sortedData.forEach((report) => {
      // Manage page break
      if (yPosition > pageHeight - 65) {
        doc.addPage();
        yPosition = 20;
      }
      
      // Rounded Card Header Banner
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(14, yPosition, 182, 9, 'F');
      
      // Small gold vertical label tag on the left
      doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.rect(14, yPosition, 2, 9, 'F');
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(255, 255, 255);
      doc.text(`HARI KE-${report.no}  |  ${report.tanggalParsed.hari.toUpperCase()}, ${report.tanggalParsed.tanggalStr.toUpperCase()}`, 20, yPosition + 6);
      
      yPosition += 14;
      
      // Section A: Tasks
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text('A. URAIAN KEGIATAN / PEKERJAAN TERLAKSANA', 16, yPosition);
      yPosition += 4.5;
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      
      const activities = report.uraianKegiatan || [];
      if (activities.length > 0) {
        activities.forEach(act => {
          const lines = doc.splitTextToSize(`• ${act}`, 174);
          lines.forEach((line: string) => {
            if (yPosition > pageHeight - 15) {
              doc.addPage();
              yPosition = 20;
            }
            doc.text(line, 19, yPosition);
            yPosition += 4;
          });
        });
      } else {
        doc.text('Tidak ada rincian kegiatan terekam.', 19, yPosition);
        yPosition += 4;
      }
      
      yPosition += 2;
      
      // Section B: Materials
      if (yPosition > pageHeight - 25) {
        doc.addPage();
        yPosition = 20;
      }
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text('B. PENGGUNAAN MATERIAL / LOGISTIK', 16, yPosition);
      yPosition += 4.5;
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      const matText = report.material || 'Tidak ada sirkulasi material di lapangan.';
      const matLines = doc.splitTextToSize(matText, 174);
      matLines.forEach((line: string) => {
        if (yPosition > pageHeight - 15) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(line, 19, yPosition);
        yPosition += 4;
      });
      
      yPosition += 2;
      
      // Section C: Resources & Environment
      if (yPosition > pageHeight - 28) {
        doc.addPage();
        yPosition = 20;
      }
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text('C. SUMBER DAYA & KONDISI LAPANGAN', 16, yPosition);
      yPosition += 4.5;
      
      // Subtle container box for summary statistics
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(16, yPosition, 178, 14, 'FD');
      
      const p = report.pekerjaParsed;
      const workerSummary = `Mandor: ${p.mandor}  |  Tk. Batu: ${p.tukangBatu}  |  Tk. Plafond: ${p.tukangPlafond}  |  Tk. Keramik: ${p.tukangKeramik}  |  Tk. Besi: ${p.tukangBesi}  |  Pekerja: ${p.pekerja}  |  Total: ${p.total} Org`;
      const weatherSummary = `Pagi: ${report.cuaca.pagi}  |  Siang: ${report.cuaca.siang}  |  Sore: ${report.cuaca.sore}`;
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text('Mobilisasi Pekerja :', 19, yPosition + 4.5);
      doc.setFont('Helvetica', 'normal');
      doc.text(workerSummary, 43, yPosition + 4.5);
      
      doc.setFont('Helvetica', 'bold');
      doc.text('Kondisi Cuaca :', 19, yPosition + 9.5);
      doc.setFont('Helvetica', 'normal');
      doc.text(weatherSummary, 43, yPosition + 9.5);
      
      yPosition += 22; // increment spacer to next day report

      yPosition += 8; // gentle padding before the next report card starts
    });
    
    doc.save(`Laporan_Harian_Filtered_${new Date().toISOString().slice(0, 10)}.pdf`);
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
