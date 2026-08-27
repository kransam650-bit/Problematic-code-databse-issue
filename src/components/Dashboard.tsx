import React, { useMemo, useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { Patient, ServiceCategory, Presentation, DeviceType, SpecialHardware, EjectionFraction, ImagingOption, PCIVessel, Complication } from '../types';
import { 
  X, LayoutDashboard, Users, Heart, AlertCircle, Activity, Zap, Layers, Target, 
  ChevronDown, Database, RefreshCw, Clock, AlertTriangle, Server, FileDown, 
  Filter, Calendar, Search, SlidersHorizontal, BarChart3, PieChartIcon, 
  FileText, CheckCircle2, Share2, Sparkles, ShieldAlert, Stethoscope,
  FileSpreadsheet, Image as ImageIcon, Printer, Gauge, TrendingUp, Compass, Crosshair, Award
} from 'lucide-react';
import { getSyncConflicts, resolveConflictKeepLocal, resolveConflictKeepCloud, SyncConflict } from '../services/patientService';
import { generateDashboardPDF, exportDashboardExcel, exportDashboardPNG, DashboardPdfExportOptions } from '../utils/dashboardPdfGenerator';

// Anatomical Color Tokens for Arterial Anatomy
export const VESSEL_COLORS: Record<string, string> = {
  'LAD': '#6366f1',  // Indigo
  'LCX': '#8b5cf6',  // Violet
  'RCA': '#f59e0b',  // Amber
  'LM': '#dc2626',   // Crimson
  'Ramus': '#06b6d4',// Cyan
  'Graft': '#10b981',// Emerald
  'SVG': '#059669',  // Emerald Dark
  'LIMA': '#14b8a6', // Teal
  'RIMA': '#0284c7', // Sky
  'Other': '#64748b' // Slate
};

export const getVesselColor = (name: string): string => {
  if (!name) return '#64748b';
  const u = name.toUpperCase();
  if (u.includes('LAD')) return VESSEL_COLORS['LAD'];
  if (u.includes('LCX')) return VESSEL_COLORS['LCX'];
  if (u.includes('RCA')) return VESSEL_COLORS['RCA'];
  if (u.includes('LM')) return VESSEL_COLORS['LM'];
  if (u.includes('RAMUS')) return VESSEL_COLORS['Ramus'];
  if (u.includes('GRAFT') || u.includes('SVG') || u.includes('LIMA') || u.includes('RIMA')) return VESSEL_COLORS['Graft'];
  return VESSEL_COLORS['Other'];
};

interface DashboardProps {
  patients: Patient[];
  onClose: () => void;
  lastBackupDate?: number;
  pendingSyncCount?: number;
  onRefresh?: () => void;
}

const COLORS = [
  '#2563eb', // Royal Blue
  '#ec4899', // Vibrant Pink
  '#10b981', // Emerald Green
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#14b8a6', // Teal
  '#6366f1', // Indigo
];

const getGenderColor = (name: string, index: number) => {
  const n = (name || '').toLowerCase();
  if (n.includes('male') && !n.includes('female')) return '#2563eb'; // Royal Blue
  if (n.includes('female')) return '#ec4899'; // Vibrant Pink
  if (n.includes('other') || n.includes('non-binary')) return '#f59e0b'; // Amber Gold
  return COLORS[index % COLORS.length];
};

const getEfColor = (name: string, index: number) => {
  const n = (name || '').toLowerCase();
  if (n.includes('rhd') || n.includes('rheumatic')) return '#18181b'; // Dark Black for RHD
  if (n.includes('lvh') || n.includes('hypertrophy')) return '#a855f7'; // Vibrant Purple for LVH
  if (n.includes('mild')) return '#0284c7'; // Sky Blue for Mild LVSD
  if (n.includes('moderate')) return '#f59e0b'; // Amber Orange for Moderate LVSD
  if (n.includes('severe') || n.includes('<35')) return '#ef4444'; // Crimson Red for Severe LVSD
  if (n.includes('>55') || n.includes('normal') || n.includes('preserved')) return '#10b981'; // Emerald Green
  if (n.includes('45-54')) return '#0284c7'; // Sky Blue
  if (n.includes('35-44')) return '#f59e0b'; // Amber Orange
  if (n.includes('hyperdynamic')) return '#ec4899'; // Hot Pink
  if (n.includes('rwma') || n.includes('akinesia') || n.includes('hypokinesia')) return '#f97316'; // Coral Orange
  if (n.includes('not') || n.includes('na') || n.includes('recorded')) return '#94a3b8'; // Slate Gray
  
  const FALLBACK_PALETTE = ['#2563eb', '#ec4899', '#06b6d4', '#14b8a6', '#f97316', '#6366f1', '#eab308', '#64748b'];
  return FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
};

const METRICS = {
  total_patients: {
    label: "Total Patients",
    icon: Users,
    bgClass: "bg-blue-500 text-blue-100",
    getValue: (stats: any, patients: Patient[]) => patients.length
  },
  avg_age: {
    label: "Average Age",
    icon: Heart,
    bgClass: "bg-emerald-500 text-emerald-100",
    getValue: (stats: any, patients: Patient[]) => stats.avgAge
  },
  pci_volume: {
    label: "PCI Case Volume",
    icon: Activity,
    bgClass: "bg-purple-500 text-purple-100",
    getValue: (stats: any, patients: Patient[]) => patients.filter(p => p.pciVessels && p.pciVessels.length > 0).length
  },
  devices_used: {
    label: "Devices Used Count",
    icon: Zap,
    bgClass: "bg-amber-500 text-amber-100",
    getValue: (stats: any, patients: Patient[]) => stats.totalDevicesUsedCount
  },
  common_comorbidity: {
    label: "Top Comorbidity",
    icon: AlertCircle,
    bgClass: "bg-rose-500 text-rose-100",
    getValue: (stats: any, patients: Patient[]) => stats.comorbidityData[0]?.name || 'None'
  },
  common_presentation: {
    label: "Top Presentation",
    icon: Layers,
    bgClass: "bg-orange-500 text-orange-100",
    getValue: (stats: any, patients: Patient[]) => stats.presentationData[0]?.name || 'None'
  },
  common_access: {
    label: "Top Access Method",
    icon: Target,
    bgClass: "bg-indigo-500 text-indigo-100",
    getValue: (stats: any, patients: Patient[]) => stats.accessData[0]?.name || 'None'
  },
  bifurcation_percent: {
    label: "Bifurcation %",
    icon: Activity,
    bgClass: "bg-pink-500 text-pink-100",
    getValue: (stats: any, patients: Patient[]) => {
      const yesCount = stats.bifurcationData.find((d: any) => d.name === 'Yes')?.value || 0;
      const total = patients.length;
      return total > 0 ? `${((yesCount / total) * 100).toFixed(1)}%` : '0%';
    }
  },
  radial_percent: {
    label: "Radial Access %",
    icon: Stethoscope,
    bgClass: "bg-cyan-500 text-cyan-100",
    getValue: (stats: any, patients: Patient[]) => {
      const radialCount = patients.filter(p => p.access && p.access.toLowerCase().includes('radial')).length;
      const total = patients.length;
      return total > 0 ? `${((radialCount / total) * 100).toFixed(1)}%` : '0%';
    }
  },
  common_vessel: {
    label: "Top Target Vessel",
    icon: Activity,
    bgClass: "bg-teal-500 text-teal-100",
    getValue: (stats: any, patients: Patient[]) => stats.vesselData[0]?.name || 'None'
  }
};

export default function Dashboard({ patients, onClose, lastBackupDate, pendingSyncCount = 0, onRefresh }: DashboardProps) {
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [isResolving, setIsResolving] = useState<string | null>(null);

  // Filter States
  const [datePreset, setDatePreset] = useState<'all' | '30d' | '90d' | 'ytd' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPresentation, setSelectedPresentation] = useState<string>('all');
  const [selectedVessel, setSelectedVessel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'hardware' | 'risk' | 'all'>('overview');

  // PDF Export Modal State
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfTitle, setPdfTitle] = useState("CARDIOVASCULAR CLINICAL ANALYTICS REPORT");
  const [pdfHospital, setPdfHospital] = useState("Department of Cardiology & Interventional Cath Lab");
  const [pdfPhysician, setPdfPhysician] = useState("Dr Bharat S Sambyal");
  const [pdfFormat, setPdfFormat] = useState<'table' | 'summary'>('table');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [exportToast, setExportToast] = useState<string | null>(null);

  const loadConflicts = async () => {
    try {
      const list = await getSyncConflicts();
      setConflicts(list);
    } catch (e) {
      console.error('Failed to load conflicts:', e);
    }
  };

  useEffect(() => {
    loadConflicts();
  }, [patients]);

  const handleResolveConflict = async (id: string, option: 'local' | 'cloud') => {
    setIsResolving(id);
    try {
      if (option === 'local') {
        await resolveConflictKeepLocal(id);
      } else {
        await resolveConflictKeepCloud(id);
      }
      await loadConflicts();
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error(`Failed to resolve conflict for ${id}:`, e);
    } finally {
      setIsResolving(null);
    }
  };

  const [widgets, setWidgets] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('dashboard_insights_metrics');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length === 3) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to parse stored insights metrics:', e);
    }
    return ['pci_volume', 'common_comorbidity', 'radial_percent'];
  });

  const handleWidgetChange = (index: number, newKey: string) => {
    const updated = [...widgets];
    updated[index] = newKey;
    setWidgets(updated);
    try {
      localStorage.setItem('dashboard_insights_metrics', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save insights metrics:', e);
    }
  };

  // Filter Patients
  const filteredPatients = useMemo(() => {
    return patients.filter(p => {
      // 1. Date Filter
      if (datePreset !== 'all') {
        const pDate = p.date ? new Date(p.date).getTime() : 0;
        const now = Date.now();
        if (datePreset === '30d' && pDate < now - 30 * 24 * 60 * 60 * 1000) return false;
        if (datePreset === '90d' && pDate < now - 90 * 24 * 60 * 60 * 1000) return false;
        if (datePreset === 'ytd') {
          const startOfYear = new Date(new Date().getFullYear(), 0, 1).getTime();
          if (pDate < startOfYear) return false;
        }
        if (datePreset === 'custom') {
          if (startDate && pDate < new Date(startDate).getTime()) return false;
          if (endDate && pDate > new Date(endDate).getTime() + 24 * 60 * 60 * 1000) return false;
        }
      }

      // 2. Service Category
      if (selectedCategory !== 'all' && p.serviceCategory !== selectedCategory) {
        return false;
      }

      // 3. Presentation
      if (selectedPresentation !== 'all' && p.presentation !== selectedPresentation) {
        return false;
      }

      // 4. Vessel
      if (selectedVessel !== 'all' && (!p.pciVessels || !p.pciVessels.includes(selectedVessel as PCIVessel))) {
        return false;
      }

      // 5. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name?.toLowerCase().includes(q);
        const matchesNo = p.admissionNo?.toLowerCase().includes(q) || String(p.serialNo).includes(q);
        const matchesNotes = p.finalNotes?.toLowerCase().includes(q) || p.otherHardwareNotes?.toLowerCase().includes(q);
        const matchesTags = p.tags?.some(t => t.toLowerCase().includes(q));
        const matchesComorb = p.comorbidities?.some(c => c.toLowerCase().includes(q));
        const matchesHW = p.specialHardware?.some(h => h.toLowerCase().includes(q));
        const matchesAccess = p.access?.toLowerCase().includes(q);
        const matchesPres = p.presentation?.toLowerCase().includes(q);
        const matchesVessel = p.pciVessels?.some(v => v.toLowerCase().includes(q));
        if (!matchesName && !matchesNo && !matchesNotes && !matchesTags && !matchesComorb && !matchesHW && !matchesAccess && !matchesPres && !matchesVessel) {
          return false;
        }
      }

      return true;
    });
  }, [patients, datePreset, startDate, endDate, selectedCategory, selectedPresentation, selectedVessel, searchQuery]);

  const hasActiveFilters = datePreset !== 'all' || selectedCategory !== 'all' || selectedPresentation !== 'all' || selectedVessel !== 'all' || searchQuery.trim() !== '';

  const handleResetFilters = () => {
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
    setSelectedCategory('all');
    setSelectedPresentation('all');
    setSelectedVessel('all');
    setSearchQuery('');
  };

  const handleChartClick = (type: 'vessel' | 'presentation' | 'category' | 'search', value: string) => {
    if (type === 'vessel') {
      setSelectedVessel(prev => prev === value ? 'all' : value);
    } else if (type === 'presentation') {
      setSelectedPresentation(prev => prev === value ? 'all' : value);
    } else if (type === 'category') {
      setSelectedCategory(prev => prev === value ? 'all' : value);
    } else if (type === 'search') {
      setSearchQuery(prev => prev === value ? '' : value);
    }
  };

  // Memoized Statistical Calculations
  const stats = useMemo(() => {
    const list = filteredPatients;

    // 1. Age Distribution
    const ageData = [
      { name: '0-20', count: 0 },
      { name: '21-40', count: 0 },
      { name: '41-60', count: 0 },
      { name: '61-80', count: 0 },
      { name: '80+', count: 0 },
    ];

    list.forEach(p => {
      if (p.age <= 20) ageData[0].count++;
      else if (p.age <= 40) ageData[1].count++;
      else if (p.age <= 60) ageData[2].count++;
      else if (p.age <= 80) ageData[3].count++;
      else ageData[4].count++;
    });

    // 2. Gender Distribution
    const genderCounts = list.reduce((acc, p) => {
      acc[p.gender] = (acc[p.gender] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const genderData = Object.entries(genderCounts).map(([name, value]) => ({ name, value }));

    // 3. Comorbidities
    const comorbidityCounts = list.reduce((acc, p) => {
      (p.comorbidities || []).forEach(c => {
        acc[c] = (acc[c] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);

    const comorbidityData = Object.entries(comorbidityCounts).map(([name, count]) => ({
      name,
      count
    })).sort((a, b) => b.count - a.count);

    // 4. Presentation
    const presentationCounts = list.reduce((acc, p) => {
      if (p.presentation) {
        acc[p.presentation] = (acc[p.presentation] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const presentationData = Object.entries(presentationCounts).map(([name, count]) => ({
      name,
      count
    })).sort((a, b) => b.count - a.count);

    // 5. Devices Used
    const deviceCounts = list.reduce((acc, p) => {
      if (p.devices) {
        Object.entries(p.devices).forEach(([type, qty]) => {
          acc[type] = (acc[type] || 0) + (qty as number);
        });
      }
      return acc;
    }, {} as Record<string, number>);

    const deviceData = Object.entries(deviceCounts).map(([name, count]) => ({
      name,
      count
    })).sort((a, b) => b.count - a.count);

    // 5b. BRS Scaffolds
    const brsCounts = list.reduce((acc, p) => {
      (p.brsDetails || []).forEach(spec => {
        const brand = spec.split(' ')[0] || 'BRS';
        acc[brand] = (acc[brand] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);

    const brsData = Object.entries(brsCounts).map(([name, count]) => ({
      name,
      count
    })).sort((a, b) => b.count - a.count);

    // 5c. DEB Balloons
    const debCounts = list.reduce((acc, p) => {
      (p.debDetails || []).forEach(spec => {
        const brand = spec.split(' ')[0] || 'DEB';
        acc[brand] = (acc[brand] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);

    const debData = Object.entries(debCounts).map(([name, count]) => ({
      name,
      count
    })).sort((a, b) => b.count - a.count);

    const totalBrsCount = Object.values(brsCounts).reduce((sum, c) => sum + c, 0);
    const totalDebCount = Object.values(debCounts).reduce((sum, c) => sum + c, 0);

    // 6. Special Hardware
    const shCounts = list.reduce((acc, p) => {
      (p.specialHardware || []).forEach(sh => {
        acc[sh] = (acc[sh] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);

    const shData = Object.entries(shCounts).map(([name, count]) => ({
      name,
      count
    })).sort((a, b) => b.count - a.count);

    // 7. Access Method
    const accessCounts = list.reduce((acc, p) => {
      if (p.access) {
        acc[p.access] = (acc[p.access] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const accessData = Object.entries(accessCounts).map(([name, count]) => ({
      name,
      count
    })).sort((a, b) => b.count - a.count);

    // 8. Bifurcation
    const bifurcationCounts = list.reduce((acc, p) => {
      const label = p.bifurcation ? 'Yes' : 'No';
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, { 'Yes': 0, 'No': 0 } as Record<string, number>);

    const bifurcationData = Object.entries(bifurcationCounts).map(([name, value]) => ({ name, value }));

    // 9. Ejection Fraction
    const efCounts = list.reduce((acc, p) => {
      const label = p.ejectionFraction === EjectionFraction.Other && p.otherEjectionFractionNotes ? p.otherEjectionFractionNotes : (p.ejectionFraction || 'Not Recorded');
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const efData = Object.entries(efCounts).map(([name, value]) => ({ name, value }));

    // 10. Imaging
    const imagingCounts = list.reduce((acc, p) => {
      (p.imaging || []).forEach(i => {
        acc[i] = (acc[i] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);

    const imagingData = Object.entries(imagingCounts).map(([name, count]) => ({
      name,
      count
    })).sort((a, b) => b.count - a.count);

    // 11. Target Vessels
    const vesselCounts = list.reduce((acc, p) => {
      (p.pciVessels || []).forEach(v => {
        acc[v] = (acc[v] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);

    const vesselData = Object.entries(vesselCounts).map(([name, count]) => ({
      name,
      count
    })).sort((a, b) => b.count - a.count);

    // 12. TMT
    const tmtCounts = list.reduce((acc, p) => {
      const label = p.tmt || 'NA';
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const tmtData = Object.entries(tmtCounts).map(([name, value]) => ({ name, value }));

    // 13. Complications
    const complicationCounts = list.reduce((acc, p) => {
      if (!p.complications || p.complications.length === 0) {
        acc['None'] = (acc['None'] || 0) + 1;
      } else {
        p.complications.forEach(c => {
          acc[c] = (acc[c] || 0) + 1;
        });
      }
      return acc;
    }, {} as Record<string, number>);

    const complicationData = Object.entries(complicationCounts).map(([name, count]) => ({
      name,
      count
    })).sort((a, b) => b.count - a.count);

    const totalDevicesUsedCount = Object.values(deviceCounts).reduce((sum, c) => sum + (c as number), 0);
    const avgAge = list.length > 0 ? (list.reduce((sum, p) => sum + p.age, 0) / list.length).toFixed(1) : '0';

    // 14. Composite PCI Complexity Index Calculations
    const pciCases = list.filter(p => p.pciVessels && p.pciVessels.length > 0);
    const pciTotal = pciCases.length;

    const lmCount = pciCases.filter(p => p.pciVessels?.some(v => v.toUpperCase().includes('LM'))).length;
    const bifurcationCount = pciCases.filter(p => p.bifurcation === true).length;
    const calcifiedPrepCount = pciCases.filter(p => p.specialHardware && p.specialHardware.length > 0).length;
    const multiVesselCount = pciCases.filter(p => p.pciVessels && p.pciVessels.length > 1).length;
    const imagingCount = pciCases.filter(p => p.imaging && p.imaging.length > 0).length;

    const radarComplexityData = [
      { subject: 'Left Main (LM)', value: pciTotal ? Math.round((lmCount / pciTotal) * 100) : 0, fullMark: 100, count: lmCount },
      { subject: 'Bifurcations', value: pciTotal ? Math.round((bifurcationCount / pciTotal) * 100) : 0, fullMark: 100, count: bifurcationCount },
      { subject: 'Calcified Prep', value: pciTotal ? Math.round((calcifiedPrepCount / pciTotal) * 100) : 0, fullMark: 100, count: calcifiedPrepCount },
      { subject: 'Multi-Vessel', value: pciTotal ? Math.round((multiVesselCount / pciTotal) * 100) : 0, fullMark: 100, count: multiVesselCount },
      { subject: 'Imaging/IVUS/OCT', value: pciTotal ? Math.round((imagingCount / pciTotal) * 100) : 0, fullMark: 100, count: imagingCount },
    ];

    let totalScorePoints = 0;
    pciCases.forEach(p => {
      let casePts = 0;
      if (p.pciVessels?.some(v => v.toUpperCase().includes('LM'))) casePts += 30;
      if (p.bifurcation) casePts += 20;
      if (p.specialHardware && p.specialHardware.length > 0) casePts += 25;
      if (p.pciVessels && p.pciVessels.length > 1) casePts += 25;
      totalScorePoints += Math.min(100, casePts);
    });

    const avgComplexityScore = pciTotal ? Math.round(totalScorePoints / pciTotal) : 0;
    const complexCaseCount = pciCases.filter(p => 
      (p.pciVessels?.some(v => v.toUpperCase().includes('LM'))) ||
      p.bifurcation ||
      (p.specialHardware && p.specialHardware.length > 0) ||
      (p.pciVessels && p.pciVessels.length > 1)
    ).length;
    const complexCaseRatio = pciTotal ? Math.round((complexCaseCount / pciTotal) * 100) : 0;

    // 15. Radial-First Quality Benchmark Gauge Calculations
    const accessCases = list.filter(p => p.access);
    const totalAccessCount = accessCases.length;
    const radialCount = accessCases.filter(p => p.access.toLowerCase().includes('radial')).length;
    const femoralCount = accessCases.filter(p => p.access.toLowerCase().includes('femoral')).length;
    const otherAccessCount = totalAccessCount - radialCount - femoralCount;

    const radialPercent = totalAccessCount ? Math.round((radialCount / totalAccessCount) * 100) : 0;
    const radialBenchmarkStatus = radialPercent >= 90 
      ? 'Exceeds Target (≥90%)' 
      : radialPercent >= 80 
        ? 'Near Target (80-89%)' 
        : 'Quality Gap (<80%)';

    return {
      ageData, genderData, comorbidityData, presentationData, 
      deviceData, deviceCounts, shData, efData, imagingData, 
      vesselData, totalDevicesUsedCount, avgAge, accessData, 
      bifurcationData, tmtData, complicationData,
      brsData, debData, totalBrsCount, totalDebCount,
      // Enhanced Metrics
      pciTotal, lmCount, bifurcationCount, calcifiedPrepCount, multiVesselCount, imagingCount,
      radarComplexityData, avgComplexityScore, complexCaseCount, complexCaseRatio,
      totalAccessCount, radialCount, femoralCount, otherAccessCount, radialPercent, radialBenchmarkStatus
    };
  }, [filteredPatients]);

  // Handle PDF Export Execution
  const handleExportPdf = async () => {
    setIsGeneratingPdf(true);
    setExportToast("Generating Clinical Analytics PDF... Please wait.");
    try {
      const filterSummary = hasActiveFilters 
        ? `Filtered View: ${filteredPatients.length} of ${patients.length} records`
        : `All Patients Cohort: ${patients.length} records`;

      const options: DashboardPdfExportOptions = {
        customTitle: pdfTitle,
        hospitalName: pdfHospital,
        physicianName: pdfPhysician,
        filterSummary,
        exportMode: pdfFormat,
        dashboardElementId: 'dashboard-export-container',
        stats
      };

      const { doc, filename } = await generateDashboardPDF(filteredPatients, stats, options, true);
      
      // Native Share check
      const isCapacitor = !!(window as any).Capacitor;
      if (isCapacitor && navigator.share && navigator.canShare) {
        try {
          const pdfBlob = doc.output('blob');
          const file = new File([pdfBlob], filename, { type: 'application/pdf' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: pdfTitle,
              text: `Clinical Cath Lab Analytics Report (${filteredPatients.length} records).`
            });
          }
        } catch (shareErr) {
          console.log('Share dismissed or unavailable:', shareErr);
        }
      }

      setExportToast("Analytics PDF report with colorful charts exported successfully!");
      setIsPdfModalOpen(false);
    } catch (err: any) {
      console.error('Failed to export dashboard PDF:', err);
      setExportToast('Failed to export PDF: ' + err.message);
    } finally {
      setIsGeneratingPdf(false);
      setTimeout(() => setExportToast(null), 4000);
    }
  };

  // Handle Excel Export Execution
  const handleExportExcel = () => {
    try {
      setExportToast("Exporting Analytics Spreadsheet (.xlsx)...");
      exportDashboardExcel(filteredPatients, stats);
      setExportToast("Excel spreadsheet downloaded successfully!");
    } catch (err: any) {
      console.error("Failed to export Excel:", err);
      setExportToast("Failed to export Excel: " + err.message);
    } finally {
      setTimeout(() => setExportToast(null), 4000);
    }
  };

  // Handle PNG Image Export
  const handleExportPNG = async () => {
    try {
      setExportToast("Generating High-Res Dashboard Image (.PNG)...");
      await exportDashboardPNG('dashboard-export-container');
      setExportToast("Dashboard PNG Image downloaded successfully!");
    } catch (err: any) {
      console.error("Failed to export PNG:", err);
      setExportToast("Failed to export PNG image: " + err.message);
    } finally {
      setTimeout(() => setExportToast(null), 4000);
    }
  };

  // Handle Print with Iframe Sandbox Fallback
  const handlePrint = async () => {
    setExportToast("Opening print view...");
    let directPrintTriggered = false;

    try {
      if (typeof window.print === 'function') {
        window.print();
        directPrintTriggered = true;
      }
    } catch (err) {
      console.warn("Direct window.print() restricted in iframe preview, generating print stream fallback:", err);
    }

    // If direct window.print() was blocked or failed, generate a print report PDF blob and trigger print via hidden iframe / window
    if (!directPrintTriggered) {
      try {
        setExportToast("Generating printable report document...");
        const filterSummary = hasActiveFilters 
          ? `Filtered View: ${filteredPatients.length} of ${patients.length} records`
          : `All Patients Cohort: ${patients.length} records`;

        const options: DashboardPdfExportOptions = {
          customTitle: "Clinical Analytics & Cath Lab Report",
          hospitalName: "Cath Lab Analytics",
          physicianName: "Attending Physician",
          filterSummary,
          exportMode: "table",
          dashboardElementId: "dashboard-export-container",
          stats
        };

        const { doc } = await generateDashboardPDF(filteredPatients, stats, options, false);
        const pdfBlob = doc.output('blob');
        const blobUrl = URL.createObjectURL(pdfBlob);

        const printIframe = document.createElement('iframe');
        printIframe.style.position = 'fixed';
        printIframe.style.right = '0';
        printIframe.style.bottom = '0';
        printIframe.style.width = '0';
        printIframe.style.height = '0';
        printIframe.style.border = '0';
        printIframe.src = blobUrl;
        document.body.appendChild(printIframe);

        printIframe.onload = () => {
          setTimeout(() => {
            try {
              printIframe.contentWindow?.focus();
              printIframe.contentWindow?.print();
            } catch (e) {
              window.open(blobUrl, '_blank');
            }
          }, 300);
        };

        setExportToast("Print document prepared!");
      } catch (err: any) {
        console.error("Print fallback failed:", err);
        setExportToast("Use 'Export Report' button for high-res PDF print document.");
      }
    }

    setTimeout(() => setExportToast(null), 3500);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      {/* Sticky Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:px-8 border-b border-border bg-white sticky top-0 z-20 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            Clinical Analytics & Cath Lab Dashboard
          </h2>
          <p className="text-xs text-slate-500 mt-1 uppercase font-bold tracking-wider flex items-center gap-2">
            <span>Analyzing {filteredPatients.length} of {patients.length} total records</span>
            {hasActiveFilters && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[10px] font-black uppercase">
                Filtered View
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
          {/* Export PDF Button */}
          <button
            type="button"
            onClick={() => setIsPdfModalOpen(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-bold uppercase rounded-xl shadow-md hover:shadow-indigo-500/20 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
            title="Export Dashboard PDF with Colorful Charts & Diagrams"
          >
            <FileDown className="w-4 h-4" />
            <span>Export Report</span>
          </button>

          {/* Quick Excel Export */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold uppercase"
            title="Export Analytics Data to Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden lg:inline">Excel</span>
          </button>

          {/* Quick Image Export */}
          <button
            type="button"
            onClick={handleExportPNG}
            className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold uppercase"
            title="Download High-Res Dashboard Image (.PNG)"
          >
            <ImageIcon className="w-4 h-4" />
            <span className="hidden lg:inline">PNG Image</span>
          </button>

          {/* Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold uppercase"
            title="Print Dashboard or Generate Printable Document"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden xl:inline">Print</span>
          </button>

          <button 
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            title="Close Analytics"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Scrollable Dashboard Content */}
      <div id="dashboard-export-container" className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6">
        
        {/* Toast Notification */}
        {exportToast && (
          <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-xl border border-slate-700 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
            <span className="text-xs font-bold">{exportToast}</span>
            <button onClick={() => setExportToast(null)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Filter Controls Bar */}
        <div className="bg-white p-5 rounded-3xl border border-border shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
              <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
              <span>Interactive Analytics Filters</span>
            </div>
            
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all self-start sm:self-center cursor-pointer"
              >
                Clear All Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* 1. Date Presets */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1">
                <Calendar className="w-3 h-3 text-indigo-500" /> Time Horizon
              </label>
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">All Time</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="ytd">Year to Date (YTD)</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {/* 2. Service Category */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1">
                <Users className="w-3 h-3 text-blue-500" /> Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">All Categories</option>
                <option value={ServiceCategory.Ser}>Servicemen (Ser)</option>
                <option value={ServiceCategory.Vet}>Ex-Servicemen (Vet)</option>
                <option value={ServiceCategory.Dep}>Dependents (Dep)</option>
              </select>
            </div>

            {/* 3. Clinical Presentation */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1">
                <Activity className="w-3 h-3 text-amber-500" /> Presentation
              </label>
              <select
                value={selectedPresentation}
                onChange={(e) => setSelectedPresentation(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">All Presentations</option>
                {Object.values(Presentation).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* 4. Target Vessel */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1">
                <Target className="w-3 h-3 text-rose-500" /> PCI Vessel
              </label>
              <select
                value={selectedVessel}
                onChange={(e) => setSelectedVessel(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">All Vessels</option>
                {Object.values(PCIVessel).map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            {/* 5. Keyword Search */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1">
                <Search className="w-3 h-3 text-emerald-500" /> Search Filter
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Patient name, tag, or notes..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Custom Date Inputs when Date Preset is Custom */}
          {datePreset === 'custom' && (
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
                />
              </div>
            </div>
          )}

          {/* Active Drill-Down Filter Chips Banner */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 text-xs">
              <span className="text-[10px] font-extrabold uppercase text-indigo-600 tracking-wider flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Active Chart Drill-Down Filters:
              </span>
              {selectedVessel !== 'all' && (
                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-bold flex items-center gap-1.5 shadow-xs">
                  Vessel: <span className="font-black" style={{ color: getVesselColor(selectedVessel) }}>{selectedVessel}</span>
                  <button onClick={() => setSelectedVessel('all')} className="hover:text-indigo-900 font-black cursor-pointer">×</button>
                </span>
              )}
              {selectedPresentation !== 'all' && (
                <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-bold flex items-center gap-1.5 shadow-xs">
                  Presentation: {selectedPresentation}
                  <button onClick={() => setSelectedPresentation('all')} className="hover:text-amber-900 font-black cursor-pointer">×</button>
                </span>
              )}
              {selectedCategory !== 'all' && (
                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-bold flex items-center gap-1.5 shadow-xs">
                  Category: {selectedCategory}
                  <button onClick={() => setSelectedCategory('all')} className="hover:text-blue-900 font-black cursor-pointer">×</button>
                </span>
              )}
              {searchQuery.trim() !== '' && (
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-bold flex items-center gap-1.5 shadow-xs">
                  Search Filter: "{searchQuery}"
                  <button onClick={() => setSearchQuery('')} className="hover:text-emerald-900 font-black cursor-pointer">×</button>
                </span>
              )}
              {datePreset !== 'all' && (
                <span className="px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg font-bold flex items-center gap-1.5 shadow-xs">
                  Time Horizon: {datePreset.toUpperCase()}
                  <button onClick={() => setDatePreset('all')} className="hover:text-purple-900 font-black cursor-pointer">×</button>
                </span>
              )}
              <button
                onClick={handleResetFilters}
                className="text-[10px] font-bold text-rose-600 hover:text-rose-800 underline ml-auto uppercase tracking-wider cursor-pointer"
              >
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* View Mode Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'overview', label: 'Executive Overview', icon: BarChart3 },
            { id: 'hardware', label: 'Interventional Hardware & PCI', icon: Zap },
            { id: 'risk', label: 'Risk Factors & Complications', icon: ShieldAlert },
            { id: 'all', label: 'Complete Expanded Analytics', icon: LayoutDashboard }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                  isActive 
                    ? 'bg-slate-900 text-white shadow-md' 
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-border'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Executive KPI Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-border shadow-xs hover:border-blue-200 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Cohort
              </span>
            </div>
            <p className="text-3xl font-black text-slate-900 leading-none">{filteredPatients.length}</p>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mt-1.5">Total Patients</span>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-border shadow-xs hover:border-purple-200 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-purple-50 text-purple-600 rounded-2xl">
                <Activity className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-extrabold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Procedural
              </span>
            </div>
            <p className="text-3xl font-black text-slate-900 leading-none">
              {filteredPatients.filter(p => p.pciVessels && p.pciVessels.length > 0).length}
            </p>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mt-1.5">PCI Cases Volume</span>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-border shadow-xs hover:border-emerald-200 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
                <Stethoscope className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Radial 1st
              </span>
            </div>
            <p className="text-3xl font-black text-slate-900 leading-none">
              {filteredPatients.length > 0 
                ? `${((filteredPatients.filter(p => p.access && p.access.toLowerCase().includes('radial')).length / filteredPatients.length) * 100).toFixed(1)}%`
                : '0%'
              }
            </p>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mt-1.5">Radial Access Ratio</span>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-border shadow-xs hover:border-amber-200 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl">
                <Zap className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Hardware
              </span>
            </div>
            <p className="text-3xl font-black text-slate-900 leading-none">{stats.totalDevicesUsedCount}</p>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mt-1.5">Devices Deployed</span>
          </div>
        </div>

        {/* Custom Insights Hub */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 bg-indigo-500/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider flex items-center gap-2 text-indigo-300">
                  <Sparkles className="w-4 h-4 text-indigo-400" /> Custom Clinical Insights Hub
                </h3>
                <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                  Pin any 3 primary metrics to monitor live across your filtered patient subset.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setWidgets(['pci_volume', 'common_comorbidity', 'radial_percent']);
                  try {
                    localStorage.setItem('dashboard_insights_metrics', JSON.stringify(['pci_volume', 'common_comorbidity', 'radial_percent']));
                  } catch (e) {}
                }}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-slate-100 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border border-white/10 active:scale-95 cursor-pointer self-start sm:self-center"
              >
                Reset Widgets
              </button>
            </div>

            {/* Sync Status Banner */}
            <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/20">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Local & Cloud Persistence</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-white">Firestore Active</span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-4 sm:gap-8">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-300" />
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Last Backup</span>
                    <span className="text-xs font-semibold text-slate-200">
                      {lastBackupDate && lastBackupDate > 0 ? (
                        new Date(lastBackupDate).toLocaleString('en-GB', {
                          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
                        })
                      ) : 'Never'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <RefreshCw className={`w-4 h-4 ${pendingSyncCount > 0 ? 'text-amber-400 animate-spin' : 'text-emerald-400'}`} />
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Pending Sync</span>
                    <span className="text-xs font-semibold text-slate-200">
                      {pendingSyncCount > 0 ? (
                        <span className="text-amber-400 font-bold">{pendingSyncCount} waiting</span>
                      ) : (
                        <span className="text-emerald-400 font-medium">Synced & Secure</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {widgets.map((metricKey, index) => {
                const metric = METRICS[metricKey as keyof typeof METRICS] || METRICS.total_patients;
                const Icon = metric.icon;
                const value = metric.getValue(stats, filteredPatients);

                return (
                  <div key={index} className="bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-2xl flex flex-col justify-between hover:border-indigo-400/30 transition-all group relative">
                    <div className="flex items-start justify-between mb-4 gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-2.5 rounded-xl ${metric.bgClass} shrink-0`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[9px] text-indigo-200/50 uppercase tracking-widest block font-bold">Widget {index + 1}</span>
                          <span className="text-xs font-bold text-white tracking-tight block truncate" title={metric.label}>{metric.label}</span>
                        </div>
                      </div>
                      
                      <div className="relative shrink-0">
                        <select
                          value={metricKey}
                          onChange={(e) => handleWidgetChange(index, e.target.value)}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                          title={`Change Widget ${index + 1} Metric`}
                        >
                          {Object.entries(METRICS).map(([key, config]) => (
                            <option key={key} value={key} className="text-slate-900 font-sans font-semibold text-xs">
                              {config.label}
                            </option>
                          ))}
                        </select>
                        <div className="px-2 py-1 bg-white/5 hover:bg-white/15 rounded-lg text-white/60 group-hover:text-white transition-all cursor-pointer flex items-center gap-1 border border-white/5 text-[10px] font-bold uppercase tracking-wider select-none">
                          <span>Pick</span>
                          <ChevronDown className="w-3 h-3 text-white/50" />
                        </div>
                      </div>
                    </div>

                    <div className="mt-2">
                      <span className="text-2xl sm:text-3xl font-black text-white leading-none tracking-tight block truncate">
                        {value}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sync Conflicts Section */}
        {conflicts.length > 0 && (
          <div className="bg-gradient-to-r from-slate-900 to-amber-950 text-white p-6 rounded-3xl border border-amber-500/20 shadow-lg relative overflow-hidden">
            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>Sync Conflicts Detected ({conflicts.length})</span>
              </div>

              <div className="space-y-3">
                {conflicts.map((conflict) => (
                  <div key={conflict.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-sm font-bold text-white">{conflict.local?.name || 'Unnamed Patient'}</span>
                      <span className="text-xs text-slate-400 block font-mono">ID: {conflict.id}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isResolving !== null}
                        onClick={() => handleResolveConflict(conflict.id, 'local')}
                        className="px-3 py-1.5 bg-amber-500 text-slate-950 text-xs font-bold rounded-xl hover:bg-amber-400 cursor-pointer"
                      >
                        Keep Local
                      </button>
                      <button
                        type="button"
                        disabled={isResolving !== null}
                        onClick={() => handleResolveConflict(conflict.id, 'cloud')}
                        className="px-3 py-1.5 bg-white/10 text-white text-xs font-bold rounded-xl hover:bg-white/20 cursor-pointer"
                      >
                        Keep Cloud
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Visual Charts Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* TAB: OVERVIEW or ALL */}
          {(activeTab === 'overview' || activeTab === 'all') && (
            <>
              {/* Radial-First Quality Benchmark Gauge */}
              <div className="bg-white p-6 rounded-3xl border border-border shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-emerald-600" /> Radial-First Quality Benchmark
                    </h3>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                      Target Goal: &ge;90% Transradial Access (ESC/ACC Quality Standard)
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                    stats.radialPercent >= 90 
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                      : stats.radialPercent >= 80 
                        ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                  }`}>
                    {stats.radialBenchmarkStatus}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-around gap-4 py-2">
                  {/* Gauge Arc representation using PieChart */}
                  <div className="relative w-44 h-28 flex items-center justify-center shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Radial', value: stats.radialCount },
                            { name: 'Non-Radial', value: Math.max(0, stats.totalAccessCount - stats.radialCount) }
                          ]}
                          cx="50%"
                          cy="100%"
                          startAngle={180}
                          endAngle={0}
                          innerRadius={55}
                          outerRadius={75}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          <Cell fill="#10b981" className="cursor-pointer" onClick={() => handleChartClick('search', 'Radial')} />
                          <Cell fill="#cbd5e1" className="cursor-pointer" onClick={() => handleChartClick('search', 'Femoral')} />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute bottom-0 text-center">
                      <span className="text-2xl font-black text-slate-900 leading-none">{stats.radialPercent}%</span>
                      <span className="text-[9px] font-extrabold text-slate-400 block uppercase tracking-wider">Radial Ratio</span>
                    </div>
                  </div>

                  {/* Access Method Breakdown */}
                  <div className="flex-1 space-y-2 w-full">
                    <div 
                      onClick={() => handleChartClick('search', 'Radial')}
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 hover:border-emerald-200 cursor-pointer transition-all"
                    >
                      <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Transradial (TRA)
                      </span>
                      <span className="text-xs font-black text-emerald-600">{stats.radialCount} cases ({stats.radialPercent}%)</span>
                    </div>
                    <div 
                      onClick={() => handleChartClick('search', 'Femoral')}
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-300 cursor-pointer transition-all"
                    >
                      <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Transfemoral (TFA)
                      </span>
                      <span className="text-xs font-black text-slate-700">{stats.femoralCount} cases ({stats.totalAccessCount ? Math.round((stats.femoralCount / stats.totalAccessCount)*100) : 0}%)</span>
                    </div>
                    {stats.otherAccessCount > 0 && (
                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Other / Distal Radial
                        </span>
                        <span className="text-xs font-black text-indigo-600">{stats.otherAccessCount} cases</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                  <span className="font-semibold text-slate-400">Benchmark Goal: 90% Radial Access</span>
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                    {stats.radialPercent >= 90 ? '✓ Quality Goal Met' : `${90 - stats.radialPercent}% to Goal`}
                  </span>
                </div>
              </div>

              {/* Composite PCI Complexity Index & Radar Chart */}
              <div className="bg-white p-6 rounded-3xl border border-border shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <Crosshair className="w-4 h-4 text-indigo-600" /> Composite PCI Complexity Index
                    </h3>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                      Risk Density Score across {stats.pciTotal} PCI cases
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-indigo-600">{stats.avgComplexityScore}</span>
                    <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Cohort Index / 100</span>
                  </div>
                </div>

                <div className="h-56 min-w-0">
                  <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    <RadarChart data={stats.radarComplexityData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fontWeight: 700, fill: '#475569' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8 }} />
                      <Radar name="PCI Complexity %" dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.4} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 pt-3 border-t border-slate-100">
                  <div 
                    onClick={() => handleChartClick('vessel', 'LM')}
                    className="p-2 bg-slate-50 hover:bg-red-50 border border-slate-100 hover:border-red-200 rounded-xl transition-all cursor-pointer text-center"
                  >
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Left Main</span>
                    <span className="text-xs font-black text-red-600">{stats.lmCount} cases</span>
                  </div>
                  <div 
                    onClick={() => handleChartClick('search', 'Bifurcation')}
                    className="p-2 bg-slate-50 hover:bg-rose-50 border border-slate-100 hover:border-rose-200 rounded-xl transition-all cursor-pointer text-center"
                  >
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Bifurcation</span>
                    <span className="text-xs font-black text-rose-600">{stats.bifurcationCount} cases</span>
                  </div>
                  <div 
                    onClick={() => handleChartClick('search', 'Rotablator')}
                    className="p-2 bg-slate-50 hover:bg-amber-50 border border-slate-100 hover:border-amber-200 rounded-xl transition-all cursor-pointer text-center"
                  >
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Calcified Prep</span>
                    <span className="text-xs font-black text-amber-600">{stats.calcifiedPrepCount} cases</span>
                  </div>
                  <div 
                    onClick={() => handleChartClick('search', 'Multi-Vessel')}
                    className="p-2 bg-slate-50 hover:bg-purple-50 border border-slate-100 hover:border-purple-200 rounded-xl transition-all cursor-pointer text-center"
                  >
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Multi-Vessel</span>
                    <span className="text-xs font-black text-purple-600">{stats.multiVesselCount} cases</span>
                  </div>
                </div>
              </div>

              {/* Age Distribution */}
              <div className="bg-white p-6 rounded-3xl border border-border shadow-xs">
                <h3 className="text-xs font-extrabold text-slate-800 mb-6 uppercase tracking-widest flex items-center justify-between">
                  <span>Age Cohort Distribution</span>
                  <span className="text-[10px] text-slate-400 font-normal">Mean: {stats.avgAge} Yrs</span>
                </h3>
                <div className="h-64 min-w-0">
                  <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    <BarChart data={stats.ageData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Gender Distribution */}
              <div className="bg-white p-6 rounded-3xl border border-border shadow-xs">
                <h3 className="text-xs font-extrabold text-slate-800 mb-6 uppercase tracking-widest">
                  Gender Demographics
                </h3>
                <div className="h-64 min-w-0">
                  <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    <PieChart>
                      <Pie
                        data={stats.genderData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {stats.genderData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getGenderColor(entry.name, index)} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Clinical Presentation */}
              <div className="bg-white p-6 rounded-3xl border border-border shadow-xs">
                <h3 className="text-xs font-extrabold text-slate-800 mb-2 uppercase tracking-widest">
                  Clinical Presentation at Admission
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold mb-4">Click bar to filter cohort by presentation</p>
                <div className="h-64 min-w-0">
                  <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    <BarChart data={stats.presentationData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]}>
                        {stats.presentationData.map((entry, idx) => (
                          <Cell 
                            key={`pres-${idx}`} 
                            fill={['#f59e0b', '#ef4444', '#ec4899', '#3b82f6', '#10b981'][idx % 5]} 
                            onClick={() => handleChartClick('presentation', entry.name)}
                            className="cursor-pointer hover:opacity-80 transition-opacity"
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Prevalent Comorbidities */}
              <div className="bg-white p-6 rounded-3xl border border-border shadow-xs">
                <h3 className="text-xs font-extrabold text-slate-800 mb-2 uppercase tracking-widest">
                  Prevalent Comorbidities & Risk Profile
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold mb-4">Click bar to search for comorbidity</p>
                <div className="h-64 min-w-0">
                  <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    <BarChart layout="vertical" data={stats.comorbidityData} margin={{ left: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="count" fill="#ef4444" radius={[0, 6, 6, 0]} barSize={18}>
                        {stats.comorbidityData.map((entry, idx) => (
                          <Cell 
                            key={`comorb-${idx}`} 
                            fill="#ef4444" 
                            onClick={() => handleChartClick('search', entry.name)}
                            className="cursor-pointer hover:opacity-80 transition-opacity"
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {/* TAB: HARDWARE & PCI or ALL */}
          {(activeTab === 'hardware' || activeTab === 'all') && (
            <>
              {/* Target Vessels with Arterial Anatomy Tokens */}
              <div className="bg-white p-6 rounded-3xl border border-border shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <Target className="w-4 h-4 text-indigo-600" /> PCI Target Vessels & Arterial Anatomy
                    </h3>
                    <p className="text-[10px] text-slate-400 font-semibold">Standardized Anatomical Color Tokens (Click bar to drill down)</p>
                  </div>
                  {/* Color Legend Badges */}
                  <div className="flex flex-wrap gap-1">
                    {['LAD', 'LCX', 'RCA', 'LM', 'Ramus', 'Graft'].map(v => (
                      <span key={v} className="px-2 py-0.5 rounded-md text-[9px] font-black text-white cursor-pointer shadow-2xs hover:opacity-90" style={{ backgroundColor: getVesselColor(v) }} onClick={() => handleChartClick('vessel', v)}>
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="h-64 min-w-0">
                  <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    <BarChart data={stats.vesselData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {stats.vesselData.map((entry, idx) => (
                          <Cell 
                            key={`vessel-${idx}`} 
                            fill={getVesselColor(entry.name)} 
                            onClick={() => handleChartClick('vessel', entry.name)}
                            className="cursor-pointer hover:opacity-80 transition-opacity"
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Devices Distribution */}
              <div className="bg-white p-6 rounded-3xl border border-border shadow-xs">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest">Devices & Stents</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.values(DeviceType).map(type => (
                      <div key={type} className="px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-md flex items-center gap-1">
                        <span className="text-[9px] font-bold text-slate-400">{type}:</span>
                        <span className="text-[10px] font-black text-indigo-600">{stats.deviceCounts[type] || 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="h-64 min-w-0">
                  <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    <BarChart data={stats.deviceData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* BRS Scaffolds Distribution */}
              <div className="bg-white p-6 rounded-3xl border border-border shadow-xs">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> BRS Bioresorbable Scaffolds
                  </h3>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {stats.totalBrsCount} Scaffolds
                  </span>
                </div>
                {stats.brsData.length > 0 ? (
                  <div className="h-64 min-w-0">
                    <ResponsiveContainer width="100%" height="100%" debounce={50}>
                      <BarChart data={stats.brsData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <Zap className="w-8 h-8 text-slate-300 mb-2" />
                    <p className="text-xs font-semibold text-slate-500">No BRS Scaffolds logged in filtered subset</p>
                  </div>
                )}
              </div>

              {/* DEB Balloons Distribution */}
              <div className="bg-white p-6 rounded-3xl border border-border shadow-xs">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500" /> DEB Drug-Eluting Balloons
                  </h3>
                  <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {stats.totalDebCount} Balloons
                  </span>
                </div>
                {stats.debData.length > 0 ? (
                  <div className="h-64 min-w-0">
                    <ResponsiveContainer width="100%" height="100%" debounce={50}>
                      <BarChart data={stats.debData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="count" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <Zap className="w-8 h-8 text-slate-300 mb-2" />
                    <p className="text-xs font-semibold text-slate-500">No DEB Balloons logged in filtered subset</p>
                  </div>
                )}
              </div>

              {/* Special Hardware */}
              <div className="bg-white p-6 rounded-3xl border border-border shadow-xs">
                <h3 className="text-xs font-extrabold text-slate-800 mb-6 uppercase tracking-widest">
                  Special Hardware & Complex Lesions
                </h3>
                <div className="h-64 min-w-0">
                  <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    <BarChart data={stats.shData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Access Route */}
              <div className="bg-white p-6 rounded-3xl border border-border shadow-xs">
                <h3 className="text-xs font-extrabold text-slate-800 mb-6 uppercase tracking-widest">
                  Arterial Access Method
                </h3>
                <div className="h-64 min-w-0">
                  <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    <BarChart data={stats.accessData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Imaging & Physiology */}
              <div className="bg-white p-6 rounded-3xl border border-border shadow-xs">
                <h3 className="text-xs font-extrabold text-slate-800 mb-6 uppercase tracking-widest">
                  Intracoronary Imaging & Physiology
                </h3>
                <div className="h-64 min-w-0">
                  <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    <BarChart data={stats.imagingData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="count" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Bifurcation Cases */}
              <div className="bg-white p-6 rounded-3xl border border-border shadow-xs">
                <h3 className="text-xs font-extrabold text-slate-800 mb-6 uppercase tracking-widest">
                  Bifurcation Case Ratio
                </h3>
                <div className="h-64 min-w-0">
                  <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    <PieChart>
                      <Pie
                        data={stats.bifurcationData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        <Cell fill="#f43f5e" />
                        <Cell fill="#cbd5e1" />
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {/* TAB: RISK & COMPLICATIONS or ALL */}
          {(activeTab === 'risk' || activeTab === 'all') && (
            <>
              {/* Ejection Fraction */}
              <div className="bg-white p-6 rounded-3xl border border-border shadow-xs">
                <h3 className="text-xs font-extrabold text-slate-800 mb-6 uppercase tracking-widest">
                  Ejection Fraction / LV Function
                </h3>
                <div className="h-64 min-w-0">
                  <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    <PieChart>
                      <Pie
                        data={stats.efData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {stats.efData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getEfColor(entry.name, index)} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Complications Profile */}
              <div className="bg-white p-6 rounded-3xl border border-border shadow-xs">
                <h3 className="text-xs font-extrabold text-slate-800 mb-6 uppercase tracking-widest">
                  Complications Profile
                </h3>
                <div className="h-64 min-w-0">
                  <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    <BarChart data={stats.complicationData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="count" fill="#ef4444" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* TMT Results */}
              <div className="bg-white p-6 rounded-3xl border border-border shadow-xs">
                <h3 className="text-xs font-extrabold text-slate-800 mb-6 uppercase tracking-widest">
                  Treadmill Test (TMT) Results
                </h3>
                <div className="h-64 min-w-0">
                  <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    <PieChart>
                      <Pie
                        data={stats.tmtData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {stats.tmtData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.name === '+' ? '#f43f5e' : entry.name === '-' ? '#10b981' : '#cbd5e1'} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

        </div>

        {/* Footer info */}
        <div className="pt-8 pb-4 border-t border-slate-200 text-center">
          <p className="text-[10px] text-slate-400 font-medium tracking-wide">
            &copy; {new Date().getFullYear()} Dr Bharat S Sambyal | Department of Interventional Cardiology & Cath Lab Records
          </p>
        </div>
      </div>

      {/* PDF Export Options Modal */}
      {isPdfModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                  <FileDown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider">Export Analytics Dashboard Report</h3>
                  <p className="text-[10px] text-slate-300">Generate publication-quality PDF reports with colorful vector charts & diagrams</p>
                </div>
              </div>
              <button 
                onClick={() => setIsPdfModalOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Document Title</label>
                <input
                  type="text"
                  value={pdfTitle}
                  onChange={(e) => setPdfTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hospital / Department Subtitle</label>
                <input
                  type="text"
                  value={pdfHospital}
                  onChange={(e) => setPdfHospital(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Physician Signature Name</label>
                  <input
                    type="text"
                    value={pdfPhysician}
                    onChange={(e) => setPdfPhysician(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="report-pdf-mode-select" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Report PDF Mode</label>
                  <select
                    id="report-pdf-mode-select"
                    value={pdfFormat}
                    onChange={(e) => setPdfFormat(e.target.value as 'table' | 'summary')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 cursor-pointer focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="table">Multi-Page Clinical Vector Audit (3 Pages)</option>
                    <option value="summary">Executive Summary Vector Sheet (1 Page)</option>
                  </select>
                </div>
              </div>

              {/* Other Quick Export Formats */}
              <div className="pt-2 border-t border-slate-100">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Alternative Export Options</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPdfModalOpen(false);
                      handleExportExcel();
                    }}
                    className="p-2.5 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 border border-emerald-200/80 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Download Excel (.xlsx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsPdfModalOpen(false);
                      handleExportPNG();
                    }}
                    className="p-2.5 bg-blue-50 hover:bg-blue-100/80 text-blue-800 border border-blue-200/80 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    <span>Download Image (.png)</span>
                  </button>
                </div>
              </div>

              <div className="p-3 bg-indigo-50/80 border border-indigo-100 rounded-2xl text-[11px] text-indigo-900 leading-relaxed space-y-1">
                <span className="font-bold block">Export Scope Summary:</span>
                <p>Includes statistics for <strong>{filteredPatients.length}</strong> patient records.</p>
                {hasActiveFilters && (
                  <p className="text-[10px] text-indigo-700 italic">Active filter status will be stamped into report headers.</p>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsPdfModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold uppercase rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isGeneratingPdf}
                onClick={handleExportPdf}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95"
              >
                {isGeneratingPdf ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Rendering PDF...</span>
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4" />
                    <span>Generate & Save PDF Report</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
