import {
  Patient,
  Gender,
  ServiceCategory,
  ReportCategory,
  TMTOption,
  EjectionFraction,
  RWMAOption,
  Comorbidity,
  AccessMethod,
  ImagingOption,
  SpecialHardware,
  Complication,
  OtherHardware,
  Presentation,
  Drug,
  DeviceType,
  PCIVessel,
  LesionType,
  OutcomeStatus,
  Outcome
} from '../types';

export interface CSVParseResult {
  headers: string[];
  rows: Record<string, string>[];
  rawRows: string[][];
  delimiter: string;
}

export interface FieldDefinition {
  key: keyof Patient | string;
  label: string;
  category: 'Demographics' | 'Clinical' | 'Procedure' | 'Labs' | 'Notes & Other';
  keywords: string[];
  required?: boolean;
}

export const PATIENT_FIELDS: FieldDefinition[] = [
  { key: 'name', label: 'Patient Name', category: 'Demographics', keywords: ['name', 'patient name', 'patient_name', 'full name', 'pt name'], required: true },
  { key: 'serialNo', label: 'Serial No', category: 'Demographics', keywords: ['serial no', 'serial_no', 'sl no', 's.no', 'sno', 'sr no', 'sr.no', 'index', 'id'] },
  { key: 'serNo', label: 'Service No', category: 'Demographics', keywords: ['ser no', 'ser_no', 'service no', 'service_no', 'military no', 'army no', 'force no'] },
  { key: 'serviceCategory', label: 'Service Category', category: 'Demographics', keywords: ['service category', 'service_category', 'service status', 'ser/vet/dep', 'category_ser'] },
  { key: 'admissionNo', label: 'Admission / IPD No', category: 'Demographics', keywords: ['admission no', 'admission_no', 'ipd no', 'ipd_no', 'mrn', 'hosp no', 'registration no'] },
  { key: 'age', label: 'Age', category: 'Demographics', keywords: ['age', 'age (yrs)', 'age_yrs', 'yrs'] },
  { key: 'gender', label: 'Gender / Sex', category: 'Demographics', keywords: ['gender', 'sex', 'm/f'] },
  { key: 'phoneNumbers', label: 'Phone Numbers', category: 'Demographics', keywords: ['phones', 'phone', 'phone numbers', 'mobile', 'contact', 'telephone'] },
  { key: 'additionalOperators', label: 'Additional Operators', category: 'Demographics', keywords: ['additional operators', 'additional operator', 'co-operator', 'operators', 'other operators', 'operators list', 'assistant operators'] },
  { key: 'weight', label: 'Weight (kg)', category: 'Demographics', keywords: ['weight', 'wt', 'weight (kg)', 'weight_kg'] },
  { key: 'height', label: 'Height (cm)', category: 'Demographics', keywords: ['height', 'ht', 'height (cm)', 'height_cm'] },
  { key: 'bmi', label: 'BMI', category: 'Demographics', keywords: ['bmi', 'body mass index'] },
  { key: 'place', label: 'Place / City', category: 'Demographics', keywords: ['place', 'city', 'address', 'location', 'residence'] },
  
  { key: 'date', label: 'Procedure Date', category: 'Clinical', keywords: ['date', 'procedure date', 'procedure_date', 'admission date', 'date of procedure', 'doa', 'dop'] },
  { key: 'presentation', label: 'Presentation / Diagnosis', category: 'Clinical', keywords: ['presentation', 'diagnosis', 'indication', 'clinical presentation', 'symptoms'] },
  { key: 'tmt', label: 'TMT Result', category: 'Clinical', keywords: ['tmt', 'tmt result', 'tmt_option', 'todd'] },
  { key: 'ejectionFraction', label: 'Ejection Fraction (EF)', category: 'Clinical', keywords: ['ef', 'ejection fraction', 'lvef', 'echo ef', 'echo'] },
  { key: 'otherEjectionFractionNotes', label: 'EF Notes', category: 'Clinical', keywords: ['ef notes', 'lvef notes', 'echo notes', 'ef_notes'] },
  { key: 'rwma', label: 'RWMA', category: 'Clinical', keywords: ['rwma', 'regional wall motion', 'wall motion'] },
  { key: 'comorbidities', label: 'Comorbidities', category: 'Clinical', keywords: ['comorbidities', 'risk factors', 'history', 'co-morbidities', 'past history'] },
  
  { key: 'access', label: 'Access Method', category: 'Procedure', keywords: ['access', 'access method', 'arterial access', 'access_method', 'site'] },
  { key: 'otherAccessNotes', label: 'Access Notes', category: 'Procedure', keywords: ['access notes', 'access_notes', 'arterial notes'] },
  { key: 'usgDoppler', label: 'USG Doppler', category: 'Procedure', keywords: ['usg doppler', 'usg', 'doppler', 'usg_doppler'] },
  { key: 'bifurcation', label: 'Bifurcation', category: 'Procedure', keywords: ['bifurcation', 'bifurcation lesion', 'bifurcation_flag'] },
  { key: 'isOther', label: 'Other Flag', category: 'Procedure', keywords: ['other flag', 'is_other', 'other_flag'] },
  { key: 'pciVessels', label: 'PCI Target Vessels', category: 'Procedure', keywords: ['pci vessels', 'vessels', 'target vessels', 'pci_vessels', 'vessel'] },
  { key: 'lesionTypes', label: 'Lesion Types', category: 'Procedure', keywords: ['lesion type', 'lesion types', 'lesion_type', 'lesion_types', 'cto/isr/thrombus'] },
  { key: 'imaging', label: 'Intracoronary Imaging', category: 'Procedure', keywords: ['imaging', 'ivus/oct', 'intracoronary imaging', 'oct', 'ivus', 'ffr'] },
  { key: 'imagingFindings', label: 'Imaging Findings', category: 'Procedure', keywords: ['imaging findings', 'imaging_findings', 'ivus findings', 'oct findings'] },
  { key: 'specialHardware', label: 'Special Hardware', category: 'Procedure', keywords: ['special hardware', 'sp hardware', 'lesion prep', 'rota/ivl', 'hardware'] },
  { key: 'stentDetails', label: 'Stent Details', category: 'Procedure', keywords: ['stent details', 'stents', 'stent_details', 'stent info', 'des details'] },
  { key: 'brsDetails', label: 'BRS Details', category: 'Procedure', keywords: ['brs details', 'brs', 'brs_details', 'scaffold details'] },
  { key: 'debDetails', label: 'DEB Details', category: 'Procedure', keywords: ['deb details', 'deb', 'deb_details', 'balloon details'] },
  { key: 'lesions', label: 'Lesion Characteristics', category: 'Procedure', keywords: ['lesions', 'lesion details', 'lesion_details', 'stenosis'] },
  { key: 'devices', label: 'Device Counts', category: 'Procedure', keywords: ['devices', 'device counts', 'device_counts', 'des/deb count'] },
  { key: 'closureDevice', label: 'Closure Device', category: 'Procedure', keywords: ['closure device', 'closure_device', 'femoral closure'] },
  { key: 'complications', label: 'Complications', category: 'Procedure', keywords: ['complications', 'complication', 'adverse events'] },
  { key: 'otherHardware', label: 'Other Support Hardware', category: 'Procedure', keywords: ['other hardware', 'support hardware', 'iabp/tpi', 'other_hardware'] },
  { key: 'otherHardwareNotes', label: 'Other Hardware Notes', category: 'Procedure', keywords: ['other hardware notes', 'support hardware notes'] },
  { key: 'drugs', label: 'Medications / Drugs', category: 'Procedure', keywords: ['drugs', 'medications', 'antiplatelets', 'antiplatelet'] },
  
  { key: 'preHb', label: 'Pre-Op Hb', category: 'Labs', keywords: ['pre hb', 'pre_hb', 'baseline hb', 'pre hb (g/dl)'] },
  { key: 'preUrea', label: 'Pre-Op Urea', category: 'Labs', keywords: ['pre urea', 'pre_urea', 'baseline urea'] },
  { key: 'preCreatinine', label: 'Pre-Op Creatinine', category: 'Labs', keywords: ['pre creatinine', 'pre_creatinine', 'pre cr', 'pre creatinine (mg/dl)'] },
  { key: 'preK', label: 'Pre-Op K+', category: 'Labs', keywords: ['pre k', 'pre_k', 'pre k+', 'pre potassium'] },
  { key: 'postHb', label: 'Post-Op Hb', category: 'Labs', keywords: ['post hb', 'post_hb', 'discharge hb'] },
  { key: 'postUrea', label: 'Post-Op Urea', category: 'Labs', keywords: ['post urea', 'post_urea'] },
  { key: 'postCreatinine', label: 'Post-Op Creatinine', category: 'Labs', keywords: ['post creatinine', 'post_creatinine', 'post cr'] },
  { key: 'postK', label: 'Post-Op K+', category: 'Labs', keywords: ['post k', 'post_k', 'post k+', 'post potassium'] },
  
  { key: 'finalNotes', label: 'Procedure / Final Notes', category: 'Notes & Other', keywords: ['final notes', 'final_notes', 'procedure notes', 'summary notes', 'procedure summary'] },
  { key: 'plan', label: 'Further Plan / Recommendations', category: 'Notes & Other', keywords: ['plan', 'further plan', 'future plan', 'management plan', 'treatment plan', 'recommendations', 'discharge plan', 'next steps'] },
  { key: 'notes', label: 'General / Clinical Notes', category: 'Notes & Other', keywords: ['notes', 'general notes', 'remarks', 'comments', 'clinical notes'] },
  { key: 'category', label: 'Report Category', category: 'Notes & Other', keywords: ['category', 'report category', 'procedure type', 'type'] },
  { key: 'tags', label: 'Tags', category: 'Notes & Other', keywords: ['tags', 'keywords', 'labels'] },
  { key: 'outcomes', label: 'Outcomes / Follow-up', category: 'Notes & Other', keywords: ['outcomes', 'outcome', 'followup', 'follow up', 'status'] },
];

/**
 * Robust CSV Line Splitter
 */
export function parseCSVText(csvText: string): CSVParseResult {
  // Normalize newlines
  const text = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Detect delimiter (, or ; or \t)
  const sampleLines = text.split('\n').filter(l => l.trim().length > 0).slice(0, 5);
  let delimiter = ',';
  if (sampleLines.length > 0) {
    const commaCount = (sampleLines[0].match(/,/g) || []).length;
    const semiCount = (sampleLines[0].match(/;/g) || []).length;
    const tabCount = (sampleLines[0].match(/\t/g) || []).length;
    
    if (semiCount > commaCount && semiCount > tabCount) delimiter = ';';
    else if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';
  }

  const rawRows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote inside quoted field
          currentField += '"';
          i++; // skip next quote
        } else {
          // Closing quote
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some(cell => cell.length > 0)) {
          rawRows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  // Push final field/row if any
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(cell => cell.length > 0)) {
      rawRows.push(currentRow);
    }
  }

  if (rawRows.length === 0) {
    return { headers: [], rows: [], rawRows: [], delimiter };
  }

  // Clean headers
  const headers = rawRows[0].map(h => h.replace(/^["']|["']$/g, '').trim());
  const rows: Record<string, string>[] = [];

  for (let r = 1; r < rawRows.length; r++) {
    const rowCells = rawRows[r];
    const rowObj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      rowObj[header] = rowCells[idx] !== undefined ? rowCells[idx] : '';
    });
    rows.push(rowObj);
  }

  return { headers, rows, rawRows, delimiter };
}

/**
 * Smart Auto Mapping of CSV Headers -> Patient Fields
 */
export function guessFieldMappings(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedKeys = new Set<string>();

  headers.forEach(header => {
    const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Check exact or keyword match against PATIENT_FIELDS
    let bestMatchKey = '';

    for (const field of PATIENT_FIELDS) {
      if (usedKeys.has(field.key)) continue;

      // 1. Direct match with field.key
      if (normalizedHeader === field.key.toLowerCase()) {
        bestMatchKey = field.key;
        break;
      }

      // 2. Keyword check
      for (const kw of field.keywords) {
        const normalizedKw = kw.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (
          normalizedHeader === normalizedKw ||
          (normalizedKw.length >= 3 && normalizedHeader.includes(normalizedKw))
        ) {
          bestMatchKey = field.key;
          break;
        }
      }

      if (bestMatchKey) break;
    }

    if (bestMatchKey) {
      mapping[header] = bestMatchKey;
      usedKeys.add(bestMatchKey);
    } else {
      mapping[header] = ''; // unmapped
    }
  });

  return mapping;
}

/**
 * Get single field suggestion for a header
 */
export function getSuggestedField(header: string, usedKeys: Set<string>): FieldDefinition | null {
  const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!normalizedHeader) return null;

  for (const field of PATIENT_FIELDS) {
    if (usedKeys.has(field.key)) continue;

    if (normalizedHeader === field.key.toLowerCase()) {
      return field;
    }

    for (const kw of field.keywords) {
      const normalizedKw = kw.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (
        normalizedHeader === normalizedKw ||
        (normalizedKw.length >= 3 && (normalizedHeader.includes(normalizedKw) || normalizedKw.includes(normalizedHeader)))
      ) {
        return field;
      }
    }
  }

  return null;
}

/**
 * Format string array values from delimiter (|, ;, or comma)
 */
function parseStringArray(val: string): string[] {
  if (!val) return [];
  // Split on pipe |, semicolon ;, or comma if pipe/semicolon not present
  let items: string[] = [];
  if (val.includes('|')) {
    items = val.split('|');
  } else if (val.includes(';')) {
    items = val.split(';');
  } else if (val.includes(',')) {
    items = val.split(',');
  } else {
    items = [val];
  }
  return items.map(s => s.trim()).filter(Boolean);
}

/**
 * Parse Date strings (DD/MM/YYYY, YYYY-MM-DD, MM/DD/YYYY, ISO) to YYYY-MM-DD
 */
function parseDateToISO(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];

  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = String(dmyMatch[1]).padStart(2, '0');
    const month = String(dmyMatch[2]).padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // YYYY/MM/DD
  const ymdMatch = dateStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = String(ymdMatch[2]).padStart(2, '0');
    const day = String(ymdMatch[3]).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Convert parsed CSV Row Object into a validated Patient object
 */
export function convertRowToPatient(
  rowObj: Record<string, string>,
  mapping: Record<string, string>,
  existingSerialNumbers: Set<number>,
  nextSerialNo: number,
  fallbackDefaults?: Record<string, string>
): Patient {
  // Helper to get raw value mapped to target key or fallback default
  const getValue = (targetKey: string): string => {
    const csvHeader = Object.keys(mapping).find(h => mapping[h] === targetKey);
    const val = csvHeader ? (rowObj[csvHeader] || '').trim() : '';
    if (!val && fallbackDefaults && fallbackDefaults[targetKey]) {
      return fallbackDefaults[targetKey].trim();
    }
    return val;
  };

  // Name
  const name = getValue('name') || 'Unnamed Patient';

  // Serial No
  let serialNo = parseInt(getValue('serialNo'), 10);
  if (isNaN(serialNo) || serialNo <= 0) {
    serialNo = nextSerialNo;
  }

  // Service Category
  const rawServiceCat = getValue('serviceCategory').toLowerCase();
  let serviceCategory = ServiceCategory.Ser;
  if (rawServiceCat.includes('vet')) serviceCategory = ServiceCategory.Vet;
  else if (rawServiceCat.includes('dep')) serviceCategory = ServiceCategory.Dep;

  // Gender
  const rawGender = getValue('gender').toLowerCase();
  let gender = Gender.Male;
  if (rawGender.startsWith('f') || rawGender.includes('female')) gender = Gender.Female;
  else if (rawGender.startsWith('o') || rawGender.includes('other')) gender = Gender.Other;

  // Age
  const age = parseInt(getValue('age'), 10) || 50;

  // Presentation
  const rawPres = getValue('presentation').trim();
  let presentation = Presentation.STEMI;
  const matchedEnum = Object.values(Presentation).find(pVal => pVal.toLowerCase() === rawPres.toLowerCase());
  if (matchedEnum) {
    presentation = matchedEnum;
  } else if (rawPres.toUpperCase().includes('STEMI')) presentation = Presentation.STEMI;
  else if (rawPres.toUpperCase().includes('NSTEMI')) presentation = Presentation.NSTEMI;
  else if (rawPres.toUpperCase().includes('USA')) presentation = Presentation.USA;
  else if (rawPres.toUpperCase().includes('PAMI')) presentation = Presentation.PAMI;
  else if (rawPres.toUpperCase().includes('CSA')) presentation = Presentation.CSA;
  else if (rawPres.toUpperCase().includes('SYNCOPE')) presentation = Presentation.Syncope;

  // Ejection Fraction
  const rawEf = getValue('ejectionFraction');
  let ejectionFraction = EjectionFraction.Normal;
  if (rawEf.toLowerCase().includes('mild')) ejectionFraction = EjectionFraction.Mild;
  else if (rawEf.toLowerCase().includes('moderate')) ejectionFraction = EjectionFraction.Moderate;
  else if (rawEf.toLowerCase().includes('severe')) ejectionFraction = EjectionFraction.Severe;

  // Access
  const rawAccess = getValue('access').toLowerCase();
  let access = AccessMethod.RtRadial;
  if (rawAccess.includes('lt radial') || rawAccess.includes('left radial')) access = AccessMethod.LtRadial;
  else if (rawAccess.includes('rt femoral') || rawAccess.includes('right femoral')) access = AccessMethod.RtFemoral;
  else if (rawAccess.includes('lt femoral') || rawAccess.includes('left femoral')) access = AccessMethod.LtFemoral;

  // Category
  const rawCat = getValue('category');
  let category = ReportCategory.CAG;
  if (Object.values(ReportCategory).includes(rawCat as any)) {
    category = rawCat as ReportCategory;
  }

  // TMT
  const rawTmt = getValue('tmt');
  let tmt = TMTOption.NA;
  if (rawTmt === '+' || rawTmt.toLowerCase().includes('pos')) tmt = TMTOption.Positive;
  else if (rawTmt === '-' || rawTmt.toLowerCase().includes('neg')) tmt = TMTOption.Negative;

  // Booleans
  const parseBool = (str: string) => ['yes', 'true', '1', 'y'].includes(str.toLowerCase());

  // Phone numbers
  const phoneNumbers = parseStringArray(getValue('phoneNumbers'));

  // Devices Record (DES:2|DEB:1)
  const devicesStr = getValue('devices');
  const devices: Partial<Record<DeviceType, number>> = {};
  if (devicesStr) {
    const pairs = devicesStr.split(/[\s|;,]+/);
    pairs.forEach(p => {
      const [type, qty] = p.split(':');
      if (type && qty) {
        const upperType = type.trim().toUpperCase() as DeviceType;
        const numQty = parseInt(qty, 10);
        if (numQty > 0) devices[upperType] = numQty;
      }
    });
  }

  // Imaging findings record
  const imagingFindingsStr = getValue('imagingFindings');
  const imagingFindings: Record<string, string> = {};
  if (imagingFindingsStr) {
    const pairs = imagingFindingsStr.split('|');
    pairs.forEach(p => {
      const [k, v] = p.split(':');
      if (k && v) imagingFindings[k.trim()] = v.trim();
    });
  }

  // Outcomes
  const outcomesStr = getValue('outcomes');
  const outcomes: Outcome[] = [];
  if (outcomesStr) {
    const items = outcomesStr.split(';');
    items.forEach(item => {
      const parts = item.split(':');
      if (parts.length >= 2) {
        outcomes.push({
          date: parseDateToISO(parts[0]),
          status: (parts[1].trim() as OutcomeStatus) || OutcomeStatus.FollowUp,
          notes: parts[2] ? parts[2].trim() : ''
        });
      }
    });
  }

  return {
    serialNo,
    serNo: getValue('serNo'),
    serviceCategory,
    admissionNo: getValue('admissionNo'),
    name,
    age,
    gender,
    date: parseDateToISO(getValue('date')),
    presentation,
    tmt,
    ejectionFraction,
    otherEjectionFractionNotes: getValue('otherEjectionFractionNotes'),
    rwma: parseStringArray(getValue('rwma')) as RWMAOption[],
    comorbidities: parseStringArray(getValue('comorbidities')) as Comorbidity[],
    labPhotoUrl: '',
    phoneNumbers,
    weight: parseFloat(getValue('weight')) || undefined,
    height: parseFloat(getValue('height')) || undefined,
    bmi: parseFloat(getValue('bmi')) || undefined,
    access,
    usgDoppler: parseBool(getValue('usgDoppler')),
    angiogramPhotoUrl: '',
    pciPhotoUrl: '',
    pciVessels: parseStringArray(getValue('pciVessels')) as PCIVessel[],
    lesionTypes: parseStringArray(getValue('lesionTypes')) as LesionType[],
    imaging: parseStringArray(getValue('imaging')) as ImagingOption[],
    imagingPhotoUrl: '',
    imagingFindings,
    specialHardware: parseStringArray(getValue('specialHardware')) as SpecialHardware[],
    stentDetails: parseStringArray(getValue('stentDetails')),
    brsDetails: parseStringArray(getValue('brsDetails')),
    debDetails: parseStringArray(getValue('debDetails')),
    lesions: parseStringArray(getValue('lesions')),
    devices,
    closureDevice: getValue('closureDevice'),
    complications: parseStringArray(getValue('complications')) as Complication[],
    complicationsCustom: getValue('complicationsCustom'),
    otherHardware: parseStringArray(getValue('otherHardware')) as OtherHardware[],
    otherHardwareNotes: getValue('otherHardwareNotes'),
    drugs: parseStringArray(getValue('drugs')) as Drug[],
    finalNotes: getValue('finalNotes'),
    plan: getValue('plan'),
    otherInfoPhotoUrl: '',
    notes: getValue('notes'),
    createdAt: new Date().toISOString(),
    createdBy: 'csv_import',
    additionalOperators: parseStringArray(getValue('additionalOperators')),
    place: getValue('place'),
    outcomes,
    category,
    tags: parseStringArray(getValue('tags')),
    bifurcation: parseBool(getValue('bifurcation')),
    isOther: parseBool(getValue('isOther')),
    preHb: getValue('preHb'),
    preUrea: getValue('preUrea'),
    preCreatinine: getValue('preCreatinine'),
    preK: getValue('preK'),
    postHb: getValue('postHb'),
    postUrea: getValue('postUrea'),
    postCreatinine: getValue('postCreatinine'),
    postK: getValue('postK')
  };
}
