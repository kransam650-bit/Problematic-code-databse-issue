import React, { useState } from 'react';
import { Calendar, Plus, Trash2, Edit2, CheckCircle2, X, Clock, FileText, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { Outcome, OutcomeStatus } from '../types';
import { VoiceInputButton } from './VoiceInputButton';
import { PhotoUploadField } from './FormFields';

interface FollowUpEditorProps {
  outcomes: Outcome[];
  onChange: (outcomes: Outcome[]) => void;
  formatDateDMY?: (dateStr?: string) => string;
  onPreviewPhoto?: (url: string, title: string) => void;
}

const formatRawDateInput = (val: string): string => {
  let clean = val.replace(/[^0-9]/g, '');
  if (clean.length > 8) {
    clean = clean.slice(0, 8);
  }
  let formatted = '';
  if (clean.length > 0) {
    formatted = clean.slice(0, 2);
  }
  if (clean.length >= 3) {
    formatted += '_' + clean.slice(2, 4);
  }
  if (clean.length >= 5) {
    formatted += '_' + clean.slice(4, 8);
  }
  return formatted;
};

const getTodayDMY = (): string => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}_${String(d.getMonth() + 1).padStart(2, '0')}_${d.getFullYear()}`;
};

const downscaleImage = (file: File | Blob, maxDim: number = 1000): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject('Canvas context not available');
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };
    img.src = objectUrl;
  });
};

export const FollowUpEditor: React.FC<FollowUpEditorProps> = ({ outcomes = [], onChange, formatDateDMY, onPreviewPhoto }) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftStatus, setDraftStatus] = useState<OutcomeStatus>(OutcomeStatus.FollowUp);
  const [draftDate, setDraftDate] = useState<string>(getTodayDMY());
  const [draftNotes, setDraftNotes] = useState<string>('');
  const [draftPhotoUrl, setDraftPhotoUrl] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Reset form inputs
  const resetDraft = () => {
    setEditingIndex(null);
    setDraftStatus(OutcomeStatus.FollowUp);
    setDraftDate(getTodayDMY());
    setDraftNotes('');
    setDraftPhotoUrl('');
    setErrorMsg('');
  };

  const handleStartEdit = (index: number) => {
    const item = outcomes[index];
    if (!item) return;
    setEditingIndex(index);
    setDraftStatus(item.status || OutcomeStatus.FollowUp);
    setDraftDate(item.date || getTodayDMY());
    setDraftNotes(item.notes || '');
    setDraftPhotoUrl(item.photoUrl || '');
    setErrorMsg('');
  };

  const handleDelete = (index: number) => {
    const updated = outcomes.filter((_, i) => i !== index);
    onChange(updated);
    if (editingIndex === index) {
      resetDraft();
    } else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }
  };

  const handleSave = () => {
    if (!draftNotes.trim()) {
      setErrorMsg('Please enter follow-up clinical progress notes.');
      return;
    }

    const newOutcome: Outcome = {
      status: draftStatus,
      date: draftDate || getTodayDMY(),
      notes: draftNotes.trim(),
      photoUrl: draftPhotoUrl || undefined
    };

    let updated: Outcome[];
    if (editingIndex !== null && editingIndex >= 0 && editingIndex < outcomes.length) {
      updated = [...outcomes];
      updated[editingIndex] = newOutcome;
    } else {
      updated = [...outcomes, newOutcome];
    }

    onChange(updated);
    resetDraft();
  };

  const getStatusBadgeClass = (status: OutcomeStatus) => {
    switch (status) {
      case OutcomeStatus.Death:
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case OutcomeStatus.Discharged:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case OutcomeStatus.StagedPCI:
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case OutcomeStatus.Readmitted:
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case OutcomeStatus.FollowUp:
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  return (
    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-indigo-600" /> Follow-Up & Clinical Outcomes Log
        </label>
        <span className="text-[10px] font-bold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-full">
          {outcomes.length} {outcomes.length === 1 ? 'Entry' : 'Entries'}
        </span>
      </div>

      {/* List of logged follow-up notes */}
      {outcomes.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {outcomes.map((item, idx) => (
            <div 
              key={idx} 
              className={`p-3 bg-white rounded-lg border transition-all text-xs space-y-1.5 ${
                editingIndex === idx ? 'border-indigo-500 ring-2 ring-indigo-500/10 shadow-sm' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getStatusBadgeClass(item.status)}`}>
                    {item.status}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 font-semibold flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5 text-slate-400" />
                    {formatDateDMY ? formatDateDMY(item.date) : item.date}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(idx)}
                    className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                    title="Edit follow-up note"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(idx)}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                    title="Delete follow-up note"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <p className="text-slate-700 text-xs font-medium whitespace-pre-wrap leading-relaxed pt-0.5">
                {item.notes}
              </p>

              {item.photoUrl && (
                <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center gap-2">
                  <img 
                    src={item.photoUrl} 
                    alt="Outcome Attachment" 
                    className="h-14 w-auto max-w-[120px] object-cover rounded-lg border border-slate-200 shadow-2xs cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => onPreviewPhoto && onPreviewPhoto(item.photoUrl!, `${item.status} Photo (${item.date})`)}
                  />
                  <span className="text-[9px] text-slate-400 font-medium flex items-center gap-1">
                    <ImageIcon className="w-3 h-3 text-slate-400" /> Click to view
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Entry Add / Edit Form */}
      <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
            <FileText className="w-3 h-3 text-indigo-500" />
            {editingIndex !== null ? 'Edit Follow-Up Note' : 'Log New Follow-Up Note'}
          </span>
          {editingIndex !== null && (
            <button
              type="button"
              onClick={resetDraft}
              className="text-[10px] text-slate-500 hover:text-slate-700 font-bold underline cursor-pointer flex items-center gap-0.5"
            >
              <X className="w-3 h-3" /> Cancel Edit
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Status Selector */}
          <div>
            <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Outcome Status
            </label>
            <select
              value={draftStatus}
              onChange={(e) => setDraftStatus(e.target.value as OutcomeStatus)}
              className="input-field py-1.5 text-xs bg-slate-50 font-semibold"
            >
              {Object.values(OutcomeStatus).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Date Field */}
          <div>
            <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Date (DD_MM_YYYY)
            </label>
            <input
              type="text"
              placeholder="DD_MM_YYYY"
              value={draftDate}
              onChange={(e) => setDraftDate(formatRawDateInput(e.target.value))}
              className="input-field py-1.5 text-xs bg-slate-50 font-mono"
            />
          </div>
        </div>

        {/* Progress Notes Textarea */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">
              Follow-Up Clinical Progress Notes
            </label>
            <VoiceInputButton
              onTranscript={(text) => {
                setDraftNotes(prev => prev ? prev + ' ' + text : text);
                setErrorMsg('');
              }}
            />
          </div>
          <textarea
            placeholder="Enter follow-up clinical status, symptoms, medication adjustments, or recovery progress..."
            value={draftNotes}
            onChange={(e) => {
              setDraftNotes(e.target.value);
              if (e.target.value.trim()) setErrorMsg('');
            }}
            className="input-field min-h-[64px] py-1.5 text-xs resize-none bg-slate-50"
          />
        </div>

        {/* Photo Upload Field for Staged PCI / Follow-Up */}
        <PhotoUploadField 
          label={`${draftStatus} Photo`}
          value={draftPhotoUrl}
          onUpload={async (e) => {
            const file = e.target.files?.[0];
            if (file) {
              try {
                const resized = await downscaleImage(file, 1000);
                setDraftPhotoUrl(resized);
              } catch (err) {
                const reader = new FileReader();
                reader.onloadend = () => {
                  if (typeof reader.result === 'string') {
                    setDraftPhotoUrl(reader.result);
                  }
                };
                reader.readAsDataURL(file);
              }
            }
          }}
          onRemove={() => setDraftPhotoUrl('')}
        />

        {errorMsg && (
          <p className="text-[10px] font-bold text-rose-600 flex items-center gap-1 animate-fadeIn">
            <AlertCircle className="w-3 h-3" /> {errorMsg}
          </p>
        )}

        {/* Action Button */}
        <button
          type="button"
          onClick={handleSave}
          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
        >
          {editingIndex !== null ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" /> Update Follow-Up Note
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" /> Add Follow-Up Note
            </>
          )}
        </button>
      </div>
    </div>
  );
};
