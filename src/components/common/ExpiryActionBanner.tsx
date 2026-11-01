// src/components/common/ExpiryActionBanner.tsx
import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { getExpiryTimeRemaining } from '../../utils/impactCalculator';

interface ExpiryActionBannerProps {
  expiresAt: number;
}

export const ExpiryActionBanner: React.FC<ExpiryActionBannerProps> = ({
  expiresAt,
}) => {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const { hours, minutes, seconds, urgency, totalMs } = getExpiryTimeRemaining(
    expiresAt,
    now
  );
  const pad = (n: number) => String(n).padStart(2, '0');
  const clockString = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  const isExpired = totalMs <= 0;

  const badgeStyle =
    urgency === 'critical'
      ? 'bg-amber-500/15 border-amber-400/40 text-amber-200'
      : 'bg-emerald-500/15 border-emerald-400/35 text-emerald-200';

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-xl border ${badgeStyle} backdrop-blur-md`}
    >
      <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
      <span className="text-[10px] font-bold uppercase tracking-wider opacity-85">
        {isExpired ? 'Expired' : 'Ends in:'}
      </span>
      <span className="font-mono text-xs sm:text-sm font-extrabold text-white tracking-tight">
        {isExpired ? '00:00:00' : clockString}
      </span>
    </div>
  );
};