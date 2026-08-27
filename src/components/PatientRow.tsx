import React from 'react';
import { motion } from 'motion/react';
import { Clock, CheckCircle2, Calendar, AlertCircle, Skull, ChevronDown, ChevronUp, Eye, Edit2, Trash2, Star } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Patient, Gender, EjectionFraction, OutcomeStatus } from '../types';
import { formatDateDMY } from '../utils/pdfGenerator';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getPatientStatus = (p: Patient) => {
  if (!p.outcomes || p.outcomes.length === 0) {
    return {
      label: 'Pending',
      color: 'bg-amber-50/70 text-amber-700 border-amber-200/60 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
      iconColor: 'text-amber-500',
      icon: Clock,
    };
  }
  
  const sortedOutcomes = [...p.outcomes].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const latest = sortedOutcomes[sortedOutcomes.length - 1];
  
  switch (latest.status) {
    case OutcomeStatus.Discharged:
      return {
        label: 'Completed',
        color: 'bg-emerald-50/70 text-emerald-700 border-emerald-200/60 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
        iconColor: 'text-emerald-500',
        icon: CheckCircle2,
      };
    case OutcomeStatus.FollowUp:
      return {
        label: 'Follow-up Required',
        color: 'bg-indigo-50/70 text-indigo-700 border-indigo-200/60 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20',
        iconColor: 'text-indigo-500',
        icon: Calendar,
      };
    case OutcomeStatus.StagedPCI:
      return {
        label: 'Staged PCI Planned',
        color: 'bg-purple-50/70 text-purple-700 border-purple-200/60 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20',
        iconColor: 'text-purple-500',
        icon: Calendar,
      };
    case OutcomeStatus.Readmitted:
      return {
        label: 'Readmitted',
        color: 'bg-rose-50/70 text-rose-700 border-rose-200/60 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
        iconColor: 'text-rose-500',
        icon: AlertCircle,
      };
    case OutcomeStatus.Death:
      return {
        label: 'Deceased',
        color: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        iconColor: 'text-slate-500',
        icon: Skull,
      };
    default:
      return {
        label: 'Pending',
        color: 'bg-amber-50/70 text-amber-700 border-amber-200/60 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
        iconColor: 'text-amber-500',
        icon: Clock,
      };
  }
};

export const HighlightText = ({ text, highlight }: { text: string; highlight: string }) => {
  if (!text) return null;
  if (!highlight || !highlight.trim()) {
    return <span>{text}</span>;
  }

  const terms = highlight.split(/\s+/).map(t => t.trim()).filter(Boolean);
  if (terms.length === 0) {
    return <span>{text}</span>;
  }

  const escapedTerms = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regexPattern = `(${escapedTerms.join('|')})`;
  
  try {
    const parts = text.split(new RegExp(regexPattern, 'gi'));
    
    return (
      <span>
        {parts.map((part, i) => {
          const isMatch = terms.some(t => t.toLowerCase() === part.toLowerCase());
          return isMatch ? (
            <mark key={i} className="bg-yellow-200 text-yellow-950 font-semibold px-0.5 rounded-sm dark:bg-yellow-500/30 dark:text-yellow-200">
              {part}
            </mark>
          ) : (
            part
          );
        })}
      </span>
    );
  } catch (e) {
    return <span>{text}</span>;
  }
};

interface PatientRowProps {
  p: Patient;
  index?: number;
  onSelect: (p: Patient) => void;
  onEdit: (p: Patient) => void;
  onDelete: (id: string) => void;
  isSelected: boolean;
  onToggleSelect: (e: React.MouseEvent, id: string) => void;
  onToggleImportant?: (p: Patient) => void;
  searchQuery: string;
  columnWidths: { [key: string]: number };
  visibleColumns: { [key: string]: boolean };
  isDuplicateSerial?: boolean;
  columnOrder?: string[];
}

export const PatientRow: React.FC<PatientRowProps> = React.memo(({ 
  p, 
  index = 0,
  onSelect, 
  onEdit, 
  onDelete, 
  isSelected, 
  onToggleSelect,
  onToggleImportant,
  searchQuery,
  columnWidths,
  visibleColumns,
  isDuplicateSerial,
  columnOrder
}) => {
  const defaultOrder = [
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

  let order = columnOrder || defaultOrder;
  if (!order.includes('actions')) {
    order = [...order, 'actions'];
  }

  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <>
      <motion.tr 
        key={p.id} 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ 
          duration: 0.22, 
          delay: Math.min((index || 0) * 0.03, 0.3),
          ease: "easeOut" 
        }}
        className={cn(
          "transition-colors group cursor-pointer select-none border-b border-slate-100",
          isSelected 
            ? "bg-slate-100/80 hover:bg-slate-100" 
            : isExpanded 
            ? "bg-slate-100/50 hover:bg-slate-100/70"
            : (index % 2 === 1 ? "bg-slate-50/70 hover:bg-slate-100/60" : "bg-white hover:bg-slate-100/60")
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <td style={{ width: columnWidths.select }} className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-center gap-2">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer"
              checked={isSelected}
              onChange={(e) => onToggleSelect(e as any, p.id!)}
            />
            {onToggleImportant && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleImportant(p);
                }}
                className={cn(
                  "p-1 rounded-md transition-all duration-150 cursor-pointer active:scale-90",
                  p.isImportant
                    ? "text-amber-500 hover:text-amber-600 bg-amber-50 border border-amber-200 shadow-2xs"
                    : "text-slate-300 hover:text-amber-400 hover:bg-slate-100 opacity-60 hover:opacity-100"
                )}
                title={p.isImportant ? "Marked as Important Case (click to unmark)" : "Mark as Important Case for later reference"}
              >
                <Star className={cn("w-4 h-4", p.isImportant ? "fill-amber-400 text-amber-500 shrink-0" : "shrink-0")} />
              </button>
            )}
          </div>
        </td>
        {order.map((colKey) => {
          if (!visibleColumns[colKey]) return null;
          switch (colKey) {
            case 'place':
              return (
                <td key="place" style={{ width: columnWidths.place }} className="px-6 py-4">
                  <span className="text-slate-700 text-xs font-semibold block truncate" title={p.place || ''}>
                    <HighlightText text={p.place || 'N/A'} highlight={searchQuery} />
                  </span>
                </td>
              );
            case 'serialNo':
              return (
                <td key="serialNo" style={{ width: columnWidths.serialNo }} className="px-6 py-4">
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      "font-mono text-xs font-bold block truncate",
                      isDuplicateSerial ? "text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200" : "text-slate-700"
                    )}>
                      <HighlightText text={`#00${p.serialNo}`} highlight={searchQuery} />
                    </span>
                    {isDuplicateSerial && (
                      <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1 py-0.5 rounded shrink-0 animate-pulse" title="Duplicate Serial Number! Click Edit to resolve.">
                        Duplicate
                      </span>
                    )}
                  </div>
                </td>
              );
            case 'date':
              return (
                <td key="date" style={{ width: columnWidths.date }} className="px-6 py-4">
                  <span className="text-slate-600 text-xs font-semibold block truncate">{formatDateDMY(p.date)}</span>
                </td>
              );
            case 'admissionNo':
              return (
                <td key="admissionNo" style={{ width: columnWidths.admissionNo }} className="px-6 py-4">
                  <span className="font-semibold text-slate-800 text-sm block truncate">
                    <HighlightText text={p.admissionNo} highlight={searchQuery} />
                  </span>
                </td>
              );
            case 'name':
              return (
                <td key="name" style={{ width: columnWidths.name }} className="px-6 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 truncate">
                      {p.isImportant && (
                        <span title="Important Case" className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200/80 px-1.5 py-0.5 rounded-md shrink-0">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-500 shrink-0" />
                          <span>Important</span>
                        </span>
                      )}
                      <span className="font-semibold text-slate-800 text-sm block truncate">
                        <HighlightText text={p.name} highlight={searchQuery} />
                      </span>
                    </div>
                    <div className="text-slate-400 group-hover:text-slate-600 transition-colors shrink-0">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </td>
              );
            case 'ageGen':
              return (
                <td key="ageGen" style={{ width: columnWidths.ageGen }} className="px-6 py-4">
                  <div className="flex flex-col truncate">
                    <span className="text-sm text-slate-600 block truncate">
                      <HighlightText text={`${p.age}y`} highlight={searchQuery} />
                    </span>
                    <span className={cn(
                      "text-[9px] font-bold uppercase block truncate",
                      p.gender === Gender.Male ? "text-blue-500" : "text-pink-500"
                    )}>
                      <HighlightText text={p.gender} highlight={searchQuery} />
                    </span>
                  </div>
                </td>
              );
            case 'ef':
              return (
                <td key="ef" style={{ width: columnWidths.ef }} className="px-6 py-4 text-xs font-bold text-slate-500 truncate">
                  <HighlightText 
                    text={p.ejectionFraction === EjectionFraction.Other && p.otherEjectionFractionNotes ? p.otherEjectionFractionNotes : p.ejectionFraction} 
                    highlight={searchQuery} 
                  />
                </td>
              );
            case 'finalNotes':
              return (
                <td key="finalNotes" style={{ width: columnWidths.finalNotes }} className="px-6 py-4">
                  <div className="text-xs text-slate-600 truncate" title={p.finalNotes || ''}>
                    {p.finalNotes ? (
                      <HighlightText text={p.finalNotes} highlight={searchQuery} />
                    ) : (
                      <span className="text-slate-300 italic">None</span>
                    )}
                  </div>
                </td>
              );
            case 'generalNotes':
              return (
                <td key="generalNotes" style={{ width: columnWidths.generalNotes }} className="px-6 py-4">
                  <div className="text-xs text-slate-600 truncate" title={p.notes || ''}>
                    {p.notes ? (
                      <HighlightText text={p.notes} highlight={searchQuery} />
                    ) : (
                      <span className="text-slate-300 italic">None</span>
                    )}
                  </div>
                </td>
              );
            case 'status':
              return (
                <td key="status" style={{ width: columnWidths.status }} className="px-6 py-4">
                  {(() => {
                    const statusInfo = getPatientStatus(p);
                    const StatusIcon = statusInfo.icon;
                    return (
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold shadow-sm transition-all duration-200 truncate",
                        statusInfo.color
                      )}>
                        <StatusIcon className={cn("w-3.5 h-3.5 shrink-0", statusInfo.iconColor)} />
                        <span className="truncate">{statusInfo.label}</span>
                      </div>
                    );
                  })()}
                </td>
              );
            case 'actions':
              return (
                <td key="actions" style={{ width: columnWidths.actions || 130 }} className="px-4 py-4 text-center shrink-0" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onEdit(p)}
                      className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 active:scale-95 cursor-pointer shadow-sm hover:shadow-indigo-200 shrink-0"
                      title="Edit / Modify Patient Data Entry"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelect(p)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all active:scale-95 cursor-pointer shrink-0"
                      title="View Full Profile (EMR)"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              );
            default:
              return null;
          }
        })}
      </motion.tr>
      {isExpanded && (
        <tr className="bg-slate-50/30 hover:bg-slate-50/30 border-b border-slate-100">
          <td colSpan={1 + Object.values(visibleColumns).filter(Boolean).length} className="px-8 py-5">
            <div className="animate-in fade-in slide-in-from-top-2 duration-200 text-left">
              {/* Bento Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                {/* Status & Timeline */}
                <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block mb-1.5">Status & Access</span>
                    <div className="space-y-1.5">
                      <div className="text-xs text-slate-500">
                        Date: <strong className="text-slate-700 font-semibold">{formatDateDMY(p.date)}</strong>
                      </div>
                      <div className="text-xs text-slate-500">
                        Adm No: <strong className="text-slate-700 font-semibold">{p.admissionNo || 'N/A'}</strong>
                      </div>
                      <div className="text-xs text-slate-500">
                        Access: <strong className="text-slate-700 font-semibold">{p.access || 'N/A'}</strong> {p.usgDoppler && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded ml-1 border border-emerald-200/60">USG</span>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">Current Status</span>
                    {(() => {
                      const statusInfo = getPatientStatus(p);
                      const StatusIcon = statusInfo.icon;
                      return (
                        <div className={cn(
                          "inline-flex items-center gap-1 py-0.5 px-2 rounded-full border text-[10px] font-bold shadow-sm",
                          statusInfo.color
                        )}>
                          <StatusIcon className={cn("w-3 h-3 shrink-0", statusInfo.iconColor)} />
                          <span>{statusInfo.label}</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Anatomy & Lesions */}
                <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block mb-1.5">Anatomy & Lesions</span>
                    {p.lesions && p.lesions.length > 0 ? (
                      <div className="flex flex-wrap gap-1 max-h-[72px] overflow-y-auto pr-1">
                        {p.lesions.map((lesion, index) => (
                          <span key={index} className="text-[10px] font-semibold bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-md">
                            {lesion}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic block">No specific lesions recorded.</span>
                    )}

                    {p.pciVessels && p.pciVessels.length > 0 && (
                      <div className="mt-2 text-xs text-slate-500">
                        PCI Vessels: <strong className="text-slate-700 font-semibold">{p.pciVessels.join(', ')}</strong>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-slate-600">Presentation</span>
                    <span className="font-bold text-slate-700">{p.presentation || 'N/A'}</span>
                  </div>
                </div>

                {/* Ejection Fraction Details */}
                <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block mb-1.5">Ejection Fraction</span>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-slate-800 bg-amber-50 text-amber-800 border border-amber-200/50 px-2 py-0.5 rounded-md">{p.ejectionFraction}</span>
                    </div>
                    {p.otherEjectionFractionNotes && (
                      <p className="text-[11px] text-slate-600 bg-slate-50/50 p-2 rounded-lg border border-slate-100 max-h-[60px] overflow-y-auto">
                        {p.otherEjectionFractionNotes}
                      </p>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-slate-600">Hardware</span>
                    <span className="font-bold text-slate-700">
                      {p.specialHardware && p.specialHardware.length > 0 ? `${p.specialHardware.length} items` : 'None'}
                    </span>
                  </div>
                </div>

                {/* Clinical Notes */}
                <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block mb-1.5">Clinical Notes</span>
                    <div className="space-y-1.5 max-h-[85px] overflow-y-auto pr-1 text-left">
                      {p.finalNotes && (
                        <div>
                          <span className="text-[10px] font-black text-slate-600 uppercase">Final Note:</span>
                          <p className="text-[11px] text-slate-600 line-clamp-2" title={p.finalNotes}>{p.finalNotes}</p>
                        </div>
                      )}
                      {p.plan && (
                        <div>
                          <span className="text-[10px] font-black text-sky-700 uppercase">Plan:</span>
                          <p className="text-[11px] text-slate-600 line-clamp-2" title={p.plan}>{p.plan}</p>
                        </div>
                      )}
                      {p.notes && (
                        <div>
                          <span className="text-[10px] font-black text-slate-600 uppercase">General Note:</span>
                          <p className="text-[11px] text-slate-600 line-clamp-2" title={p.notes}>{p.notes}</p>
                        </div>
                      )}
                      {!p.finalNotes && !p.plan && !p.notes && (
                        <span className="text-xs text-slate-400 italic block text-left">No clinical notes recorded.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-200/60" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => onSelect(p)}
                  className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold rounded-xl border border-sky-100 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" /> View Profile (EMR)
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(p)}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-100 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Edit Record
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(p.id!)}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-100 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
});

PatientRow.displayName = 'PatientRow';
