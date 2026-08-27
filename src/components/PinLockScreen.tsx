import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, LogOut, Check, ShieldCheck, AlertCircle, Fingerprint, ScanFace, Sparkles } from 'lucide-react';
import {
  checkBiometricSupport,
  isBiometricRegistered,
  authenticateBiometric,
  registerBiometric
} from '../utils/webAuthn';

interface PinLockScreenProps {
  appSecurityPin: string | null;
  setAppSecurityPin: (pin: string | null) => void;
  onUnlock: () => void;
  onLogout: () => Promise<void>;
  triggerVibrate: () => void;
}

export function PinLockScreen({
  appSecurityPin,
  setAppSecurityPin,
  onUnlock,
  onLogout,
  triggerVibrate
}: PinLockScreenProps) {
  const [pin, setPin] = useState<string>('');
  const [setupStep, setSetupStep] = useState<'enter' | 'confirm'>(appSecurityPin ? 'enter' : 'enter');
  const [setupFirstPin, setSetupFirstPin] = useState<string>('');
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [showForgotConfirm, setShowForgotConfirm] = useState<boolean>(false);

  // WebAuthn / Biometrics State
  const [isBiometricSupported, setIsBiometricSupported] = useState<boolean>(false);
  const [isBiometricRegisteredState, setIsBiometricRegisteredState] = useState<boolean>(false);
  const [isScanningBiometric, setIsScanningBiometric] = useState<boolean>(false);
  const [showBiometricSetupPrompt, setShowBiometricSetupPrompt] = useState<boolean>(false);

  // Check WebAuthn support and auto-trigger if registered
  useEffect(() => {
    let isMounted = true;
    async function initBiometrics() {
      const supported = await checkBiometricSupport();
      if (!isMounted) return;
      setIsBiometricSupported(supported);
      
      const registered = isBiometricRegistered();
      setIsBiometricRegisteredState(registered);

      // Auto-trigger biometric authentication if PIN exists and biometrics is registered
      if (appSecurityPin && registered && supported) {
        const timer = setTimeout(() => {
          handleBiometricUnlock();
        }, 350);
        return () => clearTimeout(timer);
      }
    }
    initBiometrics();
    return () => { isMounted = false; };
  }, [appSecurityPin]);

  // Keyboard support for numeric entry
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSuccess || showForgotConfirm || showBiometricSetupPrompt) return;

      if (e.key >= '0' && e.key <= '9') {
        if (pin.length < 4) {
          handleNumberPress(e.key);
        }
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, isSuccess, showForgotConfirm, showBiometricSetupPrompt, setupStep, setupFirstPin]);

  const handleNumberPress = (num: string) => {
    if (pin.length >= 4 || isSuccess) return;
    const nextPin = pin + num;
    setPin(nextPin);
    setIsError(false);
    setErrorMsg('');

    if (nextPin.length === 4) {
      setTimeout(() => {
        verifyPin(nextPin);
      }, 150);
    }
  };

  const handleDelete = () => {
    if (isSuccess) return;
    setPin(prev => prev.slice(0, -1));
    setIsError(false);
    setErrorMsg('');
  };

  const handleClear = () => {
    if (isSuccess) return;
    setPin('');
    setIsError(false);
    setErrorMsg('');
  };

  const handleBiometricUnlock = async () => {
    if (isScanningBiometric || isSuccess) return;
    setIsScanningBiometric(true);
    setErrorMsg('');

    try {
      const result = await authenticateBiometric();
      if (result.success) {
        setIsSuccess(true);
        triggerVibrate();
        setTimeout(() => {
          onUnlock();
        }, 500);
      } else {
        if (result.error && result.error !== 'Biometric authentication was canceled.') {
          triggerError(result.error);
        }
      }
    } catch (err: any) {
      triggerError('Biometric verification failed.');
    } finally {
      setIsScanningBiometric(false);
    }
  };

  const verifyPin = (enteredPin: string) => {
    if (appSecurityPin) {
      // UNLOCK MODE
      if (enteredPin === appSecurityPin) {
        setIsSuccess(true);
        triggerVibrate();
        setTimeout(() => {
          onUnlock();
        }, 600);
      } else {
        triggerError('Incorrect security PIN. Please try again.');
      }
    } else {
      // SETUP MODE
      if (setupStep === 'enter') {
        setSetupFirstPin(enteredPin);
        setSetupStep('confirm');
        setPin('');
      } else {
        if (enteredPin === setupFirstPin) {
          setIsSuccess(true);
          triggerVibrate();
          setAppSecurityPin(enteredPin);

          // If biometric is supported, prompt user to register biometrics
          if (isBiometricSupported && !isBiometricRegistered()) {
            setTimeout(() => {
              setShowBiometricSetupPrompt(true);
            }, 500);
          } else {
            setTimeout(() => {
              onUnlock();
            }, 600);
          }
        } else {
          triggerError('PINs do not match. Restarting setup...');
          setSetupStep('enter');
          setSetupFirstPin('');
        }
      }
    }
  };

  const handleRegisterBiometricsConfirm = async () => {
    setIsScanningBiometric(true);
    const result = await registerBiometric();
    setIsScanningBiometric(false);
    setShowBiometricSetupPrompt(false);
    onUnlock();
  };

  const triggerError = (msg: string) => {
    setIsError(true);
    setErrorMsg(msg);
    triggerVibrate();
    setPin('');
    setTimeout(() => {
      setIsError(false);
    }, 500);
  };

  const handleResetPinConfirm = async () => {
    setAppSecurityPin(null);
    localStorage.removeItem('app_security_pin');
    localStorage.removeItem('last_unlocked_date');
    localStorage.removeItem('webauthn_credential_id');
    localStorage.removeItem('biometric_enabled');
    await onLogout();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-6 select-none font-sans text-slate-800">
      {/* Header bar */}
      <div className="flex justify-between items-center w-full max-w-md mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
          </div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">CathData Secure</span>
        </div>
        <button
          onClick={onLogout}
          className="text-xs font-semibold text-slate-400 hover:text-slate-600 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign Out
        </button>
      </div>

      {/* Main Lock Content */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-md w-full mx-auto py-8">
        <AnimatePresence mode="wait">
          {showBiometricSetupPrompt ? (
            <motion.div
              key="biometric-setup-prompt"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xl shadow-slate-100 w-full text-center space-y-4"
            >
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mx-auto text-blue-600 border border-blue-100">
                <Fingerprint className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center justify-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" /> Enable Biometric Unlock?
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Use your device's Fingerprint, Touch ID, or Face ID (WebAuthn) for quick and secure access to your clinical database.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowBiometricSetupPrompt(false);
                    onUnlock();
                  }}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold uppercase rounded-xl transition-all cursor-pointer"
                >
                  Skip for Now
                </button>
                <button
                  onClick={handleRegisterBiometricsConfirm}
                  disabled={isScanningBiometric}
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase rounded-xl transition-all shadow-md shadow-blue-500/10 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isScanningBiometric ? (
                    <ScanFace className="w-4 h-4 animate-spin" />
                  ) : (
                    <Fingerprint className="w-4 h-4" />
                  )}
                  Enable Biometrics
                </button>
              </div>
            </motion.div>
          ) : showForgotConfirm ? (
            <motion.div
              key="forgot-confirm"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xl shadow-slate-100 w-full text-center space-y-4"
            >
              <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto text-red-600">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Reset Security PIN?</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  For HIPAA compliance and data security, resetting your PIN requires logging out of your account. 
                  Your locally saved clinical database is encrypted and safe. You will need to log back in to set a new PIN.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowForgotConfirm(false)}
                  className="flex-1 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold uppercase rounded-lg transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetPinConfirm}
                  className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase rounded-lg transition-all shadow-md shadow-red-500/10 cursor-pointer"
                >
                  Log Out & Reset
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="lock-panel"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="w-full flex flex-col items-center space-y-5"
            >
              {/* Badge Icon */}
              <div className="relative">
                <motion.div
                  animate={isSuccess ? { scale: [1, 1.15, 1], rotate: [0, 360, 360] } : {}}
                  transition={{ duration: 0.5 }}
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
                    isSuccess 
                      ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' 
                      : isError 
                      ? 'bg-red-50 text-red-600 border border-red-200 animate-shake' 
                      : 'bg-white text-blue-600 border border-slate-200 shadow-sm'
                  }`}
                >
                  {isSuccess ? (
                    <Check className="w-8 h-8" />
                  ) : (
                    <Lock className="w-7 h-7" />
                  )}
                </motion.div>
                {isSuccess && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                )}
              </div>

              {/* Title / Description */}
              <div className="text-center space-y-1.5">
                <h2 className="text-lg font-bold text-slate-900 font-display">
                  {appSecurityPin ? 'Enter Security PIN' : setupStep === 'enter' ? 'Set Security PIN' : 'Confirm Security PIN'}
                </h2>
                <p className="text-xs text-slate-400 max-w-xs mx-auto px-4">
                  {appSecurityPin 
                    ? "Verify your PIN or use biometrics to access patient records." 
                    : setupStep === 'enter'
                    ? "Protect clinical data. Choose a 4-digit code to lock CathData."
                    : "Please re-type your 4-digit code to confirm."
                  }
                </p>
              </div>

              {/* Biometric Quick Button (if supported and PIN set) */}
              {appSecurityPin && isBiometricSupported && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleBiometricUnlock}
                  disabled={isScanningBiometric || isSuccess}
                  className="w-full max-w-[280px] py-2.5 px-4 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200 text-blue-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {isScanningBiometric ? (
                    <>
                      <ScanFace className="w-4 h-4 text-blue-600 animate-spin" />
                      <span>Authenticating Biometrics...</span>
                    </>
                  ) : (
                    <>
                      <Fingerprint className="w-4 h-4 text-blue-600" />
                      <span>Unlock with Fingerprint / Face ID</span>
                    </>
                  )}
                </motion.button>
              )}

              {/* 4 PIN Dots */}
              <motion.div 
                animate={isError ? { x: [0, -10, 10, -10, 10, -5, 5, 0] } : {}}
                transition={{ duration: 0.4 }}
                className="flex gap-4 py-1"
              >
                {[0, 1, 2, 3].map(index => {
                  const filled = pin.length > index;
                  return (
                    <div
                      key={index}
                      className={`w-4.5 h-4.5 rounded-full border-2 transition-all duration-150 ${
                        isSuccess
                          ? 'bg-green-500 border-green-500 scale-110'
                          : isError
                          ? 'border-red-400 bg-red-100 scale-95'
                          : filled
                          ? 'bg-blue-600 border-blue-600 scale-110 shadow-sm shadow-blue-500/10'
                          : 'border-slate-300 bg-transparent'
                      }`}
                    />
                  );
                })}
              </motion.div>

              {/* Error messages */}
              <div className="h-4 text-center">
                {errorMsg && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[11px] font-bold text-rose-600 flex items-center justify-center gap-1"
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {errorMsg}
                  </motion.p>
                )}
              </div>

              {/* Virtual Keypad */}
              <div className="grid grid-cols-3 gap-y-3 gap-x-5 max-w-[280px] w-full pt-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                  <button
                    key={num}
                    onClick={() => handleNumberPress(num)}
                    disabled={isSuccess}
                    className="w-16 h-16 rounded-full bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-lg font-bold text-slate-800 shadow-sm flex items-center justify-center transition-all cursor-pointer select-none"
                  >
                    {num}
                  </button>
                ))}
                
                {/* Clear Button */}
                <button
                  onClick={handleClear}
                  disabled={isSuccess || pin.length === 0}
                  className="w-16 h-16 rounded-full text-slate-400 hover:text-slate-600 active:bg-slate-100 text-xs font-bold tracking-wider uppercase flex items-center justify-center transition-all cursor-pointer disabled:opacity-30"
                >
                  Clear
                </button>

                {/* '0' Button */}
                <button
                  onClick={() => handleNumberPress('0')}
                  disabled={isSuccess}
                  className="w-16 h-16 rounded-full bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-lg font-bold text-slate-800 shadow-sm flex items-center justify-center transition-all cursor-pointer select-none"
                >
                  0
                </button>

                {/* Delete Button */}
                <button
                  onClick={handleDelete}
                  disabled={isSuccess || pin.length === 0}
                  className="w-16 h-16 rounded-full text-slate-400 hover:text-slate-600 active:bg-slate-100 text-xs font-bold tracking-wider uppercase flex items-center justify-center transition-all cursor-pointer disabled:opacity-30"
                >
                  Delete
                </button>
              </div>

              {/* Forgot link for Unlock Mode */}
              {appSecurityPin && (
                <button
                  onClick={() => setShowForgotConfirm(true)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline pt-1 cursor-pointer transition-colors"
                >
                  Forgot Security PIN?
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer information */}
      <div className="text-center max-w-md mx-auto w-full pt-4 border-t border-slate-100 text-[10px] text-slate-400 leading-relaxed font-mono">
        Designed for clinical compliance. Local storage sessions lock automatically after 24 hours.
      </div>
    </div>
  );
}
