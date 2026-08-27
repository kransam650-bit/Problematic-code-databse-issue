import React, { useState, useRef } from 'react';
import JSZip from 'jszip';
import {
  X,
  Upload,
  FolderArchive,
  Database,
  FileSpreadsheet,
  Cloud,
  Clock,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  FolderSearch,
  FileText,
  Image as ImageIcon,
  ChevronRight,
  ShieldCheck,
  HardDrive
} from 'lucide-react';
import { Patient } from '../types';
import { decryptJSON } from '../lib/crypto';
import { parseCSVText, guessFieldMappings, convertRowToPatient } from '../utils/csvParser';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FullRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingPatients: Patient[];
  onImportComplete: (restoredPatients: Patient[], mode: 'add' | 'overwrite' | 'skip') => Promise<void>;
  onOpenCsvImporter: () => void;
  autoBackups: {
    backup1: { timestamp: number | string; data: Patient[] } | null;
    backup2: { timestamp: number | string; data: Patient[] } | null;
  };
  onRestoreAutoBackup: (slot: 'backup1' | 'backup2') => Promise<void>;
  driveAccessToken: string | null;
  driveBackups: any[];
  isListingDrive: boolean;
  onConnectDrive: () => void;
  onRestoreFromDrive: (fileId: string, password?: string) => Promise<void>;
  syncHandle: any;
  triggerVibrate: () => void;
}

type RestoreTab = 'all_folder' | 'json' | 'csv' | 'drive' | 'snapshots' | 'linked_sync';

export const FullRestoreModal: React.FC<FullRestoreModalProps> = ({
  isOpen,
  onClose,
  existingPatients,
  onImportComplete,
  onOpenCsvImporter,
  autoBackups,
  onRestoreAutoBackup,
  driveAccessToken,
  driveBackups,
  isListingDrive,
  onConnectDrive,
  onRestoreFromDrive,
  syncHandle,
  triggerVibrate
}) => {
  const [activeTab, setActiveTab] = useState<RestoreTab>('all_folder');
  
  // Folder / ZIP Restore state
  const [zipOrFolderFile, setZipOrFolderFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isProcessingZip, setIsProcessingZip] = useState(false);
  const [parsedPatients, setParsedPatients] = useState<Patient[] | null>(null);
  const [photoCount, setPhotoCount] = useState<number>(0);
  const [importMode, setImportMode] = useState<'overwrite' | 'add'>('overwrite');
  const [zipPassword, setZipPassword] = useState('');
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Single JSON file restore state
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [jsonPassword, setJsonPassword] = useState('');
  const [isRestoringJson, setIsRestoringJson] = useState(false);

  // Google Drive state
  const [selectedDriveFileId, setSelectedDriveFileId] = useState('');
  const [drivePassword, setDrivePassword] = useState('');
  const [isRestoringDrive, setIsRestoringDrive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resetZipState = () => {
    setZipOrFolderFile(null);
    setParsedPatients(null);
    setPhotoCount(0);
    setRequiresPassword(false);
    setErrorMessage(null);
  };

  // Helper to read File as Data URL
  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Helper to process ZIP archive or Folder file list
  const processZipOrFolderFiles = async (files: FileList | File[], password?: string) => {
    setIsProcessingZip(true);
    setErrorMessage(null);
    setRequiresPassword(false);
    try {
      const fileArray = Array.from(files);
      let detectedPatients: Patient[] = [];
      let totalPhotosFound = 0;

      // 1. Check if there is a single .zip file in the list
      const zipFile = fileArray.find(f => f.name.toLowerCase().endsWith('.zip'));

      if (zipFile && fileArray.length === 1) {
        // Read zip with JSZip
        const zip = await JSZip.loadAsync(zipFile);
        
        // A) Search for database_backup.json or *.json anywhere in zip
        const jsonEntry = Object.keys(zip.files).find(
          name => !zip.files[name].dir && name.toLowerCase().endsWith('.json')
        );

        if (jsonEntry) {
          const jsonText = await zip.files[jsonEntry].async('string');
          try {
            const decoded = await decryptJSON(jsonText, password);
            if (Array.isArray(decoded)) {
              detectedPatients = decoded;
            }
          } catch (err: any) {
            if (err.message?.includes('encrypted') || err.message?.includes('password')) {
              setRequiresPassword(true);
              setErrorMessage('This backup is encrypted. Please enter the decryption password below.');
              setIsProcessingZip(false);
              return;
            }
            throw err;
          }
        }

        // B) If no patients found via JSON, check for nested zip (e.g. FULL_BACKUP_*.zip)
        if (detectedPatients.length === 0) {
          const nestedZipName = Object.keys(zip.files).find(
            name => !zip.files[name].dir && name.toLowerCase().includes('full_backup') && name.endsWith('.zip')
          );
          if (nestedZipName) {
            const nestedZipBlob = await zip.files[nestedZipName].async('blob');
            const innerZip = await JSZip.loadAsync(nestedZipBlob);
            const innerJson = Object.keys(innerZip.files).find(
              name => !innerZip.files[name].dir && name.toLowerCase().endsWith('.json')
            );
            if (innerJson) {
              const text = await innerZip.files[innerJson].async('string');
              const decoded = await decryptJSON(text, password);
              if (Array.isArray(decoded)) {
                detectedPatients = decoded;
              }
            }
          }
        }

        // C) If still no JSON, parse aggregate_database_backup.csv or patients_export_*.csv + match photos
        if (detectedPatients.length === 0) {
          const csvEntryName = Object.keys(zip.files).find(
            name => !zip.files[name].dir && name.toLowerCase().endsWith('.csv')
          );
          if (csvEntryName) {
            const csvText = await zip.files[csvEntryName].async('string');
            const { headers, rows } = parseCSVText(csvText);
            const mappings = guessFieldMappings(headers);
            const existingSet = new Set<number>();
            detectedPatients = rows.map((r, idx) => convertRowToPatient(r, mappings, existingSet, idx + 1));

            // Scan photos inside zip
            const imageEntries = Object.keys(zip.files).filter(name => {
              const lower = name.toLowerCase();
              return !zip.files[name].dir && (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp'));
            });

            for (const imgPath of imageEntries) {
              const base64Str = await zip.files[imgPath].async('base64');
              const ext = imgPath.split('.').pop()?.toLowerCase() || 'png';
              const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
              const dataUrl = `data:${mime};base64,${base64Str}`;
              totalPhotosFound++;

              // Match photo to patient based on path or filename
              const pathLower = imgPath.toLowerCase();
              for (const p of detectedPatients) {
                const sNo = String(p.serialNo || '').toLowerCase();
                const adm = (p.admissionNo || '').toLowerCase();
                const name = (p.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

                const isMatch = (sNo && pathLower.includes(sNo)) || 
                                (adm && pathLower.includes(adm)) || 
                                (name && name.length > 2 && pathLower.includes(name));

                if (isMatch) {
                  if (pathLower.includes('lab')) p.labPhotoUrl = dataUrl;
                  else if (pathLower.includes('angiogram')) p.angiogramPhotoUrl = dataUrl;
                  else if (pathLower.includes('pci')) p.pciPhotoUrl = dataUrl;
                  else if (pathLower.includes('imaging')) p.imagingPhotoUrl = dataUrl;
                  else if (pathLower.includes('other_info') || pathLower.includes('other')) p.otherInfoPhotoUrl = dataUrl;
                  else if (pathLower.includes('demographics') || pathLower.includes('demo')) p.demographicsPhotoUrl = dataUrl;
                }
              }
            }
          }
        }
      } else {
        // Uncompressed Folder upload (FileList with multiple files)
        const jsonFileEntry = fileArray.find(f => f.name.toLowerCase().endsWith('.json'));
        if (jsonFileEntry) {
          const text = await jsonFileEntry.text();
          try {
            const decoded = await decryptJSON(text, password);
            if (Array.isArray(decoded)) {
              detectedPatients = decoded;
            }
          } catch (err: any) {
            if (err.message?.includes('encrypted') || err.message?.includes('password')) {
              setRequiresPassword(true);
              setErrorMessage('This backup is encrypted. Please enter the decryption password below.');
              setIsProcessingZip(false);
              return;
            }
            throw err;
          }
        }

        if (detectedPatients.length === 0) {
          const csvFileEntry = fileArray.find(f => f.name.toLowerCase().endsWith('.csv'));
          if (csvFileEntry) {
            const csvText = await csvFileEntry.text();
            const { headers, rows } = parseCSVText(csvText);
            const mappings = guessFieldMappings(headers);
            const existingSet = new Set<number>();
            detectedPatients = rows.map((r, idx) => convertRowToPatient(r, mappings, existingSet, idx + 1));

            // Read image files in folder
            const imageFiles = fileArray.filter(f => {
              const lower = f.name.toLowerCase();
              return lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp');
            });

            for (const imgFile of imageFiles) {
              const dataUrl = await readFileAsDataURL(imgFile);
              totalPhotosFound++;
              const pathLower = ((imgFile as any).webkitRelativePath || imgFile.name).toLowerCase();

              for (const p of detectedPatients) {
                const sNo = String(p.serialNo || '').toLowerCase();
                const adm = (p.admissionNo || '').toLowerCase();
                const name = (p.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

                const isMatch = (sNo && pathLower.includes(sNo)) || 
                                (adm && pathLower.includes(adm)) || 
                                (name && name.length > 2 && pathLower.includes(name));

                if (isMatch) {
                  if (pathLower.includes('lab')) p.labPhotoUrl = dataUrl;
                  else if (pathLower.includes('angiogram')) p.angiogramPhotoUrl = dataUrl;
                  else if (pathLower.includes('pci')) p.pciPhotoUrl = dataUrl;
                  else if (pathLower.includes('imaging')) p.imagingPhotoUrl = dataUrl;
                  else if (pathLower.includes('other_info') || pathLower.includes('other')) p.otherInfoPhotoUrl = dataUrl;
                  else if (pathLower.includes('demographics') || pathLower.includes('demo')) p.demographicsPhotoUrl = dataUrl;
                }
              }
            }
          }
        }
      }

      // Count total photos attached in detectedPatients
      if (totalPhotosFound === 0) {
        totalPhotosFound = detectedPatients.reduce((acc, p) => {
          let count = 0;
          if (p.labPhotoUrl) count++;
          if (p.angiogramPhotoUrl) count++;
          if (p.pciPhotoUrl) count++;
          if (p.imagingPhotoUrl) count++;
          if (p.otherInfoPhotoUrl) count++;
          if (p.demographicsPhotoUrl) count++;
          return acc + count;
        }, 0);
      }

      if (detectedPatients.length === 0) {
        setErrorMessage('No valid patient database records (JSON/CSV) were found in the uploaded file/folder.');
      } else {
        setParsedPatients(detectedPatients);
        setPhotoCount(totalPhotosFound);
        triggerVibrate();
      }
    } catch (err: any) {
      console.error('Failed to parse export package:', err);
      setErrorMessage(err.message || 'Error processing backup folder or zip file.');
    } finally {
      setIsProcessingZip(false);
    }
  };

  const handleConfirmZipRestore = async () => {
    if (!parsedPatients || parsedPatients.length === 0) return;
    try {
      await onImportComplete(parsedPatients, importMode === 'overwrite' ? 'overwrite' : 'add');
      triggerVibrate();
      onClose();
    } catch (err: any) {
      setErrorMessage('Failed to apply database restore: ' + err.message);
    }
  };

  const handleJsonRestoreSubmit = async () => {
    if (!jsonFile) return;
    setIsRestoringJson(true);
    setErrorMessage(null);
    try {
      const text = await jsonFile.text();
      const decoded = await decryptJSON(text, jsonPassword || undefined);
      if (!Array.isArray(decoded)) {
        throw new Error('Invalid JSON format. Expected an array of patient records.');
      }
      await onImportComplete(decoded, 'overwrite');
      triggerVibrate();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error restoring JSON backup.');
    } finally {
      setIsRestoringJson(false);
    }
  };

  const handleDriveRestoreSubmit = async () => {
    if (!selectedDriveFileId) return;
    setIsRestoringDrive(true);
    setErrorMessage(null);
    try {
      await onRestoreFromDrive(selectedDriveFileId, drivePassword || undefined);
      triggerVibrate();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to restore from Google Drive.');
    } finally {
      setIsRestoringDrive(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] my-auto">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600/30 text-blue-400 rounded-xl border border-blue-500/30">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                Restore Full Database & Photos
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Multiple Pathways
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Recover patient records, clinical data, and high-resolution photo assets from 'All' export packages, ZIPs, or cloud storage.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 pt-2 flex items-center gap-1 overflow-x-auto shrink-0 scrollbar-none">
          <button
            onClick={() => { setActiveTab('all_folder'); setErrorMessage(null); }}
            className={cn(
              "px-3 py-2 text-[11px] font-bold rounded-t-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer border-b-2",
              activeTab === 'all_folder'
                ? "bg-white text-blue-600 border-blue-600 shadow-xs"
                : "text-slate-500 hover:text-slate-800 border-transparent hover:bg-slate-100"
            )}
          >
            <FolderArchive className="w-3.5 h-3.5 text-blue-600" />
            1. 'All' Export Package / ZIP
          </button>

          <button
            onClick={() => { setActiveTab('json'); setErrorMessage(null); }}
            className={cn(
              "px-3 py-2 text-[11px] font-bold rounded-t-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer border-b-2",
              activeTab === 'json'
                ? "bg-white text-emerald-600 border-emerald-600 shadow-xs"
                : "text-slate-500 hover:text-slate-800 border-transparent hover:bg-slate-100"
            )}
          >
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            2. JSON Backup File
          </button>

          <button
            onClick={() => { setActiveTab('csv'); setErrorMessage(null); }}
            className={cn(
              "px-3 py-2 text-[11px] font-bold rounded-t-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer border-b-2",
              activeTab === 'csv'
                ? "bg-white text-violet-600 border-violet-600 shadow-xs"
                : "text-slate-500 hover:text-slate-800 border-transparent hover:bg-slate-100"
            )}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-violet-600" />
            3. CSV / Excel Spreadsheet
          </button>

          <button
            onClick={() => { setActiveTab('drive'); setErrorMessage(null); }}
            className={cn(
              "px-3 py-2 text-[11px] font-bold rounded-t-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer border-b-2",
              activeTab === 'drive'
                ? "bg-white text-sky-600 border-sky-600 shadow-xs"
                : "text-slate-500 hover:text-slate-800 border-transparent hover:bg-slate-100"
            )}
          >
            <Cloud className="w-3.5 h-3.5 text-sky-600" />
            4. Google Drive
          </button>

          <button
            onClick={() => { setActiveTab('snapshots'); setErrorMessage(null); }}
            className={cn(
              "px-3 py-2 text-[11px] font-bold rounded-t-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer border-b-2",
              activeTab === 'snapshots'
                ? "bg-white text-amber-600 border-amber-600 shadow-xs"
                : "text-slate-500 hover:text-slate-800 border-transparent hover:bg-slate-100"
            )}
          >
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            5. Auto Snapshots
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">

          {/* Global Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 animate-shake">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-red-700 leading-relaxed">{errorMessage}</p>
            </div>
          )}

          {/* TAB 1: ALL EXPORT PACKAGE / ZIP / FOLDER RESTORE */}
          {activeTab === 'all_folder' && (
            <div className="space-y-4">
              <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3.5 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                    Full Database & Photo Recovery Engine
                  </h4>
                  <p className="text-[11px] text-blue-700 leading-relaxed">
                    Upload the <span className="font-semibold text-blue-900">.zip</span> downloaded using the "All" export option, or select an uncompressed <span className="font-semibold text-blue-900">Cath data folder</span>. The system automatically extracts database JSON, converts photo image files back into base64 Data URLs, and re-links them to patient profiles.
                  </p>
                </div>
              </div>

              {!parsedPatients ? (
                <div className="space-y-3">
                  {/* Dropzone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        setZipOrFolderFile(e.dataTransfer.files[0]);
                        processZipOrFolderFiles(e.dataTransfer.files);
                      }
                    }}
                    className={cn(
                      "border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 bg-white",
                      dragActive ? "border-blue-500 bg-blue-50/20 shadow-md scale-[0.99]" : "border-slate-300 hover:border-slate-400"
                    )}
                  >
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shadow-xs">
                      {isProcessingZip ? <Loader2 className="w-6 h-6 animate-spin" /> : <FolderArchive className="w-6 h-6" />}
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-800">
                        Drag & drop "Cath data" ZIP archive or exported folder here
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Supports <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">Cath data-*.zip</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">FULL_BACKUP_*.zip</code>, or extracted folders.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isProcessingZip}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Upload className="w-3.5 h-3.5" /> Select ZIP File
                      </button>

                      <button
                        type="button"
                        onClick={() => folderInputRef.current?.click()}
                        disabled={isProcessingZip}
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                      >
                        <FolderSearch className="w-3.5 h-3.5" /> Select Extracted Folder
                      </button>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".zip"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          setZipOrFolderFile(e.target.files[0]);
                          processZipOrFolderFiles(e.target.files);
                        }
                      }}
                    />

                    <input
                      ref={folderInputRef}
                      type="file"
                      // @ts-ignore
                      webkitdirectory=""
                      directory=""
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          setZipOrFolderFile(e.target.files[0]);
                          processZipOrFolderFiles(e.target.files);
                        }
                      }}
                    />
                  </div>

                  {requiresPassword && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-amber-600" />
                        <p className="text-xs font-bold text-amber-900">Encrypted Backup Password Required</p>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          placeholder="Enter AES-256 decryption password"
                          className="flex-1 bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-amber-500"
                          value={zipPassword}
                          onChange={(e) => setZipPassword(e.target.value)}
                        />
                        <button
                          onClick={() => {
                            if (zipOrFolderFile) processZipOrFolderFiles([zipOrFolderFile], zipPassword);
                          }}
                          className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold uppercase rounded-lg shadow-xs cursor-pointer"
                        >
                          Decrypt
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* PREVIEW STATE */
                <div className="space-y-4 animate-fade-in">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-emerald-500 text-white rounded-xl shadow-xs">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                          Package Analysis Complete
                        </h4>
                        <p className="text-[11px] text-emerald-700 mt-0.5 font-medium">
                          Found <span className="font-bold text-emerald-900">{parsedPatients.length} patient records</span> and <span className="font-bold text-emerald-900">{photoCount} photo assets</span>.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={resetZipState}
                      className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer transition-colors"
                    >
                      Change Package
                    </button>
                  </div>

                  {/* Mode Selector */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Restoration Strategy</p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className={cn(
                        "p-2.5 rounded-lg border cursor-pointer transition-all flex items-start gap-2",
                        importMode === 'overwrite' ? "bg-blue-50/80 border-blue-300 text-blue-900" : "bg-white border-slate-200 text-slate-700"
                      )}>
                        <input
                          type="radio"
                          name="importMode"
                          checked={importMode === 'overwrite'}
                          onChange={() => setImportMode('overwrite')}
                          className="mt-0.5 text-blue-600"
                        />
                        <div>
                          <p className="text-xs font-bold">Replace Current Database</p>
                          <p className="text-[10px] opacity-80 leading-tight">Completely replaces existing local database with this package.</p>
                        </div>
                      </label>

                      <label className={cn(
                        "p-2.5 rounded-lg border cursor-pointer transition-all flex items-start gap-2",
                        importMode === 'add' ? "bg-blue-50/80 border-blue-300 text-blue-900" : "bg-white border-slate-200 text-slate-700"
                      )}>
                        <input
                          type="radio"
                          name="importMode"
                          checked={importMode === 'add'}
                          onChange={() => setImportMode('add')}
                          className="mt-0.5 text-blue-600"
                        />
                        <div>
                          <p className="text-xs font-bold">Merge & Add New Records</p>
                          <p className="text-[10px] opacity-80 leading-tight">Appends non-duplicate patient records to your current database.</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Patient List Preview */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    <div className="bg-slate-100 px-3 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-wider grid grid-cols-12 gap-2">
                      <span className="col-span-2">Serial</span>
                      <span className="col-span-4">Patient Name</span>
                      <span className="col-span-3">Admission</span>
                      <span className="col-span-3 text-right">Photos Linked</span>
                    </div>
                    <div className="divide-y divide-slate-100 bg-white">
                      {parsedPatients.map((p, idx) => {
                        let photos = 0;
                        if (p.labPhotoUrl) photos++;
                        if (p.angiogramPhotoUrl) photos++;
                        if (p.pciPhotoUrl) photos++;
                        if (p.imagingPhotoUrl) photos++;
                        if (p.otherInfoPhotoUrl) photos++;
                        if (p.demographicsPhotoUrl) photos++;
                        return (
                          <div key={idx} className="px-3 py-1.5 text-xs grid grid-cols-12 gap-2 items-center hover:bg-slate-50">
                            <span className="col-span-2 font-mono font-bold text-slate-600">{p.serialNo || '-'}</span>
                            <span className="col-span-4 font-semibold text-slate-800 truncate">{p.name || 'Unnamed'}</span>
                            <span className="col-span-3 font-mono text-slate-500 truncate">{p.admissionNo || '-'}</span>
                            <span className="col-span-3 text-right font-medium text-blue-600 flex items-center justify-end gap-1">
                              <ImageIcon className="w-3 h-3 text-blue-500" /> {photos} assets
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    onClick={handleConfirmZipRestore}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Restore Database ({parsedPatients.length} Patients + {photoCount} Photos)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SINGLE JSON FILE RESTORE */}
          {activeTab === 'json' && (
            <div className="space-y-4">
              <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3.5 flex items-start gap-3">
                <Database className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                    Single JSON Backup Restore
                  </h4>
                  <p className="text-[11px] text-emerald-700 leading-relaxed">
                    Restore from a standalone <code className="bg-emerald-100 px-1 py-0.5 rounded text-emerald-800 font-mono">.json</code> backup file. If client-side AES-GCM 256 encryption was enabled during export, enter your encryption password below.
                  </p>
                </div>
              </div>

              <div
                onClick={() => jsonInputRef.current?.click()}
                className="border-2 border-dashed border-emerald-300 hover:border-emerald-400 bg-emerald-50/20 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2"
              >
                <Upload className="w-8 h-8 text-emerald-600" />
                <p className="text-xs font-bold text-slate-800">
                  {jsonFile ? jsonFile.name : 'Click to browse JSON backup file'}
                </p>
                <p className="text-[10px] text-slate-500">
                  {jsonFile ? `${(jsonFile.size / 1024).toFixed(1)} KB` : 'Supports plain or password-encrypted JSON files'}
                </p>
                <input
                  ref={jsonInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) setJsonFile(e.target.files[0]);
                  }}
                />
              </div>

              {jsonFile && (
                <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      placeholder="Decryption Password (If Encrypted)"
                      className="w-full bg-white border border-slate-300 rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                      value={jsonPassword}
                      onChange={(e) => setJsonPassword(e.target.value)}
                    />
                  </div>

                  <button
                    onClick={handleJsonRestoreSubmit}
                    disabled={isRestoringJson}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isRestoringJson ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Restore JSON Database
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CSV / EXCEL SPREADSHEET */}
          {activeTab === 'csv' && (
            <div className="space-y-4 text-center py-4">
              <div className="w-12 h-12 bg-violet-100 text-violet-600 rounded-2xl flex items-center justify-center mx-auto">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h4 className="text-sm font-bold text-slate-800">CSV & Excel Field Mapper</h4>
                <p className="text-xs text-slate-500">
                  Import tabular patient lists from Microsoft Excel or external EMR systems. Auto-detects headers, custom field mappings, and deduplication modes.
                </p>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenCsvImporter();
                }}
                className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-xs transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" /> Launch Interactive CSV Importer
              </button>
            </div>
          )}

          {/* TAB 4: GOOGLE DRIVE CLOUD */}
          {activeTab === 'drive' && (
            <div className="space-y-4">
              <div className="bg-sky-50/70 border border-sky-100 rounded-xl p-3.5 flex items-start gap-3">
                <Cloud className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-sky-900 uppercase tracking-wider">
                    Google Drive Cloud Database Restore
                  </h4>
                  <p className="text-[11px] text-sky-700 leading-relaxed">
                    Fetch and restore cloud snapshots directly from your private "CathData Backups" folder on Google Drive.
                  </p>
                </div>
              </div>

              {!driveAccessToken ? (
                <div className="text-center py-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <Cloud className="w-10 h-10 text-sky-500 mx-auto" />
                  <p className="text-xs text-slate-600 font-medium max-w-sm mx-auto">
                    Connect your Google account to list and restore cloud database backups.
                  </p>
                  <button
                    onClick={onConnectDrive}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer"
                  >
                    Connect Google Drive
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {isListingDrive ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin text-sky-600" /> Fetching cloud backups from Drive...
                    </div>
                  ) : driveBackups.length === 0 ? (
                    <p className="text-xs text-slate-400 italic text-center py-6">
                      No backups found in your "CathData Backups" Google Drive folder.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <select
                        value={selectedDriveFileId}
                        onChange={(e) => setSelectedDriveFileId(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        <option value="">-- Select a cloud backup to restore (Max 3 kept) --</option>
                        {driveBackups.map((f, idx) => (
                          <option key={f.id} value={f.id}>
                            {idx === 0 ? 'Latest 1 (Newest)' : idx === 1 ? 'Latest 2' : idx === 2 ? 'Latest 3 (Oldest)' : `Backup ${idx + 1}`} - {f.name} ({new Date(f.createdTime).toLocaleString()}, {(parseInt(f.size || '0') / 1024).toFixed(1)} KB)
                          </option>
                        ))}
                      </select>

                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="password"
                          placeholder="Decryption Password (If Cloud Backup Encrypted)"
                          className="w-full bg-white border border-slate-300 rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-sky-500"
                          value={drivePassword}
                          onChange={(e) => setDrivePassword(e.target.value)}
                        />
                      </div>

                      <button
                        onClick={handleDriveRestoreSubmit}
                        disabled={!selectedDriveFileId || isRestoringDrive}
                        className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        {isRestoringDrive ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                        Restore Drive Cloud Snapshot
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: LOCAL SNAPSHOT SLOTS */}
          {activeTab === 'snapshots' && (
            <div className="space-y-4">
              <div className="bg-amber-50/70 border border-amber-100 rounded-xl p-3.5 flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                    Rolling Local IndexedDB Snapshots
                  </h4>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    The app automatically maintains two rolling database snapshots in browser storage. One-click instant restore.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3 flex flex-col justify-between">
                  <div>
                    <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-500" /> Slot 1 (Newer)
                    </h5>
                    {autoBackups.backup1 ? (
                      <div className="mt-2 text-xs text-slate-600 space-y-0.5">
                        <p>Saved: <span className="font-semibold text-slate-800">{new Date(autoBackups.backup1.timestamp).toLocaleString()}</span></p>
                        <p>Records: <span className="font-semibold text-slate-800">{autoBackups.backup1.data.length} patients</span></p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic mt-2">No snapshot available</p>
                    )}
                  </div>
                  {autoBackups.backup1 && (
                    <button
                      onClick={async () => {
                        await onRestoreAutoBackup('backup1');
                        onClose();
                      }}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase rounded-lg cursor-pointer"
                    >
                      Restore Slot 1
                    </button>
                  )}
                </div>

                <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3 flex flex-col justify-between">
                  <div>
                    <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" /> Slot 2 (Older)
                    </h5>
                    {autoBackups.backup2 ? (
                      <div className="mt-2 text-xs text-slate-600 space-y-0.5">
                        <p>Saved: <span className="font-semibold text-slate-800">{new Date(autoBackups.backup2.timestamp).toLocaleString()}</span></p>
                        <p>Records: <span className="font-semibold text-slate-800">{autoBackups.backup2.data.length} patients</span></p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic mt-2">No snapshot available</p>
                    )}
                  </div>
                  {autoBackups.backup2 && (
                    <button
                      onClick={async () => {
                        await onRestoreAutoBackup('backup2');
                        onClose();
                      }}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold uppercase rounded-lg cursor-pointer"
                    >
                      Restore Slot 2
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] text-slate-500 font-medium">
            Database contains {existingPatients.length} active patient records.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
