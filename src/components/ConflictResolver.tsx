import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertTriangle, 
  X, 
  Check, 
  ArrowRight, 
  Database, 
  Smartphone, 
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Info
} from 'lucide-react';
import { Patient } from '../types';
import { SyncConflict } from '../services/patientService';

interface ConflictResolverProps {
  conflicts: SyncConflict[];
  isOpen: boolean;
  onClose: () => void;
  onResolve: (id: string, resolution: 'local' | 'remote' | 'custom', customRecord?: Patient) => Promise<void>;
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Patient Name',
  age: 'Age',
  gender: 'Gender',
  date: 'Procedure Date',
  admissionNo: 'Admission No',
  serNo: 'Serial No',
  serviceCategory: 'Service Category',
  presentation: 'Presentation',
  tmt: 'TMT',
  ejectionFraction: 'Ejection Fraction',
  closureDevice: 'Closure Device',
  closureDeviceCustom: 'Custom Closure Device',
  complicationsCustom: 'Custom Complications',
  otherHardwareNotes: 'Other Hardware Notes',
  finalNotes: 'Final Notes',
  plan: 'Plan / Recommendations',
  notes: 'General Notes',
  place: 'Place / Lab Location',
  category: 'Procedure Category',
  otherCategoryNotes: 'Custom Category Notes',
  bifurcation: 'Bifurcation PCI',
  isOther: 'Is Other / Access Related',
  otherAccessNotes: 'Custom Access Notes',
  otherEjectionFractionNotes: 'Custom EF Notes',
  usgDoppler: 'USG Doppler',
  preHb: 'Pre-Procedure Hb',
  preUrea: 'Pre-Procedure Urea',
  preCreatinine: 'Pre-Procedure Creatinine',
  preK: 'Pre-Procedure Potassium (K)',
  postHb: 'Post-Procedure Hb',
  postUrea: 'Post-Procedure Urea',
  postCreatinine: 'Post-Procedure Creatinine',
  postK: 'Post-Procedure Potassium (K)',
  rwma: 'RWMA',
  comorbidities: 'Comorbidities',
  pciVessels: 'PCI Vessels',
  lesionTypes: 'Lesion Types',
  imaging: 'Imaging Used',
  specialHardware: 'Special Hardware',
  complications: 'Complications',
  otherHardware: 'Other Hardware',
  drugs: 'Drugs Administered',
  tags: 'Tags',
  devices: 'Devices Count'
};

const formatValue = (key: string, val: any): string => {
  if (val === undefined || val === null) return 'Not Set';
  if (Array.isArray(val)) {
    return val.length > 0 ? val.join(', ') : 'None';
  }
  if (typeof val === 'object') {
    const entries = Object.entries(val).filter(([_, v]) => v !== undefined && v !== null);
    return entries.length > 0 ? entries.map(([k, v]) => `${k} (${v})`).join(', ') : 'None';
  }
  if (typeof val === 'boolean') {
    return val ? 'Yes' : 'No';
  }
  return String(val);
};

export const ConflictResolver: React.FC<ConflictResolverProps> = ({
  conflicts,
  isOpen,
  onClose,
  onResolve
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [choices, setChoices] = useState<Record<string, 'local' | 'remote' | 'custom'>>({});
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active conflict
  const conflict = conflicts[currentIndex];

  // Recalculate which fields differ whenever the active conflict changes
  const getDifferingFields = (): string[] => {
    if (!conflict) return [];
    const local = conflict.local;
    const remote = conflict.remote;
    
    const allKeys = Array.from(new Set([
      ...Object.keys(local),
      ...Object.keys(remote)
    ])) as (keyof Patient)[];

    const ignoredKeys = ['id', 'synced', 'localUpdatedAt', 'updatedAt', 'createdAt', 'createdBy', 'patientId', 'isDeleted', 'deletedAt'];

    return allKeys.filter(key => {
      if (ignoredKeys.includes(key)) return false;
      
      const valL = local[key];
      const valR = remote[key];

      // Deep compare
      if (Array.isArray(valL) || Array.isArray(valR)) {
        const arrL = (valL as any[]) || [];
        const arrR = (valR as any[]) || [];
        if (arrL.length !== arrR.length) return true;
        const sortedL = [...arrL].sort();
        const sortedR = [...arrR].sort();
        for (let i = 0; i < sortedL.length; i++) {
          if (sortedL[i] !== sortedR[i]) return true;
        }
        return false;
      }

      if (typeof valL === 'object' || typeof valR === 'object') {
        const devL = valL || {};
        const devR = valR || {};
        const devKeys = Array.from(new Set([...Object.keys(devL), ...Object.keys(devR)]));
        for (const k of devKeys) {
          if ((devL as any)[k] !== (devR as any)[k]) return true;
        }
        return false;
      }

      return valL !== valR;
    });
  };

  const differingFields = getDifferingFields();

  // Reset resolution state for a new conflict
  useEffect(() => {
    if (conflict) {
      setError(null);
      const initialChoices: Record<string, 'local' | 'remote' | 'custom'> = {};
      const initialCustoms: Record<string, string> = {};
      
      differingFields.forEach(field => {
        // Default to keeping the local change, but mark as editable
        initialChoices[field] = 'local';
        initialCustoms[field] = formatValue(field, conflict.local[field as keyof Patient]);
      });
      
      setChoices(initialChoices);
      setCustomValues(initialCustoms);
    }
  }, [currentIndex, conflicts]);

  if (!isOpen || !conflict) return null;

  const handleFieldChoice = (field: string, source: 'local' | 'remote' | 'custom') => {
    setChoices(prev => ({ ...prev, [field]: source }));
  };

  const handleCustomValueChange = (field: string, val: string) => {
    setCustomValues(prev => ({ ...prev, [field]: val }));
    setChoices(prev => ({ ...prev, [field]: 'custom' }));
  };

  const chooseAllLocal = () => {
    const updatedChoices = { ...choices };
    differingFields.forEach(f => {
      updatedChoices[f] = 'local';
    });
    setChoices(updatedChoices);
  };

  const chooseAllRemote = () => {
    const updatedChoices = { ...choices };
    differingFields.forEach(f => {
      updatedChoices[f] = 'remote';
    });
    setChoices(updatedChoices);
  };

  const saveResolution = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      // Build resolved record starting from local structure
      const resolvedRecord: any = { ...conflict.local };
      
      differingFields.forEach(field => {
        const choice = choices[field];
        if (choice === 'local') {
          resolvedRecord[field] = conflict.local[field as keyof Patient];
        } else if (choice === 'remote') {
          resolvedRecord[field] = conflict.remote[field as keyof Patient];
        } else if (choice === 'custom') {
          // Attempt to convert string representation back to primitive if applicable
          const rawCustom = customValues[field];
          const localVal = conflict.local[field as keyof Patient];
          
          if (typeof localVal === 'number') {
            resolvedRecord[field] = Number(rawCustom);
          } else if (typeof localVal === 'boolean') {
            resolvedRecord[field] = (rawCustom.toLowerCase() === 'yes' || rawCustom === 'true');
          } else if (Array.isArray(localVal)) {
            // Split by comma
            resolvedRecord[field] = rawCustom.split(',').map(s => s.trim()).filter(Boolean);
          } else {
            resolvedRecord[field] = rawCustom;
          }
        }
      });

      // Submit resolution using resolution type 'custom' with the fully resolved merged object
      await onResolve(conflict.id, 'custom', resolvedRecord);
      
      // Move to next conflict, or close if done
      if (currentIndex < conflicts.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        onClose();
      }
    } catch (e: any) {
      console.error('Failed to save resolved conflict:', e);
      setError(e?.message || 'Error saving conflict resolution. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const localTimeStr = conflict.local.localUpdatedAt 
    ? new Date(conflict.local.localUpdatedAt).toLocaleString() 
    : conflict.local.updatedAt 
      ? new Date(conflict.local.updatedAt).toLocaleString() 
      : 'Unknown';

  const remoteTimeStr = conflict.remote.updatedAt 
    ? new Date(conflict.remote.updatedAt).toLocaleString() 
    : conflict.remote.createdAt 
      ? new Date(conflict.remote.createdAt).toLocaleString() 
      : 'Unknown';

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-amber-500 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-white animate-bounce" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">Data Synchronization Conflicts</h2>
              <p className="text-xs text-amber-100 font-medium">
                Resolve offline/online changes for patient: <span className="font-bold underline">{conflict.local.name || 'Unnamed'}</span> (Admission No: {conflict.local.admissionNo || 'N/A'})
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-white/15 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conflict Pagination Progress */}
        {conflicts.length > 1 && (
          <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-1 font-medium">
              <span>Resolving record</span>
              <span className="text-slate-800 font-bold">{currentIndex + 1}</span>
              <span>of</span>
              <span className="text-slate-800 font-bold">{conflicts.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex(prev => prev - 1)}
                className="p-1 rounded hover:bg-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Previous conflict"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={currentIndex === conflicts.length - 1}
                onClick={() => setCurrentIndex(prev => prev + 1)}
                className="p-1 rounded hover:bg-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Next conflict"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Metadata Source Indicator Card */}
        <div className="px-5 py-4 bg-slate-50/50 border-b border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="flex items-start gap-2.5 p-3 bg-indigo-50/50 border border-indigo-100/60 rounded-xl">
            <Smartphone className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold text-indigo-700 block mb-0.5">Device Version (Modified Offline)</span>
              <span className="text-slate-500 block">Saved locally on: <span className="font-semibold text-slate-700">{localTimeStr}</span></span>
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-3 bg-emerald-50/50 border border-emerald-100/60 rounded-xl">
            <Database className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold text-emerald-700 block mb-0.5">Cloud Server Version (Modified Remotely)</span>
              <span className="text-slate-500 block">Saved in database on: <span className="font-semibold text-slate-700">{remoteTimeStr}</span></span>
            </div>
          </div>
        </div>

        {/* Global actions */}
        <div className="px-5 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-50/30 text-xs gap-3">
          <span className="text-slate-500 font-medium">Quick Resolutions:</span>
          <div className="flex items-center gap-2">
            <button
              onClick={chooseAllLocal}
              className="px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold transition-all border border-indigo-200 cursor-pointer"
            >
              Select All Local
            </button>
            <button
              onClick={chooseAllRemote}
              className="px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold transition-all border border-emerald-200 cursor-pointer"
            >
              Select All Remote
            </button>
          </div>
        </div>

        {/* Comparison List Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-start gap-2.5 shadow-sm animate-fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5 animate-pulse" />
              <div className="flex-1">
                <span className="font-bold block mb-0.5">Failed to Resolve Conflict</span>
                <span>{error}</span>
              </div>
            </div>
          )}
          <AnimatePresence mode="popLayout">
            {differingFields.map(field => {
              const localVal = conflict.local[field as keyof Patient];
              const remoteVal = conflict.remote[field as keyof Patient];
              const label = FIELD_LABELS[field] || field;

              const isLocalSelected = choices[field] === 'local';
              const isRemoteSelected = choices[field] === 'remote';
              const isCustomSelected = choices[field] === 'custom';

              return (
                <motion.div
                  key={field}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden"
                >
                  {/* Field Header */}
                  <div className="px-4 py-2.5 bg-slate-100/60 border-b border-slate-200 flex items-center justify-between">
                    <span className="font-bold text-xs sm:text-sm text-slate-700">{label}</span>
                    <span className="text-[10px] font-semibold text-slate-400 font-mono tracking-wider uppercase">Field: {field}</span>
                  </div>

                  {/* Options Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-0.5 bg-slate-100">
                    
                    {/* Device Option */}
                    <div 
                      onClick={() => handleFieldChoice(field, 'local')}
                      className={`p-4 bg-white cursor-pointer transition-all hover:bg-slate-50 relative flex flex-col justify-between min-h-[100px] ${
                        isLocalSelected ? 'ring-2 ring-indigo-500 ring-inset bg-indigo-50/10' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">Device Value</span>
                        {isLocalSelected && (
                          <div className="w-5 h-5 bg-indigo-500 text-white rounded-full flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <div className="font-semibold text-slate-800 text-sm break-words leading-relaxed">
                        {formatValue(field, localVal)}
                      </div>
                    </div>

                    {/* Server Option */}
                    <div 
                      onClick={() => handleFieldChoice(field, 'remote')}
                      className={`p-4 bg-white cursor-pointer transition-all hover:bg-slate-50 relative flex flex-col justify-between min-h-[100px] ${
                        isRemoteSelected ? 'ring-2 ring-emerald-500 ring-inset bg-emerald-50/10' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Cloud Server Value</span>
                        {isRemoteSelected && (
                          <div className="w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <div className="font-semibold text-slate-800 text-sm break-words leading-relaxed">
                        {formatValue(field, remoteVal)}
                      </div>
                    </div>

                  </div>

                  {/* Custom Value / Merged Override Area */}
                  <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                      <span>Custom Override:</span>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={customValues[field] || ''}
                        onChange={(e) => handleCustomValueChange(field, e.target.value)}
                        placeholder="Type a custom merged value for this field..."
                        className={`w-full px-3 py-1.5 text-xs font-semibold text-slate-800 rounded-lg border bg-white focus:outline-none transition-all ${
                          isCustomSelected 
                            ? 'border-amber-400 ring-2 ring-amber-200/50' 
                            : 'border-slate-200 hover:border-slate-300 focus:border-slate-400'
                        }`}
                      />
                      {isCustomSelected && (
                        <span className="absolute right-2.5 top-2 text-[9px] font-extrabold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded uppercase tracking-wider border border-amber-200">
                          Editing Custom
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-500 font-medium">
            <Info className="w-4 h-4 shrink-0 text-slate-400" />
            <span>Select the preferred value block or enter a custom override for each differing field.</span>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-200 transition-colors shadow-sm cursor-pointer select-none"
            >
              Cancel
            </button>
            <button
              disabled={isSubmitting}
              onClick={saveResolution}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-all shadow-md cursor-pointer select-none ${
                isSubmitting ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Resolve & Save Record</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
