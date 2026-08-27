import { PrintPreset } from '../types';
import { getCurrentUserId } from './patientService';

const LOCAL_PRESETS_KEY = 'print_layout_presets_local';

export async function getPresets(): Promise<PrintPreset[]> {
  let localPresets: PrintPreset[] = [];
  try {
    const raw = localStorage.getItem(LOCAL_PRESETS_KEY);
    if (raw) {
      localPresets = JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to parse local presets:', e);
  }
  return localPresets;
}

export async function savePreset(presetData: Omit<PrintPreset, 'createdBy' | 'createdAt'> & { id?: string }): Promise<PrintPreset> {
  const userId = getCurrentUserId() || 'offline_user';
  const newId = presetData.id || `local_${Date.now()}`;
  
  const preset: PrintPreset = {
    ...presetData,
    id: newId,
    createdBy: userId,
    createdAt: new Date().toISOString()
  };

  let localPresets: PrintPreset[] = [];
  try {
    const raw = localStorage.getItem(LOCAL_PRESETS_KEY);
    if (raw) {
      localPresets = JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to parse local presets:', e);
  }

  const existingIdx = localPresets.findIndex(p => p.id === newId || (p.name.toLowerCase() === preset.name.toLowerCase()));
  if (existingIdx >= 0) {
    localPresets[existingIdx] = preset;
  } else {
    localPresets.unshift(preset);
  }
  localStorage.setItem(LOCAL_PRESETS_KEY, JSON.stringify(localPresets));

  return preset;
}

export async function deletePreset(id: string): Promise<void> {
  let localPresets: PrintPreset[] = [];
  try {
    const raw = localStorage.getItem(LOCAL_PRESETS_KEY);
    if (raw) {
      localPresets = JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to parse local presets:', e);
  }

  const updated = localPresets.filter(p => p.id !== id);
  localStorage.setItem(LOCAL_PRESETS_KEY, JSON.stringify(updated));
}
