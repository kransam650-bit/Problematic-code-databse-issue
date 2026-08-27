import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  X,
  FileText,
  SlidersHorizontal,
  RefreshCw,
  Sparkles,
  Download,
  Database,
  Check,
  Trash2,
  Settings2,
  Info
} from 'lucide-react';
import { Patient } from '../types';
import {
  parseCSVText,
  guessFieldMappings,
  convertRowToPatient,
  getSuggestedField,
  PATIENT_FIELDS,
  CSVParseResult
} from '../utils/csvParser';

interface CsvImporterProps {
  isOpen: boolean;
  onClose: () => void;
  existingPatients: Patient[];
  onImportComplete: (importedPatients: Patient[], mode: 'add' | 'overwrite' | 'skip') => Promise<void>;
  triggerVibrate?: () => void;
}

export function CsvImporter({
  isOpen,
  onClose,
  existingPatients,
  onImportComplete,
  triggerVibrate
}: CsvImporterProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [csvResult, setCsvResult] = useState<CSVParseResult | null>(null);
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});
  const [duplicateStrategy, setDuplicateStrategy] = useState<'renumber' | 'skip' | 'overwrite'>('renumber');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [mappingStatusFilter, setMappingStatusFilter] = useState<'all' | 'mapped' | 'unmapped' | 'duplicate'>('all');
  const [searchHeader, setSearchHeader] = useState<string>('');
  const [sampleRowIndex, setSampleRowIndex] = useState<number>(0);
  const [showDefaultsPanel, setShowDefaultsPanel] = useState<boolean>(false);
  const [fallbackDefaults, setFallbackDefaults] = useState<Record<string, string>>({
    serviceCategory: 'Ser',
    category: 'CAG',
    place: '',
    gender: 'Male'
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Highest existing serial number for auto-renumbering
  const maxExistingSerialNo = useMemo(() => {
    if (!existingPatients || existingPatients.length === 0) return 0;
    return Math.max(...existingPatients.map(p => p.serialNo || 0), 0);
  }, [existingPatients]);

  const existingSerialSet = useMemo(() => {
    return new Set(existingPatients.map(p => p.serialNo).filter(Boolean));
  }, [existingPatients]);

  // Handle File Load
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = (fileToProcess: File) => {
    setFile(fileToProcess);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const parsed = parseCSVText(text);
        setCsvResult(parsed);
        const guessed = guessFieldMappings(parsed.headers);
        setFieldMappings(guessed);
        setSampleRowIndex(0);
        setStep(2);
      }
    };
    reader.readAsText(fileToProcess);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && (droppedFile.name.endsWith('.csv') || droppedFile.type === 'text/csv')) {
      processFile(droppedFile);
    }
  };

  // Set of all target keys currently mapped
  const mappedTargetSet = useMemo(() => {
    return new Set(Object.values(fieldMappings).filter(Boolean));
  }, [fieldMappings]);

  // Target mapped counts (to detect duplicates where 2 headers map to same field)
  const mappedTargetCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(fieldMappings).forEach(targetKey => {
      if (targetKey) {
        counts[targetKey] = (counts[targetKey] || 0) + 1;
      }
    });
    return counts;
  }, [fieldMappings]);

  // Check if Patient Name is mapped
  const isNameMapped = useMemo(() => {
    return Object.values(fieldMappings).includes('name');
  }, [fieldMappings]);

  // Convert mapped CSV rows to Patient objects for preview
  const parsedPreviewPatients = useMemo(() => {
    if (!csvResult || !csvResult.rows) return [];

    let currentAutoSerial = maxExistingSerialNo;

    return csvResult.rows.map(rowObj => {
      currentAutoSerial += 1;
      return convertRowToPatient(
        rowObj,
        fieldMappings,
        existingSerialSet,
        currentAutoSerial,
        fallbackDefaults
      );
    });
  }, [csvResult, fieldMappings, maxExistingSerialNo, existingSerialSet, fallbackDefaults]);

  // Quick Action: Auto Map All
  const handleAutoMapAll = () => {
    if (!csvResult) return;
    const guessed = guessFieldMappings(csvResult.headers);
    setFieldMappings(guessed);
  };

  // Quick Action: Clear All
  const handleClearAllMappings = () => {
    if (!csvResult) return;
    const cleared: Record<string, string> = {};
    csvResult.headers.forEach(h => { cleared[h] = ''; });
    setFieldMappings(cleared);
  };

  // Download CSV Template
  const downloadSampleTemplate = () => {
    const headers = [
      'Serial No', 'Ser No', 'Service Status', 'Admission No', 'Name', 'Age', 'Gender',
      'Weight', 'Height', 'BMI', 'Phones', 'Date', 'Presentation', 'TMT', 'EF', 'RWMA',
      'Comorbidities', 'Access', 'USG Doppler', 'Bifurcation', 'PCI Vessels', 'Imaging',
      'Special Hardware', 'Stent Details', 'Closure Device', 'Complications', 'Drugs',
      'Final Notes', 'Category', 'Place'
    ];
    const sampleRow = [
      '01', 'SER-101', 'Ser', 'ADM-2026-88', 'John Doe', '58', 'Male',
      '72', '170', '24.9', '9876543210', '2026-07-22', 'STEMI', '+', 'Normal', 'LAD|RCA',
      'HTN|T2DM', 'Rt radial', 'Yes', 'No', 'LAD|LCX', 'IVUS',
      'Cutting', 'DES 3.5x28mm|DES 3.0x18mm', 'Angio-Seal', 'Slow flow', 'Aspirin|Clopidogrel|Ticagrelor',
      'Successful primary PCI to LAD with 2 DES. Flow restored TIMI III.', 'CAG+PCI', 'New Delhi'
    ];

    const csvContent = [headers.join(','), sampleRow.map(cell => `"${cell}"`).join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'cathdata_patient_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Execute Import
  const handleExecuteImport = async () => {
    if (parsedPreviewPatients.length === 0) return;
    setIsImporting(true);
    triggerVibrate?.();

    try {
      let finalPatientsToSave: Patient[] = [];

      if (duplicateStrategy === 'renumber') {
        let serialNoCounter = maxExistingSerialNo;
        finalPatientsToSave = parsedPreviewPatients.map(p => {
          serialNoCounter++;
          return {
            ...p,
            serialNo: serialNoCounter,
            patientId: `PAT-${String(serialNoCounter).padStart(2, '0')}`
          };
        });
      } else if (duplicateStrategy === 'skip') {
        finalPatientsToSave = parsedPreviewPatients.filter(p => !existingSerialSet.has(p.serialNo));
      } else {
        // overwrite
        finalPatientsToSave = [...parsedPreviewPatients];
      }

      setImportProgress(50);
      await onImportComplete(finalPatientsToSave, duplicateStrategy === 'overwrite' ? 'overwrite' : 'add');
      setImportProgress(100);

      setTimeout(() => {
        setIsImporting(false);
        resetState();
        onClose();
      }, 400);
    } catch (err) {
      console.error('Import error:', err);
      setIsImporting(false);
    }
  };

  const resetState = () => {
    setStep(1);
    setFile(null);
    setCsvResult(null);
    setFieldMappings({});
    setIsImporting(false);
    setImportProgress(0);
    setSearchHeader('');
    setFilterCategory('All');
    setMappingStatusFilter('all');
    setShowDefaultsPanel(false);
  };

  if (!isOpen) return null;

  const totalHeaders = csvResult?.headers.length || 0;
  const mappedCount = Object.values(fieldMappings).filter(Boolean).length;
  const unmappedCount = totalHeaders - mappedCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-5 bg-slate-900/60 backdrop-blur-sm animate-fade-in font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center border border-blue-200 shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                Import Patients from CSV
                <span className="text-[10px] uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-bold">
                  Column Field Mapping
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Map columns from custom spreadsheets into CathData clinical patient fields.
              </p>
            </div>
          </div>
          <button
            onClick={() => { resetState(); onClose(); }}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Stepper */}
        <div className="px-8 py-3 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-600">
          <div className={`flex items-center gap-2 ${step === 1 ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 1 ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-600'}`}>1</span>
            Upload File
          </div>
          <div className="w-12 h-0.5 bg-slate-300" />
          <div className={`flex items-center gap-2 ${step === 2 ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 2 ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-600'}`}>2</span>
            Map Columns
          </div>
          <div className="w-12 h-0.5 bg-slate-300" />
          <div className={`flex items-center gap-2 ${step === 3 ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 3 ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-600'}`}>3</span>
            Preview & Confirm
          </div>
        </div>

        {/* Body Steps */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-5">

          {/* STEP 1: UPLOAD CSV */}
          {step === 1 && (
            <div className="space-y-6">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-4 ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50/60 scale-[0.99]'
                    : 'border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-slate-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
                  <Upload className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-800">
                    Click to browse or drop your CSV file here
                  </h4>
                  <p className="text-xs text-slate-400">
                    Supports .CSV files exported from Excel, Google Sheets, or hospital EMR databases
                  </p>
                </div>
                <div className="pt-2 flex items-center gap-2">
                  <span className="text-[10px] font-bold px-3 py-1 bg-white border border-slate-200 text-slate-600 rounded-full shadow-2xs">
                    Auto-Delimiter Detection
                  </span>
                  <span className="text-[10px] font-bold px-3 py-1 bg-white border border-slate-200 text-slate-600 rounded-full shadow-2xs">
                    UTF-8 Encoded
                  </span>
                </div>
              </div>

              {/* Sample Template & Instructions */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-600 shrink-0" />
                  <div>
                    <h5 className="text-xs font-bold text-slate-700">Need a sample CSV file?</h5>
                    <p className="text-[11px] text-slate-500">
                      Download our pre-formatted template matching all CathData clinical fields.
                    </p>
                  </div>
                </div>
                <button
                  onClick={downloadSampleTemplate}
                  className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  Sample CSV Template
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: FIELD MAPPING */}
          {step === 2 && csvResult && (
            <div className="space-y-4">
              {/* Info & Stats Banner */}
              <div className="p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50/50 border border-blue-200/80 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-slate-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    File: <strong className="text-blue-950 font-bold">{file?.name}</strong> • Detected <strong>{totalHeaders} columns</strong> & <strong>{csvResult.rows.length} rows</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleAutoMapAll}
                    className="px-3 py-1 bg-white hover:bg-blue-100 text-blue-700 font-bold rounded-lg border border-blue-200 text-xs flex items-center gap-1 shadow-2xs cursor-pointer transition-all"
                    title="Auto-detect mapping using smart keywords"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Re-Auto Map All
                  </button>
                  <button
                    onClick={handleClearAllMappings}
                    className="px-3 py-1 bg-white hover:bg-rose-50 text-rose-600 font-bold rounded-lg border border-slate-200 text-xs flex items-center gap-1 shadow-2xs cursor-pointer transition-all"
                    title="Clear all column assignments"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Clear All
                  </button>
                </div>
              </div>

              {/* Warnings Row: Required Name Field or Duplicate Targets */}
              <div className="space-y-2">
                {!isNameMapped && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900 animate-fade-in">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        <strong>Required Field Missing:</strong> "Patient Name" is currently unmapped. Unnamed rows will default to "Unnamed Patient".
                      </span>
                    </div>
                    {csvResult.headers.find(h => /name|patient|pt/i.test(h)) && (
                      <button
                        onClick={() => {
                          const targetH = csvResult.headers.find(h => /name|patient|pt/i.test(h));
                          if (targetH) {
                            setFieldMappings(prev => ({ ...prev, [targetH]: 'name' }));
                          }
                        }}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px] shrink-0 cursor-pointer shadow-xs transition-all"
                      >
                        Auto-Map Name to "{csvResult.headers.find(h => /name|patient|pt/i.test(h))}"
                      </button>
                    )}
                  </div>
                )}

                {/* Duplicate target warning */}
                {Object.entries(mappedTargetCounts).some(([_, count]) => count > 1) && (
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center gap-2 text-xs text-indigo-900">
                    <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>
                      <strong>Notice:</strong> Multiple CSV columns are mapped to the same field (e.g., {
                        Object.entries(mappedTargetCounts)
                          .filter(([_, count]) => count > 1)
                          .map(([key]) => PATIENT_FIELDS.find(f => f.key === key)?.label || key)
                          .join(', ')
                      }). The rightmost non-empty column value will take precedence.
                    </span>
                  </div>
                )}
              </div>

              {/* Filtering Controls & Sample Row Selector */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  {/* Status Pills */}
                  <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-2xs">
                    <button
                      onClick={() => setMappingStatusFilter('all')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                        mappingStatusFilter === 'all' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      All ({totalHeaders})
                    </button>
                    <button
                      onClick={() => setMappingStatusFilter('mapped')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                        mappingStatusFilter === 'mapped' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Mapped ({mappedCount})
                    </button>
                    <button
                      onClick={() => setMappingStatusFilter('unmapped')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                        mappingStatusFilter === 'unmapped' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Unmapped ({unmappedCount})
                    </button>
                  </div>

                  {/* Sample Row Switcher */}
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <span>Sample Data Row:</span>
                    <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shadow-2xs">
                      {[0, 1, 2].map((idx) => (
                        <button
                          key={idx}
                          disabled={!csvResult.rows[idx]}
                          onClick={() => setSampleRowIndex(idx)}
                          className={`px-2 py-0.5 text-[11px] font-bold rounded transition-all ${
                            sampleRowIndex === idx
                              ? 'bg-slate-800 text-white'
                              : 'text-slate-600 hover:bg-slate-100 disabled:opacity-30'
                          }`}
                        >
                          Row {idx + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Categories & Search */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-slate-200/80">
                  <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                    {['All', 'Demographics', 'Clinical', 'Procedure', 'Labs', 'Notes & Other'].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setFilterCategory(cat)}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-md whitespace-nowrap transition-all ${
                          filterCategory === cat ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    placeholder="Search column name..."
                    value={searchHeader}
                    onChange={(e) => setSearchHeader(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium w-48 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Mapping List Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[380px] overflow-y-auto bg-white shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700 uppercase text-[10px] tracking-wider sticky top-0 z-10 shadow-2xs">
                    <tr>
                      <th className="px-4 py-2.5 w-1/3">CSV Column Header</th>
                      <th className="px-4 py-2.5 w-1/4">Sample Value (Row {sampleRowIndex + 1})</th>
                      <th className="px-4 py-2.5 w-5/12">Target Patient Field</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {csvResult.headers
                      .filter((header) => {
                        // Search
                        if (searchHeader && !header.toLowerCase().includes(searchHeader.toLowerCase())) return false;

                        // Status filter
                        const targetKey = fieldMappings[header];
                        if (mappingStatusFilter === 'mapped' && !targetKey) return false;
                        if (mappingStatusFilter === 'unmapped' && targetKey) return false;
                        if (mappingStatusFilter === 'duplicate' && targetKey && mappedTargetCounts[targetKey] <= 1) return false;

                        // Category filter
                        if (filterCategory !== 'All') {
                          const targetDef = PATIENT_FIELDS.find(f => f.key === targetKey);
                          if (targetDef && targetDef.category !== filterCategory) return false;
                        }

                        return true;
                      })
                      .map((header) => {
                        const sampleVal = csvResult.rows[sampleRowIndex]?.[header] || '';
                        const currentMappedKey = fieldMappings[header] || '';
                        const targetDef = PATIENT_FIELDS.find(f => f.key === currentMappedKey);
                        const isDuplicate = currentMappedKey && mappedTargetCounts[currentMappedKey] > 1;

                        // Calculate single suggestion if unmapped
                        const suggestion = !currentMappedKey
                          ? getSuggestedField(header, mappedTargetSet)
                          : null;

                        return (
                          <tr key={header} className={`hover:bg-slate-50/90 transition-colors ${currentMappedKey ? 'bg-slate-50/30' : ''}`}>
                            {/* CSV Header name */}
                            <td className="px-4 py-2.5 font-bold text-slate-800">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${
                                  currentMappedKey ? (isDuplicate ? 'bg-indigo-500' : 'bg-emerald-500') : 'bg-slate-300'
                                }`} />
                                <span className="font-mono text-xs">{header}</span>
                              </div>
                            </td>

                            {/* Sample value */}
                            <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600 truncate max-w-[200px]" title={sampleVal}>
                              {sampleVal ? (
                                <span className="bg-slate-100/80 px-1.5 py-0.5 rounded border border-slate-200">
                                  {sampleVal}
                                </span>
                              ) : (
                                <span className="italic text-slate-400">Empty</span>
                              )}
                            </td>

                            {/* Mapping Select + Suggestion */}
                            <td className="px-4 py-2.5">
                              <div className="space-y-1">
                                <select
                                  value={currentMappedKey}
                                  onChange={(e) => {
                                    setFieldMappings({
                                      ...fieldMappings,
                                      [header]: e.target.value
                                    });
                                  }}
                                  className={`w-full py-1.5 px-3 rounded-lg border text-xs font-semibold outline-none transition-all cursor-pointer ${
                                    currentMappedKey
                                      ? isDuplicate
                                        ? 'bg-indigo-50/70 border-indigo-300 text-indigo-900 focus:ring-2 focus:ring-indigo-500'
                                        : 'bg-emerald-50/70 border-emerald-300 text-emerald-900 focus:ring-2 focus:ring-emerald-500'
                                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                  }`}
                                >
                                  <option value="">-- Skip Column (Do Not Import) --</option>
                                  {['Demographics', 'Clinical', 'Procedure', 'Labs', 'Notes & Other'].map(groupCat => (
                                    <optgroup key={groupCat} label={`--- ${groupCat} ---`}>
                                      {PATIENT_FIELDS.filter(f => f.category === groupCat).map(f => {
                                        const isAssigned = mappedTargetSet.has(f.key) && f.key !== currentMappedKey;
                                        return (
                                          <option key={f.key} value={f.key}>
                                            {f.label} {isAssigned ? '(Assigned)' : ''}
                                          </option>
                                        );
                                      })}
                                    </optgroup>
                                  ))}
                                </select>

                                {/* Inline Suggestion Pill if unmapped */}
                                {suggestion && (
                                  <div className="flex items-center gap-1 pt-0.5">
                                    <span className="text-[10px] text-slate-400 font-medium">Suggested:</span>
                                    <button
                                      onClick={() => {
                                        setFieldMappings(prev => ({ ...prev, [header]: suggestion.key }));
                                      }}
                                      className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-full flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                                    >
                                      <Sparkles className="w-2.5 h-2.5 text-blue-600" />
                                      {suggestion.label}
                                    </button>
                                  </div>
                                )}

                                {targetDef && (
                                  <div className="text-[10px] text-slate-400 font-medium pl-1">
                                    Category: <strong className="text-slate-600">{targetDef.category}</strong>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* Optional Fallback Defaults Panel */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/60">
                <button
                  type="button"
                  onClick={() => setShowDefaultsPanel(!showDefaultsPanel)}
                  className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                    <span>Fallback Default Values for Missing / Unmapped Fields</span>
                  </div>
                  <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">
                    {showDefaultsPanel ? 'Hide Defaults' : 'Show Defaults'}
                  </span>
                </button>

                {showDefaultsPanel && (
                  <div className="p-4 bg-white border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Default Service Category</label>
                      <select
                        value={fallbackDefaults.serviceCategory || 'Ser'}
                        onChange={(e) => setFallbackDefaults({ ...fallbackDefaults, serviceCategory: e.target.value })}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="Ser">Ser (Service)</option>
                        <option value="Vet">Vet (Veteran)</option>
                        <option value="Dep">Dep (Dependant)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Default Report Category</label>
                      <select
                        value={fallbackDefaults.category || 'CAG'}
                        onChange={(e) => setFallbackDefaults({ ...fallbackDefaults, category: e.target.value })}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="CAG">CAG</option>
                        <option value="CAG+PCI">CAG+PCI</option>
                        <option value="PCI">PCI</option>
                        <option value="ECHO">ECHO</option>
                        <option value="TMT">TMT</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Default Gender</label>
                      <select
                        value={fallbackDefaults.gender || 'Male'}
                        onChange={(e) => setFallbackDefaults({ ...fallbackDefaults, gender: e.target.value })}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Default City / Place</label>
                      <input
                        type="text"
                        placeholder="e.g. Main Hospital"
                        value={fallbackDefaults.place || ''}
                        onChange={(e) => setFallbackDefaults({ ...fallbackDefaults, place: e.target.value })}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & CONFIRM */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Mapping Summary Chips */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600" /> Active Mapped Fields ({mappedCount})
                  </span>
                  <button
                    onClick={() => setStep(2)}
                    className="text-[11px] text-blue-600 font-bold hover:underline cursor-pointer"
                  >
                    Edit Mappings
                  </button>
                </h4>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {Object.entries(fieldMappings)
                    .filter(([_, targetKey]) => Boolean(targetKey))
                    .map(([header, targetKey]) => {
                      const fieldDef = PATIENT_FIELDS.find(f => f.key === targetKey);
                      return (
                        <span
                          key={header}
                          className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-700 font-medium flex items-center gap-1 shadow-2xs"
                        >
                          <span className="font-mono text-blue-600 font-bold">{header}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <strong className="text-emerald-700">{fieldDef?.label || targetKey}</strong>
                        </span>
                      );
                    })}
                </div>
              </div>

              {/* Duplicate Strategy Settings */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-blue-600" /> Serial Number & Duplicate Strategy
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label
                    onClick={() => setDuplicateStrategy('renumber')}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                      duplicateStrategy === 'renumber'
                        ? 'bg-blue-50/80 border-blue-400 text-blue-900 font-bold shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="strat"
                      checked={duplicateStrategy === 'renumber'}
                      onChange={() => setDuplicateStrategy('renumber')}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="block font-bold">Auto-Renumber</span>
                      <span className="text-[10px] text-slate-500 font-normal leading-tight block pt-0.5">
                        Assign new sequential Serial Nos starting after #{maxExistingSerialNo}
                      </span>
                    </div>
                  </label>

                  <label
                    onClick={() => setDuplicateStrategy('skip')}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                      duplicateStrategy === 'skip'
                        ? 'bg-blue-50/80 border-blue-400 text-blue-900 font-bold shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="strat"
                      checked={duplicateStrategy === 'skip'}
                      onChange={() => setDuplicateStrategy('skip')}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="block font-bold">Skip Duplicates</span>
                      <span className="text-[10px] text-slate-500 font-normal leading-tight block pt-0.5">
                        Ignore rows whose Serial No matches existing patient records
                      </span>
                    </div>
                  </label>

                  <label
                    onClick={() => setDuplicateStrategy('overwrite')}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                      duplicateStrategy === 'overwrite'
                        ? 'bg-blue-50/80 border-blue-400 text-blue-900 font-bold shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="strat"
                      checked={duplicateStrategy === 'overwrite'}
                      onChange={() => setDuplicateStrategy('overwrite')}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="block font-bold">Overwrite Existing</span>
                      <span className="text-[10px] text-slate-500 font-normal leading-tight block pt-0.5">
                        Replace existing patient records sharing identical Serial Nos
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Preview Records Count */}
              <div className="flex items-center justify-between text-xs text-slate-600 font-semibold px-1">
                <span>Transformed Patient Records Preview ({parsedPreviewPatients.length} total)</span>
                <span className="text-emerald-600 flex items-center gap-1 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Ready for Import
                </span>
              </div>

              {/* Patient Records Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[280px] overflow-y-auto shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase text-[10px] tracking-wider sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2">S.No</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Age/Gender</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">Presentation</th>
                      <th className="px-3 py-2">PCI Vessels</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {parsedPreviewPatients.slice(0, 15).map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-3 py-1.5 font-mono text-blue-600 font-bold">#{p.serialNo}</td>
                        <td className="px-3 py-1.5 font-bold text-slate-900">{p.name}</td>
                        <td className="px-3 py-1.5 text-slate-500">{p.age} y / {p.gender}</td>
                        <td className="px-3 py-1.5 text-slate-500 font-mono">{p.date}</td>
                        <td className="px-3 py-1.5 font-semibold text-slate-700">{p.category}</td>
                        <td className="px-3 py-1.5 text-slate-600">{p.presentation}</td>
                        <td className="px-3 py-1.5">
                          {p.pciVessels && p.pciVessels.length > 0 ? (
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 font-bold rounded text-[10px]">
                              {p.pciVessels.join(', ')}
                            </span>
                          ) : (
                            <span className="text-slate-300 italic">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedPreviewPatients.length > 15 && (
                <p className="text-[11px] text-slate-400 text-center italic">
                  Showing first 15 of {parsedPreviewPatients.length} parsed patient records...
                </p>
              )}
            </div>
          )}
        </div>

        {/* Import Progress Overlay */}
        {isImporting && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-xs z-30 flex flex-col items-center justify-center p-6 space-y-4 animate-fade-in">
            <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin shadow-sm" />
            <div className="text-center space-y-1">
              <h4 className="text-sm font-bold text-slate-900">Importing Records into Clinical Database...</h4>
              <p className="text-xs text-slate-500">Writing {parsedPreviewPatients.length} patient records to persistent local database</p>
            </div>
            <div className="w-72 bg-slate-100 rounded-full h-3 p-0.5 overflow-hidden border border-slate-200 shadow-inner">
              <div className="bg-gradient-to-r from-emerald-600 to-teal-500 h-full transition-all duration-300 rounded-full" style={{ width: `${importProgress}%` }} />
            </div>
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-700">
              <span>{importProgress}%</span>
              <span className="text-slate-300">•</span>
              <span>{Math.round((importProgress / 100) * parsedPreviewPatients.length)} / {parsedPreviewPatients.length} records</span>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div>
            {step > 1 && (
              <button
                onClick={() => setStep((step - 1) as any)}
                disabled={isImporting}
                className="px-4 py-2 border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { resetState(); onClose(); }}
              disabled={isImporting}
              className="px-4 py-2 text-slate-500 hover:text-slate-700 text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>

            {step === 2 && (
              <button
                onClick={() => setStep(3)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-500/10 transition-all cursor-pointer"
              >
                Continue to Preview <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {step === 3 && (
              <button
                onClick={handleExecuteImport}
                disabled={isImporting || parsedPreviewPatients.length === 0}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-500/10 transition-all cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                Import {parsedPreviewPatients.length} Patient Records
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
