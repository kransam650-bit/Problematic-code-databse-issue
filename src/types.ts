export enum ServiceCategory {
  Ser = 'Ser',
  Vet = 'Vet',
  Dep = 'Dep',
}

export enum ReportCategory {
  CAG = 'CAG',
  CAG_PCI = 'CAG+PCI',
  CAG_FFR = 'CAG+FFR',
  PCI = 'PCI',
  Primary_PCI = 'Primary PCI',
  Staged_PCI = 'Staged PCI',
  Fluoroscopy = 'Fluoroscopy',
  Devices = 'Devices',
  EP = 'EP',
  Renal = 'Renal',
  CAG_Renal = 'CAG+Renal',
  Peripheral = 'Peripheral',
  Pediatric = 'Pediatric',
  Structural = 'Structural',
  Other = 'Other',
}

export enum TMTOption {
  NA = 'NA',
  Positive = '+',
  Negative = '-',
}

export enum Gender {
  Male = 'Male',
  Female = 'Female',
  Other = 'Other',
}

export enum EjectionFraction {
  Normal = 'Normal',
  Mild = 'Mild LVSD',
  Moderate = 'Moderate LVSD',
  Severe = 'Severe LVSD',
  LVH = 'LVH',
  HCM = 'HCM',
  HOCM = 'HOCM',
  Other = 'Other',
}

export enum RWMAOption {
  LAD = 'LAD',
  LCX = 'LCX',
  RCA = 'RCA',
  Global = 'Global',
}

export enum Comorbidity {
  HTN = 'HTN',
  T2DM = 'T2DM',
  COPD = 'COPD',
  CKD = 'CKD',
  Anemia = 'Anemia',
  HepB = 'Hep B',
  HepC = 'Hep C',
  HIV = 'HIV',
  Dyslipidemia = 'Dyslipidemia',
  Hypothyroidism = 'Hypothyroidism',
  OSA = 'OSA',
  Other = 'Other',
}

export enum AccessMethod {
  RtRadial = 'Rt radial',
  LtRadial = 'Lt radial',
  RtFemoral = 'Rt femoral',
  LtFemoral = 'Lt femoral',
  Other = 'Other',
}

export enum ImagingOption {
  SPECT = 'SPECT',
  PET = 'PET',
  OCT = 'OCT',
  IVUS = 'IVUS',
  FFR = 'FFR',
  CMDStudy = 'CMD study',
}

export enum SpecialHardware {
  Scoring = 'Scoring',
  Cutting = 'Cutting',
  ROTA = 'ROTA',
  Orbital = 'Orbital',
  IVL = 'IVL',
  LASER = 'LASER',
  OPN_NC = 'OPN NC',
  Other = 'Other',
}

export enum Complication {
  Thrombus = 'Thrombus',
  SlowFlow = 'Slow flow',
  Perforation = 'Perforation',
  AccessComplication = 'Access complication',
  Other = 'Other',
}

export enum OtherHardware {
  TPI = 'TPI',
  IABP = 'IABP',
  LVAssist = 'LV assist',
  Ventilation = 'Ventilation',
  Other = 'Other',
}

export enum Presentation {
  PAMI = 'PAMI',
  USA = 'USA',
  NSTEMI = 'NSTEMI',
  STEMI = 'STEMI',
  CSA = 'CSA',
  CardioShock = 'Cardio Shock',
  SOB = 'SOB',
  Syncope = 'Syncope',
  AtypicalChestPain = 'ATYPICAL CHEST PAIN',
  NonCardiacChestPain = 'NON CARDIAC CHEST PAIN',
  ECGAbnormality = 'ECG Abnormality',
  LVDysfunctionIncidental = 'LV Dysfunction (incidental)',
  TMTPlus = 'TMT +',
}

export enum Drug {
  Aspirin = 'Aspirin',
  Clopidogrel = 'Clopidogrel',
  Ticagrelor = 'Ticagrelor',
  Prasugrel = 'Prasugrel',
  NOAC = 'NOAC',
  GPIIbIIIa = 'GP IIb/IIIa',
  tPA = 'tPA',
  TNK = 'TNK',
  Inclisiran = 'Inclisiran',
  Evolocumab = 'Evolocumab',
  LMWH = 'LMWH',
  UFH = 'UFH',
  Other = 'Other',
}

export enum DeviceType {
  DES = 'DES',
  BRS = 'BRS',
  DEB = 'DEB',
  POBA = 'POBA',
}

export enum PCIVessel {
  LM = 'LM',
  LAD = 'LAD',
  LCX = 'LCX',
  RCA = 'RCA',
  Graft = 'Graft',
  Renal = 'Renal',
  Peripheral = 'Peripheral',
  Other = 'Other',
}

export enum LesionType {
  Bifurcation = 'Bifurcation',
  Calcific = 'Calcific',
  CTO = 'CTO',
  ISR = 'ISR',
  THROMBUS = 'THROMBUS',
  SCAD = 'SCAD',
  Ectasia = 'Ectasia',
  Aneurysmal = 'Aneurysmal',
  Other = 'Other',
}

export enum OutcomeStatus {
  Discharged = 'Discharged',
  FollowUp = 'Follow Up',
  StagedPCI = 'Staged PCI',
  Readmitted = 'Readmitted',
  Death = 'Death',
}

export interface Outcome {
  status: OutcomeStatus;
  date: string;
  notes: string;
  photoUrl?: string;
}

export interface Patient {
  id?: string;
  patientId?: string;
  serialNo: number;
  serNo: string;
  serviceCategory: ServiceCategory;
  admissionNo: string;
  name: string;
  age: number;
  gender: Gender;
  date: string; // ISO date string
  presentation: Presentation;
  tmt: TMTOption;
  ejectionFraction: EjectionFraction;
  rwma: RWMAOption[];
  comorbidities: Comorbidity[];
  labPhotoUrl: string;
  phoneNumbers: string[];
  weight?: number;
  height?: number;
  bmi?: number;
  access: AccessMethod;
  usgDoppler: boolean;
  angiogramPhotoUrl: string;
  pciPhotoUrl: string;
  pciPhotoUrls?: string[];
  pciVessels: PCIVessel[];
  lesionTypes?: LesionType[];
  imaging: ImagingOption[];
  imagingPhotoUrl: string;
  imagingPhotoUrls?: string[];
  imagingFindings?: Record<string, string>;
  specialHardware: SpecialHardware[];
  otherSpecialHardwareNotes?: string;
  devices: Partial<Record<DeviceType, number>>;
  closureDevice?: string;
  closureDeviceCustom?: string;
  complications: Complication[];
  complicationsCustom?: string;
  otherHardware: OtherHardware[];
  otherHardwareNotes: string;
  drugs: Drug[];
  otherDrugsNotes?: string;
  finalNotes: string;
  plan?: string;
  otherInfoPhotoUrl: string;
  demographicsPhotoUrl?: string;
  notes: string;
  createdAt: any; // Firestore Timestamp
  updatedAt?: any; // Firestore Timestamp
  createdBy: string;
  additionalOperators?: string[];
  place?: string;
  outcomes?: Outcome[];
  category: ReportCategory;
  otherCategoryNotes?: string;
  tags: string[];
  isImportant?: boolean;
  bifurcation?: boolean;
  isOther?: boolean;
  otherAccessNotes?: string;
  otherEjectionFractionNotes?: string;
  localUpdatedAt?: string;
  synced?: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
  lesions?: string[];
  stentDetails?: string[];
  brsDetails?: string[];
  debDetails?: string[];
  preHb?: string;
  preUrea?: string;
  preCreatinine?: string;
  preK?: string;
  postHb?: string;
  postUrea?: string;
  postCreatinine?: string;
  postK?: string;
}

export interface PCITemplate {
  name: string;
  access: AccessMethod;
  pciVessels: PCIVessel[];
  devices: Partial<Record<DeviceType, number>>;
  drugs: Drug[];
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export interface PrintPreset {
  id?: string;
  name: string;
  headerTitle: string;
  showHospitalHeader: boolean;
  textSizeScale: 'compact' | 'normal' | 'large';
  layoutMode?: 'compact' | 'detailed';
  isAnonymized?: boolean;
  includeAiTags?: boolean;
  visibleSections: {
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
  physicianName: string;
  createdAt: string;
  createdBy: string;
}
