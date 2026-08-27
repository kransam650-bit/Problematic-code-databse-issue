import React, { useState, useEffect } from 'react';
import { Check, Plus, X, Sparkles } from 'lucide-react';
import { DeviceType } from '../types';

export const CUSTOM_STENT_BRANDS_KEY = 'cath_lab_custom_stent_brands';
export const CUSTOM_BRS_BRANDS_KEY = 'cath_lab_custom_brs_brands';
export const CUSTOM_DEB_BRANDS_KEY = 'cath_lab_custom_deb_brands';

export const STANDARD_STENTS = [
  { brand: 'Xience Sierra (Everolimus-eluting)', manufacturer: 'Abbott' },
  { brand: 'Xience Skypoint (Everolimus-eluting)', manufacturer: 'Abbott' },
  { brand: 'Resolute Onyx (Zotarolimus-eluting)', manufacturer: 'Medtronic' },
  { brand: 'Resolute Onyx ONE (Zotarolimus-eluting)', manufacturer: 'Medtronic' },
  { brand: 'Synergy (Everolimus-eluting, Bioabsorbable Polymer)', manufacturer: 'Boston Scientific' },
  { brand: 'Synergy Megatron (Everolimus-eluting, Large Vessel)', manufacturer: 'Boston Scientific' },
  { brand: 'Orsiro (Sirolimus-eluting)', manufacturer: 'Biotronik' },
  { brand: 'Promus Premier (Everolimus-eluting)', manufacturer: 'Boston Scientific' },
  { brand: 'Ultimaster Tansei (Sirolimus-eluting)', manufacturer: 'Terumo' },
  { brand: 'Supraflex Cruz (Sirolimus-eluting)', manufacturer: 'SMT' }
];

export const STANDARD_BRS = [
  { brand: 'Absorb BVS (Everolimus-eluting)', manufacturer: 'Abbott' },
  { brand: 'Magmaris (Sirolimus-eluting, Bioresorbable Magnesium)', manufacturer: 'Biotronik' },
  { brand: 'MeRes100 (Sirolimus-eluting)', manufacturer: 'Meril' },
  { brand: 'NeoVas (Sirolimus-eluting)', manufacturer: 'Lepu Medical' },
  { brand: 'Firesorb (Sirolimus-eluting)', manufacturer: 'MicroPort' }
];

export const STANDARD_DEB = [
  { brand: 'SeQuent Please NEO (Paclitaxel-eluting)', manufacturer: 'B. Braun' },
  { brand: 'Prevail (Paclitaxel-eluting)', manufacturer: 'Medtronic' },
  { brand: 'Agent (Paclitaxel-eluting)', manufacturer: 'Boston Scientific' },
  { brand: 'MagicTouch (Sirolimus-eluting)', manufacturer: 'Concept Medical' },
  { brand: 'Pantera Lux (Paclitaxel-eluting)', manufacturer: 'Biotronik' },
  { brand: 'Restore (Paclitaxel-eluting)', manufacturer: 'Cardionovum' },
  { brand: 'In.Pact Falcon (Paclitaxel-eluting)', manufacturer: 'Medtronic' }
];

const getStorageKeyForType = (type: DeviceType): string => {
  switch (type) {
    case DeviceType.BRS:
      return CUSTOM_BRS_BRANDS_KEY;
    case DeviceType.DEB:
      return CUSTOM_DEB_BRANDS_KEY;
    case DeviceType.DES:
    default:
      return CUSTOM_STENT_BRANDS_KEY;
  }
};

const getStandardCatalogForType = (type: DeviceType) => {
  switch (type) {
    case DeviceType.BRS:
      return STANDARD_BRS;
    case DeviceType.DEB:
      return STANDARD_DEB;
    case DeviceType.DES:
    default:
      return STANDARD_STENTS;
  }
};

export const getSavedBrandsForType = (type: DeviceType): string[] => {
  try {
    const key = getStorageKeyForType(type);
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error(`Error loading custom ${type} brands:`, e);
  }
  return [];
};

export const saveCustomBrandForType = (type: DeviceType, newBrand: string): string[] => {
  const existing = getSavedBrandsForType(type);
  const trimmed = newBrand.trim();
  if (!trimmed) return existing;

  const standardList = getStandardCatalogForType(type);
  const exists = existing.some(b => b.toLowerCase() === trimmed.toLowerCase()) ||
    standardList.some(s => s.brand.toLowerCase() === trimmed.toLowerCase());

  if (!exists) {
    const updated = [...existing, trimmed];
    try {
      const key = getStorageKeyForType(type);
      localStorage.setItem(key, JSON.stringify(updated));
      window.dispatchEvent(new Event('custom-device-brands-updated'));
    } catch (e) {
      console.error(`Error saving custom ${type} brand:`, e);
    }
    return updated;
  }
  return existing;
};

// Backwards compatibility helpers for Stent (DES)
export const getSavedStentBrands = (): string[] => getSavedBrandsForType(DeviceType.DES);
export const saveCustomStentBrand = (newBrand: string): string[] => saveCustomBrandForType(DeviceType.DES, newBrand);

interface DeviceCatalogSelectorProps {
  deviceType?: DeviceType;
  details?: string[];
  stentDetails?: string[]; // for backwards compatibility
  devices?: Partial<Record<DeviceType, number>>;
  onUpdate: (details: string[], devices: Partial<Record<DeviceType, number>>) => void;
  onToast?: (message: string, type: 'success' | 'error') => void;
  brandSelectId?: string;
  titleOverride?: string;
}

export const DeviceCatalogSelector: React.FC<DeviceCatalogSelectorProps> = ({
  deviceType = DeviceType.DES,
  details,
  stentDetails,
  devices = {},
  onUpdate,
  onToast,
  brandSelectId,
  titleOverride
}) => {
  const activeDetails = details ?? stentDetails ?? [];
  const standardCatalog = getStandardCatalogForType(deviceType);
  const [customBrands, setCustomBrands] = useState<string[]>(getSavedBrandsForType(deviceType));
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedDia, setSelectedDia] = useState<string>('');
  const [selectedLen, setSelectedLen] = useState<string>('');
  const [isAddingNewBrand, setIsAddingNewBrand] = useState<boolean>(false);
  const [newBrandName, setNewBrandName] = useState<string>('');

  useEffect(() => {
    const handleUpdate = () => {
      setCustomBrands(getSavedBrandsForType(deviceType));
    };
    window.addEventListener('custom-device-brands-updated', handleUpdate);
    window.addEventListener('custom-stent-brands-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('custom-device-brands-updated', handleUpdate);
      window.removeEventListener('custom-stent-brands-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [deviceType]);

  const handleBrandSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '__ADD_NEW__') {
      setIsAddingNewBrand(true);
      setSelectedBrand('');
    } else {
      setIsAddingNewBrand(false);
      setSelectedBrand(val);
    }
  };

  const handleSaveNewBrand = () => {
    const trimmed = newBrandName.trim();
    if (!trimmed) {
      if (onToast) onToast(`Please enter a valid ${deviceType} name`, 'error');
      return;
    }

    const updatedCustoms = saveCustomBrandForType(deviceType, trimmed);
    setCustomBrands(updatedCustoms);
    setSelectedBrand(trimmed);
    setNewBrandName('');
    setIsAddingNewBrand(false);
    if (onToast) onToast(`Added "${trimmed}" to ${deviceType} Catalog`, 'success');
  };

  const handleAddDevice = () => {
    if (!selectedBrand || !selectedDia || !selectedLen) {
      if (onToast) onToast('Please select Brand, Diameter, and Length', 'error');
      return;
    }

    const cleanBrandName = selectedBrand.split(' (')[0].trim();
    const specStr = `${cleanBrandName} ${selectedDia}x${selectedLen}mm`;

    if (activeDetails.includes(specStr)) {
      if (onToast) onToast(`${deviceType} details already added`, 'error');
      return;
    }

    const updatedList = [...activeDetails, specStr];
    const updatedDevices = {
      ...devices,
      [deviceType]: updatedList.length
    };

    onUpdate(updatedList, updatedDevices);

    // Reset picks
    setSelectedBrand('');
    setSelectedDia('');
    setSelectedLen('');
  };

  const handleRemoveDevice = (specToRemove: string) => {
    const updatedList = activeDetails.filter(s => s !== specToRemove);
    const updatedDevices = { ...devices };
    if (updatedList.length > 0) {
      updatedDevices[deviceType] = updatedList.length;
    } else {
      delete updatedDevices[deviceType];
    }
    onUpdate(updatedList, updatedDevices);
  };

  const catalogTitle = titleOverride || `Standardized ${deviceType} Catalog`;
  const addButtonLabel = deviceType === DeviceType.DES ? 'Add Stent Name' : deviceType === DeviceType.BRS ? 'Add BRS Name' : 'Add DEB Name';
  const itemTypeTag = deviceType === DeviceType.DES ? 'Stent' : deviceType === DeviceType.BRS ? 'BRS' : 'DEB';

  return (
    <div className="space-y-2 mt-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/60">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5 text-blue-500" /> {catalogTitle}
        </label>
        {!isAddingNewBrand && (
          <button
            type="button"
            onClick={() => setIsAddingNewBrand(true)}
            className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 hover:bg-blue-100 transition-colors"
          >
            <Plus className="w-3 h-3" /> {addButtonLabel}
          </button>
        )}
      </div>

      {isAddingNewBrand ? (
        <div className="p-2.5 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-blue-800 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-blue-600" /> New {itemTypeTag} Brand / Model Name
            </span>
            <button
              type="button"
              onClick={() => {
                setIsAddingNewBrand(false);
                setNewBrandName('');
              }}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={newBrandName}
              onChange={(e) => setNewBrandName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveNewBrand();
                }
              }}
              placeholder={`e.g. ${itemTypeTag} Model Name`}
              className="input-field w-full text-xs bg-white"
              autoFocus
            />
            <button
              type="button"
              onClick={handleSaveNewBrand}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-2xs shrink-0 transition-colors"
            >
              Save Brand
            </button>
          </div>
          <p className="text-[9px] text-blue-600/80 italic">
            Saved brands will automatically be available in future sessions.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <select
              id={brandSelectId}
              className="input-field w-full text-xs"
              value={selectedBrand}
              onChange={handleBrandSelectChange}
            >
              <option value="">Select Brand</option>
              <optgroup label="Standard Catalog">
                {standardCatalog.map(s => (
                  <option key={s.brand} value={s.brand}>{s.brand}</option>
                ))}
              </optgroup>
              {customBrands.length > 0 && (
                <optgroup label="Custom Added Brands">
                  {customBrands.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </optgroup>
              )}
              <option value="__ADD_NEW__">+ Add Custom {itemTypeTag} Name...</option>
            </select>
          </div>
          <div>
            <select
              className="input-field w-full text-xs"
              value={selectedDia}
              onChange={(e) => setSelectedDia(e.target.value)}
            >
              <option value="">Dia (mm)</option>
              {['2.00', '2.25', '2.50', '2.75', '3.00', '3.25', '3.50', '4.00', '4.50'].map(d => (
                <option key={d} value={d}>{d} mm</option>
              ))}
            </select>
          </div>
          <div>
            <select
              className="input-field w-full text-xs"
              value={selectedLen}
              onChange={(e) => setSelectedLen(e.target.value)}
            >
              <option value="">Len (mm)</option>
              {['8', '12', '15', '18', '22', '24', '28', '30', '33', '38', '44', '48'].map(l => (
                <option key={l} value={l}>{l} mm</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {!isAddingNewBrand && (
        <button
          type="button"
          onClick={handleAddDevice}
          className="w-full text-center py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 uppercase tracking-widest transition-colors cursor-pointer"
        >
          + Add {itemTypeTag} to Catalog
        </button>
      )}

      {activeDetails && activeDetails.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-slate-200/50">
          {activeDetails.map(sd => (
            <span key={sd} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-700 text-[10px] font-bold rounded-lg uppercase tracking-wider animate-fadeIn">
              {sd}
              <button
                type="button"
                onClick={() => handleRemoveDevice(sd)}
                className="hover:bg-blue-100 p-0.5 rounded text-blue-500"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export const StentCatalogSelector: React.FC<DeviceCatalogSelectorProps> = (props) => {
  return <DeviceCatalogSelector deviceType={DeviceType.DES} {...props} />;
};
