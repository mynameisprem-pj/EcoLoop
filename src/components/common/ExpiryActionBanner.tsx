// src/components/common/ExpiryActionBanner.tsx
import React, { useEffect, useState } from 'react';
import { getExpiryTimeRemaining } from '../../utils/impactCalculator';

interface ExpiryActionBannerProps {
  expiresAt: number;
  onRescue: () => void;
  disabled?: boolean;
}

export const ExpiryActionBanner: React.FC<ExpiryActionBannerProps> = ({
  expiresAt,
  onRescue,
  disabled = false,
}) => {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const { hours, minutes, seconds, urgency, totalMs } = getExpiryTimeRemaining(expiresAt, now);
  const pad = (n: number) => String(n).padStart(2, '0');
  const clockString = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  const isExpired = totalMs <= 0;

  // Dynamic gradient styling matching the mockup's emerald glow, shifting to amber when critical
  const gradientStyle =
    urgency === 'critical'
      ? 'from-emerald-500/90 via-amber-500/40 to-transparent border-amber-400/40'
      : 'from-emerald-500/85 via-emerald-600/35 to-transparent border-emerald-400/30';

  return (
    <div className="relative flex items-center justify-between w-full mt-2.5">
      {/* Glowing "ENDS IN: HH:MM:SS" Pill */}
      <div
        className={`flex-1 flex flex-col justify-center pl-3 pr-14 py-1.5 rounded-xl bg-gradient-to-r ${gradientStyle} border backdrop-blur-md shadow-[0_0_20px_rgba(16,185,129,0.2)]`}
      >
        <span className="text-[10px] font-semibold tracking-wider uppercase text-emerald-100/90 leading-tight">
          {isExpired ? 'STATUS:' : 'ENDS IN:'}
        </span>
        <span className="font-mono text-base sm:text-lg font-extrabold tracking-tight text-white leading-tight">
          {isExpired ? '00:00:00' : clockString}
        </span>
      </div>

      {/* Circular "RESCUE" Button Overlapping the Right Edge */}
      <button
        type="button"
        disabled={disabled || isExpired}
        onClick={onRescue}
        className="absolute right-1 w-14 h-14 rounded-full bg-[#0B1F1A] border-2 border-emerald-400/80 shadow-[0_0_15px_rgba(16,185,129,0.45)] flex items-center justify-center text-[10px] font-bold tracking-wider uppercase text-emerald-100 hover:bg-emerald-500 hover:text-slate-950 hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
      >
        Rescue
      </button>
    </div>
  );
};