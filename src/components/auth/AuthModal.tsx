// src/components/auth/AuthModal.tsx
import React, { useState } from 'react';
import {
  ShieldCheck,
  Sparkles,
  Store,
  User,
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
    signInWithEmail,
    signInWithGoogle,
    signInAsDemo,
    verifyCurrentStore,
    toggleInstantStoreVerification,
    signOutAccount,
  } = useEcoStore();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [regCode, setRegCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!authModalOpen) return null;

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmail(email.trim(), name.trim());
      setEmail('');
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

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

  const handleRegSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const ok = await verifyCurrentStore(regCode);
    if (!ok) {
      setError('Enter a valid registration or food-safety ID (at least 5 characters).');
    } else {
      setRegCode('');
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

        {/* 1-Click Judge / Demo Profiles */}
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/25 space-y-2">
          <p className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 shrink-0" /> 1-Click Judge Demo Profiles
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => signInAsDemo('receiver', false)}
              className="py-2 px-2 rounded-xl bg-white/10 hover:bg-white/15 text-[11px] font-bold text-white flex items-center justify-center gap-1 cursor-pointer"
            >
              <User className="w-3 h-3 text-emerald-400 shrink-0" /> Rescuer
            </button>
            <button
              type="button"
              onClick={() => signInAsDemo('donor', false)}
              className="py-2 px-2 rounded-xl bg-white/10 hover:bg-white/15 text-[11px] font-bold text-white flex items-center justify-center gap-1 cursor-pointer"
            >
              <Store className="w-3 h-3 text-amber-400 shrink-0" /> 5kg Store
            </button>
            <button
              type="button"
              onClick={() => signInAsDemo('donor', true)}
              className="py-2 px-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[11px] font-extrabold text-slate-950 flex items-center justify-center gap-1 cursor-pointer"
            >
              <BadgeCheck className="w-3 h-3 shrink-0" /> Verified
            </button>
          </div>
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

            <form onSubmit={handleEmailAuth} className="space-y-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Name or Store Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Lakeside Organic Market"
                  className="w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-xs sm:text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-xs sm:text-sm text-white"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider cursor-pointer"
              >
                {loading ? 'Syncing...' : 'Continue with Email'}
              </button>
            </form>
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

            {activeRole === 'donor' && (
              <div className="p-3 rounded-xl bg-black/30 border border-white/10 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-200">
                    Store Verification Status
                  </span>
                  <button
                    type="button"
                    onClick={toggleInstantStoreVerification}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-[11px] font-bold text-emerald-300 cursor-pointer"
                  >
                    {currentUser.verifiedStore ? 'Unverify (5kg)' : 'Instant Verify (50kg)'}
                  </button>
                </div>

                {!currentUser.verifiedStore && (
                  <form onSubmit={handleRegSubmit} className="flex gap-1.5 pt-1">
                    <input
                      type="text"
                      value={regCode}
                      onChange={(e) => setRegCode(e.target.value)}
                      placeholder="Business / food-safety ID"
                      className="flex-1 min-w-0 rounded-xl bg-black/40 border border-white/15 px-2.5 py-1.5 text-xs text-white"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs shrink-0 cursor-pointer"
                    >
                      Verify
                    </button>
                  </form>
                )}
              </div>
            )}

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