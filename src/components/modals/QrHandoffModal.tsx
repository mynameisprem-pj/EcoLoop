// src/components/modals/QrHandoffModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  X,
  CheckCircle2,
  ShieldCheck,
  Leaf,
  Utensils,
  Scale,
  KeyRound,
  AlertCircle,
  Camera,
  QrCode,
} from 'lucide-react';
import { useEcoStore } from '../../store/useEcoStore';

export const QrHandoffModal: React.FC = () => {
  const { selectedClaimForModal, setSelectedClaimForModal, verifyPickupCode } =
    useEcoStore();

  const [enteredCode, setEnteredCode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Clean up hardware camera stream when modal closes or switches mode
  useEffect(() => {
    return () => {
      stopCameraScanner();
    };
  }, [selectedClaimForModal]);

  const stopCameraScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch {
        // Ignore cleanup errors on unmount
      }
      scannerRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCameraScanner = async () => {
    if (!selectedClaimForModal) return;
    setErrorMsg(null);
    setIsCameraActive(true);

    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode('ecoloop-qr-reader');
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 200, height: 200 } },
          async (decodedText) => {
            // Expected payload format: ECOLOOP|<claimId>|<pickupCode> or raw pickupCode
            const parts = decodedText.split('|');
            const extractedCode =
              parts.length === 3 ? parts[2] : decodedText.trim();

            const ok = await verifyPickupCode(
              selectedClaimForModal.id,
              extractedCode
            );
            if (ok) {
              await stopCameraScanner();
            } else {
              setErrorMsg('Scanned QR does not match this pickup pass.');
            }
          },
          () => {
            // Frame scan in progress
          }
        );
      } catch (err) {
        setIsCameraActive(false);
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Camera access denied or unavailable on this device.'
        );
      }
    }, 150);
  };

  if (!selectedClaimForModal) return null;

  const isVerified = selectedClaimForModal.status === 'verified_complete';
  const qrPayload = `ECOLOOP|${selectedClaimForModal.id}|${selectedClaimForModal.pickupCode}`;

  const handleManualVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const success = await verifyPickupCode(
      selectedClaimForModal.id,
      enteredCode
    );
    if (!success) {
      setErrorMsg('Verification code does not match. Please check the code.');
    } else {
      setEnteredCode('');
    }
  };

  const handleClose = async () => {
    await stopCameraScanner();
    setSelectedClaimForModal(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-sm rounded-3xl bg-[#0D1815] border border-emerald-500/45 p-5 text-slate-100 shadow-[0_0_50px_rgba(16,185,129,0.28)] overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-300 to-emerald-500" />

        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="pr-8">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            {isVerified ? 'Verified Pickup Receipt' : 'Live QR Pickup Pass'}
          </span>
          <h3 className="text-lg font-extrabold text-white mt-0.5 leading-snug">
            {selectedClaimForModal.listingTitle}
          </h3>
          <p className="text-xs text-slate-400">
            Store:{' '}
            <span className="text-emerald-300">
              {selectedClaimForModal.donorName}
            </span>
          </p>
        </div>

        {/* Center Display: Either Scannable ISO QR Code OR Live Hardware Camera */}
        <div className="my-4 flex flex-col items-center">
          {isCameraActive && !isVerified ? (
            <div className="w-full space-y-2">
              <div
                id="ecoloop-qr-reader"
                className="w-full rounded-2xl overflow-hidden border-2 border-emerald-400 bg-black min-h-[220px]"
              />
              <button
                type="button"
                onClick={stopCameraScanner}
                className="w-full py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" /> Switch Back to QR Pass
              </button>
            </div>
          ) : (
            <div className="relative p-4 rounded-2xl bg-white text-slate-950 shadow-[0_0_30px_rgba(16,185,129,0.25)]">
              <div
                className={`transition-all duration-500 ${
                  isVerified ? 'opacity-15 blur-[1px]' : 'opacity-100'
                }`}
              >
                <QRCodeSVG
                  value={qrPayload}
                  size={160}
                  bgColor="#FFFFFF"
                  fgColor="#06241C"
                  level="M"
                />
              </div>

              {isVerified && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-950/90 rounded-2xl text-center p-3 border-2 border-emerald-400">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-1" />
                  <span className="text-sm font-extrabold text-white uppercase tracking-wider">
                    Pickup Confirmed
                  </span>
                  <span className="text-[11px] text-emerald-200 mt-0.5">
                    Verified & Logged
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="mt-3 text-center">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 block">
              Backup Verification Code
            </span>
            <span className="mt-1 inline-block font-mono text-xl font-black tracking-widest text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 px-4 py-1 rounded-xl">
              {selectedClaimForModal.pickupCode}
            </span>
          </div>
        </div>

        {/* Impact Summary */}
        <div className="grid grid-cols-3 gap-2 p-2.5 rounded-2xl bg-black/40 border border-white/10 text-center mb-4">
          <div className="p-1.5">
            <Scale className="w-4 h-4 text-emerald-400 mx-auto mb-0.5" />
            <p className="text-xs font-extrabold text-white">
              {selectedClaimForModal.weightKg} kg
            </p>
            <p className="text-[10px] text-slate-400">Weight</p>
          </div>
          <div className="p-1.5 border-x border-white/10">
            <Utensils className="w-4 h-4 text-emerald-400 mx-auto mb-0.5" />
            <p className="text-xs font-extrabold text-white">
              {selectedClaimForModal.mealsSaved}
            </p>
            <p className="text-[10px] text-slate-400">Meals</p>
          </div>
          <div className="p-1.5">
            <Leaf className="w-4 h-4 text-emerald-400 mx-auto mb-0.5" />
            <p className="text-xs font-extrabold text-emerald-300">
              {selectedClaimForModal.co2SavedKg} kg
            </p>
            <p className="text-[10px] text-slate-400">CO₂e Saved</p>
          </div>
        </div>

        {/* Store Verification Controls */}
        {!isVerified ? (
          <div className="space-y-2.5 pt-3 border-t border-white/10">
            {!isCameraActive && (
              <button
                type="button"
                onClick={startCameraScanner}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-200 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Camera className="w-4 h-4 text-emerald-400" />
                Store Staff: Scan QR with Camera
              </button>
            )}

            <form onSubmit={handleManualVerify} className="flex gap-2">
              <div className="relative flex-1">
                <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="Or type ECO-XXX code"
                  value={enteredCode}
                  onChange={(e) => setEnteredCode(e.target.value)}
                  className="w-full rounded-xl bg-black/50 border border-white/15 pl-8 pr-3 py-2 text-xs font-mono uppercase text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Verify
              </button>
            </form>

            {errorMsg && (
              <p className="text-[11px] text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {errorMsg}
              </p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={handleClose}
            className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold uppercase tracking-wider text-white transition-colors cursor-pointer"
          >
            Close Receipt
          </button>
        )}
      </div>
    </div>
  );
};