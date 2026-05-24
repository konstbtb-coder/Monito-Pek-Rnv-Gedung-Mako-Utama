import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  Calendar, 
  CloudRain, 
  Users, 
  TrendingUp, 
  ExternalLink, 
  Search, 
  Filter, 
  CheckCircle2, 
  Loader2, 
  X,
  FileSpreadsheet,
  AlertTriangle,
  AlertCircle,
  FileText,
  Menu,
  Layers,
  ChevronDown,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Printer
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { MetricCard } from './components/MetricCard';
import { WorkerChart } from './components/WorkerChart';
import { AIStudyPanel } from './components/AIStudyPanel';
import { ReportTimeline } from './components/ReportTimeline';
import { WeeklyProgressPanel } from './components/WeeklyProgressPanel';
import { DailyReport, MetricSummary, AIAnalysis, WeeklyProgressResponse, WeeklyProgressCategory } from './types';
import { fetchDailyReportsDirectly, fetchWeeklyProgressDirectly } from './utils/fallbackFetcher';

export default function App() {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyProgressResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);

  // Filters State
  const [dateRange, setDateRange] = useState<'7' | '14' | 'all'>('7');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [weatherFilter, setWeatherFilter] = useState<string>('all');
  const [selectedDayNo, setSelectedDayNo] = useState<number | null>(null);
  const [dismissAlert, setDismissAlert] = useState<boolean>(false);

  // Navigation View modes
  const [viewMode, setViewMode] = useState<'all' | 'daily' | 'weekly'>('weekly');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(true);
  const [isSidebarHovered, setIsSidebarHovered] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [showTopMenu, setShowTopMenu] = useState<boolean>(true);
  const [showSheetDropdown, setShowSheetDropdown] = useState<boolean>(false);

  // PDF Export Configuration States
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [pdfScope, setPdfScope] = useState<'all' | '7' | '14' | 'custom' | 'custom_date'>('7');
  const [customStartDay, setCustomStartDay] = useState<number>(1);
  const [customEndDay, setCustomEndDay] = useState<number>(37);
  const [customStartDateVal, setCustomStartDateVal] = useState<string>('');
  const [customEndDateVal, setCustomEndDateVal] = useState<string>('');
  const [includeWeeklySCurve, setIncludeWeeklySCurve] = useState<boolean>(true);
  const [includeDailyTimeline, setIncludeDailyTimeline] = useState<boolean>(true);
  const [includeAIAnalysis, setIncludeAIAnalysis] = useState<boolean>(true);
  const [pdfType, setPdfType] = useState<'comprehensive' | 'sector_only'>('comprehensive');

  // System Date Time state and dynamic update hook
  const [systemTime, setSystemTime] = useState<Date>(new Date());
  const [simulateUnder30, setSimulateUnder30] = useState<boolean>(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setSystemTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getFormattedSystemTime = () => {
    const DAYS_INDONESIAN = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const MONTHS_INDONESIAN = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    
    const dayName = DAYS_INDONESIAN[systemTime.getDay()];
    const dateNum = systemTime.getDate();
    const monthName = MONTHS_INDONESIAN[systemTime.getMonth()];
    const yearNum = systemTime.getFullYear();
    
    const hours = String(systemTime.getHours()).padStart(2, '0');
    const minutes = String(systemTime.getMinutes()).padStart(2, '0');
    const seconds = String(systemTime.getSeconds()).padStart(2, '0');
    
    return {
      dayName,
      dateString: `${dateNum} ${monthName} ${yearNum}`,
      timeString: `${hours}:${minutes}:${seconds}`
    };
  };

  // Helper: Parse Google Sheets Indonesian date format to modern JavaScript Date object
  const parseTanggalRawToDate = (tanggalRaw: string): Date | null => {
    if (!tanggalRaw) return null;
    const parts = tanggalRaw.split('-');
    if (parts.length === 4) {
      const day = parseInt(parts[1], 10);
      const monthStr = parts[2].toLowerCase();
      const year = parseInt(parts[3], 10);
      const indonesianMonths = [
        'januari', 'februari', 'maret', 'april', 'mei', 'juni',
        'juli', 'agustus', 'september', 'oktober', 'november', 'desember'
      ];
      const monthIndex = indonesianMonths.indexOf(monthStr);
      if (monthIndex !== -1 && !isNaN(day) && !isNaN(year)) {
        return new Date(year, monthIndex, day);
      }
    } else if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const monthStr = parts[1].toLowerCase();
      const year = parseInt(parts[2], 10);
      const indonesianMonths = [
        'januari', 'februari', 'maret', 'april', 'mei', 'juni',
        'juli', 'agustus', 'september', 'oktober', 'november', 'desember'
      ];
      const monthIndex = indonesianMonths.indexOf(monthStr);
      if (monthIndex !== -1 && !isNaN(day) && !isNaN(year)) {
        return new Date(year, monthIndex, day);
      }
    }
    return null;
  };

  // Helper: Format JS Date to "YYYY-MM-DD"
  const formatDateToISOString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Synchronize custom PDF range bound and custom dates with loaded data
  useEffect(() => {
    if (reports && reports.length > 0) {
      const sortedReports = [...reports].sort((a, b) => a.no - b.no);
      const maxNo = Math.max(...sortedReports.map(r => r.no));
      setCustomEndDay(maxNo);

      // Extract and resolve date bounds
      const firstDate = parseTanggalRawToDate(sortedReports[0].tanggalRaw);
      const lastDate = parseTanggalRawToDate(sortedReports[sortedReports.length - 1].tanggalRaw);
      if (firstDate) {
        setCustomStartDateVal(formatDateToISOString(firstDate));
      }
      if (lastDate) {
        setCustomEndDateVal(formatDateToISOString(lastDate));
      }
    }
  }, [reports]);

  // Automatically collapses the floating menu on scrolling (menjadikan menu otomatis tersembunyi)
  useEffect(() => {
    const handleScroll = () => {
      setIsMenuOpen(false);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Fetch Excel/Google Sheet data on Mount
  useEffect(() => {
    async function fetchReportsAndWeekly() {
      try {
        setLoading(true);
        setError(null);
        
        let fetchedReports: DailyReport[] = [];
        let fetchedWeekly: WeeklyProgressResponse | null = null;
        let usedFallback = false;

        try {
          // Attempt Fetch daily reports from local backend
          const resReports = await fetch('/api/reports');
          if (resReports.ok) {
            const resReportsData = await resReports.json();
            if (resReportsData.success) {
              fetchedReports = resReportsData.data;
            }
          }
        } catch (apiErr) {
          console.warn("Backend /api/reports not accessible. Will use client-side extraction.", apiErr);
        }

        // If backend fetched empty or failed, fetch directly from Google Sheets over CORS
        if (!fetchedReports || fetchedReports.length === 0) {
          console.log("Fetching daily reports directly from published Google Sheets RSS/CSV...");
          fetchedReports = await fetchDailyReportsDirectly();
          usedFallback = true;
        }

        setReports(fetchedReports);

        try {
          // Attempt Fetch weekly progress from local backend
          const resWeekly = await fetch('/api/weekly-progress');
          if (resWeekly.ok) {
            const resWeeklyData = await resWeekly.json();
            if (resWeeklyData.success) {
              fetchedWeekly = resWeeklyData;
            }
          }
        } catch (apiErr) {
          console.warn("Backend /api/weekly-progress not accessible. Will use client-side extraction.", apiErr);
        }

        // If backend fetched empty or failed, fetch directly from Google Sheets over CORS
        if (!fetchedWeekly) {
          console.log("Fetching weekly progress directly from published Google Sheets TSV...");
          fetchedWeekly = await fetchWeeklyProgressDirectly();
        }

        setWeeklyData(fetchedWeekly);

        if (usedFallback) {
          console.log("Aplikasi berhasil terkoneksi langsung ke Google Sheet secara mandiri (Client-side Fallback aktif untuk Netlify/Vercel).");
        }

      } catch (err: any) {
        console.error("Critical error in data fetching pipeline:", err);
        setError("Gagal meload data spreadsheet harian dan progres mingguan. Pastikan koneksi internet aktif.");
      } finally {
        setLoading(false);
      }
    }
    fetchReportsAndWeekly();
  }, []);

  // Filter & Slice Data Dynamically
  const filteredData = useMemo(() => {
    if (!reports || reports.length === 0) return [];

    let processed = [...reports];

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      processed = processed.filter(r => 
        r.uraianKegiatan.some(task => task.toLowerCase().includes(q)) ||
        r.material.toLowerCase().includes(q) ||
        r.tanggalRaw.toLowerCase().includes(q)
      );
    }

    // Filter by Weather
    if (weatherFilter !== 'all') {
      processed = processed.filter(r => 
        r.cuaca.pagi.toLowerCase() === weatherFilter ||
        r.cuaca.siang.toLowerCase() === weatherFilter ||
        r.cuaca.sore.toLowerCase() === weatherFilter
      );
    }

    // Filter by Date Range (Takes latest X values since data is sorted ascendingly)
    if (dateRange === '7') {
      processed = processed.slice(-7);
    } else if (dateRange === '14') {
      processed = processed.slice(-14);
    }

    return processed;
  }, [reports, dateRange, searchQuery, weatherFilter]);

  // Handle selected day timeline drilldown
  const filteredTimelineData = useMemo(() => {
    if (selectedDayNo !== null) {
      return filteredData.filter(r => r.no === selectedDayNo);
    }
    return filteredData;
  }, [filteredData, selectedDayNo]);

  // Clear selectedDayNo if it leaves the filtered view range
  useEffect(() => {
    if (selectedDayNo !== null && !filteredData.some(r => r.no === selectedDayNo)) {
      setSelectedDayNo(null);
    }
  }, [filteredData, selectedDayNo]);

  // Compute metrics from currently loaded/filtered range
  const metrics = useMemo<MetricSummary>(() => {
    const summary = {
      totalMandor: 0,
      totalTukangBatu: 0,
      totalTukangPlafond: 0,
      totalTukangKeramik: 0,
      totalTukangBesi: 0,
      totalPekerjaGeneral: 0,
      maxWorkersInDay: 0,
      averageWorkers: 0,
      rainyDaysCount: 0
    };

    if (filteredData.length === 0) return summary;

    let grandTotalWorkers = 0;

    filteredData.forEach(r => {
      const p = r.pekerjaParsed;
      summary.totalMandor += p.mandor;
      summary.totalTukangBatu += p.tukangBatu;
      summary.totalTukangPlafond += p.tukangPlafond;
      summary.totalTukangKeramik += p.tukangKeramik;
      summary.totalTukangBesi += p.tukangBesi;
      summary.totalPekerjaGeneral += p.pekerja;
      
      grandTotalWorkers += p.total;
      if (p.total > summary.maxWorkersInDay) {
        summary.maxWorkersInDay = p.total;
      }

      // Rainy day count (if any morning/noon/evening slot is rainy)
      const isRainy = 
        r.cuaca.pagi.toLowerCase().includes('hujan') ||
        r.cuaca.siang.toLowerCase().includes('hujan') ||
        r.cuaca.sore.toLowerCase().includes('hujan');
      if (isRainy) {
        summary.rainyDaysCount++;
      }
    });

    summary.averageWorkers = Math.round((grandTotalWorkers / filteredData.length) * 10) / 10;

    return summary;
  }, [filteredData]);

  // Rain Alert detection system (Hari Ini & Esok)
  const weatherAlerts = useMemo(() => {
    if (!reports || reports.length === 0) return [];

    const alerts: Array<{
      id: string;
      type: 'today' | 'tomorrow';
      dayNo: number;
      tanggal: string;
      hari: string;
      slots: string[];
      pesan: string;
    }> = [];

    const getRainySlots = (cuaca: { pagi: string; siang: string; sore: string }) => {
      const slots: string[] = [];
      if (cuaca.pagi.toLowerCase().includes('hujan')) slots.push('Pagi');
      if (cuaca.siang.toLowerCase().includes('hujan')) slots.push('Siang');
      if (cuaca.sore.toLowerCase().includes('hujan')) slots.push('Sore');
      return slots;
    };

    const now = new Date();
    const tomVal = new Date();
    tomVal.setDate(now.getDate() + 1);

    const indonesianMonths = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    
    const todayFormated = `${now.getDate()} ${indonesianMonths[now.getMonth()]}`;
    const tomorrowFormated = `${tomVal.getDate()} ${indonesianMonths[tomVal.getMonth()]}`;

    let todayReport = reports.find(r => r.tanggalParsed.tanggalStr.includes(todayFormated));
    let tomorrowReport = reports.find(r => r.tanggalParsed.tanggalStr.includes(tomorrowFormated));

    // Fallback if the spreadsheet is historical (e.g. April 2026 logs)
    if (!todayReport) {
      // Treat the absolute latest logged day as "Hari Ini"
      todayReport = reports[reports.length - 1];
    }

    if (!tomorrowReport && todayReport) {
      // Treat todayReport.no + 1 as "Esok" if it exists in Excel sheet sequence
      const nextDay = reports.find(r => r.no === todayReport!.no + 1);
      if (nextDay) {
        tomorrowReport = nextDay;
      }
    }

    // Check Today for rain
    if (todayReport) {
      const todaySlots = getRainySlots(todayReport.cuaca);
      if (todaySlots.length > 0) {
        alerts.push({
          id: `rain-today-${todayReport.no}`,
          type: 'today',
          dayNo: todayReport.no,
          tanggal: todayReport.tanggalParsed.tanggalStr,
          hari: todayReport.tanggalParsed.hari,
          slots: todaySlots,
          pesan: `Peringatan Cuaca Hari Ini (Hari ke-${todayReport.no}): Terpantau adanya potensi hujan pada waktu ${todaySlots.map(s => s + ' 🌧️').join(', ')}. Harap koordinasikan pekerja lapangan untuk mengalihkan ke pekerjaan dalam ruangan atau amankan area penyimpanan semen/material.`
        });
      }
    }

    // Check Tomorrow for rain
    if (tomorrowReport) {
      const tomSlots = getRainySlots(tomorrowReport.cuaca);
      if (tomSlots.length > 0) {
        alerts.push({
          id: `rain-tom-${tomorrowReport.no}`,
          type: 'tomorrow',
          dayNo: tomorrowReport.no,
          tanggal: tomorrowReport.tanggalParsed.tanggalStr,
          hari: tomorrowReport.tanggalParsed.hari,
          slots: tomSlots,
          pesan: `Prediksi Cuaca Esok Hari (Hari ke-${tomorrowReport.no}): Teridentifikasi curah hujan pada waktu ${tomSlots.map(s => s + ' 🌧️').join(', ')}. Disarankan merelokasi pekerjaan struktural luar ruangan atau mengamankan bekesing cetakan.`
        });
      }
    }

    return alerts;
  }, [reports]);

  // Clears all filters back to default
  const clearFilters = () => {
    setSearchQuery('');
    setWeatherFilter('all');
    setDateRange('7');
    setSelectedDayNo(null);
  };

  const exportDashboardToPDF = (
    scope: 'all' | '7' | '14' | 'custom' | 'custom_date' = '7', 
    startDay: number = 1, 
    endDay: number = 37,
    startDateStr: string = '',
    endDateStr: string = '',
    exportMode: 'comprehensive' | 'sector_only' = 'comprehensive'
  ) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = 210;
    const pageHeight = 297;
    let y = 15;
    let currentPage = 1;

    // Helper: Subtle background watermark on each page (DOKUMEN RAHASIA)
    const drawWatermark = () => {
      const lastFontName = doc.getFont().fontName;
      const lastFontSize = doc.getFontSize();
      const lastTextColor = doc.getTextColor();

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(42);
      // Extra light, eye-safe slate-100 level gray for background watermark overlay
      doc.setTextColor(241, 245, 249); 
      
      doc.text('DOKUMEN RAHASIA', 30, 140, { angle: 40 });
      doc.text('DOKUMEN RAHASIA', 30, 230, { angle: 40 });

      // Restore previous configuration
      doc.setFont(lastFontName);
      doc.setFontSize(lastFontSize);
      doc.setTextColor(lastTextColor);
    };

    // Helper to print footers of the page
    const drawPageFooter = (pageNo: number) => {
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.2);
      doc.line(15, pageHeight - 12, 195, pageHeight - 12);
      doc.text(`Halaman ${pageNo}`, 15, pageHeight - 7);
      doc.text('Dokumen Resmi Pemantauan Sipil Konstruksi Mako Digital • Database S-Curve & Jurnal', 195, pageHeight - 7, { align: 'right' });
    };

    const checkPageBreak = (neededHeight: number) => {
      if (y + neededHeight > pageHeight - 18) {
        drawPageFooter(currentPage);
        doc.addPage();
        currentPage++;
        
        // Draw Watermark immediately on newly added page so it resides under other elements
        drawWatermark();
        
        // Draw standard minimized page header for subsequent pages
        doc.setFillColor(15, 23, 42); // slate-900 line
        doc.rect(15, 12, 180, 1, 'F');
        
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text('LAPORAN KOMPREHENSIF PEKERJAAN GEDUNG MAKO UTAMA', 15, 17);
        
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(100, 116, 139);
        doc.text(`Database Audit Lengkap (S-Curve & Laporan Harian)  |  konstbtb@gmail.com`, 195, 17, { align: 'right' });
        
        y = 25;
      }
    };

    // Draw watermark on the first page
    drawWatermark();

    // Calculate Master Project Statistics from entire reports database
    const totalDaysAll = reports.length;
    let totalWorkersAll = 0;
    let maxWorkersAll = 0;
    let rainyDaysAll = 0;
    let totalTasksAll = 0;

    reports.forEach(r => {
      const p = r.pekerjaParsed;
      totalWorkersAll += p.total;
      if (p.total > maxWorkersAll) maxWorkersAll = p.total;
      
      const cuacaStr = (r.cuaca.pagi + r.cuaca.siang + r.cuaca.sore).toLowerCase();
      if (cuacaStr.includes('hujan')) {
        rainyDaysAll++;
      }
      
      totalTasksAll += r.uraianKegiatan.length;
    });

    const averageWorkersAll = totalDaysAll > 0 ? Math.round((totalWorkersAll / totalDaysAll) * 10) / 10 : 0;
    const rainyPctAll = totalDaysAll > 0 ? Math.round((rainyDaysAll / totalDaysAll) * 105) % 100 : 0;

    // PAGE 1: EXECUTIVE BANNER & GLOBAL METRICS SUMMARY
    // Colors
    const primaryColor = [15, 23, 42]; // slate-900
    const amber = [217, 119, 6]; // amber-600
    const emerald = [5, 150, 105]; // emerald-600
    const sky = [2, 132, 199]; // sky-600
    const indigo = [79, 70, 229]; // indigo-600

    // HEADER BANNER
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(15, y, 180, 26, 4, 4, 'F');

    // Header logo box
    doc.setFillColor(245, 158, 11);
    doc.roundedRect(20, y + 4.5, 17, 17, 3, 3, 'F');
    
    // Draw symbol inside logo box
    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('MAKO', 28.5, y + 14.5, { align: 'center' });

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10.5);
    if (exportMode === 'sector_only') {
      doc.text('LAPORAN REKAPITULASI PROGRES SEKTORAL PEKERJAAN', 41, y + 10);
    } else {
      doc.text('LAPORAN MASTER AUDIT & INTEGRASI S-CURVE PROYEK', 41, y + 10);
    }
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400
    if (exportMode === 'sector_only') {
      doc.text('DETAIL KEMAJUAN DAN DISTRIBUSI BOBOT FISIK SEKTOR BIDANG (KATEGORI A S/D K)', 41, y + 15);
    } else {
      doc.text('DOKUMEN INTEGRAL NILAI ANALISIS MINGGUAN DAN JURNAL HARIAN LENGKAP', 41, y + 15);
    }
    doc.text(`Sumber: Sinkronisasi Google Sheets Seluruh Hari Kerja  |  Waktu Cetak: ${new Date().toLocaleString('id-ID')}  |  User: konstbtb@gmail.com`, 41, y + 20);

    y += 28;

    // INFORMASI KONTRAK & DETAIL PROYEK (BOXED METADATA)
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.3);
    doc.roundedRect(15, y, 180, 26, 3, 3, 'FD');

    // Left amber accent bar
    doc.setFillColor(245, 158, 11); // Amber accent
    doc.roundedRect(15, y, 1.5, 26, 2.5, 2.5, 'F');
    doc.rect(16, y, 0.5, 26, 'F');

    // Labels and alignment
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('INFORMASI PERJANJIAN & DETAIL KONTRAK PROYEK', 20, y + 5);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text('Pekerjaan', 20, y + 11);
    doc.text('No Perjanjian', 20, y + 15);
    doc.text('Tgl. Perjanjian', 20, y + 19);
    doc.text('Nilai Kontrak', 110, y + 11);
    doc.text('Mitra/Vendor', 110, y + 15);

    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text(': Renovasi Mako Gedung Utama', 42, y + 11);
    doc.text(': Sperj/ 03 / V /2026', 42, y + 15);
    doc.text(': 25 Mei 2026', 42, y + 19);
    doc.text(': Rp 14.533.880.000,00', 130, y + 11);
    doc.text(': PT. Bina Konstruksi Abadi', 130, y + 15);

    y += 32;

    // Calculate dynamic values for progress update
    let latestActual = 0;
    let latestPlan = 0;
    let latestDeviation = 0;
    let weekLabel = "Minggu 0";

    if (weeklyData && weeklyData.riil && weeklyData.riil.length > 0) {
      const latestIdx = weeklyData.riil.reduce((acc, val, idx) => (typeof val === 'number' && !isNaN(val) && val > 0 ? idx : acc), 0);
      latestActual = typeof weeklyData.riil[latestIdx] === 'number' ? weeklyData.riil[latestIdx] : 0;
      latestPlan = typeof weeklyData.rencana[latestIdx] === 'number' ? weeklyData.rencana[latestIdx] : 0;
      latestDeviation = typeof weeklyData.deviasi[latestIdx] === 'number' ? weeklyData.deviasi[latestIdx] : 0;
      const latestDateStr = weeklyData.headers[latestIdx] || '';
      weekLabel = `Minggu ${latestIdx + 1} (${latestDateStr})`;
    }

    // Prepare Health parameters
    let healthStatusStr = "Sehat";
    let healthDesc = "Kemajuan proyek melebihi atau sesuai dengan target rencana mingguan (deviasi positif atau netral).";
    let healthColorRGB = [16, 185, 129]; // Emerald

    if (latestDeviation < -2.0) {
      healthStatusStr = "Kritis";
      healthDesc = "Proyek mengalami kendala keterlambatan serius di bawah batas toleransi deviasi (-2%). Diperlukan akselerasi segera!";
      healthColorRGB = [239, 68, 68]; // Red
    } else if (latestDeviation < 0.0) {
      healthStatusStr = "Terlambat";
      healthDesc = "Terjadi keterlambatan minor yang perlu diwaspadai agar tidak menghambat sisa jadwal rencana konstruksi.";
      healthColorRGB = [245, 158, 11]; // Amber
    }

    const cardHeight = 36;
    
    if (exportMode === 'comprehensive') {
      // --- CARD 1: KESEHATAN PROYEK ---
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.35);
      doc.roundedRect(15, y, 58, cardHeight, 3.5, 3.5, 'FD');
      
      // Left decorative bar
      doc.setFillColor(healthColorRGB[0], healthColorRGB[1], healthColorRGB[2]);
      doc.roundedRect(15, y, 1.5, cardHeight, 3.5, 3.5, 'F');
      doc.rect(16, y, 0.5, cardHeight, 'F');

      // Title Tag
      doc.setFillColor(248, 250, 252); // slate-50
      doc.roundedRect(19, y + 3.5, 26, 4, 1, 1, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text('KESEHATAN PROYEK', 20.5, y + 6.3);

      // Indicator Dot green/red
      doc.setFillColor(healthColorRGB[0], healthColorRGB[1], healthColorRGB[2]);
      doc.ellipse(15 + 58 - 5, y + 5.5, 1.0, 1.0, 'F');

      // Kondisi Kumulatif
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text('KONDISI KUMULATIF', 19, y + 12);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(healthStatusStr, 19, y + 18.5);

      // Description text wrapped nicely
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(71, 85, 105); // slate-600
      const healthLines = doc.splitTextToSize(healthDesc, 51);
      healthLines.forEach((line: string, idx: number) => {
        doc.text(line, 19, y + 23.5 + (idx * 2.5));
      });

      // Measurement week footer
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(5.2);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(`Minggu Pengukuran: ${weekLabel}`, 19, y + 32.5);


      // --- CARD 2: PENYIMPANGAN S-CURVE ---
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.35);
      doc.roundedRect(76, y, 58, cardHeight, 3.5, 3.5, 'FD');

      // Left decorative bar (emerald or red depending on deviation)
      const deviationColorRGB = latestDeviation >= 0 ? [16, 185, 129] : [239, 68, 68];
      doc.setFillColor(deviationColorRGB[0], deviationColorRGB[1], deviationColorRGB[2]);
      doc.roundedRect(76, y, 1.5, cardHeight, 3.5, 3.5, 'F');
      doc.rect(77, y, 0.5, cardHeight, 'F');

      // Title Tag
      doc.setFillColor(248, 250, 252); // slate-50
      doc.roundedRect(80, y + 3.5, 31, 4, 1, 1, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text('PENYIMPANGAN S-CURVE', 81.5, y + 6.3);

      // Deviation Title & value
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text('DEVIASI TERBARU TERHITUNG', 80, y + 12);

      const devSign = latestDeviation >= 0 ? '+' : '';
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(deviationColorRGB[0], deviationColorRGB[1], deviationColorRGB[2]);
      doc.text(`${devSign}${latestDeviation.toFixed(3)}%`, 80, y + 18.5);

      // Description text wrapped nicely
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(71, 85, 105); // slate-600
      const devDesc = `Deviasi dihitung dari selisih antara realisasi aktual ${latestActual.toFixed(2)}% terhadap rancangan rencana ${latestPlan.toFixed(2)}%.`;
      const devLines = doc.splitTextToSize(devDesc, 51);
      devLines.forEach((line: string, idx: number) => {
        doc.text(line, 80, y + 23.5 + (idx * 2.5));
      });

      // Deviation Status footer
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(5.2);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text('Status Deviasi: ', 80, y + 32.5);
      doc.setTextColor(deviationColorRGB[0], deviationColorRGB[1], deviationColorRGB[2]);
      doc.text(latestDeviation >= 0 ? 'SURPLUS VOL' : 'KETERLAMBATAN', 93, y + 32.5);


      // --- CARD 3: SISA RENCANA PROYEK ---
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.35);
      doc.roundedRect(137, y, 58, cardHeight, 3.5, 3.5, 'FD');

      // Left decorative bar (Amber)
      doc.setFillColor(245, 158, 11);
      doc.roundedRect(137, y, 1.5, cardHeight, 3.5, 3.5, 'F');
      doc.rect(138, y, 0.5, cardHeight, 'F');

      // Title Tag
      doc.setFillColor(248, 250, 252); // slate-50
      doc.roundedRect(141, y + 3.5, 31, 4, 1, 1, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text('SISA RENCANA PROYEK', 142.5, y + 6.3);

      // Remaining Title & value
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text('PEKERJAAN TERSISA', 141, y + 12);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(`${(100 - latestActual).toFixed(2)}%`, 141, y + 18.5);

      // progress bar bar label
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(5.2);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text('Rasio Realisasi Selesai', 141, y + 23);
      
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(16, 185, 129); // emerald
      doc.text(`${latestActual.toFixed(2)}% / 100%`, 190, y + 23, { align: 'right' });

      // progress bar track (grey)
      doc.setFillColor(241, 245, 249); // slate-100
      doc.roundedRect(141, y + 24.8, 49, 1.8, 0.9, 0.9, 'F');

      // progress bar fill (green)
      const fillWidth = Math.max(1, Math.min(49, (latestActual / 100) * 49));
      doc.setFillColor(16, 185, 129); // emerald-500
      doc.roundedRect(141, y + 24.8, fillWidth, 1.8, 0.9, 0.9, 'F');

      // Contract completion footer
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(5.2);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text('Total Target Kontrak: ', 141, y + 32.5);
      doc.setTextColor(71, 85, 105);
      doc.text('100.00% Selesai', 160, y + 32.5);

      y += cardHeight + 6;
    }

    if (includeWeeklySCurve) {
      if (exportMode === 'comprehensive') {
        // SECTION I: VISUALISASI GRAFIK PENYELARASAN PROGRES (S-CURVE CHART)
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text('I. VISUALISASI GRAFIK PENYELARASAN PROGRES (S-CURVE CHART)', 15, y);
      y += 4.5;

      // Draw S-Curve Chart Card
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.35);
      doc.roundedRect(15, y, 180, 46, 3, 3, 'FD');

      // Left amber accent bar on the card
      doc.setFillColor(245, 158, 11); // Amber
      doc.roundedRect(15, y, 1.5, 46, 2.5, 2.5, 'F');
      doc.rect(16, y, 0.5, 46, 'F');

      // Chart Card Title inside card
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(51, 65, 85); // slate-700
      doc.text('GRAFIK S-CURVE JALUR AKUMULASI PROGRES PEKERJAAN', 20, y + 4.5);

      // Legend - Rencana (Bullet Dot format to match reference image)
      const legendY = y + 4.2;
      doc.setFillColor(79, 70, 229); // Indigo
      doc.ellipse(118, legendY - 0.7, 0.6, 0.6, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(51, 65, 85); // slate-700
      doc.text('Rencana (%)', 121.5, legendY);

      // Legend - Riil (Bullet Dot format to match reference image)
      doc.setFillColor(5, 150, 105); // Emerald
      doc.ellipse(148, legendY - 0.7, 0.6, 0.6, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(51, 65, 85); // slate-700
      doc.text('Riil (%)', 151.5, legendY);

      // Plot area dimensions
      const xPlotStart = 31;
      const xPlotEnd = 187;
      const plotWidth = 156;
      const yPlotStart = y + 8;
      const yPlotEnd = y + 40;
      const plotHeight = 32;

      // Draw Y-axis grid lines and labels nicely with higher contrast
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139); // slate-500

      const levels = [0, 25, 50, 75, 100];
      levels.forEach((lvl) => {
        const yVal = yPlotEnd - (lvl / 100) * plotHeight;
        
        // Clean Grid Line with dashed pattern using loop (extremely safe and portable)
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.setLineWidth(0.18);
        for (let xCoord = xPlotStart; xCoord < xPlotEnd; xCoord += 1.8) {
          doc.line(xCoord, yVal, Math.min(xPlotEnd, xCoord + 0.9), yVal);
        }
        
        // Higher contrast Y-axis text
        doc.text(`${lvl}%`, xPlotStart - 3.5, yVal + 1.2, { align: 'right' });
      });

      // Draw the S-curves
      if (weeklyData && weeklyData.rencana && weeklyData.rencana.length > 1) {
        const totalWeeks = weeklyData.rencana.length;
        const latestRiilIdx = weeklyData.riil.reduce((acc, val, idx) => (typeof val === 'number' && !isNaN(val) && val > 0 ? idx : acc), -1);
        
        // Always draw the entire project duration (all weeks) in the PDF to match the full S-curve reference image
        const limitWeeks = totalWeeks;
        const denom = limitWeeks > 1 ? (limitWeeks - 1) : 1;
        
        const getSafeVal = (arr: number[] | undefined, index: number): number => {
          if (!arr) return 0;
          const v = arr[index];
          return typeof v === 'number' && !isNaN(v) ? Math.max(0, Math.min(100, v)) : 0;
        };

        // Helper: Draw filled area underneath curve using trapezoids
        const drawTrapezoidUnderSegment = (x1: number, y1: number, x2: number, y2: number, yBaseline: number, fillCol: number[]) => {
          doc.setFillColor(fillCol[0], fillCol[1], fillCol[2]);
          const topY = Math.max(y1, y2);
          const rectHeight = yBaseline - topY;
          if (rectHeight > 0) {
            doc.rect(x1, topY, x2 - x1, rectHeight, 'F');
          }
          doc.triangle(x1, y1, x2, y2, (y1 > y2 ? x1 : x2), topY, 'F');
        };

        // 1. Draw Rencana Area Fill (Light Indigo/Blue)
        for (let i = 0; i < limitWeeks - 1; i++) {
          const x1 = xPlotStart + (i / denom) * plotWidth;
          const y1 = yPlotEnd - (getSafeVal(weeklyData.rencana, i) / 100) * plotHeight;
          const x2 = xPlotStart + ((i + 1) / denom) * plotWidth;
          const y2 = yPlotEnd - (getSafeVal(weeklyData.rencana, i + 1) / 100) * plotHeight;
          drawTrapezoidUnderSegment(x1, y1, x2, y2, yPlotEnd, [238, 242, 255]); // Very light indigo-50
        }

        // 2. Draw Riil Area Fill (Light Emerald/Mint)
        if (latestRiilIdx >= 0) {
          const activeLimit = Math.min(limitWeeks - 1, latestRiilIdx);
          for (let i = 0; i < activeLimit; i++) {
            const x1 = xPlotStart + (i / denom) * plotWidth;
            const y1 = yPlotEnd - (getSafeVal(weeklyData.riil, i) / 100) * plotHeight;
            const x2 = xPlotStart + ((i + 1) / denom) * plotWidth;
            const y2 = yPlotEnd - (getSafeVal(weeklyData.riil, i + 1) / 100) * plotHeight;
            drawTrapezoidUnderSegment(x1, y1, x2, y2, yPlotEnd, [227, 252, 239]); // Premium mint-50
          }
        }

        // 3. Draw Rencana Line Curve (Thick Indigo Stroke for high visibility)
        doc.setDrawColor(79, 70, 229); // Indigo
        doc.setLineWidth(1.0);
        for (let i = 0; i < limitWeeks - 1; i++) {
          const x1 = xPlotStart + (i / denom) * plotWidth;
          const y1 = yPlotEnd - (getSafeVal(weeklyData.rencana, i) / 100) * plotHeight;
          const x2 = xPlotStart + ((i + 1) / denom) * plotWidth;
          const y2 = yPlotEnd - (getSafeVal(weeklyData.rencana, i + 1) / 100) * plotHeight;
          doc.line(x1, y1, x2, y2);
        }

        // 4. Draw Riil Line Curve (Thick Emerald Stroke for strong print contrast)
        if (latestRiilIdx >= 0) {
          doc.setDrawColor(5, 150, 105); // Emerald
          doc.setLineWidth(1.5);
          const activeLimit = Math.min(limitWeeks - 1, latestRiilIdx);
          for (let i = 0; i < activeLimit; i++) {
            const x1 = xPlotStart + (i / denom) * plotWidth;
            const y1 = yPlotEnd - (getSafeVal(weeklyData.riil, i) / 100) * plotHeight;
            const x2 = xPlotStart + ((i + 1) / denom) * plotWidth;
            const y2 = yPlotEnd - (getSafeVal(weeklyData.riil, i + 1) / 100) * plotHeight;
            doc.line(x1, y1, x2, y2);
          }

          // Plot-active nodes for active reference focus week
          const activeX = xPlotStart + (latestRiilIdx / denom) * plotWidth;
          const actualValRaw = typeof weeklyData.riil[latestRiilIdx] === 'number' ? weeklyData.riil[latestRiilIdx] : 0;
          const activeY = yPlotEnd - (getSafeVal(weeklyData.riil, latestRiilIdx) / 100) * plotHeight;
          const planValRaw = typeof weeklyData.rencana[latestRiilIdx] === 'number' ? weeklyData.rencana[latestRiilIdx] : 0;
          const activePlanY = yPlotEnd - (getSafeVal(weeklyData.rencana, latestRiilIdx) / 100) * plotHeight;

          // Double highlight dot rings
          doc.setFillColor(5, 150, 105); // emerald
          doc.ellipse(activeX, activeY, 1.3, 1.3, 'F');
          doc.setFillColor(79, 70, 229); // indigo
          doc.ellipse(activeX, activePlanY, 1.3, 1.3, 'F');

          // Dynamic offset calculation to prevent overlap of plan & real tooltip labels or hitting left Y-axis boundary
          const isActualHigher = actualValRaw > planValRaw;
          const labelPivotX = (latestRiilIdx < 3) ? (activeX + 16) : ((latestRiilIdx > totalWeeks - 4) ? (activeX - 16) : activeX);
          
          // Tooltip Pill for actual progress (PROGRES RIIL)
          const riilTooltipY = isActualHigher ? (activeY - 8.2) : (activeY + 3);
          doc.setFillColor(15, 23, 42); // dark slate background
          doc.roundedRect(labelPivotX - 14, riilTooltipY, 28, 5.2, 1, 1, 'F');
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(5.6);
          doc.setTextColor(52, 211, 153); // bright emerald text
          doc.text(`Riil: ${actualValRaw.toFixed(3)}%`, labelPivotX, riilTooltipY + 3.8, { align: 'center' });

          // Tooltip Pill for plan progress (TARGET RENCANA)
          const rencanaTooltipY = isActualHigher ? (activePlanY + 3) : (activePlanY - 8.2);
          doc.setFillColor(79, 70, 229); // indigo background
          doc.roundedRect(labelPivotX - 17, rencanaTooltipY, 34, 5.2, 1, 1, 'F');
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(5.6);
          doc.setTextColor(255, 255, 255); // white text
          doc.text(`Rencana: ${planValRaw.toFixed(3)}%`, labelPivotX, rencanaTooltipY + 3.8, { align: 'center' });
        }

        // 5. Draw Target focus vertical dotted reference line if active week is valid
        if (latestRiilIdx >= 0 && latestRiilIdx < limitWeeks) {
          const refereeX = xPlotStart + (latestRiilIdx / denom) * plotWidth;
          doc.setDrawColor(245, 158, 11); // Orange reference line
          doc.setLineWidth(0.25);
          for (let dotY = yPlotStart; dotY < yPlotEnd; dotY += 1.5) {
            doc.line(refereeX, dotY, refereeX, Math.min(yPlotEnd, dotY + 0.8));
          }
        }

        // Draw X-axis week labels up to limitWeeks
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(51, 65, 85); // slate-700 for clearer printing
        for (let i = 0; i < limitWeeks; i++) {
          const xCoord = xPlotStart + (i / denom) * plotWidth;
          
          // Tiny tick mark on axis
          doc.setDrawColor(148, 163, 184); // slate-400
          doc.setLineWidth(0.25);
          doc.line(xCoord, yPlotEnd, xCoord, yPlotEnd + 1.2);

          // Only draw text labels for EVEN weeks (W-2, W-4, W-6, ... W-32) to match reference image exactly
          if ((i + 1) % 2 === 0) {
            doc.text(`W-${i + 1}`, xCoord, yPlotEnd + 4, { align: 'center' });
          }
        }
      }

      y += 46 + 8; // Advance y coordinates

      // SECTION II: RIWAYAT AKUMULATIF PROGRES MINGGUAN (Tabel Mingguan)
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text('II. RIWAYAT AKUMULATIF PROGRES MINGGUAN (S-CURVE DATA)', 15, y);
      y += 4.5;

      // We draw table of S-Curve weeks
      // Headers: Minggu | Tanggal Cutoff | Rencana (%) | Riil (%) | Deviasi (%) | Status
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(15, y, 180, 6, 1.5, 1.5, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);

      doc.text('Minggu', 18, y + 4.2);
      doc.text('Tanggal Cut-Off', 40, y + 4.2);
      doc.text('Rencana (%)', 85, y + 4.2, { align: 'center' });
      doc.text('Riil Kumulatif (%)', 120, y + 4.2, { align: 'center' });
      doc.text('Deviasi (%)', 155, y + 4.2, { align: 'center' });
      doc.text('Kondisi Kemajuan', 175, y + 4.2);

      y += 6.2;

      if (weeklyData && weeklyData.headers && weeklyData.headers.length > 0) {
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(6.8);
        
        weeklyData.headers.forEach((header, idx) => {
          checkPageBreak(6.2);
          
          // Alternating background
          if (idx % 2 === 0) {
            doc.setFillColor(255, 255, 255);
          } else {
            doc.setFillColor(248, 250, 252);
          }
          doc.rect(15, y, 180, 5.8, 'F');

          doc.setFont('Helvetica', 'bold');
          doc.setTextColor(30, 41, 59);
          doc.text(`Minggu ke-${idx + 1}`, 18, y + 4.2);

          doc.setFont('Helvetica', 'normal');
          doc.text(header, 40, y + 4.2);

          const plan = weeklyData.rencana[idx] || 0;
          const actual = weeklyData.riil[idx] || 0;
          const deviation = weeklyData.deviasi[idx] || 0;

          doc.text(`${plan.toFixed(2)}%`, 85, y + 4.2, { align: 'center' });
          doc.text(`${actual > 0 ? actual.toFixed(2) + '%' : '-'}`, 120, y + 4.2, { align: 'center' });

          // Deviasi color
          if (deviation < 0) {
            doc.setFont('Helvetica', 'bold');
            doc.setTextColor(220, 38, 38); // red
          } else if (deviation > 0 && actual > 0) {
            doc.setFont('Helvetica', 'bold');
            doc.setTextColor(5, 150, 105); // green
          } else {
            doc.setTextColor(100, 116, 139);
          }
          doc.text(`${deviation >= 0 ? '+' : ''}${deviation.toFixed(2)}%`, 155, y + 4.2, { align: 'center' });

          // Status
          let progressStatus = 'Belum Dimulai';
          if (actual > 0) {
            if (deviation < 0) {
              progressStatus = 'Lambat ⚠️';
              doc.setTextColor(217, 119, 6);
            } else {
              progressStatus = 'Sehat ✔️';
              doc.setTextColor(5, 150, 105);
            }
          } else {
            doc.setTextColor(148, 163, 184);
          }
          doc.setFont('Helvetica', 'bold');
          doc.text(progressStatus, 175, y + 4.2);

          doc.setDrawColor(241, 245, 249);
          doc.setLineWidth(0.15);
          doc.line(15, y + 5.8, 195, y + 5.8);

          y += 5.8;
        });
      } else {
        doc.setFont('Helvetica', 'normal');
        doc.text('Tidak ada data S-Curve mingguan dapat dibaca dari spreadsheet.', 18, y + 4.5);
        y += 8;
      }

      y += 8;
      } // Closing if (exportMode === 'comprehensive') for Section I & II

      // SECTION III: KATEGORI PROGRESS BREAKDOWN (A-K)
      checkPageBreak(25);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      const sect3Title = exportMode === 'sector_only' 
        ? 'I. ANALISA PROGRES FISIK SUB-BIDANG PEKERJAAN (KATEGORI A s/d K)' 
        : 'III. ANALISA PROGRES FISIK SUB-BIDANG PEKERJAAN (KATEGORI A s/d K)';
      doc.text(sect3Title, 15, y);
      y += 4.5;

      // Column Headers: Kode | Nama Kategori Pekerjaan | Bobot (%) | Progres (%) | Kontribusi (%)
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(15, y, 180, 6, 1.5, 1.5, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);

      doc.text('Kode', 18, y + 4.2);
      doc.text('Kategori Bidang Pekerjaan (A-K)', 32, y + 4.2);
      doc.text('Bobot Kontrak (%)', 110, y + 4.2, { align: 'center' });
      doc.text('Progres Riil (%)', 145, y + 4.2, { align: 'center' });
      doc.text('Kontribusi Fisik (%)', 178, y + 4.2, { align: 'center' });

      y += 6.2;

      if (weeklyData && weeklyData.categories && weeklyData.categories.length > 0) {
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(6.8);

        // Find unique categories
        const seenCodes = new Set<string>();
        const uniqueCats: WeeklyProgressCategory[] = [];
        weeklyData.categories.forEach(cat => {
          if (!seenCodes.has(cat.code)) {
            seenCodes.add(cat.code);
            uniqueCats.push(cat);
          }
        });

        // Find the index of the latest active week to display
        const latestActiveWeekIdx = weeklyData.riil.reduce((acc, val, idx) => (val > 0 ? idx : acc), 0);

        uniqueCats.forEach((cat, idx) => {
          const catNameLines = doc.splitTextToSize(cat.name, 68);
          const rowHeight = Math.max(5.8, (catNameLines.length * 3.4) + 2.4);
          checkPageBreak(rowHeight);

          // Alternating background
          if (idx % 2 === 0) {
            doc.setFillColor(255, 255, 255);
          } else {
            doc.setFillColor(248, 250, 252);
          }
          doc.rect(15, y, 180, rowHeight, 'F');

          doc.setFont('Helvetica', 'bold');
          doc.setTextColor(15, 23, 42);
          doc.text(cat.code, 18, y + (rowHeight / 2) + 1.1);

          doc.setFont('Helvetica', 'normal');
          catNameLines.forEach((line: string, lineIdx: number) => {
            doc.text(line, 32, y + 4.0 + (lineIdx * 3.4));
          });

          const weight = cat.weight || 0;
          const progressVal = cat.progress[latestActiveWeekIdx] || 0;
          const contrib = (progressVal * weight) / 100;

          doc.text(`${weight.toFixed(2)}%`, 110, y + (rowHeight / 2) + 1.1, { align: 'center' });
          doc.text(`${progressVal > 0 ? progressVal.toFixed(2) + '%' : '-'}`, 145, y + (rowHeight / 2) + 1.1, { align: 'center' });

          doc.setFont('Helvetica', 'bold');
          doc.setTextColor(15, 23, 42);
          doc.text(`${contrib > 0 ? contrib.toFixed(2) + '%' : '-'}`, 178, y + (rowHeight / 2) + 1.1, { align: 'center' });

          doc.setDrawColor(241, 245, 249);
          doc.setLineWidth(0.15);
          doc.line(15, y + rowHeight, 195, y + rowHeight);

          y += rowHeight;
        });

        // Extra footnote inside table
        checkPageBreak(6);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(100, 116, 139);
        doc.text(`*Catatan progres di atas mengacu pada status data S-Curve Minggu ke-${latestActiveWeekIdx + 1} (${weeklyData.headers[latestActiveWeekIdx] || ''}).`, 18, y + 4.2);
        y += 6;
      } else {
        doc.setFont('Helvetica', 'normal');
        doc.text('Tidak ada rincian data kategori pekerjaan dalam respon.', 18, y + 4.5);
        y += 8;
      }

      y += 8;

      // SECTION IV: REKAPITULASI PERKEMBANGAN PROGRES PEKERJAAN MINGGUAN (Kategori A s/d K)
      const numWeeks = (weeklyData && weeklyData.headers) ? weeklyData.headers.length : 1;
      // We reserve X=15 to X=89 (74mm) for category details, and X=89 to X=195 (106mm) for week columns
      const xStartWeeks = 89;
      const wCol = numWeeks > 0 ? (106 / numWeeks) : 106;

      checkPageBreak(15);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.setTextColor(15, 23, 42);
      const sect4Title = exportMode === 'sector_only'
        ? 'II. REKAPITULASI PERKEMBANGAN PROGRES PEKERJAAN MINGGUAN (MINGGU 1 s/d MINGGU TERAKHIR)'
        : 'IV. REKAPITULASI PERKEMBANGAN PROGRES PEKERJAAN MINGGUAN (MINGGU 1 s/d MINGGU TERAKHIR)';
      doc.text(sect4Title, 15, y);
      y += 4.0;

      // Table Top Accent Border
      doc.setDrawColor(15, 23, 42); // slate-900 / dark blue
      doc.setLineWidth(0.35);
      doc.line(15, y, 195, y);

      // Column Headers Row background
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(15, y, 180, 4.8, 1.0, 1.0, 'F');
      
      // Determine header font size dynamically based on week density
      let headerTextSize = 5.8;
      if (numWeeks > 24) headerTextSize = 4.2;
      else if (numWeeks > 16) headerTextSize = 4.8;
      else if (numWeeks > 10) headerTextSize = 5.3;

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(headerTextSize);
      doc.setTextColor(71, 85, 105);

      doc.text('Kode', 17.5, y + 3.3);
      doc.text('Kategori Bidang Pekerjaan (A-K)', 23, y + 3.3);
      doc.text('Bobot (%)', 83, y + 3.3, { align: 'center' });

      // Visual structural vertical dividing line inside header
      doc.setDrawColor(203, 213, 225); // slate-300
      doc.setLineWidth(0.18);
      doc.line(xStartWeeks, y, xStartWeeks, y + 4.8);

      // Draw week columns headers dynamically
      if (weeklyData && weeklyData.headers) {
        for (let i = 0; i < numWeeks; i++) {
          const xPos = xStartWeeks + (i * wCol);
          let label = `${i + 1}`;
          if (numWeeks <= 12) {
            label = `Mgg ${i + 1}`;
          } else if (numWeeks <= 20) {
            label = `M-${i + 1}`;
          }
          doc.text(label, xPos + (wCol / 2), y + 3.3, { align: 'center' });
        }
      }
      y += 4.8 + 1.0;

      if (weeklyData && weeklyData.categories && weeklyData.categories.length > 0) {
        // Find unique categories
        const seenCodes = new Set<string>();
        const uniqueCats: WeeklyProgressCategory[] = [];
        weeklyData.categories.forEach(cat => {
          if (!seenCodes.has(cat.code)) {
            seenCodes.add(cat.code);
            uniqueCats.push(cat);
          }
        });

        uniqueCats.forEach((cat, idx) => {
          const catNameLines = doc.splitTextToSize(cat.name, 58); // Optimized size from 56 to 58 to reduce multi-line wrapping
          const rowHeight = Math.max(4.0, (catNameLines.length * 2.1) + 1.2);
          checkPageBreak(rowHeight);

          // Alternating background
          if (idx % 2 === 0) {
            doc.setFillColor(255, 255, 255);
          } else {
            doc.setFillColor(248, 250, 252);
          }
          doc.rect(15, y, 180, rowHeight, 'F');

          // Render bottom line border for this row
          doc.setDrawColor(241, 245, 249);
          doc.setLineWidth(0.12);
          doc.line(15, y + rowHeight, 195, y + rowHeight);

          // Render vertical divider column separator
          doc.setDrawColor(226, 232, 240); // slate-200
          doc.setLineWidth(0.18);
          doc.line(xStartWeeks, y, xStartWeeks, y + rowHeight);

          // Render Kode A-K
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(5.5);
          doc.setTextColor(15, 23, 42);
          doc.text(cat.code, 17.5, y + (rowHeight / 2) + 0.8);

          // Render Kategori Name
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(5.0);
          doc.setTextColor(30, 41, 59);
          catNameLines.forEach((line: string, lineIdx: number) => {
            doc.text(line, 23, y + 2.2 + (lineIdx * 2.0));
          });

          // Render Bobot (%)
          const weight = cat.weight || 0;
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(5.0);
          doc.text(`${weight.toFixed(2)}%`, 83, y + (rowHeight / 2) + 0.8, { align: 'center' });

          // Render each week's progress value dynamically scaling the font size
          let valueFontSize = 4.8;
          if (numWeeks > 24) {
            valueFontSize = 3.6;
          } else if (numWeeks > 16) {
            valueFontSize = 4.0;
          } else if (numWeeks > 10) {
            valueFontSize = 4.5;
          }
          doc.setFontSize(valueFontSize);

          for (let i = 0; i < numWeeks; i++) {
            const progressVal = cat.progress[i];
            const xPos = xStartWeeks + (i * wCol);
            
            let valStr = '-';
            if (progressVal !== undefined && progressVal !== null) {
              if (progressVal >= 100) {
                valStr = numWeeks <= 15 ? '100%' : '100';
              } else if (progressVal > 0) {
                if (numWeeks <= 12) {
                  valStr = `${progressVal.toFixed(1)}%`;
                } else if (numWeeks <= 20) {
                  valStr = `${progressVal.toFixed(0)}%`;
                } else {
                  valStr = `${progressVal.toFixed(0)}`;
                }
              }
            }

            // Bold styling and beautiful colors for progressive values
            if (valStr !== '-') {
              if (progressVal >= 100) {
                doc.setFont('Helvetica', 'bold');
                doc.setTextColor(16, 185, 129); // emerald-600 green for 100% completed
              } else {
                doc.setFont('Helvetica', 'bold');
                doc.setTextColor(15, 23, 42);
              }
            } else {
              doc.setFont('Helvetica', 'normal');
              doc.setTextColor(148, 163, 184); // light slate for non-active values
            }

            doc.text(valStr, xPos + (wCol / 2), y + (rowHeight / 2) + 0.9, { align: 'center' });
          }

          y += rowHeight;
        });
      } else {
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text('Tidak ada rincian data kategori pekerjaan untuk rekapitulasi.', 18, y + 4.5);
        y += 8;
      }

      // Draw bottom thick project border at the end of the table
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.4);
      doc.line(15, y, 195, y);

      y += 8;

      // V. EVALUASI DAN STUDI ANALISIS MINGGUAN AI GEMINI (Printed if includeAIAnalysis and analysis state exists)
      if (includeAIAnalysis && analysis && exportMode === 'comprehensive') {
        checkPageBreak(42);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text('V. EVALUASI DAN STUDI ANALISIS MINGGUAN AI GEMINI', 15, y);
        y += 4.5;

        // Splitting analysis strings for nice text wrapping
        const statusLines = doc.splitTextToSize(analysis.statusKemajuan || '-', 82);
        const resourceLines = doc.splitTextToSize(analysis.analisisResumberdaya || '-', 82);
        const maxLinesCount = Math.max(statusLines.length, resourceLines.length);
        const boxContentHeight = (maxLinesCount * 3.4) + 12;
        const boxHeight = Math.max(28, boxContentHeight);

        checkPageBreak(boxHeight + 6);

        doc.setFillColor(245, 243, 255); // light-violet-50 background of AI analysis
        doc.setDrawColor(221, 214, 254); // violet-200 border
        doc.setLineWidth(0.25);
        doc.roundedRect(15, y, 180, boxHeight, 3, 3, 'FD');

        // Color ribbon for premium look
        doc.setFillColor(124, 58, 237); // violet-600
        doc.roundedRect(15, y, 1.5, boxHeight, 3, 3, 'F');
        doc.rect(16, y, 0.5, boxHeight, 'F');

        // Column Subheaders
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7.2);
        doc.setTextColor(109, 40, 217); // violet-700
        doc.text('A. TINJAUAN KEMAJUAN & S-CURVE KELANCARAN', 20, y + 5.5);
        doc.text('B. ANALISIS MOBILISASI PEKERJA & TENAGA', 108, y + 5.5);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(30, 41, 59);

        // Printing wrapped lines
        statusLines.forEach((line: string, i: number) => {
          doc.text(line, 20, y + 10 + (i * 3.4));
        });

        resourceLines.forEach((line: string, i: number) => {
          doc.text(line, 108, y + 10 + (i * 3.4));
        });

        y += boxHeight + 8;
      }
    }

    // Sort reports ascending by number (chronological) and apply selected range configurations
    let chronologicalReports = [...reports].sort((a, b) => a.no - b.no);

    // Compute dynamic indices for Jurnal Harian sections
    let sectionIdxForTimeline = 1;
    if (includeWeeklySCurve) {
      sectionIdxForTimeline = 5; // normally S-Curve takes I, II, III, IV
      if (includeAIAnalysis && analysis) {
        sectionIdxForTimeline = 6; // AI Weekly is printed at V, moving next to VI
      }
    }

    // Print Daily AI Analysis (Cuaca, Kendala & Recommendations) if checked & populated
    if (includeDailyTimeline && includeAIAnalysis && analysis && exportMode === 'comprehensive') {
      const romanNumerals = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
      const dailyAiPfx = romanNumerals[sectionIdxForTimeline] || 'VI';
      checkPageBreak(42);
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(`${dailyAiPfx}. ANALISIS KENDALA OPERASIONAL & SARAN STRATEGIS (AI POWERED)`, 15, y);
      y += 4.5;

      const kendalaLines = doc.splitTextToSize(analysis.analisisKendala || '-', 168);
      
      const recTexts = analysis.rekomendasi && analysis.rekomendasi.length > 0 
        ? analysis.rekomendasi 
        : ['Melakukan penyesuaian lapangan dan monitoring ketat.', 'Memaksimalkan jam kerja dan logistik aman cuaca.'];
      
      let totalRecHeight = 0;
      const recLinesArray: string[][] = [];
      recTexts.forEach((rText) => {
        const lines = doc.splitTextToSize(`• ${rText}`, 168);
        recLinesArray.push(lines);
        totalRecHeight += (lines.length * 3.4) + 1.2;
      });

      const kendalaHeight = (kendalaLines.length * 3.4) + 9;
      const boxHeight = kendalaHeight + totalRecHeight + 11;

      checkPageBreak(boxHeight + 6);

      doc.setFillColor(254, 252, 232); // amber-50 yellow background
      doc.setDrawColor(253, 230, 138); // amber-200 border
      doc.setLineWidth(0.25);
      doc.roundedRect(15, y, 180, boxHeight, 3, 3, 'FD');

      // Color ribbon representing tactical alerts
      doc.setFillColor(217, 119, 6); // Amber-600
      doc.roundedRect(15, y, 1.5, boxHeight, 3, 3, 'F');
      doc.rect(16, y, 0.5, boxHeight, 'F');

      // Subheader A
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(180, 83, 9); // amber-700
      doc.text('A. TINJAUAN KENDALA HARIAN (CUACA & DISTRIBUSI MATERIAL)', 20, y + 5.5);

      // Body Kendala
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(30, 41, 59);
      kendalaLines.forEach((line: string, i: number) => {
        doc.text(line, 20, y + 9.5 + (i * 3.4));
      });

      // Subheader B
      let currentOffset = y + 9.5 + (kendalaLines.length * 3.4) + 4.5;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(180, 83, 9); // amber-700
      doc.text('B. REKOMENDASI MITIGASI RESIKO & SARAN PENYELESAIAN', 20, currentOffset);
      currentOffset += 4.5;

      // Print Bullet recommendations
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(30, 41, 59);
      recLinesArray.forEach((lines) => {
        lines.forEach((line: string, i: number) => {
          doc.text(line, 20, currentOffset + (i * 3.4));
        });
        currentOffset += (lines.length * 3.4) + 1.2;
      });

      y += boxHeight + 8;
      
      // Since Daily AI was printed, Daily Timeline index is shifted +1
      sectionIdxForTimeline += 1;
    }

    const romanNumerals = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
    const pfx = romanNumerals[sectionIdxForTimeline] || 'IV';
    let sectionTitle = `${pfx}. JURNAL TIMELINE LAPORAN HARIAN (7 HARI TERAKHIR)`;
    
    if (scope === '7') {
      chronologicalReports = chronologicalReports.slice(-7);
      sectionTitle = `${pfx}. JURNAL TIMELINE LAPORAN HARIAN (7 HARI TERAKHIR)`;
    } else if (scope === '14') {
      chronologicalReports = chronologicalReports.slice(-14);
      sectionTitle = `${pfx}. JURNAL TIMELINE LAPORAN HARIAN (14 HARI TERAKHIR)`;
    } else if (scope === 'all') {
      sectionTitle = `${pfx}. JURNAL TIMELINE LAPORAN HARIAN (SELURUH HARI KERJA)`;
    } else if (scope === 'custom') {
      chronologicalReports = chronologicalReports.filter(r => r.no >= startDay && r.no <= endDay);
      sectionTitle = `${pfx}. JURNAL TIMELINE LAPORAN HARIAN (HARI KE-${startDay} S/D HARI KE-${endDay})`;
    } else if (scope === 'custom_date') {
      const filterStart = startDateStr ? new Date(startDateStr) : null;
      const filterEnd = endDateStr ? new Date(endDateStr) : null;
      if (filterStart) filterStart.setHours(0, 0, 0, 0);
      if (filterEnd) filterEnd.setHours(23, 59, 59, 999);

      chronologicalReports = chronologicalReports.filter(r => {
        const reportDate = parseTanggalRawToDate(r.tanggalRaw);
        if (!reportDate) return false;
        if (filterStart && reportDate < filterStart) return false;
        if (filterEnd && reportDate > filterEnd) return false;
        return true;
      });

      const formatDisplayDateForTitle = (isoStr: string) => {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
      };
      const startDisplay = startDateStr ? formatDisplayDateForTitle(startDateStr) : 'Awal';
      const endDisplay = endDateStr ? formatDisplayDateForTitle(endDateStr) : 'Akhir';
      sectionTitle = `${pfx}. JURNAL TIMELINE LAPORAN HARIAN (${startDisplay} S/D ${endDisplay})`;
    }

    if (includeDailyTimeline && exportMode === 'comprehensive') {
      // SECTION V / VI: JURNAL TIMELINE LAPORAN HARIAN PROYEK
      checkPageBreak(18);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(sectionTitle, 15, y);
      y += 6;

      chronologicalReports.forEach((report) => {
        const actWords = report.uraianKegiatan || [];
        const formattedTasks = actWords.length > 0 
          ? actWords.map(t => `• ${t}`)
          : ['• Tidak ada kegiatan terlaksana terdata.'];
        
        const taskInLines: string[] = [];
        formattedTasks.forEach(task => {
          const lines = doc.splitTextToSize(task, 175);
          taskInLines.push(...lines);
        });

        const matText = report.material || '[Tidak Ada Material Masuk]';
        const matLines = doc.splitTextToSize(matText, 175);

        const boxHeight = 10.0; // Highly compact padding & content box height
        // Estimate the exact height of the block with tight vertical margins:
        // Header bar: 5mm, gap to label A: 4.5mm, label A: 3mm, task lines: count * 3.1,
        // gap to label B: 2mm, label B: 3mm, mat lines: count * 3.1, gap to label C: 2mm,
        // label C: 2.5mm, box: boxHeight, gap to next entry: 5.5mm.
        const estimatedHeight = 5 + 4.5 + 3 + (taskInLines.length * 3.1) + 2 + 3 + (matLines.length * 3.1) + 2 + 2.5 + boxHeight + 5.5;

        checkPageBreak(estimatedHeight);

        // A. Draw Header bar (Orange vertical ribbon on left, Dark Blue header bar)
        doc.setFillColor(245, 158, 11); // Amber accent
        doc.rect(15, y, 2.0, 5, 'F');

        doc.setFillColor(15, 23, 42); // slate-900 / dark blue
        doc.rect(17.0, y, 178.0, 5, 'F');

        // Header text inside bar
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(255, 255, 255);
        doc.text(`HARI KE-${report.no}  |  ${report.tanggalParsed.hari.toUpperCase()}, ${report.tanggalParsed.tanggalStr.toUpperCase()}`, 20, y + 3.6);

        // B. Section Content Area
        let currentY = y + 9.5;

        // 1. Section A: activities
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

        // 2. Section B: logistics
        currentY += 2.0;
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

        // 3. Section C: resources & weather box
        currentY += 2.0;
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(7.2);
        doc.text('C. SUMBER DAYA & KONDISI LAPANGAN', 15, currentY);
        currentY += 2.5;

        // Outline background card
        doc.setFillColor(248, 250, 252); // offwhite bg
        doc.setDrawColor(226, 232, 240); // slate-200 border
        doc.setLineWidth(0.2);
        doc.roundedRect(15, currentY, 180, boxHeight, 1.0, 1.0, 'FD');

        // Render Row 1: Mobilisasi Pekerja (aligned at X = 38.0)
        let boxY1 = currentY + 3.5;
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(71, 85, 105);
        doc.text("Mobilisasi Pekerja", 18, boxY1);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(71, 85, 105);
        const p = report.pekerjaParsed;
        const mpVal = `:  Mandor: ${p.mandor}  |  Tk. Batu: ${p.tukangBatu}  |  Tk. Plafond: ${p.tukangPlafond}  |  Tk. Keramik: ${p.tukangKeramik}  |  Tk. Besi: ${p.tukangBesi}  |  Pekerja: ${p.pekerja}  |  Total: ${p.total} Org`;
        doc.text(mpVal, 38.0, boxY1);

        // Render Row 2: Kondisi Cuaca (aligned at X = 38.0)
        let boxY2 = boxY1 + 4.0;
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(71, 85, 105);
        doc.text("Kondisi Cuaca", 18, boxY2);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(71, 85, 105);
        const weatherVal = `:  Pagi: ${report.cuaca.pagi}  |  Siang: ${report.cuaca.siang}  |  Sore: ${report.cuaca.sore}`;
        doc.text(weatherVal, 38.0, boxY2);

        // Setup coordinate for subsequent day block
        y = currentY + boxHeight + 5.5;
      });
    }

    // Add Signature Block "Ttd / Project Manajer" on the last page with proper boundary checks
    const signatureHeight = 40;
    if (y + signatureHeight > 265) {
      // Draw footer for previous page before adding a new page
      drawPageFooter(currentPage);
      doc.addPage();
      currentPage++;
      drawWatermark();
      y = 20; // safe top margin on the new page
    } else {
      y += 8; // gentle spacing before the signature block on the same page
    }

    // Dynamic Indonesian day & date calculation
    let reportDateStr = '';
    const sortedReportsForDate = [...reports].sort((a, b) => a.no - b.no);
    if (sortedReportsForDate.length > 0) {
      const lastReport = sortedReportsForDate[sortedReportsForDate.length - 1];
      const hr = lastReport.tanggalParsed.hari;
      const tgl = lastReport.tanggalParsed.tanggalStr;
      const capitalizedHr = hr ? (hr.charAt(0).toUpperCase() + hr.slice(1)) : 'Minggu';
      reportDateStr = `${capitalizedHr}, ${tgl}`;
    } else {
      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      const now = new Date();
      const dayName = days[now.getDay()];
      const dateNum = now.getDate();
      const monthName = months[now.getMonth()];
      const year = now.getFullYear();
      reportDateStr = `${dayName}, ${dateNum} ${monthName} ${year}`;
    }

    // Draw Signature Block on right side
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.0);
    doc.setTextColor(71, 85, 105); // Slate-600
    doc.text(reportDateStr, 145, y);
    
    y += 5;
    doc.text('Ttd,', 145, y);

    y += 18; // space for physical signature area
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42); // Slate-900
    doc.text('Project Manajer', 145, y);

    // Draw final page footer for the last page
    drawPageFooter(currentPage);

    const pdfFilename = exportMode === 'sector_only'
      ? `Laporan_Sektoral_A-K_${new Date().toISOString().slice(0, 10)}.pdf`
      : `Laporan_Audit_Mako_Lengkap_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(pdfFilename);
  };
  
  const getRemainingDays = () => {
    if (!weeklyData || !weeklyData.riil || weeklyData.riil.length === 0) return 210;
    const latestRiilIdx = weeklyData.riil.reduce((acc, val, idx) => (typeof val === 'number' && !isNaN(val) && val > 0 ? idx : acc), 0);
    const overallLatestActiveWeek = latestRiilIdx + 1;
    return Math.max(0, 210 - (overallLatestActiveWeek * 7));
  };

  const remainingDays = simulateUnder30 ? 25 : getRemainingDays();

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans">
      {/* Mobile Drawer Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Invisible Hover Trigger Zone on Left Screen Edge when Sidebar is Collapsed and Not Hovered */}
      {isSidebarCollapsed && !isSidebarHovered && (
        <div 
          className="fixed inset-y-0 left-0 w-4 z-40 hidden md:block cursor-pointer group"
          onMouseEnter={() => setIsSidebarHovered(true)}
          title="Sorot tepi kiri untuk memunculkan Menu Navigasi"
        >
          {/* Subtle Interactive Edge Glow Indicator */}
          <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-r from-indigo-500/20 to-transparent group-hover:w-2 group-hover:from-indigo-500/80 transition-all duration-200 flex items-center justify-center">
            <div className="w-1 h-8 rounded-full bg-indigo-500 animate-pulse hidden group-hover:block" />
          </div>
        </div>
      )}

      {/* Responsive Left Sidebar Panel */}
      <aside 
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
        className={`fixed inset-y-0 left-0 bg-[#0B0F19] border-r border-slate-800/80 text-white w-64 lg:w-72 flex flex-col z-50 transition-all duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${(isSidebarCollapsed && !isSidebarHovered) ? 'md:-translate-x-full' : 'md:translate-x-0'} ${(isSidebarCollapsed && isSidebarHovered) ? 'shadow-2xl shadow-indigo-950/40 border-r-indigo-500/30' : ''}`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800/80 flex flex-col gap-4 select-none">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 flex-shrink-0">
                <span className="text-sm font-black animate-pulse">⚡</span>
              </div>
              <div>
                <h2 className="text-sm font-black tracking-tight text-white font-sans">Progres Pek. Rnv. Mako</h2>
                <p className="text-[9px] font-bold text-cyan-400 font-mono tracking-widest uppercase mt-0.5">SIPIL & ARSITEKTUR</p>
              </div>
            </div>
            {/* Button to collapse/pin inside sidebar on desktop */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1.5 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800/60 rounded-xl hidden md:flex cursor-pointer transition-colors animate-fade-in"
              title={isSidebarCollapsed ? "Kunci/Pin Menu agar tetap terbuka" : "Sembunyikan Menu"}
            >
              {isSidebarCollapsed ? (
                <span className="text-[10px] font-black tracking-wider text-indigo-400 font-sans px-1 uppercase flex items-center gap-1.5 animate-pulse">
                  📌 Kunci
                </span>
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* System Dynamic Clock Panel */}
          <div className="bg-slate-900/60 border border-slate-800/85 rounded-2xl p-3 flex flex-col gap-1 text-left">
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-indigo-400 font-sans tracking-wide">
              <span>📅</span> WAKTU SISTEM TERUKUR
            </div>
            <div className="text-xs font-black text-white font-sans mt-0.5">
              {getFormattedSystemTime().dayName}, {getFormattedSystemTime().dateString}
            </div>
            <div className="text-base font-extrabold font-mono tracking-widest text-[#22D3EE] mt-1 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              <span>{getFormattedSystemTime().timeString}</span>
              <span className="text-[8px] font-bold text-slate-500 bg-slate-800 px-1 py-0.5 rounded ml-auto">WIB</span>
            </div>
          </div>
        </div>

        {/* Primary Links */}
        <nav className="flex-1 p-4 space-y-2 font-sans select-none">
          <div className="px-3 py-1.5 text-[9px] font-black text-slate-500 uppercase tracking-widest">
            NAVIGASI UTAMA
          </div>
          
          <button
            onClick={() => {
              setViewMode('weekly');
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black transition-all text-left cursor-pointer border ${
              viewMode === 'weekly' 
                ? 'bg-[#182235] border-indigo-500/20 text-white shadow-md'
                : 'border-transparent text-slate-450 hover:bg-slate-900/60 hover:text-white'
            }`}
          >
            <FileSpreadsheet className={`w-4.5 h-4.5 shrink-0 ${viewMode === 'weekly' ? 'text-indigo-400' : 'text-slate-400'}`} />
            <span>Progres Mingguan (WBS)</span>
          </button>

          <button
            onClick={() => {
              setViewMode('daily');
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black transition-all text-left cursor-pointer border ${
              viewMode === 'daily'
                ? 'bg-[#182235] border-indigo-500/20 text-white shadow-md'
                : 'border-transparent text-slate-450 hover:bg-slate-900/60 hover:text-white'
            }`}
          >
            <Calendar className={`w-4.5 h-4.5 shrink-0 ${viewMode === 'daily' ? 'text-indigo-400' : 'text-slate-400'}`} />
            <span>Laporan Harian</span>
          </button>

          {/* Simulation Tools Panel */}
          <div className="pt-4 mt-2 border-t border-slate-800/40">
            <div className="px-3 py-1.5 text-[9px] font-black text-slate-500 uppercase tracking-widest">
              SIMULASI & FITUR
            </div>
            <div className="px-3 py-1">
              <label className="flex items-center gap-2 text-[11px] font-bold text-slate-400 hover:text-white cursor-pointer select-none transition-colors">
                <input
                  type="checkbox"
                  checked={simulateUnder30}
                  onChange={(e) => setSimulateUnder30(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5"
                />
                <span>Uji Peringatan Sisa Hari</span>
              </label>
            </div>
          </div>
        </nav>

        {/* User Identity Box Footer */}
        <div className="p-4.5 border-t border-slate-800/80 bg-[#070a11] flex items-center gap-3.5 select-none shrink-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-650 shrink-0 font-black flex items-center justify-center text-white text-sm shadow-inner shadow-indigo-550/30">
            K
          </div>
          <div className="overflow-hidden min-w-0">
            <h4 className="text-[11px] font-extrabold text-white truncate font-display">konstbtb@gmail.com</h4>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono mt-0.5">LEAD OPERATOR</p>
          </div>
        </div>
      </aside>

      {/* Main Right Content Grid */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 bg-[#F8FAFC] ${isSidebarCollapsed ? 'md:pl-0' : 'md:pl-64 lg:pl-72'}`}>
        {/* Dynamic Header Toolbar */}
        <header className="border-b border-sky-100/60 bg-white/95 sticky top-0 z-40 backdrop-blur-md shadow-2xs py-3.5 px-4 sm:px-6 flex-shrink-0">
          <div className="w-full flex flex-row items-center justify-between gap-4">
            
            {/* Left Header info block */}
            <div className="flex items-center gap-3.5 min-w-0">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 -ml-1 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100/85 border border-slate-200 rounded-xl md:hidden cursor-pointer flex-shrink-0"
                title="Buka Menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Desktop toggle button to collapse navigation panel */}
              <button 
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-2 -ml-1 text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-slate-100/85 border border-slate-200 rounded-xl hidden md:flex cursor-pointer flex-shrink-0 shadow-xs transition-all items-center justify-center"
                title={isSidebarCollapsed ? "Tampilkan Menu Navigasi" : "Sembunyikan Menu Navigasi"}
              >
                {isSidebarCollapsed ? (
                  <div className="flex items-center gap-1.5 px-1 py-0.5">
                    <ChevronRight className="w-4 h-4 text-indigo-600 font-black animate-bounce" />
                    <span className="text-[10px] font-black text-indigo-605 tracking-wider uppercase font-sans mr-0.5">Menu</span>
                  </div>
                ) : (
                  <ChevronLeft className="w-4 h-4" />
                )}
              </button>

              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-600 text-white shadow-md shadow-amber-500/15 hidden sm:block shrink-0">
                  <Building2 className="w-5.5 h-5.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] uppercase tracking-widest font-extrabold font-mono text-indigo-700 bg-indigo-50 px-2 border border-indigo-105 rounded-md flex-shrink-0">
                      {viewMode === 'weekly' ? 'WEEKLY WBS REPORT' : 'DAILY REPORT JOURNAL'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono hidden xs:inline">v1.2</span>
                  </div>
                  <h1 className="text-sm sm:text-base font-black font-display tracking-tight text-slate-950 truncate mt-0.5">
                    {viewMode === 'weekly' ? 'WEEKLY WBS CONSTRUCTION REPORT' : 'Laporan Harian Pekerjaan Gedung Mako Utama'}
                  </h1>
                </div>
              </div>
            </div>

            {/* Right Header actions block */}
            <div className="flex items-center gap-2.5 shrink-0">
              {/* Dynamic Remaining Days critical warning badge */}
              {remainingDays < 30 && (
                <div 
                  className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-705 rounded-xl text-2xs sm:text-xs font-serif font-black uppercase tracking-wide animate-pulse select-none shadow-xs text-rose-700"
                  title="Peringatan Batas Waktu Kontrak Pekerjaan Tersisa Kritis (< 30 Hari)!"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span className="font-sans">Sisa {remainingDays} Hari!</span>
                </div>
              )}

              {/* Dynamic Header Time Widget */}
              <div className="hidden lg:flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl select-none font-sans">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                <span className="text-[10px] font-extrabold text-slate-450 font-mono uppercase tracking-wider shrink-0">Waktu Sistem:</span>
                <span className="text-[11px] font-black text-slate-800 shrink-0">
                  {getFormattedSystemTime().dayName}, {getFormattedSystemTime().dateString}
                </span>
                <span className="text-[11px] font-bold font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg shrink-0 border border-indigo-100/50">
                  {getFormattedSystemTime().timeString}
                </span>
              </div>

              <button
                onClick={() => window.print()}
                title="Cetak Tampilan Lapangan Teroptimasi (Ctrl + P)"
                className="btn-3d-active flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-2xs sm:text-xs font-black cursor-pointer transition-all shadow-xs"
              >
                <Printer className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Versi Cetak</span>
              </button>

              <button
                onClick={() => setShowExportModal(true)}
                title="Ekspor Seluruh Parameter Dasbor ke Dokumen PDF A4"
                className="btn-3d-active flex items-center gap-1.5 px-3.5 py-2.5 bg-gradient-to-tr from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-650 text-white rounded-xl text-2xs sm:text-xs font-black cursor-pointer shadow-md shadow-amber-500/10 transition-all hover:scale-102"
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Ekspor PDF (A4)</span>
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowSheetDropdown(!showSheetDropdown)}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 rounded-xl text-2xs sm:text-xs font-semibold text-slate-700 hover:text-slate-950 transition-all shadow-xs"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="hidden sm:inline">Google Sheets</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 transition-transform duration-200" style={{ transform: showSheetDropdown ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                </button>

                {showSheetDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowSheetDropdown(false)} />
                    <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-100 rounded-2xl shadow-xl p-2 z-50 animate-fade-in origin-top-right">
                      <div className="px-3 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                        PILIH SUMBER DATA SPREADSHEET
                      </div>
                      
                      <a
                        href="https://docs.google.com/spreadsheets/d/e/2PACX-1vSVt1_mMr78TcXZ6wRBatp61hSXe5zbBu6iUwkWsi0UaQpTxtls1Vw0tEFNHPlSCHsvQ1_ET4NDfS9j/pubhtml?gid=313978686&single=true"
                        target="_blank"
                        rel="noreferrer referrer"
                        onClick={() => setShowSheetDropdown(false)}
                        className="flex items-start gap-2.5 p-2.5 mt-1 hover:bg-slate-50 rounded-xl transition-all group lg:col-span-1"
                      >
                        <div className="p-1 px-2.5 bg-amber-50 rounded-lg text-amber-600 font-bold text-[9px] flex items-center justify-center mt-0.5 select-none">
                          HARIAN
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-slate-755 flex items-center gap-1 group-hover:text-amber-600 transition-colors">
                            Laporan Harian Pekerjaan
                            <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
                          </div>
                          <p className="text-[9px] text-slate-505 leading-tight mt-0.5">
                            Log harian kegiatan, jumlah tenaga kerja, material & cuaca aktual lapangan.
                          </p>
                        </div>
                      </a>

                      <a
                        href="https://docs.google.com/spreadsheets/d/e/2PACX-1vSqQdgFPW0r0KXFGwV-b6b7lFwjqg-r4iSFXHXIoAhoy8lkidYRXNnLSAXpe9Ny16FC6D3rUbEkiLNH/pubhtml?gid=10019249&single=true"
                        target="_blank"
                        rel="noreferrer referrer"
                        onClick={() => setShowSheetDropdown(false)}
                        className="flex items-start gap-2.5 p-2.5 hover:bg-slate-50 rounded-xl transition-all group"
                      >
                        <div className="p-1 px-2 bg-indigo-50 rounded-lg text-indigo-600 font-bold text-[9px] flex items-center justify-center mt-0.5 select-none">
                          MINGGUAN
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-slate-755 flex items-center gap-1 group-hover:text-indigo-600 transition-colors">
                            Laporan Progres Mingguan
                            <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
                          </div>
                          <p className="text-[9px] text-slate-505 leading-tight mt-0.5">
                            Tabel & kurva realisasi S-Curve, rencana akumulatif, plus pembobotan sub-bidang.
                          </p>
                        </div>
                      </a>
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>

          {/* Project Details Ribbon */}
          <div className="w-full mt-3.5 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-2xs md:text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 bg-slate-50/60 hover:bg-slate-50 border border-slate-100/60 p-2.5 rounded-xl transition-all min-w-0">
              <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider shrink-0">Pekerjaan:</span>
              <span className="font-black text-slate-900 truncate" title="Pekerjaani Renovasi Gedung Mako Utama">Pekerjaani Renovasi Gedung Mako Utama</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 bg-slate-50/60 hover:bg-slate-50 border border-slate-100/60 p-2.5 rounded-xl transition-all min-w-0">
              <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider shrink-0">Penyedia:</span>
              <span className="font-black text-slate-900 truncate" title="PT. Bina Konstruksi Abadi">PT. Bina Konstruksi Abadi</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 bg-slate-50/60 hover:bg-slate-50 border border-slate-100/60 p-2.5 rounded-xl transition-all min-w-0">
              <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider shrink-0">No Perj/Kontrak:</span>
              <span className="font-black text-slate-950 font-mono text-[10px] sm:text-2xs truncate" title="Sperj/03/V/2026/Koopsudnas tgl. 25 Mei 2026">Sperj/03/V/2026/Koopsudnas tgl. 25 Mei 2026</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 bg-indigo-50/30 hover:bg-indigo-50/50 border border-indigo-100/40 p-2.5 rounded-xl transition-all min-w-0">
              <span className="font-bold text-indigo-500 text-[10px] uppercase tracking-wider shrink-0">Pelaksanaan:</span>
              <span className="font-black text-indigo-750 truncate" title="210 HK (25 Mei 2026 s/d 21 Desember 2026)">210 HK (25 Mei 2026 s/d 21 Desember 2026)</span>
            </div>
          </div>
        </header>

        {/* Scrollable grid area for layout modules */}
        <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1 overflow-y-auto">
        
        {/* Real-time Loader or Errors block */}
        {loading ? (
          <div className="py-24 text-center">
            <div className="inline-flex relative mb-4">
              <div className="w-12 h-12 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin" />
              <Building2 className="w-5 h-5 text-amber-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800 font-sans">Mengambil Data Google Sheets</h3>
            <p className="text-xs text-slate-500 mt-1 font-sans">Menyelaraskan log harian dengan database lapangan proyek...</p>
          </div>
        ) : error ? (
          <div className="py-16 text-center max-w-md mx-auto bg-[#1e293b] border border-[#334155] rounded-2xl p-6 shadow-sm">
            <CloudRain className="w-12 h-12 text-rose-500 mx-auto mb-3 animate-bounce" />
            <h3 className="text-base font-bold text-rose-400 font-sans">Sinkronisasi Gagal</h3>
            <p className="text-xs text-slate-350 mt-2 font-sans mb-4">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all"
            >
              Coba Muat Ulang Halaman
            </button>
          </div>
        ) : (
          <div className="space-y-8 animate-fade-in">
            
            {/* Real-time Rain Warning Notification Banner */}
            {!dismissAlert && weatherAlerts.length > 0 && (
              <div className="bg-gradient-to-r from-amber-50 via-rose-50 to-white border border-rose-200/80 rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in">
                {/* Background glow decorator */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-rose-200/10 rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex items-start gap-4 relative z-10 flex-1">
                  <div className="p-3 rounded-xl bg-rose-150 text-rose-700 border border-rose-200 shrink-0 select-none animate-pulse">
                    <CloudRain className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-[#e11d48] font-mono flex items-center gap-2">
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
                      </span>
                      <span>Sistem Deteksi Hujan Otomatis</span>
                    </h4>
                    <div className="mt-2.5 space-y-3">
                      {weatherAlerts.map((alert) => (
                        <div key={alert.id} className="text-xs text-slate-700 leading-relaxed font-sans font-medium">
                          <span className="font-bold text-amber-850 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200 mr-2">
                            {alert.type === 'today' ? 'Hari Ini' : 'Esok'} ({alert.hari})
                          </span>
                          {alert.pesan}
                          <button
                            onClick={() => setSelectedDayNo(alert.dayNo)}
                            className="ml-2 inline-flex items-center gap-1 text-[11px] text-amber-700 font-extrabold hover:underline transition-all cursor-pointer underline-offset-2 hover:text-amber-900"
                          >
                            Filter Hari ke-{alert.dayNo} ➔
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-stretch md:self-auto justify-end border-t md:border-t-0 border-slate-200 pt-3 md:pt-0 shrink-0">
                  <button
                    onClick={() => setDismissAlert(true)}
                    className="p-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-xs text-slate-700 hover:text-slate-900 rounded-lg border border-slate-250 transition-colors font-semibold cursor-pointer select-none"
                  >
                    Tutup Notifikasi
                  </button>
                </div>
              </div>
            )}

            {(viewMode === 'all' || viewMode === 'daily') && (
              <>
                {/* Filter Bar with Segmented Controls */}
                <div className="bg-white/80 backdrop-blur-md border border-sky-100/60 rounded-3xl p-5.5 shadow-md friendly-card-shadow flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10 transition-3d hover:shadow-lg">
                  {/* Left Side: Segmented range selector */}
                  <div className="flex flex-wrap items-center gap-5">
                    <div>
                      <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest font-mono block mb-2">Rentang Laporan</span>
                      <div className="inline-flex p-1 bg-slate-100/80 rounded-2xl border border-slate-200">
                        <button
                          onClick={() => setDateRange('7')}
                          className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            dateRange === '7' 
                              ? 'bg-gradient-to-b from-white to-amber-50 text-amber-800 shadow-xs border border-amber-200' 
                              : 'text-slate-500 hover:text-slate-900 font-bold hover:scale-102'
                          }`}
                        >
                          7 Hari
                        </button>
                        <button
                          onClick={() => setDateRange('14')}
                          className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            dateRange === '14' 
                              ? 'bg-gradient-to-b from-white to-amber-50 text-amber-800 shadow-xs border border-amber-200' 
                              : 'text-slate-500 hover:text-slate-900 font-bold hover:scale-102'
                          }`}
                        >
                          14 Hari
                        </button>
                        <button
                          onClick={() => setDateRange('all')}
                          className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            dateRange === 'all' 
                              ? 'bg-gradient-to-b from-white to-amber-50 text-slate-800 shadow-xs border border-slate-250' 
                              : 'text-slate-500 hover:text-slate-900 font-bold hover:scale-102'
                          }`}
                        >
                          Semua
                        </button>
                      </div>
                    </div>

                    {/* Weather Select dropdown */}
                    <div>
                      <span className="text-[10px] font-extrabold text-slate-550 uppercase tracking-widest font-mono block mb-2">Pecahan Cuaca</span>
                      <div className="relative">
                        <select
                          value={weatherFilter}
                          onChange={(e) => setWeatherFilter(e.target.value)}
                          className="bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold py-1.5 pl-3.5 pr-8 rounded-xl border border-slate-200 outline-none appearance-none cursor-pointer focus:ring-1 focus:ring-amber-500"
                        >
                          <option value="all">Semua Kondisi</option>
                          <option value="cerah">Cerah ☀️</option>
                          <option value="berawan">Berawan ☁️</option>
                          <option value="hujan">Hujan 🌧️</option>
                        </select>
                        <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* Specific Day Selector Dropdown */}
                    <div>
                      <span className="text-[10px] font-extrabold text-slate-550 uppercase tracking-widest font-mono block mb-2">Pilih Hari Spesifik</span>
                      <div className="relative">
                        <select
                          value={selectedDayNo || 'all'}
                          onChange={(e) => setSelectedDayNo(e.target.value === 'all' ? null : Number(e.target.value))}
                          className="bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold py-1.5 pl-3.5 pr-8 rounded-xl border border-slate-200 outline-none appearance-none cursor-pointer focus:ring-1 focus:ring-amber-500"
                        >
                          <option value="all">Semua Hari</option>
                          {filteredData.map(r => (
                            <option key={r.no} value={r.no}>Hari ke-{r.no} ({r.tanggalParsed.tanggalStr.replace(' 2026', '')})</option>
                          ))}
                        </select>
                        <Calendar className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Smart Search field */}
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1 sm:w-64">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Cari kegiatan, material, tanggal..."
                        className="w-full bg-white text-slate-800 pl-9 pr-8 py-2 rounded-xl text-xs font-semibold border border-slate-200 focus:outline-none focus:border-amber-500 hover:border-slate-350 transition-all font-sans placeholder-slate-400"
                      />
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                      {searchQuery && (
                        <button 
                          onClick={() => setSearchQuery('')}
                          className="text-slate-400 hover:text-slate-600 absolute right-3 top-1/2 transform -translate-y-1/2"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {(searchQuery || weatherFilter !== 'all' || dateRange !== '7' || selectedDayNo !== null) && (
                      <button
                        onClick={clearFilters}
                        className="px-3.5 py-2 bg-amber-500/10 border border-amber-200 hover:bg-amber-500/20 text-amber-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                        title="Reset Filter"
                      >
                        <span>Reset</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <MetricCard 
                    title="Siklus Laporan"
                    value={`${filteredData.length} Hari`}
                    subValue={`Terkini: ${filteredData[filteredData.length - 1]?.tanggalParsed.hari}, ${filteredData[filteredData.length - 1]?.tanggalParsed.tanggalStr}`}
                    icon={<Calendar className="w-5 h-5 text-amber-600" />}
                  />
                  <MetricCard 
                    title="Rata-rata Tenaga Kerja"
                    value={`${metrics.averageWorkers} Org`}
                    subValue={`Maksimal harian: ${metrics.maxWorkersInDay} Org`}
                    icon={<Users className="w-5 h-5 text-emerald-600" />}
                    colorClass="from-emerald-50 text-emerald-600"
                  />
                  <MetricCard 
                    title="Hari Terdampak Hujan"
                    value={`${metrics.rainyDaysCount} Hari`}
                    subValue={`${Math.round((metrics.rainyDaysCount / (filteredData.length || 1)) * 105) % 100}% dari rentang terpilih`}
                    icon={<CloudRain className="w-5 h-5 text-sky-600" />}
                    colorClass="from-sky-50 text-sky-600"
                  />
                  <MetricCard 
                    title="Total Kegiatan Terdata"
                    value={`${filteredData.reduce((acc, r) => acc + r.uraianKegiatan.length, 0)} Poin`}
                    subValue="Meliputi bongkaran, plester, plafond, dll"
                    icon={<TrendingUp className="w-5 h-5 text-slate-600" />}
                    colorClass="from-slate-50 text-slate-600"
                  />
                </div>

                {/* Grid for Chart & Dynamic Insights */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Stacked Chart (2 Columns Large) */}
                  <div className="lg:col-span-2">
                    <WorkerChart 
                      data={filteredData} 
                      selectedDayNo={selectedDayNo} 
                      onSelectDayNo={setSelectedDayNo} 
                    />
                  </div>

                  {/* Fast facts and Weather recap */}
                  <div className="bg-white border border-sky-100/60 rounded-3xl p-6 shadow-md friendly-card-shadow flex flex-col transition-3d hover:shadow-lg">
                    <h4 className="text-sm font-black text-slate-800 font-sans mb-1 flex items-center gap-1.5">
                      <span className="text-sm">🚚</span> Rangkuman Agregat Logistik
                    </h4>
                    <p className="text-xs text-slate-500 font-sans mb-4">Penggunaan material & sirkulasi selama periode terpilih</p>
                    
                    <div className="space-y-3.5 max-h-[260px] overflow-y-auto pr-1 flex-1">
                      {filteredData.slice(-5).map((r, idx) => (
                        <div key={idx} className="border-b border-dashed border-slate-100 pb-3 last:border-0 last:pb-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">{r.tanggalRaw}</span>
                            <span className="text-[9px] bg-slate-50 text-slate-600 border border-slate-200/60 px-1.5 py-0.5 rounded font-bold font-sans">Hari ke-{r.no}</span>
                          </div>
                          <p className="text-xs text-slate-700 leading-snug font-sans font-medium hover:text-slate-950 truncate" title={r.material}>
                            {r.material && r.material !== '[Tidak Ada Material Datang]' && r.material !== '[Tidak Ada Material Masuk]' && r.material !== '[Tidak Ada Material Datang Hari Ini]' ? (
                              r.material
                            ) : (
                              <span className="text-slate-400 italic font-normal">Tidak ada sirkulasi material terdata</span>
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Weekly Progress S-Curve & Sectoral Analysis (Live Google Sheets TSV Sourced) */}
            {(viewMode === 'all' || viewMode === 'weekly') && (
              <WeeklyProgressPanel />
            )}

            {/* AI Advisor Panel */}
            {(viewMode === 'all' || viewMode === 'weekly' || viewMode === 'daily') && (
              <AIStudyPanel reportData={filteredData} onAnalysisChange={setAnalysis} />
            )}

            {/* Daily Report Detailed Timeline */}
            {(viewMode === 'all' || viewMode === 'daily') && (
              <ReportTimeline data={filteredTimelineData} />
            )}

          </div>
        )}
      </main>

      <footer className="border-t border-sky-100/80 bg-white/60 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center font-sans">
          <p className="text-xs text-slate-500 font-sans">
            Sistem Pemantauan Konstruksi Digital • Pekerjaan Gedung Mako Utama
          </p>
          <p className="text-[10px] text-slate-400 mt-1 font-sans">
            Diperbarui secara real-time dari Google Spreadsheet terintegrasi resmi.
          </p>
        </div>
      </footer>
    </div> {/* Closes the flex-1 main right column container */}

      {/* Dynamic Floating Menu (Menu Harian & Mingguan - Otomatis Tersembunyi) */}
      <div 
        className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2.5 font-sans"
        onMouseLeave={() => setIsMenuOpen(false)}
      >
        {/* Expanded Options Panel */}
        {isMenuOpen && (
          <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 text-white rounded-2xl p-3.5 shadow-2xl flex flex-col gap-2 w-52 sm:w-56 animate-fade-in duration-200">
            <div className="border-b border-slate-800 pb-2 mb-1 px-1 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest block font-mono">Navigasi View</span>
                <p className="text-[9px] text-slate-400 mt-0.5">Otomatis tersembunyi</p>
              </div>
              <button 
                onClick={() => setIsMenuOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            
            <button
              onClick={() => {
                setViewMode('all');
                setIsMenuOpen(false);
              }}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                viewMode === 'all' 
                  ? 'bg-amber-500 text-slate-950 font-black' 
                  : 'hover:bg-slate-800 text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span>Seluruh Dasbor (All)</span>
            </button>

            <button
              onClick={() => {
                setViewMode('daily');
                setIsMenuOpen(false);
              }}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                viewMode === 'daily' 
                  ? 'bg-amber-500 text-slate-950 font-black' 
                  : 'hover:bg-slate-800 text-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>Laporan Harian (Daily)</span>
            </button>

            <button
              onClick={() => {
                setViewMode('weekly');
                setIsMenuOpen(false);
              }}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                viewMode === 'weekly' 
                  ? 'bg-amber-500 text-slate-950 font-black' 
                  : 'hover:bg-slate-800 text-slate-200'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 shrink-0" />
              <span>Kemajuan Mingguan (S-Curve)</span>
            </button>
          </div>
        )}

        {/* Floating Toggle Trigger Button (Starts collapsed) */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          onMouseEnter={() => setIsMenuOpen(true)}
          className="btn-3d-active flex items-center gap-2 px-4 py-3 bg-gradient-to-tr from-slate-900 to-slate-950 hover:from-slate-800 hover:to-slate-900 border border-slate-850 text-white rounded-full shadow-2xl cursor-pointer transition-all hover:scale-105 select-none relative"
          title="Menu Pintasan Tampilan Harian / Mingguan"
          id="btn-floating-view-selector"
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <Menu className={`w-4 h-4 transition-transform duration-300 ${isMenuOpen ? 'rotate-90' : ''}`} />
          <span className="text-xs font-extrabold tracking-wide font-sans">Menu Dasbor</span>
        </button>
      </div>

      {/* PDF Export Configuration Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
          {/* Backdrop blur overlay */}
          <div 
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs animate-fade-in" 
            onClick={() => setShowExportModal(false)}
          />
          
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-7 shadow-2xl relative z-10 w-full max-w-md transition-all transform scale-100 flex flex-col gap-5 select-none font-sans animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/15 text-amber-600 rounded-2xl shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">Pengaturan Ekspor PDF</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">Atur parameter dan rentang cakupan laporan sebelum dicetak.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-xl transition-all cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 text-left">
              
              {/* Format Cetak Laporan Selection */}
              <div className="space-y-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono block">Format Cetak Laporan</span>
                <div className="grid grid-cols-2 gap-2 pb-1">
                  <button
                    type="button"
                    onClick={() => setPdfType('comprehensive')}
                    className={`flex flex-col gap-1 items-start text-left p-3 rounded-2xl border transition-all cursor-pointer ${pdfType === 'comprehensive' ? 'bg-amber-500/10 border-amber-400 text-slate-900 shadow-sm' : 'bg-slate-50/50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                  >
                    <span className="text-xs font-black">Laporan Komprehensif</span>
                    <span className="text-[9px] text-slate-500 leading-normal">Lengkap dengan grafik S-Curve, rincian harian & analisis AI.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPdfType('sector_only')}
                    className={`flex flex-col gap-1 items-start text-left p-3 rounded-2xl border transition-all cursor-pointer ${pdfType === 'sector_only' ? 'bg-amber-500/10 border-amber-400 text-slate-900 shadow-sm' : 'bg-slate-50/50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                  >
                    <span className="text-xs font-black flex items-center gap-1">
                      Laporan Sektoral <span className="text-[7.5px] px-1 py-0.5 bg-amber-500 text-white rounded font-mono font-bold uppercase tracking-wider">A-K Saja</span>
                    </span>
                    <span className="text-[9px] text-slate-500 leading-normal">Fokus eksklusif pada rekapitulasi progres per bidang pekerjaan (A-K).</span>
                  </button>
                </div>
              </div>

              {pdfType === 'comprehensive' && (
                <>
                  {/* Toggle Sections Included Component (Addresses: "hanya untuk laporan mingguan") */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono block">Elemen Yang Disertakan</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pb-1">
                      {/* Toggle 1: S-Curve Mingguan */}
                      <label className={`flex items-center gap-1.5 px-2.5 py-2.5 rounded-xl border transition-all cursor-pointer ${includeWeeklySCurve ? 'bg-amber-500/10 border-amber-400/50 text-slate-900 shadow-sm' : 'bg-slate-50/50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                        <input 
                          type="checkbox"
                          checked={includeWeeklySCurve}
                          onChange={(e) => setIncludeWeeklySCurve(e.target.checked)}
                          className="accent-amber-500 h-3 w-3 shrink-0"
                        />
                        <span className="text-[10.5px] font-bold">Mingguan</span>
                      </label>
                      
                      {/* Toggle 2: Jurnal Harian */}
                      <label className={`flex items-center gap-1.5 px-2.5 py-2.5 rounded-xl border transition-all cursor-pointer ${includeDailyTimeline ? 'bg-amber-500/10 border-amber-400/50 text-slate-900 shadow-sm' : 'bg-slate-50/50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                        <input 
                          type="checkbox"
                          checked={includeDailyTimeline}
                          onChange={(e) => setIncludeDailyTimeline(e.target.checked)}
                          className="accent-amber-500 h-3 w-3 shrink-0"
                        />
                        <span className="text-[10.5px] font-bold">Harian</span>
                      </label>

                      {/* Toggle 3: Analisis AI Gemini */}
                      <label className={`flex items-center gap-1.5 px-2.5 py-2.5 rounded-xl border transition-all cursor-pointer ${includeAIAnalysis ? 'bg-amber-500/10 border-amber-400/50 text-slate-900 shadow-sm' : 'bg-slate-50/50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                        <input 
                          type="checkbox"
                          checked={includeAIAnalysis}
                          onChange={(e) => setIncludeAIAnalysis(e.target.checked)}
                          className="accent-amber-500 h-3 w-3 shrink-0"
                        />
                        <span className="text-[10.5px] font-bold flex items-center gap-0.5">
                          Analitika AI <Sparkles className="w-2.5 h-2.5 text-amber-500 shrink-0 animate-pulse" />
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Dropdown Selector for Daily Scope */}
                  {includeDailyTimeline && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono block">Cakupan Jurnal Harian</span>
                      <div className="relative">
                        <select
                          value={pdfScope}
                          onChange={(e) => setPdfScope(e.target.value as any)}
                          className="w-full bg-white hover:bg-slate-50 border border-slate-200 py-2.5 pl-3.5 pr-10 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-amber-500 shadow-xs cursor-pointer appearance-none transition-colors"
                        >
                          <option value="7">7 Hari Terakhir</option>
                          <option value="14">14 Hari Terakhir</option>
                          <option value="all">Seluruh Hari Kerja ({reports.length} Hari)</option>
                          <option value="custom">Rentang Hari Kustom (Hari Ke-X s/d Hari Ke-Y)</option>
                          <option value="custom_date">Rentang Tanggal Kalender (Mulai s/d Selesai)</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-slate-400 text-[10px]">
                          ▼
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Option 4 Extra Input Form: Rentang Hari Kustom (X-Y) */}
                  {includeDailyTimeline && pdfScope === 'custom' && (
                    <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-3.5 grid grid-cols-2 gap-4 animate-fade-in text-left">
                      <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1 font-mono">Hari Mulai (Ke-)</label>
                        <select
                          value={customStartDay}
                          onChange={(e) => setCustomStartDay(Number(e.target.value))}
                          className="bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold py-2 px-2.5 rounded-xl border border-slate-200 w-full outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer shadow-xs"
                        >
                          {Array.from({ length: reports.length }, (_, i) => i + 1).map(day => (
                            <option key={day} value={day}>Hari-{day}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-550 uppercase tracking-widest block mb-1 font-mono">Hari Akhir (Ke-)</label>
                        <select
                          value={customEndDay}
                          onChange={(e) => setCustomEndDay(Number(e.target.value))}
                          className="bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold py-2 px-2.5 rounded-xl border border-slate-200 w-full outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer shadow-xs"
                        >
                          {Array.from({ length: reports.length }, (_, i) => i + 1).map(day => (
                            <option key={day} value={day}>Hari-{day}</option>
                          ))}
                        </select>
                      </div>
                      {customStartDay > customEndDay && (
                        <div className="col-span-2 text-[10px] text-rose-600 font-bold bg-rose-50 border border-rose-200 p-2.5 rounded-xl flex items-center gap-1.5 select-none">
                          <span>⚠️ Hari awal tidak boleh melampaui hari akhir.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Option 5 Extra Input Form: Rentang Tanggal Kalender (Mulai - Sampai) */}
                  {includeDailyTimeline && pdfScope === 'custom_date' && (
                    <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-3.5 grid grid-cols-2 gap-3 animate-fade-in text-left">
                      <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1 font-mono">Mulai Tanggal</label>
                        <input
                          type="date"
                          value={customStartDateVal}
                          onChange={(e) => setCustomStartDateVal(e.target.value)}
                          className="bg-white text-slate-800 text-xs font-bold py-2 px-2 rounded-xl border border-slate-200 w-full outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer shadow-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-550 uppercase tracking-widest block mb-1 font-mono">Sampai Tanggal</label>
                        <input
                          type="date"
                          value={customEndDateVal}
                          onChange={(e) => setCustomEndDateVal(e.target.value)}
                          className="bg-white text-slate-800 text-xs font-bold py-2 px-2 rounded-xl border border-slate-200 w-full outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer shadow-xs"
                        />
                      </div>
                      {customStartDateVal && customEndDateVal && new Date(customStartDateVal) > new Date(customEndDateVal) && (
                        <div className="col-span-2 text-[10px] text-rose-600 font-bold bg-rose-50 border border-rose-200 p-2.5 rounded-xl flex items-center gap-1.5 select-none">
                          <span>⚠️ Tanggal mulai tidak boleh melampaui tanggal selesai.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Global Warning: if neither Weekly nor Daily nor AI is selected */}
                  {!includeWeeklySCurve && !includeDailyTimeline && !includeAIAnalysis && (
                    <div className="text-[10px] text-rose-600 font-bold bg-rose-50 border border-rose-200 p-2.5 rounded-xl flex items-center gap-1.5 select-none">
                      <span>⚠️ Silakan pilih minimal salah satu elemen di atas untuk diekspor ke PDF.</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={
                  pdfType === 'comprehensive' && (
                    (!includeWeeklySCurve && !includeDailyTimeline && !includeAIAnalysis) ||
                    (includeDailyTimeline && pdfScope === 'custom' && customStartDay > customEndDay) ||
                    (includeDailyTimeline && pdfScope === 'custom_date' && customStartDateVal && customEndDateVal && new Date(customStartDateVal) > new Date(customEndDateVal))
                  )
                }
                onClick={() => {
                  exportDashboardToPDF(
                    includeDailyTimeline ? pdfScope : '7', 
                    customStartDay, 
                    customEndDay, 
                    customStartDateVal, 
                    customEndDateVal,
                    pdfType
                  );
                  setShowExportModal(false);
                }}
                className="px-5 py-2.5 bg-gradient-to-tr from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-655 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 hover:text-white font-extrabold rounded-xl text-xs shadow-md shadow-amber-500/10 transition-all cursor-pointer"
              >
                Unduh Dokumen PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
