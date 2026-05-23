import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Brain, AlertCircle, Users, CheckCircle2, RefreshCw } from 'lucide-react';
import { DailyReport, AIAnalysis } from '../types';
import { generateLocalFallbackAnalysis } from '../utils/fallbackFetcher';

interface AIStudyPanelProps {
  reportData: DailyReport[];
  onAnalysisChange?: (analysis: AIAnalysis | null) => void;
}

const LOADING_STEPS = [
  "Mendownload log harian terbaru dari Google Sheets...",
  "Mempelajari draf uraian pekerjaan & material...",
  "Mengorelasikan data cuaca (Pagi, Siang, Sore)...",
  "Menganalisis rasio komposisi tukang dan pekerja...",
  "Mengolah analisis strategis menggunakan Gemini 3.5 AI...",
  "Menyusun rekomendasi penyesuaian lapangan..."
];

export function AIStudyPanel({ reportData, onAnalysisChange }: AIStudyPanelProps) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);

  useEffect(() => {
    if (onAnalysisChange) {
      onAnalysisChange(analysis);
    }
  }, [analysis, onAnalysisChange]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Cycle loading steps for visual immersive feedback
  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStep(prev => (prev + 1) % LOADING_STEPS.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const lastAnalyzedHashRef = useRef<string>("");

  const runAnalysis = async (force: boolean = false) => {
    if (!reportData || reportData.length === 0) return;
    
    // Stable hash based on report items and metadata
    const currentHash = "ai_study_v1_" + reportData.map(r => `${r.no}_${r.pekerjaParsed?.total || 0}`).join('-');
    
    // Check client-side localStorage cache first to avoid API call
    if (!force) {
      try {
        const cached = localStorage.getItem(currentHash);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.statusKemajuan) {
            console.log("[Client Cache Hit] Restoring AI analysis from browser localStorage.");
            setAnalysis(parsed);
            lastAnalyzedHashRef.current = currentHash;
            return;
          }
        }
      } catch (cacheErr) {
        console.warn("Error reading from localStorage cache:", cacheErr);
      }
    }

    if (!force && currentHash === lastAnalyzedHashRef.current && analysis) {
      // Already analyzed in current lifecycle
      return;
    }
    
    lastAnalyzedHashRef.current = currentHash;
    setLoading(true);
    setLoadingStep(0);
    setError(null);
    try {
      let finalAndResult: AIAnalysis;
      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reportData }),
        });
        if (response.ok) {
          const resData = await response.json();
          if (resData.success) {
            finalAndResult = resData.analysis;
          } else {
            throw new Error(resData.error || "Gagal melakukan analisis AI.");
          }
        } else {
          throw new Error(`Server returned status: ${response.status}`);
        }
      } catch (fetchErr) {
        console.warn("Backend AI analyze failed or inaccessible. Invoking local heuristic fallback analyzer direct on client...", fetchErr);
        // Instant processing via our local client assessment engine
        finalAndResult = generateLocalFallbackAnalysis(reportData);
      }

      setAnalysis(finalAndResult);
      // Persist to client browser cache
      try {
        localStorage.setItem(currentHash, JSON.stringify(finalAndResult));
      } catch (storageErr) {
        console.warn("Failed to write to browser local storage:", storageErr);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Koneksi ke backend terputus atau gagal.");
    } finally {
      setLoading(false);
    }
  };

  // Run automatically when reportData is loaded or genuinely changes
  useEffect(() => {
    if (reportData && reportData.length > 0 && !loading) {
      runAnalysis(false);
    }
  }, [reportData]);

  return (
    <div className="bg-gradient-to-br from-white via-sky-50/20 to-white text-slate-800 rounded-3xl border border-sky-100/90 p-6 shadow-md friendly-card-shadow relative overflow-hidden transition-3d hover:shadow-lg">
      {/* Background glow decorator */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-amber-200/20 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-200/20 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sky-100/60 pb-5 mb-6 relative z-10">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-550 text-white shadow-md shadow-amber-500/20 relative">
            <Sparkles className="w-6 h-6 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-450 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              {analysis?.isFallback ? (
                <span className="text-[9px] font-black bg-indigo-50/80 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono shadow-3xs flex items-center gap-1.5 animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 inline-block" />
                  Offline Backup Engine (Quota Limit)
                </span>
              ) : (
                <span className="text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-150 px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono shadow-3xs flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block animate-ping" />
                  Gemini Flash AI Active
                </span>
              )}
            </div>
            <h3 className="text-xl font-bold font-display text-slate-900 mt-1.5 flex items-center gap-2">
              Studi & Analisis AI Terintegrasi
            </h3>
          </div>
        </div>

        <button
          onClick={() => runAnalysis(true)}
          disabled={loading}
          className="flex items-center gap-2 px-4.5 py-2.5 bg-gradient-to-b from-white to-slate-50 hover:to-slate-100 text-slate-700 hover:text-slate-950 rounded-xl border border-slate-200 text-xs font-black transition-all cursor-pointer shadow-xs active:scale-95 group"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-amber-500 transition-transform duration-500 group-hover:rotate-180 ${loading ? 'animate-spin' : ''}`} />
          <span>Analisis Ulang</span>
        </button>
      </div>

      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center text-center relative z-10">
          <div className="relative mb-6">
            {/* Glowing ring */}
            <div className="w-20 h-20 rounded-full border-4 border-amber-500/10 border-t-amber-500 animate-spin" />
            <div className="w-16 h-16 rounded-full border border-dashed border-sky-300 absolute top-2 left-2 animate-pulse flex items-center justify-center bg-amber-50/50">
              <Brain className="w-7 h-7 text-amber-500 animate-bounce" />
            </div>
          </div>
          <h4 className="text-base font-bold text-slate-800 font-sans mb-1.5">Mempelajari & Memetakan Data Proyek</h4>
          <p className="text-xs text-slate-500 italic max-w-sm px-4 animate-pulse tracking-wide font-medium">
            {LOADING_STEPS[loadingStep]}
          </p>
        </div>
      ) : error ? (
        <div className="py-12 text-center relative z-10">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3 animate-bounce" />
          <h4 className="text-sm font-semibold text-rose-600 font-sans mb-1">Gagal Memuat Analisis AI</h4>
          <p className="text-xs text-slate-600 max-w-md mx-auto mb-4">{error}</p>
          <button
            onClick={() => runAnalysis(true)}
            className="px-5 py-2.5 bg-rose-50 hover:bg-rose-100/70 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Coba Ambil Ulang
          </button>
        </div>
      ) : analysis ? (
        <div className="space-y-6 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Status Kemajuan */}
            <div className="bg-gradient-to-tr from-amber-500/5 via-orange-50/5 to-white border border-amber-100 p-5 rounded-2xl relative transition-all duration-300 hover:shadow-md hover:border-amber-300/80 group/card hover:-translate-y-1 cursor-pointer">
              <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-amber-500 m-4 group-hover/card:scale-125 transition-transform" />
              <div className="flex items-center gap-2 mb-3 text-amber-600 font-bold">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <h4 className="text-2xs font-extrabold uppercase tracking-widest font-mono">Kurasi Kemajuan Kerja</h4>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-sans font-semibold">{analysis.statusKemajuan}</p>
            </div>

            {/* Analisis Kendala (Cuaca/Material) */}
            <div className="bg-gradient-to-tr from-sky-500/5 via-sky-50/5 to-white border border-sky-100 p-5 rounded-2xl relative transition-all duration-300 hover:shadow-md hover:border-sky-300/80 group/card hover:-translate-y-1 cursor-pointer">
              <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-sky-500 m-4 group-hover/card:scale-125 transition-transform" />
              <div className="flex items-center gap-2 mb-3 text-sky-650 font-bold">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <h4 className="text-2xs font-extrabold uppercase tracking-widest font-mono">Cuaca & Dampak Material</h4>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-sans font-semibold">{analysis.analisisKendala}</p>
            </div>

            {/* Rekayasa Tenaga Kerja */}
            <div className="bg-gradient-to-tr from-emerald-500/5 via-emerald-50/5 to-white border border-emerald-100 p-5 rounded-2xl relative transition-all duration-300 hover:shadow-md hover:border-emerald-300/80 group/card hover:-translate-y-1 cursor-pointer">
              <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-emerald-500 m-4 group-hover/card:scale-125 transition-transform" />
              <div className="flex items-center gap-2 mb-3 text-emerald-700 font-bold">
                <Users className="w-4 h-4 flex-shrink-0" />
                <h4 className="text-2xs font-extrabold uppercase tracking-widest font-mono">Alokasi & Produktivitas</h4>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-sans font-semibold">{analysis.analisisResumberdaya}</p>
            </div>
          </div>

          {/* Rekomendasi Lapangan */}
          <div className="bg-gradient-to-b from-slate-50 to-white/60 border border-slate-100 p-5 rounded-2xl">
            <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest font-mono mb-4.5 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block animate-ping" />
              Saran Strategis & Rekomendasi Lapangan
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {analysis.rekomendasi && analysis.rekomendasi.map((rec, index) => (
                <div key={index} className="flex gap-3 bg-white border border-slate-100 p-4 rounded-xl text-xs hover:border-amber-400 hover:shadow-sm transition-all duration-300 translate-3d group/item cursor-default">
                  <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-amber-50 text-amber-700 border border-amber-200/70 font-extrabold font-mono text-[10px] group-hover/item:scale-110 duration-200">
                    {index + 1}
                  </span>
                  <span className="text-slate-600 font-sans font-semibold leading-relaxed self-center">{rec}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="py-10 text-center text-slate-500 text-xs font-semibold">
          Masukkan opsi data yang memadai untuk menghasilkan visualisasi analisis proyek oleh Kecerdasan Buatan.
        </div>
      )}
    </div>
  );
}
