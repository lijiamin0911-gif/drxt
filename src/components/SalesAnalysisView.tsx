import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Search, 
  FileSpreadsheet, 
  Upload, 
  Filter, 
  ChevronDown, 
  ChevronRight, 
  BarChart2, 
  TrendingUp, 
  Calendar, 
  AlertCircle, 
  Sparkles, 
  Sliders, 
  Building, 
  Info, 
  RefreshCw, 
  X, 
  Plus,
  ArrowRight,
  TrendingDown,
  Globe,
  Settings,
  Coins,
  DollarSign
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { SalesRecord, User, Product, Supplier } from '../types';
import { DbService } from '../lib/dbService';

interface SalesAnalysisViewProps {
  currentUser: User;
}

export default function SalesAnalysisView({ currentUser }: SalesAnalysisViewProps) {
  // Core Records & DB states
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Global branch filter
  const [selectedBranch, setSelectedBranch] = useState<string>(
    currentUser.role === 'branch' ? (currentUser.branchName || '') : 'all'
  );

  useEffect(() => {
    if (currentUser.role === 'branch') {
      setSelectedBranch(currentUser.branchName || '');
    }
  }, [currentUser]);

  // Active sub-tab inside page: 'overview' vs 'yoy'
  const [currentTab, setCurrentTab] = useState<'overview' | 'yoy'>('overview');

  // Trigger toasts
  const triggerLocalToast = (text: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Fetch all core data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [recs, prods, sups] = await Promise.all([
        DbService.getSalesRecords(),
        DbService.getProducts(),
        DbService.getSuppliers()
      ]);
      setSalesRecords(recs);
      setProducts(prods);
      setSuppliers(sups);
    } catch (e) {
      console.error('Failed to load Sales data:', e);
      triggerLocalToast('加载数据失败，请重试', 'error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Subscribe to DB changes
    const unsub = DbService.onChange(() => {
      loadData();
    });
    return () => unsub();
  }, [loadData]);

  // ==========================================
  // VIEW PART 1: OVERVIEW TAB STATES & FILTERS
  // ==========================================
  const currentYearStr = new Date().getFullYear().toString();
  const [filterYear, setFilterYear] = useState<string>(currentYearStr);
  const [filterMonthStart, setFilterMonthStart] = useState<string>('01');
  const [filterMonthEnd, setFilterMonthEnd] = useState<string>('12');
  
  // Drill-down month states (clicked to expand details)
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  // Available Years extracted from data
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    // default to add current and previous year
    years.add(currentYearStr);
    years.add((parseInt(currentYearStr) - 1).toString());
    
    salesRecords.forEach(r => {
      const yr = r.month.split('-')[0];
      if (yr) years.add(yr);
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [salesRecords, currentYearStr]);

  // Short month arrays for dropdowns
  const monthsList = Array.from({ length: 12 }, (_, i) => {
    const val = i + 1;
    return val < 10 ? `0${val}` : `${val}`;
  });

  // Apply quick action filters
  const handleQuickFilter = (type: 'recent3' | 'recent6' | 'thisyear') => {
    const now = new Date();
    const curYr = now.getFullYear().toString();
    const curMo = now.getMonth() + 1; // 1-12

    if (type === 'thisyear') {
      setFilterYear(curYr);
      setFilterMonthStart('01');
      setFilterMonthEnd('12');
    } else if (type === 'recent3') {
      setFilterYear(curYr);
      let startMo = curMo - 2;
      let yr = curYr;
      if (startMo <= 0) {
        startMo += 12;
        yr = (parseInt(curYr) - 1).toString();
      }
      const startMoStr = startMo < 10 ? `0${startMo}` : `${startMo}`;
      const curMoStr = curMo < 10 ? `0${curMo}` : `${curMo}`;
      
      setFilterYear(yr === curYr ? curYr : yr); // set year of started month or compromise
      setFilterMonthStart(startMoStr);
      setFilterMonthEnd(curMoStr);
    } else if (type === 'recent6') {
      setFilterYear(curYr);
      let startMo = curMo - 5;
      let yr = curYr;
      if (startMo <= 0) {
        startMo += 12;
        yr = (parseInt(curYr) - 1).toString();
      }
      const startMoStr = startMo < 10 ? `0${startMo}` : `${startMo}`;
      const curMoStr = curMo < 10 ? `0${curMo}` : `${curMo}`;
      
      setFilterYear(yr === curYr ? curYr : yr);
      setFilterMonthStart(startMoStr);
      setFilterMonthEnd(curMoStr);
    }
  };

  // Filtered dataset for overview
  const filteredSalesForOverview = useMemo(() => {
    // If branch-user is restricted, they only see their own branch
    let dataset = salesRecords;
    if (currentUser.role === 'branch') {
      dataset = dataset.filter(r => r.branchName === currentUser.branchName);
    } else if (selectedBranch !== 'all') {
      dataset = dataset.filter(r => r.branchName === selectedBranch);
    }

    return dataset.filter(r => {
      const [yr, mo] = r.month.split('-');
      if (yr !== filterYear) return false;
      return mo >= filterMonthStart && mo <= filterMonthEnd;
    });
  }, [salesRecords, currentUser, selectedBranch, filterYear, filterMonthStart, filterMonthEnd]);

  // Aggregate monthly totals
  const monthlyAggregations = useMemo(() => {
    const map: { [monthKey: string]: { monthLabel: string; monthKey: string; totalQty: number; records: SalesRecord[] } } = {};
    
    // Initialize chosen range
    const startVal = parseInt(filterMonthStart);
    const endVal = parseInt(filterMonthEnd);
    for (let m = startVal; m <= endVal; m++) {
      const moStr = m < 10 ? `0${m}` : `${m}`;
      const key = `${filterYear}-${moStr}`;
      map[key] = {
        monthLabel: `${m}月`,
        monthKey: key,
        totalQty: 0,
        records: []
      };
    }

    filteredSalesForOverview.forEach(r => {
      if (map[r.month]) {
        map[r.month].totalQty += r.quantity;
        map[r.month].records.push(r);
      } else {
        // dynamic addition if out of range but filtered
        const [_, mo] = r.month.split('-');
        const label = `${parseInt(mo)}月`;
        map[r.month] = {
          monthLabel: label,
          monthKey: r.month,
          totalQty: r.quantity,
          records: [r]
        };
      }
    });

    return Object.values(map).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [filteredSalesForOverview, filterYear, filterMonthStart, filterMonthEnd]);

  // Totals info cards with automated price/amount linkage
  const summaryCounters = useMemo(() => {
    let totalQty = 0;
    let totalAmount = 0;
    let totalProfit = 0;

    filteredSalesForOverview.forEach(r => {
      totalQty += r.quantity;
      const matchedProd = products.find(p => p.productCode === r.productCode);
      const sellingPrice = matchedProd?.sellingPrice ?? 45; // default fallback if unset
      const costPrice = matchedProd?.costPrice ?? (sellingPrice * 0.7); // default 30% margin fallback if cost unset

      totalAmount += r.quantity * sellingPrice;
      totalProfit += r.quantity * (sellingPrice - costPrice);
    });

    const uniqueProducts = new Set(filteredSalesForOverview.map(r => r.productCode)).size;
    const activeBranches = new Set(filteredSalesForOverview.map(r => r.branchName)).size;
    return {
      totalQty,
      totalAmount,
      totalProfit,
      uniqueProducts,
      activeBranches
    };
  }, [filteredSalesForOverview, products]);


  // ==========================================
  // VIEW PART 2: IMPORT UTILITY MODAL & LOGIC
  // ==========================================
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importType, setImportType] = useState<'text' | 'file'>('text');
  const [importPreview, setImportPreview] = useState<Omit<SalesRecord, 'id' | 'importedAt'>[]>([]);
  const [importError, setImportError] = useState('');
  const [isSubmittingImport, setIsSubmittingImport] = useState(false);

  // File parse wrapper
  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        setImportError('');
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        if (data.length < 2) {
          setImportError('上传的文件中数据行不足，请检查。');
          return;
        }

        const headers = data[0].map(h => String(h).trim());
        const mappedRows: any[] = [];

        // Identify indices
        const bIdx = headers.findIndex(h => h.includes('分店名称'));
        const sIdx = headers.findIndex(h => h.includes('供应商'));
        const cIdx = headers.findIndex(h => h.includes('产品编码') || h.includes('商品编码') || h.includes('货品编码'));
        const nIdx = headers.findIndex(h => h.includes('商品名称') || h.includes('货品名称'));
        const spIdx = headers.findIndex(h => h.includes('规格型号') || h.includes('规格'));
        const qIdx = headers.findIndex(h => h.includes('销售数量') || h.includes('数量') || h.includes('成交量'));
        const mIdx = headers.findIndex(h => h.includes('销售月份') || h.includes('月份'));

        if (bIdx === -1 || sIdx === -1 || cIdx === -1 || nIdx === -1 || spIdx === -1 || qIdx === -1 || mIdx === -1) {
          setImportError('检测到模板列缺失！必填字段为：分店名称、供应商名称、产品编码、商品名称、规格型号、销售数量、销售月份。');
          return;
        }

        for (let r = 1; r < data.length; r++) {
          const row = data[r];
          if (!row || row.length === 0) continue;
          
          const branchName = String(row[bIdx] || '').trim();
          const supplierName = String(row[sIdx] || '').trim();
          const productCode = String(row[cIdx] || '').trim();
          const productName = String(row[nIdx] || '').trim();
          const specs = String(row[spIdx] || '').trim();
          const quantity = parseInt(row[qIdx]) || 0;
          let monthStr = String(row[mIdx] || '').trim();

          // Normalise year-month e.g. "2026年6月" or "2026/06" -> "2026-06"
          if (monthStr) {
            monthStr = monthStr.replace('年', '-').replace('月', '').replace('/', '-');
            const parts = monthStr.split('-');
            if (parts.length === 2) {
              const y = parts[0].trim();
              let m = parts[1].trim();
              if (m.length === 1) m = `0${m}`;
              monthStr = `${y}-${m}`;
            }
          }

          if (branchName && supplierName && productCode && productName && specs && quantity && monthStr) {
            mappedRows.push({
              branchName,
              supplierName,
              productCode,
              productName,
              specs,
              quantity,
              month: monthStr
            });
          }
        }
        
        setImportPreview(mappedRows);
        if (mappedRows.length === 0) {
          setImportError('未解析到任何有效且格式完备的销售记录！请确保必填项均有数值。');
        }
      } catch (err) {
        console.error(err);
        setImportError('文件解析出错，请确认格式。建议直接使用带有标准列标题的名录或文本表格。');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Live copy paste text parsing
  const handleParsePastedText = () => {
    setImportError('');
    if (!importText.trim()) {
      setImportPreview([]);
      return;
    }

    const lines = importText.trim().split('\n');
    if (lines.length < 2) {
      setImportError('至少需要两行数据才能包含标题和记录。');
      return;
    }

    const headers = lines[0].split(/[,\t]/).map(h => h.trim());
    const bIdx = headers.findIndex(h => h.includes('分店名称'));
    const sIdx = headers.findIndex(h => h.includes('供应商'));
    const cIdx = headers.findIndex(h => h.includes('产品编码') || h.includes('商品编码') || h.includes('货品编码'));
    const nIdx = headers.findIndex(h => h.includes('商品名称') || h.includes('货品名称'));
    const spIdx = headers.findIndex(h => h.includes('规格型号') || h.includes('规格'));
    const qIdx = headers.findIndex(h => h.includes('销售数量') || h.includes('数量') || h.includes('成交量'));
    const mIdx = headers.findIndex(h => h.includes('销售月份') || h.includes('月份'));

    if (bIdx === -1 || sIdx === -1 || cIdx === -1 || nIdx === -1 || spIdx === -1 || qIdx === -1 || mIdx === -1) {
      setImportError('未匹配到标准的数据列：请至少保证标题行中拥有 [ 分店名称、供应商名称、产品编码、商品名称、规格型号、销售数量、销售月份 ] 以供映射对齐。');
      return;
    }

    const parsed: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(/[,\t]/).map(c => c.trim());
      
      const branchName = cols[bIdx] || '';
      const supplierName = cols[sIdx] || '';
      const productCode = cols[cIdx] || '';
      const productName = cols[nIdx] || '';
      const specs = cols[spIdx] || '';
      const quantity = parseInt(cols[qIdx]) || 0;
      let monthStr = cols[mIdx] || '';

      if (monthStr) {
        monthStr = monthStr.replace('年', '-').replace('月', '').replace('/', '-');
        const parts = monthStr.split('-');
        if (parts.length === 2) {
          const y = parts[0].trim();
          let m = parts[1].trim();
          if (m.length === 1) m = `0${m}`;
          monthStr = `${y}-${m}`;
        }
      }

      if (branchName && supplierName && productCode && productName && specs && quantity && monthStr) {
        parsed.push({
          branchName,
          supplierName,
          productCode,
          productName,
          specs,
          quantity,
          month: monthStr
        });
      }
    }

    setImportPreview(parsed);
    if (parsed.length === 0) {
      setImportError('文本解析所得的完备行数为0，请确认对齐格式：用制表符或逗号分隔。');
    }
  };

  const submitImportedData = async () => {
    if (importPreview.length === 0) {
      alert('没有待导入的数据。');
      return;
    }
    
    setIsSubmittingImport(true);
    try {
      const timestamp = new Date().toLocaleString();
      const mappedToStore: SalesRecord[] = importPreview.map((item, index) => ({
        id: `sal_${Date.now()}_${index}_${Math.random().toString(36).substring(2,6)}`,
        branchName: item.branchName,
        supplierName: item.supplierName,
        productCode: item.productCode,
        productName: item.productName,
        specs: item.specs,
        quantity: item.quantity,
        month: item.month,
        importedAt: timestamp
      }));

      await DbService.saveSalesRecords(mappedToStore, {
        id: currentUser.id,
        name: currentUser.username,
        role: currentUser.role
      });

      triggerLocalToast(`🎉 成功导入 ${mappedToStore.length} 条销售流水档案！`, 'success');
      setShowImportModal(false);
      setImportPreview([]);
      setImportText('');
    } catch (e) {
      console.error(e);
      alert('导入发生意外失败，请检测控制台排查');
    } finally {
      setIsSubmittingImport(false);
    }
  };


  // ==========================================
  // VIEW PART 3: YEAR-ON-YEAR COMPARE (同比对比)
  // ==========================================
  const [yoySelectedProductCode, setYoySelectedProductCode] = useState<string>('');
  const [yoySelectedSupplier, setYoySelectedSupplier] = useState<string>('all');

  // Custom multi-select YoY states
  const [yoySelectedYears, setYoySelectedYears] = useState<string[]>([]);
  const [yoySelectedMonths, setYoySelectedMonths] = useState<string[]>([]);

  // Sync initial yoy states
  useEffect(() => {
    if (availableYears.length > 0 && yoySelectedYears.length === 0) {
      // By default select the two most recent available years
      setYoySelectedYears(availableYears.slice(0, 2));
    }
  }, [availableYears, yoySelectedYears]);

  useEffect(() => {
    if (yoySelectedMonths.length === 0) {
      // All 12 months selected by default
      setYoySelectedMonths(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']);
    }
  }, [yoySelectedMonths]);

  // Get matching product details for display
  const yoyMatchedProductObj = useMemo(() => {
    return products.find(p => p.productCode === yoySelectedProductCode);
  }, [products, yoySelectedProductCode]);

  // Autocomplete products search list
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  const searchedProductsList = useMemo(() => {
    const q = productSearchQuery.toLowerCase().trim();
    if (!q) return products.slice(0, 8);
    return products.filter(p => 
      p.productName.toLowerCase().includes(q) || 
      p.productCode.toLowerCase().includes(q)
    );
  }, [products, productSearchQuery]);

  // Automatically pre-fill the first available product with historical records
  useEffect(() => {
    if (salesRecords.length > 0 && !yoySelectedProductCode) {
      // Find a product that actually has sales records
      const codeWithRecord = salesRecords[0].productCode;
      setYoySelectedProductCode(codeWithRecord);
    }
  }, [salesRecords, yoySelectedProductCode]);

  // Extract unique branches and suppliers from sales records for filtering YoYs
  const uniqueBranchesFromRecords = useMemo(() => {
    const set = new Set(salesRecords.map(r => r.branchName));
    return Array.from(set).sort();
  }, [salesRecords]);

  const uniqueSuppliersFromRecords = useMemo(() => {
    const set = new Set(salesRecords.map(r => r.supplierName));
    return Array.from(set).sort();
  }, [salesRecords]);

  // Sort selected years ascending
  const sortedYoySelectedYearsAsc = useMemo(() => {
    return [...yoySelectedYears].sort((a, b) => parseInt(a) - parseInt(b));
  }, [yoySelectedYears]);

  // Side-by-side Monthly dataset calculation
  const yoyMonthlyCompareData = useMemo(() => {
    if (!yoySelectedProductCode || yoySelectedYears.length === 0) return [];

    // Filter original salesRecords for SELECTED product
    let subset = salesRecords.filter(r => r.productCode === yoySelectedProductCode);

    // Apply Supplier filter
    if (yoySelectedSupplier !== 'all') {
      subset = subset.filter(r => r.supplierName === yoySelectedSupplier);
    }

    // Apply Branch filter
    if (currentUser.role === 'branch') {
      subset = subset.filter(r => r.branchName === currentUser.branchName);
    } else if (selectedBranch !== 'all') {
      subset = subset.filter(r => r.branchName === selectedBranch);
    }

    // Accumulate monthly totals for each selected year
    const yearSalesMap: { [yearStr: string]: { [monthStr: string]: number } } = {};
    yoySelectedYears.forEach(yr => {
      yearSalesMap[yr] = {};
    });

    subset.forEach(r => {
      const [yr, mo] = r.month.split('-');
      if (yearSalesMap[yr]) {
        yearSalesMap[yr][mo] = (yearSalesMap[yr][mo] || 0) + r.quantity;
      }
    });

    // Make 12-month array
    let result = monthsList.map(mo => {
      const item: any = {
        monthKey: mo,
        monthName: `${parseInt(mo)}月`,
      };

      // Populate each selected year's value
      yoySelectedYears.forEach(yr => {
        item[yr] = yearSalesMap[yr][mo] || 0;
      });

      // Compute comparative statistics if at least 2 years are selected
      if (sortedYoySelectedYearsAsc.length >= 2) {
        const latestYr = sortedYoySelectedYearsAsc[sortedYoySelectedYearsAsc.length - 1];
        const prevYr = sortedYoySelectedYearsAsc[sortedYoySelectedYearsAsc.length - 2];
        const cyQty = item[latestYr] || 0;
        const lyQty = item[prevYr] || 0;
        const diff = cyQty - lyQty;
        const pct = lyQty > 0 ? parseFloat(((diff / lyQty) * 10).toFixed(1)) * 10 : (cyQty > 0 ? 100 : 0);

        item.difference = diff;
        item.percentageLabel = lyQty > 0 ? `${diff > 0 ? '+' : ''}${pct}%` : (cyQty > 0 ? '一' : '0%');
        item.rawPercent = pct;
        item.lastYearValue = lyQty;  // fallback
        item.currentYearValue = cyQty; // fallback
      } else if (sortedYoySelectedYearsAsc.length === 1) {
        const soleYr = sortedYoySelectedYearsAsc[0];
        item.difference = 0;
        item.percentageLabel = '0%';
        item.rawPercent = 0;
        item.lastYearValue = item[soleYr] || 0;
        item.currentYearValue = item[soleYr] || 0;
      } else {
        item.difference = 0;
        item.percentageLabel = '0%';
        item.rawPercent = 0;
        item.lastYearValue = 0;
        item.currentYearValue = 0;
      }

      return item;
    });

    // Filter by selected months
    if (yoySelectedMonths.length > 0) {
      result = result.filter(r => yoySelectedMonths.includes(r.monthKey));
    } else {
      return [];
    }

    return result;
  }, [
    salesRecords, 
    yoySelectedProductCode, 
    yoySelectedSupplier, 
    selectedBranch, 
    currentUser, 
    yoySelectedYears,
    sortedYoySelectedYearsAsc,
    yoySelectedMonths, 
    monthsList
  ]);

  // Aggregate totals
  const yoyCalculationsTotal = useMemo(() => {
    const totals: { [yr: string]: number } = {};
    yoySelectedYears.forEach(yr => {
      totals[yr] = 0;
    });

    yoyMonthlyCompareData.forEach(d => {
      yoySelectedYears.forEach(yr => {
        totals[yr] += d[yr] || 0;
      });
    });

    let lyTotal = 0;
    let cyTotal = 0;
    let diff = 0;
    let rate = 0;

    if (sortedYoySelectedYearsAsc.length >= 2) {
      const latestYr = sortedYoySelectedYearsAsc[sortedYoySelectedYearsAsc.length - 1];
      const prevYr = sortedYoySelectedYearsAsc[sortedYoySelectedYearsAsc.length - 2];
      cyTotal = totals[latestYr] || 0;
      lyTotal = totals[prevYr] || 0;
      diff = cyTotal - lyTotal;
      rate = lyTotal > 0 ? parseFloat(((diff / lyTotal) * 100).toFixed(1)) : 0;
    } else if (sortedYoySelectedYearsAsc.length === 1) {
      const soleYr = sortedYoySelectedYearsAsc[0];
      cyTotal = totals[soleYr] || 0;
      lyTotal = totals[soleYr] || 0;
      diff = 0;
      rate = 0;
    }

    return {
      totals,
      lyTotal,
      cyTotal,
      diff,
      rate
    };
  }, [yoyMonthlyCompareData, yoySelectedYears, sortedYoySelectedYearsAsc]);

  const latestYearStr = sortedYoySelectedYearsAsc.length > 0 ? sortedYoySelectedYearsAsc[sortedYoySelectedYearsAsc.length - 1] : '';
  const secondLatestYearStr = sortedYoySelectedYearsAsc.length > 1 ? sortedYoySelectedYearsAsc[sortedYoySelectedYearsAsc.length - 2] : '';


  return (
    <div id="sales_analysis_container" className="space-y-6 font-sans relative">
      
      {/* Toast Alert Banner */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`fixed top-6 right-6 z-[9999] p-4 rounded-xl shadow-xl border flex items-center gap-3 bg-white ${
              toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' :
              toast.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-900' :
              'border-blue-200 bg-blue-50 text-blue-900'
            }`}
          >
            <span className="text-base">{toast.type === 'success' ? '⚡' : '⚠️'}</span>
            <span className="text-xs font-semibold">{toast.text}</span>
            <button onClick={() => setToast(null)} className="ml-2 text-slate-400 hover:text-slate-600 font-bold text-xs">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Header Board */}
      <div className="bg-white rounded-2xl border border-slate-150 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </span>
            <h2 className="text-base md:text-lg font-extrabold text-slate-905 tracking-tight">
              多分店历史销售数据查看与决策分析中心
            </h2>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
            提供全分店往期销售数据的汇总归档、季节性趋势判断、同比和环比指标洞察，帮助采购精细确定下单排产数量。
          </p>
        </div>

        {/* Major Options: Tab Toggles */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200/50 self-start md:self-center">
          <button
            onClick={() => setCurrentTab('overview')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              currentTab === 'overview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>销售情况总览与明细</span>
          </button>
          <button
            onClick={() => setCurrentTab('yoy')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              currentTab === 'yoy' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-indigo-600'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5 text-indigo-600" />
            <span>产品同比对比分析</span>
          </button>
        </div>
      </div>

      {/* Global Branch Filter Row - Visible to admin/purchasing */}
      {currentUser.role !== 'branch' && (
        <div id="global_branch_filter_bar" className="bg-white rounded-2xl border border-slate-150 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="p-1 text-indigo-600 bg-indigo-50 rounded-lg">
              <Building className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold text-slate-705">当前筛选分店：</span>
            <span className="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-700 font-extrabold rounded-md border border-indigo-100">
              {selectedBranch === 'all' ? '🏫 全部分店数据' : `🏫 ${selectedBranch}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-505 font-semibold">选择分店：</span>
            <select
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              className="text-xs font-bold px-3 py-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 focus:outline-none text-slate-800 sm:w-48 shadow-2xs"
            >
              <option value="all">全部分店</option>
              {uniqueBranchesFromRecords.map(br => (
                <option key={br} value={br}>{br}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ========================================================
          SUB-TAB 1: OVERVIEW & IMPORT (主销售情况总览与明细)
          ======================================================== */}
      {currentTab === 'overview' && (
        <div className="space-y-6">
          
          {/* Top Filter and Actions Row */}
          <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              
              {/* Dynamic Filtering Panel */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500 font-bold">年份：</span>
                  <select
                    value={filterYear}
                    onChange={e => {
                      setFilterYear(e.target.value);
                      setExpandedMonth(null);
                    }}
                    className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:border-indigo-500 focus:outline-none text-slate-800"
                  >
                    {availableYears.map(yr => (
                      <option key={yr} value={yr}>{yr} 年</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-500 font-bold">月份范围：</span>
                  <select
                    value={filterMonthStart}
                    onChange={e => {
                      setFilterMonthStart(e.target.value);
                      setExpandedMonth(null);
                    }}
                    className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:border-indigo-500 focus:outline-none text-slate-800"
                  >
                    {monthsList.map(mo => (
                      <option key={mo} value={mo}>{parseInt(mo)}月</option>
                    ))}
                  </select>
                  <span className="text-slate-400 text-xs">至</span>
                  <select
                    value={filterMonthEnd}
                    onChange={e => {
                      setFilterMonthEnd(e.target.value);
                      setExpandedMonth(null);
                    }}
                    className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:border-indigo-500 focus:outline-none text-slate-800"
                  >
                    {monthsList.map(mo => (
                      <option key={mo} value={mo}>{parseInt(mo)}月</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Actions and Import Access */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleQuickFilter('recent3')}
                  className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors cursor-pointer"
                >
                  近3个月
                </button>
                <button
                  onClick={() => handleQuickFilter('recent6')}
                  className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors cursor-pointer"
                >
                  近6个月
                </button>
                <button
                  onClick={() => handleQuickFilter('thisyear')}
                  className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors cursor-pointer"
                >
                  本年全部
                </button>
                
                {/* Save sales record access limited to admin & purchasing roles */}
                {(currentUser.role === 'admin' || currentUser.role === 'purchasing') && (
                  <button
                    onClick={() => {
                      setImportError('');
                      setImportPreview([]);
                      setImportText('');
                      setShowImportModal(true);
                    }}
                    className="ml-2 px-3.5 py-1.5 text-xs bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-extrabold rounded-lg shadow-sm shadow-blue-500/10 hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer leading-none"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>采购导入数据</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick status overview bar */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t border-slate-150">
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase leading-none">累计销售数量</div>
                  <div className="text-xs sm:text-sm font-extrabold text-slate-850 mt-1 font-mono">
                    {summaryCounters.totalQty.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">件</span>
                  </div>
                </div>
              </div>

              <div className="bg-emerald-50/50 border border-emerald-150/50 rounded-xl p-3 flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase leading-none">累计销售金额</div>
                  <div className="text-xs sm:text-sm font-extrabold text-emerald-800 mt-1 font-mono">
                    ¥{summaryCounters.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="bg-rose-50/50 border border-rose-150/50 rounded-xl p-3 flex items-center gap-3">
                <div className="p-2 bg-rose-100 text-rose-700 rounded-lg shrink-0">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase leading-none">累计预估毛利</div>
                  <div className="text-xs sm:text-sm font-extrabold text-rose-800 mt-1 font-mono">
                    ¥{summaryCounters.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 flex items-center gap-3">
                <div className="p-2 bg-teal-100 text-teal-700 rounded-lg shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase leading-none">涉及产品种类</div>
                  <div className="text-xs sm:text-sm font-extrabold text-slate-850 mt-1 font-mono">
                    {summaryCounters.uniqueProducts} <span className="text-[10px] font-normal text-slate-400">款</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg shrink-0">
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase leading-none">活跃分店范围</div>
                  <div className="text-xs sm:text-sm font-extrabold text-slate-850 mt-1 font-mono">
                    {currentUser.role === 'branch' ? '仅本店' : `${summaryCounters.activeBranches} 家分店`}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Graphical aggregation and Listing Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Col: Aggregated Monthly values chart */}
            <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-sm lg:col-span-7 space-y-4">
              <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider pb-2 border-b border-slate-100">
                <BarChart2 className="w-4 h-4 text-slate-500" />
                按月汇总趋势柱状图
              </h3>
              
              {summaryCounters.totalQty === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs italic">
                  此日期范围内暂无导入的销售业绩流水数据
                </div>
              ) : (
                <div className="h-72 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={monthlyAggregations}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      onClick={(data: any) => {
                        if (data && data.activePayload && data.activePayload[0]) {
                           setExpandedMonth(data.activePayload[0].payload.monthKey);
                        }
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="monthLabel" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
                      <Tooltip 
                        contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'rgba(255,255,255,0.95)' }} 
                        formatter={(value) => [`${value} 件`, '总销量']}
                      />
                      <Bar 
                        dataKey="totalQty" 
                        fill="#3b82f6" 
                        radius={[6, 6, 0, 0]} 
                        barSize={32}
                        className="cursor-pointer"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="text-[10px] text-slate-400 italic text-center">
                提示：支持在上方柱状图中直接点击特定的柱子，查看该月详细到各分店商品规格维度的销售档案列表。
              </div>
            </div>

            {/* Right Col: Aggregate Rows */}
            <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-sm lg:col-span-5 space-y-3">
              <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider pb-2 border-b border-slate-100">
                <Calendar className="w-4 h-4 text-slate-500" />
                月份汇总列表
              </h3>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {monthlyAggregations.map(row => {
                  const isActive = expandedMonth === row.monthKey;
                  return (
                    <div
                      key={row.monthKey}
                      onClick={() => setExpandedMonth(isActive ? null : row.monthKey)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isActive 
                          ? 'border-indigo-300 bg-indigo-50/50 shadow-xs' 
                          : 'border-slate-150 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-indigo-600 animate-pulse' : 'bg-slate-300'}`} />
                        <div>
                          <div className="text-xs font-extrabold text-slate-800">{filterYear}年 {row.monthLabel}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">含有 {row.records.length} 条销售条目</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black font-mono text-slate-800">{row.totalQty.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">件</span></span>
                        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isActive ? 'rotate-90 text-indigo-500' : ''}`} />
                      </div>
                    </div>
                  );
                })}

                {monthlyAggregations.length === 0 && (
                  <div className="text-xs text-slate-400 text-center py-10 italic">无可显示月份数据</div>
                )}
              </div>
            </div>
          </div>

          {/* Drilldown Month details - Requirement 4 */}
          <AnimatePresence>
            {expandedMonth && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="bg-white rounded-2xl border border-slate-150 p-5 shadow-sm space-y-4"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-150">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 bg-blue-600 rounded-full animate-ping"></span>
                    <h3 className="text-xs font-black text-slate-850 tracking-wider">
                      【{expandedMonth.split('-')[0]}年{parseInt(expandedMonth.split('-')[1])}月】全网销售清单明细
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-md">
                      已导入共 {salesRecords.filter(r => {
                        const isMonth = r.month === expandedMonth;
                        if (currentUser.role === 'branch') {
                          return isMonth && r.branchName === currentUser.branchName;
                        }
                        if (selectedBranch !== 'all') {
                          return isMonth && r.branchName === selectedBranch;
                        }
                        return isMonth;
                      }).length} 项流水
                    </span>
                  </div>
                  <button
                    onClick={() => setExpandedMonth(null)}
                    className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="overflow-x-auto max-h-[400px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        <th className="p-3 text-center w-12">#</th>
                        <th className="p-3">分店名称</th>
                        <th className="p-3">对接供应商</th>
                        <th className="p-3 font-mono">产品编码</th>
                        <th className="p-3">商品通用名称</th>
                        <th className="p-3">规格型号描述</th>
                        <th className="p-3 text-right">已售去皮数</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-705">
                      {salesRecords.filter(r => {
                        const isMonth = r.month === expandedMonth;
                        if (currentUser.role === 'branch') {
                          return isMonth && r.branchName === currentUser.branchName;
                        }
                        if (selectedBranch !== 'all') {
                          return isMonth && r.branchName === selectedBranch;
                        }
                        return isMonth;
                      }).map((rec, index) => (
                        <tr key={rec.id} className="hover:bg-slate-50/50">
                          <td className="p-3 text-center text-slate-400 font-mono font-bold">{index + 1}</td>
                          <td className="p-3 font-bold text-slate-800">{rec.branchName}</td>
                          <td className="p-3 text-slate-500 font-medium">{rec.supplierName}</td>
                          <td className="p-3 text-slate-600 font-mono font-semibold">{rec.productCode}</td>
                          <td className="p-3 font-extrabold text-slate-900">{rec.productName}</td>
                          <td className="p-3 text-slate-500">{rec.specs}</td>
                          <td className="p-3 text-right font-black font-mono text-blue-700">{rec.quantity} <span className="text-[10px] font-normal text-slate-400">件</span></td>
                        </tr>
                      ))}

                       {salesRecords.filter(r => {
                        const isMonth = r.month === expandedMonth;
                        if (currentUser.role === 'branch') {
                          return isMonth && r.branchName === currentUser.branchName;
                        }
                        if (selectedBranch !== 'all') {
                          return isMonth && r.branchName === selectedBranch;
                        }
                        return isMonth;
                      }).length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400 italic">该月份下没有在本店匹配到任何已导入的销售详细流水</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      )}


      {/* ========================================================
          SUB-TAB 2: YEAR-ON-YEAR (同比对比分析视图) - Requirement 6
          ======================================================== */}
      {currentTab === 'yoy' && (
        <div className="space-y-6">
          
          {/* Top Selection Board */}
          <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              
              {/* Product search box */}
              <div className="md:col-span-4 space-y-1.5 relative">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="w-1.5 h-3 bg-indigo-600 rounded-full"></span>
                  请选择或搜索对比商品（按编码/名称）
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={productSearchQuery || (yoyMatchedProductObj ? `[${yoyMatchedProductObj.productCode}] ${yoyMatchedProductObj.productName}` : '')}
                    onChange={(e) => {
                      setProductSearchQuery(e.target.value);
                      setShowProductDropdown(true);
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                    placeholder="请输入商品名称或编码模糊查询..."
                    className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 text-xs font-bold text-slate-800"
                  />
                  {yoySelectedProductCode && (
                    <button 
                      onClick={() => {
                        setYoySelectedProductCode('');
                        setProductSearchQuery('');
                      }} 
                      className="absolute right-2.5 top-2.5 p-0.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Dropdown list */}
                <AnimatePresence>
                  {showProductDropdown && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="absolute left-0 right-0 top-full mt-1.5 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg z-55 p-1"
                    >
                      {searchedProductsList.map(p => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setYoySelectedProductCode(p.productCode);
                            setProductSearchQuery(`[${p.productCode}] ${p.productName}`);
                            setShowProductDropdown(false);
                          }}
                          className={`p-2 hover:bg-indigo-50 cursor-pointer rounded-lg text-xs flex items-center justify-between ${
                            yoySelectedProductCode === p.productCode ? 'bg-indigo-50/50 font-bold text-indigo-900' : 'text-slate-700'
                          }`}
                        >
                          <div className="truncate">
                            <span className="font-mono text-slate-500 mr-2">[{p.productCode}]</span>
                            <span>{p.productName}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0 font-mono">{p.specs}</span>
                        </div>
                      ))}
                      {searchedProductsList.length === 0 && (
                        <div className="p-3 text-center text-xs text-slate-400 italic">未发现匹配的产品信息</div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Supplier dropdown */}
              <div className="md:col-span-3 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="w-1.5 h-3 bg-indigo-600 rounded-full"></span>
                  按供应商筛选同比
                </label>
                <select
                  value={yoySelectedSupplier}
                  onChange={e => setYoySelectedSupplier(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-200 bg-white rounded-xl focus:border-indigo-600 focus:outline-none font-bold text-slate-800"
                >
                  <option value="all">-- 所有对接供应商 --</option>
                  {uniqueSuppliersFromRecords.map(sup => (
                    <option key={sup} value={sup}>{sup}</option>
                  ))}
                </select>
              </div>

              {/* Branch dropdown */}
              {currentUser.role !== 'branch' && (
                <div className="md:col-span-3 space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="w-1.5 h-3 bg-indigo-600 rounded-full"></span>
                    按分店筛选同比
                  </label>
                  <select
                    value={selectedBranch}
                    onChange={e => setSelectedBranch(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-200 bg-white rounded-xl focus:border-indigo-600 focus:outline-none font-bold text-slate-800"
                  >
                    <option value="all">-- 所有合作分店 --</option>
                    {uniqueBranchesFromRecords.map(br => (
                      <option key={br} value={br}>{br}</option>
                    ))}
                  </select>
                </div>
              )}

            </div>

            {/* Years Selection (Checkboxes) */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <span className="w-1.5 h-3 bg-blue-600 rounded-full"></span>
                📊 选择对比年份 (可多选，进行多年度数据并排对比)：
              </label>
              <div className="flex flex-wrap gap-2">
                {availableYears.map(yr => {
                  const isSelected = yoySelectedYears.includes(yr);
                  return (
                    <button
                      key={yr}
                      onClick={() => {
                        if (isSelected) {
                          if (yoySelectedYears.length > 1) {
                            setYoySelectedYears(yoySelectedYears.filter(y => y !== yr));
                          }
                        } else {
                          setYoySelectedYears([...yoySelectedYears, yr]);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center gap-1.5 ${
                        isSelected 
                          ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-xs' 
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // click handled on parent button
                        className="rounded text-blue-600 focus:ring-blue-500 w-3 h-3 cursor-pointer pointer-events-none"
                      />
                      <span>{yr}年</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Month comparisons panel with Multi-Select Pills */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500 font-bold">季度与快速预设：</span>
                <button
                  onClick={() => setYoySelectedMonths(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'])}
                  className={`px-3 py-1 text-xs rounded-lg font-bold border transition-all cursor-pointer ${
                    yoySelectedMonths.length === 12 ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  全部 12 个月
                </button>
                <button
                  onClick={() => setYoySelectedMonths(['01', '02', '03'])}
                  className={`px-3 py-1 text-xs rounded-lg font-bold border transition-all cursor-pointer ${
                    yoySelectedMonths.length === 3 && yoySelectedMonths.includes('01') && yoySelectedMonths.includes('03') ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  第一季度 (1-3月)
                </button>
                <button
                  onClick={() => setYoySelectedMonths(['04', '05', '06'])}
                  className={`px-3 py-1 text-xs rounded-lg font-bold border transition-all cursor-pointer ${
                    yoySelectedMonths.length === 3 && yoySelectedMonths.includes('04') && yoySelectedMonths.includes('06') ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  第二季度 (4-6月)
                </button>
                <button
                  onClick={() => setYoySelectedMonths(['07', '08', '09'])}
                  className={`px-3 py-1 text-xs rounded-lg font-bold border transition-all cursor-pointer ${
                    yoySelectedMonths.length === 3 && yoySelectedMonths.includes('07') && yoySelectedMonths.includes('09') ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  第三季度 (7-9月)
                </button>
                <button
                  onClick={() => setYoySelectedMonths(['10', '11', '12'])}
                  className={`px-3 py-1 text-xs rounded-lg font-bold border transition-all cursor-pointer ${
                    yoySelectedMonths.length === 3 && yoySelectedMonths.includes('10') && yoySelectedMonths.includes('12') ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  第四季度 (10-12月)
                </button>
                <button
                  onClick={() => {
                    const curMo = (new Date().getMonth() + 1).toString().padStart(2, '0');
                    setYoySelectedMonths([curMo]);
                  }}
                  className="px-3 py-1 text-xs rounded-lg font-bold border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  本月 ({new Date().getMonth() + 1}月)
                </button>
              </div>

              {/* Month multiselect grid */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="w-1.5 h-3 bg-indigo-600 rounded-full"></span>
                  🗓️ 选择对比月份 (可多选任意月份，点选切换勾选状态)：
                </span>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-2">
                  {monthsList.map(mo => {
                    const isSelected = yoySelectedMonths.includes(mo);
                    const label = `${parseInt(mo)}月`;
                    return (
                      <button
                        key={mo}
                        onClick={() => {
                          if (isSelected) {
                            if (yoySelectedMonths.length > 1) {
                              setYoySelectedMonths(yoySelectedMonths.filter(m => m !== mo));
                            }
                          } else {
                            setYoySelectedMonths([...yoySelectedMonths, mo].sort());
                          }
                        }}
                        className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center ${
                          isSelected 
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-350 hover:bg-slate-50'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>

          {/* Core Benchmark Display panel */}
          {yoySelectedProductCode ? (
            <div className="space-y-6">
              
              {/* Info & stats cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                
                {/* Product Detail Card */}
                <div className="bg-gradient-to-tr from-indigo-900 to-slate-900 rounded-2xl p-4 text-white shadow-md flex flex-col justify-between space-y-4 md:col-span-1">
                  <div className="space-y-2">
                    <span className="text-[10px] bg-white/25 px-2 py-0.5 rounded-md font-mono tracking-wide">
                      TARGET PRODUCT
                    </span>
                    <h4 className="text-sm font-black truncate leading-snug">
                      {yoyMatchedProductObj ? yoyMatchedProductObj.productName : '自主录入对比货目'}
                    </h4>
                    <div className="text-xs text-indigo-200 font-semibold font-mono">
                      编码：{yoySelectedProductCode}
                    </div>
                    {yoyMatchedProductObj && (
                      <div className="text-[10px] text-slate-300">
                        常规规格: {yoyMatchedProductObj.specs}
                      </div>
                    )}
                  </div>
                  
                  <div className="pt-2 border-t border-white/10 text-[10px] text-indigo-300 flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-indigo-400" />
                    辅助采购判断季节下单配比。
                  </div>
                </div>

                {/* Last year total card */}
                <div className="bg-white rounded-2xl border border-slate-150 p-4 flex items-center gap-4">
                  <div className="p-3 bg-slate-100 text-slate-700 rounded-2xl">
                    <Calendar className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 font-bold uppercase leading-none">
                      {secondLatestYearStr ? `${secondLatestYearStr}年 同期累计` : '对比上期累计'}
                    </div>
                    <div className="text-lg font-black text-slate-800 font-mono mt-1.5 font-bold">
                      {yoyCalculationsTotal.lyTotal.toLocaleString()} <span className="text-xs font-normal text-slate-400">件</span>
                    </div>
                  </div>
                </div>

                {/* This year total card */}
                <div className="bg-white rounded-2xl border border-slate-150 p-4 flex items-center gap-4">
                  <div className="p-3 bg-blue-100 text-blue-700 rounded-2xl">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 font-bold uppercase leading-none">
                      {latestYearStr ? `${latestYearStr}年 选期累计` : '当前选期累计'}
                    </div>
                    <div className="text-lg font-black text-slate-800 font-mono mt-1.5 font-bold">
                      {yoyCalculationsTotal.cyTotal.toLocaleString()} <span className="text-xs font-normal text-slate-400">件</span>
                    </div>
                  </div>
                </div>

                {/* Growth indicator card */}
                <div className="bg-white rounded-2xl border border-slate-150 p-4 flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${
                    yoyCalculationsTotal.diff >= 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                  }`}>
                    {yoyCalculationsTotal.diff >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 font-bold uppercase leading-none">
                      {latestYearStr && secondLatestYearStr ? `${latestYearStr}年 vs ${secondLatestYearStr}年 增幅` : '同期差值与变动比率'}
                    </div>
                    <div className={`text-base font-black font-mono mt-1 ${
                      yoyCalculationsTotal.diff >= 0 ? 'text-rose-600' : 'text-emerald-600'
                    }`}>
                      {yoyCalculationsTotal.diff >= 0 ? `+${yoyCalculationsTotal.diff}` : yoyCalculationsTotal.diff} 件 
                      <span className="text-xs ml-1 font-semibold">({yoyCalculationsTotal.diff >= 0 ? '+' : ''}{yoyCalculationsTotal.rate}%)</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Side-by-side Chart and detailed table list */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Recharts chart block */}
                <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-sm lg:col-span-8 space-y-4">
                  <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider pb-2 border-b border-slate-100">
                    <BarChart2 className="w-4 h-4 text-slate-500" />
                    多年度选定月份销售走势并排对比 (柱状图)
                  </h4>
                  
                  {sortedYoySelectedYearsAsc.length === 0 || (yoyCalculationsTotal.lyTotal === 0 && yoyCalculationsTotal.cyTotal === 0) ? (
                    <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs italic">
                      选定条件下没有该产品在所选年份或月份的历史销量流水。
                    </div>
                  ) : (
                    <div className="h-72 w-full pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={yoyMonthlyCompareData}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="monthName" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
                          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
                          <Tooltip 
                            contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'rgba(255,255,255,0.95)' }}
                          />
                          <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                          {sortedYoySelectedYearsAsc.map((yr, idx) => {
                            // Beautiful colors for different years to distinguish them
                            const colors = ["#cbd5e1", "#94a3b8", "#6366f1", "#f59e0b", "#10b981", "#ec4899", "#ef4444"];
                            const fill = colors[idx % colors.length];
                            return (
                              <Bar 
                                key={yr}
                                dataKey={yr} 
                                name={`${yr}年 同期`} 
                                fill={fill} 
                                radius={[4, 4, 0, 0]} 
                                barSize={sortedYoySelectedYearsAsc.length > 3 ? 10 : 16}
                              />
                            );
                          })}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* YoY Table overview */}
                <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-sm lg:col-span-4 space-y-4">
                  <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider pb-2 border-b border-slate-100">
                    <Sliders className="w-4 h-4 text-slate-500" />
                    同比变化明细表
                  </h4>

                  <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                    {yoyMonthlyCompareData.map(d => {
                      const isUp = d.difference >= 0;
                      const hasCompare = sortedYoySelectedYearsAsc.length >= 2;
                      
                      return (
                        <div key={d.monthKey} className="p-3 bg-slate-50 rounded-xl border border-slate-155 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-slate-800">{d.monthName}</span>
                            {hasCompare && (
                              <span className={`text-xs font-black font-mono ${isUp ? 'text-rose-600' : 'text-emerald-600'}`}>
                                {isUp ? `+${d.difference}` : d.difference} 件 ({d.percentageLabel})
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono flex flex-wrap gap-1.5">
                            {sortedYoySelectedYearsAsc.map(yr => (
                              <span key={yr} className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                                {yr}年: <span className="font-extrabold text-slate-800">{d[yr] || 0}</span>件
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-150 p-12 text-center text-slate-400 text-xs italic shadow-sm">
              请在网页上方通过“商品名”或“编码”模糊索引选定您需要进行同比数值参照的产品，以渲染对应的对比分析面板。
            </div>
          )}

        </div>
      )}


      {/* ========================================================
          IMPORT MODAL COMPONENT (采购专用数据多渠道无缝导入控制台)
          ======================================================== */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[999] p-4 text-left">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-3xl rounded-3xl border border-slate-200 shadow-2xl flex flex-col max-h-[85vh]"
          >
            {/* Modal Heading */}
            <div className="p-6 border-b border-slate-150 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Upload className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-slate-900">分店销售历史业绩档案导入中心</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">支持批量导入、多次录入、以及历史月份数据零秒对齐</p>
                </div>
              </div>
              <button 
                onClick={() => setShowImportModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content - scrollable */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              
              {/* Choice of Import channels */}
              <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-250/50 w-fit">
                <button
                  type="button"
                  onClick={() => {
                    setImportType('text');
                    setImportPreview([]);
                    setImportError('');
                  }}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    importType === 'text' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-450 hover:text-slate-800'
                  }`}
                >
                  Excel数据行列直接粘贴 (TSV)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportType('file');
                    setImportPreview([]);
                    setImportError('');
                  }}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    importType === 'file' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-450 hover:text-slate-800'
                  }`}
                >
                  XLSX / CSV 文件上传方式
                </button>
              </div>

              {/* Requirement 1 Fields notice banner */}
              <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 flex gap-3 text-amber-900">
                <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <div className="font-extrabold text-amber-950">
                    重要规则提点：导入模板列属性匹配规则
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    导入时，表头首行必须包含以下 7 个必填名称（顺序任意）：
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {['分店名称', '供应商名称', '产品编码', '商品名称', '规格型号', '销售数量', '销售月份'].map(f => (
                      <span key={f} className="bg-amber-100 text-amber-950 px-2 py-0.5 rounded-md font-extrabold text-[10px] border border-amber-200/50">
                        {f}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-amber-700 pt-1 leading-relaxed">
                    其中：销售月份必须类似 `2026-05` 或 包含`2026年5月`；销售数量必须为非零正数。
                  </p>
                </div>
              </div>

              {/* Channels inputs */}
              {importType === 'text' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">请在大框粘贴您的 Excel 行列数据 (含表头行)：</span>
                    <button
                      type="button"
                      onClick={() => {
                        setImportText(
                          "分店名称\t供应商名称\t产品编码\t商品名称\t规格型号\t销售数量\t销售月份\n" +
                          "分店A\t九牧卫浴制造厂\tPROD-A01\t九牧不锈钢暗装高档水龙头\tSS-901-HM\t150\t2026-05\n" +
                          "分店B\t飞利浦合肥照明厂\tPROD-B05\t飞利浦智能LED吸顶顶灯 50W\tPL-M50W-LED\t80\t2026-05\n" +
                          "分店A\t九牧卫浴制造厂\tPROD-A01\t九牧不锈钢暗装高档水龙头\tSS-901-HM\t210\t2025-06\n" +
                          "分店B\t九牧卫浴制造厂\tPROD-A01\t九牧不锈钢暗装高档水龙头\tSS-901-HM\t130\t2025-06"
                        );
                        setTimeout(() => handleParsePastedText(), 200);
                      }}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                    >
                      加载标准演示模板数据
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                    onBlur={handleParsePastedText}
                    placeholder="在 Excel / 飞书表格中复制几行，然后在此处按 Ctrl+V 粘贴..."
                    className="w-full text-xs font-mono p-3 border border-slate-200 rounded-xl focus:border-indigo-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleParsePastedText}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    🚀 校验解析纯文本数据
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">
                    请选择您本机保存的销售报表 (.xlsx, .xls, .csv) 文件：
                  </label>
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:bg-slate-50/50 transition-colors flex flex-col items-center justify-center gap-2 relative">
                    <FileSpreadsheet className="w-10 h-10 text-slate-400" />
                    <span className="text-xs text-slate-500 font-semibold">拖拽文件到这里或点击上传文件</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleImportFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* Error readout */}
              {importError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Import previews table */}
              {importPreview.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span>🕵️ 数据预览（共解析出</span>
                    <span className="font-extrabold text-blue-700 font-mono text-sm">{importPreview.length}</span>
                    <span>条完备行信息）：</span>
                  </h4>

                  <div className="border border-slate-150 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-slate-50 sticky top-0 text-[10px] font-bold text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="p-2">分店</th>
                          <th className="p-2">供应商</th>
                          <th className="p-2">编码</th>
                          <th className="p-2">商品名称</th>
                          <th className="p-2">销售数</th>
                          <th className="p-2">月份</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {importPreview.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2 font-bold font-sans text-slate-800">{item.branchName}</td>
                            <td className="p-2 font-sans text-slate-500">{item.supplierName}</td>
                            <td className="p-2 text-slate-500">{item.productCode}</td>
                            <td className="p-2 font-bold font-sans text-slate-900">{item.productName}</td>
                            <td className="p-2 font-bold text-teal-700">{item.quantity}</td>
                            <td className="p-2 text-slate-500">{item.month}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-slate-150 bg-slate-50 rounded-b-3xl flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-white text-slate-600 rounded-xl text-xs cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={submitImportedData}
                disabled={importPreview.length === 0 || isSubmittingImport}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmittingImport ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>归档存入中...</span>
                  </>
                ) : (
                  <>
                    <span>确立完成导入归档</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>

          </motion.div>
        </div>
      )}

    </div>
  );
}
