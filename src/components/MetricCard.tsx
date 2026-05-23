import React, { useState } from 'react';
import { motion } from 'motion/react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  colorClass?: string;
}

export function MetricCard({ title, value, subValue, icon, colorClass = "from-amber-50" }: MetricCardProps) {
  const isEmerald = colorClass.includes('emerald');
  const isSky = colorClass.includes('sky');
  const isSlate = colorClass.includes('slate');

  // Define premium background gradients and shadow profiles for a modern feel
  let cardBgGradients = 'bg-gradient-to-br from-amber-50/40 via-orange-50/10 to-white';
  let accentShadowClass = 'shadow-3d-amber hover:shadow-3d-amber-hover';
  let badgeColorClass = 'bg-amber-100 text-amber-800 border-amber-200/65';
  let barGlow = 'bg-gradient-to-b from-amber-400 to-amber-600';
  let glowColor = 'rgba(245, 158, 11, 0.4)';

  if (isEmerald) {
    cardBgGradients = 'bg-gradient-to-br from-emerald-50/40 via-teal-50/10 to-white';
    accentShadowClass = 'shadow-3d-emerald hover:shadow-3d-emerald-hover';
    badgeColorClass = 'bg-emerald-100 text-emerald-850 border-emerald-200/65';
    barGlow = 'bg-gradient-to-b from-emerald-400 to-emerald-600';
    glowColor = 'rgba(16, 185, 129, 0.4)';
  } else if (isSky) {
    cardBgGradients = 'bg-gradient-to-br from-sky-50/40 via-sky-50/10 to-white';
    accentShadowClass = 'shadow-3d-sky hover:shadow-3d-sky-hover';
    badgeColorClass = 'bg-sky-100 text-sky-850 border-sky-200/65';
    barGlow = 'bg-gradient-to-b from-sky-400 to-sky-600';
    glowColor = 'rgba(14, 165, 233, 0.4)';
  } else if (isSlate) {
    cardBgGradients = 'bg-gradient-to-br from-indigo-50/40 via-purple-50/10 to-white';
    accentShadowClass = 'shadow-3d-indigo hover:shadow-3d-indigo-hover';
    badgeColorClass = 'bg-indigo-100 text-indigo-850 border-indigo-200/65';
    barGlow = 'bg-gradient-to-b from-indigo-400 to-indigo-600';
    glowColor = 'rgba(99, 102, 241, 0.4)';
  }

  // Setup state for tilting effect to handle lightweight elegant 3D mouse trackers
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const box = card.getBoundingClientRect();
    const x = e.clientX - box.left - box.width / 2;
    const y = e.clientY - box.top - box.height / 2;
    
    // Smooth responsive multiplier
    setRotate({
      x: -(y / box.height) * 10,
      y: (x / box.width) * 10
    });
  };

  const handleMouseLeave = () => {
    setRotate({ x: 0, y: 0 });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileTap={{ scale: 0.97 }}
      style={{
        transformStyle: 'preserve-3d',
        transform: `perspective(1000px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`p-6 rounded-3xl border bg-white border-slate-100/80 transition-3d cursor-pointer ${cardBgGradients} ${accentShadowClass} relative overflow-hidden group select-none`}
    >
      {/* Background soft glowing circle to add rich innovative depth */}
      <div 
        className="absolute -right-8 -top-8 w-24 h-24 rounded-full blur-2xl opacity-10 group-hover:scale-150 transition-transform duration-500 pointer-events-none"
        style={{ backgroundColor: glowColor }}
      />
      
      {/* Dynamic 3D depth-accent block line */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${barGlow} rounded-l-3xl`} />

      <div className="flex items-center justify-between mb-4 relative z-10" style={{ transform: 'translateZ(15px)' }}>
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 font-mono">
          {title}
        </span>
        <div className={`p-2.5 rounded-2xl border transition-all duration-300 group-hover:scale-110 shadow-xs ${badgeColorClass}`}>
          {icon}
        </div>
      </div>
      
      <div className="relative z-10" style={{ transform: 'translateZ(25px)' }}>
        <h3 className="text-3xl font-black font-display tracking-tight text-slate-900 leading-none mb-2 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 bg-clip-text">
          {value}
        </h3>
        {subValue && (
          <p className="text-[11px] text-slate-500 font-semibold font-sans mt-1 group-hover:text-slate-800 transition-colors">
            {subValue}
          </p>
        )}
      </div>
    </motion.div>
  );
}
