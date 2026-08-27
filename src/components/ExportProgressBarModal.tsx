import React from 'react';
import { Loader2, FolderArchive, FileSpreadsheet, Download, Database, FileText, FileCode, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface ExportProgressState {
  current: number;
  total: number;
  stage: 'combined' | 'zip' | 'csv' | 'xlsx' | 'sql' | 'md' | 'all' | null;
  message?: string;
}

interface ExportProgressBarModalProps {
  isExporting: boolean;
  progress: ExportProgressState | null;
}

export const ExportProgressBarModal: React.FC<ExportProgressBarModalProps> = ({ isExporting, progress }) => {
  if (!isExporting) return null;

  const current = progress?.current || 0;
  const total = progress?.total || 1;
  const rawPercentage = total > 0 ? Math.min(100, Math.max(0, Math.round((current / total) * 100))) : 0;
  const stage = progress?.stage || 'all';

  const getStageBadge = () => {
    switch (stage) {
      case 'all':
        return { label: 'ALL FORMATS & ZIP', color: 'bg-indigo-600 text-white', icon: FolderArchive };
      case 'zip':
        return { label: 'ZIP ARCHIVE & PHOTOS', color: 'bg-blue-600 text-white', icon: FolderArchive };
      case 'csv':
        return { label: 'CSV SPREADSHEET', color: 'bg-emerald-600 text-white', icon: FileSpreadsheet };
      case 'xlsx':
        return { label: 'EXCEL SPREADSHEET', color: 'bg-green-600 text-white', icon: FileSpreadsheet };
      case 'sql':
        return { label: 'SQL DATABASE DUMP', color: 'bg-amber-600 text-white', icon: Database };
      case 'md':
        return { label: 'MARKDOWN DOCUMENT', color: 'bg-slate-700 text-white', icon: FileText };
      case 'combined':
        return { label: 'CONSOLIDATED PDF', color: 'bg-rose-600 text-white', icon: FileCode };
      default:
        return { label: 'DATA EXPORT', color: 'bg-blue-600 text-white', icon: Download };
    }
  };

  const badge = getStageBadge();
  const IconComponent = badge.icon;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-md overflow-hidden p-6 space-y-5"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-2xs">
                <IconComponent className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  Exporting Clinical Data
                  <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                </h3>
                <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mt-0.5 ${badge.color}`}>
                  {badge.label}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-lg font-black text-blue-600 font-mono tracking-tight">
                {rawPercentage}%
              </span>
            </div>
          </div>

          {/* Progress Bar Container */}
          <div className="space-y-2">
            <div className="w-full bg-slate-100 rounded-full h-3 p-0.5 overflow-hidden border border-slate-200/60 shadow-inner">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 rounded-full shadow-xs"
                initial={{ width: '0%' }}
                animate={{ width: `${rawPercentage}%` }}
                transition={{ ease: 'easeOut', duration: 0.2 }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 font-mono">
              <span>Progress</span>
              <span>
                {current} of {total} records processed
              </span>
            </div>
          </div>

          {/* Detailed Message Status */}
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-center space-y-1">
            <p className="text-xs font-semibold text-slate-700 leading-snug">
              {progress?.message || `Generating ${badge.label} export file...`}
            </p>
            <p className="text-[10px] text-slate-400">
              Please keep this tab open until download completes.
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
