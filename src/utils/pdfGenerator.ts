import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { Patient, Complication } from '../types';

export function formatDateDMY(dateInput: any): string {
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

export function getComplicationsStr(p: Patient, sep: string = ', '): string {
  return (p.complications || []).map(c => c === Complication.Other && p.complicationsCustom ? `Other: ${p.complicationsCustom}` : c).join(sep);
}

const urlToBase64 = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (url.startsWith('data:')) {
      resolve(url);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        try {
          const dataURL = canvas.toDataURL('image/jpeg', 0.85);
          resolve(dataURL);
        } catch (e) {
          reject(e);
        }
      } else {
        reject(new Error('Canvas context not available'));
      }
    };
    img.onerror = () => {
      reject(new Error('Failed to load image from URL: ' + url));
    };
    img.src = url;
  });
};

const safeGetBase64 = async (url: string): Promise<string | null> => {
  if (!url || url.includes('placeholder') || url.trim() === '') return null;
  try {
    return await urlToBase64(url);
  } catch (e) {
    console.warn('Could not load image for PDF:', url, e);
    return null;
  }
};

export interface PdfExportOptions {
  isAnonymized?: boolean;
  includeAiTags?: boolean;
  customHeaderTitle?: string;
  showHospitalHeader?: boolean;
  customPhysicianName?: string;
  visibleSections?: {
    demographics?: boolean;
    diagnostics?: boolean;
    anatomy?: boolean;
    pci?: boolean;
    outcomes?: boolean;
    photos?: boolean;
    signatures?: boolean;
    qrcode?: boolean;
    tags?: boolean;
  };
}

export const generatePatientPDF = async (
  p: Patient, 
  shouldSave = true, 
  syncHandle?: any, 
  options?: PdfExportOptions
) => {
  const isAnonymized = options?.isAnonymized || false;
  const includeAiTags = options?.includeAiTags ?? options?.visibleSections?.tags ?? true;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor = [15, 23, 42]; 
  const secondaryColor = [30, 41, 59]; 
  const accentColor = [14, 165, 233]; 
  const textColor = [51, 65, 85]; 
  const lightBg = [248, 250, 252]; 
  const borderCol = [226, 232, 240]; 

  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 42, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(options?.customHeaderTitle ? options.customHeaderTitle.toUpperCase() : "CARDIOVASCULAR PATIENT REPORT", 16, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(186, 230, 253); 
  const derivedId = `PAT-${String(p.serialNo).padStart(2, '0')}`;
  doc.text(`Patient ID: ${derivedId} (#${String(p.serialNo).padStart(2, '0')})  |  Report Date: ${new Date().toLocaleDateString()}`, 16, 26);
  
  if (isAnonymized) {
    doc.text(`Admission Number: REDACTED  |  Service No: REDACTED (${p.serviceCategory || 'N/A'})`, 16, 32);
  } else {
    doc.text(`Admission Number: ${p.admissionNo || 'N/A'}  |  Service No: ${p.serNo || 'N/A'} (${p.serviceCategory || 'N/A'})`, 16, 32);
  }

  let qrDataUrl = '';
  if (!isAnonymized && options?.visibleSections?.qrcode !== false) {
    try {
      const qrPayload = p.id 
        ? `${window.location.origin}/?patientId=${p.id}` 
        : `${window.location.origin}/?serialNo=${p.serialNo}`;
      qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 150, margin: 1 });
    } catch (err) {
      console.error('Error generating QR code for PDF:', err);
    }
  }
  if (qrDataUrl) {
    doc.setFillColor(255, 255, 255);
    doc.rect(170, 7, 28, 28, 'F');
    doc.addImage(qrDataUrl, 'PNG', 171, 8, 26, 26);
  }

  let y = 52;

  const drawSectionHeader = (title: string) => {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.setFillColor(241, 245, 249); 
    doc.rect(15, y, 180, 8, 'F');
    doc.setTextColor(15, 23, 42); 
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(title.toUpperCase(), 20, y + 5.5);
    y += 14;
  };

  const drawField = (label: string, value: string, x: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139); 
    doc.text(label.toUpperCase(), x, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42); 
    doc.text(value || 'N/A', x, y + 5);
  };

  drawSectionHeader(`Demographics & General Info${isAnonymized ? ' (Anonymized Record)' : ''}`);
  drawField("Full Name", isAnonymized ? "ANONYMIZED PATIENT" : p.name, 15);
  drawField("Age / Gender", `${p.age} Y / ${p.gender}`, 80);
  drawField("Procedure Date", formatDateDMY(p.date), 140);
  y += 11;

  drawField("Service Category", p.serviceCategory || 'N/A', 15);
  drawField("Admission No", isAnonymized ? "REDACTED" : (p.admissionNo || 'N/A'), 80);
  drawField("Phone Number(s)", isAnonymized ? "REDACTED" : ((p.phoneNumbers || []).join(' | ') || 'None'), 140);
  y += 11;

  drawField("Weight", p.weight ? `${p.weight} kg` : 'N/A', 15);
  drawField("Height", p.height ? `${p.height} cm` : 'N/A', 80);
  drawField("BMI", p.bmi ? `${p.bmi}` : 'N/A', 140);
  y += 11;

  if (p.additionalOperators && p.additionalOperators.length > 0) {
    drawField("Additional Operator(s)", p.additionalOperators.join(', '), 15);
    y += 11;
  }
  y += 6;

  drawSectionHeader("Clinical Presentation & Diagnostics");
  drawField("Presentation", p.presentation || 'N/A', 15);
  drawField("TMT Result", p.tmt || 'N/A', 80);
  drawField("Ejection Fraction (EF)", p.ejectionFraction || 'N/A', 140);
  y += 11;

  drawField("RWMA Territory", (p.rwma || []).join(', ') || 'None', 15);
  drawField("Comorbidities", (p.comorbidities || []).join(', ') || 'None', 105);
  y += 11;

  const preLabsStr = `Hb: ${p.preHb || 'N/A'} | Urea: ${p.preUrea || 'N/A'} | Creatinine: ${p.preCreatinine || 'N/A'} | Potassium: ${p.preK || 'N/A'}`;
  const postLabsStr = `Hb: ${p.postHb || 'N/A'} | Urea: ${p.postUrea || 'N/A'} | Creatinine: ${p.postCreatinine || 'N/A'} | Potassium: ${p.postK || 'N/A'}`;
  drawField("PRE PROCEDURE LABS", preLabsStr, 15);
  drawField("POST PROCEDURE LABS", postLabsStr, 105);
  y += 17;

  drawSectionHeader("Procedural Details & Devices");
  drawField("Access Method", p.access || 'N/A', 15);
  drawField("USG / Doppler Guided", p.usgDoppler ? "Yes" : "No", 80);
  drawField("Bifurcation Lesion", p.bifurcation ? "Yes" : "No", 140);
  y += 11;

  drawField("PCI Vessels", (p.pciVessels || []).join(', ') || 'None', 15);
  drawField("Lesion Type(s)", (p.lesionTypes || []).join(', ') || 'None', 80);
  const imagingFormatted = (p.imaging || []).map(opt => p.imagingFindings?.[opt] ? `${opt} (${p.imagingFindings[opt]})` : opt).join(', ') || 'None';
  drawField("Imaging and Physiology", imagingFormatted, 140);
  y += 11;

  drawField("Special Hardware", (p.specialHardware || []).join(', ') || 'None', 15);
  const devList = p.devices ? Object.entries(p.devices).filter(([_, qty]) => qty && qty > 0).map(([type, qty]) => `${type} (x${qty})`).join(', ') : 'None';
  drawField("Balloons / Stents Deployed", devList || 'None', 80);
  drawField("Complications", getComplicationsStr(p) || 'None', 140);
  y += 11;

  const closureDeviceStr = p.closureDevice ? (p.closureDevice === 'Others' ? (p.closureDeviceCustom || 'Others') : p.closureDevice) : 'None';
  drawField("Closure Device Used", closureDeviceStr, 15);
  drawField("Drugs / Pharmacotherapy", (p.drugs || []).join(', ') || 'None', 105);
  y += 11;

  if (includeAiTags && p.tags && p.tags.length > 0) {
    drawField("AI / Clinical Condition Tags", p.tags.map(t => `#${t}`).join(', '), 15);
    y += 11;
  } else {
    y += 6;
  }

  if ((p.lesions && p.lesions.length > 0) || (p.stentDetails && p.stentDetails.length > 0)) {
    if (y > 230) { doc.addPage(); y = 20; }
    drawSectionHeader("Standardized Anatomy & Implant Specifications");
    
    if (p.lesions && p.lesions.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("STANDARDIZED LESIONS IDENTIFIED", 15, y);
      y += 5;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      const lesionsStr = p.lesions.join('  |  ');
      const splitLesions = doc.splitTextToSize(lesionsStr, 180);
      doc.text(splitLesions, 15, y);
      y += splitLesions.length * 5 + 6;
    }
    
    if (p.stentDetails && p.stentDetails.length > 0) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("STANDARDIZED DES STENT SPECIFICATIONS", 15, y);
      y += 5;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      const stentsStr = p.stentDetails.join('  |  ');
      const splitStents = doc.splitTextToSize(stentsStr, 180);
      doc.text(splitStents, 15, y);
      y += splitStents.length * 5 + 6;
    }

    if (p.brsDetails && p.brsDetails.length > 0) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("STANDARDIZED BRS SCAFFOLD SPECIFICATIONS", 15, y);
      y += 5;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      const brsStr = p.brsDetails.join('  |  ');
      const splitBrs = doc.splitTextToSize(brsStr, 180);
      doc.text(splitBrs, 15, y);
      y += splitBrs.length * 5 + 6;
    }

    if (p.debDetails && p.debDetails.length > 0) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("STANDARDIZED DEB BALLOON SPECIFICATIONS", 15, y);
      y += 5;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      const debStr = p.debDetails.join('  |  ');
      const splitDeb = doc.splitTextToSize(debStr, 180);
      doc.text(splitDeb, 15, y);
      y += splitDeb.length * 5 + 6;
    }
    y += 4;
  }

  if (p.finalNotes || p.plan || p.notes) {
    drawSectionHeader("Medical & Clinical Notes");

    if (p.finalNotes) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("FINAL NOTES SUMMARY", 15, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      const splitFinal = doc.splitTextToSize(p.finalNotes, 180);
      doc.text(splitFinal, 15, y);
      y += splitFinal.length * 5 + 8;
    }

    if (p.plan) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(14, 116, 144);
      doc.text("FURTHER PLAN & RECOMMENDATIONS", 15, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      const splitPlan = doc.splitTextToSize(p.plan, 180);
      doc.text(splitPlan, 15, y);
      y += splitPlan.length * 5 + 8;
    }

    if (p.notes) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("GENERAL NOTES / CLINICIAN REMARKS", 15, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      const splitGeneral = doc.splitTextToSize(p.notes, 180);
      doc.text(splitGeneral, 15, y);
      y += splitGeneral.length * 5 + 8;
    }
  }

  if (p.outcomes && p.outcomes.length > 0) {
    if (y > 230) {
      doc.addPage();
      y = 20;
    }
    drawSectionHeader("Follow-Up & Outcome History");

    p.outcomes.forEach((outcome) => {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
      doc.rect(15, y, 180, 14, 'F');
      doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
      doc.rect(15, y, 180, 14, 'D');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(`Outcome: ${outcome.status.toUpperCase()}`, 18, y + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Date: ${formatDateDMY(outcome.date)}`, 140, y + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      const outcomeNotes = outcome.notes || "No additional logs provided.";
      doc.text(`Notes: ${outcomeNotes}`, 18, y + 10, { maxWidth: 172 });

      y += 18;
    });
  }

  const labBase64 = await safeGetBase64(p.labPhotoUrl);
  const angioBase64 = await safeGetBase64(p.angiogramPhotoUrl);
  const otherBase64 = await safeGetBase64(p.otherInfoPhotoUrl);
  const demographicsBase64 = await safeGetBase64(p.demographicsPhotoUrl);

  const pciPhotos = (p.pciPhotoUrls && p.pciPhotoUrls.length > 0) ? p.pciPhotoUrls : (p.pciPhotoUrl ? [p.pciPhotoUrl] : []);
  const imgPhotos = (p.imagingPhotoUrls && p.imagingPhotoUrls.length > 0) ? p.imagingPhotoUrls : (p.imagingPhotoUrl ? [p.imagingPhotoUrl] : []);

  const photosList: { base64: string | null; title: string }[] = [];

  if (labBase64) photosList.push({ base64: labBase64, title: 'Lab Record Photo' });
  if (angioBase64) photosList.push({ base64: angioBase64, title: 'Angiogram Photo' });

  for (let idx = 0; idx < pciPhotos.length; idx++) {
    const b64 = await safeGetBase64(pciPhotos[idx]);
    if (b64) {
      photosList.push({ 
        base64: b64, 
        title: `PCI Record Photo${pciPhotos.length > 1 ? ` #${idx + 1}` : ''}` 
      });
    }
  }

  for (let idx = 0; idx < imgPhotos.length; idx++) {
    const b64 = await safeGetBase64(imgPhotos[idx]);
    if (b64) {
      photosList.push({ 
        base64: b64, 
        title: `Physiology & Imaging Photo${imgPhotos.length > 1 ? ` #${idx + 1}` : ''}` 
      });
    }
  }

  if (otherBase64) photosList.push({ base64: otherBase64, title: 'Other Clinical Photo' });
  if (demographicsBase64) photosList.push({ base64: demographicsBase64, title: 'Demographics Photo' });

  if (photosList.length > 0) {
    doc.addPage();
    y = 20;
    drawSectionHeader("Imaging & Clinical Photos Annex");
    
    for (let i = 0; i < photosList.length; i++) {
      const item = photosList[i];
      if (!item.base64) continue;
      
      if (y > 210) {
        doc.addPage();
        y = 20;
      }
      
      const col = i % 2;
      const xPos = col === 0 ? 15 : 110;
      
      doc.setFillColor(248, 250, 252);
      doc.rect(xPos, y, 85, 68, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(xPos, y, 85, 68, 'D');
      
      try {
        doc.addImage(item.base64, 'JPEG', xPos + 2, y + 2, 81, 56);
      } catch (err) {
        console.error('Error rendering photo in PDF:', err);
      }
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(item.title.toUpperCase(), xPos + 4, y + 63);
      
      if (col === 1 || i === photosList.length - 1) {
        y += 74;
      }
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    doc.saveGraphicsState();
    // @ts-ignore
    const gState = new (doc as any).GState({ opacity: 0.1 });
    doc.setGState(gState);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(65);
    doc.setTextColor(150, 150, 150); 
    doc.text('CONFIDENTIAL', 105, 148.5, { align: 'center', angle: 45 });
    doc.restoreGraphicsState();

    doc.setDrawColor(226, 232, 240); 
    doc.line(15, 280, 195, 280);

    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); 
    doc.setFont('helvetica', 'normal');
    doc.text("Cardiovascular Department Clinical Record | Confidential Document", 15, 285);
    doc.text(`Page ${i} of ${pageCount}`, 180, 285);
  }

  const idStr = `PAT-${String(p.serialNo).padStart(2, '0')}`;
  const filename = isAnonymized 
    ? `Clinical_Report_${idStr}_Anonymized.pdf`
    : `Clinical_Report_${idStr}_${p.name.replace(/[^a-z0-9]/gi, '_')}.pdf`;
  if (shouldSave) {
    doc.save(filename);
  }
  if (syncHandle) {
    try {
      const pdfData = doc.output('arraybuffer');
      const fileHandle = await syncHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(pdfData);
      await writable.close();
      console.log(`Saved PDF report to local sync folder: ${filename}`);
    } catch (e) {
      console.error('Error auto-saving PDF to sync folder:', e);
    }
  }
  return { doc, filename };
};

export const generateCombinedPatientsPDF = async (
  selectedPatients: Patient[], 
  onProgress?: (current: number, total: number) => void, 
  syncHandle?: any, 
  shouldSave = true,
  options?: PdfExportOptions
) => {
  const isAnonymized = options?.isAnonymized || false;
  const includeAiTags = options?.includeAiTags ?? options?.visibleSections?.tags ?? true;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor = [15, 23, 42]; 
  const secondaryColor = [30, 41, 59]; 
  const accentColor = [14, 165, 233]; 
  const textColor = [51, 65, 85]; 
  const lightBg = [248, 250, 252]; 
  const borderCol = [226, 232, 240]; 

  for (let patientIdx = 0; patientIdx < selectedPatients.length; patientIdx++) {
    const p = selectedPatients[patientIdx];
    if (patientIdx > 0) {
      doc.addPage();
    }

    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 42, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(options?.customHeaderTitle ? options.customHeaderTitle.toUpperCase() : "CARDIOVASCULAR PATIENT REPORT", 16, 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(186, 230, 253); 
    const derivedId = `PAT-${String(p.serialNo).padStart(2, '0')}`;
    doc.text(`Patient ID: ${derivedId} (#${String(p.serialNo).padStart(2, '0')})  |  Report Date: ${new Date().toLocaleDateString()}`, 16, 26);
    
    if (isAnonymized) {
      doc.text(`Admission Number: REDACTED  |  Service No: REDACTED (${p.serviceCategory || 'N/A'})`, 16, 32);
    } else {
      doc.text(`Admission Number: ${p.admissionNo || 'N/A'}  |  Service No: ${p.serNo || 'N/A'} (${p.serviceCategory || 'N/A'})`, 16, 32);
    }

    let qrDataUrl = '';
    if (!isAnonymized && options?.visibleSections?.qrcode !== false) {
      try {
        const qrPayload = p.id 
          ? `${window.location.origin}/?patientId=${p.id}` 
          : `${window.location.origin}/?serialNo=${p.serialNo}`;
        qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 150, margin: 1 });
      } catch (err) {
        console.error('Error generating QR code for PDF:', err);
      }
    }
    if (qrDataUrl) {
      doc.setFillColor(255, 255, 255);
      doc.rect(170, 7, 28, 28, 'F');
      doc.addImage(qrDataUrl, 'PNG', 171, 8, 26, 26);
    }

    let y = 52;

    const drawSectionHeader = (title: string) => {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      doc.setFillColor(241, 245, 249); 
      doc.rect(15, y, 180, 8, 'F');
      doc.setTextColor(15, 23, 42); 
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(title.toUpperCase(), 20, y + 5.5);
      y += 14;
    };

    const drawField = (label: string, value: string, x: number) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139); 
      doc.text(label.toUpperCase(), x, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42); 
      doc.text(value || 'N/A', x, y + 5);
    };

    drawSectionHeader(`Demographics & General Info${isAnonymized ? ' (Anonymized Record)' : ''}`);
    drawField("Full Name", isAnonymized ? "ANONYMIZED PATIENT" : p.name, 15);
    drawField("Age / Gender", `${p.age} Y / ${p.gender}`, 80);
    drawField("Procedure Date", formatDateDMY(p.date), 140);
    y += 11;

    drawField("Service Category", p.serviceCategory || 'N/A', 15);
    drawField("Admission No", isAnonymized ? "REDACTED" : (p.admissionNo || 'N/A'), 80);
    drawField("Phone Number(s)", isAnonymized ? "REDACTED" : ((p.phoneNumbers || []).join(' | ') || 'None'), 140);
    y += 11;

    drawField("Weight", p.weight ? `${p.weight} kg` : 'N/A', 15);
    drawField("Height", p.height ? `${p.height} cm` : 'N/A', 80);
    drawField("BMI", p.bmi ? `${p.bmi}` : 'N/A', 140);
    y += 17;

    drawSectionHeader("Clinical Presentation & Diagnostics");
    drawField("Presentation", p.presentation || 'N/A', 15);
    drawField("TMT Result", p.tmt || 'N/A', 80);
    drawField("Ejection Fraction (EF)", p.ejectionFraction || 'N/A', 140);
    y += 11;

    drawField("RWMA Territory", (p.rwma || []).join(', ') || 'None', 15);
    drawField("Comorbidities", (p.comorbidities || []).join(', ') || 'None', 105);
    y += 11;

    const preLabsStr = `Hb: ${p.preHb || 'N/A'} | Urea: ${p.preUrea || 'N/A'} | Creatinine: ${p.preCreatinine || 'N/A'} | Potassium: ${p.preK || 'N/A'}`;
    const postLabsStr = `Hb: ${p.postHb || 'N/A'} | Urea: ${p.postUrea || 'N/A'} | Creatinine: ${p.postCreatinine || 'N/A'} | Potassium: ${p.postK || 'N/A'}`;
    drawField("PRE PROCEDURE LABS", preLabsStr, 15);
    drawField("POST PROCEDURE LABS", postLabsStr, 105);
    y += 17;

    drawSectionHeader("Procedural Details & Devices");
    drawField("Access Method", p.access || 'N/A', 15);
    drawField("USG / Doppler Guided", p.usgDoppler ? "Yes" : "No", 80);
    drawField("Bifurcation Lesion", p.bifurcation ? "Yes" : "No", 140);
    y += 11;

    drawField("PCI Vessels", (p.pciVessels || []).join(', ') || 'None', 15);
    drawField("Lesion Type(s)", (p.lesionTypes || []).join(', ') || 'None', 80);
    const imagingFormatted2 = (p.imaging || []).map(opt => p.imagingFindings?.[opt] ? `${opt} (${p.imagingFindings[opt]})` : opt).join(', ') || 'None';
    drawField("Imaging and Physiology", imagingFormatted2, 140);
    y += 11;

    drawField("Special Hardware", (p.specialHardware || []).join(', ') || 'None', 15);
    const devList = p.devices ? Object.entries(p.devices).filter(([_, qty]) => qty && qty > 0).map(([type, qty]) => `${type} (x${qty})`).join(', ') : 'None';
    drawField("Balloons / Stents Deployed", devList || 'None', 80);
    drawField("Complications", getComplicationsStr(p) || 'None', 140);
    y += 11;

    const closureDeviceStr = p.closureDevice ? (p.closureDevice === 'Others' ? (p.closureDeviceCustom || 'Others') : p.closureDevice) : 'None';
    drawField("Closure Device Used", closureDeviceStr, 15);
    drawField("Drugs / Pharmacotherapy", (p.drugs || []).join(', ') || 'None', 105);
    y += 11;

    if (includeAiTags && p.tags && p.tags.length > 0) {
      drawField("AI / Clinical Condition Tags", p.tags.map(t => `#${t}`).join(', '), 15);
      y += 11;
    } else {
      y += 6;
    }

    if ((p.lesions && p.lesions.length > 0) || (p.stentDetails && p.stentDetails.length > 0)) {
      if (y > 230) { doc.addPage(); y = 20; }
      drawSectionHeader("Standardized Anatomy & Implant Specifications");
      
      if (p.lesions && p.lesions.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text("STANDARDIZED LESIONS IDENTIFIED", 15, y);
        y += 5;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        const lesionsStr = p.lesions.join('  |  ');
        const splitLesions = doc.splitTextToSize(lesionsStr, 180);
        doc.text(splitLesions, 15, y);
        y += splitLesions.length * 5 + 6;
      }
      
      if (p.stentDetails && p.stentDetails.length > 0) {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text("STANDARDIZED DES STENT SPECIFICATIONS", 15, y);
        y += 5;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        const stentsStr = p.stentDetails.join('  |  ');
        const splitStents = doc.splitTextToSize(stentsStr, 180);
        doc.text(splitStents, 15, y);
        y += splitStents.length * 5 + 6;
      }

      if (p.brsDetails && p.brsDetails.length > 0) {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text("STANDARDIZED BRS SCAFFOLD SPECIFICATIONS", 15, y);
        y += 5;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        const brsStr = p.brsDetails.join('  |  ');
        const splitBrs = doc.splitTextToSize(brsStr, 180);
        doc.text(splitBrs, 15, y);
        y += splitBrs.length * 5 + 6;
      }

      if (p.debDetails && p.debDetails.length > 0) {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text("STANDARDIZED DEB BALLOON SPECIFICATIONS", 15, y);
        y += 5;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        const debStr = p.debDetails.join('  |  ');
        const splitDeb = doc.splitTextToSize(debStr, 180);
        doc.text(splitDeb, 15, y);
        y += splitDeb.length * 5 + 6;
      }
      y += 4;
    }

    if (p.finalNotes || p.plan || p.notes) {
      drawSectionHeader("Medical & Clinical Notes");

      if (p.finalNotes) {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text("FINAL NOTES SUMMARY", 15, y);
        y += 4;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(51, 65, 85);
        const splitFinal = doc.splitTextToSize(p.finalNotes, 180);
        doc.text(splitFinal, 15, y);
        y += splitFinal.length * 5 + 8;
      }

      if (p.plan) {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(14, 116, 144);
        doc.text("FURTHER PLAN & RECOMMENDATIONS", 15, y);
        y += 4;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(51, 65, 85);
        const splitPlan = doc.splitTextToSize(p.plan, 180);
        doc.text(splitPlan, 15, y);
        y += splitPlan.length * 5 + 8;
      }

      if (p.notes) {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text("GENERAL NOTES / CLINICIAN REMARKS", 15, y);
        y += 4;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(51, 65, 85);
        const splitGeneral = doc.splitTextToSize(p.notes, 180);
        doc.text(splitGeneral, 15, y);
        y += splitGeneral.length * 5 + 8;
      }
    }

    if (p.outcomes && p.outcomes.length > 0) {
      if (y > 230) {
        doc.addPage();
        y = 20;
      }
      drawSectionHeader("Follow-Up & Outcome History");

      p.outcomes.forEach((outcome) => {
        if (y > 250) {
          doc.addPage();
          y = 20;
        }
        doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
        doc.rect(15, y, 180, 14, 'F');
        doc.setDrawColor(borderCol[0], borderCol[1], borderCol[2]);
        doc.rect(15, y, 180, 14, 'D');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text(`Outcome: ${outcome.status.toUpperCase()}`, 18, y + 5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`Date: ${formatDateDMY(outcome.date)}`, 140, y + 5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        const outcomeNotes = outcome.notes || "No additional logs provided.";
        doc.text(`Notes: ${outcomeNotes}`, 18, y + 10, { maxWidth: 172 });

        y += 18;
      });
    }

    const labBase64 = await safeGetBase64(p.labPhotoUrl);
    const angioBase64 = await safeGetBase64(p.angiogramPhotoUrl);
    const otherBase64 = await safeGetBase64(p.otherInfoPhotoUrl);
    const demographicsBase64 = await safeGetBase64(p.demographicsPhotoUrl);

    const pciPhotos = (p.pciPhotoUrls && p.pciPhotoUrls.length > 0) ? p.pciPhotoUrls : (p.pciPhotoUrl ? [p.pciPhotoUrl] : []);
    const imgPhotos = (p.imagingPhotoUrls && p.imagingPhotoUrls.length > 0) ? p.imagingPhotoUrls : (p.imagingPhotoUrl ? [p.imagingPhotoUrl] : []);

    const photosList: { base64: string | null; title: string }[] = [];

    if (labBase64) photosList.push({ base64: labBase64, title: 'Lab Record Photo' });
    if (angioBase64) photosList.push({ base64: angioBase64, title: 'Angiogram Photo' });

    for (let idx = 0; idx < pciPhotos.length; idx++) {
      const b64 = await safeGetBase64(pciPhotos[idx]);
      if (b64) {
        photosList.push({ 
          base64: b64, 
          title: `PCI Record Photo${pciPhotos.length > 1 ? ` #${idx + 1}` : ''}` 
        });
      }
    }

    for (let idx = 0; idx < imgPhotos.length; idx++) {
      const b64 = await safeGetBase64(imgPhotos[idx]);
      if (b64) {
        photosList.push({ 
          base64: b64, 
          title: `Physiology & Imaging Photo${imgPhotos.length > 1 ? ` #${idx + 1}` : ''}` 
        });
      }
    }

    if (otherBase64) photosList.push({ base64: otherBase64, title: 'Other Clinical Photo' });
    if (demographicsBase64) photosList.push({ base64: demographicsBase64, title: 'Demographics Photo' });

    if (photosList.length > 0) {
      doc.addPage();
      y = 20;
      drawSectionHeader("Imaging & Clinical Photos Annex");
      
      for (let i = 0; i < photosList.length; i++) {
        const item = photosList[i];
        if (!item.base64) continue;
        
        if (y > 210) {
          doc.addPage();
          y = 20;
        }
        
        const col = i % 2;
        const xPos = col === 0 ? 15 : 110;
        
        doc.setFillColor(248, 250, 252);
        doc.rect(xPos, y, 85, 68, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(xPos, y, 85, 68, 'D');
        
        try {
          doc.addImage(item.base64, 'JPEG', xPos + 2, y + 2, 81, 56);
        } catch (err) {
          console.error('Error rendering photo in PDF:', err);
        }
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);
        doc.text(item.title.toUpperCase(), xPos + 4, y + 63);
        
        if (col === 1 || i === photosList.length - 1) {
          y += 74;
        }
      }
    }
    if (onProgress) {
      onProgress(patientIdx + 1, selectedPatients.length);
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    doc.saveGraphicsState();
    // @ts-ignore
    const gState = new (doc as any).GState({ opacity: 0.1 });
    doc.setGState(gState);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(65);
    doc.setTextColor(150, 150, 150); 
    doc.text('CONFIDENTIAL', 105, 148.5, { align: 'center', angle: 45 });
    doc.restoreGraphicsState();

    doc.setDrawColor(226, 232, 240); 
    doc.line(15, 280, 195, 280);

    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); 
    doc.setFont('helvetica', 'normal');
    doc.text("Cardiovascular Department Clinical Record | Confidential Document", 15, 285);
    doc.text(`Page ${i} of ${pageCount}`, 180, 285);
  }

  const filename = `Combined_Clinical_Report_${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}.pdf`;
  if (shouldSave) {
    doc.save(filename);
  }
  if (syncHandle) {
    try {
      const pdfData = doc.output('arraybuffer');
      const fileHandle = await syncHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(pdfData);
      await writable.close();
      console.log(`Saved combined PDF report to local sync folder: ${filename}`);
    } catch (e) {
      console.error('Error saving combined PDF to sync folder:', e);
    }
  }
  return { doc, filename };
};
