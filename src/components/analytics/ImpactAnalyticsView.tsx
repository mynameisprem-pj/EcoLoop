// src/components/analytics/ImpactAnalyticsView.tsx
import React, { useMemo } from 'react';
import {
  Leaf,
  Utensils,
  Scale,
  Award,
  TrendingUp,
  Car,
  TreePine,
  Smartphone,
  CheckCircle2,
} from 'lucide-react';
import { useEcoStore } from '../../store/useEcoStore';
import type { FoodCategory } from '../../types';

const CATEGORY_LABELS: Record<FoodCategory, { label: string; color: string }> = {
  produce: { label: 'Fresh Produce', color: 'bg-emerald-400' },
  bakery: { label: 'Baked Goods', color: 'bg-amber-400' },
  prepared_meals: { label: 'Prepared Meals', color: 'bg-teal-400' },
  dairy: { label: 'Dairy & Chilled', color: 'bg-cyan-400' },
  pantry: { label: 'Pantry & Dry Goods', color: 'bg-lime-400' },
};

export const ImpactAnalyticsView: React.FC = () => {
  const { impact, listings } = useEcoStore();

  const categoryStats = useMemo(() => {
    const totals: Record<FoodCategory, number> = {
      produce: 0,
      bakery: 0,
      prepared_meals: 0,
      dairy: 0,
      pantry: 0,
    };
    let grandTotal = 0;

    listings
      .filter((l) => l.status === 'completed')
      .forEach((item) => {
        totals[item.category] = (totals[item.category] || 0) + item.weightKg;
        grandTotal += item.weightKg;
      });

    return (Object.keys(totals) as FoodCategory[]).map((cat) => ({
      category: cat,
      label: CATEGORY_LABELS[cat].label,
      color: CATEGORY_LABELS[cat].color,
      weightKg: Number(totals[cat].toFixed(1)),
      percentage:
        grandTotal > 0 ? Math.round((totals[cat] / grandTotal) * 100) : 0,
    }));
  }, [listings]);

  const donorLeaderboard = useMemo(() => {
    const map = new Map<
      string,
      { name: string; type: string; weightKg: number; co2Kg: number; drops: number }
    >();

    listings
      .filter((l) => l.status === 'completed')
      .forEach((item) => {
        const existing = map.get(item.donorName) || {
          name: item.donorName,
          type: item.donorType,
          weightKg: 0,
          co2Kg: 0,
          drops: 0,
        };
        existing.weightKg = Number((existing.weightKg + item.weightKg).toFixed(1));
        existing.co2Kg = Number((existing.co2Kg + item.co2SavedKg).toFixed(1));
        existing.drops += 1;
        map.set(item.donorName, existing);
      });

    return Array.from(map.values()).sort((a, b) => b.co2Kg - a.co2Kg);
  }, [listings]);

  const carKmAvoided = Math.round(impact.totalCo2SavedKg * 4.1);
  const treeSeedlingsGrown = Number((impact.totalCo2SavedKg / 21).toFixed(1));
  const smartphonesCharged = Math.round(impact.totalCo2SavedKg * 121);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-emerald-900/60 via-[#101B18] to-[#0A1210] border border-emerald-500/40 p-5 shadow-[0_0_25px_rgba(16,185,129,0.15)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Verified Environmental Impact
            </span>
            <h2 className="text-xl font-extrabold text-white">
              Food Waste Diversion Ledger
            </h2>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-xs font-bold text-emerald-300 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> {impact.completedRescuesCount} Completed
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl bg-black/40 border border-white/10 p-3.5">
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
              <Leaf className="w-4 h-4" /> CO₂e Prevented
            </div>
            <p className="text-2xl font-black text-white mt-1">
              {impact.totalCo2SavedKg}
              <span className="text-xs font-normal text-emerald-300 ml-1">kg</span>
            </p>
          </div>

          <div className="rounded-xl bg-black/40 border border-white/10 p-3.5">
            <div className="flex items-center gap-1.5 text-teal-300 text-xs font-semibold">
              <Utensils className="w-4 h-4" /> Meals Rescued
            </div>
            <p className="text-2xl font-black text-white mt-1">
              {impact.totalMealsSaved}
              <span className="text-xs font-normal text-slate-400 ml-1">meals</span>
            </p>
          </div>

          <div className="rounded-xl bg-black/40 border border-white/10 p-3.5">
            <div className="flex items-center gap-1.5 text-amber-300 text-xs font-semibold">
              <Scale className="w-4 h-4" /> Total Food Weight
            </div>
            <p className="text-2xl font-black text-white mt-1">
              {impact.totalWeightKg}
              <span className="text-xs font-normal text-slate-400 ml-1">kg</span>
            </p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-3 gap-2 text-center">
          <div className="flex flex-col items-center">
            <Car className="w-4 h-4 text-emerald-400 mb-0.5" />
            <span className="text-xs font-bold text-white">{carKmAvoided} km</span>
            <span className="text-[10px] text-slate-400">Passenger Car Avoided</span>
          </div>
          <div className="flex flex-col items-center border-x border-white/10">
            <TreePine className="w-4 h-4 text-emerald-400 mb-0.5" />
            <span className="text-xs font-bold text-white">{treeSeedlingsGrown}</span>
            <span className="text-[10px] text-slate-400">Tree-Years Carbon</span>
          </div>
          <div className="flex flex-col items-center">
            <Smartphone className="w-4 h-4 text-emerald-400 mb-0.5" />
            <span className="text-xs font-bold text-white">{smartphonesCharged}</span>
            <span className="text-[10px] text-slate-400">Smartphones Charged</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="rounded-2xl bg-[#101B18]/85 border border-emerald-500/30 p-5 space-y-3">
          <h3 className="text-sm font-bold text-white">
            Completed Rescues by Category
          </h3>
          <div className="space-y-3">
            {categoryStats.map((stat) => (
              <div key={stat.category} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">{stat.label}</span>
                  <span className="text-slate-400 font-mono">
                    {stat.weightKg} kg ({stat.percentage}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-black/50 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${stat.color} transition-all duration-500`}
                    style={{ width: `${Math.max(2, stat.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-[#101B18]/85 border border-emerald-500/30 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-400" />
              Top Participating Stores
            </h3>
            <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">
              Verified Pickups
            </span>
          </div>

          {donorLeaderboard.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              Completed store rescues will appear here once pickups are verified.
            </p>
          ) : (
            <div className="space-y-2">
              {donorLeaderboard.map((donor, idx) => (
                <div
                  key={donor.name}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-black/35 border border-white/5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center text-xs font-extrabold shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">
                        {donor.name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {donor.type} • {donor.drops} completed pickup
                        {donor.drops > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs font-extrabold text-emerald-400">
                      {donor.co2Kg} kg CO₂
                    </p>
                    <p className="text-[10px] text-slate-400">{donor.weightKg} kg</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};