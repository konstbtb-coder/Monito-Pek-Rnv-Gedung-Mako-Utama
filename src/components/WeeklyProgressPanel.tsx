import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  Layers, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  Activity, 
  Loader2,
  AlertCircle,
  Clock,
  Briefcase,
  Sliders,
  ChevronRight,
  HelpCircle,
  Sparkles,
  Search
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ReferenceLine
} from 'recharts';
import { WeeklyProgressResponse, WeeklyProgressCategory } from '../types';
import { fetchWeeklyProgressDirectly } from '../utils/fallbackFetcher';

export function WeeklyProgressPanel() {
  const [data, setData] = useState<WeeklyProgressResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWeekIdx, setSelectedWeekIdx] = useState<number>(0);
  const [filterActiveOnly, setFilterActiveOnly] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    async function fetchWeeklyProgress() {
      try {
        setLoading(true);
        setError(null);
        let fetchedWeekly: WeeklyProgressResponse | null = null;

        try {
          const res = await fetch('/api/weekly-progress');
          if (res.ok) {
            const resData = await res.json();
            if (resData.success) {
              fetchedWeekly = resData;
            }
          }
        } catch (apiErr) {
          console.warn("Backend /api/weekly-progress not accessible. Falling back to client-side Google Sheet TSV parser...", apiErr);
        }

        if (!fetchedWeekly) {
          console.log("WeeklyProgressPanel fetching weekly progress directly from Google Sheets TSV...");
          fetchedWeekly = await fetchWeeklyProgressDirectly();
        }

        if (fetchedWeekly) {
          setData(fetchedWeekly);
          
          // Auto-select latest week with actual progress > 0
          const latestIdx = fetchedWeekly.riil.reduce((acc: number, val: number, idx: number) => {
            return val > 0 ? idx : acc;
          }, 0);
          setSelectedWeekIdx(latestIdx);
        } else {
          throw new Error("Gagal memproses data laporan mingguan.");
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Gagal memproses data progres mingguan.");
      } finally {
        setLoading(false);
      }
    }
    fetchWeeklyProgress();
  }, []);

  // Format Recharts data
  const chartData = useMemo(() => {
    if (!data) return [];
    
    return data.headers.map((header, idx) => {
      const weenNum = idx + 1;
      const plans = data.rencana[idx];
      const actuals = data.riil[idx];
      const deviation = data.deviasi[idx];
      
      return {
        name: `W-${weenNum}`,
        date: header,
        'Rencana (%)': plans,
        'Riil (%)': actuals,
        'Deviasi (%)': deviation,
        plainDate: header,
        weekIndex: idx
      };
    });
  }, [data]);

  // Filtered chart data based on active range
  const filteredChartData = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];
    if (!filterActiveOnly) return chartData;
    
    // Find last index of actuals with data > 0
    if (!data) return chartData;
    const lastActiveIdx = data.riil.reduce((acc: number, val: number, i: number) => {
      return val > 0 ? i : acc;
    }, 0);
    
    // Show up to lastActiveIdx + 4 weeks for context / projection
    const endIndex = Math.min(chartData.length, lastActiveIdx + 5);
    return chartData.slice(0, endIndex);
  }, [chartData, filterActiveOnly, data]);

  // Current active details
  const activeWeekInfo = useMemo(() => {
    if (!data || selectedWeekIdx < 0 || selectedWeekIdx >= data.headers.length) return null;
    
    const dateStr = data.headers[selectedWeekIdx];
    const plan = data.rencana[selectedWeekIdx] || 0;
    const actual = data.riil[selectedWeekIdx] || 0;
    const deviation = data.deviasi[selectedWeekIdx] || 0;
    
    return {
      index: selectedWeekIdx,
      weekNum: selectedWeekIdx + 1,
      date: dateStr,
      plan,
      actual,
      deviation
    };
  }, [data, selectedWeekIdx]);

  // Unique categories list to prevent duplicates in the Jurnal table
  const uniqueCategories = useMemo(() => {
    if (!data || !data.categories) return [];
    const seen = new Set<string>();
    const unique: WeeklyProgressCategory[] = [];
    for (const cat of data.categories) {
      if (!seen.has(cat.code)) {
        seen.add(cat.code);
        unique.push(cat);
      }
    }
    return unique;
  }, [data]);

  // Filter categories based on search input
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return uniqueCategories;
    const q = searchQuery.toLowerCase().trim();
    return uniqueCategories.filter(cat => 
      cat.code.toLowerCase().includes(q) || 
      cat.name.toLowerCase().includes(q)
    );
  }, [uniqueCategories, searchQuery]);

  if (loading) {
    return (
      <div className="bg-white border border-sky-100/60 rounded-3xl p-8 shadow-sm flex flex-col items-center justify-center min-h-[350px]">
        <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-600 font-sans">Mengambil dan mengurai data S-Curve mingguan...</p>
        <p className="text-xs text-slate-400 font-sans mt-1">Sumber: Google Sheets TSV Live</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-rose-50/50 border border-rose-100 rounded-3xl p-6 shadow-sm flex items-start gap-4 mb-6">
        <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-bold text-rose-900 font-sans">Gagal memuat Progres Mingguan</h4>
          <p className="text-xs text-rose-700/80 mt-1 font-sans">{error || "Terjadi galat tak diketahui saat memuat data TSV."}</p>
          <p className="text-[10px] text-slate-500 mt-2 font-sans">Silakan periksa koneksi internet atau ketersediaan spreadsheet terkait.</p>
        </div>
      </div>
    );
  }

  const overallMaxActual = data.riil.reduce((acc, v) => (v > acc ? v : acc), 0);
  const overallLatestActiveWeek = data.riil.reduce((acc, v, i) => (v > 0 ? i : acc), 0) + 1;

  // Health summary metrics based on latest actual progress deviation
  const latestActiveIdx = Math.max(0, overallLatestActiveWeek - 1);
  const latestDeviation = data.deviasi[latestActiveIdx] || 0;
  const latestActual = data.riil[latestActiveIdx] || 0;
  const latestPlan = data.rencana[latestActiveIdx] || 0;
  const latestDate = data.headers[latestActiveIdx] || "";
  const latestWeekNum = latestActiveIdx + 1;

  let healthStatusStr = "Sehat";
  let healthClass = "bg-emerald-50/60 border-emerald-100 text-emerald-900";
  let healthIndicatorCol = "bg-emerald-500";
  let healthIcon = "🌸"; 
  let healthDesc = "Kemajuan proyek melebihi atau sesuai dengan target rencana mingguan (deviasi positif atau netral).";

  if (latestDeviation < -2.0) {
    healthStatusStr = "Kritis";
    healthClass = "bg-rose-50/60 border-rose-100/70 text-rose-950";
    healthIndicatorCol = "bg-rose-500";
    healthIcon = "🚨";
    healthDesc = "Proyek mengalami kendala keterlambatan serius di bawah batas toleransi deviasi (-2%). Diperlukan akselerasi segera!";
  } else if (latestDeviation < 0.0) {
    healthStatusStr = "Terlambat";
    healthClass = "bg-amber-50/60 border-amber-100/70 text-amber-950";
    healthIndicatorCol = "bg-amber-500";
    healthIcon = "⚠️";
    healthDesc = "Terjadi keterlambatan minor yang perlu diwaspadai agar tidak menghambat sisa jadwal rencana konstruksi.";
  }

  return (
    <div className="space-y-6">
      {/* SECTION HEADER BAR */}
      <div className="bg-gradient-to-r from-teal-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-lg border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-amber-500 text-slate-900 shadow-md">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] uppercase font-bold tracking-widest bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md font-mono">
                  S-CURVE ANALYSIS
                </span>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
              <h3 className="text-lg font-black tracking-tight font-sans mt-0.5">Analisa Progres Mingguan & Kurva Penyelarasan</h3>
              <p className="text-xs text-slate-300/80 font-sans">Visualisasi detail kemajuan Bobot Rencana (S-Curve) terhadap realisasi riil lapangan</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a 
              href="https://docs.google.com/spreadsheets/d/e/2PACX-1vSqQdgFPW0r0KXFGwV-b6b7lFwjqg-r4iSFXHXIoAhoy8lkidYRXNnLSAXpe9Ny16FC6D3rUbEkiLNH/pubhtml?gid=10019249&single=true"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/10 transition-all hover:scale-102 cursor-pointer"
            >
              <span>Buka Google Sheet S-Curve</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* TOP GLIMPSE ROW */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 border-t border-white/10 pt-5 text-sm">
          <div>
            <p className="text-[10px] text-slate-400 font-extrabold uppercase font-mono tracking-wider">Metode Data</p>
            <p className="text-sm font-bold mt-1">Kumulatif Bobot %</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-extrabold uppercase font-mono tracking-wider">Durasi Proyek</p>
            <p className="text-sm font-bold mt-1 text-amber-400">{data.headers.length} Minggu</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-extrabold uppercase font-mono tracking-wider">Realisasi Aktual</p>
            <p className="text-sm font-bold mt-1 text-emerald-400">{overallMaxActual.toFixed(2)}% (W-{overallLatestActiveWeek})</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-extrabold uppercase font-mono tracking-wider">Target Akhir</p>
            <p className="text-sm font-bold mt-1 text-sky-400">100.00% Real</p>
          </div>
        </div>
      </div>

      {/* SUMMARY STATUS & HEALTH CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* CARD 1: STATUS KESEHATAN PROYEK */}
        <motion.div 
          className={`border rounded-3xl p-5 shadow-sm flex flex-col justify-between cursor-default ${healthClass}`}
          whileHover={{ y: -5, scale: 1.012, boxShadow: "0 12px 20px -8px rgba(15, 23, 42, 0.08)" }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase font-black tracking-widest bg-white/60 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200/40 font-mono">
                Kesehatan Proyek
              </span>
              <span className="flex h-2.5 w-2.5 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${healthIndicatorCol} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${healthIndicatorCol}`}></span>
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-3xl">{healthIcon}</span>
              <div>
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">Kondisi Kumulatif</h4>
                <p className="text-2xl font-black tracking-tight">{healthStatusStr}</p>
              </div>
            </div>
            
            <p className="text-xs mt-3.5 leading-relaxed text-slate-700 font-sans font-medium">
              {healthDesc}
            </p>
          </div>
          
          <div className="mt-4 pt-3.5 border-t border-slate-200/30 flex items-center justify-between text-[10px] font-semibold text-slate-500 font-sans">
            <span>Minggu Pengukuran:</span>
            <span className="font-bold underline">Minggu {latestWeekNum} ({latestDate})</span>
          </div>
        </motion.div>

        {/* CARD 2: ANALISA DEVIASI TERAKHIR */}
        <motion.div 
          className="bg-white border border-sky-100/60 rounded-3xl p-5 shadow-sm flex flex-col justify-between cursor-default"
          whileHover={{ y: -5, scale: 1.012, boxShadow: "0 12px 20px -8px rgba(15, 23, 42, 0.08)" }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase font-black tracking-widest bg-slate-50 text-slate-605 px-2.5 py-1 rounded-lg border border-slate-100 font-mono">
                Penyimpangan S-Curve
              </span>
              <Activity className="w-4 h-4 text-indigo-500" />
            </div>

            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-2xl ${latestDeviation >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50/60 text-rose-500'}`}>
                {latestDeviation >= 0 ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
              </div>
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 font-sans">Deviasi Terbaru Terhitung</h4>
                <p className={`text-2xl font-black tracking-tight font-sans ${latestDeviation >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {latestDeviation >= 0 ? '+' : ''}{latestDeviation.toFixed(3)}%
                </p>
              </div>
            </div>

            <p className="text-xs mt-3.5 leading-relaxed text-slate-500 font-sans font-medium">
              Deviasi dihitung dari selisih antara realisasi aktual <strong className="font-semibold text-slate-700">{latestActual.toFixed(2)}%</strong> terhadap rancangan rencana <strong className="font-semibold text-slate-700">{latestPlan.toFixed(2)}%</strong>.
            </p>
          </div>

          <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-[10px] font-semibold text-slate-500 font-sans">
            <span>Status Deviasi:</span>
            <span className={`font-bold ${latestDeviation >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {latestDeviation >= 0 ? 'SURPLUS VOL' : 'KETERLAMBATAN'}
            </span>
          </div>
        </motion.div>

        {/* CARD 3: TARGET AKUMULATIF */}
        <motion.div 
          className="bg-white border border-sky-100/60 rounded-3xl p-5 shadow-sm flex flex-col justify-between cursor-default"
          whileHover={{ y: -5, scale: 1.012, boxShadow: "0 12px 20px -8px rgba(15, 23, 42, 0.08)" }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase font-black tracking-widest bg-slate-50 text-slate-605 px-2.5 py-1 rounded-lg border border-slate-100 font-mono">
                Sisa Rencana Proyek
              </span>
              <Sliders className="w-4 h-4 text-amber-500" />
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 font-sans">Pekerjaan Tersisa</h4>
                <p className="text-2xl font-black tracking-tight text-slate-800 font-sans">
                  {(100 - latestActual).toFixed(2)}%
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold text-slate-400 font-sans">
                <span>Rasio Realisasi Selesai</span>
                <span className="text-emerald-600">{latestActual.toFixed(2)}% / 100%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-550"
                  style={{ width: `${latestActual}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-[10px] font-semibold text-slate-400 font-sans">
            <span>Total Target Kontrak:</span>
            <span className="font-bold text-slate-600">100.00% Selesai</span>
          </div>
        </motion.div>

      </div>

      {/* DETAILED CARDS & CHART */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CHART CONTAINER SECTION (2 Col) */}
        <div className="lg:col-span-2 bg-white border border-sky-100/60 rounded-3xl p-6 shadow-md friendly-card-shadow flex flex-col transition-all duration-350 hover:scale-[1.008] hover:shadow-xl hover:shadow-indigo-500/5 hover:border-indigo-300/70">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <h4 className="text-sm font-black text-slate-800 font-sans flex items-center gap-2">
                <span className="text-amber-550 animate-pulse">📈</span> Grafik S-Curve Penyelarasan Progres
              </h4>
              <p className="text-[11px] text-slate-400 font-sans">Membandingkan garis target rencana terhadap progress rill</p>
            </div>

            {/* SEGMENTED RANGE FOR CHART */}
            <div className="inline-flex p-0.5 bg-slate-100 rounded-xl border border-slate-200 self-start sm:self-auto">
              <button
                onClick={() => setFilterActiveOnly(true)}
                className={`px-3 py-1 rounded-lg text-2xs font-bold transition-all cursor-pointer ${
                  filterActiveOnly 
                    ? 'bg-white text-indigo-900 shadow-2xs border border-slate-200' 
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Hingga Pekan Ke-{(overallLatestActiveWeek + 4)}
              </button>
              <button
                onClick={() => setFilterActiveOnly(false)}
                className={`px-3 py-1 rounded-lg text-2xs font-bold transition-all cursor-pointer ${
                  !filterActiveOnly 
                    ? 'bg-white text-indigo-900 shadow-2xs border border-slate-200' 
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Seluruh Proyek (Durasi Penuh)
              </button>
            </div>
          </div>

          {/* S-CURVE RECHARTS STAGE */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="h-[280px] w-full mt-2 relative"
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={filteredChartData}
                margin={{ top: 10, right: 10, left: -22, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorRencana" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="colorRiil" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }}
                  axisLine={{ stroke: '#cbd5e1', strokeWidth: 0.5 }}
                />
                <YAxis 
                  tickFormatter={(val) => `${val}%`}
                  tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }}
                  axisLine={{ stroke: '#cbd5e1', strokeWidth: 0.5 }}
                  width={40}
                />
                <Tooltip 
                  cursor={{ stroke: '#f59e0b', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      const dVal = item['Deviasi (%)'];
                      const isPositive = dVal >= 0;
                      return (
                        <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-750 p-3 rounded-xl shadow-lg text-2xs font-sans transition-all duration-200">
                          <p className="font-bold text-slate-300 font-mono mb-1.5">{item.plainDate} (W-{item.weekIndex + 1})</p>
                          <div className="space-y-1">
                            <p className="flex justify-between gap-6">
                              <span className="text-indigo-300 font-semibold">Rencana Kumulatif:</span>
                              <span className="font-extrabold">{item['Rencana (%)'].toFixed(3)}%</span>
                            </p>
                            <p className="flex justify-between gap-6">
                              <span className="text-emerald-300 font-semibold">Realisasi Rill:</span>
                              <span className="font-extrabold text-emerald-400">{item['Riil (%)'] > 0 ? `${item['Riil (%)'].toFixed(3)}%` : 'Belum Mulai'}</span>
                            </p>
                            {item['Riil (%)'] > 0 && (
                              <p className="flex justify-between gap-6 border-t border-white/10 pt-1 mt-1">
                                <span className="text-slate-350 font-semibold">Deviasi Penyelarasan:</span>
                                <span className={`font-extrabold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {isPositive ? '+' : ''}{dVal.toFixed(3)}%
                                </span>
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={36}
                  iconType="circle"
                  iconSize={6}
                  wrapperStyle={{ fontSize: 10, fontWeight: 700, color: '#334155' }}
                />
                
                {/* Reference line showing current select indicator */}
                {activeWeekInfo && (
                  <ReferenceLine x={`W-${activeWeekInfo.weekNum}`} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1.5} />
                )}

                <Area 
                  type="monotone" 
                  key="plan_line" 
                  dataKey="Rencana (%)" 
                  stroke="#4f46e5" 
                  strokeWidth={2.5}
                  fillOpacity={1} 
                  fill="url(#colorRencana)" 
                  activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2, fill: '#4f46e5' }}
                  animationDuration={800}
                  animationEasing="ease-out"
                />
                <Area 
                  type="monotone" 
                  key="riil_line" 
                  dataKey="Riil (%)" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorRiil)" 
                  activeDot={{ r: 7, stroke: '#ffffff', strokeWidth: 2, fill: '#10b981' }}
                  animationDuration={800}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs leading-relaxed font-sans font-medium">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" />
              <span>Garis vertikal <span className="text-amber-600 font-black">oranye</span> menandakan pekan terfokus untuk melihat breakdown sektoral.</span>
            </div>
            <span className="text-[10px] text-slate-400 bg-slate-200/50 px-2 py-0.5 rounded font-mono font-extrabold">Live Google Calc</span>
          </div>
        </div>

        {/* ACTIVE WEEK INTERACTIVE WIDGET (1 Col) */}
        <div className="bg-white border border-sky-100/60 rounded-3xl p-6 shadow-md friendly-card-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-black text-slate-800 font-sans flex items-center gap-1.5">
                <span className="text-slate-500">📊</span> Status Fokus Pekan
              </h4>
              <span className="text-[10px] bg-indigo-50 text-indigo-800 border border-indigo-150 font-bold px-2 py-0.5 rounded-lg font-mono">
                W-{selectedWeekIdx+1}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-sans mb-4">Gunakan dropdown di bawah untuk merinci progres di pekan tertentu:</p>

            {/* WEEKLY DROPDOWN SELECTOR */}
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest font-mono block mb-1.5">PILIH MINGGU PEKERJAAN</label>
                <select
                  value={selectedWeekIdx}
                  onChange={(e) => setSelectedWeekIdx(Number(e.target.value))}
                  className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-2xl p-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-colors cursor-pointer appearance-none"
                >
                  {data.headers.map((header, idx) => {
                    const hasData = data.riil[idx] > 0;
                    return (
                      <option key={idx} value={idx}>
                        Minggu ke-{idx + 1} ({header}) {hasData ? '• [Aktif]' : '• [Proyeksi]'}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* THREE MAIN TILES (Rencana, Riil, Deviasi) */}
              {activeWeekInfo && (
                <div className="space-y-3 pt-2">
                  {/* Tile 1: Rencana */}
                  <div className="bg-indigo-50/40 border border-indigo-100/60 p-3.5 rounded-2xl flex justify-between items-center transition-all hover:bg-indigo-50/60">
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-black text-indigo-400 uppercase tracking-wider font-mono">Target Rencana Rill</span>
                      <p className="text-xs font-semibold text-slate-700">Akumulatif sasaran kerja</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-black text-indigo-900">{activeWeekInfo.plan.toFixed(2)}%</p>
                    </div>
                  </div>

                  {/* Tile 2: Riil */}
                  <div className={`p-3.5 rounded-2xl flex justify-between items-center transition-all ${
                    activeWeekInfo.actual > 0 
                      ? 'bg-emerald-50/40 border border-emerald-100/60 hover:bg-emerald-50/60' 
                      : 'bg-slate-50 border border-slate-200/40 hover:bg-slate-50/80 text-slate-400'
                  }`}>
                    <div className="space-y-0.5 animate-fade-in">
                      <span className={`text-[9px] font-black uppercase tracking-wider font-mono ${activeWeekInfo.actual > 0 ? 'text-emerald-500' : 'text-slate-400'}`}>Realisasi Lapangan</span>
                      <p className="text-xs font-semibold text-slate-600">{activeWeekInfo.actual > 0 ? 'Kemajuan progres terpasang' : 'Belum masuk jadwal riil'}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-base font-black ${activeWeekInfo.actual > 0 ? 'text-emerald-800' : 'text-slate-400'}`}>
                        {activeWeekInfo.actual > 0 ? `${activeWeekInfo.actual.toFixed(2)}%` : '-'}
                      </p>
                    </div>
                  </div>

                  {/* Tile 3: Deviasi */}
                  {activeWeekInfo.actual > 0 && (
                    <div className={`p-3.5 rounded-2xl flex justify-between items-center transition-all ${
                      activeWeekInfo.deviation >= 0 
                        ? 'bg-teal-50/40 border border-teal-100/60 hover:bg-teal-50/60' 
                        : 'bg-rose-50/40 border border-rose-100/60 hover:bg-rose-50/60'
                    }`}>
                      <div className="space-y-0.5">
                        <span className={`text-[9px] font-black uppercase tracking-wider font-mono ${activeWeekInfo.deviation >= 0 ? 'text-teal-600' : 'text-rose-500'}`}>Deviasi Volume</span>
                        <p className="text-xs font-semibold text-slate-600">{activeWeekInfo.deviation >= 0 ? 'Mendahului target estimasi' : 'Mengalami keterlambatan'}</p>
                      </div>
                      <div className="text-right flex items-center gap-1">
                        {activeWeekInfo.deviation >= 0 ? (
                          <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4 text-rose-600" />
                        )}
                        <p className={`text-base font-black ${activeWeekInfo.deviation >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                          {activeWeekInfo.deviation >= 0 ? '+' : ''}{activeWeekInfo.deviation.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* TINY CALENDAR METRIC */}
          {activeWeekInfo && (
            <div className="mt-4 border-t border-slate-100 pt-4 flex items-center gap-2.5 text-xs text-slate-500 font-sans font-semibold">
              <Calendar className="w-4 h-4 text-amber-500" />
              <span>Acuan Rencana Kerja Penuh: {activeWeekInfo.date}</span>
            </div>
          )}
        </div>
      </div>

      {/* DYNAMIC WEEKLY PROGRESS ANALYSIS (Laporan Analisa Mingguan) */}
      {activeWeekInfo && (
        <motion.div 
          className="bg-gradient-to-br from-teal-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 shadow-md border border-slate-800"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500 rounded-2xl text-slate-950 shadow-md">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black font-sans tracking-tight text-white">Laporan Analisa Utama Mingguan — M-{activeWeekInfo.weekNum}</h4>
                <p className="text-[10px] text-slate-400 font-sans">Kompilasi dan penafsiran statistik deviasi grafik fisik S-Curve ({activeWeekInfo.date})</p>
              </div>
            </div>
            <span className="text-[10px] uppercase font-mono font-extrabold px-3 py-1 bg-white/15 text-amber-300 rounded-xl border border-white/10 self-start sm:self-auto">
              Status Koefisien: {activeWeekInfo.actual > 0 ? (activeWeekInfo.deviation >= 0 ? 'On-Track (Surplus)' : 'Critical (Delayed)') : 'Proyeksi Virtual'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs leading-relaxed font-sans text-slate-300">
            {/* Left Col: Executive Summary / Ulasan Kinerja */}
            <div className="space-y-3.5">
              <p className="font-bold text-white border-b border-white/10 pb-1.5 uppercase tracking-wider text-[10px] font-mono flex items-center gap-1.5">
                <span className="text-amber-500">◆</span> Ulasan Kemajuan Fisik & Penyimpangan
              </p>
              <p>
                Pada pekan kalender <strong className="text-white font-bold">Minggu ke-{activeWeekInfo.weekNum} ({activeWeekInfo.date})</strong>, 
                target kumulatif ideal berdasarkan rancangan rencana awal proyek adalah sebesar <strong className="text-sky-300 font-bold">{activeWeekInfo.plan.toFixed(3)}%</strong>. 
                Melalui penghitungan volume fisik riil terpasang di lapangan, progres aktual berhasil tercatat di angka <strong className="text-emerald-400 font-bold">{activeWeekInfo.actual > 0 ? `${activeWeekInfo.actual.toFixed(3)}%` : 'Belum Mulai'}</strong>.
              </p>
              {activeWeekInfo.actual > 0 ? (
                <p>
                  Dengan performa pengerjaan tersebut, kalkulasi penyelarasan menghasilkan deviasi bersih kumulatif senilai {' '}
                  <span className={`font-mono font-bold px-1.5 py-0.5 rounded-md ${activeWeekInfo.deviation >= 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/25' : 'bg-rose-500/20 text-rose-400 border border-rose-500/25'}`}>
                    {activeWeekInfo.deviation >= 0 ? '+' : ''}{activeWeekInfo.deviation.toFixed(3)}%
                  </span>.
                  {activeWeekInfo.deviation >= 0 
                    ? ` Pencapaian surplus ini mengonfirmasi kelancaran alokasi tenaga kerja harian serta kestabilan pasokan material utama (Semen/Besi) di lapangan. Metode kerja dipastikan efektif dan berada pada trayek waktu yang tepat.`
                    : ` Deviasi negatif mengindikasikan adanya perlambatan minor di bawah garis target acuan. Beberapa sub-pekerjaan menuntut perhatian intensif untuk mencegah akumulasi deviasi kritis seiring bertambahnya pekan.`
                  }
                </p>
              ) : (
                <p className="italic text-slate-400 bg-slate-800/40 p-3 rounded-xl border border-slate-750">
                  ⚠️ Kegiatan fisik konstruksi terintegrasi belum dijadwalkan aktif secara kumulatif pada periode minggu ini. Gunakan dropdown pekan terfokus di atas untuk meninjau pekan aktif sebelumnya.
                </p>
              )}
            </div>

            {/* Right Col: Strategic S-Curve Recommendations */}
            <div className="space-y-3.5">
              <p className="font-bold text-white border-b border-white/10 pb-1.5 uppercase tracking-wider text-[10px] font-mono flex items-center gap-1.5">
                <span className="text-amber-500">◆</span> Rekomendasi Mitigasi & Akselerasi S-Curve
              </p>
              <ul className="space-y-2.5 text-[11px]">
                {activeWeekInfo.actual > 0 ? (
                  activeWeekInfo.deviation >= 0 ? (
                    <>
                      <li className="flex items-start gap-2 bg-emerald-500/5 p-2 rounded-xl border border-emerald-500/10">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <span><strong>Pertahankan Jalur Pasokan Utas</strong>: Prioritaskan pengadaan material interior (Pekerjaan Interior - Bobot 53.83%) karena memegang persentase bobot terbesar dari total koefisien kontrak harian.</span>
                      </li>
                      <li className="flex items-start gap-2 bg-emerald-500/5 p-2 rounded-xl border border-emerald-500/10">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <span><strong>Proteksi Mix Beton</strong>: Jaga ketersediaan semen dan beton ready-mix di zona teduh untuk mengantisipasi sirkulasi cuaca hujan mendadak demi menjamin mutu sisa pengerjaan.</span>
                      </li>
                    </>
                  ) : (
                    <>
                      <li className="flex items-start gap-2 bg-rose-500/5 p-2 rounded-xl border border-rose-500/10">
                        <span className="text-rose-400 font-bold">⚠</span>
                        <span><strong>Atur Shift Kelompok Kerja</strong>: Terapkan sistem penambahan jam kerja (lembur) pada zona arsitektural di bawah pengawasan mandor secara ketat untuk menembus deviasi negatif terhitung.</span>
                      </li>
                      <li className="flex items-start gap-2 bg-rose-500/5 p-2 rounded-xl border border-rose-500/10">
                        <span className="text-rose-400 font-bold">⚠</span>
                        <span><strong>Deteksi Penyumbatan Logistik</strong>: Periksa sirkulasi bekesing cetakan atau instalasi penunjang yang mengalami penundaan di lapangan dan lakukan modifikasi sub-tahapan yang aman.</span>
                      </li>
                    </>
                  )
                ) : (
                  <>
                    <li className="flex items-start gap-2 bg-slate-800/50 p-2 rounded-xl border border-slate-700/50 text-slate-400">
                      <span>•</span>
                      <span><strong>Pra-Inspeksi Sub-Kontraktor</strong>: Laksanakan koordinasi persiapan peralatan konstruksi berat serta personil kelompok kerja sebelum gelombang mingguan diaktifkan secara masif.</span>
                    </li>
                    <li className="flex items-start gap-2 bg-slate-800/50 p-2 rounded-xl border border-slate-700/50 text-slate-400">
                      <span>•</span>
                      <span><strong>Sinkronisasi Koefisien Rencana</strong>: Validasi kesesuaian target minggu pertama pengerjaan aktif agar deviasi awal tetap berada pada toleransi yang direkomendasikan pengawas.</span>
                    </li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </motion.div>
      )}

      {/* SECTORAL WORKS CATEGORIES TABLE BLOCK (STRUKTUR RINCIAN KERJA WBS) */}
      <div className="bg-white border border-sky-100/60 rounded-3xl p-6 shadow-md friendly-card-shadow" id="wbs-structure-panel">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-50">
          <div>
            <h4 className="text-base font-black text-slate-900 font-sans flex items-center gap-2">
              <span className="text-indigo-600">📋</span> STRUKTUR RINCIAN KERJA (WBS) PROYEK
            </h4>
            <p className="text-xs text-slate-500 font-sans mt-0.5">
              Rincian bobot per kategori bidang pekerjaan untuk <strong className="text-indigo-950 font-bold">Minggu ke-{(selectedWeekIdx+1)} ({data.headers[selectedWeekIdx]})</strong>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Real Search Box */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari bagian kerja atau kode..."
                className="pl-9 pr-4 py-2 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-xl text-xs font-bold font-sans text-slate-700 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all w-full sm:w-60"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="text-[10px] text-indigo-750 font-bold font-sans bg-indigo-50/50 border border-indigo-100 px-3 py-2 rounded-xl shrink-0 self-start sm:self-auto uppercase tracking-wide">
              Bobot Total: <span className="font-mono font-black text-xs">100.00%</span>
            </div>
          </div>
        </div>

        {/* WEB TABLE DESIGN */}
        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-rose-100/40 text-slate-550 font-sans font-bold uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center">Kode</th>
                <th className="py-3 px-4">Uraian Klasifikasi Pekerjaan</th>
                <th className="py-3 px-4 text-right w-36">Bobot Pekerjaan (%)</th>
                <th className="py-3 px-4 text-right w-44">Progres Kumulatif Sektor (%)</th>
                <th className="py-3 px-4 text-right w-44">Kontribusi Progres Rill (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans text-slate-700 font-medium">
              {filteredCategories.length > 0 ? (
                filteredCategories.map((cat, idx) => {
                  const weekProgressValue = cat.progress[selectedWeekIdx] || 0;
                  // Contribution to overall cumulative target = Progress% * Weight% / 100
                  const contribution = (weekProgressValue * cat.weight) / 100;
                  
                  return (
                    <tr key={idx} className="hover:bg-indigo-50/20 transition-colors">
                      <td className="py-3 px-4 text-center font-black text-slate-900 bg-slate-50/30 font-mono text-xs">{cat.code}</td>
                      <td className="py-3 px-4 font-bold text-slate-800 text-xs">{cat.name}</td>
                      <td className="py-3 px-4 text-right font-black text-slate-900 font-mono">{cat.weight.toFixed(3)}%</td>
                      <td className="py-3 px-4 text-right font-black text-indigo-950 font-mono">
                        {weekProgressValue > 0 ? (
                          <span className="bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100/60">
                            {weekProgressValue.toFixed(2)}%
                          </span>
                        ) : <span className="text-slate-400 italic font-mono">-</span>}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-800 font-mono">
                        {contribution > 0 ? (
                          <span className="bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100/50">
                            {contribution.toFixed(3)}%
                          </span>
                        ) : <span className="text-slate-400 font-normal italic font-mono">-</span>}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-sans font-medium italic">
                    Tidak ditemukan bidang klasifikasi WBS yang sesuai dengan kata kunci pencarian Anda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* BOTTOM METRIC TIPS FOR USERS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 border-t border-slate-100 pt-5">
          <div className="flex gap-2.5 items-start bg-amber-500/5 p-4 rounded-2xl border border-amber-500/10 text-xs font-sans font-medium text-amber-800 leading-relaxed">
            <Briefcase className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold mb-0.5">Keterangan Bobot Sektor</strong>
              <span>Bobot (%) mencerminkan porsi nilai keekonomian item pekerjaan tersebut terhadap total nilai kontrak konstruksi (Total rekapitulasi adalah 100%).</span>
            </div>
          </div>

          <div className="flex gap-2.5 items-start bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50 text-xs font-sans font-medium text-slate-700 leading-relaxed">
            <Activity className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold text-indigo-950 mb-0.5">Kontribusi Progres Riil</strong>
              <span>Dihitung dari (Progres Sektor x Bobot Pekerjaan / 100) untuk mengetahui andil nyata kemajuan material terpasang terhadap Bobot Total Konstruksi 100%.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
