import React, { useState, useEffect } from 'react';
import { Lock, ShieldCheck, RefreshCw, Trash2, ShieldAlert, Fingerprint, ScanFace } from 'lucide-react';
import {
  checkBiometricSupport,
  isBiometricRegistered,
  registerBiometric,
  disableBiometric
} from '../utils/webAuthn';

interface PinSettingsCardProps {
  appSecurityPin: string | null;
  setAppSecurityPin: (pin: string | null) => void;
  triggerVibrate: () => void;
  setToast: (toast: { message: string; type: 'success' | 'error' | 'info' | 'loading' } | null) => void;
}

export function PinSettingsCard({
  appSecurityPin,
  setAppSecurityPin,
  triggerVibrate,
  setToast
}: PinSettingsCardProps) {
  const [mode, setMode] = useState<'view' | 'setup' | 'change' | 'disable'>('view');
  
  // Setup state
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  
  // Change state
  const [oldPin, setOldPin] = useState('');
  const [changeNewPin, setChangeNewPin] = useState('');
  const [changeConfirmPin, setChangeConfirmPin] = useState('');
  
  // Disable state
  const [disableOldPin, setDisableOldPin] = useState('');

  // Biometrics state
  const [isBioSupported, setIsBioSupported] = useState<boolean>(false);
  const [isBioRegistered, setIsBioRegistered] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function initBio() {
      const supported = await checkBiometricSupport();
      if (!isMounted) return;
      setIsBioSupported(supported);
      setIsBioRegistered(isBiometricRegistered());
    }
    initBio();
    return () => { isMounted = false; };
  }, []);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length !== 4 || confirmPin.length !== 4) {
      setToast({ message: 'PIN must be exactly 4 digits.', type: 'error' });
      triggerVibrate();
      return;
    }
    if (!/^\d+$/.test(newPin)) {
      setToast({ message: 'PIN must contain only numbers.', type: 'error' });
      triggerVibrate();
      return;
    }
    if (newPin !== confirmPin) {
      setToast({ message: 'PINs do not match. Please try again.', type: 'error' });
      triggerVibrate();
      return;
    }

    localStorage.setItem('app_security_pin', newPin);
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('last_unlocked_date', today);
    setAppSecurityPin(newPin);
    
    setToast({ message: 'Security PIN set successfully! Your sessions are now protected.', type: 'success' });
    
    // Auto register biometrics if supported
    if (isBioSupported && !isBioRegistered) {
      await registerBiometric();
      setIsBioRegistered(true);
    }
    
    resetForm();
  };

  const handleChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (oldPin !== appSecurityPin) {
      setToast({ message: 'Incorrect old PIN.', type: 'error' });
      triggerVibrate();
      return;
    }
    if (changeNewPin.length !== 4 || changeConfirmPin.length !== 4) {
      setToast({ message: 'New PIN must be exactly 4 digits.', type: 'error' });
      triggerVibrate();
      return;
    }
    if (!/^\d+$/.test(changeNewPin)) {
      setToast({ message: 'PIN must contain only numbers.', type: 'error' });
      triggerVibrate();
      return;
    }
    if (changeNewPin !== changeConfirmPin) {
      setToast({ message: 'Confirm PIN does not match new PIN.', type: 'error' });
      triggerVibrate();
      return;
    }

    localStorage.setItem('app_security_pin', changeNewPin);
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('last_unlocked_date', today);
    setAppSecurityPin(changeNewPin);

    setToast({ message: 'Security PIN changed successfully!', type: 'success' });
    resetForm();
  };

  const handleDisable = (e: React.FormEvent) => {
    e.preventDefault();
    if (disableOldPin !== appSecurityPin) {
      setToast({ message: 'Incorrect security PIN.', type: 'error' });
      triggerVibrate();
      return;
    }

    localStorage.removeItem('app_security_pin');
    localStorage.removeItem('last_unlocked_date');
    disableBiometric();
    setIsBioRegistered(false);
    setAppSecurityPin(null);

    setToast({ message: 'Security PIN & Biometrics have been disabled.', type: 'success' });
    resetForm();
  };

  const resetForm = () => {
    setMode('view');
    setNewPin('');
    setConfirmPin('');
    setOldPin('');
    setChangeNewPin('');
    setChangeConfirmPin('');
    setDisableOldPin('');
  };

  return (
    <div className="p-4 bg-slate-50 rounded-xl border border-border space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-primary" /> App Security PIN & Biometrics
        </h4>
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase flex items-center gap-1 ${
          appSecurityPin 
            ? "bg-green-100 text-green-700 border border-green-200" 
            : "bg-slate-200 text-slate-500 border border-slate-300"
        }`}>
          {appSecurityPin ? (
            <>
              <ShieldCheck className="w-3 h-3" /> Enabled
            </>
          ) : (
            "Disabled"
          )}
        </span>
      </div>

      {mode === 'view' && (
        <div className="space-y-3">
          <p className="text-[10px] text-slate-500 leading-relaxed">
            {appSecurityPin 
              ? "Your patient records database is protected. You will be prompted to enter your 4-digit PIN or scan your Fingerprint/Face ID the first time you open the app each day." 
              : "Set a 4-digit PIN and optional Fingerprint/Face ID (WebAuthn) to prevent unauthorized access to your clinical database on this device."
            }
          </p>
          
          <div className="flex flex-wrap gap-2 pt-1">
            {appSecurityPin ? (
              <>
                <button
                  onClick={() => setMode('change')}
                  className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1.5 shadow-sm hover:bg-slate-50 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" /> Change PIN
                </button>
                <button
                  onClick={() => setMode('disable')}
                  className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-100 hover:bg-rose-100 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" /> Disable Lock
                </button>
              </>
            ) : (
              <button
                onClick={() => setMode('setup')}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[10px] font-bold uppercase flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Enable Security Lock
              </button>
            )}
          </div>

          {/* Biometrics Toggle Section in View Mode */}
          {appSecurityPin && isBioSupported && (
            <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-700 flex items-center gap-1.5">
                  <Fingerprint className="w-3.5 h-3.5 text-blue-600" /> Fingerprint / Face ID (WebAuthn)
                </span>
                <p className="text-[9px] text-slate-400">
                  {isBioRegistered 
                    ? "Biometric unlock is active on this device." 
                    : "Use biometric authentication as an alternative to PIN."}
                </p>
              </div>
              {isBioRegistered ? (
                <button
                  type="button"
                  onClick={() => {
                    disableBiometric();
                    setIsBioRegistered(false);
                    setToast({ message: 'Biometric unlock disabled.', type: 'info' });
                  }}
                  className="px-2.5 py-1 text-[9px] font-bold text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded transition-all cursor-pointer"
                >
                  Disable
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    const res = await registerBiometric();
                    if (res.success) {
                      setIsBioRegistered(true);
                      setToast({ message: 'Fingerprint / Face ID enabled successfully!', type: 'success' });
                    } else {
                      setToast({ message: res.error || 'Failed to register biometrics.', type: 'error' });
                    }
                  }}
                  className="px-2.5 py-1 text-[9px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-all cursor-pointer flex items-center gap-1"
                >
                  <Fingerprint className="w-3 h-3" /> Enable
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Setup Form */}
      {mode === 'setup' && (
        <form onSubmit={handleSetup} className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Choose 4-Digit PIN</label>
              <input
                type="password"
                maxLength={4}
                pattern="\d{4}"
                placeholder="••••"
                required
                className="w-full bg-white border border-border rounded-lg py-1.5 px-3 text-center text-sm font-bold font-mono focus:ring-1 focus:ring-primary outline-none tracking-widest text-slate-700"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Confirm PIN</label>
              <input
                type="password"
                maxLength={4}
                pattern="\d{4}"
                placeholder="••••"
                required
                className="w-full bg-white border border-border rounded-lg py-1.5 px-3 text-center text-sm font-bold font-mono focus:ring-1 focus:ring-primary outline-none tracking-widest text-slate-700"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-[10px] font-bold uppercase rounded-lg shadow-sm transition-all cursor-pointer"
            >
              Confirm & Enable
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-3 py-2 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 text-[10px] font-bold uppercase rounded-lg transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Change Form */}
      {mode === 'change' && (
        <form onSubmit={handleChange} className="space-y-3 pt-1">
          <div className="space-y-1 max-w-[200px]">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Enter Current PIN</label>
            <input
              type="password"
              maxLength={4}
              pattern="\d{4}"
              placeholder="••••"
              required
              className="w-full bg-white border border-border rounded-lg py-1.5 px-3 text-center text-sm font-bold font-mono focus:ring-1 focus:ring-primary outline-none tracking-widest text-slate-700"
              value={oldPin}
              onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-slate-200/50 pt-2.5">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">New 4-Digit PIN</label>
              <input
                type="password"
                maxLength={4}
                pattern="\d{4}"
                placeholder="••••"
                required
                className="w-full bg-white border border-border rounded-lg py-1.5 px-3 text-center text-sm font-bold font-mono focus:ring-1 focus:ring-primary outline-none tracking-widest text-slate-700"
                value={changeNewPin}
                onChange={(e) => setChangeNewPin(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Confirm New PIN</label>
              <input
                type="password"
                maxLength={4}
                pattern="\d{4}"
                placeholder="••••"
                required
                className="w-full bg-white border border-border rounded-lg py-1.5 px-3 text-center text-sm font-bold font-mono focus:ring-1 focus:ring-primary outline-none tracking-widest text-slate-700"
                value={changeConfirmPin}
                onChange={(e) => setChangeConfirmPin(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-[10px] font-bold uppercase rounded-lg shadow-sm transition-all cursor-pointer"
            >
              Update PIN
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-3 py-2 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 text-[10px] font-bold uppercase rounded-lg transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Disable Form */}
      {mode === 'disable' && (
        <form onSubmit={handleDisable} className="space-y-3 pt-1">
          <div className="bg-red-50 border border-red-100 rounded-lg p-2.5 flex gap-2 text-red-700 items-start">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold uppercase tracking-wider">Warning: Disabling Security Lock</p>
              <p className="text-[9px] leading-relaxed text-red-600">
                Disabling the security lock removes both PIN and Biometric requirements on this device. Under HIPAA guidelines, this is discouraged on shared devices.
              </p>
            </div>
          </div>
          <div className="space-y-1 max-w-[200px]">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Confirm Current PIN</label>
            <input
              type="password"
              maxLength={4}
              pattern="\d{4}"
              placeholder="••••"
              required
              className="w-full bg-white border border-border rounded-lg py-1.5 px-3 text-center text-sm font-bold font-mono focus:ring-1 focus:ring-primary outline-none tracking-widest text-slate-700"
              value={disableOldPin}
              onChange={(e) => setDisableOldPin(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold uppercase rounded-lg shadow-sm transition-all cursor-pointer"
            >
              Disable Security Lock
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-3 py-2 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 text-[10px] font-bold uppercase rounded-lg transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
