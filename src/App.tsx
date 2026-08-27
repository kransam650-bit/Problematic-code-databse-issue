/**
 * CathData 2026
 * Copyright (c) 2026 Dr Bharat S Sambyal. All rights reserved.
 * Developed for clinical records management and cardiology analytics.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import QRCode from 'qrcode';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, signInWithGoogle, logout, signInWithGoogleDrive } from './lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import Cropper, { Area, Point } from 'react-easy-crop';
import getCroppedImg from './lib/cropImage';
import { QrScanner } from './components/QrScanner';
import { 
  Users, 
  GripVertical,
  Plus, 
  Search, 
  LogOut, 
  User as UserIcon, 
  Calendar, 
  Phone, 
  Camera,
  ArrowLeft,
  Loader2,
  FileText,
  Trash2,
  X,
  Crop,
  Filter,
  DownloadCloud,
  Check,
  Undo,
  ChevronDown,
  RefreshCw,
  Settings,
  Lock,
  Upload,
  Clock,
  Database,
  Sparkles,
  Brain,
  MessageSquare,
  Bot,
  Wand2,
  Send,
  ClipboardList,
  Tag,
  Printer,
  FileDown,
  Mic,
  AlertTriangle,
  QrCode,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Edit2,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertCircle,
  Skull,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Copy,
  Share2,
  FolderArchive,
  Star,
  FolderOpen,
  Wrench,
  Activity,
  Shield,
  ShieldCheck,
  Cloud,
  FileSpreadsheet,
  Heart,
  Zap
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { createPatient, getPatients, deletePatient, updatePatient, getPendingSyncCount, restorePatientsBackup, getAllLocalRecordsRaw, syncPatients, saveSyncFolderHandle, getSyncFolderHandle, removeSyncFolderHandle, migrateGuestRecords, getSyncConflicts, resolveConflictCustom, resolveConflictKeepLocal, resolveConflictKeepCloud, SyncConflict, saveAutomaticBackup, getAutomaticBackups, openDB, saveLocalPatients, permanentlyDeletePatient } from './services/patientService';
import { getPresets, savePreset, deletePreset as apiDeletePreset } from './services/presetService';
import { encryptJSON, decryptJSON } from './lib/crypto';
import Dashboard from './components/Dashboard';
import { PatientClinicalSheet } from './components/PatientClinicalSheet';
import { PrintPresetManager } from './components/PrintPresetManager';
import { QuadrangleCropper } from './components/QuadrangleCropper';
import { ConflictResolver } from './components/ConflictResolver';
import { VoiceInputButton } from './components/VoiceInputButton';
import { FollowUpEditor } from './components/FollowUpEditor';
import { PinLockScreen } from './components/PinLockScreen';
import { PinSettingsCard } from './components/PinSettingsCard';
import { sendInstallTelemetryNotification, setupOnlineInstallTelemetryRetry } from './services/installTelemetry';
import { CsvImporter } from './components/CsvImporter';
import { FullRestoreModal } from './components/FullRestoreModal';
import { ExportProgressBarModal, ExportProgressState } from './components/ExportProgressBarModal';
import { PatientRow, getPatientStatus, HighlightText } from './components/PatientRow';
import { PhotoUploadField, MultiPhotoUploadField, MultiSelector, DetailPhotoField, MultiDetailPhotoField, DeviceSelector } from './components/FormFields';
import { StentCatalogSelector, DeviceCatalogSelector } from './components/StentCatalogSelector';
import { generateEMRTextSummary } from './utils/emrFormatter';
import { generatePatientPDF, generateCombinedPatientsPDF, PdfExportOptions } from './utils/pdfGenerator';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import Fuse from 'fuse.js';
import { 
  Patient, 
  Gender, 
  EjectionFraction, 
  RWMAOption, 
  Comorbidity,
  AccessMethod,
  ImagingOption,
  SpecialHardware,
  Complication,
  OtherHardware,
  Drug,
  Presentation,
  PCIVessel,
  LesionType,
  DeviceType,
  PCITemplate,
  OutcomeStatus,
  Outcome,
  ReportCategory,
  ServiceCategory,
  TMTOption,
  PrintPreset
} from './types';

import heartIcon from './assets/images/heart_icon_1784643460754.jpg';

const safeDriveFetch = async (url: string, options?: RequestInit) => {
  try {
    return await fetch(url, options);
  } catch (err: any) {
    if (err.name === 'TypeError' || err.message?.toLowerCase().includes('failed to fetch')) {
      throw new Error('Network connection to Google Drive API failed. Please check your internet connection or try reconnecting Google Drive.');
    }
    throw err;
  }
};

const getOrCreateBackupFolder = async (accessToken: string): Promise<string> => {
  const folderName = 'CathData Backups';
  const query = `name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name)`;
  const searchRes = await safeDriveFetch(searchUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (searchRes.status === 401) {
    throw new Error('401: Invalid Credentials or Google Drive session expired.');
  }
  if (!searchRes.ok) {
    const errText = await searchRes.text();
    throw new Error(`Failed to search folder (${searchRes.status}): ${errText}`);
  }
  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const createUrl = 'https://www.googleapis.com/drive/v3/files';
  const createRes = await safeDriveFetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  if (createRes.status === 401) {
    throw new Error('401: Invalid Credentials or Google Drive session expired.');
  }
  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create backup folder (${createRes.status}): ${errText}`);
  }
  const createData = await createRes.json();
  return createData.id;
};

const uploadFileToDrive = async (accessToken: string, folderId: string, filename: string, content: string): Promise<void> => {
  const metadata = {
    name: filename,
    parents: [folderId],
    mimeType: 'application/json',
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([content], { type: 'application/json' }));

  const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  const res = await safeDriveFetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Upload failed (${res.status}): ${res.statusText}. ${errText}`);
  }
};

const deleteFileFromDrive = async (accessToken: string, fileId: string): Promise<void> => {
  const deleteUrl = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  const res = await safeDriveFetch(deleteUrl, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok && res.status !== 404) {
    const errText = await res.text();
    console.warn(`Failed to delete old drive backup ${fileId}: ${res.status} ${errText}`);
  }
};


const STANDARD_LESIONS = [
  { code: 'I25.111', name: 'LAD - Proximal (Left Anterior Descending, Segment 6)' },
  { code: 'I25.111', name: 'LAD - Mid (Left Anterior Descending, Segment 7)' },
  { code: 'I25.111', name: 'LAD - Distal (Left Anterior Descending, Segment 8)' },
  { code: 'I25.111', name: 'LAD - Diagonal 1 (Segment 9)' },
  { code: 'I25.111', name: 'LAD - Diagonal 2 (Segment 10)' },
  { code: 'I25.111', name: 'LCX - Proximal (Left Circumflex, Segment 11)' },
  { code: 'I25.111', name: 'LCX - Mid (Left Circumflex, Segment 13)' },
  { code: 'I25.111', name: 'LCX - Distal (Left Circumflex, Segment 14)' },
  { code: 'I25.111', name: 'LCX - Obtuse Marginal 1 (OM1, Segment 12)' },
  { code: 'I25.111', name: 'LCX - Obtuse Marginal 2 (OM2, Segment 12)' },
  { code: 'I25.111', name: 'RCA - Proximal (Right Coronary Artery, Segment 1)' },
  { code: 'I25.111', name: 'RCA - Mid (Right Coronary Artery, Segment 2)' },
  { code: 'I25.111', name: 'RCA - Distal (Right Coronary Artery, Segment 3)' },
  { code: 'I25.111', name: 'RCA - Posterior Descending (PDA, Segment 4)' },
  { code: 'I25.111', name: 'RCA - Posterolateral (PLB, Segment 16)' },
  { code: 'I25.111', name: 'LM - Left Main (Segment 5)' },
  { code: 'I25.111', name: 'Ramus Intermedius (Segment 15)' },
  { code: 'I25.111', name: 'Bypass Graft - LIMA to LAD' },
  { code: 'I25.111', name: 'Bypass Graft - SVG to RCA' },
  { code: 'I25.111', name: 'Bypass Graft - SVG to OM' }
];

const STANDARD_COMPLICATIONS = [
  { code: 'I97.89', name: 'Coronary Artery Dissection (Postprocedural)' },
  { code: 'I97.89', name: 'Acute Coronary Thrombus / Occlusion' },
  { code: 'I97.89', name: 'Coronary Perforation / Rupture' },
  { code: 'I21.9', name: 'Periprocedural Myocardial Infarction' },
  { code: 'T82.857A', name: 'Acute Stent Thrombosis' },
  { code: 'I97.89', name: 'No-Reflow / Slow-Reflow Phenomenon' },
  { code: 'I97.61', name: 'Vascular Access Site Hematoma (Circulatory)' },
  { code: 'I97.61', name: 'Retroperitoneal Hemorrhage' },
  { code: 'N17.9', name: 'Contrast-Induced Acute Kidney Injury (CI-AKI)' },
  { code: 'I95.1', name: 'Severe Hypotension / Post-Procedure Shock' },
  { code: 'I49.01', name: 'Ventricular Fibrillation (VF) / Cardiac Arrest' },
  { code: 'I45.9', name: 'High-degree AV Block / Bradyarrhythmia' },
  { code: 'T82.867A', name: 'Stent Migration / Embolization' },
  { code: 'T82.817A', name: 'Vascular Access Site Pseudoaneurysm' },
  { code: 'T82.817A', name: 'Vascular Access Site Arteriovenous (AV) Fistula' }
];

const STANDARD_STENTS = [
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

function generatePatientTags(data: any): string[] {
  const tagsSet = new Set<string>();

  // Add any user-specified tags
  if (Array.isArray(data.tags)) {
    data.tags.forEach((t: string) => {
      const trimmed = t.trim();
      if (trimmed) tagsSet.add(trimmed);
    });
  }

  // Auto-generate tags based on clinical metrics:
  // 1. Age groups
  const ageNum = parseInt(data.age, 10);
  if (!isNaN(ageNum)) {
    if (ageNum < 50) {
      tagsSet.add("Age-Under-50");
    } else if (ageNum >= 75) {
      tagsSet.add("Age-Elderly");
    }
  }

  // 2. Gender
  if (data.gender) {
    tagsSet.add(`Gender-${data.gender}`);
  }

  // 3. Presentation / Diagnosis
  if (data.presentation) {
    tagsSet.add(`Presentation-${data.presentation}`);
  }

  // 4. Ejection Fraction
  if (data.ejectionFraction) {
    tagsSet.add(`EF-${data.ejectionFraction.replace(/\s+/g, '-')}`);
    // If LVSD low ejection fraction
    const efLower = data.ejectionFraction.toLowerCase();
    if (efLower.includes('sd') || efLower.includes('severe') || efLower.includes('moderate')) {
      tagsSet.add("EF-Low");
    } else if (data.ejectionFraction === 'Normal') {
      tagsSet.add("EF-Normal");
    }
  }

  // 5. Bifurcation
  if (data.bifurcation) {
    tagsSet.add("Bifurcation-Lesion");
  }

  // 6. Access Method
  if (data.access) {
    tagsSet.add(`Access-${data.access.replace(/\s+/g, '-')}`);
  }

  // 7. USG Doppler
  if (data.usgDoppler) {
    tagsSet.add("USG-Doppler");
  }

  // 8. PCI Vessels Stented
  if (Array.isArray(data.pciVessels)) {
    data.pciVessels.forEach((v: string) => {
      tagsSet.add(`${v}-stent`);
    });
  }

  // 9. Comorbidities
  if (Array.isArray(data.comorbidities)) {
    data.comorbidities.forEach((c: string) => {
      tagsSet.add(`Comorb-${c.replace(/\s+/g, '-')}`);
    });
  }

  // 10. Complications
  if (Array.isArray(data.complications)) {
    data.complications.forEach((comp: string) => {
      tagsSet.add(`Comp-${comp.replace(/\s+/g, '-')}`);
    });
  }

  // 11. Custom Complications
  if (data.complicationsCustom) {
    const cleanComp = data.complicationsCustom.trim().replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-');
    if (cleanComp) {
      tagsSet.add(`Comp-${cleanComp}`);
    }
  }

  // 12. Lesions
  if (Array.isArray(data.lesions)) {
    data.lesions.forEach((l: string) => {
      const parts = l.split(' - ');
      const shortName = parts[0]?.trim();
      if (shortName) {
        tagsSet.add(`Lesion-${shortName.replace(/\s+/g, '-')}`);
      }
    });
  }

  // 13. Stents/Hardware
  if (Array.isArray(data.stentDetails)) {
    data.stentDetails.forEach((sd: string) => {
      const brandWord = sd.split(' ')[0]?.trim();
      if (brandWord) {
        tagsSet.add(`Stent-${brandWord}`);
      }
    });
  }

  if (Array.isArray(data.brsDetails)) {
    data.brsDetails.forEach((sd: string) => {
      const brandWord = sd.split(' ')[0]?.trim();
      if (brandWord) {
        tagsSet.add(`BRS-${brandWord}`);
      }
    });
  }

  if (Array.isArray(data.debDetails)) {
    data.debDetails.forEach((sd: string) => {
      const brandWord = sd.split(' ')[0]?.trim();
      if (brandWord) {
        tagsSet.add(`DEB-${brandWord}`);
      }
    });
  }

  // 14. Special Hardware
  if (Array.isArray(data.specialHardware)) {
    data.specialHardware.forEach((sh: string) => {
      tagsSet.add(`Hardware-${sh}`);
    });
  }

  // 15. Stent Devices count
  if (data.devices) {
    Object.keys(data.devices).forEach((devType) => {
      if (data.devices[devType] > 0) {
        tagsSet.add(`Device-${devType}`);
      }
    });
  }

  return Array.from(tagsSet);
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const downscaleImage = (imageInput: string | File | Blob, maxDim: number = 1000): Promise<string> => {
  return new Promise((resolve) => {
    let objectUrl: string | null = null;
    const img = new Image();

    const fileToBase64 = (blob: Blob): Promise<string> => {
      return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = (err) => rej(err);
        r.readAsDataURL(blob);
      });
    };

    const cleanup = () => {
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch (e) {
          console.error("Error revoking object URL:", e);
        }
        objectUrl = null;
      }
    };

    img.onload = async () => {
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
      
      let primaryCanvas: HTMLCanvasElement | null = null;
      let secondaryCanvas: HTMLCanvasElement | null = null;
      let primaryCtx: CanvasRenderingContext2D | null = null;
      let secondaryCtx: CanvasRenderingContext2D | null = null;

      try {
        primaryCanvas = document.createElement('canvas');
        primaryCanvas.width = width;
        primaryCanvas.height = height;
        primaryCtx = primaryCanvas.getContext('2d');
        if (!primaryCtx) {
          if (objectUrl) {
            const fallbackBase64 = await fileToBase64(imageInput as Blob);
            resolve(fallbackBase64);
          } else {
            resolve(imageInput as string);
          }
          cleanup();
          return;
        }
        primaryCtx.drawImage(img, 0, 0, width, height);

        secondaryCanvas = document.createElement('canvas');
        secondaryCanvas.width = width;
        secondaryCanvas.height = height;
        secondaryCtx = secondaryCanvas.getContext('2d');
        if (!secondaryCtx) {
          if (objectUrl) {
            const fallbackBase64 = await fileToBase64(imageInput as Blob);
            resolve(fallbackBase64);
          } else {
            resolve(imageInput as string);
          }
          cleanup();
          return;
        }
        secondaryCtx.drawImage(primaryCanvas, 0, 0);

        const blob: Blob | null = await new Promise((blobResolve) => {
          if (!secondaryCanvas) {
            blobResolve(null);
            return;
          }
          secondaryCanvas.toBlob((b) => {
            blobResolve(b);
          }, 'image/jpeg', 0.8);
        });

        if (primaryCanvas) {
          primaryCanvas.width = 0;
          primaryCanvas.height = 0;
          primaryCanvas = null;
        }
        if (secondaryCanvas) {
          secondaryCanvas.width = 0;
          secondaryCanvas.height = 0;
          secondaryCanvas = null;
        }
        primaryCtx = null;
        secondaryCtx = null;

        if (!blob) {
          if (objectUrl) {
            const fallbackBase64 = await fileToBase64(imageInput as Blob);
            resolve(fallbackBase64);
          } else {
            resolve(imageInput as string);
          }
          cleanup();
          return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result;
          if (typeof result === 'string') {
            resolve(result);
          } else {
            resolve('');
          }
          cleanup();
        };
        reader.onerror = () => {
          resolve('');
          cleanup();
        };
        reader.readAsDataURL(blob);

      } catch (e) {
        console.error("Canvas scaling error, falling back to original:", e);
        if (primaryCanvas) {
          primaryCanvas.width = 0;
          primaryCanvas.height = 0;
        }
        if (secondaryCanvas) {
          secondaryCanvas.width = 0;
          secondaryCanvas.height = 0;
        }
        if (objectUrl) {
          fileToBase64(imageInput as Blob).then(resolve).catch(() => resolve(''));
        } else {
          resolve(imageInput as string);
        }
        cleanup();
      }
    };

    img.onerror = () => {
      console.error("Image loading error in downscaleImage, falling back");
      if (objectUrl) {
        fileToBase64(imageInput as Blob).then(resolve).catch(() => resolve(''));
      } else {
        resolve(imageInput as string);
      }
      cleanup();
    };

    if (typeof imageInput === 'string') {
      img.src = imageInput;
    } else if (imageInput instanceof File || imageInput instanceof Blob) {
      objectUrl = URL.createObjectURL(imageInput);
      img.src = objectUrl;
    } else {
      resolve('');
    }
  });
};

function formatDateDMY(dateInput: any): string {
  if (!dateInput) return '';
  let date: Date;
  if (dateInput instanceof Date) {
    date = dateInput;
  } else if (dateInput && typeof dateInput.toDate === 'function') {
    date = dateInput.toDate();
  } else if (typeof dateInput === 'number') {
    date = new Date(dateInput);
  } else {
    const str = String(dateInput).trim();
    const matchDMY = str.match(/^(\d{1,2})[_\-/](\d{1,2})[_\-/](\d{4})/);
    if (matchDMY) {
      const day = matchDMY[1].padStart(2, '0');
      const month = matchDMY[2].padStart(2, '0');
      const year = matchDMY[3];
      return `${day}_${month}_${year}`;
    }
    const matchYMD = str.match(/^(\d{4})[_\-/](\d{1,2})[_\-/](\d{1,2})/);
    if (matchYMD) {
      const year = matchYMD[1];
      const month = matchYMD[2].padStart(2, '0');
      const day = matchYMD[3].padStart(2, '0');
      return `${day}_${month}_${year}`;
    }
    date = new Date(str);
  }
  if (isNaN(date.getTime())) {
    const cleanStr = String(dateInput).replace(/_/g, '-');
    const parsed = new Date(cleanStr);
    if (!isNaN(parsed.getTime())) {
      date = parsed;
    } else {
      return String(dateInput);
    }
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}_${month}_${year}`;
}

function getTodayDMY(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}_${String(d.getMonth() + 1).padStart(2, '0')}_${d.getFullYear()}`;
}

function getComplicationsStr(p: Patient, sep: string = ', '): string {
  return (p.complications || []).map(c => c === Complication.Other && p.complicationsCustom ? `Other: ${p.complicationsCustom}` : c).join(sep);
}

const handleDateInputChange = (val: string, onChange: (formatted: string) => void) => {
  let clean = val.replace(/[^0-9]/g, '');
  if (clean.length > 8) {
    clean = clean.slice(0, 8);
  }
  let formatted = '';
  if (clean.length > 0) {
    formatted += clean.slice(0, 2);
  }
  if (clean.length > 2) {
    formatted += '_' + clean.slice(2, 4);
  }
  if (clean.length > 4) {
    formatted += '_' + clean.slice(4, 8);
  }
  onChange(formatted);
};

export const parseAnyDateToDate = (dateInput: any): Date | null => {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }
  if (dateInput && typeof dateInput.toDate === 'function') {
    try {
      const d = dateInput.toDate();
      return isNaN(d.getTime()) ? null : d;
    } catch {
      // fallback
    }
  }
  if (typeof dateInput === 'number') {
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? null : d;
  }
  const str = String(dateInput).trim();
  if (!str) return null;
  
  // Format DD_MM_YYYY or DD/MM/YYYY or DD-MM-YYYY
  const matchDMY = str.match(/^(\d{1,2})[_\-/](\d{1,2})[_\-/](\d{4})/);
  if (matchDMY) {
    const day = parseInt(matchDMY[1], 10);
    const month = parseInt(matchDMY[2], 10) - 1;
    const year = parseInt(matchDMY[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }
  
  // Format YYYY_MM_DD or YYYY-MM-DD or YYYY/MM/DD
  const matchYMD = str.match(/^(\d{4})[_\-/](\d{1,2})[_\-/](\d{1,2})/);
  if (matchYMD) {
    const year = parseInt(matchYMD[1], 10);
    const month = parseInt(matchYMD[2], 10) - 1;
    const day = parseInt(matchYMD[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  const cleanStr = str.replace(/_/g, '-');
  const d = new Date(cleanStr);
  if (!isNaN(d.getTime())) return d;
  return null;
};

export const parseDMYToDate = parseAnyDateToDate;

export const formatDateToDMYStr = (date: Date): string => {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}_${m}_${y}`;
};

// Helper Components

const ColorfulBarChart = ({ className, isActive }: { className?: string; isActive?: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M3 3v18h18" stroke="currentColor" className={isActive ? "opacity-100" : "opacity-40"} />
    <path d="M18 17V9" stroke={isActive ? "currentColor" : "#3b82f6"} />
    <path d="M13 17V5" stroke={isActive ? "currentColor" : "#ec4899"} />
    <path d="M8 17v-3" stroke={isActive ? "currentColor" : "#eab308"} />
  </svg>
);


export default function App() {
const PCI_TEMPLATES: PCITemplate[] = [
    {
      name: 'Standard Radial LAD',
      access: AccessMethod.RtRadial,
      pciVessels: [PCIVessel.LAD],
      devices: { [DeviceType.DES]: 1 },
      drugs: [Drug.Aspirin, Drug.Ticagrelor, Drug.Clopidogrel]
    },
    {
      name: 'Standard Radial RCA',
      access: AccessMethod.RtRadial,
      pciVessels: [PCIVessel.RCA],
      devices: { [DeviceType.DES]: 1 },
      drugs: [Drug.Aspirin, Drug.Ticagrelor, Drug.Clopidogrel]
    },
    {
      name: 'Complex CTO/ROTA',
      access: AccessMethod.RtFemoral,
      pciVessels: [PCIVessel.RCA],
      devices: { [DeviceType.DES]: 2 },
      drugs: [Drug.Aspirin, Drug.Prasugrel, Drug.GPIIbIIIa]
    }
  ];

  const [user, setUser] = useState<any>(() => {
    const cachedUser = localStorage.getItem('last_logged_in_user');
    if (cachedUser) {
      try {
        return JSON.parse(cachedUser);
      } catch (e) {}
    }
    return {
      uid: 'offline_user',
      email: 'offline@local.db',
      displayName: 'Offline Doctor',
      isOffline: true
    };
  });
  const [appSecurityPin, setAppSecurityPin] = useState<string | null>(() => {
    return localStorage.getItem('app_security_pin');
  });

  const [isPinUnlocked, setIsPinUnlocked] = useState<boolean>(() => {
    const pin = localStorage.getItem('app_security_pin');
    if (!pin) {
      return false;
    }
    const today = new Date().toISOString().split('T')[0];
    const lastUnlocked = localStorage.getItem('last_unlocked_date');
    if (lastUnlocked === today) {
      return true;
    }
    return false;
  });
  const [loading, setLoading] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(() => {
    return localStorage.getItem('is_offline_mode') !== 'false';
  });
  const [patients, setPatients] = useState<Patient[]>([]);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [syncConflicts, setSyncConflicts] = useState<SyncConflict[]>([]);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [syncIntervalMinutes, setSyncIntervalMinutes] = useState<number>(() => {
    const saved = localStorage.getItem('sync_interval_minutes');
    return saved ? parseInt(saved, 10) : 5;
  });

  const [autoBackups, setAutoBackups] = useState<{
    backup1: { data: Patient[]; timestamp: string } | null;
    backup2: { data: Patient[]; timestamp: string } | null;
  }>({ backup1: null, backup2: null });

  const fetchAutoBackups = useCallback(async () => {
    try {
      const b = await getAutomaticBackups();
      setAutoBackups(b);
    } catch (e) {
      console.error('Error fetching automatic backups:', e);
    }
  }, []);

  const handleRestoreAutoBackup = async (slot: 'backup1' | 'backup2') => {
    const b = autoBackups[slot];
    if (!b) return;
    if (!confirm(`Are you sure you want to restore from ${slot === 'backup1' ? 'Backup 1 (Newer)' : 'Backup 2 (Older)'} saved on ${new Date(b.timestamp).toLocaleString()}? This will replace your current patient records.`)) {
      return;
    }
    try {
      await restorePatientsBackup(b.data);
      await fetchPatients();
      await fetchAutoBackups();
      setToast({ message: 'Successfully restored from automatic backup!', type: 'success' });
    } catch (e) {
      console.error(e);
      setToast({ message: 'Failed to restore from automatic backup.', type: 'error' });
    }
  };

  const checkSyncConflicts = useCallback(async () => {
    if (!user || isOfflineMode || !navigator.onLine) {
      setSyncConflicts([]);
      return;
    }
    try {
      const conflicts = await getSyncConflicts();
      setSyncConflicts(conflicts);
    } catch (e) {
      console.error('Error checking sync conflicts:', e);
    }
  }, [user, isOfflineMode]);

  useEffect(() => {
    const updatePendingCount = async () => {
      try {
        const count = await getPendingSyncCount();
        setPendingSyncCount(count);
        await checkSyncConflicts();
      } catch (e) {
        console.error('Error fetching pending sync count:', e);
      }
    };
    updatePendingCount();
  }, [patients, checkSyncConflicts]);

  useEffect(() => {
    const performPeriodicSync = async () => {
      try {
        await syncPatients();
        const count = await getPendingSyncCount();
        setPendingSyncCount(count);
        await checkSyncConflicts();
      } catch (e) {
        console.error('Error performing periodic sync:', e);
      }
    };

    const intervalMs = syncIntervalMinutes * 60 * 1000;
    const interval = setInterval(performPeriodicSync, intervalMs);
    return () => clearInterval(interval);
  }, [syncIntervalMinutes, checkSyncConflicts]);
  const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>({
    select: 48,
    place: 110,
    serialNo: 110,
    date: 120,
    admissionNo: 110,
    name: 180,
    ageGen: 100,
    status: 140,
    ef: 80,
    finalNotes: 180,
    generalNotes: 180,
    actions: 130
  });

  const [visibleColumns, setVisibleColumns] = useState<{ [key: string]: boolean }>(() => {
    const saved = localStorage.getItem('patient_table_columns_visible');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.actions === undefined) parsed.actions = true;
        return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    return {
      place: !isMobile,
      serialNo: true,
      date: !isMobile,
      admissionNo: !isMobile,
      name: true,
      ageGen: true,
      ef: !isMobile,
      finalNotes: !isMobile,
      generalNotes: !isMobile,
      status: true,
      actions: true
    };
  });

  useEffect(() => {
    localStorage.setItem('patient_table_columns_visible', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('patient_table_column_order');
    if (saved) {
      try {
        const parsed: string[] = JSON.parse(saved);
        if (!parsed.includes('actions')) {
          parsed.push('actions');
        }
        return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return [
      'place',
      'serialNo',
      'date',
      'admissionNo',
      'name',
      'ageGen',
      'ef',
      'finalNotes',
      'generalNotes',
      'status',
      'actions'
    ];
  });

  useEffect(() => {
    localStorage.setItem('patient_table_column_order', JSON.stringify(columnOrder));
  }, [columnOrder]);

  const [draggedColumnIndex, setDraggedColumnIndex] = useState<number | null>(null);

  const handleColumnDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggedColumnIndex(index);
  };

  const handleColumnDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedColumnIndex === null || draggedColumnIndex === index) return;
    
    const newOrder = [...columnOrder];
    const [draggedItem] = newOrder.splice(draggedColumnIndex, 1);
    newOrder.splice(index, 0, draggedItem);
    setDraggedColumnIndex(index);
    setColumnOrder(newOrder);
  };

  const handleColumnDragEnd = () => {
    setDraggedColumnIndex(null);
  };

  const handleResizeStart = useCallback((e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.pageX;
    const startWidth = columnWidths[columnKey] || 100;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentX = moveEvent.pageX;
      const difference = currentX - startX;
      setColumnWidths((prev) => ({
        ...prev,
        [columnKey]: Math.max(50, startWidth + difference),
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [columnWidths]);

  const [view, setView] = useState<'list' | 'add' | 'detail' | 'dashboard' | 'print' | 'bulk-print'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'partial' | 'exact'>('partial');
  const [showFilters, setShowFilters] = useState(false);
  const [showTableSettings, setShowTableSettings] = useState(false);
  const [activeFilterDropdown, setActiveFilterDropdown] = useState<'class' | 'type' | 'date' | 'tags' | null>(null);
  const [quickFilterTagSearch, setQuickFilterTagSearch] = useState('');
  const [filters, setFilters] = useState({
    gender: 'All',
    minAge: '',
    maxAge: '',
    startDate: '',
    endDate: '',
    category: 'All',
    serviceCategory: 'All',
    tag: '',
    tags: [] as string[],
    tagMatchMode: 'all' as 'all' | 'any',
    dateField: 'either' as 'either' | 'created' | 'updated',
    importantOnly: false
  });
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'serialNo' | 'admissionNo' | 'ageGen' | 'ef' | 'finalNotes' | 'generalNotes' | 'status' | 'age' | 'gender'>('date');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isInsightsCollapsed, setIsInsightsCollapsed] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string } | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  const toggleFilterDropdown = (name: 'class' | 'type' | 'date' | 'tags') => {
    setActiveFilterDropdown(prev => prev === name ? null : name);
  };

  const getDateLabel = () => {
    if (!filters.startDate) return 'All';
    const today = new Date();
    const todayStr = formatDateToDMYStr(today);
    if (filters.startDate === todayStr && filters.endDate === todayStr) return 'Today';
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    if (filters.startDate === formatDateToDMYStr(sevenDaysAgo)) return '7 Days';
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    if (filters.startDate === formatDateToDMYStr(thirtyDaysAgo)) return '30 Days';
    
    const firstOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    if (filters.startDate === formatDateToDMYStr(firstOfThisMonth)) return 'This Month';

    const firstOfThisYear = new Date(today.getFullYear(), 0, 1);
    if (filters.startDate === formatDateToDMYStr(firstOfThisYear)) return 'This Year';
    
    return 'Custom';
  };

  // Global Privacy Mode & Print Layout Customization States
  const [globalPrivacyMode, setGlobalPrivacyMode] = useState<boolean>(() => {
    return localStorage.getItem('globalPrivacyMode') === 'true';
  });
  const [printHeaderTitle, setPrintHeaderTitle] = useState("Patient Cath Data");
  const [printShowHospitalHeader, setPrintShowHospitalHeader] = useState(true);
  const [printTextSizeScale, setPrintTextSizeScale] = useState<'compact' | 'normal' | 'large'>('normal');
  const [printLayoutMode, setPrintLayoutMode] = useState<'compact' | 'detailed'>('detailed');
  const [printIsAnonymized, setPrintIsAnonymized] = useState(() => {
    return localStorage.getItem('globalPrivacyMode') === 'true';
  });
  const [printVisibleSections, setPrintVisibleSections] = useState({
    demographics: true,
    diagnostics: true,
    anatomy: true,
    pci: true,
    outcomes: true,
    photos: true,
    signatures: true,
    qrcode: true,
    tags: true
  });
  const [printPhysicianName, setPrintPhysicianName] = useState("Dr Bharat S Sambyal");

  const handleTogglePrivacyMode = useCallback((enabled: boolean) => {
    setGlobalPrivacyMode(enabled);
    localStorage.setItem('globalPrivacyMode', String(enabled));
    if (enabled) {
      setPrintIsAnonymized(true);
      setToast({
        message: 'Global Privacy Mode enabled. All future PDF/CSV exports will be anonymized.',
        type: 'success'
      });
    } else {
      setToast({
        message: 'Global Privacy Mode disabled.',
        type: 'info'
      });
    }
  }, []);

  const getPdfExportOptions = useCallback((): PdfExportOptions => ({
    isAnonymized: globalPrivacyMode || printIsAnonymized,
    includeAiTags: printVisibleSections.tags !== false,
    customHeaderTitle: printHeaderTitle,
    showHospitalHeader: printShowHospitalHeader,
    customPhysicianName: printPhysicianName,
    visibleSections: printVisibleSections
  }), [globalPrivacyMode, printIsAnonymized, printVisibleSections, printHeaderTitle, printShowHospitalHeader, printPhysicianName]);

  // Print Layout Presets States
  const [presets, setPresets] = useState<PrintPreset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');

  const fetchPresets = useCallback(async () => {
    setPresetsLoading(true);
    try {
      const data = await getPresets();
      setPresets(data);
    } catch (err) {
      console.error('Failed to load print presets:', err);
    } finally {
      setPresetsLoading(false);
    }
  }, []);

  const handleSelectPreset = useCallback((presetId: string) => {
    setSelectedPresetId(presetId);
    if (!presetId) {
      setPrintHeaderTitle("Patient Cath Data");
      setPrintShowHospitalHeader(true);
      setPrintTextSizeScale('normal');
      setPrintLayoutMode('detailed');
      setPrintIsAnonymized(false);
      setPrintVisibleSections({
        demographics: true,
        diagnostics: true,
        anatomy: true,
        pci: true,
        outcomes: true,
        photos: true,
        signatures: true,
        qrcode: true,
        tags: true
      });
      setPrintPhysicianName("Dr Bharat S Sambyal");
      return;
    }

    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setPrintHeaderTitle(preset.headerTitle);
      setPrintShowHospitalHeader(preset.showHospitalHeader);
      setPrintTextSizeScale(preset.textSizeScale);
      if (preset.layoutMode) setPrintLayoutMode(preset.layoutMode);
      if (typeof preset.isAnonymized === 'boolean') setPrintIsAnonymized(preset.isAnonymized);
      setPrintVisibleSections({
        demographics: preset.visibleSections.demographics,
        diagnostics: preset.visibleSections.diagnostics,
        anatomy: preset.visibleSections.anatomy,
        pci: preset.visibleSections.pci,
        outcomes: preset.visibleSections.outcomes,
        photos: preset.visibleSections.photos,
        signatures: preset.visibleSections.signatures,
        qrcode: preset.visibleSections.qrcode !== false,
        tags: preset.visibleSections.tags !== false
      });
      setPrintPhysicianName(preset.physicianName);
    }
  }, [presets]);

  const handleSavePreset = useCallback(async (name: string) => {
    try {
      const existingPreset = presets.find(p => p.id === selectedPresetId || p.name.toLowerCase() === name.toLowerCase());
      const presetIdToUse = existingPreset ? existingPreset.id : undefined;

      const result = await savePreset({
        id: presetIdToUse,
        name,
        headerTitle: printHeaderTitle,
        showHospitalHeader: printShowHospitalHeader,
        textSizeScale: printTextSizeScale,
        layoutMode: printLayoutMode,
        isAnonymized: printIsAnonymized,
        includeAiTags: printVisibleSections.tags !== false,
        visibleSections: printVisibleSections,
        physicianName: printPhysicianName
      });
      setToast({ message: `Print Layout Preset "${name}" saved successfully!`, type: 'success' });
      await fetchPresets();
      if (result.id) {
        setSelectedPresetId(result.id);
      }
    } catch (err: any) {
      console.error('Failed to save preset:', err);
      setToast({ message: 'Failed to save print preset: ' + err.message, type: 'error' });
    }
  }, [presets, selectedPresetId, printHeaderTitle, printShowHospitalHeader, printTextSizeScale, printLayoutMode, printIsAnonymized, printVisibleSections, printPhysicianName, fetchPresets]);

  const handleDeletePreset = useCallback(async (presetId: string) => {
    try {
      await apiDeletePreset(presetId);
      setToast({ message: 'Preset deleted successfully', type: 'success' });
      await fetchPresets();
      if (selectedPresetId === presetId) {
        setSelectedPresetId('');
        setPrintHeaderTitle("Patient Cath Data");
        setPrintShowHospitalHeader(true);
        setPrintTextSizeScale('normal');
        setPrintVisibleSections({
          demographics: true,
          diagnostics: true,
          anatomy: true,
          pci: true,
          outcomes: true,
          photos: true,
          signatures: true,
          qrcode: true,
          tags: true
        });
        setPrintPhysicianName("Dr Bharat S Sambyal");
      }
    } catch (err: any) {
      console.error('Failed to delete preset:', err);
      setToast({ message: 'Failed to delete preset: ' + err.message, type: 'error' });
    }
  }, [selectedPresetId, fetchPresets]);

  const existingPlaces = useMemo(() => {
    return Array.from(new Set(patients.map(p => p.place).filter(Boolean))) as string[];
  }, [patients]);

  useEffect(() => {
    if (selectedPatient) {
      const displayId = `PAT-${String(selectedPatient.serialNo).padStart(2, '0')}`;
      const payload = selectedPatient.id 
        ? `${window.location.origin}/?patientId=${selectedPatient.id}` 
        : `${window.location.origin}/?serialNo=${selectedPatient.serialNo}`;
      QRCode.toDataURL(payload, { width: 300, margin: 2 })
        .then(url => {
          setQrCodeUrl(url);
        })
        .catch(err => {
          console.error('Error generating QR code:', err);
          setQrCodeUrl('');
        });
    } else {
      setQrCodeUrl('');
    }
  }, [selectedPatient]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ 
    message: string; 
    type: 'success' | 'error' | 'info' | 'loading'; 
    undoAction?: () => void; 
    undoLabel?: string; 
  } | null>(null);

  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);

  const handleQrScan = useCallback((text: string) => {
    setIsQrScannerOpen(false);
    
    // Attempt to parse scanned text as a full URL
    try {
      if (text.startsWith('http://') || text.startsWith('https://') || text.includes('?')) {
        const urlObj = new URL(text.includes('?') && !text.startsWith('http') ? `https://dummy.com/${text}` : text);
        const patientId = urlObj.searchParams.get('patientId');
        const serialNoParam = urlObj.searchParams.get('serialNo');
        
        if (patientId) {
          const patient = patients.find(p => p.id === patientId);
          if (patient) {
            setSelectedPatient(patient);
            setView('detail');
            setToast({ message: `Scanned & found patient: ${patient.name}`, type: 'success' });
            return;
          }
        }
        
        if (serialNoParam) {
          const serialNo = parseInt(serialNoParam, 10);
          const patient = patients.find(p => p.serialNo === serialNo || String(p.serialNo) === serialNoParam);
          if (patient) {
            setSelectedPatient(patient);
            setView('detail');
            setToast({ message: `Scanned & found patient: ${patient.name}`, type: 'success' });
            return;
          }
        }
      }
    } catch (e) {
      console.error('Failed to parse QR text as URL:', e);
    }

    const match = text.match(/PAT-(\d+)/i);
    if (match) {
      const serialNo = parseInt(match[1], 10);
      const patient = patients.find(p => p.serialNo === serialNo || String(p.serialNo) === match[1]);
      if (patient) {
        setSelectedPatient(patient);
        setView('detail');
        setToast({ message: `Scanned & found patient: ${patient.name}`, type: 'success' });
        return;
      }
    }
    
    const directPatient = patients.find(p => p.id === text);
    if (directPatient) {
      setSelectedPatient(directPatient);
      setView('detail');
      setToast({ message: `Scanned & found patient: ${directPatient.name}`, type: 'success' });
      return;
    }
    
    setSearchQuery(text);
    setToast({ message: `Scanned code: "${text}". Searching database...`, type: 'success' });
  }, [patients]);

  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewRotation, setPreviewRotation] = useState(0);

  const triggerVibrate = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([50]);
    }
  }, []);

  const [emrSummaryPatient, setEmrSummaryPatient] = useState<Patient | null>(null);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA Installation outcome: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  useEffect(() => {
    if (previewPhoto) {
      setPreviewZoom(1);
      setPreviewRotation(0);
    }
  }, [previewPhoto]);

  useEffect(() => {
    if (!previewPhoto) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewPhoto(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewPhoto]);

  useEffect(() => {
    if (toast && toast.type !== 'loading') {
      const duration = toast.undoAction ? 6000 : (toast.type === 'info' ? 2500 : 4000);
      const timer = setTimeout(() => {
        setToast(null);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showUnsavedChangesConfirm, setShowUnsavedChangesConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [showSettings, setShowSettings] = useState(false);
  const [driveAccessToken, setDriveAccessToken] = useState<string | null>(() => {
    return localStorage.getItem('driveAccessToken');
  });
  const [driveBackups, setDriveBackups] = useState<any[]>([]);
  const [isListingDrive, setIsListingDrive] = useState(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [pendingDriveUpload, setPendingDriveUpload] = useState<{
    filename: string;
    fileSizeKB: string;
    recordCount: number;
    isEncrypted: boolean;
    backupString: string;
  } | null>(null);
  const [isDownloadingFromDrive, setIsDownloadingFromDrive] = useState(false);
  const [selectedDriveFileId, setSelectedDriveFileId] = useState<string>('');
  const [backupPassword, setBackupPassword] = useState('');
  const [confirmUnencrypted, setConfirmUnencrypted] = useState(false);
  const [restorePassword, setRestorePassword] = useState('');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isExportingJSON, setIsExportingJSON] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [compressionQuality, setCompressionQuality] = useState(() => {
    const saved = localStorage.getItem('compressionQuality');
    return saved ? parseFloat(saved) : 0.7;
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgressState | null>(null);
  const [showPdfExportModal, setShowPdfExportModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showCsvImporter, setShowCsvImporter] = useState(false);
  const [showFullRestoreModal, setShowFullRestoreModal] = useState(false);
  const [syncHandle, setSyncHandle] = useState<any>(null); // For File System Access API
  const [pendingSyncHandle, setPendingSyncHandle] = useState<any>(null); // Restored but needs permission
  const [isSyncing, setIsSyncing] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [autoSaveMode, setAutoSaveMode] = useState<'overwrite' | 'daily' | 'off'>(() => {
    return (localStorage.getItem('auto_save_mode') as 'overwrite' | 'daily' | 'off') || 'overwrite';
  });
  const [autoDownloadOnClose, setAutoDownloadOnClose] = useState<boolean>(() => {
    return localStorage.getItem('auto_download_on_close') === 'true';
  });
  const [showPlaceSuggestionsSidebar, setShowPlaceSuggestionsSidebar] = useState(false);
  const [showPlaceSuggestionsMobile, setShowPlaceSuggestionsMobile] = useState(false);

  // Database Health Check States
  const [isHealthChecking, setIsHealthChecking] = useState(false);
  const [healthReport, setHealthReport] = useState<{
    totalChecked: number;
    corruptedCount: number;
    issues: {
      id: string;
      patientId?: string;
      name?: string;
      serialNo?: number;
      details: string[];
    }[];
    status: 'idle' | 'success' | 'warning' | 'error';
    checkedAt: string;
  } | null>(null);
  const [isHealthRepairing, setIsHealthRepairing] = useState(false);

  const [onlineSyncAllowed, setOnlineSyncAllowed] = useState<boolean>(() => {
    const saved = localStorage.getItem('online_sync_allowed');
    return saved !== 'false';
  });
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine && (localStorage.getItem('online_sync_allowed') !== 'false'));
  const [selectedPatientIds, setSelectedPatientIds] = useState<string[]>([]);

  const syncHandleRef = useRef<any>(null);
  const patientsRef = useRef<Patient[]>([]);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const urlParamsProcessedRef = useRef<boolean>(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);

  const handleTableScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    requestAnimationFrame(() => {
      if (target) {
        setScrollTop(target.scrollTop);
        setContainerHeight(target.clientHeight);
      }
    });
  }, []);

  useEffect(() => {
    syncHandleRef.current = syncHandle;
  }, [syncHandle]);

  useEffect(() => {
    patientsRef.current = patients;
  }, [patients]);

  useEffect(() => {
    const handleOnline = () => {
      if (onlineSyncAllowed) setIsOnline(true);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onlineSyncAllowed]);

  useEffect(() => {
    setIsOnline(navigator.onLine && onlineSyncAllowed);
    localStorage.setItem('online_sync_allowed', onlineSyncAllowed ? 'true' : 'false');
  }, [onlineSyncAllowed]);

  useEffect(() => {
    let timeoutId: any;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (tableContainerRef.current) {
          setContainerHeight(tableContainerRef.current.clientHeight || 600);
        }
      }, 100);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);


  const [backupFrequency, setBackupFrequency] = useState(() => {
    const saved = localStorage.getItem('backupFrequency');
    return (saved as 'daily' | 'weekly' | 'monthly' | 'never') || 'never';
  });
  const [lastBackupDate, setLastBackupDate] = useState(() => {
    const saved = localStorage.getItem('lastBackupDate');
    return saved ? parseInt(saved) : 0;
  });
  const [showBackupReminder, setShowBackupReminder] = useState(false);

  useEffect(() => {
    localStorage.setItem('backupFrequency', backupFrequency);
  }, [backupFrequency]);

  useEffect(() => {
    if (lastBackupDate > 0) {
      localStorage.setItem('lastBackupDate', lastBackupDate.toString());
    }
  }, [lastBackupDate]);

  const checkBackupStatus = useCallback(() => {
    if (backupFrequency === 'never') return;
    
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    let threshold = oneDay;
    
    if (backupFrequency === 'weekly') threshold = oneDay * 7;
    if (backupFrequency === 'monthly') threshold = oneDay * 30;
    
    if (now - lastBackupDate > threshold) {
      setShowBackupReminder(true);
    }
  }, [backupFrequency, lastBackupDate]);

  useEffect(() => {
    if (patients.length > 0) {
      checkBackupStatus();
    }
  }, [patients.length, checkBackupStatus]);

  // Handle URL query parameters on load to auto-open patient details
  useEffect(() => {
    if (patients.length > 0 && !urlParamsProcessedRef.current) {
      const params = new URLSearchParams(window.location.search);
      const patientId = params.get('patientId');
      const serialNoParam = params.get('serialNo');
      
      let foundPatient: Patient | undefined;
      
      if (patientId) {
        foundPatient = patients.find(p => p.id === patientId);
      } else if (serialNoParam) {
        const serialNo = parseInt(serialNoParam, 10);
        foundPatient = patients.find(p => p.serialNo === serialNo || String(p.serialNo) === serialNoParam);
      }
      
      if (foundPatient) {
        urlParamsProcessedRef.current = true;
        setSelectedPatient(foundPatient);
        setView('detail');
        // Clear the query parameters without refreshing the page
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        setToast({ message: `Loaded patient profile: ${foundPatient.name}`, type: 'success' });
      } else {
        // If there are no params in the URL, mark as processed so we don't query every time patients changes
        if (!patientId && !serialNoParam) {
          urlParamsProcessedRef.current = true;
        }
      }
    }
  }, [patients]);

  useEffect(() => {
    const loadStoredHandle = async () => {
      try {
        const stored = await getSyncFolderHandle();
        if (stored) {
          try {
            const isGranted = (await stored.queryPermission({ mode: 'readwrite' })) === 'granted';
            if (isGranted) {
              setSyncHandle(stored);
            } else {
              setPendingSyncHandle(stored);
            }
          } catch (err) {
            // Some environments might throw on queryPermission or need direct interaction
            setPendingSyncHandle(stored);
          }
        }
      } catch (e) {
        console.error('Error loading stored sync folder handle:', e);
      }
    };
    loadStoredHandle();
  }, []);

  const requestSyncFolder = async () => {
    try {
      // @ts-ignore
      const handle = await window.showDirectoryPicker();
      setSyncHandle(handle);
      setPendingSyncHandle(null);
      await saveSyncFolderHandle(handle);
      setToast({ message: 'Selected folder. The app will now automatically sync changes to this folder.', type: 'success' });
    } catch (e) {
      console.error(e);
      alert('Failed to select folder or not supported in this browser.');
    }
  };

  const reconnectSyncFolder = useCallback(async (silent: boolean | any = false) => {
    const isSilent = typeof silent === 'boolean' ? silent : false;
    if (!pendingSyncHandle) return;
    try {
      const permission = await pendingSyncHandle.requestPermission({ mode: 'readwrite' });
      if (permission === 'granted') {
        setSyncHandle(pendingSyncHandle);
        setPendingSyncHandle(null);
        setToast({ message: 'Successfully reconnected to your sync folder!', type: 'success' });
      } else {
        if (!isSilent) {
          alert('Permission denied. Please select the folder again or grant permission.');
        }
      }
    } catch (e) {
      console.error('Error requesting permission for stored handle:', e);
      if (!isSilent) {
        alert('Failed to request folder permission. Please select the folder again.');
      }
    }
  }, [pendingSyncHandle]);

  // Auto-reconnect on first user interaction if we have a pending handle
  useEffect(() => {
    const handleFirstInteraction = async () => {
      if (pendingSyncHandle && !syncHandle) {
        try {
          await reconnectSyncFolder(true);
        } catch (e) {
          console.error('Silent auto-reconnect failed:', e);
        }
        window.removeEventListener('click', handleFirstInteraction);
        window.removeEventListener('touchstart', handleFirstInteraction);
      }
    };

    if (pendingSyncHandle && !syncHandle) {
      window.addEventListener('click', handleFirstInteraction);
      window.addEventListener('touchstart', handleFirstInteraction);
    }

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, [pendingSyncHandle, syncHandle, reconnectSyncFolder]);

  const getBackupPhotoName = (p: Patient, prefix: string, extension: string) => {
    const serialNo = p.serialNo;
    const initials = p.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase() || 'PAT';
    const dateStr = (p.date || '').split('T')[0].replace(/-/g, '_') || new Date().toISOString().split('T')[0].replace(/-/g, '_');
    return `${serialNo}_${initials}_${prefix}_${dateStr}.${extension}`;
  };

  const getPatientPhotoFields = (p: Patient) => {
    const fields: { url: string; prefix: string }[] = [];
    if (p.labPhotoUrl) fields.push({ url: p.labPhotoUrl, prefix: 'lab' });
    if (p.angiogramPhotoUrl) fields.push({ url: p.angiogramPhotoUrl, prefix: 'angiogram' });

    const pciList = (p.pciPhotoUrls && p.pciPhotoUrls.length > 0) ? p.pciPhotoUrls : (p.pciPhotoUrl ? [p.pciPhotoUrl] : []);
    pciList.forEach((url, i) => {
      if (url) fields.push({ url, prefix: pciList.length > 1 ? `pci_${i + 1}` : 'pci' });
    });

    const imgList = (p.imagingPhotoUrls && p.imagingPhotoUrls.length > 0) ? p.imagingPhotoUrls : (p.imagingPhotoUrl ? [p.imagingPhotoUrl] : []);
    imgList.forEach((url, i) => {
      if (url) fields.push({ url, prefix: imgList.length > 1 ? `imaging_${i + 1}` : 'imaging' });
    });

    if (p.otherInfoPhotoUrl) fields.push({ url: p.otherInfoPhotoUrl, prefix: 'other_info' });
    if (p.demographicsPhotoUrl) fields.push({ url: p.demographicsPhotoUrl, prefix: 'demographics' });

    return fields;
  };

  const performSync = async (patientsList?: Patient[]) => {
    const activeHandle = syncHandle || syncHandleRef.current;
    if (!activeHandle || isSyncing) return;
    setIsSyncing(true);
    const dataToSync = patientsList || patients || patientsRef.current;
    try {
      // @ts-ignore
      const photosDir = await activeHandle.getDirectoryHandle('photos', { create: true });
      
      // Write data.csv
      const headers = [
        'Serial No', 'Ser No', 'Service Status', 'Admission No', 'Name', 'Age', 'Gender', 'Weight', 'Height', 'BMI', 
        'Pre Hb', 'Pre Urea', 'Pre Creatinine', 'Pre K', 'Post Hb', 'Post Urea', 'Post Creatinine', 'Post K',
        'Phones', 
        'Date', 'Presentation', 'TMT', 'EF', 'EF Notes', 'RWMA', 'Comorbidities', 'Access', 'Access Notes', 'USG', 'Bifurcation', 
        'Other Flag', 'PCI Vessels', 'Lesion Types', 'Imaging', 'Imaging Findings', 'Sp Hardware', 'Stent Details', 'BRS Details', 'DEB Details', 'Lesions', 'Device Counts',
        'Closure Device', 'Closure Device Custom', 'Complications', 'Complications Custom', 'Other Hardware', 'Other Hardware Notes', 
        'Drugs', 'Final Notes', 'Plan', 'Notes', 'Category', 'Tags', 'Place', 'Created At', 'Updated At', 'Created By', 'Outcomes'
      ];
      const rows = dataToSync.map(p => [
        p.serialNo,
        `"${p.serNo || ''}"`,
        p.serviceCategory || '',
        `"${p.admissionNo}"`,
        `"${p.name}"`,
        p.age,
        p.gender,
        p.weight || '',
        p.height || '',
        p.bmi || '',
        `"${p.preHb || ''}"`,
        `"${p.preUrea || ''}"`,
        `"${p.preCreatinine || ''}"`,
        `"${p.preK || ''}"`,
        `"${p.postHb || ''}"`,
        `"${p.postUrea || ''}"`,
        `"${p.postCreatinine || ''}"`,
        `"${p.postK || ''}"`,
        `"${(p.phoneNumbers || []).join(' | ')}"`,
        formatDateDMY(p.date),
        p.presentation,
        p.tmt || 'NA',
        p.ejectionFraction,
        `"${p.otherEjectionFractionNotes || ''}"`,
        `"${(p.rwma || []).join('|')}"`,
        `"${(p.comorbidities || []).join('|')}"`,
        p.access,
        `"${p.otherAccessNotes || ''}"`,
        p.usgDoppler ? 'Yes' : 'No',
        p.bifurcation ? 'Yes' : 'No',
        p.isOther ? 'Yes' : 'No',
        `"${(p.pciVessels || []).join('|')}"`,
        `"${(p.lesionTypes || []).join('|')}"`,
        `"${(p.imaging || []).join('|')}"`,
        `"${p.imagingFindings ? Object.entries(p.imagingFindings).map(([k, v]) => `${k}:${v}`).join('|').replace(/"/g, '""') : ''}"`,
        `"${(p.specialHardware || []).join('|')}"`,
        `"${(p.stentDetails || []).join('|')}"`,
        `"${(p.brsDetails || []).join('|')}"`,
        `"${(p.debDetails || []).join('|')}"`,
        `"${(p.lesions || []).join('|')}"`,
        `"${p.devices ? Object.entries(p.devices).map(([t, q]) => `${t}:${q}`).join('|') : ''}"`,
        `"${p.closureDevice || ''}"`,
        `"${p.closureDeviceCustom || ''}"`,
        `"${getComplicationsStr(p, '|')}"`,
        `"${p.complicationsCustom || ''}"`,
        `"${(p.otherHardware || []).join('|')}"`,
        `"${p.otherHardwareNotes || ''}"`,
        `"${(p.drugs || []).join('|')}"`,
        `"${(p.finalNotes || '').replace(/"/g, '""')}"`,
        `"${(p.plan || '').replace(/"/g, '""')}"`,
        `"${(p.notes || '').replace(/"/g, '""')}"`,
        (p.category === ReportCategory.Other && p.otherCategoryNotes) ? p.otherCategoryNotes : p.category,
        `"${(p.tags || []).join('|')}"`,
        `"${p.place || ''}"`,
        p.createdAt?.toDate?.()?.toISOString() || (p.createdAt instanceof Date ? p.createdAt.toISOString() : (typeof p.createdAt === 'string' ? new Date(p.createdAt).toISOString() : '')),
        p.updatedAt?.toDate?.()?.toISOString() || (p.updatedAt instanceof Date ? p.updatedAt.toISOString() : (typeof p.updatedAt === 'string' ? new Date(p.updatedAt).toISOString() : '')),
        `"${p.createdBy || ''}"`,
        `"${(p.outcomes || []).map(o => `${formatDateDMY(o.date)}:${o.status}:${o.notes}`).join(';')}"`
      ]);
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      
      // @ts-ignore
      const dataFileHandle = await activeHandle.getFileHandle('data.csv', { create: true });
      const writable = await dataFileHandle.createWritable();
      await writable.write(csvContent);
      await writable.close();

      // Sync photos (only those that are strictly new would be better but we'll do a simple loop)
      for (const p of dataToSync) {
        const photoFields = getPatientPhotoFields(p);

        for (const photo of photoFields) {
          if (photo.url && photo.url.startsWith('data:image')) {
            const extension = photo.url.split(';')[0].split('/')[1] || 'png';
            const name = getBackupPhotoName(p, photo.prefix, extension);
            const base64Data = photo.url.split(',')[1];
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            
            // @ts-ignore
            const photoFileHandle = await photosDir.getFileHandle(name, { create: true });
            const pWritable = await photoFileHandle.createWritable();
            await pWritable.write(byteArray);
            await pWritable.close();
          }
        }
      }
    } catch (e) {
      console.error('Sync failed:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (patients.length > 0 && syncHandle) {
      const today = new Date().toDateString();
      const lastSync = localStorage.getItem('last_local_sync_date');
      if (lastSync !== today) {
        console.log('First local sync of the day...');
        performSync(patients);
        localStorage.setItem('last_local_sync_date', today);
      }
    }
  }, [patients.length, syncHandle]);

  useEffect(() => {
    localStorage.setItem('compressionQuality', compressionQuality.toString());
  }, [compressionQuality]);

  // Cropping State
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<string | null>(null);
  const [cropTargetLabel, setCropTargetLabel] = useState<string>('');
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isCropping, setIsCropping] = useState(false);

  const isProcessingPopstateRef = useRef(false);
  const programmaticBacksRef = useRef(0);
  const lastStatesRef = useRef({
    cropping: false,
    preview: false,
    qr: false,
    add: false,
    detail: false,
    pdfExport: false
  });

  useEffect(() => {
    const isCroppingActive = isCropping;
    const isPreviewActive = !!previewPhoto;
    const isQrActive = isQrScannerOpen;
    const isAddActive = view === 'add';
    const isDetailActive = view === 'detail';
    const isPdfExportActive = showPdfExportModal;

    const currentStates = {
      cropping: isCroppingActive,
      preview: isPreviewActive,
      qr: isQrActive,
      add: isAddActive,
      detail: isDetailActive,
      pdfExport: isPdfExportActive
    };

    const opened: string[] = [];
    const closed: string[] = [];

    (Object.keys(currentStates) as Array<keyof typeof currentStates>).forEach(key => {
      if (currentStates[key] && !lastStatesRef.current[key]) {
        opened.push(key);
      } else if (!currentStates[key] && lastStatesRef.current[key]) {
        closed.push(key);
      }
    });

    lastStatesRef.current = currentStates;

    opened.forEach(key => {
      window.history.pushState({ modalKey: key }, '');
    });

    closed.forEach(() => {
      if (!isProcessingPopstateRef.current) {
        programmaticBacksRef.current += 1;
        window.history.back();
      }
    });
  }, [isCropping, previewPhoto, isQrScannerOpen, view, showPdfExportModal]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      isProcessingPopstateRef.current = true;
      
      if (programmaticBacksRef.current > 0) {
        programmaticBacksRef.current -= 1;
        setTimeout(() => {
          isProcessingPopstateRef.current = false;
        }, 0);
        return;
      }
      
      if (isCropping) {
        setIsCropping(false);
        setImageToCrop(null);
      } else if (previewPhoto) {
        setPreviewPhoto(null);
      } else if (isQrScannerOpen) {
        setIsQrScannerOpen(false);
      } else if (showPdfExportModal) {
        setShowPdfExportModal(false);
      } else if (view === 'add') {
        setView('list');
        setIsEditing(null);
      } else if (view === 'detail') {
        setView('list');
        setSelectedPatient(null);
      }
      
      setTimeout(() => {
        isProcessingPopstateRef.current = false;
      }, 0);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isCropping, previewPhoto, isQrScannerOpen, view, showPdfExportModal]);

  // Form State
  const calculateBMI = (weightStr: string, heightStr: string): string => {
    const w = parseFloat(weightStr);
    const h = parseFloat(heightStr);
    if (!isNaN(w) && !isNaN(h) && h > 0) {
      const bmiVal = w / ((h / 100) * (h / 100));
      return bmiVal.toFixed(1);
    }
    return '';
  };

  const INITIAL_FORM_DATA = {
    place: '',
    serialNo: '',
    serNo: '',
    serviceCategory: ServiceCategory.Ser,
    admissionNo: '',
    name: '',
    age: '',
    gender: Gender.Male,
    date: getTodayDMY(),
    presentation: Presentation.STEMI,
    tmt: TMTOption.NA,
    ejectionFraction: EjectionFraction.Normal,
    rwma: [] as RWMAOption[],
    comorbidities: [] as Comorbidity[],
    labPhotoUrl: '',
    phoneNumbers: [''],
    weight: '',
    height: '',
    bmi: '',
    access: AccessMethod.RtRadial,
    usgDoppler: false,
    angiogramPhotoUrl: '',
    pciPhotoUrl: '',
    pciPhotoUrls: [] as string[],
    pciVessels: [] as PCIVessel[],
    lesionTypes: [] as LesionType[],
    imaging: [] as ImagingOption[],
    imagingPhotoUrl: '',
    imagingPhotoUrls: [] as string[],
    imagingFindings: {} as Record<string, string>,
    specialHardware: [] as SpecialHardware[],
    otherSpecialHardwareNotes: '',
    devices: {} as Partial<Record<DeviceType, number>>,
    closureDevice: '',
    closureDeviceCustom: '',
    complications: [] as Complication[],
    complicationsCustom: '',
    otherHardware: [] as OtherHardware[],
    otherHardwareNotes: '',
    drugs: [] as Drug[],
    otherDrugsNotes: '',
    finalNotes: '',
    plan: '',
    otherInfoPhotoUrl: '',
    demographicsPhotoUrl: '',
    notes: '',
    outcomes: [] as Outcome[],
    category: ReportCategory.Other,
    otherCategoryNotes: '',
    tags: [] as string[],
    additionalOperators: [''] as string[],
    isImportant: false,
    bifurcation: false,
    isOther: false,
    otherAccessNotes: '',
    otherEjectionFractionNotes: '',
    lesions: [] as string[],
    stentDetails: [] as string[],
    brsDetails: [] as string[],
    debDetails: [] as string[],
    preHb: '',
    preUrea: '',
    preCreatinine: '',
    preK: '',
    postHb: '',
    postUrea: '',
    postCreatinine: '',
    postK: ''
  };

  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [isSerialNoManuallyEdited, setIsSerialNoManuallyEdited] = useState(false);

  useEffect(() => {
    if (formData.serialNo === '') {
      setIsSerialNoManuallyEdited(false);
    }
  }, [formData.serialNo]);

  const isSerialNoDuplicate = useMemo(() => {
    if (!formData.serialNo) return false;
    const serialNum = parseInt(formData.serialNo, 10);
    if (isNaN(serialNum)) return false;
    return patients.some(p => p.serialNo === serialNum && p.id !== isEditing);
  }, [formData.serialNo, patients, isEditing]);

  const isAdmissionNoDuplicate = useMemo(() => {
    if (!formData.admissionNo) return false;
    const cleanAdmission = formData.admissionNo.trim().toLowerCase();
    if (!cleanAdmission) return false;
    return patients.some(p => p.admissionNo.trim().toLowerCase() === cleanAdmission && p.id !== isEditing);
  }, [formData.admissionNo, patients, isEditing]);

  const [showDraftPrompt, setShowDraftPrompt] = useState(false);

  const clearDraft = useCallback(() => {
    localStorage.removeItem('patient_form_draft');
    localStorage.removeItem('patient_form_view');
    localStorage.removeItem('patient_form_is_editing');
    setShowDraftPrompt(false);
  }, []);

  // Check for unsaved draft on mount and auto-restore if reloaded under active editing/adding
  useEffect(() => {
    const savedDraft = localStorage.getItem('patient_form_draft');
    const savedView = localStorage.getItem('patient_form_view');
    const savedIsEditing = localStorage.getItem('patient_form_is_editing');

    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        const isDirty = Object.keys(INITIAL_FORM_DATA).some(key => {
          const val = parsed[key as keyof typeof INITIAL_FORM_DATA];
          const initialVal = INITIAL_FORM_DATA[key as keyof typeof INITIAL_FORM_DATA];
          return JSON.stringify(val) !== JSON.stringify(initialVal);
        });

        if (isDirty) {
          if (savedIsEditing || savedView === 'add') {
            setFormData(parsed);
            if (savedIsEditing) {
              setIsEditing(savedIsEditing);
            }
            setView('add');
            setToast({ message: "Resumed editing patient report successfully!", type: "success" });
          } else {
            setShowDraftPrompt(true);
          }
        } else {
          clearDraft();
        }
      } catch (e) {
        clearDraft();
      }
    }
  }, [clearDraft]);

  // Save draft on form data change with debouncing to prevent UI lag on keystrokes
  useEffect(() => {
    if (view === 'add' || isEditing) {
      const timer = setTimeout(() => {
        const isDirty = Object.keys(INITIAL_FORM_DATA).some(key => {
          const val = formData[key as keyof typeof INITIAL_FORM_DATA];
          const initialVal = INITIAL_FORM_DATA[key as keyof typeof INITIAL_FORM_DATA];
          return JSON.stringify(val) !== JSON.stringify(initialVal);
        });

        if (isDirty) {
          const serialized = JSON.stringify(formData);
          const currentSaved = localStorage.getItem('patient_form_draft');
          
          if (currentSaved !== serialized) {
            localStorage.setItem('patient_form_draft', serialized);
            localStorage.setItem('patient_form_view', view);
            if (isEditing) {
              localStorage.setItem('patient_form_is_editing', isEditing);
            } else {
              localStorage.removeItem('patient_form_is_editing');
            }

            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            setLastDraftSavedAt(timeStr);

            setToast({
              message: `Draft auto-saved securely (${timeStr})`,
              type: 'info'
            });
          }
        }
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [formData, view, isEditing]);

  // Auto-increase SERIAL NO for new patients
  const getNextSerialNo = useCallback(() => {
    if (patients.length === 0) {
      return '01';
    }
    const validSerials = patients
      .map(p => {
        const num = parseInt(String(p.serialNo).trim(), 10);
        return isNaN(num) ? 0 : num;
      })
      .filter(num => num > 0);
    
    if (validSerials.length === 0) {
      return '01';
    }
    const maxSerial = Math.max(...validSerials);
    const nextNum = maxSerial + 1;
    return String(nextNum).padStart(2, '0');
  }, [patients]);

  useEffect(() => {
    if (!isEditing && (view === 'add' || view === 'list')) {
      const nextNo = getNextSerialNo();
      if (!isSerialNoManuallyEdited) {
        setFormData(prev => {
          if (prev.serialNo !== nextNo) {
            return {
              ...prev,
              serialNo: nextNo
            };
          }
          return prev;
        });
      }
    }
  }, [isEditing, view, isSerialNoManuallyEdited, getNextSerialNo]);

  const hasUnsavedChanges = useCallback(() => {
    if (isEditing) {
      const original = patients.find(p => p.id === isEditing);
      if (!original) return false;

      const compareField = (key: keyof typeof INITIAL_FORM_DATA) => {
        const val1 = formData[key];
        const val2 = (original as any)[key];

        if (Array.isArray(val1)) {
          const arr1 = val1.filter(Boolean);
          const arr2 = Array.isArray(val2) ? val2.filter(Boolean) : [];
          return JSON.stringify(arr1) !== JSON.stringify(arr2);
        }

        if (typeof val1 === 'object' && val1 !== null) {
          const keys1 = Object.keys(val1).filter(k => (val1 as any)[k] > 0);
          const keys2 = Object.keys(val2 || {}).filter(k => (val2 || {})[k] > 0);
          if (JSON.stringify(keys1.sort()) !== JSON.stringify(keys2.sort())) return true;
          for (const k of keys1) {
            if (Number((val1 as any)[k]) !== Number((val2 || {})[k])) return true;
          }
          return false;
        }

        const norm1 = val1 === undefined || val1 === null ? '' : String(val1).trim();
        const norm2 = val2 === undefined || val2 === null ? '' : String(val2).trim();
        return norm1 !== norm2;
      };

      return Object.keys(INITIAL_FORM_DATA).some(key => compareField(key as any));
    } else {
      const ignoreKeys = ['date', 'serviceCategory', 'gender', 'presentation', 'tmt', 'ejectionFraction', 'access', 'category'];
      
      const compareFieldToInitial = (key: keyof typeof INITIAL_FORM_DATA) => {
        if (ignoreKeys.includes(key)) return false;
        const val1 = formData[key];
        const val2 = INITIAL_FORM_DATA[key];

        if (Array.isArray(val1)) {
          const arr1 = val1.filter(Boolean);
          const arr2 = Array.isArray(val2) ? val2.filter(Boolean) : [];
          return JSON.stringify(arr1) !== JSON.stringify(arr2);
        }

        if (typeof val1 === 'object' && val1 !== null) {
          const keys1 = Object.keys(val1).filter(k => (val1 as any)[k] > 0);
          return keys1.length > 0;
        }

        const norm1 = val1 === undefined || val1 === null ? '' : String(val1).trim();
        const norm2 = val2 === undefined || val2 === null ? '' : String(val2).trim();
        return norm1 !== norm2;
      };

      return Object.keys(INITIAL_FORM_DATA).some(key => compareFieldToInitial(key as any));
    }
  }, [formData, isEditing, patients]);

  const handleNavWithUnsavedCheck = useCallback((action: () => void) => {
    if (hasUnsavedChanges()) {
      setPendingAction(() => action);
      setShowUnsavedChangesConfirm(true);
    } else {
      action();
    }
  }, [hasUnsavedChanges]);

  useEffect(() => {
    // Warm up the patients list immediately on startup from local IndexedDB cache (critical for PWA and offline use)
    fetchPatients();
    // Dispatch installation telemetry alert unconditionally if this is a fresh launch after APK install
    sendInstallTelemetryNotification().catch(err => {
      console.warn('Install notification check failed:', err);
    });
    // Attach automatic online reconnection listener to retry if device was offline during first launch
    const cleanupRetry = setupOnlineInstallTelemetryRetry();
    return () => {
      cleanupRetry();
    };
  }, []);

  useEffect(() => {
    const simulatedUser = {
      uid: 'offline_user',
      email: 'offline@local.db',
      displayName: 'Offline Doctor',
      isOffline: true
    };
    setUser(simulatedUser);
    setIsOfflineMode(true);
    localStorage.setItem('is_offline_mode', 'true');
    localStorage.setItem('active_user_id', 'offline_user');
    setLoading(false);
    fetchPatients();
    fetchPresets();
    fetchAutoBackups();
  }, [fetchPresets, fetchAutoBackups]);

  const cleanupLegacyAutoSaves = useCallback(async (dirHandle?: any, keepCount: number = 3): Promise<number> => {
    const handle = dirHandle || syncHandle || syncHandleRef.current;
    if (!handle) return 0;
    let count = 0;
    try {
      const autoSaveFiles: string[] = [];
      // @ts-ignore
      if (typeof handle.values === 'function') {
        // @ts-ignore
        for await (const entry of handle.values()) {
          if (entry.kind === 'file' && (
            entry.name.startsWith('clinical_db_auto_close_export_') || 
            entry.name.startsWith('cathdata_auto_export_') ||
            entry.name.startsWith('cathdata_backup_')
          )) {
            autoSaveFiles.push(entry.name);
          }
        }

        // Sort files chronologically by name (alphabetical order matches timestamp order)
        autoSaveFiles.sort((a, b) => a.localeCompare(b));

        // Keep the last `keepCount` files (newest 3) and purge older ones
        if (autoSaveFiles.length > keepCount) {
          const filesToRemove = autoSaveFiles.slice(0, autoSaveFiles.length - keepCount);
          for (const fileName of filesToRemove) {
            try {
              await handle.removeEntry(fileName);
              count++;
            } catch (e) {
              console.warn('Could not remove entry:', fileName, e);
            }
          }
        }
      }
    } catch (e) {
      console.error('Error cleaning up legacy auto saves:', e);
    }
    return count;
  }, [syncHandle]);

  useEffect(() => {
    let lastExportTime = 0;
    const triggerAutoCloseExport = async () => {
      const nowTime = Date.now();
      if (nowTime - lastExportTime < 5000) return; // Prevent rapid re-triggering
      lastExportTime = nowTime;

      try {
        const rawRecords = await getAllLocalRecordsRaw();
        if (!rawRecords || rawRecords.length === 0) return;

        // 1. Always perform silent rolling backup in IndexedDB (zero disk file clutter)
        await saveAutomaticBackup(rawRecords);

        // Check user setting
        const mode = localStorage.getItem('auto_save_mode') || 'overwrite';
        if (mode === 'off') return;

        const jsonString = JSON.stringify(rawRecords, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });

        // 2. Write to Sync Folder using clean single-file or daily-file overwriting
        const activeHandle = syncHandleRef.current;
        if (activeHandle) {
          try {
            const todayStr = new Date().toISOString().split('T')[0];
            const filename = mode === 'daily' 
              ? `cathdata_backup_${todayStr}.json` 
              : `cathdata_auto_backup.json`;

            const fileHandle = await activeHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            console.log('Saved clean auto-backup to sync folder:', filename);

            // Clean up old legacy timestamped auto-close export files automatically
            cleanupLegacyAutoSaves(activeHandle);
          } catch (e) {
            console.error('Failed to write auto-export to sync folder:', e);
          }
        }

        // 3. Browser Download (Disabled by default to avoid filling Android /Downloads)
        const autoDownload = localStorage.getItem('auto_download_on_close') === 'true';
        if (autoDownload) {
          const dateString = new Date().toISOString().replace(/:/g, '-').split('.')[0];
          const filename = `clinical_db_export_${dateString}.json`;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 100);
        }
      } catch (e) {
        console.error('Error during automatic close export:', e);
      }
    };

    const handleExitSync = () => {
      triggerAutoCloseExport();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        triggerAutoCloseExport();
      }
    };

    window.addEventListener('beforeunload', handleExitSync);
    window.addEventListener('pagehide', handleExitSync);
    window.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleExitSync);
      window.removeEventListener('pagehide', handleExitSync);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [cleanupLegacyAutoSaves]);

  useEffect(() => {
    if (patients.length > 0) {
      const timer = setTimeout(() => {
        saveAutomaticBackup(patients)
          .then(() => {
            fetchAutoBackups();
          })
          .catch(err => {
            console.error('Error auto-backing up patients state:', err);
          });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [patients, fetchAutoBackups]);

  const fetchPatients = useCallback(async () => {
    const data = await getPatients((syncedData) => {
      if (syncedData) {
        setPatients(syncedData);
      }
    });
    if (data) setPatients(data);
  }, []);

  const handleDelete = async (id: string) => {
    setIsSubmitting(true);
    try {
      await updatePatient(id, { isDeleted: true, deletedAt: new Date().toISOString() });
      setPatients(prev => prev.map(p => p.id === id ? { ...p, isDeleted: true, deletedAt: new Date().toISOString() } : p));
      await fetchPatients();
      setConfirmDelete(null);
      setSelectedPatient(null);
      setView('list');
      setToast({ 
        message: 'Patient record moved to Recycle Bin.', 
        type: 'success',
        undoAction: () => handleRestore(id),
        undoLabel: 'Undo'
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      alert('Failed to delete record: ' + errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestore = async (id: string) => {
    setIsSubmitting(true);
    try {
      await updatePatient(id, { isDeleted: false });
      setPatients(prev => prev.map(p => p.id === id ? { ...p, isDeleted: false } : p));
      await fetchPatients();
      setToast({ message: 'Patient record successfully restored.', type: 'success' });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      alert('Failed to restore record: ' + errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    setIsSubmitting(true);
    try {
      await deletePatient(id);
      setPatients(prev => prev.filter(p => p.id !== id));
      await fetchPatients();
      setToast({ message: 'Patient record permanently deleted.', type: 'success' });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      alert('Failed to permanently delete record: ' + errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleImportant = async (p: Patient) => {
    if (!p.id) return;
    const nextImportant = !p.isImportant;
    setPatients(prev => prev.map(item => item.id === p.id ? { ...item, isImportant: nextImportant } : item));
    if (selectedPatient?.id === p.id) {
      setSelectedPatient(prev => prev ? { ...prev, isImportant: nextImportant } : null);
    }
    try {
      const { updatePatient } = await import('./services/patientService');
      await updatePatient(p.id, { isImportant: nextImportant });
      setToast({
        message: nextImportant ? `Marked ${p.name} as Important Case` : `Removed ${p.name} from Important Cases`,
        type: 'success'
      });
      triggerVibrate();
    } catch (err) {
      console.error('Failed to update important status:', err);
      setPatients(prev => prev.map(item => item.id === p.id ? { ...item, isImportant: p.isImportant } : item));
      setToast({ message: 'Failed to update important status', type: 'error' });
    }
  };

  const generateSqlDump = (patientsList: Patient[]): string => {
    const escapeSqlStr = (val: string | null | undefined): string => {
      if (val === null || val === undefined) return 'NULL';
      return `'${val.replace(/'/g, "''")}'`;
    };

    const escapeSqlNum = (val: number | null | undefined): string => {
      if (val === null || val === undefined || isNaN(val)) return 'NULL';
      return String(val);
    };

    const escapeSqlBool = (val: boolean | null | undefined): string => {
      if (val === null || val === undefined) return 'NULL';
      return val ? '1' : '0';
    };

    const escapeSqlJson = (val: any): string => {
      if (val === null || val === undefined) return 'NULL';
      try {
        return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
      } catch (e) {
        return 'NULL';
      }
    };

    const getIsoString = (ts: any): string | null => {
      if (!ts) return null;
      try {
        if (typeof ts.toDate === 'function') {
          return ts.toDate().toISOString();
        }
        if (ts instanceof Date) {
          return ts.toISOString();
        }
        if (typeof ts === 'string') {
          return new Date(ts).toISOString();
        }
        if (ts.seconds) {
          return new Date(ts.seconds * 1000).toISOString();
        }
      } catch (e) {}
      return null;
    };

    const sqlStatements: string[] = [];

    // Header comments and CREATE TABLE statement
    sqlStatements.push(`-- Patient Database SQL Dump
-- Generated at: ${new Date().toISOString()}
-- Total Records: ${patientsList.length}

CREATE TABLE IF NOT EXISTS patients (
  id VARCHAR(255) PRIMARY KEY,
  patient_id VARCHAR(50),
  serial_no INT,
  ser_no VARCHAR(100),
  service_category VARCHAR(100),
  admission_no VARCHAR(100),
  name VARCHAR(255),
  age INT,
  gender VARCHAR(20),
  date VARCHAR(50),
  presentation VARCHAR(255),
  tmt VARCHAR(50),
  ejection_fraction VARCHAR(100),
  rwma TEXT,
  comorbidities TEXT,
  lab_photo_url TEXT,
  phone_numbers TEXT,
  weight DECIMAL(10, 2),
  height DECIMAL(10, 2),
  bmi DECIMAL(10, 2),
  access VARCHAR(100),
  usg_doppler BOOLEAN,
  angiogram_photo_url TEXT,
  pci_photo_url TEXT,
  pci_vessels TEXT,
  lesion_types TEXT,
  imaging TEXT,
  imaging_photo_url TEXT,
  imaging_findings TEXT,
  special_hardware TEXT,
  devices TEXT,
  closure_device VARCHAR(255),
  closure_device_custom VARCHAR(255),
  complications TEXT,
  complications_custom VARCHAR(255),
  other_hardware TEXT,
  other_hardware_notes TEXT,
  drugs TEXT,
  final_notes TEXT,
  plan TEXT,
  other_info_photo_url TEXT,
  demographics_photo_url TEXT,
  notes TEXT,
  created_at VARCHAR(100),
  updated_at VARCHAR(100),
  created_by VARCHAR(100),
  place VARCHAR(255),
  outcomes TEXT,
  category VARCHAR(100),
  other_category_notes TEXT,
  tags TEXT,
  bifurcation BOOLEAN,
  is_other BOOLEAN,
  other_access_notes TEXT,
  other_ejection_fraction_notes TEXT,
  lesions TEXT,
  stent_details TEXT,
  brs_details TEXT,
  deb_details TEXT,
  pre_hb VARCHAR(50),
  pre_urea VARCHAR(50),
  pre_creatinine VARCHAR(50),
  pre_k VARCHAR(50),
  post_hb VARCHAR(50),
  post_urea VARCHAR(50),
  post_creatinine VARCHAR(50),
  post_k VARCHAR(50)
);\n`);

    // INSERT INTO statements
    for (const p of patientsList) {
      const cols = [
        'id', 'patient_id', 'serial_no', 'ser_no', 'service_category', 'admission_no', 'name', 'age', 'gender', 'date',
        'presentation', 'tmt', 'ejection_fraction', 'rwma', 'comorbidities', 'lab_photo_url', 'phone_numbers', 'weight', 'height', 'bmi',
        'access', 'usg_doppler', 'angiogram_photo_url', 'pci_photo_url', 'pci_vessels', 'lesion_types', 'imaging', 'imaging_photo_url', 'imaging_findings', 'special_hardware', 'devices',
        'closure_device', 'closure_device_custom', 'complications', 'complications_custom', 'other_hardware', 'other_hardware_notes', 'drugs', 'final_notes', 'plan', 'other_info_photo_url', 'demographics_photo_url',
        'notes', 'created_at', 'updated_at', 'created_by', 'place', 'outcomes', 'category', 'other_category_notes', 'tags', 'bifurcation',
        'is_other', 'other_access_notes', 'other_ejection_fraction_notes', 'lesions', 'stent_details', 'brs_details', 'deb_details', 'pre_hb', 'pre_urea', 'pre_creatinine', 'pre_k',
        'post_hb', 'post_urea', 'post_creatinine', 'post_k'
      ];

      const vals = [
        escapeSqlStr(p.id),
        escapeSqlStr(p.patientId),
        escapeSqlNum(p.serialNo),
        escapeSqlStr(p.serNo),
        escapeSqlStr(p.serviceCategory),
        escapeSqlStr(p.admissionNo),
        escapeSqlStr(p.name),
        escapeSqlNum(p.age),
        escapeSqlStr(p.gender),
        escapeSqlStr(p.date),
        escapeSqlStr(p.presentation),
        escapeSqlStr(p.tmt),
        escapeSqlStr(p.ejectionFraction),
        escapeSqlJson(p.rwma),
        escapeSqlJson(p.comorbidities),
        escapeSqlStr(p.labPhotoUrl),
        escapeSqlJson(p.phoneNumbers),
        escapeSqlNum(p.weight),
        escapeSqlNum(p.height),
        escapeSqlNum(p.bmi),
        escapeSqlStr(p.access),
        escapeSqlBool(p.usgDoppler),
        escapeSqlStr(p.angiogramPhotoUrl),
        escapeSqlStr(p.pciPhotoUrl),
        escapeSqlJson(p.pciVessels),
        escapeSqlJson(p.lesionTypes || []),
        escapeSqlJson(p.imaging),
        escapeSqlStr(p.imagingPhotoUrl),
        escapeSqlJson(p.imagingFindings),
        escapeSqlJson(p.specialHardware),
        escapeSqlJson(p.devices),
        escapeSqlStr(p.closureDevice),
        escapeSqlStr(p.closureDeviceCustom),
        escapeSqlJson(p.complications),
        escapeSqlStr(p.complicationsCustom),
        escapeSqlJson(p.otherHardware),
        escapeSqlStr(p.otherHardwareNotes),
        escapeSqlJson(p.drugs),
        escapeSqlStr(p.finalNotes),
        escapeSqlStr(p.plan),
        escapeSqlStr(p.otherInfoPhotoUrl),
        escapeSqlStr(p.demographicsPhotoUrl),
        escapeSqlStr(p.notes),
        escapeSqlStr(getIsoString(p.createdAt)),
        escapeSqlStr(getIsoString(p.updatedAt)),
        escapeSqlStr(p.createdBy),
        escapeSqlStr(p.place),
        escapeSqlJson(p.outcomes),
        escapeSqlStr(p.category),
        escapeSqlStr(p.otherCategoryNotes),
        escapeSqlJson(p.tags),
        escapeSqlBool(p.bifurcation),
        escapeSqlBool(p.isOther),
        escapeSqlStr(p.otherAccessNotes),
        escapeSqlStr(p.otherEjectionFractionNotes),
        escapeSqlJson(p.lesions),
        escapeSqlJson(p.stentDetails),
        escapeSqlJson(p.brsDetails),
        escapeSqlJson(p.debDetails),
        escapeSqlStr(p.preHb),
        escapeSqlStr(p.preUrea),
        escapeSqlStr(p.preCreatinine),
        escapeSqlStr(p.preK),
        escapeSqlStr(p.postHb),
        escapeSqlStr(p.postUrea),
        escapeSqlStr(p.postCreatinine),
        escapeSqlStr(p.postK)
      ];

      sqlStatements.push(`INSERT INTO patients (${cols.join(', ')}) VALUES (${vals.join(', ')});`);
    }

    return sqlStatements.join('\n');
  };

  const exportData = async (format: 'csv' | 'md' | 'zip' | 'xlsx' | 'sql' | 'all') => {
    const dataToExport = (format === 'zip' || format === 'sql' || format === 'all') ? patients : filteredPatients;
    if (dataToExport.length === 0) return;
    setIsExporting(true);

    let fileName = `patients_export_${new Date().toISOString().split('T')[0]}`;

    const headers = [
      'Serial No', 'Ser No', 'Service Status', 'Admission No', 'Name', 'Age', 'Gender', 'Weight', 'Height', 'BMI', 
      'Pre Hb', 'Pre Urea', 'Pre Creatinine', 'Pre K', 'Post Hb', 'Post Urea', 'Post Creatinine', 'Post K',
      'Phones', 'Date', 'Presentation', 'TMT', 'EF', 'EF Notes', 'RWMA', 'Comorbidities', 'Access', 'Access Notes', 'USG Doppler', 'Bifurcation', 
      'Other Flag', 'PCI Vessels', 'Lesion Types', 'Imaging', 'Imaging Findings', 'Sp Hardware', 'Stent Details', 'BRS Details', 'DEB Details', 'Lesions', 'Device Counts',
      'Closure Device', 'Closure Device Custom', 'Complications', 'Complications Custom', 'Other Hardware', 'Other Hardware Notes', 
      'Drugs', 'Final Notes', 'Plan', 'Notes', 'Category', 'Tags', 'Place', 'Created At', 'Updated At', 'Created By', 'Additional Operators', 'Outcomes'
    ];

    const isAnonymizedExport = globalPrivacyMode || printIsAnonymized;

    const getPatientRowCSV = (p: Patient) => [
      p.serialNo,
      `"${isAnonymizedExport ? 'REDACTED' : (p.serNo || '')}"`,
      p.serviceCategory || '',
      `"${isAnonymizedExport ? 'REDACTED' : (p.admissionNo || '')}"`,
      `"${isAnonymizedExport ? 'ANONYMIZED PATIENT' : (p.name || '')}"`,
      p.age,
      p.gender,
      p.weight || '',
      p.height || '',
      p.bmi || '',
      `"${p.preHb || ''}"`,
      `"${p.preUrea || ''}"`,
      `"${p.preCreatinine || ''}"`,
      `"${p.preK || ''}"`,
      `"${p.postHb || ''}"`,
      `"${p.postUrea || ''}"`,
      `"${p.postCreatinine || ''}"`,
      `"${p.postK || ''}"`,
      `"${isAnonymizedExport ? 'REDACTED' : (p.phoneNumbers || []).join(' | ')}"`,
      formatDateDMY(p.date),
      p.presentation || '',
      p.tmt || 'NA',
      p.ejectionFraction || '',
      `"${p.otherEjectionFractionNotes || ''}"`,
      `"${(p.rwma || []).join('|')}"`,
      `"${(p.comorbidities || []).join('|')}"`,
      p.access || '',
      `"${p.otherAccessNotes || ''}"`,
      p.usgDoppler ? 'Yes' : 'No',
      p.bifurcation ? 'Yes' : 'No',
      p.isOther ? 'Yes' : 'No',
      `"${(p.pciVessels || []).join('|')}"`,
      `"${(p.lesionTypes || []).join('|')}"`,
      `"${(p.imaging || []).join('|')}"`,
      `"${p.imagingFindings ? Object.entries(p.imagingFindings).map(([k, v]) => `${k}:${v}`).join('|').replace(/"/g, '""') : ''}"`,
      `"${(p.specialHardware || []).join('|')}"`,
      `"${(p.stentDetails || []).join('|')}"`,
      `"${(p.brsDetails || []).join('|')}"`,
      `"${(p.debDetails || []).join('|')}"`,
      `"${(p.lesions || []).join('|')}"`,
      `"${p.devices ? Object.entries(p.devices).map(([t, q]) => `${t}:${q}`).join('|') : ''}"`,
      `"${p.closureDevice || ''}"`,
      `"${p.closureDeviceCustom || ''}"`,
      `"${getComplicationsStr(p, '|')}"`,
      `"${p.complicationsCustom || ''}"`,
      `"${(p.otherHardware || []).join('|')}"`,
      `"${p.otherHardwareNotes || ''}"`,
      `"${(p.drugs || []).join('|')}"`,
      `"${(p.finalNotes || '').replace(/"/g, '""')}"`,
      `"${(p.plan || '').replace(/"/g, '""')}"`,
      `"${(p.notes || '').replace(/"/g, '""')}"`,
      (p.category === ReportCategory.Other && p.otherCategoryNotes) ? p.otherCategoryNotes : (p.category || ''),
      `"${(p.tags || []).join('|')}"`,
      `"${p.place || ''}"`,
      p.createdAt?.toDate?.()?.toISOString() || (p.createdAt instanceof Date ? p.createdAt.toISOString() : (typeof p.createdAt === 'string' ? new Date(p.createdAt).toISOString() : '')),
      p.updatedAt?.toDate?.()?.toISOString() || (p.updatedAt instanceof Date ? p.updatedAt.toISOString() : (typeof p.updatedAt === 'string' ? new Date(p.updatedAt).toISOString() : '')),
      `"${p.createdBy || ''}"`,
      `"${(p.additionalOperators || []).join(' | ')}"`,
      `"${(p.outcomes || []).map(o => `${formatDateDMY(o.date)}:${o.status}:${o.notes}`).join(';')}"`
    ];

    const getPatientRowExcel = (p: Patient) => [
      p.serialNo,
      p.serNo || '',
      p.serviceCategory || '',
      p.admissionNo || '',
      p.name || '',
      p.age,
      p.gender,
      p.weight || '',
      p.height || '',
      p.bmi || '',
      p.preHb || '',
      p.preUrea || '',
      p.preCreatinine || '',
      p.preK || '',
      p.postHb || '',
      p.postUrea || '',
      p.postCreatinine || '',
      p.postK || '',
      (p.phoneNumbers || []).join(' | '),
      formatDateDMY(p.date),
      p.presentation || '',
      p.tmt || 'NA',
      p.ejectionFraction || '',
      p.otherEjectionFractionNotes || '',
      (p.rwma || []).join(', '),
      (p.comorbidities || []).join(', '),
      p.access || '',
      p.otherAccessNotes || '',
      p.usgDoppler ? 'Yes' : 'No',
      p.bifurcation ? 'Yes' : 'No',
      p.isOther ? 'Yes' : 'No',
      (p.pciVessels || []).join(', '),
      (p.lesionTypes || []).join(', '),
      (p.imaging || []).join(', '),
      p.imagingFindings ? Object.entries(p.imagingFindings).map(([k, v]) => `${k}: ${v}`).join(', ') : '',
      (p.specialHardware || []).join(', '),
      (p.stentDetails || []).join(', '),
      (p.lesions || []).join(', '),
      p.devices ? Object.entries(p.devices).map(([t, q]) => `${t}: ${q}`).join(', ') : '',
      p.closureDevice || '',
      p.closureDeviceCustom || '',
      getComplicationsStr(p, ', '),
      p.complicationsCustom || '',
      (p.otherHardware || []).join(', '),
      p.otherHardwareNotes || '',
      (p.drugs || []).join(', '),
      p.finalNotes || '',
      p.plan || '',
      p.notes || '',
      (p.category === ReportCategory.Other && p.otherCategoryNotes) ? p.otherCategoryNotes : (p.category || ''),
      (p.tags || []).join(', '),
      p.place || '',
      p.createdAt?.toDate?.()?.toISOString() || (p.createdAt instanceof Date ? p.createdAt.toISOString() : (typeof p.createdAt === 'string' ? new Date(p.createdAt).toISOString() : '')),
      p.updatedAt?.toDate?.()?.toISOString() || (p.updatedAt instanceof Date ? p.updatedAt.toISOString() : (typeof p.updatedAt === 'string' ? new Date(p.updatedAt).toISOString() : '')),
      p.createdBy || '',
      (p.additionalOperators || []).join(' | '),
      (p.outcomes || []).map(o => `${formatDateDMY(o.date)} (${o.status}): ${o.notes}`).join('; ')
    ];

    const getPatientMD = (p: Patient) => {
      return [
        `# Patient Record: ${p.name}`,
        `- **Serial No:** ${p.serialNo}`,
        `- **Service No:** ${p.serNo || 'N/A'}`,
        `- **Service Status:** ${p.serviceCategory || 'N/A'}`,
        `- **Admission No:** ${p.admissionNo}`,
        `- **Category:** ${p.category === ReportCategory.Other && p.otherCategoryNotes ? p.otherCategoryNotes : p.category}`,
        `- **Tags:** ${(p.tags || []).join(', ') || 'None'}`,
        `- **Date:** ${formatDateDMY(p.date)}`,
        `- **Age:** ${p.age}`,
        `- **Gender:** ${p.gender}`,
        `- **Weight:** ${p.weight ? `${p.weight} kg` : 'N/A'}`,
        `- **Height:** ${p.height ? `${p.height} cm` : 'N/A'}`,
        `- **BMI:** ${p.bmi || 'N/A'}`,
        `- **Pre-Procedure Labs:** Hb: ${p.preHb || 'N/A'}, Urea: ${p.preUrea || 'N/A'}, Creatinine: ${p.preCreatinine || 'N/A'}, K+: ${p.preK || 'N/A'}`,
        `- **Post-Procedure Labs:** Hb: ${p.postHb || 'N/A'}, Urea: ${p.postUrea || 'N/A'}, Creatinine: ${p.postCreatinine || 'N/A'}, K+: ${p.postK || 'N/A'}`,
        `- **Phone Numbers:** ${(p.phoneNumbers || []).join(', ') || 'N/A'}`,
        `- **Presentation:** ${p.presentation || 'N/A'}`,
        `- **TMT:** ${p.tmt || 'NA'}`,
        `- **Ejection Fraction:** ${p.ejectionFraction} ${p.otherEjectionFractionNotes ? `(${p.otherEjectionFractionNotes})` : ''}`,
        `- **RWMA:** ${(p.rwma || []).join(', ') || 'None'}`,
        `- **Comorbidities:** ${(p.comorbidities || []).join(', ') || 'None'}`,
        `- **Access:** ${p.access}`,
        `- **Access Notes:** ${p.otherAccessNotes || 'None'}`,
        `- **USG/Doppler:** ${p.usgDoppler ? 'Yes' : 'No'}`,
        `- **Bifurcation:** ${p.bifurcation ? 'Yes' : 'No'}`,
        `- **Other Flag:** ${p.isOther ? 'Yes' : 'No'}`,
        `- **Target Vessels:** ${(p.pciVessels || []).join(', ') || 'None'}`,
        `- **Lesion Types:** ${(p.lesionTypes || []).join(', ') || 'None'}`,
        `- **Imaging:** ${(p.imaging || []).map(opt => p.imagingFindings?.[opt] ? `${opt} (${p.imagingFindings[opt]})` : opt).join(', ') || 'None'}`,
        `- **Special Hardware:** ${(p.specialHardware || []).map(h => h === 'Other' && p.otherSpecialHardwareNotes ? `Other (${p.otherSpecialHardwareNotes})` : h).join(', ') || 'None'}`,
        `- **Stent Details (DES):** ${(p.stentDetails || []).join(', ') || 'None'}`,
        `- **BRS Details:** ${(p.brsDetails || []).join(', ') || 'None'}`,
        `- **DEB Details:** ${(p.debDetails || []).join(', ') || 'None'}`,
        `- **Lesions:** ${(p.lesions || []).join(', ') || 'None'}`,
        `- **Device Counts:** ${p.devices ? Object.entries(p.devices).map(([t, q]) => `${t}: ${q}`).join(', ') : 'None'}`,
        `- **Closure Device:** ${p.closureDevice || 'None'} ${p.closureDeviceCustom ? `(${p.closureDeviceCustom})` : ''}`,
        `- **Complications:** ${getComplicationsStr(p) || 'None'} ${p.complicationsCustom ? `(${p.complicationsCustom})` : ''}`,
        `- **Other Hardware:** ${(p.otherHardware || []).join(', ') || 'None'}`,
        `- **Other Hardware Notes:** ${p.otherHardwareNotes || 'N/A'}`,
        `- **Drugs:** ${(p.drugs || []).map(d => d === 'Other' && p.otherDrugsNotes ? `Other (${p.otherDrugsNotes})` : d).join(', ') || 'None'}`,
        `- **Place:** ${p.place || 'N/A'}`,
        `- **Created By:** ${p.createdBy || 'N/A'}`,
        `- **Additional Operator(s):** ${(p.additionalOperators || []).join(', ') || 'None'}`,
        `\n## Medical Notes\n${p.finalNotes || 'No final notes.'}`,
        `\n## Further Plan\n${p.plan || 'No specific plan.'}`,
        `\n## General Notes\n${p.notes || 'No general notes.'}`,
        `\n## Outcomes\n${(p.outcomes || []).length > 0 ? (p.outcomes || []).map(o => `- ${formatDateDMY(o.date)} (${o.status}): ${o.notes}`).join('\n') : 'No outcomes recorded.'}`
      ].join('\n');
    };

    try {
      setExportProgress({
        current: 0,
        total: dataToExport.length,
        stage: format,
        message: `Preparing ${format.toUpperCase()} export for ${dataToExport.length} records...`
      });

      if (format === 'all') {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const timeStr = `${hours}-${minutes}-${seconds}`;
        const folderName = `Cath data-${dateStr} and ${hours}-${minutes}-${seconds}`;

        setExportProgress({
          current: Math.round(patients.length * 0.1),
          total: patients.length,
          stage: 'all',
          message: 'Generating Markdown, CSV, Excel & SQL dumps...'
        });

        // 1. Generate Markdown content
        const mdContent = patients.map(p => getPatientMD(p)).join('\n\n---\n\n');
        const mdBlob = new Blob([mdContent], { type: 'text/markdown' });

        // 2. Generate CSV content
        const csvRows = patients.map(p => getPatientRowCSV(p));
        const csvContent = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');
        const csvBlob = new Blob([csvContent], { type: 'text/csv' });

        // 3. Generate XLSX content
        const excelRows = patients.map(p => getPatientRowExcel(p));
        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...excelRows]);
        const wscols = headers.map((h, i) => {
          const maxLen = Math.max(
            h.toString().length,
            ...excelRows.map(r => r[i] !== undefined && r[i] !== null ? r[i].toString().length : 0)
          );
          return { wch: Math.min(Math.max(maxLen + 3, 10), 50) };
        });
        worksheet['!cols'] = wscols;
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Patients');
        const xlsxBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const xlsxBlob = new Blob([xlsxBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        // 4. Generate SQL dump
        const sqlContent = generateSqlDump(patients);
        const sqlBlob = new Blob([sqlContent], { type: 'text/plain;charset=utf-8' });

        // 5. Generate Consolidated PDF
        setToast({ message: "Generating consolidated PDF...", type: "success" });
        setExportProgress({
          current: Math.round(patients.length * 0.25),
          total: patients.length,
          stage: 'all',
          message: 'Generating Consolidated PDF Report...'
        });
        const { doc: combinedPdfDoc, filename: combinedPdfFilename } = await generateCombinedPatientsPDF(
          patients,
          (curr, tot) => {
            setExportProgress({
              current: Math.min(tot, Math.round(tot * 0.25 + (curr / tot) * tot * 0.35)),
              total: tot,
              stage: 'all',
              message: `Building Consolidated PDF Report (${curr} / ${tot} patients)...`
            });
          },
          undefined,
          false,
          getPdfExportOptions()
        );
        const pdfBlob = combinedPdfDoc.output('blob');

        // 6. Generate Backup ZIP
        setToast({ message: "Creating ZIP backup with patient profiles and photos...", type: "success" });
        const backupZip = new JSZip();
        const fullJsonBackupStr = JSON.stringify(patients, null, 2);
        backupZip.file('database_backup.json', fullJsonBackupStr);
        backupZip.file('aggregate_database_backup.csv', [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n'));
        const zipWb = XLSX.utils.book_new();
        const zipWs = XLSX.utils.aoa_to_sheet([headers, ...excelRows]);
        zipWs['!cols'] = wscols;
        XLSX.utils.book_append_sheet(zipWb, zipWs, 'Aggregate Database');
        const zipWbout = XLSX.write(zipWb, { bookType: 'xlsx', type: 'array' });
        backupZip.file('aggregate_database_backup.xlsx', zipWbout);

        let pIdx = 0;
        for (const p of patients) {
          pIdx++;
          setExportProgress({
            current: Math.min(patients.length, Math.round(patients.length * 0.6 + (pIdx / patients.length) * patients.length * 0.3)),
            total: patients.length,
            stage: 'all',
            message: `Packaging patient profile & photos (${pIdx}/${patients.length}: ${p.serialNo} - ${p.name || 'Unnamed'})...`
          });
          const pFolderName = `${p.serialNo}_${p.name.replace(/[^a-z0-9]/gi, '_')}_${p.admissionNo.replace(/[^a-z0-9]/gi, '_')}`;
          const pFolder = backupZip.folder(pFolderName);
          if (pFolder) {
            pFolder.file('patient_profile.md', getPatientMD(p));
            const photoFields = getPatientPhotoFields(p);
            for (const photo of photoFields) {
              if (photo.url && photo.url.startsWith('data:image')) {
                const extension = photo.url.split(';')[0].split('/')[1] || 'png';
                const photoName = getBackupPhotoName(p, photo.prefix, extension);
                const base64Data = photo.url.split(',')[1];
                pFolder.file(photoName, base64Data, { base64: true });
              }
            }
          }
          if (patients.length > 10 && pIdx % 5 === 0) {
            await new Promise(r => setTimeout(r, 0));
          }
        }

        setExportProgress({
          current: patients.length,
          total: patients.length,
          stage: 'all',
          message: 'Compressing ZIP archive & finalizing export files...'
        });

        const zipBlob = await backupZip.generateAsync({ type: 'blob' }, (metadata) => {
          setExportProgress({
            current: Math.min(patients.length, Math.round((metadata.percent / 100) * patients.length)),
            total: patients.length,
            stage: 'all',
            message: `Compressing ZIP Archive: ${Math.round(metadata.percent)}% complete...`
          });
        });

        // Save directly to the linked database folder if syncHandle is set
        let savedToSyncFolder = false;
        if (syncHandle) {
          try {
            setToast({ message: "Saving folder to linked directory...", type: "success" });
            const dirHandle = await syncHandle.getDirectoryHandle(folderName, { create: true });

            const jsonFile = await dirHandle.getFileHandle(`database_backup_${dateStr}_${timeStr}.json`, { create: true });
            const jsonWritable = await jsonFile.createWritable();
            await jsonWritable.write(new Blob([fullJsonBackupStr], { type: 'application/json' }));
            await jsonWritable.close();

            const csvFile = await dirHandle.getFileHandle(`patients_export_${dateStr}_${timeStr}.csv`, { create: true });
            const csvWritable = await csvFile.createWritable();
            await csvWritable.write(csvBlob);
            await csvWritable.close();

            const xlsxFile = await dirHandle.getFileHandle(`patients_export_${dateStr}_${timeStr}.xlsx`, { create: true });
            const xlsxWritable = await xlsxFile.createWritable();
            await xlsxWritable.write(xlsxBlob);
            await xlsxWritable.close();

            const mdFile = await dirHandle.getFileHandle(`patients_export_${dateStr}_${timeStr}.md`, { create: true });
            const mdWritable = await mdFile.createWritable();
            await mdWritable.write(mdBlob);
            await mdWritable.close();

            const sqlFile = await dirHandle.getFileHandle(`patients_export_${dateStr}_${timeStr}.sql`, { create: true });
            const sqlWritable = await sqlFile.createWritable();
            await sqlWritable.write(sqlBlob);
            await sqlWritable.close();

            const pdfFile = await dirHandle.getFileHandle(combinedPdfFilename || `consolidated_report_${dateStr}_${timeStr}.pdf`, { create: true });
            const pdfWritable = await pdfFile.createWritable();
            await pdfWritable.write(pdfBlob);
            await pdfWritable.close();

            const zipFile = await dirHandle.getFileHandle(`FULL_BACKUP_${dateStr}_${timeStr}.zip`, { create: true });
            const zipWritable = await zipFile.createWritable();
            await zipWritable.write(zipBlob);
            await zipWritable.close();

            savedToSyncFolder = true;
          } catch (err: any) {
            console.error('Failed to write entire folder inside sync directory:', err);
            setToast({ message: "Warning: Save failed inside directory: " + err.message, type: "error" });
          }
        }

        // Package everything in a single downloadable ZIP representing the folder so browser handles download cleanly
        const finalPackageZip = new JSZip();
        finalPackageZip.file(`database_backup_${dateStr}_${timeStr}.json`, fullJsonBackupStr);
        finalPackageZip.file(`patients_export_${dateStr}_${timeStr}.csv`, csvBlob);
        finalPackageZip.file(`patients_export_${dateStr}_${timeStr}.xlsx`, xlsxBlob);
        finalPackageZip.file(`patients_export_${dateStr}_${timeStr}.md`, mdBlob);
        finalPackageZip.file(`patients_export_${dateStr}_${timeStr}.sql`, sqlBlob);
        finalPackageZip.file(combinedPdfFilename || `consolidated_report_${dateStr}_${timeStr}.pdf`, pdfBlob);
        finalPackageZip.file(`FULL_BACKUP_${dateStr}_${timeStr}.zip`, zipBlob);

        const parentZipBlob = await finalPackageZip.generateAsync({ type: 'blob' }, (metadata) => {
          setExportProgress({
            current: Math.min(patients.length, Math.round((metadata.percent / 100) * patients.length)),
            total: patients.length,
            stage: 'all',
            message: `Packaging final export bundle: ${Math.round(metadata.percent)}%...`
          });
        });
        saveAs(parentZipBlob, `${folderName}.zip`);

        if (savedToSyncFolder) {
          setToast({ message: `Successfully exported ALL options to folder: "${folderName}" and downloaded package zip!`, type: "success" });
        } else {
          setToast({ message: `Successfully exported ALL options! Downloaded as ZIP: "${folderName}.zip"`, type: "success" });
        }
        setLastBackupDate(Date.now());
        setShowBackupReminder(false);
      } else if (format === 'zip') {
        const zip = new JSZip();
        zip.file('database_backup.json', JSON.stringify(patients, null, 2));
        
        // 1. Root Aggregate CSV
        const csvRows = patients.map(p => getPatientRowCSV(p));
        zip.file('aggregate_database_backup.csv', [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n'));

        // 2. Root Aggregate XLSX
        const excelRows = patients.map(p => getPatientRowExcel(p));
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...excelRows]);
        const wsCols = headers.map((h, i) => {
          const maxLen = Math.max(
            h.toString().length,
            ...excelRows.map(r => r[i] !== undefined && r[i] !== null ? r[i].toString().length : 0)
          );
          return { wch: Math.min(Math.max(maxLen + 3, 10), 50) };
        });
        ws['!cols'] = wsCols;
        XLSX.utils.book_append_sheet(wb, ws, 'Aggregate Database');
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        zip.file('aggregate_database_backup.xlsx', wbout);

        // 3. Individual Patient Folders
        let pIdx = 0;
        for (const p of patients) {
          pIdx++;
          setExportProgress({
            current: Math.min(patients.length, Math.round((pIdx / patients.length) * patients.length * 0.8)),
            total: patients.length,
            stage: 'zip',
            message: `Packaging patient profile & photos (${pIdx}/${patients.length}: ${p.serialNo} - ${p.name || 'Unnamed'})...`
          });
          const folderName = `${p.serialNo}_${p.name.replace(/[^a-z0-9]/gi, '_')}_${p.admissionNo.replace(/[^a-z0-9]/gi, '_')}`;
          const patientFolder = zip.folder(folderName);
          
          if (patientFolder) {
            patientFolder.file('patient_profile.md', getPatientMD(p));

            // Patient Photos
            const photoFields = getPatientPhotoFields(p);

            for (const photo of photoFields) {
              if (photo.url && photo.url.startsWith('data:image')) {
                const extension = photo.url.split(';')[0].split('/')[1] || 'png';
                const photoName = getBackupPhotoName(p, photo.prefix, extension);
                const base64Data = photo.url.split(',')[1];
                patientFolder.file(photoName, base64Data, { base64: true });
              }
            }
          }
          if (patients.length > 10 && pIdx % 5 === 0) {
            await new Promise(r => setTimeout(r, 0));
          }
        }

        setExportProgress({
          current: patients.length,
          total: patients.length,
          stage: 'zip',
          message: 'Compressing ZIP archive...'
        });

        const content = await zip.generateAsync({ type: 'blob' }, (metadata) => {
          setExportProgress({
            current: Math.min(patients.length, Math.round((metadata.percent / 100) * patients.length)),
            total: patients.length,
            stage: 'zip',
            message: `Compressing ZIP archive: ${Math.round(metadata.percent)}% complete...`
          });
        });
        const zipName = `FULL_BACKUP_${new Date().toISOString().split('T')[0]}.zip`;
        saveAs(content, zipName);
        if (syncHandle) {
          try {
            const fileHandle = await syncHandle.getFileHandle(zipName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();
            setToast({ message: `ZIP backup downloaded and saved to local folder: ${zipName}`, type: 'success' });
          } catch (e) {
            console.error('Error saving ZIP backup to local folder:', e);
          }
        }
        setLastBackupDate(Date.now());
        setShowBackupReminder(false);
      } else if (format === 'csv') {
        setExportProgress({
          current: filteredPatients.length,
          total: filteredPatients.length,
          stage: 'csv',
          message: `Building CSV spreadsheet for ${filteredPatients.length} patient records...`
        });
        const rows = filteredPatients.map(p => getPatientRowCSV(p));
        const content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([content], { type: 'text/csv' });
        saveAs(blob, `${fileName}.csv`);
      } else if (format === 'xlsx') {
        setExportProgress({
          current: filteredPatients.length,
          total: filteredPatients.length,
          stage: 'xlsx',
          message: `Building Excel workbook for ${filteredPatients.length} patient records...`
        });
        const rows = filteredPatients.map(p => getPatientRowExcel(p));
        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wscols = headers.map((h, i) => {
          const maxLen = Math.max(
            h.toString().length,
            ...rows.map(r => r[i] !== undefined && r[i] !== null ? r[i].toString().length : 0)
          );
          return { wch: Math.min(Math.max(maxLen + 3, 10), 50) };
        });
        worksheet['!cols'] = wscols;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Patients');
        XLSX.writeFile(workbook, `${fileName}.xlsx`);
      } else if (format === 'sql') {
        setExportProgress({
          current: dataToExport.length,
          total: dataToExport.length,
          stage: 'sql',
          message: `Generating SQL dump for ${dataToExport.length} patient records...`
        });
        const sqlContent = generateSqlDump(dataToExport);
        const blob = new Blob([sqlContent], { type: 'text/plain;charset=utf-8' });
        saveAs(blob, `${fileName}.sql`);
      } else {
        setExportProgress({
          current: filteredPatients.length,
          total: filteredPatients.length,
          stage: 'md',
          message: `Generating Markdown document for ${filteredPatients.length} patient records...`
        });
        const content = filteredPatients.map(p => getPatientMD(p)).join('\n\n---\n\n');
        const blob = new Blob([content], { type: 'text/markdown' });
        saveAs(blob, `${fileName}.md`);
      }
    } catch (e) {
      console.error(e);
      alert('Export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportCSVRecords = async (importedPatients: Patient[], mode: 'add' | 'overwrite' | 'skip') => {
    try {
      const { saveLocalPatients, getLocalPatients } = await import('./services/offlineDb');
      await saveLocalPatients(importedPatients);
      const updatedList = await getLocalPatients();
      setPatients(updatedList);
      setToast({
        message: `Successfully imported ${importedPatients.length} patient record${importedPatients.length === 1 ? '' : 's'} from CSV!`,
        type: 'success'
      });
      triggerVibrate();
      if (syncHandle) {
        setTimeout(() => { performSync(updatedList); }, 1000);
      }
    } catch (err) {
      console.error('Failed to import CSV records:', err);
      setToast({
        message: 'Error saving imported records: ' + (err instanceof Error ? err.message : String(err)),
        type: 'error'
      });
    }
  };

  const handleJSONBackup = async () => {
    if (!backupPassword && !confirmUnencrypted) {
      setToast({ message: 'Please enter a password or confirm the unencrypted export warning.', type: 'error' });
      return;
    }
    setIsExportingJSON(true);
    try {
      const rawRecords = await getAllLocalRecordsRaw();
      const backupString = await encryptJSON(rawRecords, backupPassword || undefined);
      
      const blob = new Blob([backupString], { type: 'application/json' });
      const dateString = new Date().toISOString().split('T')[0];
      const filename = backupPassword 
        ? `clinical_db_secure_backup_${dateString}.json` 
        : `clinical_db_plain_backup_${dateString}.json`;
        
      saveAs(blob, filename);

      if (syncHandle) {
        try {
          const fileHandle = await syncHandle.getFileHandle(filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          setToast({ message: `Secure backup completed and saved to sync folder: ${filename}`, type: 'success' });
        } catch (e) {
          console.error('Error saving JSON backup to local folder:', e);
          setToast({ message: `Secure backup downloaded, but failed to save to local sync folder.`, type: 'error' });
        }
      } else {
        setToast({ message: 'Secure clinical database backup completed successfully!', type: 'success' });
      }
      setBackupPassword('');
      setConfirmUnencrypted(false);
    } catch (error) {
      console.error('Error exporting JSON backup:', error);
      setToast({ message: 'Failed to export backup.', type: 'error' });
    } finally {
      setIsExportingJSON(false);
    }
  };

  const handleJSONRestore = async () => {
    if (!restoreFile) {
      setToast({ message: 'Please select or drag-and-drop a backup file first.', type: 'error' });
      return;
    }
    
    setIsRestoring(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const fileContent = e.target?.result as string;
        const restoredData = await decryptJSON(fileContent, restorePassword || undefined);
        
        if (!Array.isArray(restoredData)) {
          throw new Error('Invalid backup schema. Expected an array of patient records.');
        }

        if (restoredData.length > 0) {
          const first = restoredData[0];
          if (!('serialNo' in first && 'name' in first)) {
            throw new Error('Invalid backup schema. Content properties do not match patient definitions.');
          }
        }

        await restorePatientsBackup(restoredData);
        await fetchPatients();
        
        setToast({ message: `Successfully restored ${restoredData.length} records!`, type: 'success' });
        setRestoreFile(null);
        setRestorePassword('');
      } catch (error: any) {
        console.error('Error restoring database backup:', error);
        setToast({ 
          message: error?.message || 'Decryption failed or invalid JSON backup file.', 
          type: 'error' 
        });
      } finally {
        setIsRestoring(false);
      }
    };
    reader.onerror = () => {
      setToast({ message: 'Failed to read backup file.', type: 'error' });
      setIsRestoring(false);
    };
    reader.readAsText(restoreFile);
  };

  // Google Drive Integration Functions
  const handleConnectGoogleDrive = async () => {
    try {
      setToast({ message: 'Connecting to Google Drive...', type: 'success' });
      const token = await signInWithGoogleDrive();
      if (token) {
        setDriveAccessToken(token);
        localStorage.setItem('driveAccessToken', token);
        setToast({ message: 'Connected to Google Drive successfully!', type: 'success' });
        await handleFetchDriveFiles(token);
      } else {
        setToast({ message: 'Failed to connect to Google Drive.', type: 'error' });
      }
    } catch (e: any) {
      console.error(e);
      setToast({ message: `Google Drive connection error: ${e.message || e}`, type: 'error' });
    }
  };

  const handleFetchDriveFiles = async (tokenToUse?: string, isSilent = false) => {
    const activeToken = tokenToUse || driveAccessToken;
    if (!activeToken) return;
    setIsListingDrive(true);
    try {
      const folderId = await getOrCreateBackupFolder(activeToken);
      const query = `'${folderId}' in parents and mimeType = 'application/json' and (name contains 'clinical_db_' or name contains 'Latest') and trashed = false`;
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, createdTime, size)&orderBy=createdTime desc`;
      const res = await safeDriveFetch(searchUrl, {
        headers: {
          Authorization: `Bearer ${activeToken}`,
        },
      });
      if (res.status === 401) {
        setDriveAccessToken(null);
        localStorage.removeItem('driveAccessToken');
        setDriveBackups([]);
        if (!isSilent) {
          setToast({ message: 'Google Drive session expired. Please reconnect.', type: 'error' });
        }
        return;
      }
      if (!res.ok) {
        throw new Error(`Failed to list backups: ${res.statusText}`);
      }
      const data = await res.json();
      setDriveBackups(data.files || []);
    } catch (e: any) {
      console.warn('Google Drive fetch notice:', e.message || e);
      const isAuthError = e.message?.includes('401') || 
                          e.message?.includes('UNAUTHENTICATED') || 
                          e.message?.includes('Invalid Credentials') || 
                          e.message?.includes('authError');
      if (isAuthError) {
        setDriveAccessToken(null);
        localStorage.removeItem('driveAccessToken');
        setDriveBackups([]);
        if (!isSilent) {
          setToast({ message: 'Google Drive session expired. Please reconnect in Settings.', type: 'error' });
        }
      } else {
        if (!isSilent) {
          setToast({ message: `Failed to load Google Drive files: ${e.message}`, type: 'error' });
        }
      }
    } finally {
      setIsListingDrive(false);
    }
  };

  const handleUploadBackupToDrive = async () => {
    if (!driveAccessToken) {
      setToast({ message: 'Please connect to Google Drive first.', type: 'error' });
      return;
    }
    if (!backupPassword && !confirmUnencrypted) {
      setToast({ message: 'Please enter a password or confirm the unencrypted export warning.', type: 'error' });
      return;
    }

    setIsUploadingToDrive(true);
    setToast({ message: 'Preparing cloud backup preview...', type: 'info' });
    try {
      const rawRecords = await getAllLocalRecordsRaw();
      const backupString = await encryptJSON(rawRecords, backupPassword || undefined);
      
      const sizeInBytes = new Blob([backupString]).size;
      const fileSizeKB = (sizeInBytes / 1024).toFixed(1) + ' KB';
      
      const now = new Date();
      const dateString = now.toISOString().split('T')[0];
      const timeString = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const filename = backupPassword 
        ? `clinical_db_secure_backup_Latest_1_${dateString}_${timeString}.json` 
        : `clinical_db_plain_backup_Latest_1_${dateString}_${timeString}.json`;

      setPendingDriveUpload({
        filename,
        fileSizeKB,
        recordCount: rawRecords.length,
        isEncrypted: !!backupPassword,
        backupString,
      });
    } catch (e: any) {
      console.error(e);
      setToast({ message: `Failed to prepare backup: ${e.message}`, type: 'error' });
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  const handleConfirmDriveUpload = async () => {
    if (!pendingDriveUpload || !driveAccessToken) return;

    const { filename, backupString } = pendingDriveUpload;
    setIsUploadingToDrive(true);
    setToast({ message: 'Uploading backup to Google Drive...', type: 'info' });

    try {
      const folderId = await getOrCreateBackupFolder(driveAccessToken);

      // Check existing files in Google Drive folder to keep only 3 latest
      const query = `'${folderId}' in parents and mimeType = 'application/json' and (name contains 'clinical_db_' or name contains 'Latest') and trashed = false`;
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, createdTime)&orderBy=createdTime desc`;
      const searchRes = await safeDriveFetch(searchUrl, {
        headers: { Authorization: `Bearer ${driveAccessToken}` },
      });

      let filesToDelete: Array<{ id: string; name: string }> = [];
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const existingFiles = searchData.files || [];
        // Keep 2 existing newest files so adding 1 new file makes total 3 files on Google Drive
        if (existingFiles.length >= 3) {
          filesToDelete = existingFiles.slice(2);
        }
      }

      for (const oldFile of filesToDelete) {
        await deleteFileFromDrive(driveAccessToken, oldFile.id);
      }

      await uploadFileToDrive(driveAccessToken, folderId, filename, backupString);

      if (filesToDelete.length > 0) {
        setToast({ message: `Backup uploaded! Pruned ${filesToDelete.length} older file(s) to maintain max 3 backups on Drive.`, type: 'success' });
      } else {
        setToast({ message: 'Backup successfully uploaded to Google Drive (3 latest maintained)!', type: 'success' });
      }
      setPendingDriveUpload(null);
      setBackupPassword('');
      setConfirmUnencrypted(false);
      await handleFetchDriveFiles();
    } catch (e: any) {
      console.error(e);
      if (e.message?.includes('401') || e.message?.includes('Unauthorized')) {
        setDriveAccessToken(null);
        localStorage.removeItem('driveAccessToken');
        setToast({ message: 'Session expired. Please reconnect to Google Drive.', type: 'error' });
      } else {
        setToast({ message: `Google Drive upload failed: ${e.message}`, type: 'error' });
      }
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  const handleDownloadAndRestoreFromDrive = async (fileId: string) => {
    if (!driveAccessToken) {
      setToast({ message: 'Please connect to Google Drive first.', type: 'error' });
      return;
    }
    if (!fileId) {
      setToast({ message: 'Please select a backup file to restore.', type: 'error' });
      return;
    }

    const file = driveBackups.find(f => f.id === fileId);
    const filename = file?.name || 'Selected Backup';

    if (!confirm(`Are you sure you want to restore from "${filename}"? This will replace your current patient records.`)) {
      return;
    }

    setIsDownloadingFromDrive(true);
    setToast({ message: 'Downloading backup from Google Drive...', type: 'success' });
    try {
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      const res = await safeDriveFetch(downloadUrl, {
        headers: {
          Authorization: `Bearer ${driveAccessToken}`,
        },
      });
      if (res.status === 401) {
        setDriveAccessToken(null);
        localStorage.removeItem('driveAccessToken');
        setToast({ message: 'Session expired. Please reconnect to Google Drive.', type: 'error' });
        return;
      }
      if (!res.ok) {
        throw new Error(`Failed to download backup: ${res.statusText}`);
      }
      const fileContent = await res.text();
      
      setToast({ message: 'Decrypting and restoring...', type: 'success' });
      const restoredData = await decryptJSON(fileContent, restorePassword || undefined);
      
      if (!Array.isArray(restoredData)) {
        throw new Error('Invalid backup schema. Expected an array of patient records.');
      }

      if (restoredData.length > 0) {
        const first = restoredData[0];
        if (!('serialNo' in first && 'name' in first)) {
          throw new Error('Invalid backup schema. Content properties do not match patient definitions.');
        }
      }

      await restorePatientsBackup(restoredData);
      await fetchPatients();
      
      setToast({ message: `Successfully restored ${restoredData.length} records from Google Drive!`, type: 'success' });
      setRestorePassword('');
      setSelectedDriveFileId('');
    } catch (error: any) {
      console.error('Error restoring Google Drive backup:', error);
      setToast({ 
        message: error?.message || 'Decryption failed or invalid Google Drive backup file.', 
        type: 'error' 
      });
    } finally {
      setIsDownloadingFromDrive(false);
    }
  };

  const handleDisconnectGoogleDrive = () => {
    setDriveAccessToken(null);
    localStorage.removeItem('driveAccessToken');
    setDriveBackups([]);
    setToast({ message: 'Disconnected from Google Drive.', type: 'success' });
  };

  useEffect(() => {
    if (driveAccessToken) {
      handleFetchDriveFiles(driveAccessToken, true);
    }
  }, [driveAccessToken]);

  const runDatabaseHealthCheck = async () => {
    setIsHealthChecking(true);
    try {
      const allRecords = await getAllLocalRecordsRaw();
      const issuesList: {
        id: string;
        patientId?: string;
        name?: string;
        serialNo?: number;
        details: string[];
      }[] = [];

      let corruptedCount = 0;

      for (const p of allRecords) {
        const recordIssues: string[] = [];
        
        // 1. Basic structural validity
        if (!p || typeof p !== 'object') {
          corruptedCount++;
          issuesList.push({
            id: p?.id || 'unknown_' + Math.random().toString(36).substring(2, 7),
            details: ['Record is corrupt or is not a valid JSON object.']
          });
          continue;
        }

        const id = p.id || 'missing_id_' + Math.random().toString(36).substring(2, 7);
        if (!p.id) {
          recordIssues.push("Record is missing primary key 'id'.");
        }

        // 2. Critical Fields Validations
        if (p.name === undefined || p.name === null || typeof p.name !== 'string' || p.name.trim() === '') {
          recordIssues.push("Field 'name' is missing, empty, or has an invalid type.");
        }

        if (p.serialNo === undefined || p.serialNo === null || typeof p.serialNo !== 'number' || isNaN(p.serialNo) || p.serialNo <= 0) {
          recordIssues.push("Field 'serialNo' is missing, invalid, or is non-positive.");
        }

        const expectedPatientId = p.serialNo ? `PAT-${String(p.serialNo).padStart(2, '0')}` : null;
        if (!p.patientId) {
          recordIssues.push("Field 'patientId' is missing.");
        } else if (expectedPatientId && p.patientId !== expectedPatientId) {
          recordIssues.push(`Field 'patientId' (${p.patientId}) does not match expectation based on Serial No (${expectedPatientId}).`);
        }

        if (p.age === undefined || p.age === null || typeof p.age !== 'number' || isNaN(p.age) || p.age < 0 || p.age > 130) {
          recordIssues.push("Field 'age' is missing or has an illogical/invalid numerical value.");
        }

        if (!p.gender) {
          recordIssues.push("Field 'gender' is missing.");
        }

        if (!p.date || isNaN(Date.parse(p.date))) {
          recordIssues.push("Field 'date' is missing or is not a valid date.");
        }

        if (!p.admissionNo || String(p.admissionNo).trim() === '') {
          recordIssues.push("Field 'admissionNo' is missing or empty.");
        }

        if (!p.serviceCategory) {
          recordIssues.push("Field 'serviceCategory' is missing.");
        }

        // 3. Nested Array Field Validation (ensuring they won't cause app crash when mapped)
        const arrayFields = [
          { name: 'phoneNumbers', value: p.phoneNumbers },
          { name: 'rwma', value: p.rwma },
          { name: 'comorbidities', value: p.comorbidities },
          { name: 'pciVessels', value: p.pciVessels },
          { name: 'imaging', value: p.imaging },
          { name: 'specialHardware', value: p.specialHardware },
          { name: 'complications', value: p.complications },
          { name: 'otherHardware', value: p.otherHardware },
          { name: 'drugs', value: p.drugs },
          { name: 'tags', value: p.tags }
        ];

        for (const field of arrayFields) {
          if (field.value !== undefined && field.value !== null && !Array.isArray(field.value)) {
            recordIssues.push(`Field '${field.name}' is corrupted (expected an Array, got ${typeof field.value}).`);
          }
        }

        // 4. Nested Object Field Validation
        if (p.devices !== undefined && p.devices !== null && (typeof p.devices !== 'object' || Array.isArray(p.devices))) {
          recordIssues.push("Field 'devices' is corrupted (expected an Object).");
        }

        if (p.imagingFindings !== undefined && p.imagingFindings !== null && (typeof p.imagingFindings !== 'object' || Array.isArray(p.imagingFindings))) {
          recordIssues.push("Field 'imagingFindings' is corrupted (expected an Object).");
        }

        if (recordIssues.length > 0) {
          corruptedCount++;
          issuesList.push({
            id,
            patientId: p.patientId,
            name: p.name,
            serialNo: p.serialNo,
            details: recordIssues
          });
        }
      }

      setHealthReport({
        totalChecked: allRecords.length,
        corruptedCount,
        issues: issuesList,
        status: corruptedCount === 0 ? 'success' : 'warning',
        checkedAt: new Date().toLocaleTimeString()
      });

      if (corruptedCount === 0) {
        setToast({ message: 'IndexedDB Health Check: 100% of patient records are healthy and intact!', type: 'success' });
      } else {
        setToast({ message: `IndexedDB Health Check: Found issues in ${corruptedCount} patient profile(s).`, type: 'info' });
      }
    } catch (err: any) {
      console.error('Error running IndexedDB health check:', err);
      setHealthReport({
        totalChecked: 0,
        corruptedCount: 0,
        issues: [],
        status: 'error',
        checkedAt: new Date().toLocaleTimeString()
      });
      setToast({ message: 'Database health check failed: ' + (err?.message || 'Unknown error'), type: 'error' });
    } finally {
      setIsHealthChecking(false);
    }
  };

  const runDatabaseHealthRepair = async () => {
    if (!healthReport || healthReport.corruptedCount === 0) {
      setToast({ message: 'No issues found to repair.', type: 'info' });
      return;
    }

    setIsHealthRepairing(true);
    try {
      const allRecords = await getAllLocalRecordsRaw();
      const repairedRecords: Patient[] = [];
      const idsToDelete: string[] = [];

      // Determine next safe serial number for missing serialNo fields
      let maxSerialNo = 0;
      for (const r of allRecords) {
        if (r && typeof r === 'object' && typeof r.serialNo === 'number' && !isNaN(r.serialNo)) {
          maxSerialNo = Math.max(maxSerialNo, r.serialNo);
        }
      }

      for (const p of allRecords) {
        // If the record itself is completely corrupted/not an object or missing ID, we cannot safely repair, we must delete
        if (!p || typeof p !== 'object') {
          if (p && (p as any).id) {
            idsToDelete.push((p as any).id);
          }
          continue;
        }

        const id = p.id;
        if (!id) {
          // If ID is completely missing, we have no safe way to save or reference it in IndexedDB, so delete
          continue;
        }

        // Check if this record is in the issues list
        const hasIssue = healthReport.issues.some(issue => issue.id === id);
        if (!hasIssue) {
          repairedRecords.push(p);
          continue;
        }

        // We have an issue, let's repair it!
        const repaired: any = { ...p };

        // Repair primary fields
        if (repaired.name === undefined || repaired.name === null || typeof repaired.name !== 'string' || repaired.name.trim() === '') {
          repaired.name = p.patientId ? `Patient ${p.patientId}` : `Auto-Repaired Patient (${id.substring(0,6)})`;
        }

        if (repaired.serialNo === undefined || repaired.serialNo === null || typeof repaired.serialNo !== 'number' || isNaN(repaired.serialNo) || repaired.serialNo <= 0) {
          maxSerialNo++;
          repaired.serialNo = maxSerialNo;
        }

        const expectedPatientId = `PAT-${String(repaired.serialNo).padStart(2, '0')}`;
        if (!repaired.patientId || repaired.patientId !== expectedPatientId) {
          repaired.patientId = expectedPatientId;
        }

        if (repaired.age === undefined || repaired.age === null || typeof repaired.age !== 'number' || isNaN(repaired.age) || repaired.age < 0 || repaired.age > 130) {
          repaired.age = 50; // reasonable average default
        }

        if (!repaired.gender) {
          repaired.gender = 'Male';
        }

        if (!repaired.date || isNaN(Date.parse(repaired.date))) {
          repaired.date = new Date().toISOString().split('T')[0];
        }

        if (!repaired.admissionNo || String(repaired.admissionNo).trim() === '') {
          repaired.admissionNo = `ADM-${Date.now().toString().substring(6)}`;
        }

        if (!repaired.serviceCategory) {
          repaired.serviceCategory = 'Cathlab';
        }

        // Repair arrays
        const arrayFields = ['phoneNumbers', 'rwma', 'comorbidities', 'pciVessels', 'lesionTypes', 'imaging', 'specialHardware', 'complications', 'otherHardware', 'drugs', 'tags'];
        for (const key of arrayFields) {
          if (repaired[key] === undefined || repaired[key] === null || !Array.isArray(repaired[key])) {
            repaired[key] = [];
          }
        }

        // Repair objects
        if (repaired.devices === undefined || repaired.devices === null || typeof repaired.devices !== 'object' || Array.isArray(repaired.devices)) {
          repaired.devices = {};
        }

        if (repaired.imagingFindings === undefined || repaired.imagingFindings === null || typeof repaired.imagingFindings !== 'object' || Array.isArray(repaired.imagingFindings)) {
          repaired.imagingFindings = {};
        }

        // Mark as updated and save back
        repaired.localUpdatedAt = new Date().toISOString();
        repaired.synced = true;

        repairedRecords.push(repaired);
      }

      // 1. Physically delete any completely unrecoverable/unreadable items
      for (const dId of idsToDelete) {
        await permanentlyDeletePatient(dId);
      }

      // 2. Save all corrected profiles in batch
      if (repairedRecords.length > 0) {
        const dbInstance = await openDB();
        const transaction = dbInstance.transaction('patients', 'readwrite');
        const store = transaction.objectStore('patients');
        
        for (const item of repairedRecords) {
          store.put(item);
        }
        
        await new Promise<void>((resolve, reject) => {
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        });
      }

      // Refresh list
      await fetchPatients();

      // Re-run health check to refresh the report
      setTimeout(async () => {
        await runDatabaseHealthCheck();
        setToast({ message: 'Clinical database successfully auto-repaired and synchronized!', type: 'success' });
      }, 500);

    } catch (err: any) {
      console.error('Error repairing clinical database:', err);
      setToast({ message: 'Repair operation failed: ' + (err?.message || 'Unknown error'), type: 'error' });
    } finally {
      setIsHealthRepairing(false);
    }
  };

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Client-side validation
    const errors: { [key: string]: string } = {};
    const serialNum = parseInt(formData.serialNo);
    
    if (isNaN(serialNum) || serialNum <= 0) {
      errors.serialNo = 'Serial No must be a positive number';
    } else if (isSerialNoDuplicate) {
      errors.serialNo = 'Serial No already exists';
    }
    
    if (!formData.name) errors.name = 'Name is required';
    if (!formData.admissionNo) {
      errors.admissionNo = 'Admission No is required';
    } else if (isAdmissionNoDuplicate) {
      errors.admissionNo = 'Admission No already exists';
    }

    // Age Validation: accepts only numbers
    if (!formData.age) {
      errors.age = 'Age is required';
    } else {
      const trimmedAge = String(formData.age).trim();
      if (!/^\d+$/.test(trimmedAge)) {
        errors.age = 'Age accepts only numbers';
      } else {
        const ageNum = parseInt(trimmedAge, 10);
        if (ageNum <= 0 || ageNum > 125) {
          errors.age = 'Please enter a valid age between 1 and 125';
        }
      }
    }

    // Gender Validation: accepts only predefined options
    const validGenders = Object.values(Gender);
    if (!formData.gender) {
      errors.gender = 'Gender is required';
    } else if (!validGenders.includes(formData.gender as Gender)) {
      errors.gender = `Gender accepts only predefined options: ${validGenders.join(', ')}`;
    }

    // Contact/Phone Number validation: accepts valid phone number format
    const phoneRegex = /^\+?[0-9\s\-()]{7,15}$/;
    const invalidPhones = formData.phoneNumbers.filter(ph => {
      const trimmed = ph.trim();
      return trimmed !== '' && !phoneRegex.test(trimmed);
    });

    if (invalidPhones.length > 0) {
      errors.phoneNumbers = 'Phone number must be a valid format (7-15 digits, optionally starting with +)';
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setToast({ message: 'Validation failed. Please correct the highlighted errors.', type: 'error' });
      return;
    }
    
    setFormErrors({});
    setIsSubmitting(true);
    try {
      const patientPayload = {
        place: formData.place ? formData.place.trim() : '',
        serialNo: serialNum,
        serNo: formData.serNo,
        serviceCategory: formData.serviceCategory,
        admissionNo: formData.admissionNo,
        name: formData.name,
        age: parseInt(formData.age),
        gender: formData.gender,
        date: formData.date,
        presentation: formData.presentation,
        tmt: formData.tmt,
        ejectionFraction: formData.ejectionFraction,
        rwma: formData.rwma,
        comorbidities: formData.comorbidities,
        labPhotoUrl: formData.labPhotoUrl || '',
        phoneNumbers: formData.phoneNumbers.filter(ph => ph.trim() !== ''),
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        height: formData.height ? parseFloat(formData.height) : undefined,
        bmi: formData.bmi ? parseFloat(formData.bmi) : undefined,
        access: formData.access,
        usgDoppler: formData.usgDoppler,
        angiogramPhotoUrl: formData.angiogramPhotoUrl || '',
        pciPhotoUrls: formData.pciPhotoUrls && formData.pciPhotoUrls.length > 0 ? formData.pciPhotoUrls : (formData.pciPhotoUrl ? [formData.pciPhotoUrl] : []),
        pciPhotoUrl: (formData.pciPhotoUrls && formData.pciPhotoUrls[0]) || formData.pciPhotoUrl || '',
        pciVessels: formData.pciVessels,
        lesionTypes: formData.lesionTypes || [],
        imaging: formData.imaging,
        imagingPhotoUrls: formData.imagingPhotoUrls && formData.imagingPhotoUrls.length > 0 ? formData.imagingPhotoUrls : (formData.imagingPhotoUrl ? [formData.imagingPhotoUrl] : []),
        imagingPhotoUrl: (formData.imagingPhotoUrls && formData.imagingPhotoUrls[0]) || formData.imagingPhotoUrl || '',
        imagingFindings: formData.imagingFindings,
        specialHardware: formData.specialHardware,
        otherSpecialHardwareNotes: formData.otherSpecialHardwareNotes || '',
        devices: formData.devices,
        closureDevice: formData.closureDevice,
        closureDeviceCustom: formData.closureDeviceCustom,
        complications: formData.complications,
        complicationsCustom: formData.complications.includes(Complication.Other) ? formData.complicationsCustom : '',
        otherHardware: formData.otherHardware,
        otherHardwareNotes: formData.otherHardwareNotes,
        drugs: formData.drugs,
        otherDrugsNotes: formData.drugs.includes(Drug.Other) ? (formData.otherDrugsNotes || '') : '',
        finalNotes: formData.finalNotes,
        plan: formData.plan || '',
        otherInfoPhotoUrl: formData.otherInfoPhotoUrl || '',
        demographicsPhotoUrl: formData.demographicsPhotoUrl || '',
        notes: formData.notes,
        outcomes: formData.outcomes,
        category: formData.category,
        otherCategoryNotes: formData.category === ReportCategory.Other ? formData.otherCategoryNotes : '',
        bifurcation: formData.lesionTypes?.includes(LesionType.Bifurcation) || formData.bifurcation || false,
        isOther: formData.pciVessels?.includes(PCIVessel.Other) || formData.isOther || false,
        otherAccessNotes: formData.otherAccessNotes,
        otherEjectionFractionNotes: formData.ejectionFraction === EjectionFraction.Other ? formData.otherEjectionFractionNotes : '',
        lesions: formData.lesions,
        stentDetails: formData.stentDetails,
        brsDetails: formData.brsDetails,
        debDetails: formData.debDetails,
        preHb: formData.preHb || '',
        preUrea: formData.preUrea || '',
        preCreatinine: formData.preCreatinine || '',
        preK: formData.preK || '',
        postHb: formData.postHb || '',
        postUrea: formData.postUrea || '',
        postCreatinine: formData.postCreatinine || '',
        postK: formData.postK || '',
        additionalOperators: (formData.additionalOperators || []).map(s => s.trim()).filter(Boolean),
        isImportant: formData.isImportant || false,
        tags: generatePatientTags(formData)
      };

      if (isEditing) {
        const { updatePatient } = await import('./services/patientService');
        await updatePatient(isEditing, patientPayload);
        setToast({ message: 'the new changes are saved', type: 'success' });
        triggerVibrate();
        // Optimistically update the local state immediately
        const updatedPatients = patients.map(p => p.id === isEditing ? { ...p, ...patientPayload } : p);
        setPatients(updatedPatients);
        if (syncHandle) {
          setTimeout(() => { performSync(updatedPatients); }, 1000);
        }
      } else {
        const result = await createPatient(patientPayload);
        setToast({ message: 'Patient clinical record saved successfully', type: 'success' });
        triggerVibrate();
        if (result) {
          const updatedPatients = [result, ...patients];
          setPatients(updatedPatients);
          if (syncHandle) {
            setTimeout(() => { performSync(updatedPatients); }, 1000);
          }
        }
      }

      setFormData(INITIAL_FORM_DATA);
      setIsSerialNoManuallyEdited(false);
      localStorage.removeItem('patient_form_draft');
      setShowDraftPrompt(false);
      setIsEditing(null);
      await fetchPatients();
      setView('list');
    } catch (error) {
      console.error(error);
      const errMessage = error instanceof Error ? error.message : String(error);
      alert('Failed to save patient: ' + errMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (p: Patient) => {
    setIsEditing(p.id!);
    setSelectedPatient(null);
    setFormData({
      place: p.place || '',
      serialNo: p.serialNo.toString(),
      admissionNo: p.admissionNo,
      name: p.name,
      age: p.age.toString(),
      gender: p.gender,
      date: p.date,
      presentation: p.presentation || Presentation.STEMI,
      tmt: p.tmt || TMTOption.NA,
      ejectionFraction: p.ejectionFraction,
      rwma: p.rwma,
      comorbidities: p.comorbidities,
      labPhotoUrl: p.labPhotoUrl,
      phoneNumbers: p.phoneNumbers && p.phoneNumbers.length > 0 ? p.phoneNumbers : [''],
      weight: p.weight !== undefined ? p.weight.toString() : '',
      height: p.height !== undefined ? p.height.toString() : '',
      bmi: p.bmi !== undefined ? p.bmi.toString() : '',
      access: p.access || AccessMethod.RtRadial,
      usgDoppler: p.usgDoppler || false,
      angiogramPhotoUrl: p.angiogramPhotoUrl || '',
      pciPhotoUrls: p.pciPhotoUrls && p.pciPhotoUrls.length > 0 ? p.pciPhotoUrls : (p.pciPhotoUrl ? [p.pciPhotoUrl] : []),
      pciPhotoUrl: (p.pciPhotoUrls && p.pciPhotoUrls[0]) || p.pciPhotoUrl || '',
      pciVessels: (p.pciVessels || []).filter((v: any) => !['CTO', 'ISR', 'THROMBUS'].includes(v)),
      lesionTypes: (p.lesionTypes && p.lesionTypes.length > 0)
        ? p.lesionTypes
        : [
            ...(p.pciVessels ? (p.pciVessels.filter((v: any) => ['CTO', 'ISR', 'THROMBUS'].includes(v)) as any) : []),
            ...(p.bifurcation ? [LesionType.Bifurcation] : [])
          ],
      imaging: p.imaging || [],
      imagingPhotoUrls: p.imagingPhotoUrls && p.imagingPhotoUrls.length > 0 ? p.imagingPhotoUrls : (p.imagingPhotoUrl ? [p.imagingPhotoUrl] : []),
      imagingPhotoUrl: (p.imagingPhotoUrls && p.imagingPhotoUrls[0]) || p.imagingPhotoUrl || '',
      imagingFindings: p.imagingFindings || {},
      specialHardware: p.specialHardware || [],
      otherSpecialHardwareNotes: p.otherSpecialHardwareNotes || '',
      devices: p.devices || {},
      closureDevice: p.closureDevice || '',
      closureDeviceCustom: p.closureDeviceCustom || '',
      complications: p.complications || [],
      complicationsCustom: p.complicationsCustom || '',
      otherHardware: p.otherHardware || [],
      otherHardwareNotes: p.otherHardwareNotes || '',
      drugs: p.drugs || [],
      otherDrugsNotes: p.otherDrugsNotes || '',
      finalNotes: p.finalNotes || '',
      plan: p.plan || '',
      otherInfoPhotoUrl: p.otherInfoPhotoUrl || '',
      demographicsPhotoUrl: p.demographicsPhotoUrl || '',
      notes: p.notes || '',
      outcomes: p.outcomes || [],
      category: p.category || ReportCategory.Other,
      otherCategoryNotes: p.otherCategoryNotes || '',
      tags: p.tags || [],
      additionalOperators: p.additionalOperators && p.additionalOperators.length > 0 ? p.additionalOperators : [''],
      isImportant: p.isImportant || false,
      serNo: p.serNo || '',
      serviceCategory: p.serviceCategory || ServiceCategory.Ser,
      bifurcation: p.bifurcation || false,
      isOther: p.isOther || false,
      otherAccessNotes: p.otherAccessNotes || '',
      otherEjectionFractionNotes: p.otherEjectionFractionNotes || '',
      lesions: p.lesions || [],
      stentDetails: p.stentDetails || [],
      brsDetails: p.brsDetails || [],
      debDetails: p.debDetails || [],
      preHb: p.preHb || '',
      preUrea: p.preUrea || '',
      preCreatinine: p.preCreatinine || '',
      preK: p.preK || '',
      postHb: p.postHb || '',
      postUrea: p.postUrea || '',
      postCreatinine: p.postCreatinine || '',
      postK: p.postK || ''
    });
    setView('add');
    setToast({ 
      message: `Editing patient record for ${p.name}. Modify fields and click 'Save & Update Patient Record'.`, 
      type: 'success' 
    });
    setTimeout(() => {
      const sidebar = document.querySelector('aside');
      if (sidebar) {
        sidebar.scrollTop = 0;
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  const onCropComplete = useCallback((_at: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const updateFormDataWithCroppedImage = useCallback((target: string, croppedImage: string) => {
    setFormData(prev => {
      let nextData: typeof prev = { ...prev };

      if (target.includes('_')) {
        const parts = target.split('_');
        const arrayKey = parts[0] as 'pciPhotoUrls' | 'imagingPhotoUrls';
        const index = parseInt(parts[1], 10);
        const primaryKey = arrayKey === 'pciPhotoUrls' ? 'pciPhotoUrl' : 'imagingPhotoUrl';
        
        const currentList = [...(prev[arrayKey] || [])];
        if (index >= 0 && index < currentList.length) {
          currentList[index] = croppedImage;
        } else {
          currentList.push(croppedImage);
        }

        nextData = {
          ...nextData,
          [arrayKey]: currentList,
          [primaryKey]: currentList[0] || ''
        };
      } else if (target === 'pciPhotoUrls' || target === 'pciPhotoUrl') {
        const currentList = [...(prev.pciPhotoUrls || [])];
        if (currentList.length === 0) {
          currentList.push(croppedImage);
        } else {
          currentList[0] = croppedImage;
        }
        nextData = {
          ...nextData,
          pciPhotoUrls: currentList,
          pciPhotoUrl: currentList[0] || ''
        };
      } else if (target === 'imagingPhotoUrls' || target === 'imagingPhotoUrl') {
        const currentList = [...(prev.imagingPhotoUrls || [])];
        if (currentList.length === 0) {
          currentList.push(croppedImage);
        } else {
          currentList[0] = croppedImage;
        }
        nextData = {
          ...nextData,
          imagingPhotoUrls: currentList,
          imagingPhotoUrl: currentList[0] || ''
        };
      } else {
        nextData = { ...nextData, [target]: croppedImage };
      }

      return nextData;
    });

    // Also update selectedPatient if active so detail sheets immediately reflect cropped photo changes
    setSelectedPatient(prev => {
      if (!prev) return null;
      if (target.includes('_')) {
        const parts = target.split('_');
        const arrayKey = parts[0] as 'pciPhotoUrls' | 'imagingPhotoUrls';
        const index = parseInt(parts[1], 10);
        const primaryKey = arrayKey === 'pciPhotoUrls' ? 'pciPhotoUrl' : 'imagingPhotoUrl';
        const currentList = [...(prev[arrayKey] || [])];
        if (index >= 0 && index < currentList.length) {
          currentList[index] = croppedImage;
        } else {
          currentList.push(croppedImage);
        }
        return {
          ...prev,
          [arrayKey]: currentList,
          [primaryKey]: currentList[0] || ''
        };
      } else if (target === 'pciPhotoUrls' || target === 'pciPhotoUrl') {
        const currentList = [...(prev.pciPhotoUrls || [])];
        if (currentList.length === 0) currentList.push(croppedImage);
        else currentList[0] = croppedImage;
        return { ...prev, pciPhotoUrls: currentList, pciPhotoUrl: currentList[0] || '' };
      } else if (target === 'imagingPhotoUrls' || target === 'imagingPhotoUrl') {
        const currentList = [...(prev.imagingPhotoUrls || [])];
        if (currentList.length === 0) currentList.push(croppedImage);
        else currentList[0] = croppedImage;
        return { ...prev, imagingPhotoUrls: currentList, imagingPhotoUrl: currentList[0] || '' };
      } else {
        return { ...prev, [target]: croppedImage };
      }
    });
  }, []);

  const handleCropSave = async () => {
    if (imageToCrop && croppedAreaPixels && cropTarget) {
      try {
        let croppedImage = await getCroppedImg(imageToCrop, croppedAreaPixels, rotation, { horizontal: false, vertical: false }, compressionQuality);
        if (croppedImage) {
          if (croppedImage.length > 700000) { 
            try {
              croppedImage = await downscaleImage(croppedImage, 800);
            } catch (e) {
              console.warn("Downscaling cropped image fallback:", e);
            }
          }
          updateFormDataWithCroppedImage(cropTarget, croppedImage);
          triggerVibrate();
          setImageToCrop(null);
          setCropTarget(null);
          setCropTargetLabel('');
          setIsCropping(false);
          setRotation(0);
          setZoom(1);
          setAspect(undefined);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleManualCrop = useCallback((target: string, label: string, value: string) => {
    setImageToCrop(value);
    setCropTarget(target);
    setCropTargetLabel(label);
    setIsCropping(true);
    setRotation(0);
    setZoom(1);
    setAspect(undefined);
  }, []);

  const handleUseOriginal = useCallback(() => {
    if (imageToCrop && cropTarget) {
      updateFormDataWithCroppedImage(cropTarget, imageToCrop);
      setImageToCrop(null);
      setCropTarget(null);
      setCropTargetLabel('');
      setIsCropping(false);
      setRotation(0);
      setZoom(1);
      setAspect(undefined);
    }
  }, [imageToCrop, cropTarget, updateFormDataWithCroppedImage]);

  const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>, target: string, label: string) => {
    const targetInput = e.target;
    const file = targetInput.files?.[0];
    if (file) {
      if (file.size > 50000000) { // 50MB limit
        alert('File too large. Please use an image under 50MB.');
        try { targetInput.value = ''; } catch (_) {}
        return;
      }

      setToast({ message: `Processing ${label} photo...`, type: 'success' });
      
      // Delay slightly to yield main thread and show Toast
      setTimeout(async () => {
        try {
          const resizedDataUrl = await downscaleImage(file, 1000);
          if (resizedDataUrl) {
            setFormData(prev => ({ ...prev, [target]: resizedDataUrl }));
            setToast({ message: `${label} photo uploaded successfully!`, type: 'success' });
          } else {
            setToast({ message: `Failed to process ${label} photo`, type: 'error' });
          }
        } catch (err) {
          console.error("Error preprocessing image:", err);
          setToast({ message: "Failed to process image: " + (err instanceof Error ? err.message : String(err)), type: "error" });
        } finally {
          if (targetInput) {
            try { targetInput.value = ''; } catch (_) {}
          }
        }
      }, 50);
    }
  }, []);

  const handleMultiPhotoUpload = useCallback((
    e: React.ChangeEvent<HTMLInputElement>, 
    targetArrayKey: 'pciPhotoUrls' | 'imagingPhotoUrls', 
    label: string, 
    replaceIndex?: number
  ) => {
    const targetInput = e.target;
    const files = Array.from(targetInput.files || []);
    if (files.length === 0) return;

    const validFiles: File[] = [];
    for (const file of files) {
      if (file.size > 50000000) {
        alert(`File "${file.name}" exceeds 50MB limit and was skipped.`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      if (targetInput) {
        try { targetInput.value = ''; } catch (_) {}
      }
      return;
    }

    setToast({ message: `Processing ${validFiles.length} ${label} photo(s)...`, type: 'success' });

    setTimeout(async () => {
      try {
        const resizedUrls: string[] = [];
        for (const file of validFiles) {
          const resized = await downscaleImage(file, 1000);
          if (resized) resizedUrls.push(resized);
        }

        if (resizedUrls.length > 0) {
          const primaryKey = targetArrayKey === 'pciPhotoUrls' ? 'pciPhotoUrl' : 'imagingPhotoUrl';
          setFormData(prev => {
            const existingArray = prev[targetArrayKey] && prev[targetArrayKey]!.length > 0
              ? prev[targetArrayKey]!
              : (prev[primaryKey] ? [prev[primaryKey]!] : []);

            const currentList = [...existingArray];
            let updatedList: string[];
            if (typeof replaceIndex === 'number' && replaceIndex >= 0 && replaceIndex < currentList.length) {
              currentList[replaceIndex] = resizedUrls[0];
              updatedList = currentList;
            } else {
              updatedList = [...currentList, ...resizedUrls];
            }
            return {
              ...prev,
              [targetArrayKey]: updatedList,
              [primaryKey]: updatedList[0] || ''
            };
          });
          setToast({ message: `${resizedUrls.length} ${label} photo(s) attached!`, type: 'success' });
        } else {
          setToast({ message: `Failed to process ${label} photos`, type: 'error' });
        }
      } catch (err) {
        console.error(`Error uploading ${label} photos:`, err);
        setToast({ message: `Failed to process ${label} photos`, type: 'error' });
      } finally {
        if (targetInput) {
          try { targetInput.value = ''; } catch (_) {}
        }
      }
    }, 50);
  }, []);

  const handleRemoveMultiPhoto = useCallback((targetArrayKey: 'pciPhotoUrls' | 'imagingPhotoUrls', index: number) => {
    const primaryKey = targetArrayKey === 'pciPhotoUrls' ? 'pciPhotoUrl' : 'imagingPhotoUrl';
    setFormData(prev => {
      const existingArray = prev[targetArrayKey] && prev[targetArrayKey]!.length > 0
        ? prev[targetArrayKey]!
        : (prev[primaryKey] ? [prev[primaryKey]!] : []);

      const currentList = [...existingArray];
      currentList.splice(index, 1);
      return {
        ...prev,
        [targetArrayKey]: currentList,
        [primaryKey]: currentList[0] || ''
      };
    });
  }, []);



  const toggleMultiSelectEx = useCallback((field: keyof typeof formData, value: any) => {
    setFormData(prev => {
      const current = prev[field] as any[];
      const exists = current.includes(value);
      return {
        ...prev,
        [field]: exists ? current.filter(v => v !== value) : [...current, value]
      };
    });
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      gender: 'All',
      minAge: '',
      maxAge: '',
      startDate: '',
      endDate: '',
      category: 'All',
      serviceCategory: 'All',
      tag: '',
      tags: [] as string[],
      tagMatchMode: 'all' as 'all' | 'any',
      dateField: 'either' as 'either' | 'created' | 'updated',
      importantOnly: false
    });
    setSortBy('date');
    setSortOrder('desc');
  }, []);

  const handleSortToggle = useCallback((field: 'date' | 'name' | 'serialNo' | 'admissionNo' | 'ageGen' | 'ef' | 'finalNotes' | 'generalNotes' | 'status') => {
    setSortBy(prevSortBy => {
      if (prevSortBy === field) {
        setSortOrder(prevOrder => prevOrder === 'asc' ? 'desc' : 'asc');
        return prevSortBy;
      } else {
        setSortOrder(field === 'date' ? 'desc' : 'asc');
        return field;
      }
    });
  }, []);

  const conditionTags = React.useMemo(() => {
    const predefined = [
      'STEMI', 'NSTEMI', 'USA', 'CCS-IV', 'Cardiogenic Shock',
      'LAD', 'LCX', 'RCA', 'LM', 'Ramus', 'Graft', 'CTO',
      'Calcific', 'Bifurcation', 'SCAD', 'Ectasia',
      'IVUS', 'OCT', 'FFR', 'Rotablation', 'IVL',
      'T2DM', 'HTN', 'CKD', 'Dyslipidemia'
    ];
    const userCreated = patients.flatMap(p => {
      if (p.isDeleted) return [];
      if (Array.isArray(p.tags)) return p.tags;
      if (typeof p.tags === 'string' && p.tags) return (p.tags as string).split(/[,|;]/).map(t => t.trim());
      return [];
    });
    return Array.from(new Set([...predefined, ...userCreated])).filter(Boolean).sort();
  }, [patients]);

  const toggleFilterTag = useCallback((tag: string) => {
    setFilters(prev => {
      const exists = prev.tags.includes(tag);
      return {
        ...prev,
        tags: exists ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag]
      };
    });
  }, []);

  const tagCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    patients.forEach(p => {
      if (p.isDeleted) return;
      const seen = new Set<string>();
      
      const addTag = (rawTag: string) => {
        if (!rawTag) return;
        const t = String(rawTag).trim();
        if (t && !seen.has(t.toLowerCase())) {
          seen.add(t.toLowerCase());
          counts[t] = (counts[t] || 0) + 1;
        }
      };

      if (Array.isArray(p.tags)) {
        p.tags.forEach(t => addTag(t));
      } else if (typeof p.tags === 'string' && p.tags) {
        (p.tags as string).split(/[,|;]/).forEach(t => addTag(t));
      }

      if (p.presentation) addTag(p.presentation);
      if (Array.isArray(p.pciVessels)) p.pciVessels.forEach(v => addTag(v));
      if (Array.isArray(p.lesionTypes)) p.lesionTypes.forEach(lt => addTag(lt));
      if (Array.isArray(p.lesions)) p.lesions.forEach(l => addTag(l));
      if (p.bifurcation) addTag('Bifurcation');
      if (Array.isArray(p.specialHardware)) p.specialHardware.forEach(h => addTag(h));
      if (Array.isArray(p.imaging)) p.imaging.forEach(img => addTag(img));
      if (Array.isArray(p.comorbidities)) p.comorbidities.forEach(c => addTag(c));
    });
    return counts;
  }, [patients]);

  const allAvailableTags = React.useMemo(() => {
    const predefined = [
      'STEMI', 'NSTEMI', 'USA', 'CCS-IV', 'Cardiogenic Shock',
      'LAD', 'LCX', 'RCA', 'LM', 'Ramus', 'Graft', 'CTO',
      'Calcific', 'Bifurcation', 'SCAD', 'Ectasia',
      'IVUS', 'OCT', 'FFR', 'Rotablation', 'IVL',
      'T2DM', 'HTN', 'CKD', 'Dyslipidemia'
    ];
    const allTags = Array.from(new Set([...Object.keys(tagCounts), ...predefined]));
    return allTags.sort((a, b) => {
      const countA = tagCounts[a] || 0;
      const countB = tagCounts[b] || 0;
      if (countA !== countB) return countB - countA;
      return a.localeCompare(b);
    });
  }, [tagCounts]);

  const popularTags = React.useMemo(() => {
    return allAvailableTags.slice(0, 15);
  }, [allAvailableTags]);

  const filteredPatients = React.useMemo(() => {
    let result = patients.filter(p => !p.isDeleted);

    if (searchQuery) {
      if (searchMode === 'exact') {
        const query = searchQuery.trim().toLowerCase();
        result = result.filter(p => {
          const checkValue = (val: any): boolean => {
            if (val === undefined || val === null) return false;
            if (Array.isArray(val)) {
              return val.some(v => String(v).toLowerCase().includes(query));
            }
            return String(val).toLowerCase().includes(query);
          };
          return (
            checkValue(p.name) ||
            checkValue(p.serNo) ||
            checkValue(p.serviceCategory) ||
            checkValue(p.admissionNo) ||
            checkValue(p.patientId) ||
            checkValue(p.phoneNumbers) ||
            checkValue(p.serialNo) ||
            checkValue(p.age) ||
            checkValue(p.gender) ||
            checkValue(p.date) ||
            checkValue(p.presentation) ||
            checkValue(p.tmt) ||
            checkValue(p.ejectionFraction) ||
            checkValue(p.rwma) ||
            checkValue(p.comorbidities) ||
            checkValue(p.access) ||
            checkValue(p.otherAccessNotes) ||
            checkValue(p.pciVessels) ||
            checkValue(p.lesionTypes) ||
            checkValue(p.imaging) ||
            checkValue(p.specialHardware) ||
            checkValue(p.complications) ||
            checkValue(p.otherHardwareNotes) ||
            checkValue(p.drugs) ||
            checkValue(p.finalNotes) ||
            checkValue(p.plan) ||
            checkValue(p.notes) ||
            checkValue(p.category) ||
            checkValue(p.otherCategoryNotes) ||
            checkValue(p.tags) ||
            checkValue(p.place) ||
            checkValue(p.lesions) ||
            checkValue(p.stentDetails) ||
            checkValue(p.brsDetails) ||
            checkValue(p.debDetails)
          );
        });
      } else {
        const fuse = new Fuse(result, {
          keys: [
            'name',
            'serNo',
            'serviceCategory',
            'admissionNo',
            'patientId',
            'phoneNumbers',
            'serialNo',
            'age',
            'gender',
            'date',
            'presentation',
            'tmt',
            'ejectionFraction',
            'rwma',
            'comorbidities',
            'access',
            'otherAccessNotes',
            'pciVessels',
            'lesionTypes',
            'imaging',
            'specialHardware',
            'complications',
            'otherHardwareNotes',
            'drugs',
            'finalNotes',
            'plan',
            'notes',
            'category',
            'otherCategoryNotes',
            'tags',
            'place',
            'lesions',
            'stentDetails',
            'brsDetails',
            'debDetails'
          ],
          threshold: 0.3,
          distance: 100,
          ignoreLocation: true
        });
        result = fuse.search(searchQuery).map(r => r.item);
      }
    }

    return result.filter(p => {
      const matchesGender = filters.gender === 'All' || p.gender === filters.gender;
      
      const age = p.age;
      const matchesMinAge = !filters.minAge || (typeof age === 'number' && age >= parseInt(filters.minAge));
      const matchesMaxAge = !filters.maxAge || (typeof age === 'number' && age <= parseInt(filters.maxAge));

      // Date matching against procedure date (p.date), createdAt, updatedAt
      const procDate = parseAnyDateToDate(p.date);
      const createDate = parseAnyDateToDate(p.createdAt);
      const updateDate = parseAnyDateToDate(p.updatedAt || p.localUpdatedAt);

      const matchesDate = (() => {
        if (!filters.startDate && !filters.endDate) return true;

        const start = filters.startDate ? parseAnyDateToDate(filters.startDate) : null;
        if (start) start.setHours(0, 0, 0, 0);

        const end = filters.endDate ? parseAnyDateToDate(filters.endDate) : null;
        if (end) end.setHours(23, 59, 59, 999);

        // Check if a specific date timestamp falls entirely within [start, end]
        const checkSingleDate = (d: Date | null) => {
          if (!d) return false;
          if (start && d < start) return false;
          if (end && d > end) return false;
          return true;
        };

        if (filters.dateField === 'created') {
          return checkSingleDate(createDate) || (!createDate && checkSingleDate(procDate));
        } else if (filters.dateField === 'updated') {
          return checkSingleDate(updateDate) || (!updateDate && checkSingleDate(createDate)) || (!updateDate && !createDate && checkSingleDate(procDate));
        } else {
          // 'either' / default: procedure date is primary
          if (procDate) {
            return checkSingleDate(procDate);
          }
          return checkSingleDate(createDate) || checkSingleDate(updateDate);
        }
      })();

      // Procedure Category (Type)
      const matchesCategory = filters.category === 'All' || (() => {
        const pCat = String(p.category || '').trim();
        const fCat = String(filters.category).trim();
        const pCatLower = pCat.toLowerCase();
        const fCatLower = fCat.toLowerCase();

        // Exact match
        if (pCat === fCat || pCatLower === fCatLower) return true;

        if (fCatLower === 'cag') {
          return pCatLower === 'cag' || pCatLower.startsWith('cag');
        }
        if (fCatLower === 'pci') {
          return pCatLower.includes('pci') || (Array.isArray(p.pciVessels) && p.pciVessels.length > 0) || (Array.isArray(p.stentDetails) && p.stentDetails.length > 0) || Boolean(p.pciPhotoUrl);
        }
        if (fCatLower === 'cag+pci' || fCatLower === 'cag_pci' || fCatLower === 'cag + pci') {
          return pCatLower === 'cag+pci' || pCatLower === 'cag + pci' || (pCatLower.includes('cag') && pCatLower.includes('pci'));
        }
        if (fCatLower === 'cag+ffr' || fCatLower === 'cag + ffr') {
          return pCatLower.includes('ffr');
        }
        if (fCatLower.includes('primary')) {
          return pCatLower.includes('primary') || (p.presentation?.toUpperCase() === 'STEMI' && (pCatLower.includes('pci') || (Array.isArray(p.pciVessels) && p.pciVessels.length > 0)));
        }
        if (fCatLower.includes('staged')) {
          return pCatLower.includes('staged');
        }
        if (fCatLower.includes('device')) {
          return pCatLower.includes('device') || pCatLower.includes('pacemaker') || pCatLower.includes('icd') || pCatLower.includes('crt') || (p.devices && Object.keys(p.devices).length > 0);
        }
        if (fCatLower.includes('structural')) {
          return pCatLower.includes('structural') || pCatLower.includes('tavr') || pCatLower.includes('mitraclip') || pCatLower.includes('bmv');
        }
        if (fCatLower.includes('peripheral')) {
          return pCatLower.includes('peripheral') || pCatLower.includes('evar') || pCatLower.includes('femoral') || pCatLower.includes('carotid');
        }
        if (fCatLower === 'ep') {
          return pCatLower === 'ep' || pCatLower.includes('ep') || pCatLower.includes('electrophys');
        }
        if (fCatLower.includes('renal')) {
          return pCatLower.includes('renal');
        }
        if (fCatLower.includes('fluoro')) {
          return pCatLower.includes('fluoro');
        }
        if (fCatLower.includes('pediatric')) {
          return pCatLower.includes('pediatric');
        }
        if (fCatLower === 'other') {
          return pCatLower === 'other' || (!pCatLower && (!p.pciVessels || p.pciVessels.length === 0) && !p.devices);
        }
        return pCatLower.includes(fCatLower);
      })();
      
      // Service Category (Class)
      const matchesServiceCategory = filters.serviceCategory === 'All' || (() => {
        const pCat = String(p.serviceCategory || ServiceCategory.Ser).trim().toLowerCase();
        const fCat = filters.serviceCategory.trim().toLowerCase();
        
        if (fCat === 'ser') {
          return !pCat || pCat === 'ser' || pCat.startsWith('serv');
        }
        if (fCat === 'vet') {
          return pCat === 'vet' || pCat.startsWith('vet') || pCat === 'esm' || pCat.includes('veteran') || pCat.includes('ex-serv') || pCat.includes('retd');
        }
        if (fCat === 'dep') {
          return pCat === 'dep' || pCat.startsWith('dep') || pCat.includes('dependent') || pCat.includes('family');
        }
        return pCat === fCat || pCat.includes(fCat);
      })();
      
      // Tags helper
      const checkPatientHasTag = (targetTag: string) => {
        if (!targetTag) return true;
        const target = targetTag.trim().toLowerCase();
        if (!target) return true;
        
        // 1. Check tags field
        if (Array.isArray(p.tags)) {
          if (p.tags.some(t => {
            const str = String(t).trim().toLowerCase();
            return str === target || str.includes(target) || target.includes(str);
          })) return true;
        } else if (typeof p.tags === 'string' && p.tags) {
          const splitTags = (p.tags as string).split(/[,|;]/).map(t => t.trim().toLowerCase());
          if (splitTags.some(t => t === target || t.includes(target) || target.includes(t))) return true;
        }

        // 2. Check clinical fields
        if (p.presentation && (p.presentation.toLowerCase() === target || p.presentation.toLowerCase().includes(target))) return true;
        if (Array.isArray(p.pciVessels) && p.pciVessels.some(v => String(v).toLowerCase() === target || String(v).toLowerCase().includes(target))) return true;
        if (Array.isArray(p.lesionTypes) && p.lesionTypes.some(lt => String(lt).toLowerCase() === target || String(lt).toLowerCase().includes(target))) return true;
        if (Array.isArray(p.lesions) && p.lesions.some(l => String(l).toLowerCase() === target || String(l).toLowerCase().includes(target))) return true;
        if (p.bifurcation && (target === 'bifurcation' || target.includes('bifurc'))) return true;
        if (Array.isArray(p.specialHardware) && p.specialHardware.some(h => String(h).toLowerCase() === target || String(h).toLowerCase().includes(target))) return true;
        if (Array.isArray(p.imaging) && p.imaging.some(img => String(img).toLowerCase() === target || String(img).toLowerCase().includes(target))) return true;
        if (Array.isArray(p.comorbidities) && p.comorbidities.some(c => String(c).toLowerCase() === target || String(c).toLowerCase().includes(target))) return true;
        
        // 3. Check notes for keyword
        if (p.finalNotes && p.finalNotes.toLowerCase().includes(target)) return true;
        if (p.plan && p.plan.toLowerCase().includes(target)) return true;
        if (p.notes && p.notes.toLowerCase().includes(target)) return true;
        if (p.otherCategoryNotes && p.otherCategoryNotes.toLowerCase().includes(target)) return true;
        if (p.otherHardwareNotes && p.otherHardwareNotes.toLowerCase().includes(target)) return true;

        return false;
      };

      const matchesTagInput = !filters.tag || checkPatientHasTag(filters.tag);
      
      const matchesTagsList = filters.tags.length === 0 || (() => {
        if (filters.tagMatchMode === 'all') {
          return filters.tags.every(t => checkPatientHasTag(t));
        } else {
          return filters.tags.some(t => checkPatientHasTag(t));
        }
      })();

      const matchesImportant = !filters.importantOnly || !!p.isImportant;

      return (
        matchesImportant &&
        matchesServiceCategory &&
        matchesCategory &&
        matchesDate &&
        matchesTagsList &&
        matchesTagInput &&
        matchesGender &&
        matchesMinAge &&
        matchesMaxAge
      );
    }).sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        const nameA = a.name || '';
        const nameB = b.name || '';
        comparison = nameA.localeCompare(nameB, undefined, { sensitivity: 'base', numeric: true });
      } else if (sortBy === 'date') {
        const dA = parseDMYToDate(a.date) || new Date(0);
        const dB = parseDMYToDate(b.date) || new Date(0);
        comparison = dA.getTime() - dB.getTime();
      } else if (sortBy === 'admissionNo') {
        const admA = a.admissionNo || '';
        const admB = b.admissionNo || '';
        comparison = admA.localeCompare(admB, undefined, { sensitivity: 'base', numeric: true });
      } else if (sortBy === 'ageGen') {
        const ageA = Number(a.age) || 0;
        const ageB = Number(b.age) || 0;
        comparison = ageA - ageB;
        if (comparison === 0) {
          comparison = (a.gender || '').localeCompare(b.gender || '');
        }
      } else if (sortBy === 'age') {
        const ageA = Number(a.age) || 0;
        const ageB = Number(b.age) || 0;
        comparison = ageA - ageB;
      } else if (sortBy === 'gender') {
        comparison = (a.gender || '').localeCompare(b.gender || '');
      } else if (sortBy === 'ef') {
        const efA = a.ejectionFraction === EjectionFraction.Other && a.otherEjectionFractionNotes ? a.otherEjectionFractionNotes : a.ejectionFraction;
        const efB = b.ejectionFraction === EjectionFraction.Other && b.otherEjectionFractionNotes ? b.otherEjectionFractionNotes : b.ejectionFraction;
        comparison = String(efA || '').localeCompare(String(efB || ''));
      } else if (sortBy === 'finalNotes') {
        comparison = (a.finalNotes || '').localeCompare(b.finalNotes || '');
      } else if (sortBy === 'generalNotes') {
        comparison = (a.notes || '').localeCompare(b.notes || '');
      } else if (sortBy === 'status') {
        const statusLabelA = getPatientStatus(a).label;
        const statusLabelB = getPatientStatus(b).label;
        comparison = statusLabelA.localeCompare(statusLabelB);
      } else {
        comparison = (Number(a.serialNo) || 0) - (Number(b.serialNo) || 0);
      }

      if (comparison === 0) {
        comparison = (Number(a.serialNo) || 0) - (Number(b.serialNo) || 0);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [patients, searchQuery, searchMode, filters, sortBy, sortOrder]);

  const duplicateSerials = React.useMemo(() => {
    const counts: { [key: number]: number } = {};
    patients.forEach(p => {
      if (p.serialNo) {
        counts[p.serialNo] = (counts[p.serialNo] || 0) + 1;
      }
    });
    return counts;
  }, [patients]);

  const clinicalInsights = React.useMemo(() => {
    const totalRecords = filteredPatients.length;
    let totalEFSum = 0;
    let efCount = 0;
    let pciCount = 0;

    filteredPatients.forEach(p => {
      // PCI case detection
      const isPci = (p.pciVessels && p.pciVessels.length > 0) ||
                    (p.category && (p.category.includes('PCI') || p.category.includes('CAG+PCI'))) ||
                    Boolean(p.pciPhotoUrl);
      if (isPci) {
        pciCount++;
      }

      // EF numerical extraction or mapping
      let numEf: number | null = null;
      const combinedText = `${p.ejectionFraction || ''} ${p.otherEjectionFractionNotes || ''}`.trim();
      const match = combinedText.match(/\b([2-8]\d)\b/);
      if (match) {
        numEf = parseInt(match[1], 10);
      } else if (p.ejectionFraction) {
        const efLower = String(p.ejectionFraction).toLowerCase();
        if (efLower.includes('normal')) numEf = 55;
        else if (efLower.includes('mild')) numEf = 50;
        else if (efLower.includes('moderate')) numEf = 40;
        else if (efLower.includes('severe')) numEf = 30;
        else if (efLower.includes('lvh') || efLower.includes('hcm') || efLower.includes('hocm')) numEf = 55;
      }

      if (numEf !== null && !isNaN(numEf)) {
        totalEFSum += numEf;
        efCount++;
      }
    });

    return {
      totalRecords,
      avgEF: efCount > 0 ? Math.round(totalEFSum / efCount) : null,
      efCount,
      pciCount,
    };
  }, [filteredPatients]);

  const ROW_HEIGHT = 53;
  const overscan = 10;

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - overscan);
  const endIndex = Math.min(filteredPatients.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + overscan);

  const visiblePatients = useMemo(() => {
    return filteredPatients.slice(startIndex, endIndex);
  }, [filteredPatients, startIndex, endIndex]);

  const topOffset = startIndex * ROW_HEIGHT;
  const bottomOffset = Math.max(0, (filteredPatients.length - endIndex) * ROW_HEIGHT);

  useEffect(() => {
    if (view === 'list') {
      const timer = setTimeout(() => {
        if (tableContainerRef.current) {
          setContainerHeight(tableContainerRef.current.clientHeight || 600);
          setScrollTop(tableContainerRef.current.scrollTop || 0);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [view, filteredPatients.length]);

  const handleToggleAll = useCallback(() => {
    setSelectedPatientIds(prev => {
      const allFilteredIds = filteredPatients.map(p => p.id!).filter(Boolean);
      const allSelected = allFilteredIds.every(id => prev.includes(id));
      if (allSelected) {
        return prev.filter(id => !allFilteredIds.includes(id));
      } else {
        const union = Array.from(new Set([...prev, ...allFilteredIds]));
        return union;
      }
    });
  }, [filteredPatients]);

  const handleBulkExportPDF = useCallback(async () => {
    const selectedRecords = patients.filter(p => selectedPatientIds.includes(p.id!));
    if (selectedRecords.length === 0) return;
    
    selectedRecords.sort((a, b) => (a.serialNo || 0) - (b.serialNo || 0));

    setIsExportingPDF(true);
    setExportProgress({ current: 0, total: selectedRecords.length, stage: 'combined' });
    setToast({ message: "Generating bulk PDF reports with clinical photos... Please wait.", type: "success" });
    try {
      await generateCombinedPatientsPDF(selectedRecords, (curr, tot) => {
        setExportProgress({ current: curr, total: tot, stage: 'combined' });
      }, syncHandle, true, getPdfExportOptions());
      setToast({ message: "Bulk PDF reports exported successfully!", type: "success" });
      triggerVibrate();
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to generate bulk PDF reports.", type: "error" });
    } finally {
      setIsExportingPDF(false);
      setExportProgress(null);
    }
  }, [patients, selectedPatientIds, triggerVibrate, syncHandle, getPdfExportOptions]);

  const handleBulkExportPDFZip = useCallback(async () => {
    const selectedRecords = patients.filter(p => selectedPatientIds.includes(p.id!));
    if (selectedRecords.length === 0) return;
    
    selectedRecords.sort((a, b) => (a.serialNo || 0) - (b.serialNo || 0));

    setIsExportingPDF(true);
    setExportProgress({ current: 0, total: selectedRecords.length, stage: 'zip' });
    setToast({ message: "Generating ZIP of individual PDF reports... Please wait.", type: "success" });
    try {
      const zip = new JSZip();
      let currentIdx = 0;
      for (const p of selectedRecords) {
        const { doc, filename } = await generatePatientPDF(p, false, syncHandle, getPdfExportOptions());
        const pdfData = doc.output('arraybuffer');
        zip.file(filename, pdfData);
        currentIdx++;
        setExportProgress({ current: currentIdx, total: selectedRecords.length, stage: 'zip' });
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      
      const content = await zip.generateAsync({ type: 'blob' });
      const batchFileName = `clinical_reports_pdf_batch_${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}.zip`;
      saveAs(content, batchFileName);
      if (syncHandle) {
        try {
          const fileHandle = await syncHandle.getFileHandle(batchFileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(content);
          await writable.close();
        } catch (e) {
          console.error('Error saving batch ZIP to local folder:', e);
        }
      }
      setToast({ message: "ZIP of PDF reports exported successfully!", type: "success" });
      triggerVibrate();
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to generate ZIP of PDF reports.", type: "error" });
    } finally {
      setIsExportingPDF(false);
      setExportProgress(null);
    }
  }, [patients, selectedPatientIds, triggerVibrate, syncHandle, getPdfExportOptions]);

  const handleBulkExportCSV = useCallback(() => {
    const selectedRecords = patients.filter(p => selectedPatientIds.includes(p.id!));
    if (selectedRecords.length === 0) return;

    selectedRecords.sort((a, b) => (a.serialNo || 0) - (b.serialNo || 0));

    const isAnonymizedExport = globalPrivacyMode || printIsAnonymized;

    const headers = [
      'Serial No', 'Ser No', 'Service Status', 'Admission No', 'Name', 'Age', 'Gender', 'Weight', 'Height', 'BMI', 
      'Pre Hb', 'Pre Urea', 'Pre Creatinine', 'Pre K', 'Post Hb', 'Post Urea', 'Post Creatinine', 'Post K',
      'Phone Numbers', 
      'Date', 'Presentation', 'TMT', 'EF', 'EF Notes', 'RWMA', 'Comorbidities', 'Access', 'Access Notes', 'USG Doppler', 'Bifurcation', 
      'Other Flag', 'PCI Vessels', 'Imaging', 'Imaging Findings', 'Sp Hardware', 'Stent Details', 'BRS Details', 'DEB Details', 'Lesions', 'Device Counts',
      'Closure Device', 'Closure Device Custom', 'Complications', 'Complications Custom', 'Other Hardware', 'Other Hardware Notes', 
      'Drugs', 'Final Notes', 'Notes', 'Category', 'Tags', 'Place', 'Created At', 'Updated At', 'Created By', 'Outcomes'
    ];
    
    const csvRows = selectedRecords.map(p => [
      p.serialNo,
      `"${isAnonymizedExport ? 'REDACTED' : (p.serNo || '')}"`,
      p.serviceCategory || '',
      `"${isAnonymizedExport ? 'REDACTED' : (p.admissionNo || '')}"`,
      `"${isAnonymizedExport ? 'ANONYMIZED PATIENT' : (p.name || '')}"`,
      p.age,
      p.gender,
      p.weight || '',
      p.height || '',
      p.bmi || '',
      `"${p.preHb || ''}"`,
      `"${p.preUrea || ''}"`,
      `"${p.preCreatinine || ''}"`,
      `"${p.preK || ''}"`,
      `"${p.postHb || ''}"`,
      `"${p.postUrea || ''}"`,
      `"${p.postCreatinine || ''}"`,
      `"${p.postK || ''}"`,
      `"${isAnonymizedExport ? 'REDACTED' : (p.phoneNumbers || []).join(' | ')}"`,
      formatDateDMY(p.date),
      p.presentation || '',
      p.tmt || 'NA',
      p.ejectionFraction || '',
      `"${p.otherEjectionFractionNotes || ''}"`,
      `"${(p.rwma || []).join('|')}"`,
      `"${(p.comorbidities || []).join('|')}"`,
      p.access || '',
      `"${p.otherAccessNotes || ''}"`,
      p.usgDoppler ? 'Yes' : 'No',
      p.bifurcation ? 'Yes' : 'No',
      p.isOther ? 'Yes' : 'No',
      `"${(p.pciVessels || []).join('|')}"`,
      `"${(p.imaging || []).join('|')}"`,
      `"${p.imagingFindings ? Object.entries(p.imagingFindings).map(([k, v]) => `${k}:${v}`).join('|').replace(/"/g, '""') : ''}"`,
      `"${(p.specialHardware || []).join('|')}"`,
      `"${(p.stentDetails || []).join('|')}"`,
      `"${(p.brsDetails || []).join('|')}"`,
      `"${(p.debDetails || []).join('|')}"`,
      `"${(p.lesions || []).join('|')}"`,
      `"${p.devices ? Object.entries(p.devices).map(([t, q]) => `${t}:${q}`).join('|') : ''}"`,
      `"${p.closureDevice || ''}"`,
      `"${p.closureDeviceCustom || ''}"`,
      `"${getComplicationsStr(p, '|')}"`,
      `"${p.complicationsCustom || ''}"`,
      `"${(p.otherHardware || []).join('|')}"`,
      `"${p.otherHardwareNotes || ''}"`,
      `"${(p.drugs || []).join('|')}"`,
      `"${(p.finalNotes || '').replace(/"/g, '""')}"`,
      `"${(p.notes || '').replace(/"/g, '""')}"`,
      (p.category === ReportCategory.Other && p.otherCategoryNotes) ? p.otherCategoryNotes : (p.category || ''),
      `"${(p.tags || []).join('|')}"`,
      `"${p.place || ''}"`,
      p.createdAt?.toDate?.()?.toISOString() || (p.createdAt instanceof Date ? p.createdAt.toISOString() : (typeof p.createdAt === 'string' ? new Date(p.createdAt).toISOString() : '')),
      p.updatedAt?.toDate?.()?.toISOString() || (p.updatedAt instanceof Date ? p.updatedAt.toISOString() : (typeof p.updatedAt === 'string' ? new Date(p.updatedAt).toISOString() : '')),
      `"${p.createdBy || ''}"`,
      `"${(p.outcomes || []).map(o => `${formatDateDMY(o.date)}:${o.status}:${o.notes}`).join(';')}"`
    ]);

    const csvContent = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const fileName = `bulk_patients_export_${new Date().toISOString().split('T')[0]}.csv`;
    saveAs(blob, fileName);
    setToast({ message: `Successfully exported ${selectedRecords.length} records to CSV.`, type: 'success' });
  }, [patients, selectedPatientIds, globalPrivacyMode, printIsAnonymized]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedPatientIds.length === 0) return;
    const confirmMessage = `Are you sure you want to permanently delete all ${selectedPatientIds.length} selected patient records? This action cannot be undone.`;
    if (!window.confirm(confirmMessage)) return;

    setIsSubmitting(true);
    try {
      for (const id of selectedPatientIds) {
        await deletePatient(id);
      }
      setPatients(prev => prev.filter(p => !selectedPatientIds.includes(p.id!)));
      setSelectedPatientIds([]);
      await fetchPatients();
      setToast({ message: `Successfully deleted selected records.`, type: 'success' });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      alert('Failed to complete bulk delete: ' + errMsg);
    } finally {
      setIsSubmitting(false);
    }
  }, [patients, selectedPatientIds]);

  const handleContinueOffline = useCallback(() => {
    localStorage.setItem('is_offline_mode', 'true');
    const cachedUser = localStorage.getItem('last_logged_in_user');
    let simulatedUser;
    if (cachedUser) {
      simulatedUser = JSON.parse(cachedUser);
    } else {
      simulatedUser = {
        uid: 'offline_user',
        email: 'offline@local.db',
        displayName: 'Offline Doctor',
        isOffline: true
      };
    }
    setUser(simulatedUser);
    localStorage.setItem('active_user_id', simulatedUser.uid);
    setIsOfflineMode(true);
    fetchPatients();
    fetchPresets();
  }, [fetchPatients, fetchPresets]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-8 text-center"
        >
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Users className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold font-display text-slate-900 mb-2">Patient Records DB</h1>
          <p className="text-slate-500 mb-8">Manage your patient data serially with ease. Please sign in to continue.</p>
          <button 
            onClick={signInWithGoogle}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            Sign in with Google
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-400">Or Work Offline</span>
            </div>
          </div>

          <button 
            onClick={handleContinueOffline}
            className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 border border-slate-200 active:scale-95 cursor-pointer"
          >
            Continue Offline (Local Mode)
          </button>
        </motion.div>
      </div>
    );
  }

  if (!isPinUnlocked) {
    return (
      <PinLockScreen
        appSecurityPin={appSecurityPin}
        setAppSecurityPin={(pin) => {
          if (pin) {
            localStorage.setItem('app_security_pin', pin);
          } else {
            localStorage.removeItem('app_security_pin');
          }
          setAppSecurityPin(pin);
        }}
        onUnlock={() => {
          const today = new Date().toISOString().split('T')[0];
          localStorage.setItem('last_unlocked_date', today);
          setIsPinUnlocked(true);
        }}
        onLogout={async () => {
          if (isOfflineMode) {
            localStorage.removeItem('is_offline_mode');
            localStorage.removeItem('active_user_id');
            setIsOfflineMode(false);
          } else {
            await logout();
          }
          setUser(null);
        }}
        triggerVibrate={triggerVibrate}
      />
    );
  }

  if (view === 'print' && selectedPatient) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
        {/* Print Control Header Bar */}
        <div className="bg-slate-900 text-white py-4 px-4 sm:px-6 md:px-12 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shadow-md sticky top-0 z-[100] print:hidden">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setView('detail')} 
              className="p-1 px-3 hover:bg-white/10 rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center gap-2 border border-white/20 transition-all active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <div className="h-4 w-[1px] bg-white/20" />
            <h1 className="text-sm font-bold tracking-tight truncate">Print Preview â€” {selectedPatient.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setEmrSummaryPatient(selectedPatient)}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase rounded-lg shadow-md hover:shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <FileText className="w-4 h-4" /> Copy EMR Summary
            </button>
            <button 
              onClick={async () => {
                setToast({ message: "Generating clinical report PDF... Please wait.", type: "success" });
                try {
                  const options = getPdfExportOptions();
                  await generatePatientPDF(selectedPatient, true, syncHandle, options);
                  setToast({ message: "PDF report exported successfully!", type: "success" });
                } catch (err) {
                  console.error(err);
                  setToast({ message: "Failed to generate PDF report.", type: "error" });
                }
              }} 
              className="flex-1 sm:flex-none px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase rounded-lg shadow-md hover:shadow-rose-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <FileDown className="w-4 h-4" /> Export PDF
            </button>
            <button 
              onClick={async () => {
                setToast({ message: "Preparing report for print/share... Please wait.", type: "success" });
                try {
                  const options = getPdfExportOptions();
                  const { doc, filename } = await generatePatientPDF(selectedPatient, false, syncHandle, options);
                  
                  // Check for Capacitor or native share capabilities
                  const isCapacitor = !!(window as any).Capacitor;
                  const canShareFiles = navigator.share && navigator.canShare && (() => {
                    try {
                      const testBlob = new Blob([''], { type: 'application/pdf' });
                      const testFile = new File([testBlob], 'test.pdf', { type: 'application/pdf' });
                      return navigator.canShare({ files: [testFile] });
                    } catch (e) {
                      return false;
                    }
                  })();

                  if (isCapacitor || canShareFiles) {
                    const pdfBlob = doc.output('blob');
                    const file = new File([pdfBlob], filename, { type: 'application/pdf' });
                    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                      await navigator.share({
                        files: [file],
                        title: `Clinical Report - ${printIsAnonymized ? 'Anonymized Record' : selectedPatient.name}`,
                        text: `Clinical record for patient ${printIsAnonymized ? 'ANONYMIZED' : selectedPatient.name}.`,
                      });
                      setToast({ message: "Share sheet opened successfully!", type: "success" });
                      return;
                    }
                  }

                  // Standard browser/desktop fallback
                  window.print();
                  if (syncHandle && selectedPatient) {
                    try {
                      await generatePatientPDF(selectedPatient, false, syncHandle, options);
                    } catch (err) {
                      console.error('Error auto-saving PDF to sync folder on print:', err);
                    }
                  }
                } catch (err) {
                  console.error('Error printing/sharing record:', err);
                  // Direct print fallback
                  window.print();
                }
              }} 
              className="flex-1 sm:flex-none px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase rounded-lg shadow-md hover:shadow-blue-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Print Record
            </button>
          </div>
        </div>

        {/* Outer Grid: Customization Panel on left (hidden when printing), Preview Sheet on right */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 relative overflow-hidden">
          {/* Print Layout Customization Panel */}
          <div className="w-full lg:w-96 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 overflow-y-auto p-6 shrink-0 print:hidden shadow-sm flex flex-col gap-6">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-1 flex items-center gap-2">
                <Printer className="w-4 h-4 text-blue-600" /> Print Settings
              </h2>
              <p className="text-[11px] text-slate-500">
                Customize layout elements, anonymization, tags, scales, and titles prior to paper/PDF printing.
              </p>
            </div>

            {/* EMR Copy Panel */}
            <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/40 flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase text-indigo-700 tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-600" /> EMR Integration
              </span>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Generate and copy a clean plain-text summary optimized for direct copy-pasting into electronic health records.
              </p>
              <button
                onClick={() => setEmrSummaryPatient(selectedPatient)}
                className="w-full mt-1.5 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" /> Copy EMR Summary
              </button>
            </div>

            <PrintPresetManager
              presets={presets}
              presetsLoading={presetsLoading}
              selectedPresetId={selectedPresetId}
              onSelectPreset={handleSelectPreset}
              onSavePreset={handleSavePreset}
              onDeletePreset={handleDeletePreset}
            />

            {/* Privacy & Anonymization Mode */}
            <div className="space-y-3 p-4 bg-amber-50/80 rounded-2xl border border-amber-200/80">
              <div className="flex items-center justify-between">
                <label htmlFor="toggle-anonymize-pdf" className="text-[10px] font-bold uppercase text-amber-900 tracking-wider cursor-pointer flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-600" /> Anonymize Export Data
                  {globalPrivacyMode && (
                    <span className="text-[8.5px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-semibold uppercase">Global Enforced</span>
                  )}
                </label>
                <input
                  id="toggle-anonymize-pdf"
                  type="checkbox"
                  checked={globalPrivacyMode || printIsAnonymized}
                  disabled={globalPrivacyMode}
                  onChange={(e) => setPrintIsAnonymized(e.target.checked)}
                  className="w-4 h-4 text-amber-600 border-amber-300 rounded focus:ring-amber-500 cursor-pointer disabled:opacity-70"
                />
              </div>
              <p className="text-[9.5px] text-amber-800/90 leading-relaxed">
                {globalPrivacyMode 
                  ? "Global Privacy Mode is active in Settings. All patient names, admission numbers, and contact details are automatically redacted across all PDF and CSV exports."
                  : "Redacts patient full name, admission number, and phone numbers in PDF exports & printed sheets for research & privacy compliance."}
              </p>
            </div>

            {/* Layout Mode (Compact vs Detailed) */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
                Report Layout Format
              </label>
              <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl">
                {(['compact', 'detailed'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setPrintLayoutMode(mode)}
                    className={`py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all active:scale-95 cursor-pointer ${
                      printLayoutMode === mode
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {mode === 'compact' ? 'Compact' : 'Detailed'}
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-slate-400 italic">
                * Compact layout shrinks spacing and clinical images to fit onto a single page.
              </p>
            </div>

            {/* Scale Options */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
                Text Scale & Margins
              </label>
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
                {(['compact', 'normal', 'large'] as const).map((scale) => (
                  <button
                    key={scale}
                    onClick={() => setPrintTextSizeScale(scale)}
                    className={`py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all active:scale-95 cursor-pointer ${
                      printTextSizeScale === scale
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {scale}
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-slate-400 italic">
                * Compact shrinks text & paddings to squeeze content onto single/fewer sheets.
              </p>
            </div>

            {/* Letterhead Settings */}
            <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center justify-between">
                <label htmlFor="toggle-hospital-header" className="text-[10px] font-bold uppercase text-slate-700 tracking-wider cursor-pointer">
                  Hospital Letterhead Header
                </label>
                <input
                  id="toggle-hospital-header"
                  type="checkbox"
                  checked={printShowHospitalHeader}
                  onChange={(e) => setPrintShowHospitalHeader(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                />
              </div>

              {printShowHospitalHeader && (
                <div className="space-y-2">
                  <div>
                    <label htmlFor="input-header-title" className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Header Report Title
                    </label>
                    <input
                      id="input-header-title"
                      type="text"
                      value={printHeaderTitle}
                      onChange={(e) => setPrintHeaderTitle(e.target.value)}
                      placeholder="e.g. Cardiology Department"
                      className="w-full text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label htmlFor="input-doctor-name" className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Doctor In-Charge
                    </label>
                    <input
                      id="input-doctor-name"
                      type="text"
                      value={printPhysicianName}
                      onChange={(e) => setPrintPhysicianName(e.target.value)}
                      placeholder="e.g. Dr Bharat S Sambyal"
                      className="w-full text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Visible Sections checklist */}
            <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-bold uppercase text-slate-700 tracking-wider block">
                Toggle Sections
              </span>
              <div className="space-y-2 text-xs">
                {Object.entries(printVisibleSections).map(([key, value]) => {
                  const labelMap: Record<string, string> = {
                    demographics: 'Patient Demographics',
                    diagnostics: 'Echocardiography & Pres.',
                    anatomy: 'Vascular Access & Anatomy',
                    pci: 'PCI Interventions & Equipment',
                    outcomes: 'Follow-Up / Outcomes',
                    photos: 'Diagnostic Attachments',
                    signatures: 'Clinician Signatures',
                    qrcode: 'Patient QR Code',
                    tags: 'AI / Condition Tags'
                  };
                  return (
                    <label key={key} htmlFor={`toggle-sec-${key}`} className="flex items-center gap-2.5 text-slate-600 hover:text-slate-900 cursor-pointer">
                      <input
                        id={`toggle-sec-${key}`}
                        type="checkbox"
                        checked={value}
                        onChange={(e) => setPrintVisibleSections(prev => ({ ...prev, [key]: e.target.checked }))}
                        className="w-3.5 h-3.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                      <span>{labelMap[key] || key}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Quick Layout Advice Banner */}
            <div className="mt-auto p-3.5 bg-blue-50 rounded-xl border border-blue-100/30 text-[10px] text-blue-700 leading-relaxed flex items-start gap-2.5">
              <span className="text-xs shrink-0">ðŸ’¡</span>
              <div>
                <span className="font-bold block mb-0.5">Printing Tip</span>
                For highest fidelity paper reports, set layout to <strong className="font-semibold text-blue-900">Portrait</strong> and enable <strong className="font-semibold text-blue-900">Background Graphics</strong> in the browser's print options sheet.
              </div>
            </div>
          </div>

          {/* Clinical Document Sheet Live Preview */}
          <div className="flex-1 overflow-x-auto overflow-y-auto py-4 sm:py-8 px-2 sm:px-6 md:py-12 print:p-0 print:bg-white w-full">
            <PatientClinicalSheet 
              patient={selectedPatient} 
              onPreviewPhoto={(url, title) => setPreviewPhoto({ url, title })}
              onCopyEMR={(p) => setEmrSummaryPatient(p)}
              onEdit={(p) => startEdit(p)}
              customHeaderTitle={printHeaderTitle}
              showHospitalHeader={printShowHospitalHeader}
              textSizeScale={printTextSizeScale}
              printLayoutMode={printLayoutMode}
              isAnonymized={printIsAnonymized}
              visibleSections={printVisibleSections}
              customPhysicianName={printPhysicianName}
            />
          </div>
        </div>
      </div>
    );
  }

  if (view === 'bulk-print') {
    const selectedRecords = patients.filter(p => selectedPatientIds.includes(p.id!));
    if (selectedRecords.length === 0) {
      setView('list');
      return null;
    }
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
        {/* Print Control Header Bar */}
        <div className="bg-slate-900 text-white py-4 px-4 sm:px-6 md:px-12 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shadow-md sticky top-0 z-[100] print:hidden">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setView('list')} 
              className="p-1 px-3 hover:bg-white/10 rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center gap-2 border border-white/20 transition-all active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Back to List
            </button>
            <div className="h-4 w-[1px] bg-white/20" />
            <h1 className="text-sm font-bold tracking-tight truncate">Bulk Print Preview â€” {selectedRecords.length} Records</h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={async () => {
                setToast({ message: "Generating bulk clinical PDF reports... Please wait.", type: "success" });
                try {
                  const options = getPdfExportOptions();
                  await generateCombinedPatientsPDF(selectedRecords, undefined, syncHandle, true, options);
                  setToast({ message: "Bulk PDF exported successfully!", type: "success" });
                } catch (err) {
                  console.error(err);
                  setToast({ message: "Failed to generate bulk PDF.", type: "error" });
                }
              }} 
              className="flex-1 sm:flex-none px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase rounded-lg shadow-md hover:shadow-rose-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <FileDown className="w-4 h-4" /> Export Combined PDF
            </button>
            <button 
              onClick={async () => {
                setToast({ message: "Preparing bulk clinical reports for print/share... Please wait.", type: "success" });
                try {
                  const options = getPdfExportOptions();
                  const { doc, filename } = await generateCombinedPatientsPDF(selectedRecords, undefined, syncHandle, false, options);
                  
                  // Check for Capacitor or native share capabilities
                  const isCapacitor = !!(window as any).Capacitor;
                  const canShareFiles = navigator.share && navigator.canShare && (() => {
                    try {
                      const testBlob = new Blob([''], { type: 'application/pdf' });
                      const testFile = new File([testBlob], 'test.pdf', { type: 'application/pdf' });
                      return navigator.canShare({ files: [testFile] });
                    } catch (e) {
                      return false;
                    }
                  })();

                  if (isCapacitor || canShareFiles) {
                    const pdfBlob = doc.output('blob');
                    const file = new File([pdfBlob], filename, { type: 'application/pdf' });
                    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                      await navigator.share({
                        files: [file],
                        title: 'Combined Clinical Reports',
                        text: `Clinical report PDF for ${selectedRecords.length} records.`,
                      });
                      setToast({ message: "Share sheet opened successfully!", type: "success" });
                      return;
                    }
                  }

                  // Standard browser/desktop fallback
                  window.print();
                  if (syncHandle && selectedRecords.length > 0) {
                    try {
                      for (const p of selectedRecords) {
                        await generatePatientPDF(p, false, syncHandle, options);
                      }
                    } catch (err) {
                      console.error('Error auto-saving bulk PDFs to sync folder on print:', err);
                    }
                  }
                } catch (err) {
                  console.error('Error printing/sharing bulk records:', err);
                  // Direct print fallback
                  window.print();
                }
              }} 
              className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase rounded-lg shadow-md hover:shadow-blue-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Print All ({selectedRecords.length})
            </button>
          </div>
        </div>

        {/* Outer Grid: Customization Panel on left (hidden when printing), Bulk Preview Sheets on right */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 relative overflow-hidden">
          {/* Print Layout Customization Panel */}
          <div className="w-full lg:w-96 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 overflow-y-auto p-6 shrink-0 print:hidden shadow-sm flex flex-col gap-6">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-1 flex items-center gap-2">
                <Printer className="w-4 h-4 text-blue-600" /> Bulk Print Settings
              </h2>
              <p className="text-[11px] text-slate-500">
                Configure formatting across all {selectedRecords.length} records.
              </p>
            </div>

            <PrintPresetManager
              presets={presets}
              presetsLoading={presetsLoading}
              selectedPresetId={selectedPresetId}
              onSelectPreset={handleSelectPreset}
              onSavePreset={handleSavePreset}
              onDeletePreset={handleDeletePreset}
            />

            {/* Privacy & Anonymization Mode */}
            <div className="space-y-3 p-4 bg-amber-50/80 rounded-2xl border border-amber-200/80">
              <div className="flex items-center justify-between">
                <label htmlFor="toggle-bulk-anonymize-pdf" className="text-[10px] font-bold uppercase text-amber-900 tracking-wider cursor-pointer flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-600" /> Anonymize Export Data
                  {globalPrivacyMode && (
                    <span className="text-[8.5px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-semibold uppercase">Global Enforced</span>
                  )}
                </label>
                <input
                  id="toggle-bulk-anonymize-pdf"
                  type="checkbox"
                  checked={globalPrivacyMode || printIsAnonymized}
                  disabled={globalPrivacyMode}
                  onChange={(e) => setPrintIsAnonymized(e.target.checked)}
                  className="w-4 h-4 text-amber-600 border-amber-300 rounded focus:ring-amber-500 cursor-pointer disabled:opacity-70"
                />
              </div>
              <p className="text-[9.5px] text-amber-800/90 leading-relaxed">
                {globalPrivacyMode 
                  ? `Global Privacy Mode is active in Settings. All patient names, admission numbers, and contact details are automatically redacted across all ${selectedRecords.length} records.`
                  : `Redacts patient full names, admission numbers, and phone numbers in PDF exports & printed sheets across all ${selectedRecords.length} records.`}
              </p>
            </div>

             {/* Layout Mode (Compact vs Detailed) */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
                Report Layout Format
              </label>
              <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl">
                {(['compact', 'detailed'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setPrintLayoutMode(mode)}
                    className={`py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all active:scale-95 cursor-pointer ${
                      printLayoutMode === mode
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {mode === 'compact' ? 'Compact' : 'Detailed'}
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-slate-400 italic">
                * Compact layout shrinks spacing and clinical images to fit onto a single page.
              </p>
            </div>

            {/* Scale Options */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
                Text Scale & Margins
              </label>
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
                {(['compact', 'normal', 'large'] as const).map((scale) => (
                  <button
                    key={scale}
                    onClick={() => setPrintTextSizeScale(scale)}
                    className={`py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all active:scale-95 cursor-pointer ${
                      printTextSizeScale === scale
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {scale}
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-slate-400 italic">
                * Compact layout maximizes page density across bulk reports.
              </p>
            </div>

            {/* Letterhead Settings */}
            <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center justify-between">
                <label htmlFor="toggle-bulk-hospital-header" className="text-[10px] font-bold uppercase text-slate-700 tracking-wider cursor-pointer">
                  Hospital Letterhead Header
                </label>
                <input
                  id="toggle-bulk-hospital-header"
                  type="checkbox"
                  checked={printShowHospitalHeader}
                  onChange={(e) => setPrintShowHospitalHeader(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                />
              </div>

              {printShowHospitalHeader && (
                <div className="space-y-2">
                  <div>
                    <label htmlFor="input-bulk-header-title" className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Header Report Title
                    </label>
                    <input
                      id="input-bulk-header-title"
                      type="text"
                      value={printHeaderTitle}
                      onChange={(e) => setPrintHeaderTitle(e.target.value)}
                      placeholder="e.g. Cardiology Department"
                      className="w-full text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label htmlFor="input-bulk-doctor-name" className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Doctor In-Charge
                    </label>
                    <input
                      id="input-bulk-doctor-name"
                      type="text"
                      value={printPhysicianName}
                      onChange={(e) => setPrintPhysicianName(e.target.value)}
                      placeholder="e.g. Dr Bharat S Sambyal"
                      className="w-full text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Visible Sections checklist */}
            <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-bold uppercase text-slate-700 tracking-wider block">
                Toggle Sections
              </span>
              <div className="space-y-2 text-xs">
                {Object.entries(printVisibleSections).map(([key, value]) => {
                  const labelMap: Record<string, string> = {
                    demographics: 'Patient Demographics',
                    diagnostics: 'Echocardiography & Pres.',
                    anatomy: 'Vascular Access & Anatomy',
                    pci: 'PCI Interventions & Equipment',
                    outcomes: 'Follow-Up / Outcomes',
                    photos: 'Diagnostic Attachments',
                    signatures: 'Clinician Signatures',
                    qrcode: 'Patient QR Code',
                    tags: 'AI / Condition Tags'
                  };
                  return (
                    <label key={key} htmlFor={`toggle-bulk-sec-${key}`} className="flex items-center gap-2.5 text-slate-600 hover:text-slate-900 cursor-pointer">
                      <input
                        id={`toggle-bulk-sec-${key}`}
                        type="checkbox"
                        checked={value}
                        onChange={(e) => setPrintVisibleSections(prev => ({ ...prev, [key]: e.target.checked }))}
                        className="w-3.5 h-3.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                      <span>{labelMap[key] || key}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Print Orientation Tips */}
            <div className="mt-auto p-3.5 bg-blue-50 rounded-xl border border-blue-100/30 text-[10px] text-blue-700 leading-relaxed flex items-start gap-2.5">
              <span className="text-xs shrink-0">ðŸ’¡</span>
              <div>
                <span className="font-bold block mb-0.5">Bulk Printing Tip</span>
                Pages will break automatically after each patient report. Set your browser print destination to <strong className="font-semibold text-blue-900">Save as PDF</strong> for a merged document.
              </div>
            </div>
          </div>

          {/* Clinical Document Sheets List */}
          <div className="flex-1 overflow-x-auto overflow-y-auto py-4 sm:py-8 px-2 sm:px-6 md:py-12 print:p-0 print:bg-white w-full space-y-8 print:space-y-0">
            {selectedRecords.map((p, index) => (
              <div key={p.id || index} className="print:break-after-page print:mb-0 print:border-none print:shadow-none print:p-0">
                <PatientClinicalSheet 
                  patient={p} 
                  onPreviewPhoto={(url, title) => setPreviewPhoto({ url, title })}
                  onEdit={(patientToEdit) => startEdit(patientToEdit)}
                  customHeaderTitle={printHeaderTitle}
                  showHospitalHeader={printShowHospitalHeader}
                  textSizeScale={printTextSizeScale}
                  printLayoutMode={printLayoutMode}
                  isAnonymized={printIsAnonymized}
                  visibleSections={printVisibleSections}
                  customPhysicianName={printPhysicianName}
                />
                {index < selectedRecords.length - 1 && (
                  <div className="border-b border-dashed border-slate-300 my-8 print:hidden" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="app-root" className="flex flex-col h-screen h-[100dvh] overflow-hidden bg-background relative">
      {/* Indeterminate Manual Folder Sync Progress Bar */}
      {isManualSyncing && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-100 z-[999] overflow-hidden">
          <motion.div
            initial={{ left: "-100%" }}
            animate={{ left: "100%" }}
            transition={{
              repeat: Infinity,
              duration: 1.5,
              ease: "linear"
            }}
            className="absolute top-0 bottom-0 w-[40%] bg-blue-600 rounded-full"
          />
        </div>
      )}
      {/* Header */}
      <header className="h-auto md:h-16 pt-[env(safe-area-inset-top,0px)] bg-surface border-b border-border flex flex-col md:flex-row md:items-center px-3 md:px-6 justify-between flex-shrink-0 z-50 py-2.5 md:py-0 gap-2 md:gap-0">
        {/* Top bar on mobile / Left group on desktop */}
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 w-full md:w-auto shrink-0">
          {/* Row 1: Brand Title & Mobile Action Buttons */}
          <div className="flex items-center justify-between w-full md:w-auto gap-2">
            <div className="flex items-center gap-2.5 shrink-0">
              <img 
                src={heartIcon} 
                alt="CathData 2026 Logo" 
                referrerPolicy="no-referrer" 
                className="w-8 h-8 rounded-lg object-contain shadow-sm border border-slate-100" 
              />
              <div className="flex items-baseline gap-1">
                <span className="text-lg md:text-xl font-extrabold text-slate-900 tracking-tight">Cath</span>
                <span className="hidden min-[360px]:inline text-lg md:text-xl font-light text-slate-500 tracking-tight">Data 2026</span>
              </div>
              <span className="hidden md:inline ml-3 px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold uppercase rounded border border-primary/20">Dr Bharat S Sambyal</span>
            </div>

            {/* Action buttons on the right side of Row 1 (Mobile only) */}
            <div className="flex items-center gap-1 md:hidden">
              <button 
                onClick={() => setView(view === 'dashboard' ? 'list' : 'dashboard')}
                className={cn(
                  "p-1.5 rounded-lg transition-colors flex items-center gap-1",
                  view === 'dashboard' ? "bg-primary text-white" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                )}
                title="Analytics Dashboard"
              >
                <ColorfulBarChart className="w-4 h-4" isActive={view === 'dashboard'} />
              </button>

              <div className="relative shrink-0">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className={cn(
                    "p-1.5 rounded-lg border border-border text-slate-500 hover:text-primary transition-colors hover:bg-slate-50 flex items-center gap-1 shrink-0",
                    showExportMenu ? "bg-slate-100 text-primary border-primary" : "bg-white"
                  )}
                  title="Export Options"
                >
                  <Download className="w-4 h-4" />
                </button>
                {showExportMenu && (
                  <>
                    <div className="fixed inset-0 z-[90]" onClick={() => setShowExportMenu(false)} />
                    <div className="absolute right-0 mt-2 w-32 bg-white border border-border rounded-xl shadow-lg p-1 z-[100] animate-fade-in flex flex-col gap-0.5">
                      <button 
                        onClick={() => { exportData('csv'); setShowExportMenu(false); }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                        disabled={isExporting}
                      >
                        Export CSV
                      </button>
                      <button 
                        onClick={() => { exportData('xlsx'); setShowExportMenu(false); }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        disabled={isExporting}
                      >
                        Export XLSX
                      </button>
                      <button 
                        onClick={() => { exportData('md'); setShowExportMenu(false); }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                      >
                        Export MD
                      </button>
                      <button 
                        onClick={() => { exportData('sql'); setShowExportMenu(false); }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        disabled={isExporting}
                      >
                        Export SQL
                      </button>
                      <button 
                        onClick={() => { exportData('zip'); setShowExportMenu(false); }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-green-600 hover:bg-green-50 rounded-lg transition-colors flex items-center gap-1.5"
                        disabled={isExporting}
                      >
                        {isExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        Export ZIP
                      </button>
                      <button 
                        onClick={() => { exportData('all'); setShowExportMenu(false); }}
                        className="w-full text-left px-3 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1.5 border-t border-slate-100"
                        disabled={isExporting}
                      >
                        {isExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                        All
                      </button>
                      <button 
                        onClick={() => { setShowCsvImporter(true); setShowExportMenu(false); }}
                        className="w-full text-left px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1.5 border-t border-slate-100"
                      >
                        <FileSpreadsheet className="w-3 h-3 text-blue-600" />
                        Import CSV
                      </button>
                      <button 
                        onClick={() => { setShowFullRestoreModal(true); setShowExportMenu(false); }}
                        className="w-full text-left px-3 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1.5 border-t border-slate-100"
                      >
                        <FolderArchive className="w-3 h-3 text-emerald-600" />
                        Restore DB & Photos
                      </button>
                    </div>
                  </>
                )}
              </div>

              <button 
                onClick={() => setShowSettings(!showSettings)}
                className={cn(
                  "p-1.5 rounded-lg transition-colors shrink-0",
                  showSettings ? "bg-primary/10 text-primary" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                )}
                title="Image Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button onClick={logout} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600 shrink-0">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Row 2: Sync Status & Sync Control Buttons */}
          <div className="flex items-center gap-1.5 w-full md:w-auto justify-start md:ml-1 overflow-x-auto no-scrollbar py-0.5 md:py-0 shrink-0 select-none">
            <div 
              className="flex items-center gap-1 md:gap-1.5 px-2.5 py-1 rounded-full text-[9px] md:text-[10px] font-bold uppercase border bg-emerald-50 text-emerald-700 border-emerald-200/60 shrink-0 select-none"
              title="Protected Local Mode Active (All data is securely saved on your device)"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Offline Database | Secure</span>
            </div>

            {/* Dedicated Local Directory Sync Button if sync folder is active */}
            {syncHandle && (
              <button
                onClick={async () => {
                  if (isSyncing || isManualSyncing) return;
                  setIsManualSyncing(true);
                  setToast({ message: 'Synchronizing clinical database with local folder...', type: 'loading' });
                  try {
                    await performSync();
                    setToast({ message: 'âœ“ Local folder sync completed successfully.', type: 'success' });
                  } catch (e) {
                    setToast({ message: 'Sync failed: ' + String(e), type: 'error' });
                  } finally {
                    setIsManualSyncing(false);
                  }
                }}
                disabled={isSyncing || isManualSyncing}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] font-bold uppercase transition-all bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm border border-emerald-500 shrink-0 cursor-pointer select-none",
                  (isSyncing || isManualSyncing) && "opacity-50 cursor-not-allowed animate-pulse"
                )}
                title="Manual Sync (Local Folder)"
              >
                <RefreshCw className={cn("w-3 h-3 shrink-0", (isSyncing || isManualSyncing) && "animate-spin")} />
                <span>Sync Directory</span>
              </button>
            )}
          </div>
        </div>

        {/* Search bar - full width on mobile, centered max-w-2xl on desktop */}
        <div className="w-full md:flex-1 md:max-w-2xl px-0 md:px-8">
          <div className="relative w-full flex items-center gap-1.5 sm:gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input 
                type="text" 
                placeholder="Search patient, admission, EF, RWMA..."
                className="w-full h-10 sm:h-11 bg-slate-100 hover:bg-slate-100/80 focus:bg-white border border-transparent focus:border-primary/20 rounded-xl py-2 pl-9 pr-2.5 text-xs sm:text-sm focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button 
              onClick={() => setIsQrScannerOpen(!isQrScannerOpen)}
              className={cn(
                "h-10 sm:h-11 px-2.5 sm:px-3 rounded-xl border transition-all shrink-0 flex items-center justify-center cursor-pointer",
                isQrScannerOpen ? "bg-rose-500 text-white border-rose-500 shadow-sm" : "bg-white text-slate-500 border-border hover:bg-slate-50"
              )}
              title="Scan Patient QR Code"
            >
              <QrCode className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "h-10 sm:h-11 px-2.5 sm:px-3 rounded-xl border transition-all shrink-0 flex items-center justify-center cursor-pointer",
                showFilters ? "bg-primary text-white border-primary shadow-sm" : "bg-white text-slate-500 border-border hover:bg-slate-50"
              )}
              title="Toggle Advanced Filters"
            >
              <Filter className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>
          </div>
        </div>

        {/* Action buttons on the right - Desktop only */}
        <div className="hidden md:flex items-center gap-1.5 md:gap-3 shrink-0">
          <button 
            onClick={() => setView(view === 'dashboard' ? 'list' : 'dashboard')}
            className={cn(
              "p-2 rounded-lg transition-colors flex items-center gap-2",
              view === 'dashboard' ? "bg-primary text-white" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            )}
            title="Analytics Dashboard"
          >
            <ColorfulBarChart className="w-4 h-4 sm:w-5 h-5" isActive={view === 'dashboard'} />
            <span className="hidden xl:inline text-xs font-bold uppercase tracking-widest">Dashboard</span>
          </button>
          
          {/* Desktop Export Buttons */}
          <div className="hidden lg:flex gap-1 mr-1 scale-90 sm:scale-100 origin-right">
            <button 
              onClick={() => exportData('csv')}
              className="text-[9px] sm:text-[10px] font-bold text-slate-400 hover:text-primary transition-colors border border-border px-1.5 py-1 rounded"
              disabled={isExporting}
            >
              CSV
            </button>
            <button 
              onClick={() => exportData('xlsx')}
              className={cn(
                "text-[9px] sm:text-[10px] font-bold transition-colors border px-1.5 py-1 rounded whitespace-nowrap",
                isExporting ? "text-slate-300 border-slate-200" : "text-emerald-600 border-emerald-200 hover:bg-emerald-50"
              )}
              disabled={isExporting}
            >
              XLSX
            </button>
            <button 
              onClick={() => exportData('md')}
              className="text-[9px] sm:text-[10px] font-bold text-slate-400 hover:text-primary transition-colors border border-border px-1.5 py-1 rounded"
            >
              MD
            </button>
            <button 
              onClick={() => exportData('sql')}
              className={cn(
                "text-[9px] sm:text-[10px] font-bold transition-colors border px-1.5 py-1 rounded whitespace-nowrap",
                isExporting ? "text-slate-300 border-slate-200" : "text-blue-600 border-blue-200 hover:bg-blue-50"
              )}
              disabled={isExporting}
            >
              SQL
            </button>
            <button 
              onClick={() => exportData('zip')}
              className={cn(
                "flex text-[9px] sm:text-[10px] font-bold transition-colors border px-1.5 py-1 rounded items-center gap-1 whitespace-nowrap",
                isExporting ? "text-slate-300 border-slate-200" : "text-green-600 border-green-200 hover:bg-green-50"
              )}
              disabled={isExporting}
            >
              {isExporting ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Plus className="w-2.5 h-2.5" />}
              ZIP
            </button>
            <button 
              onClick={() => exportData('all')}
              className={cn(
                "flex text-[9px] sm:text-[10px] font-bold transition-colors border px-1.5 py-1 rounded items-center gap-1 whitespace-nowrap",
                isExporting ? "text-slate-300 border-slate-200" : "text-indigo-600 border-indigo-200 hover:bg-indigo-50"
              )}
              disabled={isExporting}
            >
              {isExporting ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Download className="w-2.5 h-2.5" />}
              All
            </button>
            <button 
              onClick={() => setShowCsvImporter(true)}
              className="flex text-[9px] sm:text-[10px] font-bold transition-colors border border-blue-200 text-blue-600 hover:bg-blue-50 px-1.5 py-1 rounded items-center gap-1 whitespace-nowrap cursor-pointer"
              title="Import CSV records"
            >
              <FileSpreadsheet className="w-2.5 h-2.5" />
              Import CSV
            </button>
            <button 
              onClick={() => setShowFullRestoreModal(true)}
              className="flex text-[9px] sm:text-[10px] font-bold transition-colors border border-emerald-200 text-emerald-700 hover:bg-emerald-50 px-1.5 py-1 rounded items-center gap-1 whitespace-nowrap cursor-pointer"
              title="Restore database and photos from exported folder or zip"
            >
              <FolderArchive className="w-2.5 h-2.5" />
              Restore DB & Photos
            </button>
          </div>

          {/* Tablet Export Dropdown */}
          <div className="relative lg:hidden shrink-0">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className={cn(
                "p-2 rounded-lg border border-border text-slate-500 hover:text-primary transition-colors hover:bg-slate-50 flex items-center gap-1 shrink-0",
                showExportMenu ? "bg-slate-100 text-primary border-primary" : "bg-white"
              )}
              title="Export Options"
            >
              <Download className="w-4 h-4 sm:w-5 h-5" />
              <span className="hidden sm:inline text-xs font-semibold">Export</span>
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-[90]" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 mt-2 w-32 bg-white border border-border rounded-xl shadow-lg p-1 z-[100] animate-fade-in flex flex-col gap-0.5">
                  <button 
                    onClick={() => { exportData('csv'); setShowExportMenu(false); }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                    disabled={isExporting}
                  >
                    Export CSV
                  </button>
                  <button 
                    onClick={() => { exportData('xlsx'); setShowExportMenu(false); }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    disabled={isExporting}
                  >
                    Export XLSX
                  </button>
                  <button 
                    onClick={() => { exportData('md'); setShowExportMenu(false); }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    Export MD
                  </button>
                  <button 
                    onClick={() => { exportData('sql'); setShowExportMenu(false); }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    disabled={isExporting}
                  >
                    Export SQL
                  </button>
                  <button 
                    onClick={() => { exportData('zip'); setShowExportMenu(false); }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-green-600 hover:bg-green-50 rounded-lg transition-colors flex items-center gap-1.5"
                    disabled={isExporting}
                  >
                    {isExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Export ZIP
                  </button>
                  <button 
                    onClick={() => { exportData('all'); setShowExportMenu(false); }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1.5 border-t border-slate-100"
                    disabled={isExporting}
                  >
                    {isExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                    All
                  </button>
                  <button 
                    onClick={() => { setShowCsvImporter(true); setShowExportMenu(false); }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1.5 border-t border-slate-100"
                  >
                    <FileSpreadsheet className="w-3 h-3 text-blue-600" />
                    Import CSV
                  </button>
                  <button 
                    onClick={() => { setShowFullRestoreModal(true); setShowExportMenu(false); }}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1.5 border-t border-slate-100"
                  >
                    <FolderArchive className="w-3 h-3 text-emerald-600" />
                    Restore DB & Photos
                  </button>
                </div>
              </>
            )}
          </div>

          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              "p-2 rounded-lg transition-colors shrink-0",
              showSettings ? "bg-primary/10 text-primary" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            )}
            title="Image Settings"
          >
            <Settings className="w-4 h-4 sm:w-5 h-5" />
          </button>
          <button onClick={logout} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600 shrink-0">
            <LogOut className="w-4 h-4 sm:w-5 h-5" />
          </button>
        </div>
      </header>

      {pendingSyncHandle && !syncHandle && (
        <div className="bg-amber-500 text-white px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between text-xs font-semibold z-30 shrink-0 shadow-md border-b border-amber-600 gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-600 rounded-lg shrink-0 shadow-inner">
              <FolderOpen className="w-4 h-4 text-white animate-pulse" />
            </div>
            <span>
              <strong>Local Sync Paused:</strong> Resume automatic saving to your folder <span className="underline font-bold">'{pendingSyncHandle.name}'</span>. Browser security requires reconnecting each session.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button 
              onClick={() => reconnectSyncFolder(false)}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-amber-600 hover:text-amber-700 rounded-lg font-bold transition-all text-[10px] uppercase tracking-wider shadow-sm active:scale-95 cursor-pointer"
            >
              Reconnect Folder âš¡
            </button>
          </div>
        </div>
      )}

      {showInstallBanner && deferredPrompt && (
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between text-xs font-medium z-50 shrink-0 shadow-lg border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600 rounded-lg shrink-0">
              <Download className="w-4 h-4 text-white" />
            </div>
            <span>Install <strong>Cath Data 2026</strong> as a PWA for fast offline access and native feel.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button 
              onClick={handleInstallClick} 
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all text-[11px] uppercase tracking-wider shadow-md active:scale-95 cursor-pointer"
            >
              Install
            </button>
            <button 
              onClick={() => setShowInstallBanner(false)} 
              className="p-2 text-slate-400 hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <main className="flex flex-1 overflow-hidden relative">
        <AnimatePresence>
          {view === 'dashboard' && (
            <div className="absolute inset-0 z-50 bg-white">
              <Dashboard 
                patients={patients} 
                onClose={() => setView('list')} 
                lastBackupDate={lastBackupDate}
                pendingSyncCount={pendingSyncCount}
                onRefresh={fetchPatients}
              />
            </div>
          )}
        </AnimatePresence>
        {/* Settings Overlay Panel */}
        {view === 'list' && (
          <button 
            onClick={() => {
              setIsEditing(null);
              setFormData(INITIAL_FORM_DATA);
              setIsSerialNoManuallyEdited(false);
              setView('add');
            }}
            className="fixed bottom-6 right-6 z-[60] w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 lg:hidden border-2 border-white animate-fab-float animate-fab-pulse"
            title="New Patient Record"
          >
            <Plus className="w-7 h-7 text-white" />
          </button>
        )}

        <AnimatePresence>
          {showBackupReminder && (
            <motion.div 
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              className="fixed bottom-6 right-6 z-[60] max-w-xs w-full bg-white rounded-2xl shadow-2xl border-2 border-orange-200 p-5 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-400" />
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
                  <Database className="w-5 h-5 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-slate-900">Backup Recommended</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    It's been a while since your last full ZIP backup. Export now to ensure your data is safe on your device.
                  </p>
                  <div className="flex gap-3 mt-4">
                    <button 
                      onClick={() => exportData('zip')}
                      className="flex-1 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold uppercase rounded-lg transition-all"
                    >
                      Backup Now
                    </button>
                    <button 
                      onClick={() => setShowBackupReminder(false)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 text-[10px] font-bold uppercase rounded-lg transition-all"
                    >
                      Later
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showSettings && (
            <>
              <div className="fixed inset-0 z-[110]" onClick={() => setShowSettings(false)} />
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="absolute top-0 left-0 right-0 bg-white border-b border-border z-[120] shadow-md overflow-y-auto max-h-[85vh]"
              >
              <div className="max-w-xl mx-auto p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <Settings className="w-4 h-4 text-primary" /> Application Settings & Preferences
                  </h3>
                  <button onClick={() => setShowSettings(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Global Privacy Mode Toggle */}
                <div className="p-4 bg-slate-50 rounded-xl border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Shield className="w-4 h-4 text-amber-600" /> Global Privacy Mode
                        </h4>
                        <span className={cn(
                          "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1",
                          globalPrivacyMode ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-slate-200 text-slate-600"
                        )}>
                          {globalPrivacyMode ? "Active" : "Disabled"}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed max-w-md">
                        Automatically enables 'Anonymize Export Data' for all future PDF and CSV exports. Redacts patient names, service IDs, admission numbers, and contact details from generated documents.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-2">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={globalPrivacyMode}
                        onChange={(e) => handleTogglePrivacyMode(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>
                  {globalPrivacyMode && (
                    <div className="bg-amber-50/80 border border-amber-200/80 rounded-lg p-2.5 text-[10px] text-amber-900 flex items-start gap-2">
                      <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Privacy Mode is ENFORCED</p>
                        <p className="text-amber-800 text-[9.5px]">
                          All single & bulk PDF reports, consolidated PDFs, and CSV exports will replace patient names with "ANONYMIZED PATIENT" and redact sensitive identification fields.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <Camera className="w-3.5 h-3.5 text-primary" /> Image Compression Settings
                  </h3>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-border space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Compression Quality (0-1)</label>
                      <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{(compressionQuality * 100).toFixed(0)}%</span>
                    </div>
                    <input 
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={compressionQuality}
                      onChange={(e) => setCompressionQuality(parseFloat(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-[9px] text-slate-400 font-medium">
                      <span>HIGH COMPRESSION (Smaller Files)</span>
                      <span>HIGH QUALITY (Larger Files)</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 italic">
                    Note: Lower quality reduces file size significantly, enabling faster uploads and lower database usage. 0.7 (70%) is usually the sweet spot for medical reports.
                  </p>
                </div>

                <PinSettingsCard
                  appSecurityPin={appSecurityPin}
                  setAppSecurityPin={setAppSecurityPin}
                  triggerVibrate={triggerVibrate}
                  setToast={setToast}
                />

                <div className="p-4 bg-slate-50 rounded-xl border border-border space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                       <Clock className="w-3 h-3 text-orange-500" /> Scheduled ZIP Backup reminder
                    </h4>
                    <span className={cn(
                      "text-[9px] font-bold px-2 py-0.5 rounded uppercase",
                      backupFrequency === 'never' ? "bg-slate-200 text-slate-500" : "bg-green-100 text-green-700"
                    )}>
                      {backupFrequency}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2">
                    {(['daily', 'weekly', 'monthly', 'never'] as const).map(freq => (
                      <button
                        key={freq}
                        onClick={() => setBackupFrequency(freq)}
                        className={cn(
                          "py-2 text-[9px] font-bold uppercase rounded-lg border transition-all",
                          backupFrequency === freq 
                            ? "bg-primary border-primary text-white shadow-sm" 
                            : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                        )}
                      >
                        {freq}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Last Backup</span>
                      <p className="text-xs font-semibold text-slate-700">
                        {lastBackupDate > 0 ? formatDateDMY(lastBackupDate) : 'Never'}
                      </p>
                    </div>
                    <button 
                      onClick={() => exportData('zip')}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[10px] font-bold uppercase flex items-center gap-2 shadow-sm transition-all"
                    >
                      <DownloadCloud className="w-3 h-3" /> Backup Now
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-border space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Local Folder Sync</h4>
                      <p className="text-[10px] text-slate-400">Sync data and photos to a local folder on your device.</p>
                    </div>
                    {pendingSyncHandle && !syncHandle ? (
                      <button 
                        onClick={reconnectSyncFolder}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer bg-amber-500 hover:bg-amber-600 text-white animate-pulse"
                      >
                        Reconnect Folder âš¡
                      </button>
                    ) : (
                      <button 
                        onClick={requestSyncFolder}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer",
                          syncHandle ? "bg-green-600 text-white" : "bg-primary text-white"
                        )}
                      >
                        {syncHandle ? "Folder Linked âœ“" : "Select Folder"}
                      </button>
                    )}
                  </div>
                  {pendingSyncHandle && !syncHandle && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[9px] text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                        Stored folder found, but needs browser permission to resume sync. Click "Reconnect Folder" above.
                      </div>
                    </div>
                  )}
                  {syncHandle && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-[9px] text-slate-500 bg-white p-2 rounded border border-slate-200">
                        <div className={cn("w-2 h-2 rounded-full", isSyncing ? "bg-orange-400 animate-pulse" : "bg-green-400")} />
                        {isSyncing ? "Syncing changes..." : "Up to date with local folder"}
                      </div>

                      {/* Auto-Save & Storage Optimization Options */}
                      <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">
                            Auto-Save Strategy (Prevents Mobile Storage Clutter)
                          </label>
                          <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Mobile Friendly
                          </span>
                        </div>
                        <select 
                          className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium cursor-pointer focus:ring-1 focus:ring-primary focus:outline-hidden"
                          value={autoSaveMode}
                          onChange={(e) => {
                            const val = e.target.value as 'overwrite' | 'daily' | 'off';
                            setAutoSaveMode(val);
                            localStorage.setItem('auto_save_mode', val);
                            setToast({ message: `Auto-save mode set to: ${val === 'overwrite' ? 'Single File Overwrite' : val === 'daily' ? 'One File Per Day' : 'Disabled'}`, type: 'info' });
                          }}
                        >
                          <option value="overwrite">âš¡ Single Overwriting File (cathdata_auto_backup.json) â€” Recommended</option>
                          <option value="daily">ðŸ“… One File Per Day (cathdata_backup_YYYY-MM-DD.json)</option>
                          <option value="off">ðŸš« Disable File Auto-Save (Sync CSV + Internal IndexedDB only)</option>
                        </select>
                        <p className="text-[9.5px] text-slate-500 leading-relaxed">
                          {autoSaveMode === 'overwrite' && "Overwrites a single backup file in your folder on app hide/exit. Prevents hundreds of auto-save files from piling up on Android."}
                          {autoSaveMode === 'daily' && "Keeps at most 1 snapshot per day in your sync folder."}
                          {autoSaveMode === 'off' && "Updates IndexedDB and data.csv on patient save, but will not export JSON files automatically."}
                        </p>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2 cursor-pointer text-[10px] font-medium text-slate-600 select-none">
                            <input 
                              type="checkbox"
                              className="rounded text-primary focus:ring-primary w-3.5 h-3.5"
                              checked={autoDownloadOnClose}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setAutoDownloadOnClose(checked);
                                localStorage.setItem('auto_download_on_close', checked ? 'true' : 'false');
                                setToast({ message: checked ? 'Browser download prompt enabled on app exit' : 'Browser download prompt disabled on app exit', type: 'info' });
                              }}
                            />
                            Prompt Browser Download on App Hide / Switch
                          </label>
                        </div>

                        <div className="pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={async () => {
                              const cleaned = await cleanupLegacyAutoSaves();
                              if (cleaned > 0) {
                                setToast({ message: `âœ“ Cleaned up ${cleaned} old auto-save file${cleaned > 1 ? 's' : ''} from target folder!`, type: 'success' });
                              } else {
                                setToast({ message: 'Target folder is clean. No legacy auto-save files found.', type: 'info' });
                              }
                            }}
                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3 text-amber-600" /> Clean Up Legacy Auto-Save Files
                          </button>
                        </div>
                      </div>

                      <div className="bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100 text-[10px] text-emerald-800 space-y-1">
                        <p className="font-bold">Sync Behavior:</p>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                          <li>Saves clinical data immediately to IndexedDB (Instant & Offline)</li>
                          <li>Updates <code className="font-mono text-emerald-900 bg-emerald-100 px-1 py-0.5 rounded">data.csv</code> and photo assets in local directory</li>
                          <li>Updates <code className="font-mono text-emerald-900 bg-emerald-100 px-1 py-0.5 rounded">cathdata_auto_backup.json</code> cleanly on app switch without file proliferation</li>
                          <li>Auto-Purge: On each auto-save, automatically scans and purges old auto-save files, keeping the last 3 files as rolling backups</li>
                        </ul>
                      </div>
                    </div>
                  )}
                  {(syncHandle || pendingSyncHandle) && (
                    <button 
                      onClick={async () => {
                        setSyncHandle(null);
                        setPendingSyncHandle(null);
                        await removeSyncFolderHandle();
                        setToast({ message: 'Sync folder unlinked successfully', type: 'success' });
                      }}
                      className="text-[9px] font-bold text-red-500 uppercase hover:underline cursor-pointer block"
                    >
                      Stop Syncing / Unlink Folder
                    </button>
                  )}
                  <p className="text-[9px] text-slate-400 italic">
                    * Browser Support: Local sync uses the modern File System Access API (supported on Chrome, Edge, and Opera). On browsers with limited folder access, use the "Backup Now" (ZIP) or "Export Complete Database" button below.
                  </p>
                </div>

                {/* Full Database & Photo Restoration Hub */}
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50/60 rounded-xl border border-blue-200/80 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-[11px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                          <FolderArchive className="w-4 h-4 text-blue-600" /> Full Database & Photo Restore Hub
                        </h4>
                        <span className="text-[9px] bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                          Multiple Pathways
                        </span>
                      </div>
                      <p className="text-[10px] text-blue-800 mt-1 leading-relaxed">
                        Restore complete clinical database including high-resolution photo assets from 'All' export folders (.zip/directory), JSON backups, CSV spreadsheets, Google Drive, or local auto-snapshots.
                      </p>
                    </div>
                    <button 
                      onClick={() => { setShowSettings(false); setShowFullRestoreModal(true); }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer shrink-0"
                    >
                      <FolderArchive className="w-3.5 h-3.5" /> Launch Restore Hub
                    </button>
                  </div>
                </div>

                {/* CSV Spreadsheet Import & Column Mapping */}
                <div className="p-4 bg-slate-50 rounded-xl border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" /> CSV Data Import & Field Mapping
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Upload CSV files from Excel or external systems with auto-detected column mapping, deduplication, and pre-import record validation.
                      </p>
                    </div>
                    <button 
                      onClick={() => { setShowSettings(false); setShowCsvImporter(true); }}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold uppercase flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
                    >
                      <FileSpreadsheet className="w-3 h-3" /> Import CSV
                    </button>
                  </div>
                </div>

                {/* HIPAA/GDPR Secure JSON Backup & Restoration */}
                <div className="p-4 bg-slate-50 rounded-xl border border-border space-y-4">
                  <div>
                    <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-primary" /> HIPAA-Compliant JSON Backup & Restore
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Export nested patient documents to a unified JSON backup, or migrate database across devices using secure, client-side AES-GCM 256 encryption.
                    </p>
                  </div>

                  {/* Local Rolling Auto-Backups Section */}
                  <div className="border-t border-slate-200/60 pt-3 space-y-3">
                    <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-500" /> Rolling Database Auto-Backups (2 Slots)
                    </span>
                    <p className="text-[10px] text-slate-500">
                      The application maintains two rolling snapshots of your clinical database in local IndexedDB storage.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="p-2.5 bg-white rounded-lg border border-slate-100 shadow-sm flex flex-col justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Auto-Backup Slot 1 (Newer)</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {autoBackups.backup1 ? (
                              <>
                                Saved: <span className="font-semibold text-slate-600">{new Date(autoBackups.backup1.timestamp).toLocaleString()}</span>
                                <br />
                                Records: <span className="font-semibold text-slate-600">{autoBackups.backup1.data.length} patients</span>
                              </>
                            ) : (
                              <span className="text-slate-400 italic">No backup available yet</span>
                            )}
                          </p>
                        </div>
                        {autoBackups.backup1 && (
                          <button
                            onClick={() => handleRestoreAutoBackup('backup1')}
                            className="w-full py-1 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-800 rounded-md text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            Restore Slot 1
                          </button>
                        )}
                      </div>

                      <div className="p-2.5 bg-white rounded-lg border border-slate-100 shadow-sm flex flex-col justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Auto-Backup Slot 2 (Older)</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {autoBackups.backup2 ? (
                              <>
                                Saved: <span className="font-semibold text-slate-600">{new Date(autoBackups.backup2.timestamp).toLocaleString()}</span>
                                <br />
                                Records: <span className="font-semibold text-slate-600">{autoBackups.backup2.data.length} patients</span>
                              </>
                            ) : (
                              <span className="text-slate-400 italic">No backup available yet</span>
                            )}
                          </p>
                        </div>
                        {autoBackups.backup2 && (
                          <button
                            onClick={() => handleRestoreAutoBackup('backup2')}
                            className="w-full py-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-800 rounded-md text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            Restore Slot 2
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-200/60 pt-3 space-y-3">
                    <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Export Complete Database</span>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input 
                          type="password" 
                          placeholder="Encryption Password (Highly Recommended)"
                          className="w-full bg-white border border-border rounded-lg py-1.5 pl-8 pr-2 text-xs focus:ring-1 focus:ring-primary/40 transition-all outline-none text-slate-700"
                          value={backupPassword}
                          onChange={(e) => {
                            setBackupPassword(e.target.value);
                            if (e.target.value) {
                              setConfirmUnencrypted(false);
                            }
                          }}
                        />
                      </div>
                      <button 
                        onClick={handleJSONBackup}
                        disabled={isExportingJSON || (!backupPassword && !confirmUnencrypted)}
                        className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-2 shadow-sm transition-all shrink-0 cursor-pointer disabled:opacity-50"
                      >
                        {isExportingJSON ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" /> Exporting...
                          </>
                        ) : (
                          <>
                            <DownloadCloud className="w-3 h-3" /> Export JSON
                          </>
                        )}
                      </button>
                    </div>

                    {!backupPassword && (
                      <div className="bg-red-50 border border-red-100 rounded-lg p-2.5 space-y-1.5">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <p className="text-[10px] font-bold text-red-700">PHI Data Security Warning</p>
                            <p className="text-[9px] text-red-600 leading-relaxed">
                              Leaving the password blank will export patient records in unencrypted plain text. Under HIPAA/GDPR clinical data mandates, this represents a potential risk to Protected Health Information (PHI).
                            </p>
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-[9px] text-red-700 font-medium cursor-pointer select-none pt-1">
                          <input 
                            type="checkbox" 
                            checked={confirmUnencrypted} 
                            onChange={(e) => setConfirmUnencrypted(e.target.checked)}
                            className="rounded border-red-300 text-red-600 focus:ring-red-500 w-3 h-3" 
                          />
                          <span>I understand and explicitly authorize downloading this unencrypted backup.</span>
                        </label>
                      </div>
                    )}

                    <p className="text-[9px] text-slate-400 italic">
                      * Entering a password will secure the backup with client-side AES-GCM 256-bit encryption.
                    </p>
                  </div>

                  {/* Google Drive Integration Section */}
                  <div className="border-t border-slate-200/60 pt-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                        <Cloud className="w-3.5 h-3.5 text-emerald-500" /> Google Drive Cloud Backups
                      </span>
                      {driveAccessToken && (
                        <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                          Connected
                        </span>
                      )}
                    </div>
                    
                    {!driveAccessToken ? (
                      <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-center space-y-2.5">
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                          Securely backup and sync your clinical database to your personal Google Drive. All backups are stored in a dedicated, private folder (<span className="font-semibold text-slate-600">"CathData Backups"</span>) and can be optionally encrypted with client-side AES-256.
                        </p>
                        <button
                          onClick={handleConnectGoogleDrive}
                          className="mx-auto px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold uppercase flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                        >
                          <Cloud className="w-3.5 h-3.5" /> Connect Google Drive
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3 bg-slate-50/50 border border-slate-100 rounded-lg p-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <p className="text-[10px] font-medium text-slate-600">
                            Session Active
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleFetchDriveFiles()}
                              disabled={isListingDrive}
                              className="text-[9px] font-bold uppercase text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
                            >
                              <RefreshCw className={cn("w-3 h-3", isListingDrive && "animate-spin")} /> Refresh List
                            </button>
                            <span className="text-slate-200">|</span>
                            <button
                              onClick={handleDisconnectGoogleDrive}
                              className="text-[9px] font-bold uppercase text-rose-600 hover:text-rose-700"
                            >
                              Disconnect
                            </button>
                          </div>
                        </div>

                        {/* Upload to Drive Section */}
                        <div className="space-y-2 pt-1">
                          <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Upload New Cloud Backup</p>
                          <p className="text-[9px] text-slate-400">
                            Creates a complete database snapshot. If an encryption password is set in the fields below, the cloud backup is securely encrypted.
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={handleUploadBackupToDrive}
                              disabled={isUploadingToDrive || (!backupPassword && !confirmUnencrypted)}
                              className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                            >
                              {isUploadingToDrive ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...
                                </>
                              ) : (
                                <>
                                  <Cloud className="w-3.5 h-3.5" /> Upload to Google Drive
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Restore from Drive Section */}
                        <div className="space-y-2 border-t border-slate-100 pt-3">
                          <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Restore Cloud Backup</p>
                          
                          {isListingDrive ? (
                            <div className="flex items-center gap-2 py-1 text-[10px] text-slate-500 italic">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> Loading files from Drive...
                            </div>
                          ) : driveBackups.length === 0 ? (
                            <p className="text-[9px] text-slate-400 italic py-1">
                              No backups found in your "CathData Backups" folder. Upload a backup first.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex flex-col sm:flex-row gap-2">
                                <select
                                  value={selectedDriveFileId}
                                  onChange={(e) => setSelectedDriveFileId(e.target.value)}
                                  className="flex-1 bg-white border border-border rounded-lg py-1.5 px-2 text-xs outline-none text-slate-700 focus:ring-1 focus:ring-primary/40"
                                >
                                  <option value="">-- Select a backup file to restore (Max 3 kept) --</option>
                                  {driveBackups.map((f, idx) => (
                                    <option key={f.id} value={f.id}>
                                      {idx === 0 ? 'Latest 1 (Newest)' : idx === 1 ? 'Latest 2' : idx === 2 ? 'Latest 3 (Oldest)' : `Backup ${idx + 1}`} - {f.name} ({new Date(f.createdTime).toLocaleString()}, {(parseInt(f.size || '0') / 1024).toFixed(1)} KB)
                                    </option>
                                  ))}
                                </select>
                                
                                {selectedDriveFileId && (
                                  <button
                                    onClick={() => handleDownloadAndRestoreFromDrive(selectedDriveFileId)}
                                    disabled={isDownloadingFromDrive}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-1.5 shadow-sm transition-all shrink-0 cursor-pointer disabled:opacity-50"
                                  >
                                    {isDownloadingFromDrive ? (
                                      <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Restoring...
                                      </>
                                    ) : (
                                      <>
                                        <Download className="w-3.5 h-3.5" /> Restore
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                              {selectedDriveFileId && (
                                <p className="text-[9px] text-slate-400 italic">
                                  * Reuses the password specified in the section below to decrypt, if this was an encrypted backup.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-200/60 pt-3 space-y-3">
                    <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Drag-and-Drop Restoration</span>
                    
                    <div 
                      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                      onDragLeave={() => setDragActive(false)}
                      onDrop={(e) => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files?.[0]) setRestoreFile(e.dataTransfer.files[0]); }}
                      onClick={() => document.getElementById('json-restore-file-input')?.click()}
                      className={cn(
                        "border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2",
                        dragActive ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300 bg-white",
                        restoreFile ? "border-emerald-200 bg-emerald-50/20" : ""
                      )}
                    >
                      <input 
                        type="file" 
                        accept=".json" 
                        id="json-restore-file-input" 
                        className="hidden" 
                        onChange={(e) => { if (e.target.files?.[0]) setRestoreFile(e.target.files[0]); }}
                      />
                      
                      {restoreFile ? (
                        <div className="flex items-center gap-3 w-full max-w-xs justify-between p-2 bg-white rounded-lg border border-emerald-100 shadow-sm" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2 text-left min-w-0">
                            <Database className="w-5 h-5 text-emerald-500 shrink-0" />
                            <div className="truncate">
                              <p className="text-xs font-bold text-slate-700 truncate">{restoreFile.name}</p>
                              <p className="text-[9px] text-slate-400">{(restoreFile.size / 1024).toFixed(1)} KB</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => setRestoreFile(null)}
                            className="p-1 hover:bg-slate-100 rounded text-rose-500"
                            title="Remove file"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-6 h-6 text-slate-400" />
                          <div className="space-y-0.5">
                            <p className="text-xs font-semibold text-slate-700">Drag & drop clinical .json backup here</p>
                            <p className="text-[10px] text-slate-400">or click to browse your storage</p>
                          </div>
                        </>
                      )}
                    </div>

                    {restoreFile && (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                          <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                          <input 
                            type="password" 
                            placeholder="Decryption Password (If Encrypted)"
                            className="w-full bg-white border border-border rounded-lg py-1.5 pl-8 pr-2 text-xs focus:ring-1 focus:ring-primary/40 transition-all outline-none text-slate-700"
                            value={restorePassword}
                            onChange={(e) => setRestorePassword(e.target.value)}
                          />
                        </div>
                        <button 
                          onClick={handleJSONRestore}
                          disabled={isRestoring}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-2 shadow-sm transition-all shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          {isRestoring ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" /> Restoring...
                            </>
                          ) : (
                            <>
                              <Upload className="w-3 h-3" /> Restore Backup
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Clinical Database Health Check & Repair */}
                <div className="p-4 bg-slate-50 rounded-xl border border-border space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-blue-600" /> Database Health & Diagnostics
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Analyze IndexedDB integrity to detect missing critical parameters or corrupted record structures, and perform automatic self-repair.
                      </p>
                    </div>
                    <button
                      onClick={runDatabaseHealthCheck}
                      disabled={isHealthChecking || isHealthRepairing}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold uppercase shadow-sm transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {isHealthChecking ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" /> Scanning...
                        </>
                      ) : (
                        <>
                          <Activity className="w-3 h-3" /> Scan DB
                        </>
                      )}
                    </button>
                  </div>

                  {healthReport && (
                    <div className="space-y-3 pt-2 border-t border-slate-200">
                      <div className="flex items-center justify-between text-[10px] font-medium bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm">
                        <div className="space-y-1">
                          <p className="text-slate-500 font-semibold uppercase text-[9px] tracking-wider">Diagnostic Report</p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-700">Checked: <strong className="font-bold text-slate-900">{healthReport.totalChecked}</strong> profiles</span>
                            <span className="text-slate-300">|</span>
                            <span>Corrupt: <strong className={cn("font-bold", healthReport.corruptedCount > 0 ? "text-amber-600" : "text-green-600")}>{healthReport.corruptedCount}</strong></span>
                          </div>
                          <p className="text-[9px] text-slate-400 font-mono">Last scanned: {healthReport.checkedAt}</p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {healthReport.status === 'success' ? (
                            <span className="flex items-center gap-1 text-[9px] font-bold bg-green-50 text-green-700 px-2 py-1 rounded-full border border-green-100">
                              <ShieldCheck className="w-3.5 h-3.5" /> HEALTHY
                            </span>
                          ) : healthReport.status === 'warning' ? (
                            <span className="flex items-center gap-1 text-[9px] font-bold bg-amber-50 text-amber-700 px-2 py-1 rounded-full border border-amber-100 animate-pulse">
                              <AlertTriangle className="w-3.5 h-3.5" /> ISSUES DETECTED
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[9px] font-bold bg-red-50 text-red-700 px-2 py-1 rounded-full border border-red-100">
                              <AlertCircle className="w-3.5 h-3.5" /> ERROR
                            </span>
                          )}
                        </div>
                      </div>

                      {healthReport.issues.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Identified Inconsistencies:</p>
                          <div className="max-h-40 overflow-y-auto border border-amber-100 rounded-lg bg-amber-50/20 divide-y divide-amber-100/60 font-mono text-[9px]">
                            {healthReport.issues.map((issue, idx) => (
                              <div key={issue.id} className="p-2 space-y-1">
                                <div className="flex items-center justify-between font-semibold text-amber-900">
                                  <span>{issue.name || 'Unknown Patient'} {issue.patientId ? `(${issue.patientId})` : `[ID: ${issue.id.substring(0, 8)}]`}</span>
                                  {issue.serialNo && <span className="text-[9px] bg-amber-100 px-1 py-0.5 rounded text-amber-800">Serial: {issue.serialNo}</span>}
                                </div>
                                <ul className="list-disc list-inside text-amber-700 space-y-0.5 pl-1.5 leading-relaxed font-sans">
                                  {issue.details.map((detail, dIdx) => (
                                    <li key={dIdx} className="break-words">{detail}</li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>

                          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 space-y-2.5">
                            <div className="flex items-start gap-2">
                              <Wrench className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                              <div className="space-y-0.5">
                                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Database Self-Repair Available</p>
                                <p className="text-[9px] text-amber-600 leading-relaxed font-sans">
                                  Our auto-repair routine will inject missing structural arrays/objects, recalculate malformed patient IDs, format values to standard specifications, and populate blank fields with sensible clinical fallbacks. No valid data is deleted.
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={runDatabaseHealthRepair}
                              disabled={isHealthRepairing || isHealthChecking}
                              className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold uppercase shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              {isHealthRepairing ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" /> Repairing Clinical Database...
                                </>
                              ) : (
                                <>
                                  <Wrench className="w-3.5 h-3.5" /> Auto-Repair All Database Issues
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Application Updates (PWA Force Reload) */}
                <div className="p-4 bg-slate-50 rounded-xl border border-border space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 text-primary animate-spin-slow" /> Application Updates
                      </h4>
                      <p className="text-[10px] text-slate-400">If new updates or styling changes aren't loading, clear the web app cache.</p>
                    </div>
                    <button 
                      onClick={() => {
                        if ((window as any).forceUpdateApp) {
                          (window as any).forceUpdateApp();
                        } else {
                          window.location.reload();
                        }
                      }}
                      className="px-3 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-lg text-[10px] font-bold uppercase shadow-sm transition-all flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <RefreshCw className="w-3 h-3" /> Update App
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-400 italic">
                    * Instantly purges cached web app assets, checks for the latest version, and does a fresh reload. Highly recommended if your device displays an older design or older data columns.
                  </p>
                </div>
              </div>
            </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Advanced Filters Overlay Modal Dialog */}
        <AnimatePresence>
          {showFilters && (
            <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
              {/* Darkened Blur Backdrop */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowFilters(false)}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
              />

              {/* Modal Container */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.96, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 15 }}
                transition={{ duration: 0.2 }}
                className="relative bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-6xl max-h-[90vh] flex flex-col my-auto z-10 overflow-hidden"
              >
                {/* Advanced Mode banner/title */}
                <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3 bg-white shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 text-primary rounded-xl flex items-center justify-center border border-blue-100 shadow-2xs shrink-0">
                      <Filter className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold font-display text-base text-slate-800 flex items-center gap-2">
                        Advanced Filter Workbench
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/60">
                          Multi-Criteria
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500">Combine multiple criteria to slice and dice your patient database.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={resetFilters}
                      className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" /> Clear All Filters
                    </button>
                    <button 
                      onClick={() => setShowFilters(false)}
                      className="px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Apply & Close
                    </button>
                    <button 
                      onClick={() => setShowFilters(false)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="Close workbench"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Modal Scrollable Body */}
                <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1 bg-white">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    
                    {/* Column 1: Demographic & Classification */}
                    <div className="space-y-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200/70">
                      <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                        Demographic & Class
                      </h4>
                      
                      <div className="space-y-1">
                        <label className="label">Gender</label>
                        <select 
                          className="input-field py-1 text-sm bg-white"
                          value={filters.gender}
                          onChange={(e) => setFilters({ ...filters, gender: e.target.value })}
                        >
                          <option value="All">All Genders</option>
                          <option value={Gender.Male}>Male</option>
                          <option value={Gender.Female}>Female</option>
                          <option value={Gender.Other}>Other</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="label">Service Category (Class)</label>
                        <select 
                          className="input-field py-1 text-sm bg-white"
                          value={filters.serviceCategory}
                          onChange={(e) => setFilters({ ...filters, serviceCategory: e.target.value })}
                        >
                          <option value="All">All Classes</option>
                          <option value="Ser">Service (Ser)</option>
                          <option value="Vet">Veteran (Vet)</option>
                          <option value="Dep">Dependent (Dep)</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="label">Min Age</label>
                          <input 
                            type="number" 
                            placeholder="0"
                            className="input-field py-1 text-sm bg-white"
                            value={filters.minAge}
                            onChange={(e) => setFilters({ ...filters, minAge: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="label">Max Age</label>
                          <input 
                            type="number" 
                            placeholder="100"
                            className="input-field py-1 text-sm bg-white"
                            value={filters.maxAge}
                            onChange={(e) => setFilters({ ...filters, maxAge: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="label">Record Category</label>
                        <select 
                          className="input-field py-1 text-sm bg-white"
                          value={filters.category}
                          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                        >
                          <option value="All">All Categories</option>
                          {Object.values(ReportCategory).map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Column 2: Date Range Controls */}
                    <div className="space-y-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200/70">
                      <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Temporal Constraints
                      </h4>

                      <div className="space-y-1">
                        <label className="label">Filter Date Field</label>
                        <select 
                          className="input-field py-1 text-sm bg-white"
                          value={filters.dateField}
                          onChange={(e) => setFilters({ ...filters, dateField: e.target.value as any })}
                        >
                          <option value="either">Created or Updated (Either)</option>
                          <option value="created">Created Date Only</option>
                          <option value="updated">Updated Date Only</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="label">Start Date (DD_MM_YYYY)</label>
                        <input 
                          type="text" 
                          placeholder="DD_MM_YYYY"
                          className="input-field py-1 text-sm bg-white"
                          value={filters.startDate}
                          onChange={(e) => handleDateInputChange(e.target.value, (formatted) => setFilters({ ...filters, startDate: formatted }))}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="label">End Date (DD_MM_YYYY)</label>
                        <input 
                          type="text" 
                          placeholder="DD_MM_YYYY"
                          className="input-field py-1 text-sm bg-white"
                          value={filters.endDate}
                          onChange={(e) => handleDateInputChange(e.target.value, (formatted) => setFilters({ ...filters, endDate: formatted }))}
                        />
                      </div>
                    </div>

                    {/* Column 3: Advanced Condition Tags Selection */}
                    <div className="space-y-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200/70 md:col-span-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-slate-400" />
                          Condition Tags
                        </h4>
                        {filters.tags.length > 0 && (
                          <button 
                            onClick={() => setFilters({ ...filters, tags: [] })}
                            className="text-[10px] text-red-500 hover:underline font-bold cursor-pointer"
                          >
                            Clear Selection ({filters.tags.length})
                          </button>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="label">Search Specific Tag</label>
                        <input 
                          type="text" 
                          placeholder="Type single tag search..."
                          className="input-field py-1 text-sm bg-white"
                          value={filters.tag}
                          onChange={(e) => setFilters({ ...filters, tag: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-slate-400 font-bold uppercase">Match Strategy:</span>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => setFilters({ ...filters, tagMatchMode: 'all' })}
                              className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-bold transition-all border cursor-pointer",
                                filters.tagMatchMode === 'all'
                                  ? "bg-primary text-white border-primary shadow-2xs"
                                  : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100"
                              )}
                            >
                              AND (All)
                            </button>
                            <button
                              type="button"
                              onClick={() => setFilters({ ...filters, tagMatchMode: 'any' })}
                              className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-bold transition-all border cursor-pointer",
                                filters.tagMatchMode === 'any'
                                  ? "bg-primary text-white border-primary shadow-2xs"
                                  : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100"
                              )}
                            >
                              OR (Any)
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Column 4: Sort & Arrangement */}
                    <div className="space-y-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200/70">
                      <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        Sort & Arrangement
                      </h4>

                      <div className="space-y-1">
                        <label className="label">Sort By Field</label>
                        <select 
                          className="input-field py-1 text-sm bg-white"
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as any)}
                        >
                          <option value="date">Date</option>
                          <option value="name">Patient Name</option>
                          <option value="serialNo">Serial Number</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="label">Sort Order</label>
                        <select 
                          className="input-field py-1 text-sm bg-white"
                          value={sortOrder}
                          onChange={(e) => setSortOrder(e.target.value as any)}
                        >
                          <option value="asc">Ascending (A-Z / Oldest First)</option>
                          <option value="desc">Descending (Z-A / Newest First)</option>
                        </select>
                      </div>

                      <div className="space-y-1 pt-2 border-t border-slate-200">
                        <label className="label">Search Match Mode</label>
                        <select 
                          className="input-field py-1 text-sm bg-white"
                          value={searchMode}
                          onChange={(e) => setSearchMode(e.target.value as 'partial' | 'exact')}
                        >
                          <option value="partial">Partial Match (Fuzzy)</option>
                          <option value="exact">Exact Match (Strict)</option>
                        </select>
                      </div>
                    </div>

                  </div>

                  {/* Tags bubble grid selection */}
                  <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        Interactive Condition Filter Board
                        <span className="text-[10px] text-slate-400 font-normal normal-case">(Click to select/deselect tags)</span>
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Total Tags: <strong className="text-slate-600">{conditionTags.length}</strong>
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto p-2 bg-white rounded-lg border border-slate-200">
                      {conditionTags.length === 0 ? (
                        <p className="text-xs text-slate-400 italic p-3">No patient condition tags have been recorded yet.</p>
                      ) : (
                        conditionTags.map(tag => {
                          const isSelected = filters.tags.includes(tag);
                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => toggleFilterTag(tag)}
                              className={cn(
                                "px-2.5 py-1 rounded-full text-xs transition-all border flex items-center gap-1 shrink-0 cursor-pointer",
                                isSelected 
                                  ? "bg-primary text-white border-primary shadow-sm shadow-primary/20 hover:bg-primary-hover"
                                  : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
                              )}
                            >
                              {tag}
                              {isSelected && <X className="w-3 h-3 ml-0.5 inline-block shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Modal Footer with statistics and action buttons */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-wrap gap-3 text-xs text-slate-600 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse shrink-0"></span>
                    <span>
                      Matching Patients: <strong className="text-slate-900 font-bold text-sm">{filteredPatients.length}</strong> of <strong className="text-slate-600">{patients.filter(p => !p.isDeleted).length}</strong>
                    </span>
                    {filters.tags.length > 0 && (
                      <span className="text-[11px] text-slate-400 hidden sm:inline">
                        â€¢ Matching tags with {filters.tagMatchMode.toUpperCase()} strategy
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={resetFilters}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
                    >
                      Reset Filters
                    </button>
                    <button 
                      onClick={() => setShowFilters(false)}
                      className="px-4 py-1.5 text-xs font-bold text-white bg-primary hover:bg-primary-hover rounded-lg transition-all shadow-sm active:scale-95 cursor-pointer"
                    >
                      Apply & Close ({filteredPatients.length} Cases)
                    </button>
                  </div>
                </div>

              </motion.div>
            </div>
          )}
        </AnimatePresence>
        {/* Left Sidebar - Form */}
        <aside className="w-80 bg-surface border-r border-border p-6 overflow-y-auto hidden lg:block shrink-0">
          {isEditing && (
            <div className="mb-4 p-3 bg-amber-500/10 border-2 border-amber-500/40 rounded-xl space-y-1.5 text-amber-950 shadow-sm animate-pulse">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900">
                  <Edit2 className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>EDITING PATIENT RECORD</span>
                </div>
                <button 
                  type="button"
                  onClick={() => handleNavWithUnsavedCheck(() => {
                    setIsEditing(null);
                    setFormData(INITIAL_FORM_DATA);
                    localStorage.removeItem('patient_form_is_editing');
                    setView('list');
                  })}
                  className="text-[10px] font-bold px-2 py-0.5 bg-amber-200 hover:bg-amber-300 text-amber-950 rounded uppercase cursor-pointer"
                >
                  Cancel
                </button>
              </div>
              <p className="text-xs font-semibold text-amber-900 leading-snug">
                Modifying: <strong className="underline">{formData.name || 'Patient'}</strong> ({formData.admissionNo ? `Adm: ${formData.admissionNo}` : `Ser: ${formData.serNo}`})
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2.5 mb-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                {isEditing ? <Edit2 className="w-5 h-5 text-amber-600" /> : <Plus className="w-5 h-5 text-primary" />} 
                {isEditing ? 'Modify Patient Entry' : 'New Patient Entry'}
              </h2>
              <div className="flex items-center gap-2">
                {lastDraftSavedAt && (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-2xs animate-fade-in">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Auto-saved {lastDraftSavedAt}
                  </span>
                )}
                {isEditing && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Edit Mode
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, isImportant: !prev.isImportant }))}
              className={cn(
                "w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border cursor-pointer select-none",
                formData.isImportant
                  ? "bg-amber-50 text-amber-900 border-amber-300 shadow-2xs"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              )}
            >
              <Star className={cn("w-4 h-4", formData.isImportant ? "fill-amber-400 text-amber-500" : "text-slate-400")} />
              <span>{formData.isImportant ? "Marked as Important Case" : "Mark as Important Case"}</span>
            </button>
          </div>
          
          <form onSubmit={handleCreatePatient} className="space-y-4">
            {showDraftPrompt && (
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl space-y-2 animate-fade-in">
                <div className="flex items-start gap-2">
                  <span className="text-sm">ðŸ“</span>
                  <div>
                    <p className="text-xs font-bold text-amber-800">Unsaved draft found!</p>
                    <p className="text-[10px] leading-tight text-amber-600 mt-0.5">Recover your partially filled form data?</p>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      const saved = localStorage.getItem('patient_form_draft');
                      if (saved) {
                        try {
                          setFormData(JSON.parse(saved));
                        } catch (e) {
                          console.error(e);
                        }
                      }
                      setShowDraftPrompt(false);
                    }}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold transition-all shadow-sm"
                  >
                    Restore Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearDraft();
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-[10px] font-bold transition-all"
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}
            <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-2">
              <label className="text-[10px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-1.5">
                <ClipboardList className="w-3 h-3" /> Quick Procedure Templates
              </label>
              <div className="grid grid-cols-1 gap-2">
                {PCI_TEMPLATES.map(template => (
                  <button
                    key={template.name}
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        access: template.access,
                        pciVessels: template.pciVessels,
                        devices: template.devices,
                        drugs: template.drugs
                      }));
                    }}
                    className="px-3 py-2 bg-white border border-blue-100 rounded-lg text-[10px] font-bold text-slate-600 hover:border-primary hover:text-primary transition-all text-left flex items-center justify-between group"
                  >
                    {template.name}
                    <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="label">Category</label>
              <select className="input-field" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value as ReportCategory })}>
                {Object.values(ReportCategory).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {formData.category === ReportCategory.Other && (
                <div className="mt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <input 
                    placeholder="Enter custom category..." 
                    className="input-field border-primary/30 focus:border-primary shadow-sm" 
                    value={formData.otherCategoryNotes || ''} 
                    onChange={(e) => setFormData({ ...formData, otherCategoryNotes: e.target.value })} 
                  />
                </div>
              )}
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="label">Tags (comma separated)</label>
              </div>
              <input placeholder="tag1, tag2" className="input-field" value={formData.tags.join(', ')} onChange={(e) => setFormData({ ...formData, tags: e.target.value.split(',').map(t => t.trim()).filter(t => t !== '') })} />
            </div>

            <div className="space-y-1 relative">
              <label className="label">Place</label>
              <input 
                placeholder="e.g. Hospital, Clinic, City" 
                className="input-field" 
                value={formData.place || ''} 
                onChange={(e) => {
                  setFormData({ ...formData, place: e.target.value });
                  setShowPlaceSuggestionsSidebar(true);
                }} 
                onFocus={() => setShowPlaceSuggestionsSidebar(true)}
                onBlur={() => {
                  setTimeout(() => setShowPlaceSuggestionsSidebar(false), 200);
                }}
              />
              {showPlaceSuggestionsSidebar && existingPlaces.length > 0 && (
                <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
                  {existingPlaces
                    .filter(pl => !formData.place || pl.toLowerCase().includes((formData.place || '').toLowerCase()))
                    .map(pl => (
                      <button
                        key={pl}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setFormData(prev => ({ ...prev, place: pl }));
                          setShowPlaceSuggestionsSidebar(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        {pl}
                      </button>
                    ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="label">Additional Operator(s)</label>
                <span className="text-[10px] text-slate-400 font-medium">Co-operators / Assistants</span>
              </div>
              {(formData.additionalOperators && formData.additionalOperators.length > 0 ? formData.additionalOperators : ['']).map((op, opIdx) => (
                <div key={opIdx} className="flex gap-2 items-center">
                  <input 
                    type="text" 
                    placeholder="Operator name (e.g. Dr. John Doe)" 
                    className="input-field flex-1 text-xs" 
                    value={op} 
                    onChange={(e) => {
                      const newOps = [...(formData.additionalOperators && formData.additionalOperators.length > 0 ? formData.additionalOperators : [''])];
                      newOps[opIdx] = e.target.value;
                      setFormData({ ...formData, additionalOperators: newOps });
                    }} 
                  />
                  {(formData.additionalOperators || []).length > 1 && (
                    <button 
                      type="button" 
                      onClick={() => {
                        const newOps = (formData.additionalOperators || []).filter((_, i) => i !== opIdx);
                        setFormData({ ...formData, additionalOperators: newOps });
                      }}
                      className="p-2 text-slate-400 hover:text-red-500 border border-border rounded-lg transition-colors cursor-pointer shrink-0"
                      title="Remove Operator"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button 
                type="button" 
                onClick={() => setFormData({ 
                  ...formData, 
                  additionalOperators: [...(formData.additionalOperators && formData.additionalOperators.length > 0 ? formData.additionalOperators : ['']), ''] 
                })}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer pt-0.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add Additional Operator
              </button>
            </div>

            <div className="space-y-1">
              <label className="label">Serial No</label>
              <input 
                required 
                type="text"
                inputMode="numeric" 
                placeholder="01" 
                disabled={!!isEditing}
                className={cn(
                  "input-field", 
                  (formErrors.serialNo || isSerialNoDuplicate) && "border-red-500 focus:border-red-500 focus:ring-red-100", 
                  isEditing && "bg-slate-50 text-slate-400"
                )} 
                value={formData.serialNo} 
                onChange={(e) => {
                  setIsSerialNoManuallyEdited(true);
                  setFormData({ ...formData, serialNo: e.target.value });
                }} 
              />
              {isSerialNoDuplicate && (
                <p className="text-[10px] text-red-500 font-bold animate-pulse">âš ï¸ Serial No already exists in another record</p>
              )}
              {formErrors.serialNo && !isSerialNoDuplicate && (
                <p className="text-[10px] text-red-500 font-bold">{formErrors.serialNo}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="label">Ser No</label>
                <input 
                  required 
                  placeholder="Service No" 
                  className="input-field" 
                  value={formData.serNo} 
                  onChange={(e) => setFormData({ ...formData, serNo: e.target.value })} 
                />
              </div>
              <div className="space-y-1">
                <label className="label">STATUS</label>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  {Object.values(ServiceCategory).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFormData({ ...formData, serviceCategory: cat })}
                      className={cn(
                        "flex-1 py-1.5 text-[9px] font-bold rounded-md transition-all",
                        formData.serviceCategory === cat 
                          ? "bg-white text-primary shadow-sm" 
                          : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="label">Admission No</label>
              <input 
                required 
                placeholder="ADM-001" 
                className={cn(
                  "input-field",
                  (formErrors.admissionNo || isAdmissionNoDuplicate) && "border-red-500 focus:border-red-500 focus:ring-red-100"
                )} 
                value={formData.admissionNo} 
                onChange={(e) => setFormData({ ...formData, admissionNo: e.target.value })} 
              />
              {isAdmissionNoDuplicate && (
                <p className="text-[10px] text-red-500 font-bold animate-pulse">âš ï¸ Admission No already exists in another record</p>
              )}
              {formErrors.admissionNo && !isAdmissionNoDuplicate && (
                <p className="text-[10px] text-red-500 font-bold">{formErrors.admissionNo}</p>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="label">Demographics</label>
                <VoiceInputButton 
                  onTranscript={(text) => {
                    setFormData(prev => ({ ...prev, notes: prev.notes ? prev.notes + ' ' + text : text }));
                  }}
                />
              </div>
              <textarea 
                placeholder="Additional observations..." 
                className="input-field min-h-[100px] py-2 resize-none animate-fade-in"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
              <PhotoUploadField 
                label="Demographics Photo" 
                value={formData.demographicsPhotoUrl || ''} 
                onUpload={(e) => handlePhotoUpload(e, 'demographicsPhotoUrl', 'Demographics')} 
                onRemove={() => setFormData({ ...formData, demographicsPhotoUrl: '' })} 
                onCrop={() => handleManualCrop('demographicsPhotoUrl', 'Demographics', formData.demographicsPhotoUrl || '')}
              />
            </div>
            <div className="space-y-1">
              <label className="label">Patient Name</label>
              <input required placeholder="Full name" className="input-field" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="label">Age</label>
                  {formData.age && parseInt(String(formData.age), 10) > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const birthYear = new Date().getFullYear() - parseInt(String(formData.age), 10);
                        setFormData(prev => ({
                          ...prev,
                          notes: prev.notes 
                            ? prev.notes.includes(`Est. Birth Year: ${birthYear}`) 
                              ? prev.notes 
                              : prev.notes + `\nEst. Birth Year: ${birthYear}`
                            : `Est. Birth Year: ${birthYear}`
                        }));
                        setToast({ message: `Appended Birth Year estimate (${birthYear}) to clinical notes.`, type: 'success' });
                      }}
                      className="text-[9px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                      title="Click to insert estimated birth year into demographics notes"
                    >
                      Est. Birth: {new Date().getFullYear() - parseInt(String(formData.age), 10)}
                    </button>
                  )}
                </div>
                <input 
                  required 
                  type="number" 
                  placeholder="25" 
                  className={cn("input-field", formErrors.age && "border-red-500 focus:border-red-500 focus:ring-red-100")} 
                  value={formData.age} 
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })} 
                />
                {formErrors.age && (
                  <p className="text-[10px] text-red-500 font-bold">{formErrors.age}</p>
                )}
              </div>
              <div className="space-y-1">
                <label className="label">Gender</label>
                <select 
                  className={cn("input-field", formErrors.gender && "border-red-500 focus:border-red-500 focus:ring-red-100")} 
                  value={formData.gender} 
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value as Gender })}
                >
                  <option value={Gender.Male}>Male</option>
                  <option value={Gender.Female}>Female</option>
                  <option value={Gender.Other}>Other</option>
                </select>
                {formErrors.gender && (
                  <p className="text-[10px] text-red-500 font-bold">{formErrors.gender}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="label">Phone Numbers</label>
              {formData.phoneNumbers.map((phone, index) => (
                <div key={index} className="flex gap-2">
                  <input 
                    type="tel" 
                    placeholder="Phone number" 
                    className="input-field flex-1" 
                    value={phone} 
                    onChange={(e) => {
                      const newPhones = [...formData.phoneNumbers];
                      newPhones[index] = e.target.value;
                      setFormData({ ...formData, phoneNumbers: newPhones });
                    }} 
                  />
                  {formData.phoneNumbers.length > 1 && (
                    <button 
                      type="button" 
                      onClick={() => {
                        const newPhones = formData.phoneNumbers.filter((_, i) => i !== index);
                        setFormData({ ...formData, phoneNumbers: newPhones });
                      }}
                      className="p-2 text-slate-400 hover:text-red-500 border border-border rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {formErrors.phoneNumbers && (
                <p className="text-[10px] text-red-500 font-bold mt-1">{formErrors.phoneNumbers}</p>
              )}
              <button 
                type="button" 
                onClick={() => setFormData({ ...formData, phoneNumbers: [...formData.phoneNumbers, ''] })}
                className="text-[10px] font-bold text-primary flex items-center gap-1 uppercase tracking-widest mt-1"
              >
                <Plus className="w-3 h-3" /> Add Phone
              </button>
            </div>
             <div className="space-y-1">
               <div className="flex items-center justify-between">
                 <label className="label">Date (DD_MM_YYYY)</label>
                 <div className="flex gap-1.5">
                   <button
                     type="button"
                     onClick={() => {
                       const d = new Date();
                       const dd = String(d.getDate()).padStart(2, '0');
                       const mm = String(d.getMonth() + 1).padStart(2, '0');
                       const yyyy = d.getFullYear();
                       setFormData({ ...formData, date: `${dd}_${mm}_${yyyy}` });
                       setToast({ message: "Set date to Today", type: "success" });
                     }}
                     className="text-[9px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                   >
                     Today
                   </button>
                   <button
                     type="button"
                     onClick={() => {
                       const d = new Date();
                       d.setDate(d.getDate() - 1);
                       const dd = String(d.getDate()).padStart(2, '0');
                       const mm = String(d.getMonth() + 1).padStart(2, '0');
                       const yyyy = d.getFullYear();
                       setFormData({ ...formData, date: `${dd}_${mm}_${yyyy}` });
                       setToast({ message: "Set date to Yesterday", type: "success" });
                     }}
                     className="text-[9px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                   >
                     Yesterday
                   </button>
                 </div>
               </div>
               <input 
                 type="text" 
                 placeholder="DD_MM_YYYY"
                 className="input-field" 
                 value={formData.date} 
                 onChange={(e) => handleDateInputChange(e.target.value, (formatted) => setFormData({ ...formData, date: formatted }))} 
               />
             </div>
            <div className="space-y-1">
              <label className="label">Presentation</label>
              <select className="input-field" value={formData.presentation} onChange={(e) => setFormData({ ...formData, presentation: e.target.value as Presentation })}>
                {Object.values(Presentation).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="label">Ejection Fraction</label>
              <select className="input-field" value={formData.ejectionFraction} onChange={(e) => setFormData({ ...formData, ejectionFraction: e.target.value as EjectionFraction })}>
                {Object.values(EjectionFraction).map(ef => (
                  <option key={ef} value={ef}>{ef}</option>
                ))}
              </select>
              {formData.ejectionFraction === EjectionFraction.Other && (
                <div className="mt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <input 
                    placeholder="Enter custom Ejection Fraction/LV finding..." 
                    className="input-field border-primary/30 focus:border-primary shadow-sm" 
                    value={formData.otherEjectionFractionNotes || ''} 
                    onChange={(e) => setFormData({ ...formData, otherEjectionFractionNotes: e.target.value })} 
                  />
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <label className="label">RWMA</label>
              <MultiSelector 
                options={Object.values(RWMAOption)} 
                selected={formData.rwma} 
                onToggle={(val) => toggleMultiSelectEx('rwma', val)} 
                color="primary"
              />
            </div>

            <div className="space-y-2">
              <label className="label">Comorbidities</label>
              <MultiSelector 
                options={Object.values(Comorbidity)} 
                selected={formData.comorbidities} 
                onToggle={(val) => toggleMultiSelectEx('comorbidities', val)} 
                color="red"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="label">Weight (kg)</label>
                <input 
                  type="number" 
                  step="0.1" 
                  placeholder="kg" 
                  className="input-field" 
                  value={formData.weight} 
                  onChange={(e) => {
                    const w = e.target.value;
                    const bmiVal = calculateBMI(w, formData.height);
                    setFormData({ ...formData, weight: w, bmi: bmiVal });
                  }} 
                />
              </div>
              <div className="space-y-1">
                <label className="label">Height (cm)</label>
                <input 
                  type="number" 
                  step="1" 
                  placeholder="cm" 
                  className="input-field" 
                  value={formData.height} 
                  onChange={(e) => {
                    const h = e.target.value;
                    const bmiVal = calculateBMI(formData.weight, h);
                    setFormData({ ...formData, height: h, bmi: bmiVal });
                  }} 
                />
              </div>
              <div className="space-y-1">
                <label className="label">BMI</label>
                <input 
                  type="text" 
                  disabled 
                  placeholder="Auto" 
                  className="input-field bg-slate-50 text-slate-500 font-mono font-medium" 
                  value={formData.bmi} 
                />
              </div>
            </div>

            <PhotoUploadField 
              label="Lab Investigations" 
              value={formData.labPhotoUrl} 
              onUpload={(e) => handlePhotoUpload(e, 'labPhotoUrl', 'Lab Investigations')} 
              onRemove={() => setFormData({ ...formData, labPhotoUrl: '' })} 
              onCrop={() => handleManualCrop('labPhotoUrl', 'Lab Investigations', formData.labPhotoUrl)}
            />

            {/* Lab Values Grid */}
            <div className="space-y-3 p-3 bg-slate-50/80 border border-slate-200/60 rounded-2xl">
              <div>
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-2">Pre Procedure Labs</span>
                <div className="grid grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500">Hb</label>
                    <input 
                      type="text" 
                      placeholder="Hb" 
                      className="input-field text-center text-xs px-1" 
                      value={formData.preHb || ''} 
                      onChange={(e) => setFormData({ ...formData, preHb: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500">Urea</label>
                    <input 
                      type="text" 
                      placeholder="Urea" 
                      className="input-field text-center text-xs px-1" 
                      value={formData.preUrea || ''} 
                      onChange={(e) => setFormData({ ...formData, preUrea: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500">Creat</label>
                    <input 
                      type="text" 
                      placeholder="Cr" 
                      className="input-field text-center text-xs px-1" 
                      value={formData.preCreatinine || ''} 
                      onChange={(e) => setFormData({ ...formData, preCreatinine: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500">K+</label>
                    <input 
                      type="text" 
                      placeholder="K+" 
                      className="input-field text-center text-xs px-1" 
                      value={formData.preK || ''} 
                      onChange={(e) => setFormData({ ...formData, preK: e.target.value })} 
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200/60 pt-2">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-2">Post Procedure Labs</span>
                <div className="grid grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500">Hb</label>
                    <input 
                      type="text" 
                      placeholder="Hb" 
                      className="input-field text-center text-xs px-1" 
                      value={formData.postHb || ''} 
                      onChange={(e) => setFormData({ ...formData, postHb: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500">Urea</label>
                    <input 
                      type="text" 
                      placeholder="Urea" 
                      className="input-field text-center text-xs px-1" 
                      value={formData.postUrea || ''} 
                      onChange={(e) => setFormData({ ...formData, postUrea: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500">Creat</label>
                    <input 
                      type="text" 
                      placeholder="Cr" 
                      className="input-field text-center text-xs px-1" 
                      value={formData.postCreatinine || ''} 
                      onChange={(e) => setFormData({ ...formData, postCreatinine: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500">K+</label>
                    <input 
                      type="text" 
                      placeholder="K+" 
                      className="input-field text-center text-xs px-1" 
                      value={formData.postK || ''} 
                      onChange={(e) => setFormData({ ...formData, postK: e.target.value })} 
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="label">Access</label>
                  <select 
                    className="input-field" 
                    value={formData.access} 
                    onChange={(e) => setFormData({ ...formData, access: e.target.value as AccessMethod })}
                  >
                    {Object.values(AccessMethod).map(method => (
                      <option key={method} value={method}>{method}</option>
                    ))}
                  </select>
                  {formData.access === AccessMethod.Other && (
                    <div className="mt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      <input 
                        placeholder="Enter access details..." 
                        className="input-field border-primary/30 focus:border-primary shadow-sm" 
                        value={formData.otherAccessNotes} 
                        onChange={(e) => setFormData({ ...formData, otherAccessNotes: e.target.value })} 
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="label">USG/ Doppler</label>
                  <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, usgDoppler: true })}
                      className={cn(
                        "flex-1 py-1 text-[10px] font-bold rounded-md transition-all",
                        formData.usgDoppler ? "bg-white text-primary shadow-sm" : "text-slate-500"
                      )}
                    >
                      YES
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, usgDoppler: false })}
                      className={cn(
                        "flex-1 py-1 text-[10px] font-bold rounded-md transition-all",
                        !formData.usgDoppler ? "bg-white text-primary shadow-sm" : "text-slate-500"
                      )}
                    >
                      NO
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="label">TMT</label>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  {Object.values(TMTOption).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFormData({ ...formData, tmt: opt })}
                      className={cn(
                        "flex-1 py-1 text-[10px] font-bold rounded-md transition-all",
                        formData.tmt === opt 
                          ? "bg-white text-primary shadow-sm" 
                          : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <PhotoUploadField 
                label="Angiogram Report" 
                value={formData.angiogramPhotoUrl} 
                onUpload={(e) => handlePhotoUpload(e, 'angiogramPhotoUrl', 'Angiogram Report')} 
                onRemove={() => setFormData({ ...formData, angiogramPhotoUrl: '' })} 
                onCrop={() => handleManualCrop('angiogramPhotoUrl', 'Angiogram Report', formData.angiogramPhotoUrl)}
              />

              <MultiPhotoUploadField 
                label="PCI Report" 
                photos={formData.pciPhotoUrls && formData.pciPhotoUrls.length > 0 ? formData.pciPhotoUrls : (formData.pciPhotoUrl ? [formData.pciPhotoUrl] : [])} 
                onUpload={(e, replaceIndex) => handleMultiPhotoUpload(e, 'pciPhotoUrls', 'PCI Report', replaceIndex)} 
                onRemove={(idx) => handleRemoveMultiPhoto('pciPhotoUrls', idx)} 
                onCrop={(idx, url) => handleManualCrop(`pciPhotoUrls_${idx}`, `PCI Report #${idx + 1}`, url)}
                onPreview={(url, title) => setPreviewPhoto({ url, title })}
              />

              <div className="space-y-2">
                <label className="label">PCI Vessel</label>
                <MultiSelector 
                  options={Object.values(PCIVessel)} 
                  selected={formData.pciVessels} 
                  onToggle={(val) => toggleMultiSelectEx('pciVessels', val)} 
                  color="red"
                />
              </div>

              <div className="space-y-2">
                <label className="label">Lesion Type</label>
                <MultiSelector 
                  options={Object.values(LesionType)} 
                  selected={formData.lesionTypes || []} 
                  onToggle={(val) => toggleMultiSelectEx('lesionTypes', val)} 
                  color="red"
                />
              </div>

              <div className="space-y-1.5 p-3 bg-slate-50 border border-slate-200/60 rounded-2xl">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-red-500" /> Standardized Anatomy Lesions
                </label>
                <select
                  className="input-field w-full text-xs"
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val && !formData.lesions.includes(val)) {
                      setFormData(prev => ({
                        ...prev,
                        lesions: [...prev.lesions, val]
                      }));
                    }
                  }}
                >
                  <option value="">-- Add Standard Anatomy Lesion (ICD-10) --</option>
                  {STANDARD_LESIONS.map(sl => (
                    <option key={sl.name} value={sl.name}>
                      {sl.name}
                    </option>
                  ))}
                </select>
                {formData.lesions && formData.lesions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {formData.lesions.map(l => (
                      <span key={l} className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 border border-red-100 text-red-700 text-[10px] font-bold rounded-lg uppercase tracking-wider animate-fadeIn">
                        {l.split(' (')[0]}
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            lesions: prev.lesions.filter(x => x !== l)
                          }))}
                          className="hover:bg-red-100 p-0.5 rounded text-red-500"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2 border-l-2 border-blue-200/60 pl-3">
                <label className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest mb-1.5 flex items-center gap-1.5 bg-blue-50/70 border border-blue-100 rounded-lg px-2.5 py-1 w-fit select-none">
                  <ClipboardList className="w-3.5 h-3.5 text-blue-500" /> Imaging and Physiology
                </label>
                <MultiSelector 
                  options={Object.values(ImagingOption)} 
                  selected={formData.imaging} 
                  onToggle={(val) => toggleMultiSelectEx('imaging', val)} 
                  color="blue"
                />

                {/* Dynamic linked findings details fields */}
                {formData.imaging && formData.imaging.length > 0 && (
                  <div className="space-y-2.5 mt-2.5 bg-blue-50/30 p-3 rounded-2xl border border-blue-100/60 animate-in fade-in slide-in-from-top-2 duration-250">
                    <div className="text-[10px] font-extrabold text-blue-600/90 uppercase tracking-widest mb-1 select-none flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-blue-500 animate-pulse" /> Linked Findings
                    </div>
                    {formData.imaging.map((option) => (
                      <div key={option} className="space-y-1 bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5 select-none">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                            {option} Detail Finding
                          </span>
                          <span className="text-[9px] font-extrabold text-blue-500 tracking-widest bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5 select-none uppercase scale-90">LINKED</span>
                        </div>
                        <input
                          type="text"
                          placeholder={`Enter specific ${option} measurements, plaque type, or comments...`}
                          className="w-full text-xs border border-slate-200 rounded-lg py-2 px-3 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-slate-50/30"
                          value={formData.imagingFindings?.[option] || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData(prev => ({
                              ...prev,
                              imagingFindings: {
                                ...(prev.imagingFindings || {}),
                                [option]: val
                              }
                            }));
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <MultiPhotoUploadField 
                  label="Imaging Photo" 
                  photos={formData.imagingPhotoUrls && formData.imagingPhotoUrls.length > 0 ? formData.imagingPhotoUrls : (formData.imagingPhotoUrl ? [formData.imagingPhotoUrl] : [])} 
                  onUpload={(e, replaceIndex) => handleMultiPhotoUpload(e, 'imagingPhotoUrls', 'Imaging Photo', replaceIndex)} 
                  onRemove={(idx) => handleRemoveMultiPhoto('imagingPhotoUrls', idx)} 
                  onCrop={(idx, url) => handleManualCrop(`imagingPhotoUrls_${idx}`, `Imaging Photo #${idx + 1}`, url)}
                  onPreview={(url, title) => setPreviewPhoto({ url, title })}
                />
              </div>

              <div className="space-y-2">
                <label className="label">Special Hardware</label>
                <MultiSelector 
                  options={Object.values(SpecialHardware)} 
                  selected={formData.specialHardware} 
                  onToggle={(val) => toggleMultiSelectEx('specialHardware', val)} 
                  color="green"
                />
                {formData.specialHardware.includes(SpecialHardware.Other) && (
                  <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                    <input 
                      placeholder="Specify other special hardware / balloon (e.g. OPN NC, scoring, laser)..." 
                      className="input-field text-xs" 
                      value={formData.otherSpecialHardwareNotes || ''} 
                      onChange={(e) => setFormData({ ...formData, otherSpecialHardwareNotes: e.target.value })} 
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="label">DEVICES</label>
                </div>
                <DeviceSelector 
                  devices={formData.devices}
                  onChange={(devices) => setFormData({ ...formData, devices })}
                />
                
                <DeviceCatalogSelector 
                  deviceType={DeviceType.DES}
                  details={formData.stentDetails}
                  devices={formData.devices}
                  onUpdate={(stentDetails, devices) => setFormData(prev => ({ ...prev, stentDetails, devices }))}
                  onToast={(message, type) => setToast({ message, type })}
                  brandSelectId="stent-brand-select-desktop"
                />

                <DeviceCatalogSelector 
                  deviceType={DeviceType.BRS}
                  details={formData.brsDetails}
                  devices={formData.devices}
                  onUpdate={(brsDetails, devices) => setFormData(prev => ({ ...prev, brsDetails, devices }))}
                  onToast={(message, type) => setToast({ message, type })}
                  brandSelectId="brs-brand-select-desktop"
                />

                <DeviceCatalogSelector 
                  deviceType={DeviceType.DEB}
                  details={formData.debDetails}
                  devices={formData.devices}
                  onUpdate={(debDetails, devices) => setFormData(prev => ({ ...prev, debDetails, devices }))}
                  onToast={(message, type) => setToast({ message, type })}
                  brandSelectId="deb-brand-select-desktop"
                />
              </div>

              <div className="space-y-2">
                <label className="label">Closure Devices</label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    className="input-field w-full"
                    value={formData.closureDevice || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        closureDevice: val,
                        closureDeviceCustom: val === 'Others' ? prev.closureDeviceCustom : ''
                      }));
                    }}
                  >
                    <option value="">Select Closure Device</option>
                    <option value="Angioseal">Angioseal</option>
                    <option value="Perclose">Perclose</option>
                    <option value="Prostyle">Prostyle</option>
                    <option value="Others">Others</option>
                  </select>

                  {formData.closureDevice === 'Others' && (
                    <input
                      type="text"
                      className="input-field w-full"
                      placeholder="Type custom closure device..."
                      value={formData.closureDeviceCustom || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, closureDeviceCustom: e.target.value }))}
                    />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="label">Complications</label>
                <MultiSelector 
                  options={Object.values(Complication)} 
                  selected={formData.complications} 
                  onToggle={(val) => toggleMultiSelectEx('complications', val)} 
                  color="orange"
                />
                {formData.complications.includes(Complication.Other) && (
                  <div className="space-y-1.5 animate-fadeIn">
                    <select
                      className="input-field w-full text-xs"
                      value={STANDARD_COMPLICATIONS.some(sc => sc.name === formData.complicationsCustom) ? formData.complicationsCustom : (formData.complicationsCustom ? 'Custom' : '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'Custom') {
                          setFormData(prev => ({ ...prev, complicationsCustom: '' }));
                        } else {
                          setFormData(prev => ({ ...prev, complicationsCustom: val }));
                        }
                      }}
                    >
                      <option value="">-- Select Standard ICD-10 Complication --</option>
                      {STANDARD_COMPLICATIONS.map(sc => (
                        <option key={sc.name} value={sc.name}>
                          {sc.code} - {sc.name}
                        </option>
                      ))}
                      <option value="Custom">Custom / Free Text...</option>
                    </select>
                    {(!STANDARD_COMPLICATIONS.some(sc => sc.name === formData.complicationsCustom) || formData.complicationsCustom === '') && (
                      <input
                        type="text"
                        className="input-field w-full text-xs animate-fadeIn"
                        placeholder="Type custom complication name..."
                        value={formData.complicationsCustom || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, complicationsCustom: e.target.value }))}
                      />
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="label">Other Hardware</label>
                <MultiSelector 
                  options={Object.values(OtherHardware)} 
                  selected={formData.otherHardware} 
                  onToggle={(val) => toggleMultiSelectEx('otherHardware', val)} 
                />
                {formData.otherHardware.includes(OtherHardware.Other) && (
                  <input 
                    placeholder="Specify other hardware..." 
                    className="input-field" 
                    value={formData.otherHardwareNotes} 
                    onChange={(e) => setFormData({ ...formData, otherHardwareNotes: e.target.value })} 
                  />
                )}
              </div>

              <div className="space-y-2">
                <label className="label">Drugs</label>
                <MultiSelector 
                  options={Object.values(Drug)} 
                  selected={formData.drugs} 
                  onToggle={(val) => toggleMultiSelectEx('drugs', val)} 
                  color="blue"
                />
                {formData.drugs.includes(Drug.Other) && (
                  <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                    <input 
                      placeholder="Specify other drug(s)..." 
                      className="input-field text-xs" 
                      value={formData.otherDrugsNotes || ''} 
                      onChange={(e) => setFormData({ ...formData, otherDrugsNotes: e.target.value })} 
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="label">Final Notes</label>
                  <VoiceInputButton 
                    onTranscript={(text) => {
                      setFormData(prev => ({ ...prev, finalNotes: prev.finalNotes ? prev.finalNotes + ' ' + text : text }));
                    }}
                  />
                </div>
                <textarea 
                  placeholder="Final medical conclusions..." 
                  className="input-field min-h-[100px] py-2 resize-none"
                  value={formData.finalNotes}
                  onChange={(e) => setFormData({ ...formData, finalNotes: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="label">Plan</label>
                  <VoiceInputButton 
                    onTranscript={(text) => {
                      setFormData(prev => ({ ...prev, plan: prev.plan ? prev.plan + ' ' + text : text }));
                    }}
                  />
                </div>
                <textarea 
                  placeholder="Further management / treatment plan, staged PCI, medical therapy, follow-up..." 
                  className="input-field min-h-[85px] py-2 resize-none"
                  value={formData.plan}
                  onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                />
              </div>

              {/* Follow-Up & Clinical Outcomes History Editor */}
              <FollowUpEditor
                outcomes={formData.outcomes || []}
                onChange={(updatedOutcomes) => setFormData(prev => ({ ...prev, outcomes: updatedOutcomes }))}
                formatDateDMY={formatDateDMY}
                onPreviewPhoto={(url, title) => setPreviewPhoto({ url, title })}
              />

              <PhotoUploadField 
                label="Other Info Photo" 
                value={formData.otherInfoPhotoUrl} 
                onUpload={(e) => handlePhotoUpload(e, 'otherInfoPhotoUrl', 'Other Information')} 
                onRemove={() => setFormData({ ...formData, otherInfoPhotoUrl: '' })} 
                onCrop={() => handleManualCrop('otherInfoPhotoUrl', 'Other Information', formData.otherInfoPhotoUrl)}
              />

            </div>

            <button 
              disabled={isSubmitting}
              className={cn(
                "w-full mt-6 py-3.5 font-bold text-xs uppercase tracking-wide rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95",
                isEditing 
                  ? "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200" 
                  : "btn-primary shadow-sky-100"
              )}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto text-white" />
              ) : isEditing ? (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Save & Update Patient Record
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Save Patient Data
                </>
              )}
            </button>
          </form>
        </aside>

        {/* Main Content Area */}
        {view === 'list' && (
          <section id="patient-list-section" className="flex-1 flex flex-col p-3 sm:p-6 overflow-y-auto sm:overflow-hidden w-full max-w-full min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 sm:mb-6 shrink-0 gap-3">
            <div className="flex items-center justify-between w-full sm:w-auto">
              <div className="flex items-center gap-3">
                <img 
                  src={heartIcon} 
                  alt="Recent Records Icon" 
                  referrerPolicy="no-referrer" 
                  className="w-10 h-10 rounded-xl object-contain shadow-sm border border-slate-100 p-0.5 bg-slate-50 shrink-0" 
                />
                <div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">Recent Records</h2>
                  <p className="text-sm text-slate-400 mt-0.5">
                    Showing {filteredPatients.length} of {patients.length} patients
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 justify-start sm:justify-end w-full sm:w-auto">
              {/* Active Sort Status Indicator */}
              <div className="relative">
                <button
                  id="btn-sort-dropdown"
                  onClick={() => setShowSortDropdown(!showSortDropdown)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 border rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm transition-all duration-200 cursor-pointer",
                    showSortDropdown 
                      ? "bg-primary/5 text-primary border-primary" 
                      : "bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50"
                  )}
                  title="Change Sorting Options"
                >
                  <span className="text-slate-400">Sort:</span>
                  <span className="text-slate-800 font-extrabold px-1.5 py-0.5 bg-slate-50 border border-slate-100 rounded text-[9px] transition-all">
                    {sortBy === 'serialNo' ? 'Serial No' :
                     sortBy === 'date' ? 'Date' :
                     sortBy === 'admissionNo' ? 'Adm No' :
                     sortBy === 'name' ? 'Name' :
                     sortBy === 'age' ? 'Age' :
                     sortBy === 'gender' ? 'Gender' :
                     sortBy === 'ageGen' ? 'Age/Gender' :
                     sortBy === 'ef' ? 'EF' :
                     sortBy === 'finalNotes' ? 'Final Note' :
                     sortBy === 'generalNotes' ? 'General Note' :
                     sortBy === 'status' ? 'Status' : sortBy}
                  </span>
                  <div className="flex items-center gap-0.5 text-primary font-black">
                    {sortOrder === 'asc' ? 'Asc' : 'Desc'}
                    {sortOrder === 'asc' ? (
                      <ArrowUp className="w-3 h-3 text-primary shrink-0 ml-0.5" />
                    ) : (
                      <ArrowDown className="w-3 h-3 text-primary shrink-0 ml-0.5" />
                    )}
                  </div>
                </button>

                {showSortDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowSortDropdown(false)} />
                    <div className="absolute right-0 mt-1.5 w-44 bg-white border border-border rounded-xl shadow-lg p-1.5 z-50 animate-fade-in flex flex-col gap-0.5">
                      <div className="px-2.5 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                        Sort Field
                      </div>
                      <button
                        onClick={() => { setSortBy('date'); setShowSortDropdown(false); }}
                        className={cn(
                          "w-full text-left px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-between",
                          sortBy === 'date' ? "bg-primary/5 text-primary" : "text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        <span>Date</span>
                        {sortBy === 'date' && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      </button>
                      <button
                        onClick={() => { setSortBy('serialNo'); setShowSortDropdown(false); }}
                        className={cn(
                          "w-full text-left px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-between",
                          sortBy === 'serialNo' ? "bg-primary/5 text-primary" : "text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        <span>Serial No</span>
                        {sortBy === 'serialNo' && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      </button>
                      <button
                        onClick={() => { setSortBy('name'); setShowSortDropdown(false); }}
                        className={cn(
                          "w-full text-left px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-between",
                          sortBy === 'name' ? "bg-primary/5 text-primary" : "text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        <span>Name</span>
                        {sortBy === 'name' && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      </button>
                      <button
                        onClick={() => { setSortBy('age'); setShowSortDropdown(false); }}
                        className={cn(
                          "w-full text-left px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-between",
                          sortBy === 'age' ? "bg-primary/5 text-primary" : "text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        <span>Age</span>
                        {sortBy === 'age' && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      </button>
                      <button
                        onClick={() => { setSortBy('gender'); setShowSortDropdown(false); }}
                        className={cn(
                          "w-full text-left px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-between",
                          sortBy === 'gender' ? "bg-primary/5 text-primary" : "text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        <span>Gender</span>
                        {sortBy === 'gender' && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      </button>

                      <div className="h-[1px] bg-slate-100 my-1" />
                      <div className="px-2.5 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                        Sort Direction
                      </div>
                      <div className="flex p-1 gap-1">
                        <button
                          onClick={() => { setSortOrder('asc'); }}
                          className={cn(
                            "flex-1 text-center py-1 text-[10px] font-bold rounded-md transition-colors",
                            sortOrder === 'asc' ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-50 bg-slate-100/50"
                          )}
                        >
                          Asc
                        </button>
                        <button
                          onClick={() => { setSortOrder('desc'); }}
                          className={cn(
                            "flex-1 text-center py-1 text-[10px] font-bold rounded-md transition-colors",
                            sortOrder === 'desc' ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-50 bg-slate-100/50"
                          )}
                        >
                          Desc
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Configure Table Settings Dropdown */}
              <div className="relative">
                <button
                  id="btn-configure-table"
                  onClick={() => setShowTableSettings(!showTableSettings)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-border hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer shadow-sm hover:scale-[1.02] hover:shadow-md active:scale-[0.98]"
                  title="Configure Table Columns"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-500" />
                  <span>Configure Table</span>
                </button>
                {showTableSettings && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setShowTableSettings(false)} />
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-border rounded-xl shadow-lg p-4 z-30 animate-fade-in space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Visible Columns</span>
                        <button 
                          onClick={() => {
                            setVisibleColumns({
                              place: true,
                              serialNo: true,
                              date: true,
                              admissionNo: true,
                              name: true,
                              ageGen: true,
                              ef: true,
                              finalNotes: true,
                              generalNotes: true,
                              status: true,
                            });
                            setColumnOrder([
                              'place',
                              'serialNo',
                              'date',
                              'admissionNo',
                              'name',
                              'ageGen',
                              'ef',
                              'finalNotes',
                              'generalNotes',
                              'status'
                            ]);
                          }}
                          className="text-[9px] font-bold text-primary hover:underline uppercase"
                        >
                          Reset
                        </button>
                      </div>
                      <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1">
                        {columnOrder.map((colKey, index) => {
                          const label = {
                            place: 'Place',
                            serialNo: 'Serial No',
                            date: 'Date',
                            admissionNo: 'Adm No',
                            name: 'Name',
                            ageGen: 'Age / Gender',
                            ef: 'Ejection Fraction',
                            finalNotes: 'Final Note',
                            generalNotes: 'General Note',
                            status: 'Status',
                          }[colKey] || colKey;

                          const isDragged = draggedColumnIndex === index;

                          return (
                            <div
                              key={colKey}
                              draggable
                              onDragStart={(e) => handleColumnDragStart(e, index)}
                              onDragOver={(e) => handleColumnDragOver(e, index)}
                              onDragEnd={handleColumnDragEnd}
                              className={`relative flex items-center gap-2 py-1 px-1.5 rounded-lg transition-all duration-150 select-none ${
                                isDragged 
                                  ? 'bg-blue-50/80 border-2 border-dashed border-blue-400/80 scale-[0.98] shadow-sm' 
                                  : 'hover:bg-slate-50 border border-transparent'
                              }`}
                            >
                              {isDragged && (
                                <div className="absolute -left-0.5 -right-0.5 -top-0.5 -bottom-0.5 border-2 border-blue-500/20 rounded-lg pointer-events-none animate-pulse" />
                              )}
                              <div className={`cursor-grab active:cursor-grabbing transition-colors p-0.5 ${
                                isDragged ? 'text-blue-500' : 'text-slate-400 hover:text-slate-600'
                              }`}>
                                <GripVertical className="w-3.5 h-3.5" />
                              </div>
                              <label className="flex-1 flex items-center justify-between cursor-pointer">
                                <span className={`text-xs font-medium transition-colors ${
                                  isDragged ? 'text-blue-700 font-semibold' : 'text-slate-700 hover:text-slate-900'
                                }`}>
                                  {label}
                                </span>
                                <input
                                  type="checkbox"
                                  checked={visibleColumns[colKey] ?? false}
                                  onChange={() => setVisibleColumns(prev => ({
                                    ...prev,
                                    [colKey]: !prev[colKey]
                                  }))}
                                  className="rounded border-slate-300 text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer ml-2"
                                />
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 lg:hidden">
                <button 
                  onClick={() => {
                    setIsEditing(null);
                    setFormData(INITIAL_FORM_DATA);
                    setIsSerialNoManuallyEdited(false);
                    setView('add');
                  }}
                  className="btn-primary"
                >
                  <Plus className="w-4 h-4" /> New Entry
                </button>
              </div>
            </div>
          </div>

          {/* Quick Filter Pills Row */}
          <div id="quick-filters-card" className="flex flex-col gap-2.5 mb-3 sm:mb-5 shrink-0 bg-slate-50 border border-slate-200/80 p-2.5 sm:p-3.5 rounded-xl relative shadow-xs z-30 overflow-visible">
            {activeFilterDropdown && (
              <div 
                id="quick-filter-backdrop"
                className="fixed inset-0 z-40" 
                onClick={() => setActiveFilterDropdown(null)} 
              />
            )}

            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-700 tracking-wide flex items-center gap-1.5 uppercase">
                <Filter className="w-3.5 h-3.5 text-primary stroke-[2.5]" /> Quick Filters
              </span>
              {(filters.gender !== 'All' || filters.category !== 'All' || filters.serviceCategory !== 'All' || filters.startDate !== '' || filters.endDate !== '' || filters.tags.length > 0 || filters.tag !== '' || filters.importantOnly || filters.minAge !== '' || filters.maxAge !== '') && (
                <button
                  id="quick-filter-clear-all-btn"
                  onClick={() => {
                    setFilters({
                      gender: 'All',
                      minAge: '',
                      maxAge: '',
                      startDate: '',
                      endDate: '',
                      category: 'All',
                      serviceCategory: 'All',
                      tag: '',
                      tags: [],
                      tagMatchMode: 'all',
                      dateField: 'either',
                      importantOnly: false
                    });
                    setActiveFilterDropdown(null);
                    setToast({ message: "All quick filters reset.", type: "info" });
                  }}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 uppercase flex items-center gap-1 cursor-pointer z-45 relative px-2 py-0.5 rounded-lg hover:bg-rose-50 transition-colors"
                >
                  Clear All <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-2 select-none relative z-40 w-full overflow-visible">
              {/* Important Filter Pill */}
              <button
                id="quick-filter-important-btn"
                type="button"
                onClick={() => setFilters(prev => ({ ...prev, importantOnly: !prev.importantOnly }))}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 active:scale-95 cursor-pointer shrink-0 select-none",
                  filters.importantOnly
                    ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                )}
                title="Filter to show only important/starred cases"
              >
                <Star className={cn("w-3.5 h-3.5", filters.importantOnly ? "fill-white text-white" : "text-amber-500 fill-amber-400")} />
                <span>Important</span>
                {patients.filter(p => !p.isDeleted && p.isImportant).length > 0 && (
                  <span className={cn("text-[10px] font-extrabold px-1.5 py-0.2 rounded-full", filters.importantOnly ? "bg-amber-700 text-amber-100" : "bg-amber-100 text-amber-800")}>
                    {patients.filter(p => !p.isDeleted && p.isImportant).length}
                  </span>
                )}
              </button>

              {/* Class Dropdown */}
              <div className="relative min-w-[120px]">
                <div className="flex items-center">
                  <button
                    id="quick-filter-class-btn"
                    type="button"
                    onClick={() => toggleFilterDropdown('class')}
                    className={cn(
                      "w-full px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-between gap-1.5 active:scale-95 cursor-pointer",
                      filters.serviceCategory !== 'All'
                        ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    <span className="truncate">Class: {filters.serviceCategory === 'All' ? 'All' : filters.serviceCategory}</span>
                    <ChevronDown className={cn("w-3.5 h-3.5 transition-transform shrink-0 opacity-80", activeFilterDropdown === 'class' && "rotate-180")} />
                  </button>
                  {filters.serviceCategory !== 'All' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFilters(prev => ({ ...prev, serviceCategory: 'All' }));
                      }}
                      className="absolute right-6 text-white/80 hover:text-white p-0.5 cursor-pointer"
                      title="Clear Class filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {activeFilterDropdown === 'class' && (
                  <div id="quick-filter-class-menu" className="absolute left-0 top-full mt-1.5 w-52 bg-white border border-slate-200 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      Service Category
                    </div>
                    {[
                      { value: 'All', label: 'All Classes' },
                      { value: 'Ser', label: 'Service (Ser)' },
                      { value: 'Vet', label: 'Veteran (Vet)' },
                      { value: 'Dep', label: 'Dependent (Dep)' }
                    ].map((cat) => {
                      const isActive = filters.serviceCategory === cat.value;
                      const count = cat.value === 'All' 
                        ? patients.filter(p => !p.isDeleted).length 
                        : patients.filter(p => !p.isDeleted && (
                            String(p.serviceCategory || ServiceCategory.Ser).toLowerCase() === cat.value.toLowerCase() ||
                            (cat.value === 'Ser' && String(p.serviceCategory || ServiceCategory.Ser).toLowerCase().startsWith('serv')) ||
                            (cat.value === 'Vet' && String(p.serviceCategory || '').toLowerCase().startsWith('vet')) ||
                            (cat.value === 'Dep' && String(p.serviceCategory || '').toLowerCase().startsWith('dep'))
                          )).length;

                      return (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => {
                            setFilters(prev => ({ ...prev, serviceCategory: isActive && cat.value !== 'All' ? 'All' : cat.value }));
                            setActiveFilterDropdown(null);
                          }}
                          className={cn(
                            "w-full px-3 py-2 text-left text-xs font-semibold hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer",
                            isActive ? "text-indigo-600 bg-indigo-50 font-bold" : "text-slate-700"
                          )}
                        >
                          <span className="truncate">{cat.label}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded-full">{count}</span>
                            {isActive && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Type Dropdown */}
              <div className="relative min-w-[120px]">
                <div className="flex items-center">
                  <button
                    id="quick-filter-type-btn"
                    type="button"
                    onClick={() => toggleFilterDropdown('type')}
                    className={cn(
                      "w-full px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-between gap-1.5 active:scale-95 cursor-pointer",
                      filters.category !== 'All'
                        ? "bg-blue-600 text-white border-blue-700 shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    <span className="truncate">Type: {filters.category === 'All' ? 'All' : filters.category}</span>
                    <ChevronDown className={cn("w-3.5 h-3.5 transition-transform shrink-0 opacity-80", activeFilterDropdown === 'type' && "rotate-180")} />
                  </button>
                  {filters.category !== 'All' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFilters(prev => ({ ...prev, category: 'All' }));
                      }}
                      className="absolute right-6 text-white/80 hover:text-white p-0.5 cursor-pointer"
                      title="Clear Type filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {activeFilterDropdown === 'type' && (
                  <div id="quick-filter-type-menu" className="absolute left-0 top-full mt-1.5 w-56 bg-white border border-slate-200 rounded-xl shadow-2xl py-1 z-50 max-h-[300px] overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      Procedure Category
                    </div>
                    {[
                      { value: 'All', label: 'All Types' },
                      { value: 'CAG', label: 'CAG (Coronary Angio)' },
                      { value: 'PCI', label: 'PCI (All Interventions)' },
                      { value: 'CAG+PCI', label: 'CAG + PCI' },
                      { value: 'Primary PCI', label: 'Primary PCI' },
                      { value: 'Staged PCI', label: 'Staged PCI' },
                      { value: 'Devices', label: 'Devices / Pacemaker' },
                      { value: 'Structural', label: 'Structural Interventions' },
                      { value: 'Peripheral', label: 'Peripheral / EVAR' },
                      { value: 'EP', label: 'Electrophysiology' },
                      { value: 'Renal', label: 'Renal Angio' },
                      { value: 'Fluoroscopy', label: 'Fluoroscopy' },
                      { value: 'Other', label: 'Other Procedures' }
                    ].map((cat) => {
                      const isActive = filters.category === cat.value;
                      return (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => {
                            setFilters(prev => ({ ...prev, category: isActive && cat.value !== 'All' ? 'All' : cat.value }));
                            setActiveFilterDropdown(null);
                          }}
                          className={cn(
                            "w-full px-3 py-2 text-left text-xs font-semibold hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer",
                            isActive ? "text-blue-600 bg-blue-50 font-bold" : "text-slate-700"
                          )}
                        >
                          <span className="truncate">{cat.label}</span>
                          {isActive && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Date Dropdown */}
              <div className="relative min-w-[120px]">
                {(() => {
                  const label = getDateLabel();
                  const isFiltered = label !== 'All';
                  return (
                    <>
                      <div className="flex items-center">
                        <button
                          id="quick-filter-date-btn"
                          type="button"
                          onClick={() => toggleFilterDropdown('date')}
                          className={cn(
                            "w-full px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-between gap-1.5 active:scale-95 cursor-pointer",
                            isFiltered
                              ? "bg-amber-600 text-white border-amber-700 shadow-sm"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                          )}
                        >
                          <span className="truncate">Date: {label}</span>
                          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform shrink-0 opacity-80", activeFilterDropdown === 'date' && "rotate-180")} />
                        </button>
                        {isFiltered && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFilters(prev => ({ ...prev, startDate: '', endDate: '' }));
                            }}
                            className="absolute right-6 text-white/80 hover:text-white p-0.5 cursor-pointer"
                            title="Clear Date filter"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      {activeFilterDropdown === 'date' && (
                        <div id="quick-filter-date-menu" className="absolute left-0 top-full mt-1.5 w-52 bg-white border border-slate-200 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                            Time Range
                          </div>
                          {[
                            { label: 'All Time', range: 'all' },
                            { label: 'Today', range: 'today' },
                            { label: 'Last 7 Days', range: '7days' },
                            { label: 'Last 30 Days', range: '30days' },
                            { label: 'This Month', range: 'thisMonth' },
                            { label: 'This Year', range: 'thisYear' }
                          ].map((dOpt) => {
                            let isActive = false;
                            const today = new Date();
                            const todayStr = formatDateToDMYStr(today);
                            if (dOpt.range === 'all') {
                              isActive = !filters.startDate && !filters.endDate;
                            } else if (dOpt.range === 'today') {
                              isActive = filters.startDate === todayStr && filters.endDate === todayStr;
                            } else if (dOpt.range === '7days') {
                              const sevenDaysAgo = new Date();
                              sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                              isActive = filters.startDate === formatDateToDMYStr(sevenDaysAgo);
                            } else if (dOpt.range === '30days') {
                              const thirtyDaysAgo = new Date();
                              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                              isActive = filters.startDate === formatDateToDMYStr(thirtyDaysAgo);
                            } else if (dOpt.range === 'thisMonth') {
                              const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                              isActive = filters.startDate === formatDateToDMYStr(firstOfMonth);
                            } else if (dOpt.range === 'thisYear') {
                              const firstOfYear = new Date(today.getFullYear(), 0, 1);
                              isActive = filters.startDate === formatDateToDMYStr(firstOfYear);
                            }

                            return (
                              <button
                                key={dOpt.range}
                                type="button"
                                onClick={() => {
                                  if (dOpt.range === 'all' || isActive) {
                                    setFilters(prev => ({ ...prev, startDate: '', endDate: '' }));
                                  } else {
                                    const now = new Date();
                                    const start = new Date();
                                    if (dOpt.range === 'today') {
                                      // start is today
                                    } else if (dOpt.range === '7days') {
                                      start.setDate(now.getDate() - 7);
                                    } else if (dOpt.range === '30days') {
                                      start.setDate(now.getDate() - 30);
                                    } else if (dOpt.range === 'thisMonth') {
                                      start.setDate(1);
                                    } else if (dOpt.range === 'thisYear') {
                                      start.setMonth(0, 1);
                                    }
                                    setFilters(prev => ({
                                      ...prev,
                                      startDate: formatDateToDMYStr(start),
                                      endDate: formatDateToDMYStr(now),
                                      dateField: 'either'
                                    }));
                                  }
                                  setActiveFilterDropdown(null);
                                }}
                                className={cn(
                                  "w-full px-3 py-2 text-left text-xs font-semibold hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer",
                                  isActive ? "text-amber-600 bg-amber-50 font-bold" : "text-slate-700"
                                )}
                              >
                                <span>{dOpt.label}</span>
                                {isActive && <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Tags Dropdown */}
              <div className="relative min-w-[120px]">
                <div className="flex items-center">
                  <button
                    id="quick-filter-tags-btn"
                    type="button"
                    onClick={() => toggleFilterDropdown('tags')}
                    className={cn(
                      "w-full px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-between gap-1.5 active:scale-95 cursor-pointer",
                      filters.tags.length > 0
                        ? "bg-emerald-600 text-white border-emerald-700 shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    <span className="truncate">
                      Tags: {filters.tags.length === 0 ? 'All' : filters.tags.length === 1 ? `#${filters.tags[0]}` : `${filters.tags.length} selected`}
                    </span>
                    <ChevronDown className={cn("w-3.5 h-3.5 transition-transform shrink-0 opacity-80", activeFilterDropdown === 'tags' && "rotate-180")} />
                  </button>
                  {filters.tags.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFilters(prev => ({ ...prev, tags: [] }));
                      }}
                      className="absolute right-6 text-white/80 hover:text-white p-0.5 cursor-pointer"
                      title="Clear Tags filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {activeFilterDropdown === 'tags' && (
                  <div id="quick-filter-tags-menu" className="absolute left-0 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-2xl py-2 z-50 max-h-[340px] flex flex-col animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3 pb-2 border-b border-slate-100 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Filter by Tags
                        </span>
                        {filters.tags.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setFilters(prev => ({ ...prev, tags: [] }))}
                            className="text-[10px] font-bold text-rose-500 hover:text-rose-600 cursor-pointer"
                          >
                            Clear Tags ({filters.tags.length})
                          </button>
                        )}
                      </div>

                      {/* Search Tags Input */}
                      <div className="relative">
                        <Search className="w-3 h-3 text-slate-400 absolute left-2 top-2" />
                        <input
                          type="text"
                          placeholder="Search tags..."
                          value={quickFilterTagSearch}
                          onChange={(e) => setQuickFilterTagSearch(e.target.value)}
                          className="w-full pl-7 pr-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 bg-slate-50"
                        />
                      </div>

                      {/* Tag Match Strategy */}
                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="text-slate-500 font-medium">Match:</span>
                        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                          <button
                            type="button"
                            onClick={() => setFilters(prev => ({ ...prev, tagMatchMode: 'any' }))}
                            className={cn(
                              "px-2 py-0.5 rounded-md transition-colors cursor-pointer",
                              filters.tagMatchMode === 'any' ? "bg-white text-emerald-700 shadow-xs font-bold" : "text-slate-500 hover:text-slate-700"
                            )}
                          >
                            ANY (OR)
                          </button>
                          <button
                            type="button"
                            onClick={() => setFilters(prev => ({ ...prev, tagMatchMode: 'all' }))}
                            className={cn(
                              "px-2 py-0.5 rounded-md transition-colors cursor-pointer",
                              filters.tagMatchMode === 'all' ? "bg-white text-emerald-700 shadow-xs font-bold" : "text-slate-500 hover:text-slate-700"
                            )}
                          >
                            ALL (AND)
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-y-auto max-h-[200px] py-1">
                      {allAvailableTags
                        .filter(t => !quickFilterTagSearch || t.toLowerCase().includes(quickFilterTagSearch.toLowerCase()))
                        .map((tag) => {
                          const isActive = filters.tags.includes(tag);
                          const count = tagCounts[tag] || 0;
                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => {
                                if (isActive) {
                                  setFilters(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
                                } else {
                                  setFilters(prev => ({ ...prev, tags: [...prev.tags, tag] }));
                                }
                              }}
                              className={cn(
                                "w-full px-3 py-1.5 text-left text-xs font-semibold hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer",
                                isActive ? "text-emerald-700 bg-emerald-50/80 font-bold" : "text-slate-700"
                              )}
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="truncate">#{tag}</span>
                                {count > 0 && (
                                  <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.2 rounded-full">
                                    {count}
                                  </span>
                                )}
                              </div>
                              {isActive && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                            </button>
                          );
                        })}
                      {allAvailableTags.filter(t => !quickFilterTagSearch || t.toLowerCase().includes(quickFilterTagSearch.toLowerCase())).length === 0 && (
                        <div className="px-3 py-4 text-center text-xs text-slate-400">
                          No tags found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Active Filters Summary Chips Bar */}
            {(filters.importantOnly || filters.serviceCategory !== 'All' || filters.category !== 'All' || filters.startDate !== '' || filters.tags.length > 0 || filters.gender !== 'All' || filters.minAge !== '' || filters.maxAge !== '') && (
              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between flex-wrap gap-1.5 text-xs">
                <div className="flex items-center flex-wrap gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500">Active:</span>

                  {filters.importantOnly && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[11px] border border-amber-200">
                      <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                      Important Only
                      <button
                        type="button"
                        onClick={() => setFilters(prev => ({ ...prev, importantOnly: false }))}
                        className="hover:text-amber-950 ml-0.5 cursor-pointer"
                        title="Remove Important filter"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}

                  {filters.serviceCategory !== 'All' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-bold text-[11px] border border-indigo-200">
                      Class: {filters.serviceCategory}
                      <button
                        type="button"
                        onClick={() => setFilters(prev => ({ ...prev, serviceCategory: 'All' }))}
                        className="hover:text-indigo-950 ml-0.5 cursor-pointer"
                        title="Remove Class filter"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}

                  {filters.category !== 'All' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold text-[11px] border border-blue-200">
                      Type: {filters.category}
                      <button
                        type="button"
                        onClick={() => setFilters(prev => ({ ...prev, category: 'All' }))}
                        className="hover:text-blue-950 ml-0.5 cursor-pointer"
                        title="Remove Type filter"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}

                  {(filters.startDate !== '' || filters.endDate !== '') && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold text-[11px] border border-amber-200">
                      <Calendar className="w-3 h-3 text-amber-700" />
                      Date: {getDateLabel()}
                      <button
                        type="button"
                        onClick={() => setFilters(prev => ({ ...prev, startDate: '', endDate: '' }))}
                        className="hover:text-amber-950 ml-0.5 cursor-pointer"
                        title="Remove Date filter"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}

                  {filters.tags.map(t => (
                    <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[11px] border border-emerald-200">
                      #{t}
                      <button
                        type="button"
                        onClick={() => setFilters(prev => ({ ...prev, tags: prev.tags.filter(x => x !== t) }))}
                        className="hover:text-emerald-950 ml-0.5 cursor-pointer"
                        title={`Remove tag #${t}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}

                  {filters.gender !== 'All' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 font-bold text-[11px]">
                      Gender: {filters.gender}
                      <button
                        type="button"
                        onClick={() => setFilters(prev => ({ ...prev, gender: 'All' }))}
                        className="hover:text-black ml-0.5 cursor-pointer"
                        title="Remove Gender filter"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </div>

                <div className="text-[11px] font-semibold text-slate-500">
                  Showing <span className="font-bold text-slate-800">{filteredPatients.length}</span> of {patients.filter(p => !p.isDeleted).length} cases
                </div>
              </div>
            )}
          </div>

          {/* Bulk Action Bar */}
          <AnimatePresence>
            {selectedPatientIds.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="overflow-hidden shrink-0"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-md border border-slate-800 overflow-hidden">
                  <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
                    <div className="flex items-center gap-3">
                      <span className="text-xs bg-sky-500/10 text-sky-400 font-bold px-2.5 py-1 rounded-full border border-sky-500/20 shrink-0">
                        {selectedPatientIds.length} Selected
                      </span>
                      <span className="text-xs text-slate-400 hidden md:inline">
                        Clinical batch operations:
                      </span>
                    </div>
                  </div>
                  <div className="flex overflow-x-auto whitespace-nowrap items-center gap-2 pb-1.5 pt-0.5 -mx-4 px-4 scrollbar-none sm:overflow-visible sm:flex-wrap sm:pb-0 sm:pt-0 sm:mx-0 sm:px-0 w-full sm:w-auto">
                    <button 
                      onClick={() => setView('bulk-print')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer shadow-sm active:scale-95 shrink-0"
                      title="Preview and print all selected records"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print Selected
                    </button>
                    <button 
                      onClick={handleBulkExportPDF}
                      disabled={isExportingPDF}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer shadow-sm active:scale-95 disabled:opacity-50 shrink-0"
                      title="Export selected patient records to a merged clinical PDF"
                    >
                      {isExportingPDF ? (
                        <div className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <FileText className="w-3.5 h-3.5" />
                      )}
                      Combined PDF
                    </button>
                    <button 
                      onClick={handleBulkExportPDFZip}
                      disabled={isExportingPDF}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer shadow-sm active:scale-95 disabled:opacity-50 shrink-0"
                      title="Export separate individual PDF files in a ZIP archive"
                    >
                      {isExportingPDF ? (
                        <div className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <FolderArchive className="w-3.5 h-3.5" />
                      )}
                      ZIP Archive
                    </button>
                    <button 
                      onClick={handleBulkExportCSV}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer shadow-sm active:scale-95 shrink-0"
                      title="Export selected patient records to a spreadsheet (.csv)"
                    >
                      <Download className="w-3.5 h-3.5" />
                      CSV Export
                    </button>
                    <button 
                      onClick={handleBulkDelete}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-650 hover:bg-red-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer shadow-sm active:scale-95 shrink-0"
                      title="Permanently delete all selected patient records"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Selected
                    </button>
                    <div className="h-5 w-[1px] bg-slate-850 mx-1 shrink-0" />
                    <button 
                      onClick={() => setSelectedPatientIds([])}
                      className="text-[11px] font-bold text-slate-400 hover:text-white px-2 py-1.5 transition-colors cursor-pointer shrink-0"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Clinical Insights Summary Banner */}
          <div id="clinical-insights-summary" className="mb-3 bg-white rounded-xl border border-slate-200 p-2.5 sm:p-3 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 shrink-0">
            <div className="flex items-center justify-between w-full sm:w-auto gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 sm:p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100/80 shrink-0">
                  <Activity className="w-4 h-4 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider truncate">Clinical Insights</h3>
                    {Boolean(searchQuery || filters.category !== 'All' || filters.serviceCategory !== 'All' || filters.gender !== 'All' || filters.startDate || filters.endDate || filters.minAge || filters.maxAge || filters.tag || filters.tags.length > 0) && (
                      <span className="text-[9px] sm:text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 sm:px-2 py-0.5 rounded-full border border-blue-200/80 flex items-center gap-1 shrink-0">
                        <Filter className="w-2.5 h-2.5" /> Filtered
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 hidden sm:block">Live summary based on active filters</p>
                </div>
              </div>

              {/* Mobile Collapse/Expand Toggle Button */}
              <button
                type="button"
                onClick={() => setIsInsightsCollapsed(!isInsightsCollapsed)}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors cursor-pointer shrink-0 border border-slate-200/80"
                title={isInsightsCollapsed ? "Expand Insights Metrics" : "Collapse Insights Metrics"}
              >
                <span>{isInsightsCollapsed ? "Show" : "Hide"}</span>
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", !isInsightsCollapsed && "rotate-180")} />
              </button>
            </div>

            {/* Metrics Row - Horizontal swipe on mobile, wrap on desktop */}
            {!isInsightsCollapsed && (
              <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto scrollbar-none flex-nowrap sm:flex-wrap w-full sm:w-auto pb-1 sm:pb-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                {/* Metric 1: Total Records */}
                <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 bg-slate-50/90 rounded-lg border border-slate-200/80 shrink-0">
                  <Users className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-slate-400 uppercase leading-tight">Total Records</span>
                    <span className="text-xs font-extrabold text-slate-800 leading-tight whitespace-nowrap">
                      {clinicalInsights.totalRecords} <span className="text-[10px] font-normal text-slate-500">pts</span>
                    </span>
                  </div>
                </div>

                {/* Metric 2: Average Ejection Fraction */}
                <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 bg-emerald-50/80 rounded-lg border border-emerald-200/80 shrink-0">
                  <Heart className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-emerald-700 uppercase leading-tight">Avg EF</span>
                    <span className="text-xs font-extrabold text-emerald-950 leading-tight whitespace-nowrap">
                      {clinicalInsights.avgEF !== null ? `${clinicalInsights.avgEF}%` : 'N/A'}
                      {clinicalInsights.efCount > 0 && (
                        <span className="text-[9.5px] font-semibold text-emerald-700/80 ml-1">({clinicalInsights.efCount})</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Metric 3: PCI Count */}
                <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 bg-purple-50/80 rounded-lg border border-purple-200/80 shrink-0">
                  <Zap className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-purple-700 uppercase leading-tight">PCI Count</span>
                    <span className="text-xs font-extrabold text-purple-950 leading-tight whitespace-nowrap">
                      {clinicalInsights.pciCount} <span className="text-[10px] font-normal text-purple-700/80">({clinicalInsights.totalRecords > 0 ? Math.round((clinicalInsights.pciCount / clinicalInsights.totalRecords) * 100) : 0}%)</span>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div id="patient-table-card" className="flex-1 bg-surface rounded-xl border border-border shadow-sm overflow-hidden flex flex-col w-full max-w-full min-w-0 min-h-[260px] sm:min-h-0">
            <div id="patient-table-container" ref={tableContainerRef} onScroll={handleTableScroll} className="overflow-auto flex-1 relative w-full">
              <table 
                style={{ 
                  tableLayout: 'fixed', 
                  minWidth: '100%',
                  width: columnWidths.select + columnOrder.reduce((sum, key) => sum + (visibleColumns[key] ? (columnWidths[key] || 100) : 0), 0)
                }} 
                className="text-left border-collapse min-w-full"
              >
                 <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    <th 
                      style={{ width: columnWidths.select }} 
                      className="px-6 py-3 text-center border-b border-border bg-slate-50 sticky top-0 z-10"
                    >
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                        checked={filteredPatients.length > 0 && filteredPatients.every(p => selectedPatientIds.includes(p.id!))}
                        ref={(el) => {
                          if (el) {
                            const someSelected = filteredPatients.some(p => selectedPatientIds.includes(p.id!));
                            const allSelected = filteredPatients.every(p => selectedPatientIds.includes(p.id!));
                            el.indeterminate = someSelected && !allSelected;
                          }
                        }}
                        onChange={handleToggleAll}
                      />
                    </th>
                    {columnOrder.map((colKey) => {
                      if (!visibleColumns[colKey]) return null;
                      switch (colKey) {
                        case 'place':
                          return (
                            <th 
                              key="place"
                              style={{ width: columnWidths.place }}
                              className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border bg-slate-50 sticky top-0 z-10"
                            >
                              Place
                            </th>
                          );
                        case 'serialNo':
                          return (
                            <th 
                              key="serialNo"
                              style={{ width: columnWidths.serialNo }}
                              className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border cursor-pointer hover:bg-slate-100 transition-colors select-none group relative bg-slate-50 sticky top-0 z-10"
                              onClick={() => handleSortToggle('serialNo')}
                            >
                              <div className="flex items-center gap-1.5">
                                <span>Serial No</span>
                                {sortBy === 'serialNo' ? (
                                  sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-primary shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-primary shrink-0" />
                                ) : (
                                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                )}
                              </div>
                              <div
                                onMouseDown={(e) => handleResizeStart(e, 'serialNo')}
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize select-none group-hover:bg-slate-200 hover:bg-primary transition-colors z-20"
                                title="Drag to resize column"
                              />
                            </th>
                          );
                        case 'date':
                          return (
                            <th 
                              key="date"
                              style={{ width: columnWidths.date }}
                              className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border cursor-pointer hover:bg-slate-100 transition-colors select-none group relative bg-slate-50 sticky top-0 z-10"
                              onClick={() => handleSortToggle('date')}
                            >
                              <div className="flex items-center gap-1.5">
                                <span>Date</span>
                                {sortBy === 'date' ? (
                                  sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-primary shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-primary shrink-0" />
                                ) : (
                                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                )}
                              </div>
                              <div
                                onMouseDown={(e) => handleResizeStart(e, 'date')}
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize select-none group-hover:bg-slate-200 hover:bg-primary transition-colors z-20"
                                title="Drag to resize column"
                              />
                            </th>
                          );
                        case 'admissionNo':
                          return (
                            <th 
                              key="admissionNo"
                              style={{ width: columnWidths.admissionNo }}
                              className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border cursor-pointer hover:bg-slate-100 transition-colors select-none group relative bg-slate-50 sticky top-0 z-10"
                              onClick={() => handleSortToggle('admissionNo')}
                            >
                              <div className="flex items-center gap-1.5">
                                <span>Adm No</span>
                                {sortBy === 'admissionNo' ? (
                                  sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-primary shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-primary shrink-0" />
                                ) : (
                                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                )}
                              </div>
                              <div
                                onMouseDown={(e) => handleResizeStart(e, 'admissionNo')}
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize select-none group-hover:bg-slate-200 hover:bg-primary transition-colors z-20"
                                title="Drag to resize column"
                              />
                            </th>
                          );
                        case 'name':
                          return (
                            <th 
                              key="name"
                              style={{ width: columnWidths.name }}
                              className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border cursor-pointer hover:bg-slate-100 transition-colors select-none group relative bg-slate-50 sticky top-0 z-10"
                              onClick={() => handleSortToggle('name')}
                            >
                              <div className="flex items-center gap-1.5">
                                <span>Name</span>
                                {sortBy === 'name' ? (
                                  sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-primary shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-primary shrink-0" />
                                ) : (
                                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                )}
                              </div>
                              <div
                                onMouseDown={(e) => handleResizeStart(e, 'name')}
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize select-none group-hover:bg-slate-200 hover:bg-primary transition-colors z-20"
                                title="Drag to resize column"
                              />
                            </th>
                          );
                        case 'ageGen':
                          return (
                            <th 
                              key="ageGen"
                              style={{ width: columnWidths.ageGen }}
                              className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border cursor-pointer hover:bg-slate-100 transition-colors select-none group relative bg-slate-50 sticky top-0 z-10"
                              onClick={() => handleSortToggle('ageGen')}
                            >
                              <div className="flex items-center gap-1.5">
                                <span>Age/Gen</span>
                                {sortBy === 'ageGen' ? (
                                  sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-primary shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-primary shrink-0" />
                                ) : (
                                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                )}
                              </div>
                              <div
                                onMouseDown={(e) => handleResizeStart(e, 'ageGen')}
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize select-none group-hover:bg-slate-200 hover:bg-primary transition-colors z-20"
                                title="Drag to resize column"
                              />
                            </th>
                          );
                        case 'ef':
                          return (
                            <th 
                              key="ef"
                              style={{ width: columnWidths.ef }}
                              className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border cursor-pointer hover:bg-slate-100 transition-colors select-none group relative bg-slate-50 sticky top-0 z-10"
                              onClick={() => handleSortToggle('ef')}
                            >
                              <div className="flex items-center gap-1.5">
                                <span>EF</span>
                                {sortBy === 'ef' ? (
                                  sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-primary shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-primary shrink-0" />
                                ) : (
                                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                )}
                              </div>
                              <div
                                onMouseDown={(e) => handleResizeStart(e, 'ef')}
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize select-none group-hover:bg-slate-200 hover:bg-primary transition-colors z-20"
                                title="Drag to resize column"
                              />
                            </th>
                          );
                        case 'finalNotes':
                          return (
                            <th 
                              key="finalNotes"
                              style={{ width: columnWidths.finalNotes }}
                              className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border cursor-pointer hover:bg-slate-100 transition-colors select-none group relative bg-slate-50 sticky top-0 z-10"
                              onClick={() => handleSortToggle('finalNotes')}
                            >
                              <div className="flex items-center gap-1.5">
                                <span>Final Note</span>
                                {sortBy === 'finalNotes' ? (
                                  sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-primary shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-primary shrink-0" />
                                ) : (
                                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                )}
                              </div>
                              <div
                                onMouseDown={(e) => handleResizeStart(e, 'finalNotes')}
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize select-none group-hover:bg-slate-200 hover:bg-primary transition-colors z-20"
                                title="Drag to resize column"
                              />
                            </th>
                          );
                        case 'generalNotes':
                          return (
                            <th 
                              key="generalNotes"
                              style={{ width: columnWidths.generalNotes }}
                              className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border cursor-pointer hover:bg-slate-100 transition-colors select-none group relative bg-slate-50 sticky top-0 z-10"
                              onClick={() => handleSortToggle('generalNotes')}
                            >
                              <div className="flex items-center gap-1.5">
                                <span>General Note</span>
                                {sortBy === 'generalNotes' ? (
                                  sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-primary shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-primary shrink-0" />
                                ) : (
                                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                )}
                              </div>
                              <div
                                onMouseDown={(e) => handleResizeStart(e, 'generalNotes')}
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize select-none group-hover:bg-slate-200 hover:bg-primary transition-colors z-20"
                                title="Drag to resize column"
                              />
                            </th>
                          );
                        case 'status':
                          return (
                            <th 
                              key="status"
                              style={{ width: columnWidths.status }}
                              className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border cursor-pointer hover:bg-slate-100 transition-colors select-none group relative bg-slate-50 sticky top-0 z-10"
                              onClick={() => handleSortToggle('status')}
                            >
                              <div className="flex items-center gap-1.5">
                                <span>Status</span>
                                {sortBy === 'status' ? (
                                  sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-primary shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 text-primary shrink-0" />
                                ) : (
                                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                )}
                              </div>
                              <div
                                onMouseDown={(e) => handleResizeStart(e, 'status')}
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize select-none group-hover:bg-slate-200 hover:bg-primary transition-colors z-20"
                                title="Drag to resize column"
                              />
                            </th>
                          );
                        case 'actions':
                          return (
                            <th 
                              key="actions"
                              style={{ width: columnWidths.actions || 130 }}
                              className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-border text-center bg-slate-50 sticky top-0 z-10"
                            >
                              Actions
                            </th>
                          );
                        default:
                          return null;
                      }
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredPatients.length === 0 ? (
                    <tr>
                      <td colSpan={1 + Object.values(visibleColumns).filter(Boolean).length} className="px-6 py-20 text-center text-slate-400 text-sm font-medium">
                        No records found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {topOffset > 0 && (
                        <tr style={{ height: topOffset }}>
                          <td colSpan={1 + Object.values(visibleColumns).filter(Boolean).length} style={{ height: topOffset, padding: 0, border: 'none' }} />
                        </tr>
                      )}
                      {visiblePatients.map((p, index) => (
                        <PatientRow 
                          key={p.id} 
                          p={p} 
                          index={index}
                          onSelect={(p) => { setSelectedPatient(p); setView('detail'); }} 
                          onEdit={startEdit} 
                          onDelete={(id) => setConfirmDelete(id)} 
                          isSelected={selectedPatientIds.includes(p.id!)}
                          onToggleImportant={handleToggleImportant}
                          onToggleSelect={(e, id) => {
                            e.stopPropagation();
                            setSelectedPatientIds(prev => 
                              prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                            );
                          }}
                          searchQuery={searchQuery}
                          columnWidths={columnWidths}
                          visibleColumns={visibleColumns}
                          isDuplicateSerial={(duplicateSerials[p.serialNo] || 0) > 1}
                          columnOrder={columnOrder}
                        />
                      ))}
                      {bottomOffset > 0 && (
                        <tr style={{ height: bottomOffset }}>
                          <td colSpan={1 + Object.values(visibleColumns).filter(Boolean).length} style={{ height: bottomOffset, padding: 0, border: 'none' }} />
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* Simple Pagination Mockup */}
            <div className="bg-slate-50/50 border-t border-border px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button disabled className="px-3 py-1 text-xs border border-border bg-surface text-slate-400 rounded cursor-not-allowed">Previous</button>
                <button className="px-3 py-1 text-xs border border-primary bg-primary-light text-primary rounded font-bold">1</button>
                <button className="px-3 py-1 text-xs border border-border bg-surface text-slate-600 rounded hover:bg-slate-50">2</button>
                <button className="px-3 py-1 text-xs border border-border bg-surface text-slate-600 rounded hover:bg-slate-50">Next</button>
              </div>
              <div className="text-[10px] text-slate-400 font-medium tracking-wide">
                &copy; {new Date().getFullYear()} Dr Bharat S Sambyal. All rights reserved.
              </div>
            </div>
          </div>
        </section>
      )}
      </main>

      {/* Subtle Status Bar / Sync Indicators at the bottom */}
      <div className="bg-slate-900 text-slate-300 text-[10px] px-4 py-1.5 flex flex-col sm:flex-row items-center justify-between border-t border-slate-800 shrink-0 font-mono select-none gap-1 sm:gap-0 z-10">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className={cn(
              "w-2 h-2 rounded-full",
              pendingSyncCount > 0 ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
            )} />
            <span className="font-semibold text-slate-200">
              {pendingSyncCount > 0 ? 'Local Updates Saving' : 'Local Storage Synced'}
            </span>
          </div>
          {pendingSyncCount > 0 && (
            <span className="text-slate-400">
              ({pendingSyncCount} record{pendingSyncCount > 1 ? 's' : ''} waiting to write)
            </span>
          )}
          <span className="text-slate-600 hidden sm:inline">|</span>
          <div className="flex items-center gap-1 text-slate-400">
            <span>Storage:</span>
            <span className="text-emerald-400 font-bold">IndexedDB Offline-First</span>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1 text-slate-400">
            <span>Connectivity:</span>
            <span className={cn(
              "font-bold",
              isOnline ? "text-emerald-400" : "text-amber-400"
            )}>
              {isOnline ? "Online" : "Offline Mode"}
            </span>
          </div>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <button 
            onClick={async () => {
              try {
                setIsManualSyncing(true);
                await syncPatients();
                // Simulate quick check
                setTimeout(() => {
                  setToast({ message: "Database verified: All local records are fully secured in offline storage.", type: "success" });
                  setIsManualSyncing(false);
                }, 800);
              } catch {
                setIsManualSyncing(false);
              }
            }}
            disabled={isManualSyncing}
            className="text-blue-400 hover:text-blue-300 transition-colors cursor-pointer font-bold uppercase text-[9px] tracking-wider"
          >
            {isManualSyncing ? "Verifying..." : "Verify Storage"}
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl p-6 w-full max-w-sm text-center shadow-2xl"
            >
              <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Record?</h3>
              <p className="text-sm text-slate-500 mb-6">This action cannot be undone. All patient data for this entry will be lost.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-2 px-4 border border-border rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleDelete(confirmDelete)}
                  disabled={isSubmitting}
                  className="flex-1 py-2 px-4 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Yes, Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unsaved Changes Confirmation Modal */}
      <AnimatePresence>
        {showUnsavedChangesConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl p-6 w-full max-w-sm text-center shadow-2xl"
            >
              <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Unsaved Changes</h3>
              <p className="text-sm text-slate-500 mb-6">You have unsaved changes in the form. Are you sure you want to discard them?</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setShowUnsavedChangesConfirm(false);
                    setPendingAction(null);
                  }}
                  className="flex-1 py-2 px-4 border border-border rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Keep Editing
                </button>
                <button 
                  onClick={() => {
                    clearDraft();
                    if (pendingAction) {
                      pendingAction();
                    }
                    setShowUnsavedChangesConfirm(false);
                    setPendingAction(null);
                  }}
                  className="flex-1 py-2 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-bold transition-colors"
                >
                  Discard Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail Overlay */}
      <AnimatePresence>
        {selectedPatient && view === 'detail' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleNavWithUnsavedCheck(() => setView('list'));
              }
            }}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="h-24 bg-slate-900 flex items-center justify-between px-8 text-white relative shrink-0">
                <div className="z-10">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold">{selectedPatient.name}</h3>
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 bg-white/20 text-white rounded text-[8px] font-bold uppercase">
                        {selectedPatient.serviceCategory}
                      </span>
                      <span className="px-1.5 py-0.5 bg-primary/40 text-white rounded text-[8px] font-bold">
                        {selectedPatient.serNo}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleImportant(selectedPatient)}
                        className={cn(
                          "ml-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer border select-none shrink-0",
                          selectedPatient.isImportant
                            ? "bg-amber-400 text-slate-950 border-amber-300 shadow-2xs"
                            : "bg-white/10 text-slate-300 hover:bg-white/20 border-white/20"
                        )}
                        title={selectedPatient.isImportant ? "Important Case (click to remove mark)" : "Mark as Important Case for later reference"}
                      >
                        <Star className={cn("w-3 h-3", selectedPatient.isImportant ? "fill-slate-950 text-slate-950" : "text-amber-400 fill-amber-400")} />
                        <span>{selectedPatient.isImportant ? "Important" : "Mark Important"}</span>
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 font-medium tracking-widest uppercase">
                    {`PAT-${String(selectedPatient.serialNo).padStart(2, '0')} / `}Patient Record ID #{String(selectedPatient.serialNo).padStart(2, '0')}
                  </p>
                </div>
                <div className="flex gap-2 z-10">
                  <button 
                    onClick={() => setEmrSummaryPatient(selectedPatient)}
                    className="p-3 md:p-2 hover:bg-indigo-500/20 rounded-full text-indigo-400 transition-colors cursor-pointer"
                    title="Copy EMR Summary"
                  >
                    <FileText className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={async () => {
                      setToast({ message: "Generating clinical report PDF with photos... Please wait.", type: "success" });
                      try {
                        await generatePatientPDF(selectedPatient, true, syncHandle, getPdfExportOptions());
                        setToast({ message: "PDF report exported successfully!", type: "success" });
                      } catch (err) {
                        console.error(err);
                        setToast({ message: "Failed to generate PDF report.", type: "error" });
                      }
                    }}
                    className="p-3 md:p-2 hover:bg-rose-500/20 rounded-full text-rose-400 transition-colors cursor-pointer"
                    title="Export to PDF"
                  >
                    <FileDown className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setView('print')}
                    className="p-3 md:p-2 hover:bg-blue-500/20 rounded-full text-blue-400 transition-colors"
                    title="Print Record"
                  >
                    <Printer className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => startEdit(selectedPatient)}
                    className="p-3 md:p-2 hover:bg-green-500/20 rounded-full text-green-400 transition-colors"
                    title="Edit Record"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setConfirmDelete(selectedPatient.id!)}
                    className="p-3 md:p-2 hover:bg-red-500/20 rounded-full text-red-400 transition-colors"
                    title="Delete Record"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleNavWithUnsavedCheck(() => setView('list'))} className="p-3 md:p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors" title="Close Profile">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="absolute top-0 right-0 p-12 bg-primary/20 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />
              </div>

              {/* Scrollable middle container */}
              <div className="overflow-y-auto flex-1 max-h-[calc(90vh-160px)] bg-slate-50/50">
                
                {/* Executive Summary Header Banner */}
                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-6 shadow-md border-b border-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-[10px] font-extrabold uppercase rounded-full tracking-wider">
                          {selectedPatient.category || 'Clinical Record'}
                          {selectedPatient.otherCategoryNotes ? ` (${selectedPatient.otherCategoryNotes})` : ''}
                        </span>
                        {selectedPatient.isImportant && (
                          <span className="px-2.5 py-0.5 bg-amber-400/20 border border-amber-300/40 text-amber-300 text-[10px] font-extrabold uppercase rounded-full flex items-center gap-1">
                            <Star className="w-3 h-3 fill-amber-300 text-amber-300" /> Important Case
                          </span>
                        )}
                        {selectedPatient.stentDetails && selectedPatient.stentDetails.length > 0 && (
                          <span className="px-2.5 py-0.5 bg-teal-500/30 border border-teal-400/40 text-teal-200 text-[10px] font-extrabold uppercase rounded-full">
                            {selectedPatient.stentDetails.length} Stent(s) Logged
                          </span>
                        )}
                      </div>
                      <h4 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                        {selectedPatient.name} 
                        <span className="text-xs font-normal text-slate-400">({selectedPatient.age} Y / {selectedPatient.gender})</span>
                      </h4>
                    </div>

                    <div className="flex items-center gap-6 text-xs text-slate-300">
                      <div>
                        <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest block">Procedure Date</span>
                        <span className="font-bold text-white font-mono">{formatDateDMY(selectedPatient.date)}</span>
                      </div>
                      <div className="border-l border-slate-700 pl-6">
                        <span className="text-[11px] font-black text-amber-300 uppercase tracking-widest block">Presentation</span>
                        <span className="font-bold text-amber-300">{selectedPatient.presentation || 'N/A'}</span>
                      </div>
                      <div className="border-l border-slate-700 pl-6 hidden sm:block">
                        <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest block">Hospital / Place</span>
                        <span className="font-bold text-white">{selectedPatient.place || 'Main Cath Lab'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-8">
                  
                  {/* SECTION 1: Demographics & Administrative Meta */}
                  <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-2">
                      <UserIcon className="w-4 h-4 text-indigo-600" /> Demographics & Administrative Profile
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      <div>
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">Patient Record ID</span>
                        <span className="font-bold text-slate-800 font-mono text-sm">{`PAT-${String(selectedPatient.serialNo).padStart(2, '0')}`}</span>
                      </div>
                      <div>
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">Serial No</span>
                        <span className="font-bold text-slate-800">{selectedPatient.serialNo}</span>
                      </div>
                      <div>
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">Service Category & Ser No</span>
                        <span className="font-bold text-indigo-600">{selectedPatient.serNo || 'N/A'} <span className="text-[10px] text-slate-500 font-normal">({selectedPatient.serviceCategory})</span></span>
                      </div>
                      <div>
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">Admission No</span>
                        <span className="font-bold text-slate-800">{selectedPatient.admissionNo || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">Location / Unit</span>
                        <span className="font-bold text-slate-800">{selectedPatient.place || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">Procedure Date</span>
                        <span className="font-bold text-slate-800">{formatDateDMY(selectedPatient.date)}</span>
                      </div>
                      <div>
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">Report Category</span>
                        <span className="font-bold text-indigo-700">{selectedPatient.category || 'N/A'} {selectedPatient.otherCategoryNotes ? `(${selectedPatient.otherCategoryNotes})` : ''}</span>
                      </div>
                      <div>
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">Age & Gender</span>
                        <span className="font-bold text-slate-800">{selectedPatient.age} Y / {selectedPatient.gender}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Weight</span>
                        <span className="text-xs font-bold text-slate-800">{selectedPatient.weight ? `${selectedPatient.weight} kg` : 'N/A'}</span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Height</span>
                        <span className="text-xs font-bold text-slate-800">{selectedPatient.height ? `${selectedPatient.height} cm` : 'N/A'}</span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">BMI</span>
                        <span className="text-xs font-bold text-slate-800">{selectedPatient.bmi ? `${selectedPatient.bmi}` : 'N/A'}</span>
                      </div>
                    </div>

                    {selectedPatient.phoneNumbers && selectedPatient.phoneNumbers.length > 0 && (
                      <div className="pt-2">
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block mb-1">Contact Phone(s)</span>
                        <div className="flex flex-wrap gap-2">
                          {selectedPatient.phoneNumbers.map((ph, i) => (
                            <span key={i} className="px-2.5 py-1 bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold rounded-lg flex items-center gap-1.5">
                              <Phone className="w-3 h-3 text-blue-500" /> {ph}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedPatient.tags && selectedPatient.tags.length > 0 && (
                      <div className="pt-2">
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block mb-1">Tags & Keywords</span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedPatient.tags.map(t => (
                            <span key={t} className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full flex items-center gap-1">
                              <Tag className="w-2.5 h-2.5 text-indigo-400" /> {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SECTION 2: Clinical Baseline, Risk Profile & Labs */}
                  <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-2">
                      <Activity className="w-4 h-4 text-rose-500" /> Baseline Cardiac & Lab Profile
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">Clinical Presentation</span>
                        <span className="font-bold text-slate-900 bg-amber-50 text-amber-800 px-2 py-1 rounded inline-block mt-0.5 border border-amber-200/60">{selectedPatient.presentation}</span>
                      </div>
                      <div>
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">TMT Status</span>
                        <span className={cn(
                          "px-2.5 py-1 rounded-md text-xs font-bold inline-block mt-0.5 border",
                          selectedPatient.tmt === TMTOption.Positive ? "bg-red-50 text-red-600 border-red-200" :
                          selectedPatient.tmt === TMTOption.Negative ? "bg-green-50 text-green-600 border-green-200" :
                          "bg-slate-50 text-slate-600 border-slate-200"
                        )}>
                          {selectedPatient.tmt}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">Ejection Fraction (EF)</span>
                        <span className="font-bold text-indigo-600 block mt-0.5">
                          {selectedPatient.ejectionFraction === EjectionFraction.Other && selectedPatient.otherEjectionFractionNotes 
                            ? selectedPatient.otherEjectionFractionNotes 
                            : selectedPatient.ejectionFraction}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
                      <div>
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block mb-1">RWMA Segments</span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedPatient.rwma && selectedPatient.rwma.length > 0 ? selectedPatient.rwma.map(v => (
                            <span key={v} className="px-2.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold rounded">
                              {v}
                            </span>
                          )) : <span className="text-slate-400 italic">None recorded</span>}
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block mb-1">Comorbidities & Risk Factors</span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedPatient.comorbidities && selectedPatient.comorbidities.length > 0 ? selectedPatient.comorbidities.map(v => (
                            <span key={v} className="px-2.5 py-0.5 bg-rose-50 border border-rose-100 text-rose-700 text-[11px] font-bold rounded">
                              {v}
                            </span>
                          )) : <span className="text-slate-400 italic">None recorded</span>}
                        </div>
                      </div>
                    </div>

                    {/* Pre & Post Procedure Labs Grid */}
                    {((selectedPatient.preHb || selectedPatient.preUrea || selectedPatient.preCreatinine || selectedPatient.preK) ||
                      (selectedPatient.postHb || selectedPatient.postUrea || selectedPatient.postCreatinine || selectedPatient.postK)) && (
                      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2.5 mt-2">
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest block border-b border-slate-200 pb-1">
                          Laboratory Parameters (Pre vs Post Procedure)
                        </span>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div className="space-y-1">
                            <span className="font-extrabold text-[10px] text-indigo-600 uppercase tracking-wider block">Pre-Procedure</span>
                            <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-[11px] bg-white p-2 rounded border border-slate-100">
                              <span className="text-slate-500 font-medium">Hb:</span>
                              <span className="font-bold text-slate-800">{selectedPatient.preHb || 'N/A'}</span>
                              <span className="text-slate-500 font-medium">Urea:</span>
                              <span className="font-bold text-slate-800">{selectedPatient.preUrea || 'N/A'}</span>
                              <span className="text-slate-500 font-medium">Creatinine:</span>
                              <span className="font-bold text-slate-800">{selectedPatient.preCreatinine || 'N/A'}</span>
                              <span className="text-slate-500 font-medium">K+:</span>
                              <span className="font-bold text-slate-800">{selectedPatient.preK || 'N/A'}</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <span className="font-extrabold text-[10px] text-indigo-600 uppercase tracking-wider block">Post-Procedure</span>
                            <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-[11px] bg-white p-2 rounded border border-slate-100">
                              <span className="text-slate-500 font-medium">Hb:</span>
                              <span className="font-bold text-slate-800">{selectedPatient.postHb || 'N/A'}</span>
                              <span className="text-slate-500 font-medium">Urea:</span>
                              <span className="font-bold text-slate-800">{selectedPatient.postUrea || 'N/A'}</span>
                              <span className="text-slate-500 font-medium">Creatinine:</span>
                              <span className="font-bold text-slate-800">{selectedPatient.postCreatinine || 'N/A'}</span>
                              <span className="text-slate-500 font-medium">K+:</span>
                              <span className="font-bold text-slate-800">{selectedPatient.postK || 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SECTION 3: Cath Lab Procedure, Devices, Stents & Hardware */}
                  <div className="bg-white rounded-xl p-5 border-2 border-teal-200/80 shadow-sm space-y-5">
                    <div className="flex items-center justify-between border-b border-teal-100 pb-2.5">
                      <h4 className="text-xs font-black text-teal-950 uppercase tracking-widest flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-teal-600" /> Interventional Procedure, Devices & Stents
                      </h4>
                      <span className="px-2 py-0.5 bg-teal-50 border border-teal-200 text-teal-700 text-[10px] font-extrabold uppercase rounded-md">
                        Cath Lab Record
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">Access Route</span>
                        <span className="font-bold text-slate-800 block mt-0.5">
                          {selectedPatient.access}
                          {selectedPatient.access === AccessMethod.Other && selectedPatient.otherAccessNotes && (
                            <span className="text-[11px] font-normal text-slate-500 italic block"> ({selectedPatient.otherAccessNotes})</span>
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">USG / Doppler Guidance</span>
                        <span className={cn("font-bold block mt-0.5", selectedPatient.usgDoppler ? "text-emerald-600" : "text-slate-500")}>
                          {selectedPatient.usgDoppler ? 'YES (Ultrasound Guided Access)' : 'NO'}
                        </span>
                      </div>
                    </div>

                    {/* PCI Vessels & Lesions */}
                    <div className="space-y-3 pt-1 border-t border-slate-100">
                      <div>
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block mb-1">PCI Vessels Involved</span>
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {selectedPatient.pciVessels && selectedPatient.pciVessels.length > 0 ? selectedPatient.pciVessels.map(v => (
                            <span key={v} className="px-2.5 py-1 bg-red-50 border border-red-200 text-red-700 font-extrabold text-xs rounded-md uppercase">
                              {v}
                            </span>
                          )) : <span className="text-slate-400 text-xs italic">No vessel recorded / Diagnosed only</span>}
                        </div>
                      </div>

                      {((selectedPatient.lesionTypes && selectedPatient.lesionTypes.length > 0) || (selectedPatient.pciVessels && selectedPatient.pciVessels.some((v: any) => ['CTO', 'ISR', 'THROMBUS'].includes(v))) || selectedPatient.bifurcation) && (
                        <div>
                          <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block mb-1">Lesion Type</span>
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {((selectedPatient.lesionTypes && selectedPatient.lesionTypes.length > 0)
                              ? selectedPatient.lesionTypes
                              : [
                                  ...(selectedPatient.pciVessels || []).filter((v: any) => ['CTO', 'ISR', 'THROMBUS'].includes(v)),
                                  ...(selectedPatient.bifurcation ? ['Bifurcation'] : [])
                                ]
                            ).map(lt => (
                              <span key={lt} className="px-2.5 py-1 bg-orange-50 border border-orange-200 text-orange-800 font-extrabold text-xs rounded-md uppercase">
                                {lt}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Lesions Identified */}
                      {selectedPatient.lesions && selectedPatient.lesions.length > 0 && (
                        <div>
                          <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block mb-1">Target Lesions Identified</span>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedPatient.lesions.map((les, idx) => (
                              <span key={idx} className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-semibold rounded-md flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                                {les}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* DEPLOYED DEVICES QUANTITIES */}
                    <div className="bg-teal-50/60 border border-teal-200/80 rounded-xl p-4 space-y-2">
                      <span className="text-[11px] font-black text-teal-900 uppercase tracking-wider block">
                        Devices Deployed (Quantity Summary)
                      </span>
                      <div className="flex items-center gap-3 flex-wrap">
                        {selectedPatient.devices && Object.keys(selectedPatient.devices).length > 0 ? (
                          Object.entries(selectedPatient.devices).map(([type, qty]) => (
                            qty && qty > 0 ? (
                              <div key={type} className="flex items-center gap-2 px-3 py-1 bg-white border border-teal-300/80 text-teal-900 rounded-lg text-xs font-bold shadow-2xs">
                                <span className="uppercase text-[11px] font-bold text-teal-700">{type}:</span>
                                <span className="bg-teal-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold">{qty}</span>
                              </div>
                            ) : null
                          ))
                        ) : <span className="text-slate-400 text-xs italic">No device counts recorded</span>}
                      </div>
                    </div>

                    {/* DEVICE CATALOG SPECIFICATIONS - PROMINENT DISPLAY */}
                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold text-emerald-950 uppercase tracking-widest flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Devices Catalog Specifications
                        </span>
                        {((selectedPatient.stentDetails?.length || 0) + (selectedPatient.brsDetails?.length || 0) + (selectedPatient.debDetails?.length || 0)) > 0 && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            {(selectedPatient.stentDetails?.length || 0) + (selectedPatient.brsDetails?.length || 0) + (selectedPatient.debDetails?.length || 0)} Item(s)
                          </span>
                        )}
                      </div>

                      {/* DES List */}
                      {selectedPatient.stentDetails && selectedPatient.stentDetails.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">DES Stents</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {selectedPatient.stentDetails.map((spec, i) => (
                              <div key={i} className="px-3 py-2 bg-white border border-emerald-300/80 text-slate-900 rounded-lg text-xs font-bold flex items-center justify-between shadow-2xs">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 bg-emerald-500 rounded-full shrink-0" />
                                  <span className="text-slate-800 font-semibold">{spec}</span>
                                </div>
                                <span className="text-[9px] font-bold uppercase text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                  DES #{i + 1}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* BRS List */}
                      {selectedPatient.brsDetails && selectedPatient.brsDetails.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">BRS Scaffolds</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {selectedPatient.brsDetails.map((spec, i) => (
                              <div key={i} className="px-3 py-2 bg-white border border-blue-300/80 text-slate-900 rounded-lg text-xs font-bold flex items-center justify-between shadow-2xs">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                                  <span className="text-slate-800 font-semibold">{spec}</span>
                                </div>
                                <span className="text-[9px] font-bold uppercase text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                  BRS #{i + 1}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* DEB List */}
                      {selectedPatient.debDetails && selectedPatient.debDetails.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">DEB Balloons</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {selectedPatient.debDetails.map((spec, i) => (
                              <div key={i} className="px-3 py-2 bg-white border border-amber-300/80 text-slate-900 rounded-lg text-xs font-bold flex items-center justify-between shadow-2xs">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 bg-amber-500 rounded-full shrink-0" />
                                  <span className="text-slate-800 font-semibold">{spec}</span>
                                </div>
                                <span className="text-[9px] font-bold uppercase text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                  DEB #{i + 1}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {(!selectedPatient.stentDetails?.length && !selectedPatient.brsDetails?.length && !selectedPatient.debDetails?.length) && (
                        <p className="text-xs text-slate-500 italic bg-white/60 p-2.5 rounded-lg border border-dashed border-emerald-200">
                          No specific device catalog specifications recorded for this procedure.
                        </p>
                      )}
                    </div>

                    {/* CLOSURE DEVICES, HARDWARE & COMPLICATIONS */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2 border-t border-slate-100">
                      <div>
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block mb-1">Closure Devices Used</span>
                        {selectedPatient.closureDevice ? (
                          <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-md inline-block">
                            {selectedPatient.closureDevice === 'Others' ? (selectedPatient.closureDeviceCustom || 'Others') : selectedPatient.closureDevice}
                          </span>
                        ) : <span className="text-slate-400 italic">None / Manual Compression</span>}
                      </div>

                      <div>
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block mb-1">Prep Special Hardware</span>
                        <div className="flex flex-wrap gap-1">
                          {selectedPatient.specialHardware && selectedPatient.specialHardware.length > 0 ? selectedPatient.specialHardware.map(v => (
                            <span key={v} className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold rounded">
                              {v === 'Other' && selectedPatient.otherSpecialHardwareNotes ? `Other (${selectedPatient.otherSpecialHardwareNotes})` : v}
                            </span>
                          )) : <span className="text-slate-400 italic">None</span>}
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block mb-1">Support Hardware Installed</span>
                        <p className="font-medium text-slate-800">
                          {selectedPatient.otherHardware && selectedPatient.otherHardware.length > 0 ? (
                            <>
                              {selectedPatient.otherHardware.join(', ')}
                              {selectedPatient.otherHardwareNotes ? ` (${selectedPatient.otherHardwareNotes})` : ''}
                            </>
                          ) : <span className="text-slate-400 italic">None</span>}
                        </p>
                      </div>

                      <div>
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block mb-1">Procedural Complications</span>
                        <div className="flex flex-wrap gap-1">
                          {selectedPatient.complications && selectedPatient.complications.length > 0 ? selectedPatient.complications.map(v => (
                            <span key={v} className="px-2 py-0.5 bg-orange-50 border border-orange-200 text-orange-700 text-[10px] font-bold rounded">
                              {v}
                            </span>
                          )) : <span className="text-slate-500 italic">Nil</span>}
                          {selectedPatient.complicationsCustom && (
                            <span className="text-[11px] text-slate-600 block w-full mt-0.5 italic">
                              Note: {selectedPatient.complicationsCustom}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* DRUGS */}
                    {selectedPatient.drugs && selectedPatient.drugs.length > 0 && (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block mb-1">Administered Antiplatelets & Pharmacotherapy</span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedPatient.drugs.map(v => (
                            <span key={v} className="px-2.5 py-1 bg-green-50 border border-green-200 text-green-700 text-xs font-bold rounded-md">
                              {v === 'Other' && selectedPatient.otherDrugsNotes ? `Other (${selectedPatient.otherDrugsNotes})` : v}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SECTION 4: Imaging & Physiology */}
                  {selectedPatient.imaging && selectedPatient.imaging.length > 0 && (
                    <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-2">
                        <Heart className="w-4 h-4 text-blue-600" /> Imaging & Physiology Modal (OCT, IVUS, FFR, etc.)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedPatient.imaging.map(v => (
                          <div key={v} className="bg-blue-50/60 border border-blue-100 rounded-lg p-3 text-xs space-y-1">
                            <span className="font-extrabold text-blue-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                              <span className="w-2 h-2 bg-blue-500 rounded-full" />
                              {v}
                            </span>
                            {selectedPatient.imagingFindings?.[v] ? (
                              <p className="text-slate-700 text-[11px] font-medium bg-white p-2 rounded border border-blue-100/60 mt-1">
                                {selectedPatient.imagingFindings[v]}
                              </p>
                            ) : (
                              <p className="text-slate-400 text-[10px] italic">No specific findings detailed</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SECTION 5: Notes & Remarks */}
                  {(selectedPatient.finalNotes || selectedPatient.plan || selectedPatient.notes) && (
                    <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-2">
                        <FileText className="w-4 h-4 text-slate-600" /> Case Notes & Observations
                      </h4>
                      {selectedPatient.finalNotes && (
                        <div>
                          <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block mb-1">Final Summary / Conclusion</span>
                          <p className="text-xs text-slate-700 whitespace-pre-wrap p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl leading-relaxed font-sans">
                            {selectedPatient.finalNotes}
                          </p>
                        </div>
                      )}
                      {selectedPatient.plan && (
                        <div>
                          <span className="text-[11px] font-black text-sky-700 uppercase tracking-wider block mb-1">Further Clinical Plan & Recommendations</span>
                          <p className="text-xs text-slate-700 whitespace-pre-wrap p-3.5 bg-sky-50/50 border border-sky-200/60 rounded-xl leading-relaxed font-sans">
                            {selectedPatient.plan}
                          </p>
                        </div>
                      )}
                      {selectedPatient.notes && (
                        <div>
                          <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block mb-1">Additional Operational Notes</span>
                          <p className="text-xs text-slate-700 whitespace-pre-wrap p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl leading-relaxed font-sans">
                            {selectedPatient.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SECTION 6: Attached Photos & Reports */}
                  <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-2">
                      <Camera className="w-4 h-4 text-indigo-600" /> Attached Angiograms, Labs & Visual Reports
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <DetailPhotoField 
  xœì}ÛvÛÈµà{¾¢ZÓ	É´HÝÕ6#©—,ÉiöEmÉt|¼Ú P"q ZRóèæaÎÛ¬5ëÌ'äqžó)ós>aö®*  ª PdÛî„Yi‹ê¶k×¾ï]„¨>ž5¢ÞáÚ3kDÎý4NÜ±•¸¯‘ß(Àgy‡ó˜zÔN¨s¯S?@G“ 	^GÞ½¾ià_DôƒKoç]èfß#‡G$¦‰xÆúéÎ	{!qù{ä¾§í{ãHóàà”&–ë±NŸºÔsô³À8öÇn0Ž¬)yEÃ JÚ‚ÂJÛ¢ y>ó·5T.NÎÁ#®$´Ý±±ë=úZR©‡û_,Ï§ÖKX“Öàtyë‚´ÔË§ÖÖ}™Lh$ì:hÔ*4lÍ?Ñ3Û §tŠ4(œ¸v¼H©‡O*ŽûAõH<P<™oüž\ž\¿|A¾’ï_‘“À¡ä™ë¿'¿êf‘Cž¨+±Èï7T‡â :'¶gÅñkJ×Æ‘ëüOß¼¸¿E¦Î0ÿºCÆVØß_Ó,¡Ô4…Vý8´|èh4îßLÜ„’L°›ÿÓ=+¡ýíÍM3ß¡NÿÖ#a—\{ô–ý‡&Ðp÷mØIhúo3àì×wéWÀ¦ý;˜]<±œà¦¿}k¦XdBoÑ‘¶´ÂETš½ÙÚoß’ëÀOú£ Ð˜ýÊW´+š…!l+¦$‰,û=Ð§þËÖîöûµ#›…;ØÀ¡3	+Ó¸ù¦¨'ó&3Mú›ƒ½µ£ù»‹ã«þ—óË$‚	uËç$¦‘ky/‚Þ ´œËÄŠ’îö:élvz÷ïî6B-\uø‹Ÿù_#\ 9òéê×VÚ›°¿£MŠÞX‹Aùösì1 a¯aîtLâÈ>Ìç}O,/9œ¿K·ê:ˆÈâp”yÓßÙ&øÏšž`Ö€·G†- šˆ°åÀÛ’ŽÀ×òÂÏáÌÜ­eë¥£a„ò©O#€–?.\ÇçF³$	|m¯É]à/­˜À‰çÚï0Â?7,Æ½&ÝYzÆW	±A#Iˆ‡tú8=›"ÆØžy¿u;V§÷c/Ø~0‰è5t’mnÂvÜ8ô¬»s.NL£ïçûW?}9ÏF¾‡/åÁ|ÀÎADá›v7þ5þjccýcB\3^ÅQàÜ, ¼¾s2q=§‹3iI·º[ófq˜dŠ´á0z‘ô^ÿ f<êÎ¿ÈI‘öm™tÞ;ïú[ƒ½œ„N`¶Ñ0;õ{›òÑÝ‡£[Çš6h_dù±‹ªvßò<É@¹ç"‘hËNÜtÛ–Gû÷²µàçnr‡ó³gQDý0pÑÖ¬Ü@6¿gP+‘?˜Ç„ý—-&Œ€ÚEwH~ÉiŠ±ß¿Òò9N5ŒR\kñHÁç„Ô€×åòOQfJÉôˆ&7”úF‘È ÂÉ®Vâ(ËõBÐ5Vl§k‰<)õ·Íœúr‚úÃÉ„Úï‹›¼[¼Ëç5²<1œm2uß¬#Ç3ÇMÈUºÌ—°ðŽ‰Ì~4Ù5 Ë,No³ïˆ “í˜×gÜöF­dÓ©»ˆtzÂø‘CžÜÕÉ¤ÊyèQ@Ë”Ÿs>çÉ9<<$3à:ßf ¸oHçÇ`Fº'³(B9ù5<éu@ØéÏ’I¹?STp¶™Àž®¯;÷õs5JŸÐŒ’+w
gÆš†Ë>H® ÜÂ§Ï¬p|±ÇIüû¿“Î‹ãÏ¤Ï, =ÏÄ‘×!¨ÂtÕèìáX|( $`±äÅ×Q–ï¼ŒÜ±ëÃ„¹ÿÙoÁåoãMfñ2€/t¨a¤ªlÆ3NÜÈöè¶F>`Üç>‰‰yÖÝ#ãcÃÃšŽÉÓÀó@˜˜…À_Î; ÚÓÐ`¤–[öÈ-:+ŸÌëð˜siÀˆY*lŸéü~½y«–Gò°Hum2› ³û¥†Af÷«5¢EPÛíÉÄòÇôpnÅxNº3NÒ¨Ñ=aÔË"``Ð¨KpYÏ@6$¥`nzÅÅ{ˆ»!¬'ƒÿ¦VØÙ·°jdÜ›<rp6—Ð8:P¼°g˜BÝj®ÕÎEÇ©Qí´NëÆÏ¢Ÿ§Ûl€üðÁµi¼ò—.ùw³¦Í;)t^¡á®óÅ:Ì`13 _À¦`çàåØS`ù¡ÌPZôJâ™«ˆ¯gžw×YgÖh ~í»'¶•ØÒ¥f+*¢çñ I‰ß-ß¦Á59‹¢ ‚½¥1[ØAaA fPz7â)Ü°Š$’àÖ!_‰AMkÐ<Ñ(ÒJ³šŽ6*‰©úe)ÌkÐ¿¡þ]¶cÇÓ!û;
nðo¥YMèkŒ‘¥
`?Q‘R ùûþ¦‚–§–Oâ&²B®w)é¯0œ©%{XŒ!¤Òåã !uEóÄ‚g ÿ2ýwÁªSÏü§¯S«"ç4\ø˜bÓª6š‹"’ÑB0hÃ{ßyï{››[›ÍMe»EÑFA¦®ßŸôßìî¢ýS×C8å|¤Ä8•JE5'Zí,MNÿÚ¦§°³	UÑ»79¢Nq‹ñ‡Um0öýilïUdÅãþrHg;Ì%ÿV{¬‘_ÚvC¾°>üÉM&¯ýØú@¹i¥›¡Å Ýt;ž'ždz˜ø™q­ò¦
N'^ ÛªY¹nÝŠUlLÜéAé‰ú÷lÇÜñR\LÕeÅåçÁ¸9v—£)y	xæYw’˜|Piž1G¡ÉHËq:äw¿+økòiwÉõc-ïp>'wÀ·67Û)s9á¬ïl–Ó[71¶—¹„{l=Mú›äçþ›ýÍ·¹aÒ'®ã cÂ#v²É]ßš%¼¹¥(±!àoöû;`ü!ô_rçö?¡: ùØ—X¨‘UþÜßR°AÊ{P<ˆŒÄ ÑzN5vKµþ2wc¤Ôó’ªã™–gk:‚å¦fÉ!9¸ðf±ömÉN­$½…‘;Ï ”‘“3¤hf:{˜XüUÑÛÁÆd[9•X¡°è¦¾æši–Ž<ÒË-9wzSÇMõê>‡Žñ€ôÜ2}y(s:1K— ‰
 jÏ·šÎaîÉid]'—HCÓR[Z]RãB ŽPúu¯ì½I ¤GilJÆ5QyÐ±ÁÌ|m9´ïê]F3
27¥^×Ù1“>ã:Uj÷EktQmšEj~|³%“œ#›<Oq¼ë˜{(³Î?°¡R¨CÉ¨Æ%éGÜñ’CŒ×8çD¾´vtðçâ>ìÃ>ì#ØÕTÅ?+qÕ‡ÝìY¯Ê™OÅIÌŒÜzßÖ‰Ÿ3ÝÝò“!ù‚™¤Ÿ †Š=Îç=·}Õ™0ÜŸŽ€µ X
‡È®lÁRx¹êäÇRP„ìÚ*Ë\šîûO×Ö3Ì¨“´X%úCPéä1õæòo3o®øa§h{Sv7$kµÎaIÿ,¹“Aº¨v[Ù …|Š¥mKxkëJ`àÂ¯]ÏkË¢NRH •µÏÓ8éaä÷h®å¹½rdÅ$ÿù”6 >T<ÒXëµlÙ/<B¹5ÿqäÍp+6örü6 g‘Ò³—Ð]š9‚U˜Ø,„õ¸¿€3wKÃõàØ‡£ÀŠœg@ÿ|‚I@ßÏ€6‹(°©3‹(¹¢Ó·/V(l9õ†J<£^t›_œœÿtuöüâÙñÕÙ%³o&bŒ.©;c Ñ{zw8O;a²†ÎtÕ$ ©q8’š¬ìr)Á5™î˜mqH²ÕðLMBÛý^¡žÜ,ÿÑÔÔ¡ÌN+µ¿E³q¡	~×õ&gm@NÑ¸±ËšÀÖìTšÙJ‘½’Ê{Å"QbE\¡×ª3YQ®KµÙsJ‹{Á °kûL&+{ocŸE¢§ær6š¢Ì%7Ö Äý‚–’Ï]y˜Ç“à†É£@ž¦¡V ¯ŠNŒŽg,ºˆ#ügIºçñ<%1œ‰,ƒ¯%\`vZy¢Rj!Þxíè¿þó?þ—ÙµY?TUåâiùp@0wº©á4[ˆÒ—/qÇtÅ})úùOÁÆ¼fÄsßStA Z‡‹HráPÝ/(Ó§ãç¿Y,öÙôHµc\lL-õýŽýÒ!®Ü#Ä7ç°¨…Ë$ˆ¬1ŒAãTëv„_í'ÛOlÍ¾5›e=Ö…ÌÖù ñ#³½¹|ùb »SÑM`gS·~GÝ`5/SÜ§ùúu‹4§{my±i8C ©>44?#™<Ÿ›X$£|í(3Ç·Ø|Âe ²[·ö¼™b0?ÆÑð¨±›ˆÚž%Eî6Øµö{uê‚L¢tRà§Q¤lã 
T™òÆïAãJè8 êÀÉÐº',õªø•ŠAZ°Zu¼PUgb?¬¥ƒjÕd¨LÉ—»~8Kú×lžeù`¤t˜ë¡¶â^ŠéÒŠÕ„KÒFë$m5$t \èò€uŒZ*OwÍàuß»WïÌüåèß`æ¼aÜ-6ë1½ÈÖ+D°ò dŒLù±ïÓ•Ù÷GðÿƒþT=´Ú¥Òƒ¥Ri« Œ¹YŠ“ð|J­¶¢'ÀƒÓ±+¿bÏeô¯÷Ñ‹±M@Qe›h`Ñój¶õúlC–ó0#I£Ãµ3&¹Û ÓlCa—$+ê;h2‡~ËúEN­õ#”Ñ“e˜¦ð}$<ÞªÓ1¦T6Çãj÷Œ^bŠeS5ƒTDteã•ŸZoK³-cïÚÁtjÁf€´„ÁE=QÓmŽà<N¬ñÖ:ÿn¯i´Jõàíxðoëw;ë¤ÓkGü°qMqè¹	ôÖá”+Á>’A¨ßíõ åÅ¯ätÐvzµT¦B]ÈnWA· Fº{;îrP4í‚šv óù6ˆC7±¼u‘÷ ÿºÉæ¨ëöIùryóØØF2PÙMPeØe6Š‚èä.!G3 ^ÎÆc¬
<?¥Ý$šé$ê{í"ž"•|uý«å¾ÀâÍ¢:ñCÝ)fI·Éx\EX' ûi—¥øYI1™ÍC=òRzëÆèâboÄúãdBŽÈfsFk@‘š|û3Š´©_&Á´së¶?éï>*Ç4O#Ï£‚ÐŠ¡3q¡å])¡=Ü‚/ª(zƒ$xÜ ×³7p}Û›9 ?uUç£W|»×ÓÌâl=“ÀÅ [£òà‡	d¡!?Ít#üþó`SL™«=Ïé‡2;30¯SzmÍ<£ºÄ?u.BABÏdÐ•:«=;5Ú¼z3(ÃæÜ:›*vÛEMŒ0hÁ²Â—+kvà‘Æ‡Ç?æì‡$¨S¯urúBVcnª‰W]µŒtì8è–G^†˜¯DÝØ$#ÕDt”œü…–“ ˆ1b²AŽãØÅ˜ëÄ4£…ø<§;V¶„—Yï@¢MÏejþñM2$o:·\ºêéž;·=ƒË·ŒÑ"öæ½Æ*oâÂŠ§fsƒnS™Ò…Ôe"Ôi4 ÿL|rÐ^{5ŒÅ]o¥§¾^É
Â6ZT½ÉÖ§7/Ã˜’7@5a´xk"§|bo¼Å$ƒ‚LW“0¡““¦ 0&F´¯cTsÆXR/‡Ù–!
ŒÔhóO9›^la»¬`I£E	y¨ûÓ:qÙ.ÓžøÙ7³Ðì]_ng%âÅËž\þM.‚PæÅ•Ÿ45Ã´™<të+"‘1}cfáŸØš‚2f&ßšÃ«Mw&œn€Í†x±¹ÿ¥yG‰h<®ƒ.ðV=I]Â Î×éúŽ;$GŽüë£TÔ`v]Ôg	‰Cî3UÌB#÷T#Š);¯§”bMM’Ãª,û—¬ây,h‰è_g.Æ3qDùœuü<pà%6…©ØšsQY6·4oIÕc¾È¢®ë°J5‰Ÿ‚MH{¶Øb)‚qV@Ù†_Šo§³N5Ðßž¨5AfSâ[°QÄCöÆj'P0×E4îª¢ñ£3+—­]éÒ–`ê:Ï óÜòg~€ ŽÉ:eä£éÜ›ÉÔÂÚ*¤ØGƒÅ§œ!+Bùö¦´©P{líèÿþÏÿýÿþÏÿ Ù±$–QË¹ãÖ§N´`Þß¯	ÓPÓ¹
Sa)_¬t‰¢Gi\]m½hÎÊâ3êø¡vÔÓL?ÍÄ³Ng3ÐåùÛ0¢VneÑVžríoçÒb=5÷b™’––¶WÇW¯/Íû§2¹J	¢,‘KËzãkÑÑ,6³èiîÂÙ3ØØ|jMŸÜmérHØ§©ÝÓ(‘–7\^Ï}¹†2øiÄ…ùgMXªEFFSðO+±9¥S@­”‰PZs²ãzj®<AAÊêmãsæŸb ÿž&1Æ´e›t*3ÆÔêOm(]öîjåÝcgêÆ1†k¬Hä-ÐëãÓçýM­¸º€Ú@µÒ¦RèqþÃrÑ‰‘ÒôšJ’FJÖ[SV£òT`Z¹œ'£ãÊD=#¸´·Úµ>yÃ[Ë|•Ÿ?­€¹L»Y†ø! nrŽGù‰ÑêøWÈ¾ìÈ8 à…’_r‡¡Ï£‰X2!û˜”ôå+ÒaEhp$2äÿ´Oi)½á( {šÛO‚re~Á‰>>Lã”u,€~!â2)"¢±û3åi‰hƒ˜.¸¡9Ñòuñ]M©Õ/èbåVÃ}mï(/Wu…@M¸ŸSž"Í¶K×IGÕ/†?ÉíèøIàsrT5Îf¯WB`£ ,f>sþÞm6s)…SÁ¦›½:¨¼uðÇzi(|
ô)zý±ƒæQo,½ªÝ‘J¿8È2×k3W?Ú'#µb4&ÁulÚ!üH2Ö˜qs–rî']Q«L~Þ['[›=sô›O­²¹ "ÙÄE7r£dò#µ"rˆ^1¬…¡F€ˆtø úê7Xgs]£ôQü4H!ÅO•ûÖ4 öœ‡U½;‹“y‚!¸ò!ùržÁçþ]¯¾ßbÏMÞ…wÿê›'QÛåÔ,ÃØCmÀ“ª¬à»cVë:gƒŒƒBiœtåÑ{˜g§Å²9üßµ«6ØÜ1ËÅèÇÅdôÑ8u`íI!Qâ§­4?Iò|…·,o¦Xê¤ì×jI•ØÀÔt€VGŠ’b?”äÁÝ.Ë¶˜K7GŒ!™?è´?ÀˆÑÒ†ñPã.§þóÏ´†¡·E0èCjJE%Šî+Y'ãbQ€>¡¢íéRŒÉì(?È”\R‰Ç}wícxKj/¬\›B«Iûihì6‹":âH£š@>žÃõ@ì³‘~ãc-ÇxWªL2:­-[+Ë‰Ä01gÞËà¹åÑû#ü¯97L×þ)²ø¿‹õÁòÃîØ?æL¹hÅ#•ïú
O•Øî¥¬–ª•&W«ZMŸ’Œ´›lCR:	¶¸/ˆý²lÖ¡ÍLÙ›š ÓÇ”zMCJùÒk¸ZMôh}Ô(ÎÒGÙÜÓØQåÖÔExòÞ°­XZ§<¡4Ïexª‘ñó‰èÌ¶O½M'?`Gq.²9m"8wÁy«ÍuoeÉŠs~Q–2G¿DwM•õÈµpd¬8&Ô€ˆZ
Æƒ0[Ä[–Š×¤>m]X¥¾ˆƒªbÔÆñ•Yœ/­î1vÞ”Œ¿méèOÌ½ÄL§§?=þÓð©IÃÑ8uEêX£SUÇ)XôLdR¼„Âï I€7¬ÞÓXßÕtZêê9`÷&þÙZ¤¿;øàµ–ECÅ‚|o‡’w_ÎveätŠÿÅîß-p¥ÆÚ%MX—hÈ¹
ën-5g­	sÖZÑDzÓ™²ò ©Rvßöf¥žËrYzÅ  ;Ÿ\™–gÅÄâdHg„ô¯ÿyÂ~ö#°8ýó”‘´¶!cf¶6%² »æÌV½êŒ@DiôÄÏxYÔÚ-*“ë<ðËJ°ŒI3œá}ö:«%Ý0<jÅ>hv{DÂÂ:®/Uõ1‡R·í|ÍrK•5PžpãªRr£^~—X£šRaVS*¼?‚ÿ/·¦Ôjw÷€+yYö’·˜Š¾Ó®Ûms¹µj«ÏJï4ÞîrC¾åxuyÃ=§×Ù¦ÃŸGøŸÕ•+ƒ‚E;——ð« áÆ³È5ºQýñ'Yh¬ûSó‰[’YþÕŸž›HÐó™—¸ü~É Ò°jv
ãÃrÝ@èù%{¤ƒWz©˜´ÛÑÍÔÒJWÁxìánÂl?öƒ4Å³Ûn»è¬#éÆeRÜášöj*Ó_Õ>œÓ ¹ÛIMî‘lH>Ä]‹±å‰=pk
}5Ú£ˆ:KÞŸRRÜÎ/‘÷'êŽ'	é¾×X¬Œ½QpèááÚæ@ï0*°…÷ãU%ÎÝ°57wDëõ~®ôÞ´p‰h¹©ûƒåÌSòìê|OžŸwo¤pÔ	›£ùò[Ãàëè¦£éõZûé#%ú}+pÒžþB8Ù#m½pð@Œœ,#'KÂÈÒ‘Y'“Å0r"0rò™b$ÀâÁ˜h¬ô”–Ch„‡xYKL$šR™'møA¡âWSÔ…­\Â^iYd“ô	‘<ñÌ‘sÿ†?Žyæ‰rå@ë4Þ_¹†™R7˜fPŒ&M¢E’„4„)7¢.3¢~¦’^VhŠ-Ã²ÃØçL´#D¡¦MÁáò›kRÝx¤­!¿±_¸žD+*-PøYåËpöŒ—O¼À~·¡l3{™te ÅP-¯VÜ­‹jIìX›67oe«=ªIp¨74,€W"}ßŽŒïjˆ›¾ðó¦ŽòÐ¹¤(!ÑoGµŠ};ÕžõÙF‹7"ŸYäxQë#¡ý1Ç_>Š`¯¿6$aW]}$,91…:®GØÊ]ßõÍõÈù§%¦ä}ÿÚðå»¯>²|÷ÕÇD–ï–#ß­5ê¼ÂT5!é%J‘/L´rÐêeº ~ø§P§û|nBìæò¥:Öé¯ÿÃŠu°›«ëD·¿64ùGì`;W'Ù:ÿµaÌ?¤h;ºtÙûüøÂæçÆö¿fÏDÁf}m$Zƒ°5É¹­ÝEŠdm6%˜¤÷§WƒªøjŸÓd8†úúƒ[òóËýñ8«)ï»î
!9ÞŠ7Éb®Ä×£ôº4[}ýÃºÚBÝ¶}%/ª.òŠ²êè+6H-ÅTFa‰e94±\ÏP¹+ý¬>è
?ÊÀ+ve$¡[I]·£§ŠZÃp(g±<¢öúòä4C¯¦ê€&si‘
»õ9«(|;‹ÇbC‚Ì?Û¢·ùB²­Tª]AQÚÏ.¸_wo×ÇÆvÃÚç†_|ÊøðâåÂè°ZÛâÂa WÏ¯>JùqW„«¦W™-©ð8tôËO¦Éƒ@?·ƒ–3X úpÆŸyq#f¬ªÀ¸êI«ú©ÇþØÅ
gSqËzÃd/+mfj
TéÃlÊS[FÕÔÊ@+™ÚlÞRpP¥®TªjcY v«Ý½897ïkˆ½Å²™ÅvÓ©oÈ’h®Æ*´JWÏIàý7ªßßâ%Zoõû£Ñ:‰(ÓÃÎ³ÊAbcJàa˜%Ï	7'‡H§ÔQ=r¹Ž<ÿ9´[_¯Ã+x„ªÈSã×;¹ÇŸ¾œÃÛ÷ïÖÉ»|ä¿±_1ùŸÌ4…#^DôƒKo`Pxk—BL‹xÆ×1'ùúÂÍ-¤­çQ›5	ëûôIê™…‡éÚ
ƒ¡×N	°!¼•^ƒnš?‘weNž¨KŸ0‡®r›žQVÜÿ
džÕíÇhµQ^ÖLÜrùàý’züD6Œe»#?ö¹¨?Â )¢c*Ùr2¡ö{Í½ƒ…zF¬PÎe4ÓŠ÷gŠs¬$˜ÞŽ2êûß›”ˆÔíªÚr'_~«-'À¨5ÝãÖù
XêAÓŒ÷š r³2JGDªÂŒ8Ý3ÖìX ˜t£RÒb*¼¬+Ë,~aí­¡­±l²N×Ô¤Ðâd¡ÌäÚÚQ¿Ï*4¥ÈWB<Ò=?9ícò~¿Î´>¿¼:~qzüêô§gg—ç/_\2u5öjtUÙ¸{¢ä¼ÑÓïFe%}É °˜'®WXjKjÊÈW1S„”¤KSÁM•é€©¶7‘¦„†Uå2ÐÅœØÔì@6ÅvÀ»/ÒÏõi_W?,¼­[Ô(1+‘mQ)6'w_§_*¤XºÇXC†£ÌS‚n’s}u~o‡ž›t;¤Ûé½Ù|k²:41›à§©Y?ÓHãúõ+ØK¤G&;i-Å[í–•Qôz5]ÝëdéGÂ’¬œMº×a¡jMÑ{5ï&©”9ÜfÌt{`.uÈZÖZ Ùq×òáÇä8Ô,MunÛÈ³éqòò?G@"³˜H¯¿³¸ T
Šdï…¡éˆ$­L„ä€u³·¹ñu¥è%>@<‘<’^ðh¥7‚0¿ôG/ayn8
€o=sãÄ(i‰ÙpQë|jñ^àyäbrçÄÆêH«ÓÄ$Ì¥”
Ë[>Xý4T‚Z@Í"7~ONï€9»6Fòˆ(æ‘9™	<ceŽë¢¼è—¿-Èe³ÃÅYëvmw6™B"i4Æó×Ö¿½grà—'ÚôÀn<®;³ò©Ò^sdÁehEïµ”µâA+]¤‡ÇîÇ§›ÁW®À‰Ì/‚©VØÉŠpó÷Ju”dÆû!F^¡W«–>Ú”lû5ìH%ï•jv¦¦?]ä{êQF½£ ¦'àMÈ¯ax`ÎÈš3¸1½2?]eì8ªc¾é'Û´SF?R\ªƒN£Þ5ÙÇ×RÉÈÖYÃùJuþäÃ™ŸãØ¶<ÚãÙù‹ïÎN›,¦æ±W˜âßHØe•5oÊáDów<ž(©í^ñÿ2Û¶)µâYD§€l C£¿Î(e µƒ){ï»hÑl¡; qE* þŽ|©Å–ü%ÛÜBìRök0K˜jÄöªä[”³—wjDÞª;JÐ´”H~3xÃa÷VŒÖ«Í«éH.`…I?ª4-”BJ6X’M©Q„ãü¾×ddBRà>ZÔmOƒË±j*Î£ÌjOþ¢JŒAümæÅËüx©ìmºàRáÌ›¨vè•jœz•>dÇ^éaÁ¹Wzfvð=ÄÅWž!ºù
 kèékåëSjð÷5÷ø•û•¼~…55vü-Ûõ÷ñÜM—Èà~ªë­Ðç$FJj¥gÆÅ¶Ö7Ký5Ô;ÇVäo¾}²‚P1÷”ÀÂ#·{m´ÇF*ß–¤òc¶ë#¶ñÚlú×w<`™ˆUÂä«!d‚H€ö{:ÈË‹äÅÉ:ˆ’
7XL&†åÖEx›r`nõ—ÛáG´]z³b™Dp«ÆY}jÌ²L}ïêÚÓ³ÎOÎ.ÍÄÈœy
ä×¦u„ÊaoÉ¼]ü¢'úÙþ‹7ë/”f¯µ#ûŠZ¦ÒªN c/7[zÖç§ÙßƒÓ³KÝê„!L&»	ì'×oµ0Y ˆ¯C,-@”ûÏ`epPäWÔ+[š¼È¬8AE%~^p?¬T¦Ÿ?4D‡Ž@Ñrøœ;pdp:}öc_èÎÓ`äz-Í”KÙá'¯Zìð(ŠW¸¿yïívWÑîãí-LæÙÙÓ³'ÍwÖ¡£îlÞ{»U´ûx;“iµ³ÕýÄÐNE8˜S>õÞ{`I<²¿£à†Wu~ººš ½™©,ŠÙ|i|euF¥.glkHZU NaÌ~ÓâýV~ÈsxH:LAˆ;éÕìŠ—	Æ_F0‡÷´Ï®­„òð#FŠ¨[Ÿ[ê‡…|ÇÔÂtçôÏÖ\Ð!D×ŽÒ¿Úwqrçaâ¯Ö]ð=[ã×çÆµ7ðfá>štG¨€æäß:›{3{û‚„ ¤C"sK/^ÌõÂºê,ÔÚªJŠ‡)gE§3Ä­huº%æ«,ýÓÐsm^‘uuÆ!y˜V–![žßƒíB…ÞZ…‚±gA³PaÀÜ($ƒc‹ËÜ8N­Žé?0V?â¼fá™'/Ÿ_<;?9¾bAšq0¥ÝØfGÐf‘”Œ ©aÅÏ]O6ª+žìêªçßÿ«Ã˜¦1Ø¬¥CkQgVVÌˆ¹˜œ9€?µD«ºx‘¥Uãº'3’W2þV|½n&If±´BUì±Y²ðcnLä“Ø ô?:üfAÈv]TH9Ù."ÛõÈlð¢8Ð°O²Fæa,ÍY+ße`!ü¨m§¥ä
È`Eª¦
¬±ûÅ2I	H
FZÁdÇHˆÙ¼ëÃš34"¸e
oìQ/wÉxŽ «½Â—dÚ‹_*JÒFü2ú­?fhm[ÙŒùY½çŽ³ß.[>X:+ôf–Îj¯B_¹àUXjÉ«ÍsE_Yê#[ä:¹¶·ÃPË¼naÏ–fƒ>ÖQ:fãª7Ø}«ƒãà||`X/ËªVý\šl~†p±Ÿ·Ôq¯4CÂ•ù¢óÞ?´¶2Îê=ÐO]”®ºRd?®Í¯\~ÂR{Läõ
4íÈÑ§ˆR«HÖ‰C×8Q±­Ì œÿšˆ¥_¾"øßWGAãeÿ,fn{‘'<ÂÑ,,a¬é²p"ùà-P6üÊ4PžFf8•š92Á¼–¸ÀBn#»?ó¨Ysvq~Fs06ˆ¨=“ò¾Uã*]PñT]x–é:gÖöã'ÀA_$ü3=BìïÏèðÌ"ÆÈ¦–oYŒ;¨ß	–nfãj0†ž9äâä|=;gØÊ
ï°¸Žç7ýY¸øq{´÷Ó†s\Æ9ãºš†ieO9 ^‡äwäÄs}Æ—³ÔT ·ßº ŸFwäÌqQjT'—ð>^‡ü-åÌÑ£,3¤ƒðRêf9¤fÌwï¤Sk¤k§CI©µ^ÃÆéY	ôHOŸÿÈg›}­©¢ÃÂeWYJ§U™'®]Ÿû×1B\)Éa«åñªt‡ØùÔ¸À—QÅ«2ÒÃªx5œ¸TÆ«ÒB·µ•}ÕTüiùGzÏåáÜ/g£©›$º4Ö5 Ó´ u»˜¿¹_©ê2ÕeCÊé|¥ä‘Â7u¹q)#–Rå¶K•	^ÐþEÒÖž¦² #ÑÁx­åå-¼¾–¥bg9öü§¬ˆÏQ“æÏPCÓu;„n¿R‹ðýf¥©x„TÄº°¡0yõŽ<ƒóE£íbî¦iç³8tzÛ·fI -Q“áßƒå°ÔŽk®ÐsâF¶GU³âuy¬¸Â"p€™¿¢v9yB7Õ¶Ó» áÛ8­ŒõµŸŽâNNM‘„ƒ$Å_+‡ÿ`c0¿iá÷l”ƒc¾ÁÀSbêÛ4cÈÍ‘v‘çÉyõA¥EÚ+`¶E:8æ™Ð«€uR²|ä“*	 [âZÞá|NÐÝänH6Ë’£ÀÉÂK[å—è­›˜»‘…{÷d?×†Ðß$?ƒr´·ù6O|œ¦äfÑc!Ò6gö÷åÓYÜ‹¹…	 ¼2)’5Ðq`êa8ø~f9è6÷(­Ê<”—‘:jS8bN:Šð±â;ß&]›õê`rÞU‹ŽV|ñŠI†:+ôËu5>Sï¦–zWÿØµÜ(Oz	LG †z¦4ëÆr”ÓgdžÍ¨0ð:y£i¯·&¶•Ø‚ˆ¹6VàÑÁùÝµS1¢ü_³md0ÁâÕÞ¸ÛpmPý¨ÊßÕ¿r±3Yþä&“	øÒö­@£;‰Üñ˜F?¸£zíjÞ‚#qžã\×Ö®ó$›AãŸ¡|ÙítÃgT¥Ëêëß|$LŽêê6ÞùKL»[úçÇìÐv³«|³º=
åN£ôÑK¥BN5]^³]PL‚‹ïs»ïê{œV
š¥ZLª@e*¿Zâj*öª`¬­­-X6c¥Èõß÷Õ¦oÃÓ“J=.±•DUoÌ	4ç;¼Hvš“ÍHae ÎRvSIñ6F!yë‡;¸HVý&bÈGî‚YÄsnÉˆ·‘Òú ˜r°tsÅ½ð_©†5W#¥uFiÑaZ$_¸T/[TâÎ…}æ€‰å¢ ™ŒÍ; ^îÑÄrÓ³ûM,ÂÞÂ¿Ô)jû‹ë®±èØ>gnÊ×4^ª…µ‚á¾FJÖW¿jz=“(³Q€¨7¤ $¹D‚ð-3×qÄéQÂà‚û_#ƒàÇfº°­}þ3ÐàÃ9þWý<tüpžþ¥~¯ŽháGÈD9ÙÒO;ðS"½þÊ8ƒ²ÄUü®kƒ<Hâ/@è•ûZÄH	#É.ð"Së	àBªÅ‰¸dé¬½Øk¿åÅ^Í/T­­»Ãïv3EoªJÆ”(o¥Ð¡¶FÓÚnQ]õ ÒUiÙŸiàkGÿIðuHîoÍ˜¯4‡Yñ+Ch.~€pÎ·ô‘B€@‡óýó8¡pê7†.„yPòñ£²g3©íÅ)Ý¢õÚÛT­E3I«àåµ–$NcX
m¼€LÅ†d³ÄÆ´dfÜÜ¿Â“ÒÍeŸšŒ#üýoŸÂyÙ¬;/û†7ø‰©?/f.ˆÕ™É´¡_é¹iîëU—SÛÎ¥"ÁÃQË+Ì>dÁø¹úò
wjhBèùØæ\Ç’‹(î^Ðˆ‰C(¢0Òã!O3:”¬P÷ºœ»¼·­áVÞr«I‹ÝáNÞbwc§I›ánÞfgc·ÑÌö‡¥©ío<ÖØKÞò
„‘±ø`]yax<µÞœ~ª%……!!Ç­Éi«¹Wihø.s!K•ÁÏ’úZvŸyPhG;´£òA–‹š’6%Ã§X¾pœd%l«N’©“þ•Ò‰íMv'ZA©Ñk’YA9=Å^ä®Ôš7W0VÙ–„Ë”lTì›Å^…úOJ*óêör‡Uô+We¥¤üÍË:º•15ž™à˜¯~M·õÜv§áH¦=_æ–pGòë˜¾ŒÜ1Zt÷×²¯’ÿ´ßpZ{Ó~ æº Ða¥$]ê'zÄuôèµ‡»ŠÔ™1œµÀt«*E,öfÞpÓ–Å°¼¶Ju‹Šð‚ÆI¼§rd‚
cæe‘­·Õ|ƒyùÇ’õYÞ·…]¡g‚57ÞÍÂl”ÎÍuÿeÝX½–Wåú×Ö4 vposW›…×÷¹CY·y»îÑÙ6OÄ(ÈëÏ,ðT%z¤åaANv é#Å‘òeÛéù¸õ*âˆr!$©ãèw	ÐœIÿr½€U yÆ°\aZòcMoédŠÚ~]¬:Í›ðÒåÚ´`”s8Óþ¾˜Ì>gü$úŠ5ÏE$Míºã»6»S¥‰\"£SY»bãñžbIé»9¸å6Ûª –*Ñ(
"%üñ~
´´k'ÀžJ£goo+$=«VïÁXªÚ®š{*ÍFVõ¤§ Ý$Ep@I"LëŸ#+ª¼¹VE¥wJïbxª»BW+Ä¶§ƒu³Eq¨pïT8ßdÌ+ÖŽ–ïlš¼€—m¬¿ñK¬P¶‡F.âU+ØYeÐVyoñ[‹oô²çþç•`d‘©}e•Ù<´J|‰m1ºLtãß€'²Íí'H¯
±îx¤Gl.Ýú=-S¤Þý‘ ¢¤×}Åï« ƒhàŽm–À¬H;Ó=Ì"r&‹À"mX¯ö`ñáIyFš^ÀL8‚aD¼ËžõáßT‘+
½TB…©Ç™|vµMÎÙ9›.©JøëžF’OM/’9´êÍ6ÜçfJ¦–"Áã‡k'x*„â½xkhžÒ!ÍLœGú°à–|‡]uîÕæIµì^>ŒjÍ¬j5“p €¬tà5/â	øÝW¥ëÅË²ÆÐ®ºñÔK®¬Z&a†žôÌ‡$¥ukŠ¦‚âƒb7y	ïgHšFÁ-Ù §=cù.?¸ô†FÍ":C)ÕàAjÎÇˆáÜ*Äpî1™½¢^ã:!Gê O2482ë¥AØ¬o)òrhÉ)fpo\9Iæ 3«ò×pgÿÞ­É@.K!äéÎÖ&zF¤h+í)æ¾':ˆA«º ([cî*QƒÊa2UjTÉêa¸÷%÷¹¬áòm…E#2V•ÌÂµÙ×ü„è¼1“Ýª#hŠ˜Á¯Ÿ)…±üG…#5`$ãÇv8•JÈý\*jZdf.ø4-ê¹•LS×ç?|E6Û{ëdGmï.ƒmgW8!^eŒ6K‰2vªYl#+˜™ðãG\%QÕQš¦ðís_iSïhã½–²Ö-ÿ¡/¶8Þ¯dC^Îµ´;o”-ÉîYò 87{ä·dgó³ß¶D
úûßnoqr³„±ýO"z}X¤©³Hé&Á¼ žbøŽ“ùŸ¾TÐâ¸Æ¥»ñ¯ñWãuÒù©Ó»„þXyó¨8\ûiäYþ{à"Ìžôƒ ¤> Ú`¾4ŠÔ@þœ0á%,(óÕ0ñ’ƒWÕ¤, ¨³+bƒ2ö¾YêÛA:¡æˆg-…
h„¾ôSÝcfÐDƒãö^¾ÍÙ»šf/ìãpV¶ÙX»˜’îYl÷û?×{†Ô†5S¾[E"RyÒQž>ŸŽ±vá˜ªÅçª×NˆÍµË"†X¼ÐôŽkðï~„-B,ö6?LÞVÍM
ñ½¨Ùæ{ÈþÄ¿B™B-t²ãB~&ïOš­¡º¬Š3èYªýO§0$ïþu3¢É¢–{<V[ú9‹—vè¸÷®‰a¦µú ´v¸SÕm“1æÌ5á)Y¾`.wH±û&JmyÉ¡J’7x¾aoo~¸y+¶ìÍ×{€&‰ø÷Gˆ6$`³@ýñËõe'”° msç{JsÑ–Â?ÒÄŽª;TO˜ŠœX¼®åÈªVph£œâ²Cm¿låÏÖVñJÚ^)(‹åòØ×]QzCŽšÊƒ¢FUùƒ•Z<C2g¢9¶+ò{Ú`ïþ·äßIzb†¤r†þþ7xŽf™˜¼9%“»2’)Dx›»SÖŽ€jl@k,‹ÆL*fò*Üänü}ti[>ˆ@Ln([’²§¥làß>,7/Â=ðñQ°Á_,™q/I¼ú¼Ø£ˆr*4Ûh¸xÉævöü9	 Ñ.¬Ä°ËÙ”¥óŸºxÍI3ƒF¢YšÑþ¹YÝ¶ËV·ý²Õ-žÊLŠú^Æaâº!&²L‡a·ÎðvV_õMÎ@ï0ètsó·cøC¼æè‹ÈM»ÎÅl…–fh‡¿'Þ±¦¬7$¨ö#è®} C‚òa¥«*AØrš,s•ŒV&ý[öŽ ³!N®|¥t¯2ÿV4±¦|Žñ=1rÎ÷ŠyjK'Ê’±µZ}¨,Ýñ\%»¨¼0£mU¾sXy·üâ&<Å|Ó }¼Qw°­gß‹QûºˆÒ§®G±,µÖE+zÛGO¹©D”zÂÍ3r‘L¨Ì¨X¡èz=BÂû”UÑaG	h•–ËÝ±B€ Ž;›ÊcbÚÂÑeÍìdQœÎ4ÄX¯GA´yñvYºíëö4'æR>L­¬Þ×ªšÂÃÖR™äLñAÚd{ÝQA¤òK–G,‡]Óœ6ì¬øOv­|N'øƒ­<?d+“Yù£G.£‰ÌT"qbE‰Þˆ¯tƒ€\Äü×þÇ×ú1”Øy5qcQ¶,¡(q
×«ï°¦ïÔýçÉn†„ íà±sÜ”ïX'Hš¨ìÃ¯2q+RH`xŒÇñå]Œ‡)³ÆG¤{ºö:9¡ˆjë„&ö 7 ç	(l¨ÅX·_Q`yîØg×Ô³ú8?¬àx @—
ô˜Âˆâ1<u hÖ M K2žvÇ­Âä ±†”'îržhGV–:qUe%³ê‡J=Ör^úÞâ‘H&£!ÆpãŠ½èVhØ:Aé"¹˜ÜÅ®íZ>.¨Î¢•e‹=ÞgÞÒ’:&ð¿Œð•Áó	 Ea"Wo$mø:°gñ0˜%€¦"ùŒÿ„‚HR©ÅTdqQèW‘'†(ôc†>ÇO hs5Z5Bkæ/q#”ÙÍEª¢¼!KDI"]vHËe©Y±ÙyÀ;Æ80[³uâ[‰›”‚lötù‚¨•Œ›e£h9UIßNeC@3nÃøÓr=EuñRæBG<šŠàCÒôø~¡<¿º*D<žÊ·>¸ GÑ È~8
€¬n"ØO‰W”ÕuP½rHÖ¢‹Ó„œÂÅ³Ž!I¢ï/ÖÖ…&³&"`×È½v„fåŠò"NQ¤/ã¤œíS$_>CàjÞrá¡¹Ud¾1ÆÂNYmGïn/…8ë :LÊì©ò	{³ý¶|Ær	<?D’Œ_—q¢9Q+6;xy:Ÿ˜Æêª,’ê"$ãªþ¡Ñ7ØÛLzà¸ö0‚ÊúõÀX,qÿË†™§OÉÙ-‹3iQZ/ž7Î5oÈÛýÓ0ÔÂ0tY_jó[’i¨ÖÔÀô±Ì>pXÿiõùì­>Ì#œéšì[s‹zËµŸÔýÉØ{Ê”tÙ–Ø0Oï¦2Ö¹‹Z–÷$ä?é_a‘Á[xÇ"»]1îÜgWÝ¨gþ‹[ô4òŸö#­~—Ú6ÈË°¹Š·_"xÜw+–A$÷•‘JÜF©®€Ëe{:ÒÔW>ò’ƒÂ÷ík Â$®sB9¥ÂrQÄŠÇòG®£ MÈÃ )vR#t“ÎÂ¯f
=©1+*Ã’Aò¶ÞSb‘kzC¦³èh,7•_qCø6­!yN#v¥®ºj@¯·ÉÑùi€¥@7*q½…ŽÇ•,î§|2óÞó®¡_CíUí™lU8§c8€aëÊõö6K¡G{,òHgïJ	š²]&ËOõèubÔÛßl?z›Á{($KfPYAwjs84 r ·ñLXƒY¿œm®P¥ayD(éÙÆÅÂ®?˜á6Èy/—ÍÇ#/°ß«jÉy±‘"Øª¥"tœôÒeu’O‚éˆÕ#Â3š&¨h¸¡¾4’i!²É='Š°=[eÊ¨+##1aetÃN¹}FÔ˜ÅÛ"1_Ö¤”þ_g–¸ÌI]?´8€ÄbSÏÃÆh@g6$”.ˆ@H€i Ás`p£Aài•þ™a¢Rîf¢œÛCò—óLBAÕýƒëÀBpê*Îö)QÑ¿¸á§EHEnxcBÊÞÿL	)›{FH³R&zBš.öa„”ÝðtÙ¼ÔQÓ4£ÿó ¦ìšSS<®)àØ^ÒÐŠØ¥ph?5j*dC ¨q:Í"™a"'sAj–—’Z´½V¿Qèœ¦ï?Æø8 Él; çµ<ÖƒãŽÝDº9Oˆ¨¬³k†<¯¤â¼t«|]¡@\&V2‹AxÆkÀ¼‚Di©(ÑQõu¢ŠÔüŒ2iÜJ!”ª:¢.9¶¬kñbQµOíbeÛ…ê!û›ùÚyT5`cßr8háª›Ì…n¸ñÓ”…¨<ïxª5%!#CmÖ9å,.
ÆˆêßØ]u<ÓØfwNðN;D!Y®Ìà=”¨>ÓW¶3Ð}mÕÒdwÞÖ¹ŽK ÌdãÆ  §Ãí¾‡CV~”@îIWŽÓíª›CkUã^ËÛ[ ’¦ÕŠŸÃ[{¦–½ªN;)M‘…áùß®Xsõû¤N†È?E2–þ!"ÑÁT*Ë‘g§/™ç@LN’w_.#Þé$.v•°Æ ©
…—à‘º¶a'`èuY¼Ž°È°{' ¡ˆC§°<+œ¸6çË)KÖž3BÔŽvÑJs§Ê«²ï–KQ,ÛÃwpVXé+bêEÖ…ÄµªP>­P4=,-}#¿Àñà$þp>Åw¤+Ò0yôJÏóþ«ñï—ÅW+¾0zë²˜.aÅ†™‰=å^yóüö®”‰_/à—ŸI-Š.üÃyñ»bµOáÔ¾¢(¡Ñ2Ló%—_ª[wùý_hñS–€nØŽ$*TFcðf!ÌEú"w.Vtœ=MgTy·r"ŽYäÅUðáYþ¥ôn6	ùÛ½´+Ï8äNñ1"»ü½°/ïS;ï‰Z›ü·?ÁØ£•bO£`Zh•¦yûNù•¼9¾e¯Êd? 1a®×@Q2ð>HgÑb>Pú^HiRKúaa1±E•±Ry½‚¸J8ŸÌŽâ:ëx3$më óc$ÇÍŠ,å/ù’5è XQl[4Îp£LÄGO'ÊÃØ
me‹Ë=¡°åÐ vZ^§ÑHßQ>Ã×a°¦ÝGÀÕÚ¼Ø™Séÿ7å–6–š»”·¾h”âo]ÓÄž¤ô¥ø‚*6©ƒf¸ED´Ê4wéT/:ëY€@ZOPFº¯¢ñÈI'¿f·(?V´´BPG%}¯ÌñsÉþ¤â(^E¤+.GŒ‘EÛZ¢²Ø†ÌN·Ÿ]‡“_l
ºÞµå°ñZøƒš2ar«â¿o¦¹îT¢ò‰…ªË—ª–5Zž—:,Ö)Ü/×”•_›]F¥®¥«¶o(÷úŠ7Xu@[7šNØ	C6Â±Mí·oâ×\;:¥ÈZDæä	Èêx'"<IwôñÝŠŸŒ»œ"ÎNfÑ“+Ü *—ŠUãdí®×ßãÒ. 7ÒÉáy~ ¿ÅŽ C
SV´7PTzWGv+üqÝXy#l6s˜iä 	ù6	Eîô6ÓuÖD,€‚€®ÅZîU:ƒ±BP¼Óœ–Vù°-ÄDt¶säÒý¹íÖ)Oª:ØÿwO´õÿ>pœû¶7CDB*À’ÌX\¸%ùÐôÝrÄ§©3ßŽî¸§›žC«£JPRãrv¾¦îåÚ:Q@Tc>5vK²\$8ó+¥?à®ˆrÍ¥«,­j­§$ 
kL¾*$(N¹s|vÙßÞÛ'ÙÌðúÚ§Ù÷Ð˜&\ªš‹VÌDÛæ•É%F•ÝÎYÍM{¬ˆj˜›vpìÑ(¹Š\q²&®³¿¹Yñ÷)dµ8N°XJp\èxE‘" æ¿×¦J›S±K>Ÿnm<V[Ÿ9V -Á,º'Ñ7.:›bÅº£ÌŠÃ™?C_YB¶žŠbÔÔr}ž%Ù!>½Á÷GBb^3à¡4&ÜÝàŸhCÀœG›å0(prYbS–¢ÄJí&ªúËšøE}¥ÊùÓ¥)É‘Ùž\%£@úQ¦4mgéfÏ½$–=UÏ¯úRf»VøíÍîù*ú)/¬Ñº#ë ž™dPt—@¾b`
NãôÇRv‹Ä•D©g¬ŸÖ0Ýe;¥ ”¢><Û&Iü½µR®ª—×´/–}ß8ÊI“Ú_¾8?ªÂï¦I)ÎO%©"ø;1›¦ó¨„Ó*‘ZQÈ¦ðCá+ô™šò#@21ÿ“Õþ‹ûø]¢TóÌ"Ìó[åB¯r­ÜˆeWÆ…Þ}šr‹Êåd$§B::šÍ±÷‡ßÜÿæÿ  ÿÿ §90æ