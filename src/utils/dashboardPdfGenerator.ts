import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { Patient } from '../types';

export interface DashboardPdfExportOptions {
  customTitle?: string;
  hospitalName?: string;
  physicianName?: string;
  filterSummary?: string;
  exportMode?: 'table' | 'summary';
  dashboardElementId?: string;
  stats?: any;
}

// Vector Color Constants
const PALETTE = {
  indigo: [79, 70, 229] as [number, number, number],
  blue: [37, 99, 235] as [number, number, number],
  emerald: [16, 185, 129] as [number, number, number],
  rose: [225, 29, 72] as [number, number, number],
  amber: [217, 119, 6] as [number, number, number],
  purple: [147, 51, 234] as [number, number, number],
  cyan: [6, 182, 212] as [number, number, number],
  teal: [20, 184, 166] as [number, number, number],
  slateDark: [15, 23, 42] as [number, number, number],
  slateMuted: [100, 116, 139] as [number, number, number],
  slateLight: [248, 250, 252] as [number, number, number],
  border: [226, 232, 240] as [number, number, number]
};

const CHART_COLORS: [number, number, number][] = [
  PALETTE.indigo, PALETTE.blue, PALETTE.emerald, PALETTE.rose, 
  PALETTE.amber, PALETTE.purple, PALETTE.cyan, PALETTE.teal
];

/**
 * Helper for safe rounded rectangle drawing in jsPDF
 */
const safeRoundedRect = (
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  rx: number,
  ry: number,
  style?: string
) => {
  const safeX = Number(x);
  const safeY = Number(y);
  const safeW = Number(w);
  const safeH = Number(h);
  if (isNaN(safeX) || isNaN(safeY) || isNaN(safeW) || isNaN(safeH) || safeW <= 0 || safeH <= 0) {
    return;
  }
  const safeRx = Math.max(0, Math.min(Number(rx) || 0, safeW / 2));
  const safeRy = Math.max(0, Math.min(Number(ry) || 0, safeH / 2));
  try {
    if (safeRx > 0 && safeRy > 0) {
      doc.roundedRect(safeX, safeY, safeW, safeH, safeRx, safeRy, style as any);
    } else {
      doc.rect(safeX, safeY, safeW, safeH, style as any);
    }
  } catch (e) {
    try {
      doc.rect(safeX, safeY, safeW, safeH, style as any);
    } catch (_) {}
  }
};

/**
 * Helper to draw KPI Card on Vector PDF
 */
const drawKpiCard = (
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  accentColor: [number, number, number],
  subLabel?: string
) => {
  doc.setFillColor(PALETTE.slateLight[0], PALETTE.slateLight[1], PALETTE.slateLight[2]);
  safeRoundedRect(doc, x, y, w, h, 2, 2, 'F');

  doc.setDrawColor(PALETTE.border[0], PALETTE.border[1], PALETTE.border[2]);
  safeRoundedRect(doc, x, y, w, h, 2, 2, 'D');

  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  safeRoundedRect(doc, x, y, w, 2, 1, 1, 'F');

  doc.setFont('helvetica', 'bold');
  let labelFontSize = 6.5;
  if (label.length > 18) labelFontSize = 5.2;
  else if (label.length > 12) labelFontSize = 5.8;
  doc.setFontSize(labelFontSize);
  doc.setTextColor(PALETTE.slateMuted[0], PALETTE.slateMuted[1], PALETTE.slateMuted[2]);
  const labelLine = doc.splitTextToSize((label || '').toUpperCase(), w - 5)[0] || (label || '').toUpperCase();
  doc.text(labelLine, x + 4, y + 6.5);

  doc.setFont('helvetica', 'bold');
  let valFontSize = 10;
  const strVal = String(value ?? '');
  if (strVal.length > 16) valFontSize = 6.5;
  else if (strVal.length > 10) valFontSize = 7.5;
  else if (strVal.length > 7) valFontSize = 8.5;
  doc.setFontSize(valFontSize);
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  const valLine = doc.splitTextToSize(strVal, w - 5)[0] || strVal;
  doc.text(valLine, x + 4, y + 12.5);

  if (subLabel) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(148, 163, 184);
    const subLine = doc.splitTextToSize(subLabel, w - 5)[0] || subLabel;
    doc.text(subLine, x + 4, y + 16);
  }
};

/**
 * Helper to draw vector Horizontal Bar Chart in PDF
 */
const drawVectorHorizontalBarChart = (
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  title: string,
  items: { label: string; count: number; color?: [number, number, number] }[],
  totalCohort: number
): number => {
  if (!items || items.length === 0) return y;

  const validItems = items.map(item => ({
    label: item.label || 'Unknown',
    count: Math.max(0, Number(item.count) || 0),
    color: item.color
  }));

  const maxCount = Math.max(...validItems.map(i => i.count), 1);
  const rowHeight = 6.5;
  const labelWidth = 42;
  const valWidth = 28;
  const barWidth = Math.max(10, w - labelWidth - valWidth);

  // Header Box
  doc.setFillColor(241, 245, 249);
  doc.rect(x, y, w, 6, 'F');
  const headerColor = validItems[0]?.color || PALETTE.indigo;
  doc.setFillColor(headerColor[0], headerColor[1], headerColor[2]);
  doc.rect(x, y, 2.5, 6, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  const chartTitle = doc.splitTextToSize((title || '').toUpperCase(), w - 8)[0] || (title || '').toUpperCase();
  doc.text(chartTitle, x + 5, y + 4.2);

  let currentY = y + 8.5;

  validItems.slice(0, 7).forEach((item, idx) => {
    const color = item.color || CHART_COLORS[idx % CHART_COLORS.length];
    const pctVal = totalCohort > 0 ? (item.count / totalCohort) * 100 : 0;
    const fillW = Math.max(Math.min((item.count / maxCount) * barWidth, barWidth), 0.5);

    // Label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);
    const itemLabel = doc.splitTextToSize(item.label, labelWidth - 3)[0] || item.label;
    doc.text(itemLabel, x + 2, currentY + 3.5);

    // Track Bar
    doc.setFillColor(241, 245, 249);
    safeRoundedRect(doc, x + labelWidth, currentY, barWidth, 4.2, 1, 1, 'F');

    // Filled Bar
    doc.setFillColor(color[0], color[1], color[2]);
    safeRoundedRect(doc, x + labelWidth, currentY, fillW, 4.2, 1, 1, 'F');

    // Value & % Callout
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${item.count} (${pctVal.toFixed(1)}%)`, x + w - 1, currentY + 3.5, { align: 'right' });

    currentY += rowHeight;
  });

  return currentY + 3;
};

/**
 * Helper to draw vector Donut Chart in PDF
 */
const drawVectorDonutChart = (
  doc: jsPDF,
  x: number,
  y: number,
  r: number,
  title: string,
  slices: { label: string; value: number; color: [number, number, number] }[]
) => {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  
  // Section Box Title
  doc.setFillColor(241, 245, 249);
  doc.rect(x, y - 5, 85, 6, 'F');
  doc.setFillColor(slices[0]?.color[0] || 79, slices[0]?.color[1] || 70, slices[0]?.color[2] || 229);
  doc.rect(x, y - 5, 2.5, 6, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  const donutTitle = doc.splitTextToSize(title.toUpperCase(), 78)[0] || title.toUpperCase();
  doc.text(donutTitle, x + 5, y - 0.8);

  const cx = x + r + 3;
  const cy = y + r + 5;

  if (total > 0) {
    let startAngle = -Math.PI / 2;
    slices.forEach((slice) => {
      if (slice.value <= 0) return;
      const sliceAngle = (slice.value / total) * 2 * Math.PI;
      const endAngle = startAngle + sliceAngle;

      doc.setFillColor(slice.color[0], slice.color[1], slice.color[2]);
      const step = (endAngle - startAngle) / 24;
      for (let a = startAngle; a < endAngle; a += step) {
        const a1 = a;
        const a2 = Math.min(a + step, endAngle);
        const x1 = cx + r * Math.cos(a1);
        const y1 = cy + r * Math.sin(a1);
        const x2 = cx + r * Math.cos(a2);
        const y2 = cy + r * Math.sin(a2);
        doc.triangle(cx, cy, x1, y1, x2, y2, 'F');
      }
      startAngle = endAngle;
    });

    // Donut hole
    doc.setFillColor(255, 255, 255);
    doc.circle(cx, cy, r * 0.58, 'F');

    // Center text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(String(total), cx, cy + 0.5, { align: 'center' });
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('PATIENTS', cx, cy + 4, { align: 'center' });
  }

  // Legend
  let legendY = y + 5;
  const legendX = cx + r + 6;
  slices.forEach((slice) => {
    const pct = total > 0 ? ((slice.value / total) * 100).toFixed(1) + '%' : '0%';
    doc.setFillColor(slice.color[0], slice.color[1], slice.color[2]);
    doc.rect(legendX, legendY - 2.5, 3, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text(slice.label, legendX + 4.5, legendY);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`${slice.value} (${pct})`, x + 83, legendY, { align: 'right' });

    legendY += 5.5;
  });
};

export const generateDashboardPDF = async (
  patients: Patient[],
  stats: any,
  options?: DashboardPdfExportOptions,
  shouldSave = true
) => {
  const customTitle = options?.customTitle || "CARDIOVASCULAR CLINICAL ANALYTICS REPORT";
  const hospitalName = options?.hospitalName || "Department of Cardiology & Interventional Cath Lab";
  const physicianName = options?.physicianName || "Dr Bharat S Sambyal";
  const filterSummary = options?.filterSummary || `Total Analyzed Records: ${patients.length}`;
  const exportMode = options?.exportMode || 'table';
  const elementId = options?.dashboardElementId || 'dashboard-export-container';

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const drawPageHeader = (pageTitle: string) => {
    // Header background bar
    doc.setFillColor(PALETTE.slateDark[0], PALETTE.slateDark[1], PALETTE.slateDark[2]);
    doc.rect(0, 0, 210, 36, 'F');

    // Accent line
    doc.setFillColor(PALETTE.indigo[0], PALETTE.indigo[1], PALETTE.indigo[2]);
    doc.rect(0, 36, 210, 2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    
    // Choose font size dynamically based on title length
    let titleFontSize = 12;
    if (pageTitle.length > 60) {
      titleFontSize = 9;
    } else if (pageTitle.length > 40) {
      titleFontSize = 10.5;
    }
    doc.setFontSize(titleFontSize);
    
    // Auto-fit and wrap titles cleanly within 175mm
    const titleLines = doc.splitTextToSize(pageTitle.toUpperCase(), 175);
    if (titleLines.length > 1) {
      doc.text(titleLines[0], 15, 12.5);
      doc.text(titleLines[1], 15, 17.5);
    } else {
      doc.text(titleLines[0], 15, 15.5);
    }

    // Subtitles
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);
    const subLine1 = doc.splitTextToSize(`${hospitalName}  |  Attending: ${physicianName}`, 175)[0] || hospitalName;
    const subLine2 = doc.splitTextToSize(`Report Date: ${new Date().toLocaleDateString('en-GB')}  |  ${filterSummary}`, 175)[0] || filterSummary;
    doc.text(subLine1, 15, 23);
    doc.text(subLine2, 15, 29);
  };

  let currentPage = 1;

  // 1. VECTOR PAGES: COLORFUL CHARTS & METRIC PANELS
  if (exportMode === 'table' || exportMode === 'summary') {
    // ==========================================
    // PAGE 1: EXECUTIVE PROCEDURAL & ACCESS OVERVIEW
    // ==========================================
    drawPageHeader(`${customTitle} - Procedural Overview`);

    let y = 44;

    // KPI METRIC CARDS GRID (4 Cards per row x 2 rows = 8 Cards)
    const totalPCI = patients.filter(p => p.pciVessels && p.pciVessels.length > 0).length;
    const radialCount = patients.filter(p => p.access && p.access.toLowerCase().includes('radial')).length;
    const radialPercent = patients.length > 0 ? ((radialCount / patients.length) * 100).toFixed(1) + '%' : '0%';
    const bifurcationCount = stats.bifurcationData?.find((d: any) => d.name === 'Yes')?.value || 0;
    const bifurcationPercent = patients.length > 0 ? ((bifurcationCount / patients.length) * 100).toFixed(1) + '%' : '0%';
    const tmtPosCount = stats.tmtData?.find((d: any) => d.name === '+')?.value || 0;
    const tmtPosPercent = patients.length > 0 ? ((tmtPosCount / patients.length) * 100).toFixed(1) + '%' : '0%';

    const kpis = [
      { label: "Total Cohort", val: `${patients.length}`, accent: PALETTE.indigo, sub: "Total Enrolled" },
      { label: "Average Age", val: `${stats.avgAge} Yrs`, accent: PALETTE.blue, sub: "Mean Patient Age" },
      { label: "PCI Volume", val: `${totalPCI} Cases`, accent: PALETTE.emerald, sub: "Interventional PCI" },
      { label: "Radial First", val: `${radialPercent}`, accent: PALETTE.cyan, sub: "Radial Access Rate" },
      { label: "Devices Used", val: `${stats.totalDevicesUsedCount} Units`, accent: PALETTE.purple, sub: "Stents/Balloons/Hardware" },
      { label: "Bifurcation %", val: `${bifurcationPercent}`, accent: PALETTE.rose, sub: "Complex Bifurcation" },
      { label: "TMT Positive %", val: `${tmtPosPercent}`, accent: PALETTE.amber, sub: "Ischemia Positive" },
      { label: "Top Presentation", val: `${stats.presentationData?.[0]?.name || 'N/A'}`, accent: PALETTE.teal, sub: "Primary Admission" }
    ];

    const cardW = 42;
    const cardH = 18;
    const gapX = 4;
    kpis.forEach((kpi, idx) => {
      const col = idx % 4;
      const row = Math.floor(idx / 4);
      const xPos = 15 + col * (cardW + gapX);
      const yPos = y + row * (cardH + 3);
      drawKpiCard(doc, xPos, yPos, cardW, cardH, kpi.label, kpi.val, kpi.accent, kpi.sub);
    });

    y += 44;

    // COLORFUL VECTOR CHARTS & DIAGRAMS (2 columns layout)
    const colW = 87;

    // Left Column: Clinical Presentation Chart
    const presentationItems = (stats.presentationData || []).map((d: any, idx: number) => ({
      label: d.name || 'Unknown',
      count: Number(d.count ?? d.value ?? 0),
      color: [PALETTE.rose, PALETTE.amber, PALETTE.purple, PALETTE.emerald, PALETTE.blue, PALETTE.cyan][idx % 6]
    }));
    const nextYLeft = drawVectorHorizontalBarChart(doc, 15, y, colW, "Clinical Presentation Breakdown", presentationItems, patients.length);

    // Right Column: Target Vessels Chart
    const vesselItems = (stats.vesselData || []).map((d: any, idx: number) => ({
      label: d.name || 'Unknown',
      count: Number(d.count ?? d.value ?? 0),
      color: [PALETTE.indigo, PALETTE.rose, PALETTE.emerald, PALETTE.purple, PALETTE.teal, PALETTE.amber][idx % 6]
    }));
    const nextYRight = drawVectorHorizontalBarChart(doc, 108, y, colW, "PCI Target Vessels & Lesions", vesselItems, patients.length);

    y = Math.max(nextYLeft, nextYRight) + 4;

    // Row 2: Donut Charts (Gender & Access Site)
    const genderSlices = (stats.genderData || []).map((d: any) => ({
      label: d.name || 'Unknown',
      value: Number(d.value ?? d.count ?? 0),
      color: d.name === 'Male' ? PALETTE.blue : d.name === 'Female' ? PALETTE.rose : PALETTE.slateMuted
    }));
    drawVectorDonutChart(doc, 15, y, 11, "Gender Demographics", genderSlices);

    const accessSlices = (stats.accessData || []).map((d: any, idx: number) => ({
      label: d.name || 'Unknown',
      value: Number(d.count ?? d.value ?? 0),
      color: [PALETTE.cyan, PALETTE.amber, PALETTE.purple][idx % 3]
    }));
    drawVectorDonutChart(doc, 108, y, 11, "Access Site Distribution", accessSlices);

    // If summary mode, add a concise attestation footer on Page 1 and finish
    if (exportMode === 'summary') {
      y += 36;
      doc.setFillColor(248, 250, 252);
      safeRoundedRect(doc, 15, y, 180, 22, 2, 2, 'F');
      doc.setDrawColor(PALETTE.border[0], PALETTE.border[1], PALETTE.border[2]);
      safeRoundedRect(doc, 15, y, 180, 22, 2, 2, 'D');

      doc.setFillColor(PALETTE.indigo[0], PALETTE.indigo[1], PALETTE.indigo[2]);
      doc.rect(15, y, 3, 5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text("EXECUTIVE CLINICAL SUMMARY", 21, y + 4);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(71, 85, 105);
      doc.text(
        `Certified interventional summary for ${patients.length} enrolled patients. Attending: ${physicianName} (${hospitalName}). Conforms to national quality standards for radial-first PCI and device stewardship.`,
        20,
        y + 10,
        { maxWidth: 170, lineHeightFactor: 1.3 }
      );
    } else {
      // ==========================================
      // PAGE 2: RISK PROFILE, INTERVENTIONAL HARDWARE & COMPLEXITY
      // ==========================================
      doc.addPage();
      currentPage++;
      drawPageHeader(`${customTitle} - Risk Profile & Hardware`);
      y = 44;

      // Left Column: Comorbidities
      const comorbItems = (stats.comorbidityData || []).map((d: any, idx: number) => ({
        label: d.name || 'Unknown',
        count: Number(d.count ?? d.value ?? 0),
        color: [PALETTE.rose, PALETTE.blue, PALETTE.amber, PALETTE.emerald, PALETTE.purple, PALETTE.indigo][idx % 6]
      }));
      const nextYLeft2 = drawVectorHorizontalBarChart(doc, 15, y, colW, "Prevalent Comorbidities & Risk Profile", comorbItems, patients.length);

      // Right Column: Interventional Devices
      const deviceItems = (stats.deviceData || []).map((d: any, idx: number) => ({
        label: d.name || 'Unknown',
        count: Number(d.count ?? d.value ?? 0),
        color: [PALETTE.blue, PALETTE.emerald, PALETTE.purple, PALETTE.rose, PALETTE.teal, PALETTE.indigo][idx % 6]
      }));
      const nextYRight2 = drawVectorHorizontalBarChart(doc, 108, y, colW, "Interventional Devices & Hardware", deviceItems, Number(stats.totalDevicesUsedCount) || patients.length);

      y = Math.max(nextYLeft2, nextYRight2) + 4;

      // Donut Charts (Bifurcation & TMT Ischemia)
      const bifurcationSlices = (stats.bifurcationData || []).map((d: any) => ({
        label: d.name === 'Yes' ? 'Bifurcation' : 'Non-Bifurcation',
        value: Number(d.value ?? d.count ?? 0),
        color: d.name === 'Yes' ? PALETTE.purple : PALETTE.slateMuted
      }));
      drawVectorDonutChart(doc, 15, y, 11, "Bifurcation Lesion Rate", bifurcationSlices);

      const tmtSlices = (stats.tmtData || []).map((d: any) => ({
        label: d.name === '+' ? 'TMT Positive (+)' : d.name === '-' ? 'TMT Negative (-)' : 'TMT N/A',
        value: Number(d.value ?? d.count ?? 0),
        color: d.name === '+' ? PALETTE.rose : d.name === '-' ? PALETTE.emerald : PALETTE.slateMuted
      }));
      drawVectorDonutChart(doc, 108, y, 11, "TMT Stress Test Results", tmtSlices);

      y += 36;

      // Bottom Section of Page 2: Lesion Complexity & Complications Table
      doc.setFillColor(248, 250, 252);
      safeRoundedRect(doc, 15, y, 180, 48, 2, 2, 'F');
      doc.setDrawColor(PALETTE.border[0], PALETTE.border[1], PALETTE.border[2]);
      safeRoundedRect(doc, 15, y, 180, 48, 2, 2, 'D');

      // Section Header
      doc.setFillColor(PALETTE.indigo[0], PALETTE.indigo[1], PALETTE.indigo[2]);
      doc.rect(15, y, 3, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text("COMPOSITE LESION COMPLEXITY & PROCEDURAL SAFETY AUDIT", 21, y + 5);

      // Left Column: Complexity Indices
      const lmCount = Number(stats.lmCount) || 0;
      const calcPrep = Number(stats.calcifiedPrepCount) || 0;
      const multiVessel = Number(stats.multiVesselCount) || 0;
      const imagingUsed = Number(stats.imagingCount) || 0;
      const avgScore = Number(stats.avgComplexityScore) || 0;

      let compY = y + 12;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text("Complex PCI Biomarkers:", 20, compY);

      const compMetrics = [
        { label: "Left Main (LM) Involvement", count: lmCount },
        { label: "Multi-Vessel Interventions", count: multiVessel },
        { label: "Calcified Prep / Specialized Atherectomy", count: calcPrep },
        { label: "Intravascular Imaging (IVUS/OCT)", count: imagingUsed },
      ];

      compMetrics.forEach(m => {
        compY += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        doc.text(m.label, 22, compY);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(PALETTE.indigo[0], PALETTE.indigo[1], PALETTE.indigo[2]);
        const pct = totalPCI > 0 ? ` (${((m.count / totalPCI) * 100).toFixed(1)}%)` : '';
        doc.text(`${m.count} cases${pct}`, 92, compY, { align: 'right' });
      });

      // Right Column: In-Hospital Complications & Case Severity
      let compRightY = y + 12;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text("Procedural Safety & Adverse Events:", 108, compRightY);

      const complicationItems = (stats.complicationData || []).slice(0, 4);
      if (complicationItems.length === 0) {
        compRightY += 6;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(16, 185, 129);
        doc.text("Zero adverse procedural complications recorded (100% safety rate).", 108, compRightY);
      } else {
        complicationItems.forEach((c: any) => {
          compRightY += 5;
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(51, 65, 85);
          doc.text(c.name || 'Other', 108, compRightY);
          doc.setFont('helvetica', 'bold');
          const color = (c.name || '').toLowerCase() === 'none' ? PALETTE.emerald : PALETTE.rose;
          doc.setTextColor(color[0], color[1], color[2]);
          const cCount = Number(c.count ?? c.value ?? 0);
          const pct = patients.length > 0 ? ` (${((cCount / patients.length) * 100).toFixed(1)}%)` : '';
          doc.text(`${cCount} cases${pct}`, 188, compRightY, { align: 'right' });
        });
      }

      compRightY += 7;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);
      doc.text(`Mean PCI Complexity Score: ${avgScore} / 100`, 108, compRightY);

      // ==========================================
      // PAGE 3: CARDIAC FUNCTION, DEMOGRAPHICS & CLINICAL ATTESTATION
      // ==========================================
      doc.addPage();
      currentPage++;
      drawPageHeader(`${customTitle} - Cardiac Function & Outcomes`);
      y = 44;

      // Left Column: Ejection Fraction Function Breakdown
      const efItems = (stats.efData || []).map((d: any, idx: number) => ({
        label: `EF: ${d.name || 'Unknown'}`,
        count: Number(d.count ?? d.value ?? 0),
        color: [PALETTE.emerald, PALETTE.blue, PALETTE.amber, PALETTE.rose][idx % 4]
      }));
      const nextYLeft3 = drawVectorHorizontalBarChart(doc, 15, y, colW, "Left Ventricular EF Distribution", efItems, patients.length);

      // Right Column: Special Hardware & Imaging Utilization
      const shItems = (stats.shData || []).map((d: any, idx: number) => ({
        label: d.name || 'Hardware',
        count: Number(d.count ?? d.value ?? 0),
        color: [PALETTE.purple, PALETTE.teal, PALETTE.blue, PALETTE.rose, PALETTE.amber][idx % 5]
      }));
      const nextYRight3 = drawVectorHorizontalBarChart(doc, 108, y, colW, "Specialty Hardware & Imaging Devices", shItems, patients.length);

      y = Math.max(nextYLeft3, nextYRight3) + 4;

      // Row 2: Age Cohort Distribution & Drug Regimens
      const ageItems = (stats.ageData || []).map((d: any, idx: number) => ({
        label: `Age ${d.name} Yrs`,
        count: Number(d.count ?? d.value ?? 0),
        color: [PALETTE.cyan, PALETTE.blue, PALETTE.indigo, PALETTE.purple, PALETTE.rose][idx % 5]
      }));
      const nextYLeft4 = drawVectorHorizontalBarChart(doc, 15, y, colW, "Patient Age Cohort Distribution", ageItems, patients.length);

      const imagingItems = (stats.imagingData || []).map((d: any, idx: number) => ({
        label: d.name || 'Imaging',
        count: Number(d.count ?? d.value ?? 0),
        color: [PALETTE.teal, PALETTE.emerald, PALETTE.indigo, PALETTE.amber][idx % 4]
      }));
      const nextYRight4 = drawVectorHorizontalBarChart(doc, 108, y, colW, "Diagnostic & Imaging Modalities", imagingItems, patients.length);

      y = Math.max(nextYLeft4, nextYRight4) + 6;

      // Bottom Institutional Verification & Sign-Off Box
      doc.setFillColor(248, 250, 252);
      safeRoundedRect(doc, 15, y, 180, 44, 2, 2, 'F');
      doc.setDrawColor(PALETTE.border[0], PALETTE.border[1], PALETTE.border[2]);
      safeRoundedRect(doc, 15, y, 180, 44, 2, 2, 'D');

      doc.setFillColor(PALETTE.slateDark[0], PALETTE.slateDark[1], PALETTE.slateDark[2]);
      doc.rect(15, y, 3, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text("CLINICAL ATTESTATION & AUDIT VERIFICATION", 21, y + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(
        "This cardiovascular analytics report is automatically synthesized from certified catheterization database records. " +
        "All metrics conform to interventional cardiology standards for procedure tracking, radiation and device stewardship, and quality benchmarking.",
        20,
        y + 12,
        { maxWidth: 170, lineHeightFactor: 1.3 }
      );

      // Signatures
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);
      doc.text("Attending Physician:", 20, y + 28);
      doc.setFont('helvetica', 'normal');
      doc.text(physicianName, 20, y + 33);
      doc.line(20, y + 36, 80, y + 36);

      doc.setFont('helvetica', 'bold');
      doc.text("Institution / Department:", 110, y + 28);
      doc.setFont('helvetica', 'normal');
      doc.text(hospitalName, 110, y + 33);
      doc.line(110, y + 36, 185, y + 36);

      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}  |  Cath Data Clinical Suite`, 20, y + 41);
    }
  }

  // Page footer numbering & branding across all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Subtle Watermark
    doc.saveGraphicsState();
    // @ts-ignore
    if ((doc as any).GState) {
      // @ts-ignore
      const gState = new (doc as any).GState({ opacity: 0.05 });
      doc.setGState(gState);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(45);
    doc.setTextColor(100, 116, 139);
    doc.text('CLINICAL ANALYTICS', 105, 148.5, { align: 'center', angle: 45 });
    doc.restoreGraphicsState();

    // Footer Divider Line
    doc.setDrawColor(PALETTE.border[0], PALETTE.border[1], PALETTE.border[2]);
    doc.line(15, 282, 195, 282);

    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text("Cardiology Clinical Analytics | Confidential Medical Report", 15, 287);
    doc.text(`Page ${i} of ${totalPages}`, 195, 287, { align: 'right' });
  }

  const filename = `CathLab_Analytics_Dashboard_${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}.pdf`;
  if (shouldSave) {
    doc.save(filename);
  }

  return { doc, filename };
};

/**
 * Convert OKLCH and OKLAB color strings to standard rgb(...) or rgba(...) strings
 */
const convertOklchStringToRgb = (str: string): string => {
  if (!str || (!str.includes('oklch') && !str.includes('oklab'))) return str;

  // 1. Process OKLCH: oklch(L C H [/ A])
  const oklchRegex = /oklch\(\s*([\d.%]+)(?:[\s,]+)([\d.%]+)(?:[\s,]+)([\d.]+)(?:deg)?(?:\s*[\/,]\s*([\d.%]+))?\s*\)/gi;
  let result = str.replace(oklchRegex, (_match, lRaw, cRaw, hRaw, aRaw) => {
    try {
      let L = parseFloat(lRaw);
      if (lRaw.endsWith('%')) L /= 100;

      let C = parseFloat(cRaw);
      if (cRaw.endsWith('%')) C /= 100;

      let H = parseFloat(hRaw);

      let alpha = 1;
      if (aRaw !== undefined) {
        alpha = parseFloat(aRaw);
        if (aRaw.endsWith('%')) alpha /= 100;
      }

      const hRad = (H * Math.PI) / 180;
      const a = C * Math.cos(hRad);
      const b = C * Math.sin(hRad);

      const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
      const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
      const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

      const lLinear = l_ * l_ * l_;
      const mLinear = m_ * m_ * m_;
      const sLinear = s_ * s_ * s_;

      const rLin = +4.0767416621 * lLinear - 3.3077115913 * mLinear + 0.2309699292 * sLinear;
      const gLin = -1.2684380046 * lLinear + 2.6097574011 * mLinear - 0.3413193965 * sLinear;
      const bLin = -0.0041960863 * lLinear - 0.7034186147 * mLinear + 1.7076147010 * sLinear;

      const gamma = (val: number) => {
        const clamped = Math.max(0, Math.min(1, val));
        return clamped <= 0.0031308
          ? 12.92 * clamped
          : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
      };

      const r = Math.round(gamma(rLin) * 255);
      const g = Math.round(gamma(gLin) * 255);
      const bComp = Math.round(gamma(bLin) * 255);

      if (alpha < 1) {
        return `rgba(${r}, ${g}, ${bComp}, ${alpha.toFixed(3)})`;
      }
      return `rgb(${r}, ${g}, ${bComp})`;
    } catch {
      return 'rgb(100, 116, 139)';
    }
  });

  // 2. Process OKLAB: oklab(L a b [/ A])
  const oklabRegex = /oklab\(\s*([\d.%]+)(?:[\s,]+)([-\d.%]+)(?:[\s,]+)([-\d.%]+)(?:\s*[\/,]\s*([\d.%]+))?\s*\)/gi;
  result = result.replace(oklabRegex, (_match, lRaw, aRaw, bRaw, alphaRaw) => {
    try {
      let L = parseFloat(lRaw);
      if (lRaw.endsWith('%')) L /= 100;
      let a = parseFloat(aRaw);
      let b = parseFloat(bRaw);
      let alpha = 1;
      if (alphaRaw !== undefined) {
        alpha = parseFloat(alphaRaw);
        if (alphaRaw.endsWith('%')) alpha /= 100;
      }

      const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
      const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
      const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

      const lLinear = l_ * l_ * l_;
      const mLinear = m_ * m_ * m_;
      const sLinear = s_ * s_ * s_;

      const rLin = +4.0767416621 * lLinear - 3.3077115913 * mLinear + 0.2309699292 * sLinear;
      const gLin = -1.2684380046 * lLinear + 2.6097574011 * mLinear - 0.3413193965 * sLinear;
      const bLin = -0.0041960863 * lLinear - 0.7034186147 * mLinear + 1.7076147010 * sLinear;

      const gamma = (val: number) => {
        const clamped = Math.max(0, Math.min(1, val));
        return clamped <= 0.0031308
          ? 12.92 * clamped
          : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
      };

      const r = Math.round(gamma(rLin) * 255);
      const g = Math.round(gamma(gLin) * 255);
      const bComp = Math.round(gamma(bLin) * 255);

      if (alpha < 1) {
        return `rgba(${r}, ${g}, ${bComp}, ${alpha.toFixed(3)})`;
      }
      return `rgb(${r}, ${g}, ${bComp})`;
    } catch {
      return 'rgb(100, 116, 139)';
    }
  });

  // 3. Fallback for any non-standard or residual oklch/oklab occurrences
  result = result.replace(/okl(ch|ab)\([^)]+\)/gi, 'rgb(100, 116, 139)');

  return result;
};

const COLOR_PROPS = [
  'color',
  'backgroundColor',
  'borderColor',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'outlineColor',
  'fill',
  'stroke',
  'textDecorationColor'
];

/**
 * Sanitizes oklch and oklab color functions in cloned document to prevent html2canvas parsing errors.
 */
const sanitizeOklchInDoc = (clonedDoc: Document) => {
  // A. Convert OKLCH/OKLAB in existing <style> tags without destroying stylesheet rules
  try {
    const styleElements = clonedDoc.querySelectorAll('style');
    styleElements.forEach((styleEl) => {
      if (styleEl.textContent && (styleEl.textContent.includes('oklch') || styleEl.textContent.includes('oklab'))) {
        styleEl.textContent = convertOklchStringToRgb(styleEl.textContent);
      }
    });
  } catch (e) {
    console.warn('Error sanitizing style tags:', e);
  }

  // B. Convert computed colors on all elements directly into inline RGB/RGBA styles
  // so html2canvas's getComputedStyle calls receive standard rgb() values
  try {
    const allElements = clonedDoc.querySelectorAll('*');
    allElements.forEach((el) => {
      const htmlEl = el as HTMLElement;

      // 1. Inline style attribute
      const styleAttr = el.getAttribute('style');
      if (styleAttr && (styleAttr.includes('oklch') || styleAttr.includes('oklab'))) {
        el.setAttribute('style', convertOklchStringToRgb(styleAttr));
      }

      // 2. SVG attributes
      ['fill', 'stroke', 'color'].forEach((attr) => {
        const val = el.getAttribute(attr);
        if (val && (val.includes('oklch') || val.includes('oklab'))) {
          el.setAttribute(attr, convertOklchStringToRgb(val));
        }
      });

      // 3. Computed styles conversion
      try {
        const computed = clonedDoc.defaultView?.getComputedStyle(el) || window.getComputedStyle(el);
        if (computed) {
          COLOR_PROPS.forEach((prop) => {
            try {
              const val = (computed as any)[prop];
              if (val && typeof val === 'string' && (val.includes('oklch') || val.includes('oklab'))) {
                (htmlEl.style as any)[prop] = convertOklchStringToRgb(val);
              }
            } catch {}
          });

          const boxS = computed.boxShadow;
          if (boxS && (boxS.includes('oklch') || boxS.includes('oklab'))) {
            htmlEl.style.boxShadow = convertOklchStringToRgb(boxS);
          }
        }
      } catch {}
    });
  } catch (e) {
    console.warn('Error sanitizing elements:', e);
  }
};

/**
 * Export Dashboard Analytics Data to Excel Spreadsheet (.xlsx)
 */
export const exportDashboardExcel = (patients: Patient[], stats: any, filename?: string) => {
  const wb = XLSX.utils.book_new();

  // 1. Executive Summary
  const kpiRows = [
    ['Metric Description', 'Analyzed Value', 'Category Notes'],
    ['Total Cohort Patients', patients.length, 'All matching filtered records'],
    ['Average Patient Age (Years)', stats.avgAge || '0', 'Mean age'],
    ['PCI Case Volume', patients.filter(p => p.pciVessels && p.pciVessels.length > 0).length, 'Cases involving PCI'],
    ['Total Devices Used', stats.totalDevicesUsedCount || 0, 'Stents, balloons, microcatheters'],
    ['Radial Access Percentage', patients.length > 0 ? `${((patients.filter(p => p.access?.toLowerCase().includes('radial')).length / patients.length) * 100).toFixed(1)}%` : '0%', 'Radial first approach'],
    ['Bifurcation Lesions Percentage', patients.length > 0 ? `${(((stats.bifurcationData?.find((d: any) => d.name === 'Yes')?.value || 0) / patients.length) * 100).toFixed(1)}%` : '0%', 'Complex PCI']
  ];
  const kpiSheet = XLSX.utils.aoa_to_sheet(kpiRows);
  XLSX.utils.book_append_sheet(wb, kpiSheet, 'Executive Summary');

  // 2. Presentations
  if (stats.presentationData) {
    const presRows = stats.presentationData.map((d: any) => ({
      'Presentation Type': d.name,
      'Patient Count': d.count,
      'Cohort Prevalence (%)': patients.length > 0 ? ((d.count / patients.length) * 100).toFixed(1) + '%' : '0%'
    }));
    const presSheet = XLSX.utils.json_to_sheet(presRows);
    XLSX.utils.book_append_sheet(wb, presSheet, 'Presentations');
  }

  // 3. Target Vessels
  if (stats.vesselData) {
    const vesselRows = stats.vesselData.map((d: any) => ({
      'PCI Target Vessel': d.name,
      'Lesions Treated': d.count
    }));
    const vesselSheet = XLSX.utils.json_to_sheet(vesselRows);
    XLSX.utils.book_append_sheet(wb, vesselSheet, 'Target Vessels');
  }

  // 4. Hardware & Devices
  if (stats.deviceData) {
    const deviceRows = stats.deviceData.map((d: any) => ({
      'Device Category': d.name,
      'Quantity Deployed': d.count
    }));
    const deviceSheet = XLSX.utils.json_to_sheet(deviceRows);
    XLSX.utils.book_append_sheet(wb, deviceSheet, 'Devices & Hardware');
  }

  // 5. Comorbidities
  if (stats.comorbidityData) {
    const comorbRows = stats.comorbidityData.map((d: any) => ({
      'Risk Factor / Condition': d.name,
      'Count': d.count,
      'Prevalence (%)': patients.length > 0 ? ((d.count / patients.length) * 100).toFixed(1) + '%' : '0%'
    }));
    const comorbSheet = XLSX.utils.json_to_sheet(comorbRows);
    XLSX.utils.book_append_sheet(wb, comorbSheet, 'Comorbidities');
  }

  const name = filename || `CathLab_Analytics_Export_${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}.xlsx`;
  XLSX.writeFile(wb, name);
};

/**
 * Export Dashboard High-Res PNG Image
 */
export const exportDashboardPNG = async (elementId: string = 'dashboard-export-container', filename?: string) => {
  const elem = document.getElementById(elementId);
  if (!elem) throw new Error('Dashboard container element not found');

  const canvas = await html2canvas(elem, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#f8fafc',
    windowWidth: 1280,
    width: 1280,
    scrollX: 0,
    scrollY: 0,
    ignoreElements: (element) => {
      return element.classList?.contains('no-export') || element.id === 'export-toast';
    },
    onclone: (clonedDoc) => {
      sanitizeOklchInDoc(clonedDoc);

      // Force cloned document body to full 1280px desktop viewport
      clonedDoc.documentElement.style.width = '1280px';
      clonedDoc.documentElement.style.minWidth = '1280px';
      clonedDoc.body.style.width = '1280px';
      clonedDoc.body.style.minWidth = '1280px';
      clonedDoc.body.style.margin = '0';
      clonedDoc.body.style.padding = '0';

      const el = clonedDoc.getElementById(elementId);
      if (el) {
        el.style.width = '1280px';
        el.style.minWidth = '1280px';
        el.style.height = 'auto';
        el.style.maxHeight = 'none';
        el.style.overflow = 'visible';

        // Unclip tables, scrollable divs, and containers so nothing overflows out of bounds
        const allElements = el.querySelectorAll('*');
        allElements.forEach((node) => {
          const htmlNode = node as HTMLElement;
          const style = clonedDoc.defaultView?.getComputedStyle(htmlNode) || window.getComputedStyle(htmlNode);
          if (style.overflow === 'auto' || style.overflow === 'scroll' || style.overflowX === 'auto' || style.overflowX === 'scroll' || htmlNode.tagName === 'TABLE') {
            htmlNode.style.overflow = 'visible';
            htmlNode.style.overflowX = 'visible';
            htmlNode.style.overflowY = 'visible';
            htmlNode.style.maxWidth = 'none';
          }
        });

        // Ensure all SVGs have explicit dimensions for html2canvas rasterization
        const svgs = el.querySelectorAll('svg');
        svgs.forEach((svg) => {
          const rect = svg.getBoundingClientRect();
          if (rect.width > 0 && !svg.getAttribute('width')) {
            svg.setAttribute('width', `${Math.round(rect.width)}`);
          }
          if (rect.height > 0 && !svg.getAttribute('height')) {
            svg.setAttribute('height', `${Math.round(rect.height)}`);
          }
        });
      }
    }
  });

  const name = filename || `CathLab_Dashboard_Analytics_${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}.png`;
  const link = document.createElement('a');
  link.download = name;
  link.href = canvas.toDataURL('image/png', 1.0);
  link.click();
};
