import React from 'react';
import { Copy, FileText, Edit2 } from 'lucide-react';
import QRCode from 'qrcode';
import { Patient, EjectionFraction, Gender, ReportCategory, Complication } from '../types';

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
    const matchYMD = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (matchYMD) {
      const year = matchYMD[1];
      const month = matchYMD[2].padStart(2, '0');
      const day = matchYMD[3].padStart(2, '0');
      return `${day}/${month}/${year}`;
    }
    date = new Date(dateInput);
  }
  if (isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export interface PatientClinicalSheetProps {
  patient: Patient;
  onPreviewPhoto?: (url: string, title: string) => void;
  onCopyEMR?: (patient: Patient) => void;
  onEdit?: (patient: Patient) => void;
  // Dynamic Print/Customization Options
  customHeaderTitle?: string;
  showHospitalHeader?: boolean;
  textSizeScale?: 'compact' | 'normal' | 'large';
  printLayoutMode?: 'compact' | 'detailed';
  isAnonymized?: boolean;
  visibleSections?: {
    demographics: boolean;
    diagnostics: boolean;
    anatomy: boolean;
    pci: boolean;
    outcomes: boolean;
    photos: boolean;
    signatures: boolean;
    qrcode?: boolean;
    tags?: boolean;
  };
  customPhysicianName?: string;
}

export const PatientClinicalSheet: React.FC<PatientClinicalSheetProps> = ({ 
  patient, 
  onPreviewPhoto,
  onCopyEMR,
  onEdit,
  customHeaderTitle = "Patient Cath Data",
  showHospitalHeader = true,
  textSizeScale = 'normal',
  printLayoutMode = 'detailed',
  isAnonymized = false,
  visibleSections = {
    demographics: true,
    diagnostics: true,
    anatomy: true,
    pci: true,
    outcomes: true,
    photos: true,
    signatures: true,
    qrcode: true,
    tags: true
  },
  customPhysicianName = "Dr Bharat S Sambyal"
}) => {
  // Generate QR Code Reactively
  const [qrCodeUrl, setQrCodeUrl] = React.useState<string>('');

  React.useEffect(() => {
    if (isAnonymized) {
      setQrCodeUrl('');
      return;
    }
    const payload = patient.id 
      ? `${window.location.origin}/?patientId=${patient.id}` 
      : `${window.location.origin}/?serialNo=${patient.serialNo}`;
    QRCode.toDataURL(payload, { width: 150, margin: 1 })
      .then(url => setQrCodeUrl(url))
      .catch(err => console.error('Error generating QR inside sheet:', err));
  }, [patient.id, patient.serialNo, isAnonymized]);

  // Define styles depending on the text scale selected
  const isCompactLayout = printLayoutMode === 'compact';
  const isCompact = textSizeScale === 'compact' || isCompactLayout;
  const isLarge = textSizeScale === 'large' && !isCompactLayout;

  const containerPadding = isCompactLayout
    ? "p-3 sm:p-4 print:p-0"
    : isCompact 
      ? "p-4 sm:p-6 md:p-8" 
      : isLarge 
        ? "p-6 sm:p-12 md:p-16" 
        : "p-4 sm:p-8 md:p-12";

  const spacingClass = isCompactLayout ? "mb-2.5" : isCompact ? "mb-4" : isLarge ? "mb-10" : "mb-8";
  
  const textBaseClass = isCompactLayout ? "text-[10px]" : isCompact ? "text-xs" : isLarge ? "text-base" : "text-sm";
  const textLabelClass = isCompactLayout ? "text-[8px]" : isCompact ? "text-[9px]" : isLarge ? "text-xs" : "text-[10px]";
  const textValueClass = isCompactLayout ? "text-[10px] font-bold" : isCompact ? "text-xs font-bold" : isLarge ? "text-base font-bold" : "text-sm font-bold";
  const nameValueClass = isCompactLayout ? "text-sm font-extrabold" : isCompact ? "text-base font-extrabold" : isLarge ? "text-2xl font-extrabold" : "text-lg font-bold";
  const headingTextClass = isCompactLayout ? "text-[10px]" : isCompact ? "text-xs" : isLarge ? "text-sm" : "text-xs";
  
  return (
    <div 
      id={`print-section-${patient.id || 'record'}`} 
      className={`mx-auto max-w-4xl bg-white shadow-xl rounded-2xl border border-slate-200 print:shadow-none print:border-none print:p-0 print:max-w-full min-w-[320px] ${containerPadding} ${textBaseClass} font-sans text-slate-800 transition-all`}
    >
      {(onCopyEMR || onEdit) && (
        <div className="mb-4 pb-3 border-b border-slate-100 flex items-center justify-between print:hidden gap-3 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" /> EMR Integration Ready
          </span>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => onEdit(patient)}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
                title="Edit / Modify Patient Data Entry"
              >
                <Edit2 className="w-3.5 h-3.5" /> Edit Patient Entry
              </button>
            )}
            {onCopyEMR && (
              <button
                onClick={() => onCopyEMR(patient)}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-850 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 transition-all shadow-sm border border-indigo-100/60 active:scale-95 cursor-pointer shrink-0"
              >
                <Copy className="w-3.5 h-3.5" /> Copy EMR Text
              </button>
            )}
          </div>
        </div>
      )}

      {/* Hospital/Department Clinical Header */}
      {showHospitalHeader ? (
        <div className={`border-b-2 border-slate-950 pb-5 ${spacingClass} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4`}>
          <div>
            <span className={`${textLabelClass} font-light text-slate-500 uppercase tracking-wider leading-none block`}>Patient Clinical Record</span>
            <h2 className={`${isCompact ? 'text-xl' : isLarge ? 'text-4xl' : 'text-3xl'} font-extrabold text-slate-900 tracking-tight mt-1 uppercase`}>
              {customHeaderTitle}
            </h2>
            <p className="text-[10px] font-mono text-slate-400 mt-1">Generated: {new Date().toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-4 text-right self-stretch sm:self-auto justify-between sm:justify-end shrink-0">
            {visibleSections.qrcode !== false && qrCodeUrl && (
              <div className="flex flex-col items-center gap-0.5 shrink-0 bg-white p-1 border border-slate-200 rounded shadow-sm">
                <img src={qrCodeUrl} alt="Patient QR Code" className={`${isCompactLayout ? 'w-10 h-10' : 'w-14 h-14'}`} />
                <span className="text-[6px] font-mono text-slate-400 font-bold uppercase tracking-wider">Scan Profile</span>
              </div>
            )}
            <div className="text-right">
              <div className="inline-block bg-slate-900 text-white px-3 py-1.5 rounded-lg font-mono text-xs font-bold print:border print:border-slate-850 print:bg-transparent print:text-black">
                {`PAT-${String(patient.serialNo).padStart(2, '0')} / `}RECORD NO: #{String(patient.serialNo).padStart(2, '0')}
              </div>
              <p className={`${textLabelClass} font-semibold text-slate-500 mt-2`}>Doctor In-Charge: {customPhysicianName}</p>
            </div>
          </div>
        </div>
      ) : (
        /* If hospital header is hidden but QR code option or demographics is selected, we still show a clean, minimalistic top metadata row */
        (visibleSections.qrcode !== false || visibleSections.demographics) && (
          <div className={`border-b border-slate-200 pb-3 ${spacingClass} flex flex-row justify-between items-center gap-4`}>
            <div>
              <span className="text-xs font-bold text-slate-900 uppercase">Patient Record Document</span>
              <p className="text-[9px] font-mono text-slate-400">Generated: {new Date().toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-4">
              {visibleSections.qrcode !== false && qrCodeUrl && (
                <div className="flex items-center gap-2 bg-white p-1 border border-slate-200 rounded shadow-sm shrink-0">
                  <img src={qrCodeUrl} alt="Patient QR Code" className="w-10 h-10" />
                  <div className="text-left hidden sm:block">
                    <p className="text-[7px] font-bold text-slate-900">PATIENT PROFILE</p>
                    <p className="text-[6px] font-mono text-slate-400">Scan to view online</p>
                  </div>
                </div>
              )}
              <div className="text-right">
                <div className="inline-block bg-slate-100 text-slate-800 px-2.5 py-1 rounded font-mono text-[10px] font-bold border border-slate-200">
                  PAT-{String(patient.serialNo).padStart(2, '0')}
                </div>
                <p className="text-[8px] font-semibold text-slate-500 mt-1">Doctor: {customPhysicianName}</p>
              </div>
            </div>
          </div>
        )
      )}

      {/* Demographics / Registration block */}
      {visibleSections.demographics && (
        <div className={spacingClass}>
          <h3 className={`${headingTextClass} font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-1 mb-4`}>
            Patient Demographics {isAnonymized && <span className="text-amber-600 font-normal normal-case text-xs">(Anonymized)</span>}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
            <div className="col-span-1 sm:col-span-2 md:col-span-2">
              <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block`}>Patient Name</span>
              <p className={`${nameValueClass} ${isAnonymized ? 'text-amber-700 italic font-mono' : 'text-slate-900'} leading-tight break-words`}>
                {isAnonymized ? 'ANONYMIZED PATIENT' : patient.name}
              </p>
            </div>
            <div>
              <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block`}>Ser / Service category</span>
              <p className={`${textValueClass} text-slate-900`}>
                {isAnonymized ? 'REDACTED' : patient.serNo} <span className="text-xs font-medium text-slate-500">({patient.serviceCategory})</span>
              </p>
            </div>
            <div>
              <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block`}>Admission No</span>
              <p className={`${textValueClass} ${isAnonymized ? 'text-amber-700 italic font-mono' : 'text-slate-900'}`}>
                {isAnonymized ? 'REDACTED' : (patient.admissionNo || 'N/A')}
              </p>
            </div>
            <div>
              <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block`}>Cath/Procedure Date</span>
              <p className={`${textValueClass} text-slate-900`}>{formatDateDMY(patient.date)}</p>
            </div>
            <div>
              <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block`}>Age / Gender</span>
              <p className={`${textValueClass} text-slate-900`}>{patient.age} Y / {patient.gender}</p>
            </div>
            <div>
              <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block`}>BMI</span>
              <p className={`${textValueClass} text-slate-900`}>
                {patient.bmi ? `${patient.bmi}` : '-'}
              </p>
            </div>
            <div className="col-span-1 sm:col-span-2">
              <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block`}>Contact Phone(s)</span>
              <p className={`${textValueClass} ${isAnonymized ? 'text-amber-700 italic font-mono' : 'text-slate-900'}`}>
                {isAnonymized ? 'REDACTED' : (patient.phoneNumbers?.length > 0 ? patient.phoneNumbers.join(', ') : 'None')}
              </p>
            </div>
            {patient.additionalOperators && patient.additionalOperators.length > 0 && (
              <div className="col-span-1 sm:col-span-2">
                <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block`}>Additional Operator(s)</span>
                <p className={`${textValueClass} text-slate-900`}>
                  {patient.additionalOperators.join(', ')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Clinical Presentation & Echo/ECG info */}
      {visibleSections.diagnostics && (
        <div className={spacingClass}>
          <h3 className={`${headingTextClass} font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-1 mb-4`}>Echocardiography & Presentation</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block mb-1`}>Clinical Presentation</span>
              <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-900 rounded font-bold text-xs uppercase border border-slate-200">
                {patient.presentation}
              </span>
            </div>
            <div>
              <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block mb-1`}>TMT Option</span>
              <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-900 rounded font-bold text-xs border border-slate-200">
                {patient.tmt}
              </span>
            </div>
            <div>
              <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block mb-1`}>Ejection Fraction (LVSD)</span>
              <span className="inline-block px-1.5 py-0.5 bg-sky-50 text-sky-800 rounded font-bold text-[10px] border border-sky-100">
                {patient.ejectionFraction === EjectionFraction.Other && patient.otherEjectionFractionNotes ? patient.otherEjectionFractionNotes : patient.ejectionFraction}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div>
              <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block`}>RWMA Territory</span>
              <p className="text-sm font-semibold text-slate-700 mt-1">
                {patient.rwma?.length > 0 ? patient.rwma.map(item => (
                  <span key={item} className="inline-block bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded text-xs mr-1">{item}</span>
                )) : 'None detected'}
              </p>
            </div>
            <div>
              <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block`}>Relevant Comorbidities</span>
              <p className="text-sm font-semibold text-slate-700 mt-1">
                {patient.comorbidities?.length > 0 ? patient.comorbidities.map(item => (
                  <span key={item} className="inline-block bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded text-xs mr-1 font-semibold">{item}</span>
                )) : 'No comorbidities noted'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Vascular Access & Angiogram Procedures */}
      {visibleSections.anatomy && (
        <div className={spacingClass}>
          <h3 className={`${headingTextClass} font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-1 mb-4`}>Vascular Access & Angiography</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block`}>Vascular Access</span>
              <p className={`${textValueClass} text-slate-900 mt-1`}>{patient.access}</p>
              {patient.otherAccessNotes && (
                <p className="text-xs text-slate-500 italic mt-0.5">{patient.otherAccessNotes}</p>
              )}
            </div>
            <div>
              <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block`}>USG Doppler Guided</span>
              <p className={`${textValueClass} text-slate-900 mt-1`}>
                {patient.usgDoppler ? 'YES' : 'NO'}
              </p>
            </div>
            <div>
              <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block`}>Anatomy Classification</span>
              <div className="flex flex-wrap gap-1 mt-1">
                <span className="inline-block bg-slate-50 text-slate-800 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-semibold">
                  Category: {patient.category === ReportCategory.Other && patient.otherCategoryNotes ? patient.otherCategoryNotes : patient.category}
                </span>
                {visibleSections.tags !== false && patient.tags?.map(t => (
                  <span key={t} className="inline-block bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded text-[10px] font-semibold">
                    #{t}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block`}>Coronary Anatomy Flags</span>
              <p className="text-xs font-bold text-slate-900 mt-1">
                {patient.bifurcation ? '✓ Bifurcation Lesion ' : ''}
                {patient.bifurcation && patient.isOther ? ' | ' : ''}
                {patient.isOther ? '✓ Other Complex Flag' : ''}
                {!patient.bifurcation && !patient.isOther ? 'Standard anatomy' : ''}
              </p>
            </div>
          </div>

          {patient.lesions && patient.lesions.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block`}>Standardized Lesions Identified</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {patient.lesions.map((l, i) => (
                  <div key={i} className="px-2.5 py-1 bg-amber-50 border border-amber-200/60 text-amber-900 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                    <span className="font-bold">{l}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PCI Interventions & Devices Used */}
      {visibleSections.pci && (
        <div className={spacingClass}>
          <h3 className={`${headingTextClass} font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-1 mb-4`}>PCI Intervention & Equipment</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block`}>Vessels of Concern (PCI Vessels)</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {patient.pciVessels?.length > 0 ? patient.pciVessels.map(v => (
                  <span key={v} className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 font-bold text-xs rounded uppercase">{v}</span>
                )) : <span className="text-slate-400 text-xs italic">No vessel recorded / Diagnosed only</span>}
              </div>
            </div>
            <div>
              <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block`}>Lesion Type(s)</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {patient.lesionTypes && patient.lesionTypes.length > 0 ? patient.lesionTypes.map(lt => (
                  <span key={lt} className="px-2 py-0.5 bg-orange-50 text-orange-800 border border-orange-200 font-bold text-xs rounded uppercase">{lt}</span>
                )) : (patient.bifurcation ? <span className="px-2 py-0.5 bg-orange-50 text-orange-800 border border-orange-200 font-bold text-xs rounded uppercase">Bifurcation</span> : <span className="text-slate-400 text-xs italic">None</span>)}
              </div>
            </div>
            <div>
              <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block`}>Balloons / Stents Deployed</span>
              <div className="flex items-center gap-3 flex-wrap mt-1">
                {patient.devices && Object.keys(patient.devices).length > 0 ? (
                  Object.entries(patient.devices).map(([type, qty]) => (
                    qty && qty > 0 ? (
                      <div key={type} className="flex items-center gap-1.5 px-2 py-0.5 bg-teal-50 border border-teal-200 text-teal-800 rounded text-xs font-bold">
                        <span className="uppercase text-[10px] font-medium text-teal-600">{type}:</span>
                        <span>{qty}</span>
                      </div>
                    ) : null
                  ))
                ) : <span className="text-slate-400 text-xs italic">None deployed</span>}
              </div>
            </div>
          </div>

          {patient.stentDetails && patient.stentDetails.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block`}>Standardized DES Catalog Specifications</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {patient.stentDetails.map((s, i) => (
                  <div key={i} className="px-2.5 py-1 bg-teal-50 border border-teal-200/60 text-teal-950 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm">
                    <span className="w-1.5 h-1.5 bg-teal-500 rounded-full" />
                    <span className="font-bold text-teal-900">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {patient.brsDetails && patient.brsDetails.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block`}>Standardized BRS Catalog Specifications</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {patient.brsDetails.map((s, i) => (
                  <div key={i} className="px-2.5 py-1 bg-blue-50 border border-blue-200/60 text-blue-950 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                    <span className="font-bold text-blue-900">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {patient.debDetails && patient.debDetails.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block`}>Standardized DEB Catalog Specifications</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {patient.debDetails.map((s, i) => (
                  <div key={i} className="px-2.5 py-1 bg-amber-50 border border-amber-200/60 text-amber-950 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                    <span className="font-bold text-amber-900">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mt-6">
            <div>
              <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block`}>Imaging and Physiology</span>
              <p className="text-xs font-semibold text-slate-800 mt-1">
                {patient.imaging?.length > 0 ? patient.imaging.join(', ') : 'None used'}
              </p>
            </div>
            <div>
              <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block`}>Prep Special Hardware</span>
              <p className="text-xs font-semibold text-slate-800 mt-1">
                {patient.specialHardware?.length > 0 ? patient.specialHardware.join(', ') : 'None used'}
              </p>
            </div>
            <div>
              <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block`}>Support Hardware Installed</span>
              <p className="text-xs font-semibold text-slate-800 mt-1">
                 {patient.otherHardware?.length > 0 ? (
                   <>
                     {patient.otherHardware.join(', ')}
                     {patient.otherHardwareNotes ? ` (${patient.otherHardwareNotes})` : ''}
                   </>
                 ) : 'None'}
              </p>
            </div>
            <div>
              <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block`}>Closure Devices Used</span>
              <p className="text-xs font-semibold text-slate-800 mt-1">
                {patient.closureDevice ? (
                  patient.closureDevice === 'Others' ? (
                    patient.closureDeviceCustom ? (
                      <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-800 font-bold text-xs rounded">{patient.closureDeviceCustom}</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-800 font-bold text-xs rounded">Others</span>
                    )
                  ) : (
                    <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-800 font-bold text-xs rounded">{patient.closureDevice}</span>
                  )
                ) : (
                  <span className="text-slate-400 italic">None</span>
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div>
              <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block`}>Cath Lab Complications</span>
              <p className="text-sm font-bold text-red-600 mt-1">
                {patient.complications?.length > 0 ? (
                  patient.complications.map(item => (
                    <span key={item} className="inline-block bg-red-100 border border-red-200 text-red-800 px-2 py-0.5 rounded text-xs font-bold mr-1">
                      {item === Complication.Other && patient.complicationsCustom ? `Other: ${patient.complicationsCustom}` : item}
                    </span>
                  ))
                ) : 'None reported (uncomplicated procedure)'}
              </p>
            </div>
            <div>
              <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block`}>Key Antiplatelets / Drugs</span>
              <p className="text-xs font-semibold text-slate-800 mt-1">
                {patient.drugs?.length > 0 ? patient.drugs.join(', ') : 'None'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Medical / Procedural Notes */}
      {(patient.finalNotes || patient.plan || patient.notes) && (
        <div className={`${spacingClass} p-4 sm:p-6 bg-slate-50 rounded-xl border border-slate-100 print:bg-white print:p-0 print:border-none`}>
          <h3 className={`${headingTextClass} font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-1 mb-4`}>Procedural Notes & Clinical Plan</h3>
          <div className="space-y-4">
            {patient.finalNotes && (
              <div>
                <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block`}>Clinical Notes Summary</span>
                <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed mt-1">{patient.finalNotes}</p>
              </div>
            )}
            {patient.plan && (
              <div>
                <span className={`${textLabelClass} uppercase font-bold text-sky-600 tracking-wider block`}>Further Plan & Recommendations</span>
                <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed mt-1">{patient.plan}</p>
              </div>
            )}
            {patient.notes && (
              <div>
                <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block`}>General Clinician Remarks</span>
                <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed mt-1">{patient.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Follow-Ups & Historical Outcomes */}
      {visibleSections.outcomes && (
        <div className={spacingClass}>
          <h3 className={`${headingTextClass} font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-1 mb-4`}>Follow-Up & Clinical Outcomes History</h3>
          {patient.outcomes && patient.outcomes.length > 0 ? (
            <div className="border border-slate-200 rounded-xl overflow-x-auto w-full print:border-slate-300">
              <table className="w-full text-left text-xs min-w-[500px] sm:min-w-full">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[9px] tracking-wider border-b border-slate-200 print:bg-transparent print:border-b-2">
                  <tr>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3 font-bold">Clinical Status</th>
                    <th className="py-2 px-3 w-2/3">Progress Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 print:divide-slate-200">
                  {patient.outcomes.map((outcome, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                      <td className="py-2 px-3 font-mono text-slate-500 whitespace-nowrap">{formatDateDMY(outcome.date)}</td>
                      <td className="py-2 px-3 font-bold text-slate-800">{outcome.status}</td>
                      <td className="py-2 px-3 text-slate-600 whitespace-pre-wrap leading-relaxed">{outcome.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No formal outcomes/follow-ups registered.</p>
          )}
        </div>
      )}

      {/* Clinical & Imaging attachments (if any) */}
      {visibleSections.photos && (() => {
        const pciPhotos = (patient.pciPhotoUrls && patient.pciPhotoUrls.length > 0)
          ? patient.pciPhotoUrls
          : (patient.pciPhotoUrl ? [patient.pciPhotoUrl] : []);
        const validPci = pciPhotos.filter(u => u && !u.includes('placeholder'));

        const imgPhotos = (patient.imagingPhotoUrls && patient.imagingPhotoUrls.length > 0)
          ? patient.imagingPhotoUrls
          : (patient.imagingPhotoUrl ? [patient.imagingPhotoUrl] : []);
        const validImg = imgPhotos.filter(u => u && !u.includes('placeholder'));

        const hasAnyPhoto = 
          (patient.labPhotoUrl && !patient.labPhotoUrl.includes('placeholder')) ||
          (patient.angiogramPhotoUrl && !patient.angiogramPhotoUrl.includes('placeholder')) ||
          validPci.length > 0 ||
          validImg.length > 0 ||
          (patient.otherInfoPhotoUrl && !patient.otherInfoPhotoUrl.includes('placeholder')) ||
          (patient.demographicsPhotoUrl && !patient.demographicsPhotoUrl.includes('placeholder'));

        if (!hasAnyPhoto) return null;

        return (
          <div className={`pt-4 border-t border-slate-200 ${isCompactLayout ? 'mt-3 print:page-break-before-none' : 'mt-8 print:page-break-before'}`}>
            <h3 className={`${headingTextClass} font-bold text-slate-500 uppercase tracking-widest border-b border-slate-300 pb-1 ${isCompactLayout ? 'mb-2' : 'mb-6'}`}>Patient Clinical Attachments & Diagnostic Photos</h3>
            <div className={`grid gap-3 ${isCompactLayout ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-1 sm:grid-cols-2 gap-6'}`}>
              {patient.labPhotoUrl && !patient.labPhotoUrl.includes('placeholder') && (
                <div className={`border border-slate-200 rounded-xl bg-slate-50/50 flex flex-col items-center justify-center print:bg-white text-center ${isCompactLayout ? 'p-1.5' : 'p-3'}`}>
                  <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block ${isCompactLayout ? 'mb-1 text-[7px]' : 'mb-2'}`}>Lab investigations</span>
                  <img 
                    src={patient.labPhotoUrl} 
                    referrerPolicy="no-referrer" 
                    alt="Lab investigations report" 
                    className={`${isCompactLayout ? 'max-h-16' : 'max-h-56'} object-contain rounded border bg-white shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all print:cursor-default print:shadow-sm print:scale-100`} 
                    onClick={() => onPreviewPhoto && onPreviewPhoto(patient.labPhotoUrl!, "Lab Investigations Photo")}
                  />
                </div>
              )}
              {patient.angiogramPhotoUrl && !patient.angiogramPhotoUrl.includes('placeholder') && (
                <div className={`border border-slate-200 rounded-xl bg-slate-50/50 flex flex-col items-center justify-center print:bg-white text-center ${isCompactLayout ? 'p-1.5' : 'p-3'}`}>
                  <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block ${isCompactLayout ? 'mb-1 text-[7px]' : 'mb-2'}`}>Angiogram Report</span>
                  <img 
                    src={patient.angiogramPhotoUrl} 
                    referrerPolicy="no-referrer" 
                    alt="Angiogram medical report" 
                    className={`${isCompactLayout ? 'max-h-16' : 'max-h-56'} object-contain rounded border bg-white shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all print:cursor-default print:shadow-sm print:scale-100`} 
                    onClick={() => onPreviewPhoto && onPreviewPhoto(patient.angiogramPhotoUrl!, "Angiogram Report Photo")}
                  />
                </div>
              )}
              {validPci.map((url, idx) => (
                <div key={`pci-${idx}`} className={`border border-slate-200 rounded-xl bg-slate-50/50 flex flex-col items-center justify-center print:bg-white text-center ${isCompactLayout ? 'p-1.5' : 'p-3'}`}>
                  <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block ${isCompactLayout ? 'mb-1 text-[7px]' : 'mb-2'}`}>
                    PCI Report {validPci.length > 1 ? `#${idx + 1}` : ''}
                  </span>
                  <img 
                    src={url} 
                    referrerPolicy="no-referrer" 
                    alt="PCI post-procedure document" 
                    className={`${isCompactLayout ? 'max-h-16' : 'max-h-56'} object-contain rounded border bg-white shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all print:cursor-default print:shadow-sm print:scale-100`} 
                    onClick={() => onPreviewPhoto && onPreviewPhoto(url, `PCI Report Photo${validPci.length > 1 ? ` #${idx + 1}` : ''}`)}
                  />
                </div>
              ))}
              {validImg.map((url, idx) => (
                <div key={`img-${idx}`} className={`border border-slate-200 rounded-xl bg-slate-50/50 flex flex-col items-center justify-center print:bg-white text-center ${isCompactLayout ? 'p-1.5' : 'p-3'}`}>
                  <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block ${isCompactLayout ? 'mb-1 text-[7px]' : 'mb-2'}`}>
                    OCT/IVUS Imaging {validImg.length > 1 ? `#${idx + 1}` : ''}
                  </span>
                  <img 
                    src={url} 
                    referrerPolicy="no-referrer" 
                    alt="OCT / IVUS / SPECT / PET Imaging document" 
                    className={`${isCompactLayout ? 'max-h-16' : 'max-h-56'} object-contain rounded border bg-white shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all print:cursor-default print:shadow-sm print:scale-100`} 
                    onClick={() => onPreviewPhoto && onPreviewPhoto(url, `OCT/IVUS/SPECT Imaging Photo${validImg.length > 1 ? ` #${idx + 1}` : ''}`)}
                  />
                </div>
              ))}
              {patient.otherInfoPhotoUrl && !patient.otherInfoPhotoUrl.includes('placeholder') && (
                <div className={`border border-slate-200 rounded-xl bg-slate-50/50 flex flex-col items-center justify-center print:bg-white text-center ${isCompactLayout ? 'p-1.5' : 'p-3'}`}>
                  <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block ${isCompactLayout ? 'mb-1 text-[7px]' : 'mb-2'}`}>Other Clinical info</span>
                  <img 
                    src={patient.otherInfoPhotoUrl} 
                    referrerPolicy="no-referrer" 
                    alt="Other Clinical Information" 
                    className={`${isCompactLayout ? 'max-h-16' : 'max-h-56'} object-contain rounded border bg-white shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all print:cursor-default print:shadow-sm print:scale-100`} 
                    onClick={() => onPreviewPhoto && onPreviewPhoto(patient.otherInfoPhotoUrl!, "Other Clinical Info Photo")}
                  />
                </div>
              )}
              {patient.demographicsPhotoUrl && !patient.demographicsPhotoUrl.includes('placeholder') && (
                <div className={`border border-slate-200 rounded-xl bg-slate-50/50 flex flex-col items-center justify-center print:bg-white text-center ${isCompactLayout ? 'p-1.5' : 'p-3'}`}>
                  <span className={`${textLabelClass} uppercase font-bold text-slate-400 tracking-wider block ${isCompactLayout ? 'mb-1 text-[7px]' : 'mb-2'}`}>Demographics Photo</span>
                  <img 
                    src={patient.demographicsPhotoUrl} 
                    referrerPolicy="no-referrer" 
                    alt="Demographics Information" 
                    className={`${isCompactLayout ? 'max-h-16' : 'max-h-56'} object-contain rounded border bg-white shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all print:cursor-default print:shadow-sm print:scale-100`} 
                    onClick={() => onPreviewPhoto && onPreviewPhoto(patient.demographicsPhotoUrl!, "Demographics Photo")}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Signature Area */}
      {visibleSections.signatures && (
        <div className="mt-12 pt-6 border-t border-slate-200 flex justify-between items-end print:pt-10">
          <div>
            <p className={`${textLabelClass} text-slate-400 uppercase tracking-wider`}>Primary Record By</p>
            <div className="h-8 mt-1" />
            <p className="text-xs font-bold text-slate-800 leading-none">Recorded Clinician Signature</p>
            <p className="text-[10px] text-slate-500 mt-1">CATH LAB DB SECURE SYSTEM</p>
          </div>
          {visibleSections.qrcode !== false && qrCodeUrl && (
            <div className="flex flex-col items-center gap-0.5 shrink-0 bg-white p-1 border border-slate-200 rounded shadow-sm">
              <img src={qrCodeUrl} alt="Patient QR Code" className="w-12 h-12" />
              <span className="text-[6px] font-mono text-slate-400 font-bold uppercase tracking-wider">Patient QR Profile</span>
            </div>
          )}
          <div className="text-right">
            <p className={`${textLabelClass} text-slate-400 uppercase tracking-wider`}>Certified Date & Time</p>
            <div className="h-8 mt-1" />
            <p className="text-xs font-bold text-slate-800 leading-none font-mono">{new Date().toLocaleDateString()}</p>
            <p className="text-[10px] text-slate-500 mt-1">System timestamp match certified</p>
          </div>
        </div>
      )}
    </div>
  );
};
