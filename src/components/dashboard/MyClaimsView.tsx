// src/components/dashboard/MyClaimsView.tsx
import React from 'react';
import { QrCode, CheckCircle2, XCircle, PackageCheck, ArrowUpRight } from 'lucide-react';
import { useEcoStore } from '../../store/useEcoStore';

export const MyClaimsView: React.FC = () => {
  const { claims, setSelectedClaimForModal, cancelClaim, setActiveTab } = useEcoStore();

  if (claims.length === 0) {
    return (
      <div className="rounded-2xl bg-[#101B18]/85 border border-emerald-500/30 p-8 text-center space-y-3">
        <PackageCheck className="w-10 h-10 text-emerald-400 mx-auto opacity-80" />
        <h3 className="text-base font-bold text-white">No Active Rescues Yet</h3>
        <p className="text-xs text-slate-400 max-w-xs mx-auto">
          Tap the circular RESCUE button on any surplus listing to reserve food and generate your instant pickup pass.
        </p>
        <button
          type="button"
          onClick={() => setActiveTab('browse')}
          className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold uppercase tracking-wider cursor-pointer"
        >
          Browse Surplus Drops
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {claims.map((claim) => {
        const isPending = claim.status === 'pending_pickup';
        const isVerified = claim.status === 'verified_complete';

        return (
          <div
            key={claim.id}
            className={`rounded-2xl p-4 backdrop-blur-xl border transition-all ${
              isPending
                ? 'bg-[#101B18]/90 border-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.18)]'
                : isVerified
                ? 'bg-slate-900/75 border-emerald-500/20'
                : 'bg-slate-900/40 border-white/10 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    isPending
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                      : isVerified
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {isPending && '● Awaiting Pickup Handoff'}
                  {isVerified && '✓ Verified Rescue'}
                  {claim.status === 'cancelled' && 'Cancelled'}
                </span>
                <h3 className="text-base font-bold text-white mt-1.5">
                  {claim.listingTitle}
                </h3>
                <p className="text-xs text-slate-400">
                  Donor: <span className="text-emerald-300">{claim.donorName}</span> •{' '}
                  {claim.weightKg} kg ({claim.mealsSaved} meals / {claim.co2SavedKg}kg CO₂)
                </p>
              </div>

              {/* Pickup Code Badge */}
              <div className="text-right shrink-0">
                <span className="text-[10px] uppercase text-slate-400 block">
                  Pickup Pass
                </span>
                <span className="font-mono text-sm font-extrabold text-emerald-300 bg-emerald-950/90 border border-emerald-500/40 px-2.5 py-1 rounded-lg inline-block mt-0.5">
                  {claim.pickupCode}
                </span>
              </div>
            </div>

            {isPending && (
              <div className="flex items-center gap-2.5 mt-3.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setSelectedClaimForModal(claim)}
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.35)] transition-all cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                  Open QR Handoff Pass
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => cancelClaim(claim.id)}
                  className="py-2 px-3 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-white/10 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" /> Release
                </button>
              </div>
            )}

            {isVerified && (
              <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-xs text-emerald-400/90">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Impact logged to Kirtipur Ledger
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedClaimForModal(claim)}
                  className="underline hover:text-emerald-300 cursor-pointer"
                >
                  View Receipt
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};