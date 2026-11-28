// src/components/auth/AuthModal.tsx
import React, { useState } from 'react';
import {
  ShieldCheck,
  Sparkles,
  LogOut,
  BadgeCheck,
  X,
} from 'lucide-react';
import { useEcoStore } from '../../store/useEcoStore';

export const AuthModal: React.FC = () => {
  const {
    authModalOpen,
    setAuthModalOpen,
    currentUser,
    activeRole,
    signInWithGoogle,
    signInAsDemo,
    signOutAccount,
  } = useEcoStore();

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!authModalOpen) return null;

  const handleGoogleAuth = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="w-full max-w-md rounded-2xl bg-[#0E1A16] border border-emerald-500/40 p-4 sm:p-5 space-y-3.5 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <h3 className="text-sm sm:text-base font-bold text-white">
              {currentUser ? 'Account & Store Trust' : 'Sign In to EcoLoop'}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setAuthModalOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!currentUser ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={loading}
              className="w-full py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-white cursor-pointer"
            >
              Continue with Google (Cross-Device Sync)
            </button>

            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/25">
              <button
                type="button"
                onClick={() => signInAsDemo()}
                disabled={loading}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" /> Judge Demo Access
              </button>
              <p className="mt-2 text-center text-[10px] text-emerald-200/70">
                Guest identity is saved only in this browser.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-black/35 border border-white/10 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-white truncate">
                  {currentUser.displayName}
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    currentUser.verifiedStore
                      ? 'text-emerald-300 bg-emerald-500/15'
                      : 'text-amber-300 bg-amber-500/15'
                  }`}
                >
                  <BadgeCheck className="w-3 h-3" />
                  {currentUser.verifiedStore
                    ? 'Verified Store'
                    : 'Unverified Donor'}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">{currentUser.email}</p>
              <p className="text-[11px] text-emerald-400">
                Role: {activeRole === 'donor' ? 'Store Partner' : 'Consumer'} • Cap: {currentUser.maxWeightCapKg} kg
              </p>
            </div>

            <button
              type="button"
              onClick={signOutAccount}
              className="w-full py-2 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/10 text-xs font-semibold text-slate-300 hover:text-rose-200 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        )}

        {error && <p className="text-xs text-rose-400">{error}</p>}
      </div>
    </div>
  );
};