import React from 'react';
import { motion } from 'motion/react';
import { Camera, Plus, Upload, Crop, Trash2, Check, Loader2, Sparkles, Search } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DeviceType } from '../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 1. PhotoUploadField
interface PhotoUploadFieldProps {
  label: string;
  value: string;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  onCrop?: () => void;
  onAnalyze?: (url: string) => void;
  isAnalyzing?: boolean;
}

export const PhotoUploadField: React.FC<PhotoUploadFieldProps> = React.memo(({ 
  label, 
  value, 
  onUpload, 
  onRemove, 
  onCrop, 
  onAnalyze, 
  isAnalyzing 
}) => {
  const isPlaceholder = !value || value.includes('placeholder') || value === '';
  const displayValue = isPlaceholder ? '' : value;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="label">{label}</label>
        {displayValue && onAnalyze && (
          <button 
            type="button"
            onClick={() => onAnalyze(displayValue)}
            disabled={isAnalyzing}
            className="text-[9px] font-bold text-primary flex items-center gap-1 hover:underline disabled:opacity-50"
          >
            {isAnalyzing ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Sparkles className="w-2.5 h-2.5" />}
            AI Analyze
          </button>
        )}
      </div>

      {!displayValue ? (
        <div className="grid grid-cols-2 gap-2.5 mt-1">
          {/* Native label association opens camera/gallery natively with 100% reliability on Android */}
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 rounded-xl cursor-pointer transition-all p-2 h-20 w-full active:scale-98 select-none">
            <Camera className="w-5 h-5 text-slate-500 mb-1" />
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Camera</span>
            <input 
              type="file" 
              className="hidden" 
              accept="image/*" 
              capture="environment" 
              onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
              onChange={onUpload} 
            />
          </label>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 rounded-xl cursor-pointer transition-all p-2 h-20 w-full active:scale-98 select-none">
            <Plus className="w-5 h-5 text-slate-500 mb-1" />
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Gallery</span>
            <input 
              type="file" 
              className="hidden" 
              accept="image/*" 
              onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
              onChange={onUpload} 
            />
          </label>
        </div>
      ) : (
        <div className="mt-1 space-y-2">
          {/* Main Attached Photo Frame */}
          <div className="relative rounded-xl overflow-hidden border border-border bg-slate-100 flex justify-center items-center h-32 group">
            <img src={displayValue} className="w-full h-full object-cover" alt={label} />
            
            <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 bg-primary text-white text-[8px] font-bold uppercase rounded-md shadow-sm z-20">
              Attached
            </div>

            {/* Quick action tooltip on desktop hover */}
            <div className="hidden md:flex absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity items-center justify-center pointer-events-none z-10">
              <span className="text-[10px] text-white font-extrabold uppercase tracking-wider bg-black/40 px-2 py-1 rounded-md backdrop-blur-sm">
                Use controls below to adjust/replace
              </span>
            </div>
          </div>

          {/* Touch-optimized Control Grid below the image with direct native input fields embedded inside labels */}
          <div className="grid grid-cols-4 gap-2">
            <label 
              className="flex flex-col items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-1 rounded-lg border border-slate-200/80 active:scale-95 transition-all cursor-pointer min-h-[44px] select-none" 
              title="Retake with Camera"
            >
              <Camera className="w-4 h-4 text-slate-600 mb-0.5" />
              <span className="text-[8px] font-extrabold uppercase tracking-wider text-slate-500">Retake</span>
              <input 
                type="file" 
                className="hidden" 
                accept="image/*" 
                capture="environment" 
                onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                onChange={onUpload} 
              />
            </label>

            <label 
              className="flex flex-col items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-1 rounded-lg border border-slate-200/80 active:scale-95 transition-all cursor-pointer min-h-[44px] select-none" 
              title="Replace from Gallery"
            >
              <Upload className="w-4 h-4 text-slate-600 mb-0.5" />
              <span className="text-[8px] font-extrabold uppercase tracking-wider text-slate-500">Replace</span>
              <input 
                type="file" 
                className="hidden" 
                accept="image/*" 
                onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                onChange={onUpload} 
              />
            </label>

            {onCrop ? (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCrop(); }}
                className="flex flex-col items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-1 rounded-lg border border-slate-200/80 active:scale-95 transition-all cursor-pointer min-h-[44px]"
                title="Crop Image"
              >
                <Crop className="w-4 h-4 text-slate-600 mb-0.5" />
                <span className="text-[8px] font-extrabold uppercase tracking-wider text-slate-500">Crop</span>
              </button>
            ) : (
              <div className="bg-slate-50 border border-slate-100 rounded-lg min-h-[44px]" />
            )}

            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
              className="flex flex-col items-center justify-center bg-red-50 hover:bg-red-100 text-red-700 py-2 px-1 rounded-lg border border-red-150 active:scale-95 transition-all cursor-pointer min-h-[44px]"
              title="Delete Photo"
            >
              <Trash2 className="w-4 h-4 text-red-600 mb-0.5" />
              <span className="text-[8px] font-extrabold uppercase tracking-wider text-red-600">Delete</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

PhotoUploadField.displayName = 'PhotoUploadField';


// 2. MultiSelector
interface MultiSelectorProps {
  options: any[];
  selected: any[];
  onToggle: (val: any) => void;
  color?: 'primary' | 'red' | 'blue' | 'green' | 'orange';
}

export const MultiSelector: React.FC<MultiSelectorProps> = React.memo(({ 
  options = [], 
  selected = [], 
  onToggle, 
  color = 'primary' 
}) => {
  const colorMap = {
    primary: "border-primary text-primary",
    red: "border-red-500 text-red-600",
    blue: "border-blue-500 text-blue-600",
    green: "border-green-600 text-green-600",
    orange: "border-orange-500 text-orange-600"
  };

  const bgMap = {
    primary: "bg-primary/5",
    red: "bg-red-50",
    blue: "bg-blue-50",
    green: "bg-green-50",
    orange: "bg-orange-50"
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map(option => {
        const isSelected = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            className={cn(
              "relative flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs sm:text-[10px] font-bold uppercase transition-all duration-200 text-left overflow-hidden",
              isSelected 
                ? cn("border-2 shadow-sm", colorMap[color], bgMap[color]) 
                : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 shadow-sm"
            )}
          >
            <div className={cn(
              "w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors border",
              isSelected ? cn("bg-current border-transparent") : "bg-white border-slate-300"
            )}>
              {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </div>
            <span className="truncate">{option}</span>
            {isSelected && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 pointer-events-none"
                style={{ backgroundColor: 'currentColor' }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
});

MultiSelector.displayName = 'MultiSelector';


// 3. DetailPhotoField
interface DetailPhotoFieldProps {
  label: string;
  url?: string;
  onPreview?: (url: string, label: string) => void;
}

export const DetailPhotoField: React.FC<DetailPhotoFieldProps> = React.memo(({ 
  label, 
  url, 
  onPreview 
}) => {
  if (!url || url.includes('placeholder')) return null;
  return (
    <div>
      <label className="label">{label}</label>
      <div 
        className="mt-2 rounded-xl overflow-hidden shadow-inner border border-border group relative cursor-pointer" 
        onClick={() => {
          if (onPreview) {
            onPreview(url, label);
          } else {
            window.open(url);
          }
        }}
      >
        <img src={url} className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
        <div className="absolute inset-0 bg-slate-900/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Search className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
});

DetailPhotoField.displayName = 'DetailPhotoField';


// 3b. MultiDetailPhotoField
interface MultiDetailPhotoFieldProps {
  label: string;
  urls?: string[];
  singleUrl?: string;
  onPreview?: (url: string, label: string) => void;
}

export const MultiDetailPhotoField: React.FC<MultiDetailPhotoFieldProps> = React.memo(({
  label,
  urls,
  singleUrl,
  onPreview
}) => {
  const photoList = (urls && urls.length > 0) ? urls : (singleUrl ? [singleUrl] : []);
  const validPhotos = photoList.filter(u => u && !u.includes('placeholder'));
  if (validPhotos.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="label">{label}</label>
        {validPhotos.length > 1 && (
          <span className="text-[9px] font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase">
            {validPhotos.length} Photos
          </span>
        )}
      </div>
      <div className={`grid gap-2 ${validPhotos.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {validPhotos.map((url, idx) => {
          const photoTitle = validPhotos.length > 1 ? `${label} #${idx + 1}` : label;
          return (
            <div 
              key={idx}
              className="rounded-xl overflow-hidden shadow-xs border border-border group relative cursor-pointer bg-slate-100" 
              onClick={() => {
                if (onPreview) {
                  onPreview(url, photoTitle);
                } else {
                  window.open(url);
                }
              }}
            >
              <img src={url} className="w-full h-36 object-cover group-hover:scale-105 transition-transform duration-300" referrerPolicy="no-referrer" alt={photoTitle} />
              <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 text-white text-[8px] font-extrabold uppercase rounded backdrop-blur-xs">
                {validPhotos.length > 1 ? `#${idx + 1}` : 'Attached'}
              </div>
              <div className="absolute inset-0 bg-slate-900/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Search className="w-5 h-5 text-white" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

MultiDetailPhotoField.displayName = 'MultiDetailPhotoField';


// 1b. MultiPhotoUploadField for multiple procedures/photos (PCI Report, Imaging Photo, etc.)
interface MultiPhotoUploadFieldProps {
  label: string;
  photos: string[];
  onUpload: (e: React.ChangeEvent<HTMLInputElement>, replaceIndex?: number) => void;
  onRemove: (index: number) => void;
  onCrop?: (index: number, url: string) => void;
  onPreview?: (url: string, title: string) => void;
}

export const MultiPhotoUploadField: React.FC<MultiPhotoUploadFieldProps> = React.memo(({
  label,
  photos = [],
  onUpload,
  onRemove,
  onCrop,
  onPreview
}) => {
  const validPhotos = photos.filter(p => p && !p.includes('placeholder'));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="label">{label}</label>
        {validPhotos.length > 0 && (
          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
            {validPhotos.length} {validPhotos.length === 1 ? 'Photo' : 'Photos'} Attached
          </span>
        )}
      </div>

      {validPhotos.length === 0 ? (
        <div className="grid grid-cols-2 gap-2.5 mt-1">
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 rounded-xl cursor-pointer transition-all p-2 h-20 w-full active:scale-98 select-none">
            <Camera className="w-5 h-5 text-slate-500 mb-1" />
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Camera</span>
            <input 
              type="file" 
              className="hidden" 
              accept="image/*" 
              capture="environment" 
              onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
              onChange={(e) => onUpload(e)} 
            />
          </label>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 rounded-xl cursor-pointer transition-all p-2 h-20 w-full active:scale-98 select-none">
            <Plus className="w-5 h-5 text-slate-500 mb-1" />
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Gallery</span>
            <input 
              type="file" 
              className="hidden" 
              accept="image/*" 
              multiple
              onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
              onChange={(e) => onUpload(e)} 
            />
          </label>
        </div>
      ) : (
        <div className="space-y-3 mt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {validPhotos.map((photoUrl, index) => (
              <div key={index} className="bg-slate-50 border border-slate-200 rounded-xl p-2 space-y-2 relative group">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-extrabold uppercase text-slate-500 tracking-wider flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[8px] font-black">
                      {index + 1}
                    </span>
                    Photo #{index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors cursor-pointer"
                    title="Remove photo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div 
                  className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100 h-28 flex items-center justify-center cursor-pointer group/img"
                  onClick={() => onPreview && onPreview(photoUrl, `${label} #${index + 1}`)}
                >
                  <img src={photoUrl} className="w-full h-full object-cover group-hover/img:scale-105 transition-transform" alt={`${label} ${index + 1}`} />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                    <Search className="w-5 h-5 text-white" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <label 
                    className="flex items-center justify-center gap-1 bg-white hover:bg-slate-100 text-slate-700 py-1.5 px-1 rounded-lg border border-slate-200 text-[8px] font-extrabold uppercase tracking-wider cursor-pointer active:scale-95 transition-all select-none"
                    title="Retake photo"
                  >
                    <Camera className="w-3 h-3 text-slate-500" />
                    <span>Retake</span>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*" 
                      capture="environment" 
                      onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                      onChange={(e) => onUpload(e, index)} 
                    />
                  </label>

                  <label 
                    className="flex items-center justify-center gap-1 bg-white hover:bg-slate-100 text-slate-700 py-1.5 px-1 rounded-lg border border-slate-200 text-[8px] font-extrabold uppercase tracking-wider cursor-pointer active:scale-95 transition-all select-none"
                    title="Replace photo"
                  >
                    <Upload className="w-3 h-3 text-slate-500" />
                    <span>Replace</span>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*" 
                      onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                      onChange={(e) => onUpload(e, index)} 
                    />
                  </label>

                  {onCrop ? (
                    <button
                      type="button"
                      onClick={() => onCrop(index, photoUrl)}
                      className="flex items-center justify-center gap-1 bg-white hover:bg-slate-100 text-slate-700 py-1.5 px-1 rounded-lg border border-slate-200 text-[8px] font-extrabold uppercase tracking-wider cursor-pointer active:scale-95 transition-all"
                      title="Crop photo"
                    >
                      <Crop className="w-3 h-3 text-slate-500" />
                      <span>Crop</span>
                    </button>
                  ) : (
                    <div />
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="p-2 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1 pl-1">
              <Plus className="w-3.5 h-3.5" /> Add Additional {label} Photo
            </span>
            <div className="flex items-center gap-1.5">
              <label className="flex items-center gap-1 bg-white hover:bg-slate-50 text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 text-[9px] font-extrabold uppercase cursor-pointer active:scale-95 transition-all shadow-xs select-none">
                <Camera className="w-3.5 h-3.5 text-primary" />
                <span>Camera</span>
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/*" 
                  capture="environment" 
                  onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                  onChange={(e) => onUpload(e)} 
                />
              </label>

              <label className="flex items-center gap-1 bg-white hover:bg-slate-50 text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 text-[9px] font-extrabold uppercase cursor-pointer active:scale-95 transition-all shadow-xs select-none">
                <Plus className="w-3.5 h-3.5 text-primary" />
                <span>Gallery</span>
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/*" 
                  multiple
                  onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                  onChange={(e) => onUpload(e)} 
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

MultiPhotoUploadField.displayName = 'MultiPhotoUploadField';


// 4. DeviceSelector
interface DeviceSelectorProps {
  devices?: Partial<Record<DeviceType, number>>;
  onChange: (devices: Partial<Record<DeviceType, number>>) => void;
}

export const DeviceSelector: React.FC<DeviceSelectorProps> = React.memo(({ 
  devices = {}, 
  onChange 
}) => {
  const options = Object.values(DeviceType);
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
      {options.map(type => {
        const qty = devices && devices[type] ? devices[type] : 0;
        const hasDevice = qty > 0;
        return (
          <div key={type} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="flex items-center gap-3">
               <button
                type="button"
                onClick={() => {
                  const newDevices = { ...(devices || {}) };
                  if (qty > 0) {
                    delete newDevices[type];
                  } else {
                    newDevices[type] = 1;
                  }
                  onChange(newDevices);
                }}
                className={cn(
                  "w-6 h-6 rounded flex items-center justify-center shrink-0 transition-colors border",
                  hasDevice ? "bg-primary border-transparent text-white" : "bg-white border-slate-300 text-transparent"
                )}
              >
                <Check className="w-4 h-4" strokeWidth={3} />
              </button>
              <span className={cn("text-xs font-bold uppercase tracking-wider", hasDevice ? "text-slate-900" : "text-slate-400")}>
                {type}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Qty:</label>
              <select
                className={cn(
                  "border rounded-lg px-2 py-1 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all",
                  hasDevice ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-slate-50 text-slate-400 border-slate-200"
                )}
                value={qty}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  const newDevices = { ...(devices || {}) };
                  if (val === 0) {
                    delete newDevices[type];
                  } else {
                    newDevices[type] = val;
                  }
                  onChange(newDevices);
                }}
              >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                  <option key={n} value={n}>{n === 0 ? '0 (None)' : n}</option>
                ))}
              </select>
            </div>
          </div>
        );
      })}
    </div>
  );
});

DeviceSelector.displayName = 'DeviceSelector';
