import { Patient, EjectionFraction, ReportCategory, Complication } from '../types';

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

export function generateEMRTextSummary(p: Patient, physicianName: string = 'Dr Bharat S Sambyal'): string {
  const lineSeparator = "======================================================================";
  const sectionSeparator = "----------------------------------------------------------------------";

  const nameUpper = (p.name || 'UNKNOWN').toUpperCase();
  const serialNoFormatted = `PAT-${String(p.serialNo || '').padStart(2, '0')}`;
  const procedureDate = formatDateDMY(p.date) || 'N/A';
  
  // 1. DEMOGRAPHICS
  const demographicsSection = [
    `Patient Name   : ${nameUpper}`,
    `Serial / ID    : ${serialNoFormatted} (Record No: #${String(p.serialNo || '').padStart(2, '0')})`,
    `Age / Gender   : ${p.age || 'N/A'} Y / ${p.gender || 'N/A'}`,
    `Service ID     : ${p.serNo || 'N/A'} (${p.serviceCategory || 'N/A'})`,
    `Admission No   : ${p.admissionNo || 'N/A'}`,
    `Location/Place : ${p.place || 'N/A'}`,
    `BMI            : ${p.bmi ? p.bmi : 'N/A'} (W: ${p.weight ? p.weight + ' kg' : 'N/A'} | H: ${p.height ? p.height + ' cm' : 'N/A'})`,
    `Contact Phone  : ${p.phoneNumbers && p.phoneNumbers.length > 0 ? p.phoneNumbers.join(', ') : 'None'}`,
    `Add. Operator(s): ${p.additionalOperators && p.additionalOperators.length > 0 ? p.additionalOperators.join(', ') : 'None'}`
  ].join('\n');

  // 2. DIAGNOSTICS & ECHO
  const efText = p.ejectionFraction === EjectionFraction.Other && p.otherEjectionFractionNotes 
    ? p.otherEjectionFractionNotes 
    : (p.ejectionFraction || 'N/A');
    
  const diagnosticsSection = [
    `Clinical Presentation : ${p.presentation || 'N/A'}`,
    `TMT Option            : ${p.tmt || 'N/A'}`,
    `LV Ejection Fraction  : ${efText}`,
    `RWMA Territory        : ${p.rwma && p.rwma.length > 0 ? p.rwma.join(', ') : 'None detected'}`,
    `Comorbidities         : ${p.comorbidities && p.comorbidities.length > 0 ? p.comorbidities.join(', ') : 'No comorbidities noted'}`
  ].join('\n');

  // 3. ACCESS & ANATOMY
  const accessNotes = p.otherAccessNotes ? ` (${p.otherAccessNotes})` : '';
  const categoryText = p.category === ReportCategory.Other && p.otherCategoryNotes
    ? p.otherCategoryNotes
    : (p.category || 'N/A');
    
  const complexFlags = [
    p.bifurcation ? 'Bifurcation Lesion' : '',
    p.isOther ? 'Complex Coronary Anatomy' : ''
  ].filter(Boolean).join(', ') || 'Standard coronary anatomy';

  const anatomySection = [
    `Vascular Access       : ${p.access || 'N/A'}${accessNotes}`,
    `USG Doppler Guided    : ${p.usgDoppler ? 'YES' : 'NO'}`,
    `Anatomy Classification: Category: ${categoryText}`,
    `Anatomy Complexity    : ${complexFlags}`,
    `Clinical Tagging Flags: ${p.tags && p.tags.length > 0 ? p.tags.map(t => `#${t}`).join(', ') : 'None'}`
  ].join('\n');

  // 4. PCI PROCEDURAL HARDWARE
  const deviceList = p.devices && Object.keys(p.devices).length > 0
    ? Object.entries(p.devices)
        .filter(([_, qty]) => qty && qty > 0)
        .map(([type, qty]) => `${type} (x${qty})`)
        .join(', ')
    : 'None deployed';

  const otherHardwareText = p.otherHardware && p.otherHardware.length > 0
    ? `${p.otherHardware.join(', ')}${p.otherHardwareNotes ? ` (${p.otherHardwareNotes})` : ''}`
    : 'None';

  const closureText = p.closureDevice
    ? (p.closureDevice === 'Others' ? (p.closureDeviceCustom || 'Others') : p.closureDevice)
    : 'None';

  const imagingFormattedList = p.imaging && p.imaging.length > 0
    ? p.imaging.map(opt => p.imagingFindings?.[opt] ? `${opt} (${p.imagingFindings[opt]})` : opt).join(', ')
    : 'None used';

  const hardwareSection = [
    `PCI Target Vessel(s)  : ${p.pciVessels && p.pciVessels.length > 0 ? p.pciVessels.join(', ') : 'Diagnostic assessment only (No PCI)'}`,
    p.lesionTypes && p.lesionTypes.length > 0 ? `Lesion Type(s)        : ${p.lesionTypes.join(', ')}` : '',
    `Balloons/Stents Depl. : ${deviceList}`,
    p.stentDetails && p.stentDetails.length > 0 ? `DES Stent Specs       : ${p.stentDetails.join(', ')}` : '',
    p.brsDetails && p.brsDetails.length > 0 ? `BRS Scaffold Specs    : ${p.brsDetails.join(', ')}` : '',
    p.debDetails && p.debDetails.length > 0 ? `DEB Balloon Specs     : ${p.debDetails.join(', ')}` : '',
    `Imaging / Physiology  : ${imagingFormattedList}`,
    `Special Prep Hardware : ${p.specialHardware && p.specialHardware.length > 0 ? p.specialHardware.join(', ') : 'None used'}`,
    `Support Hardware Inst.: ${otherHardwareText}`,
    `Closure Devices Used  : ${closureText}`
  ].filter(Boolean).join('\n');

  // 5. COMPLICATIONS & PHARMACY
  const complicationsList = p.complications && p.complications.length > 0
    ? p.complications.map(c => c === Complication.Other && p.complicationsCustom ? `Other (${p.complicationsCustom})` : c).join(', ')
    : 'None reported (uncomplicated procedure)';

  const complicationsSection = [
    `Cath Lab Complications: ${complicationsList}`,
    `Antiplatelets / Drugs : ${p.drugs && p.drugs.length > 0 ? p.drugs.join(', ') : 'None'}`
  ].join('\n');

  // 6. CLINICIAN REMARKS & PROCEDURAL NOTES
  const notesSection = [
    p.finalNotes ? `PROCEDURAL NOTES SUMMARY:\n${p.finalNotes}\n` : '',
    p.plan ? `FURTHER PLAN & RECOMMENDATIONS:\n${p.plan}\n` : '',
    p.notes ? `GENERAL CLINICIAN REMARKS:\n${p.notes}` : ''
  ].filter(Boolean).join('\n\n') || "No notes or summary recorded.";

  // 7. FOLLOW-UP OUTCOMES HISTORY
  const outcomesHistory = p.outcomes && p.outcomes.length > 0
    ? p.outcomes.map((o, idx) => {
        const outDate = formatDateDMY(o.date) || 'N/A';
        return `[${outDate}] Status: ${o.status}\n  Notes: ${o.notes}`;
      }).join('\n\n')
    : 'No outcomes or follow-ups currently registered.';

  const summaryText = [
    lineSeparator,
    `                   CATH LAB PROCEDURE REPORT SUMMARY                  `,
    lineSeparator,
    `RECORD DATE   : ${procedureDate}`,
    `PHYSICIAN     : ${physicianName}`,
    `EXPORT TIMESTAMP: ${new Date().toLocaleString()}`,
    lineSeparator,
    '',
    `1. PATIENT DEMOGRAPHICS`,
    sectionSeparator,
    demographicsSection,
    '',
    `2. CLINICAL DIAGNOSTICS & ECHOCARDIOGRAPHY`,
    sectionSeparator,
    diagnosticsSection,
    '',
    `3. VASCULAR ACCESS & CORONARY ANATOMY`,
    sectionSeparator,
    anatomySection,
    '',
    `4. INTERVENTION & IMPLANTED HARDWARE`,
    sectionSeparator,
    hardwareSection,
    '',
    `5. PROCEDURAL COMPLICATIONS & PHARMACY`,
    sectionSeparator,
    complicationsSection,
    '',
    `6. PROCEDURAL SUMMARY & NOTES`,
    sectionSeparator,
    notesSection,
    '',
    `7. CLINICAL OUTCOMES & FOLLOW-UP HISTORY`,
    sectionSeparator,
    outcomesHistory,
    '',
    lineSeparator,
    `CONFIDENTIAL MEDICAL RECORD - CATH LAB SECURE DATA SERVICES`,
    lineSeparator
  ].join('\n');

  return summaryText;
}
