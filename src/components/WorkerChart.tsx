import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DailyReport } from '../types';

interface WorkerChartProps {
  data: DailyReport[];
  selectedDayNo: number | null;
  onSelectDayNo: (no: number | null) => void;
}

export function WorkerChart({ data, selectedDayNo, onSelectDayNo }: WorkerChartProps) {
  // Format data for Recharts
  const chartData = data.map(r => ({
    name: r.tanggalParsed.tanggalStr.replace(' 2026', ''), // shorten string
    'Mandor': r.pekerjaParsed.mandor,
    'Tukang Batu': r.pekerjaParsed.tukangBatu,
    'Tukang Plafond': r.pekerjaParsed.tukangPlafond,
    'Tukang Keramik': r.pekerjaParsed.tukangKeramik,
    'Tukang Besi': r.pekerjaParsed.tukangBesi,
    'Pekerja': r.pekerjaParsed.pekerja,
    'Total': r.pekerjaParsed.total,
    'no': r.no,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const sortedPayload = [...payload].sort((a, b) => b.value - a.value);
      const total = payload[0]?.payload?.Total || 0;
      const rNo = payload[0]?.payload?.no;
      const isSelected = selectedDayNo === rNo;

      return (
        <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-xl font-sans text-xs text-slate-800">
          <p className="font-bold text-slate-900 mb-0.5">{label}</p>
          <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider mb-2">Hari Ke-{rNo} {isSelected && "• Terpilih"}</p>
          <div className="space-y-1.5">
            {sortedPayload.map((entry: any, index: number) => {
              if (entry.name === 'Total') return null;
              return (
                <div key={index} className="flex justify-between gap-6 items-center">
                  <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
                    {entry.name}
                  </span>
                  <span className="font-bold text-slate-900">{entry.value} Org</span>
                </div>
              );
            })}
          </div>
          <div className="border-t border-slate-150 mt-2.5 pt-2 flex justify-between font-bold text-slate-900">
            <span>Total Tenaga</span>
            <span>{total} Org</span>
          </div>
          <p className="text-[9px] text-slate-500 mt-2 text-center border-t border-slate-100 pt-1.5 font-medium">
            {isSelected ? "Klik bar untuk batal pilih" : "Klik bar untuk filter hari ini"}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-[350px] bg-white border border-sky-100/80 rounded-2xl p-5 shadow-sm relative group">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 font-sans">Alokasi & Komposisi Pekerja</h4>
          <p className="text-xs text-slate-500 font-sans">Grafik penumpukan komposisi tenaga kerja harian. Klik bar untuk memfilter detail hari.</p>
        </div>
        {selectedDayNo !== null && (
          <button 
            onClick={() => onSelectDayNo(null)}
            className="text-[10px] uppercase tracking-wider font-extrabold font-sans text-amber-600 bg-amber-500/10 border border-amber-200 px-2 py-1 rounded-lg hover:bg-amber-500/20 transition-colors cursor-pointer"
          >
            Hapus Filter Hari Ke-{selectedDayNo} ✕
          </button>
        )}
      </div>
      <div className="w-full h-[260px] cursor-pointer">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
            onClick={(state: any) => {
              if (state && state.activePayload && state.activePayload.length > 0) {
                const clickedNo = state.activePayload[0].payload.no;
                onSelectDayNo(clickedNo === selectedDayNo ? null : clickedNo);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="name" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9', opacity: 0.8 }} />
            <Legend 
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: '10px', paddingTop: '10px', color: '#475569' }}
            />
            <Bar dataKey="Mandor" stackId="a" fill="#475569" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Tukang Batu" stackId="a" fill="#3b82f6" />
            <Bar dataKey="Tukang Plafond" stackId="a" fill="#f59e0b" />
            <Bar dataKey="Tukang Keramik" stackId="a" fill="#10b981" />
            <Bar dataKey="Tukang Besi" stackId="a" fill="#ec4899" />
            <Bar dataKey="Pekerja" stackId="a" fill="#64748b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
