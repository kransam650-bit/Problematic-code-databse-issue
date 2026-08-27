import React, { useState } from 'react';
import { Bookmark, Save, Trash2, Loader2 } from 'lucide-react';
import { PrintPreset } from '../types';

interface PrintPresetManagerProps {
  presets: PrintPreset[];
  presetsLoading: boolean;
  selectedPresetId: string;
  onSelectPreset: (presetId: string) => void;
  onSavePreset: (name: string) => Promise<void>;
  onDeletePreset: (presetId: string) => Promise<void>;
}

export function PrintPresetManager({
  presets,
  presetsLoading,
  selectedPresetId,
  onSelectPreset,
  onSavePreset,
  onDeletePreset
}: PrintPresetManagerProps) {
  const [newPresetName, setNewPresetName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const activePreset = presets.find(p => p.id === selectedPresetId);

  const handleUpdateCurrent = async () => {
    if (!activePreset) return;
    setIsSaving(true);
    try {
      await onSavePreset(activePreset.name);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;
    setIsSaving(true);
    try {
      await onSavePreset(newPresetName.trim());
      setNewPresetName('');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPresetId) return;
    if (confirm(`Are you sure you want to delete preset "${activePreset?.name || 'Selected'}"?`)) {
      setIsDeleting(true);
      try {
        await onDeletePreset(selectedPresetId);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <div className="space-y-3.5 p-4 bg-slate-50 rounded-2xl border border-slate-200/80 shadow-xs">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
          <Bookmark className="w-3.5 h-3.5 text-blue-600" /> Print Layout Presets
        </label>
        {presetsLoading && (
          <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
        )}
      </div>

      {/* Preset Selector */}
      <div className="flex items-center gap-2">
        <select
          id="preset-select"
          value={selectedPresetId}
          onChange={(e) => {
            onSelectPreset(e.target.value);
            setNewPresetName('');
          }}
          className="flex-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
        >
          <option value="">Default System Layout</option>
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>

        {selectedPresetId && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            title="Delete Selected Preset"
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer border border-transparent hover:border-red-100"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Quick Update Button if a preset is selected */}
      {activePreset ? (
        <div className="space-y-2 pt-1 border-t border-slate-200/60">
          <button
            type="button"
            onClick={handleUpdateCurrent}
            disabled={isSaving}
            className="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Save Changes to "{activePreset.name}"
          </button>

          <form onSubmit={handleSave} className="pt-1">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
              Or save as new template:
            </span>
            <div className="relative">
              <input
                type="text"
                placeholder="New Template Name..."
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                className="w-full text-xs font-medium pl-3 pr-10 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                type="submit"
                disabled={isSaving || !newPresetName.trim()}
                title="Save as New Preset"
                className="absolute right-1 top-1 bottom-1 px-2 text-blue-600 hover:text-blue-700 disabled:text-slate-300 rounded transition-all active:scale-95 cursor-pointer flex items-center justify-center font-bold text-xs"
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Save New Preset Form when Default Layout is active */
        <form onSubmit={handleSave} className="space-y-1">
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
            Save current options as template:
          </span>
          <div className="relative">
            <input
              type="text"
              placeholder="e.g. Concise Cath Summary..."
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              className="w-full text-xs font-medium pl-3 pr-10 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              type="submit"
              disabled={isSaving || !newPresetName.trim()}
              title="Save Preset"
              className="absolute right-1 top-1 bottom-1 px-2.5 text-blue-600 hover:text-blue-700 disabled:text-slate-300 rounded transition-all active:scale-95 cursor-pointer flex items-center justify-center font-bold text-xs gap-1"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
