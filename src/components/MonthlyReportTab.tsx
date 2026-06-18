/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, Grid, ChevronDown, Check, Columns, Calendar,
  TrendingDown, ArrowDownWideNarrow, ListFilter, Download, Upload
} from 'lucide-react';
import { Transaction, InventoryItem, SummaryDimension } from '../types';

interface MonthlyReportTabProps {
  transactions: Transaction[];         // all transactions from parent
  inventory: InventoryItem[];          // all inventory items
  storesInCurrentRegion: string[];     // list of stores that current user has authority to view
  regionStoreMap: Record<string, string[]>;
  onUpdateTransactionsList: (transactions: Transaction[], msg: string) => void;
  onShowToast: (text: string, type: 'success' | 'error' | 'info') => void;
}

export function MonthlyReportTab({
  transactions,
  inventory,
  storesInCurrentRegion,
  regionStoreMap,
  onUpdateTransactionsList,
  onShowToast
}: MonthlyReportTabProps) {
  // 1. Local Filters for Monthly Report
  const [activeRegion, setActiveRegion] = useState<string>('all');
  const [selectedStores, setSelectedStores] = useState<string[]>(['all']);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [summaryDimension, setSummaryDimension] = useState<SummaryDimension>('product_name');

  // Filter for retail sales inside this component to preserve calculation logic
  const retailTransactions = useMemo(() => {
    return transactions.filter(t => t.sale_type === 'store_to_customer');
  }, [transactions]);

  // 1.1 Compute categories and available months
  const categories = useMemo(() => {
    return Array.from(new Set(retailTransactions.map(t => t.category))).filter(Boolean).sort();
  }, [retailTransactions]);

  const availableMonths = useMemo(() => {
    return Array.from(new Set(retailTransactions.map(t => t.date.slice(0, 7))))
      .filter(Boolean)
      .sort();
  }, [retailTransactions]);

  // Months chosen in checkboxes
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  // Sync selected months on mount/load
  React.useEffect(() => {
    if (availableMonths.length > 0 && selectedMonths.length === 0) {
      setSelectedMonths(availableMonths);
    }
  }, [availableMonths]);

  // Compute stores list based on selected local region filter
  const storesForDropdown = useMemo(() => {
    if (activeRegion === 'all') {
      return storesInCurrentRegion;
    }
    const regionStores = regionStoreMap[activeRegion] || [];
    return regionStores.filter(s => storesInCurrentRegion.includes(s));
  }, [activeRegion, storesInCurrentRegion, regionStoreMap]);

  // 2. Perform Filtering
  const filteredData = useMemo(() => {
    return retailTransactions.filter(t => {
      // Region match
      if (activeRegion !== 'all') {
        const tRegion = Object.keys(regionStoreMap).find(reg => regionStoreMap[reg].includes(t.store));
        if (tRegion !== activeRegion) return false;
      }
      // Store match
      if (!selectedStores.includes('all') && selectedStores.length > 0) {
        if (!selectedStores.includes(t.store)) return false;
      }
      // Region manager lock checks
      if (!storesInCurrentRegion.includes(t.store)) return false;
      // Category match
      if (selectedCategory !== 'all' && t.category !== selectedCategory) return false;

      return true;
    });
  }, [retailTransactions, activeRegion, selectedStores, selectedCategory, regionStoreMap, storesInCurrentRegion]);

  // Filter inventory matching the filtered stores
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      if (!storesInCurrentRegion.includes(item.store)) return false;
      if (activeRegion !== 'all') {
        const iRegion = Object.keys(regionStoreMap).find(reg => regionStoreMap[reg].includes(item.store));
        if (iRegion !== activeRegion) return false;
      }
      if (!selectedStores.includes('all') && selectedStores.length > 0) {
        if (!selectedStores.includes(item.store)) return false;
      }
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      return true;
    });
  }, [inventory, activeRegion, selectedStores, selectedCategory, regionStoreMap, storesInCurrentRegion]);

  // 3. Perform Grouping based on Summary Dimension
  const crossTableGrid = useMemo(() => {
    const groupMap: Record<string, { 
      label: string; 
      months: Record<string, { sales: number; profit: number }>;
      stockAmount: number;
    }> = {};

    // A. Initialize row grouping matching active transactions
    filteredData.forEach(t => {
      const label = summaryDimension === 'product_name' ? t.name :
                    summaryDimension === 'category' ? t.category : t.spec;
      
      const month = t.date.slice(0, 7);

      if (!groupMap[label]) {
        groupMap[label] = {
          label,
          months: {},
          stockAmount: 0
        };
      }

      if (!groupMap[label].months[month]) {
        groupMap[label].months[month] = { sales: 0, profit: 0 };
      }

      groupMap[label].months[month].sales += t.amount;
      groupMap[label].months[month].profit += t.profit;
    });

    // B. Calculate related stock amount for each grouped row
    filteredInventory.forEach(item => {
      const label = summaryDimension === 'product_name' ? item.name :
                    summaryDimension === 'category' ? item.category : item.spec;

      if (!groupMap[label]) {
        // Even if there are no sales transactions for this item in filtered list,
        // we display it with stock if it exists in stock listing (optional),
        // let's follow the standard practice: only items that have transaction records are displayed,
        // or initialize them. We can map existing grouping.
        return;
      }

      groupMap[label].stockAmount += item.stock * item.price;
    });

    return Object.values(groupMap).sort((a, b) => a.label.localeCompare(b.label, 'zh'));
  }, [filteredData, filteredInventory, summaryDimension]);

  // 4. Calculate Column Subtotals & Grand Totals
  const totals = useMemo(() => {
    let grandStockAmount = 0;
    const monthTotals: Record<string, { sales: number; profit: number }> = {};
    
    selectedMonths.forEach(m => {
      monthTotals[m] = { sales: 0, profit: 0 };
    });

    crossTableGrid.forEach(row => {
      grandStockAmount += row.stockAmount;
      selectedMonths.forEach(m => {
        const val = row.months[m] || { sales: 0, profit: 0 };
        monthTotals[m].sales += val.sales;
        monthTotals[m].profit += val.profit;
      });
    });

    let overallSales = 0;
    let overallProfit = 0;
    Object.values(monthTotals).forEach(v => {
      overallSales += v.sales;
      overallProfit += v.profit;
    });

    return {
      grandStockAmount,
      monthTotals,
      overallSales,
      overallProfit
    };
  }, [crossTableGrid, selectedMonths]);

  // Mutate stores selection safely
  const handleStoreCheckbox = (store: string) => {
    if (store === 'all') {
      setSelectedStores(['all']);
      return;
    }
    const clean = selectedStores.filter(s => s !== 'all');
    if (clean.includes(store)) {
      const next = clean.filter(s => s !== store);
      setSelectedStores(next.length === 0 ? ['all'] : next);
    } else {
      setSelectedStores([...clean, store]);
    }
  };

  const toggleAllMonths = (selectAll: boolean) => {
    setSelectedMonths(selectAll ? availableMonths : []);
  };

  const handleMonthToggle = (month: string) => {
    if (selectedMonths.includes(month)) {
      setSelectedMonths(selectedMonths.filter(m => m !== month));
    } else {
      setSelectedMonths([...selectedMonths, month]);
    }
  };

  // 5. Export CURRENT Table result to Excel
  const handleExportExcel = () => {
    const dimHeaderLabel = summaryDimension === 'product_name' ? '产品名称' :
                           summaryDimension === 'category' ? '品类类别' : '规格型号';

    // Build workbook headers
    const headers = [dimHeaderLabel, '库存金额'];
    selectedMonths.forEach(m => {
      headers.push(`${m} 销售额`);
      headers.push(`${m} 毛利`);
    });
    headers.push('总计 销售额');
    headers.push('总计 毛利');

    const sheetRows = [headers];

    // Data rows
    crossTableGrid.forEach(row => {
      const exRow: any[] = [row.label, row.stockAmount];
      let rowSales = 0;
      let rowProfit = 0;

      selectedMonths.forEach(m => {
        const mVal = row.months[m] || { sales: 0, profit: 0 };
        exRow.push(mVal.sales);
        exRow.push(mVal.profit);
        rowSales += mVal.sales;
        rowProfit += mVal.profit;
      });

      exRow.push(rowSales);
      exRow.push(rowProfit);
      sheetRows.push(exRow);
    });

    // Sum total row
    const sumRow: any[] = ['合计', totals.grandStockAmount];
    selectedMonths.forEach(m => {
      sumRow.push(totals.monthTotals[m]?.sales || 0);
      sumRow.push(totals.monthTotals[m]?.profit || 0);
    });
    sumRow.push(totals.overallSales);
    sumRow.push(totals.overallProfit);
    sheetRows.push(sumRow);

    const ws = XLSX.utils.aoa_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '分店零售月报');
    XLSX.writeFile(wb, '分店月报数据.xlsx');

    onShowToast('✅ 分店月报 Excel 导出成功！', 'success');
  };

  // Download Retail Transaction template
  const handleDownloadTemplate = () => {
    const headers = ['日期', '分店', '商品类别', '商品编码', '产品名称', '规格型号', '销量', '单价', '销售金额', '利润'];
    const samples = [
      ['2026-06-01', '武汉店', '灯具', 'L001', '智能吸顶灯', '圆形/40W', 45, 84, 3780, 1134],
      ['2026-06-02', '黄石店', '电子产品', 'E001', '无线蓝牙耳机', 'Pro版', 20, 200, 4000, 1200],
      ['2026-06-02', '武汉店', '家居用品', 'H001', '慢回弹记忆枕', '标准型', 35, 110, 3850, 1155],
    ];
    const wsData = [headers, ...samples];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, '零售导入模板');
    XLSX.writeFile(wb, '分店零售导入模版.xlsx');
    onShowToast('⬇️ 分店零售导入模版下载完毕！', 'success');
  };

  // Upload/Submit Retail Transaction Excel
  const handleUploadRetail = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileReader = new FileReader();
    fileReader.onload = (event) => {
      try {
        const u8Data = new Uint8Array(event.target?.result as ArrayBuffer);
        const wb = XLSX.read(u8Data, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<any>(sheet);

        if (jsonData.length === 0) {
          onShowToast('上传的 Excel 解析出的行数为空！', 'error');
          return;
        }

        // Column mapping
        const first = jsonData[0];
        const cols = Object.keys(first);

        const dateCol = cols.find(c => c.includes('日期') || c.toLowerCase().includes('date'));
        const storeCol = cols.find(c => c.includes('分店') || c.toLowerCase().includes('store'));
        const catCol = cols.find(c => c.includes('类别') || c.includes('品类') || c.toLowerCase().includes('cat'));
        const codeCol = cols.find(c => c.includes('编码') || c.toLowerCase().includes('code'));
        const nameCol = cols.find(c => c.includes('产品名称') || c.includes('商品名称') || c.includes('名称') || c.toLowerCase().includes('name'));
        const specCol = cols.find(c => c.includes('规格') || c.includes('型号') || c.toLowerCase().includes('spec'));
        const qtyCol = cols.find(c => c.includes('销量') || c.toLowerCase().includes('qty') || c.toLowerCase().includes('quantity') || c.toLowerCase().includes('stock'));
        const priceCol = cols.find(c => c.includes('单价') || c.includes('价格') || c.toLowerCase().includes('price'));
        const amountCol = cols.find(c => c.includes('金额') || c.toLowerCase().includes('amount') || c.toLowerCase().includes('total'));
        const profitCol = cols.find(c => c.includes('利润') || c.toLowerCase().includes('profit'));

        if (!dateCol || !storeCol || !nameCol || !qtyCol || !priceCol) {
          onShowToast('格式检测失败：模板至少需要包含 “日期、分店、产品名称、销量、单价” 列。', 'error');
          return;
        }

        let updateCount = 0;
        let insertCount = 0;
        // Copy existing transactions from global list
        const newTransactions = [...transactions];

        jsonData.forEach(row => {
          const dateVal = String(row[dateCol] || '').trim() || '2026-06-17';
          const storeVal = String(row[storeCol] || '').trim();
          const catVal = String(catCol ? row[catCol] : '').trim() || '未分类';
          const codeVal = String(codeCol ? row[codeCol] : '').trim() || 'X999';
          const nameVal = String(row[nameCol] || '').trim();
          const specVal = String(specCol ? row[specCol] : '').trim() || '通用型';
          const qtyVal = parseFloat(row[qtyCol]) || 0;
          const priceVal = parseFloat(row[priceCol]) || 0;
          const amtVal = parseFloat(amountCol ? row[amountCol] : '') || (qtyVal * priceVal);
          const profitVal = parseFloat(profitCol ? row[profitCol] : '') || Math.round(amtVal * 0.3 * 100) / 100;

          if (!storeVal || !nameVal) return; // Skip empty rows

          // Find if there's an existing retail transaction to overwrite
          const matchIdx = newTransactions.findIndex(t => 
            t.sale_type === 'store_to_customer' && 
            t.date === dateVal && 
            t.store === storeVal && 
            t.name === nameVal && 
            t.spec === specVal
          );

          if (matchIdx >= 0) {
            newTransactions[matchIdx] = {
              ...newTransactions[matchIdx],
              category: catVal,
              code: codeVal,
              qty: qtyVal,
              price: priceVal,
              amount: amtVal,
              profit: profitVal
            };
            updateCount++;
          } else {
            newTransactions.push({
              date: dateVal,
              store: storeVal,
              category: catVal,
              code: codeVal,
              name: nameVal,
              spec: specVal,
              qty: qtyVal,
              price: priceVal,
              amount: amtVal,
              profit: profitVal,
              sale_type: 'store_to_customer',
              supplier: ''
            });
            insertCount++;
          }
        });

        // Trigger updates
        onUpdateTransactionsList(
          newTransactions, 
          `✅ 分店零售数据导入成功：更新 ${updateCount} 条并新增 ${insertCount} 条！`
        );
      } catch (err: any) {
        onShowToast('解析零售数据 Excel 失败: ' + err.message, 'error');
      }
    };
    fileReader.readAsArrayBuffer(file);
    e.target.value = ''; // Reset input selection
  };

  const formatCurrency = (val: number) => {
    return '¥' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-6">
      {/* Filters Bar card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-50 pb-2 mb-2">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
            <ListFilter className="w-4.5 h-4.5 text-[#1a5c9e]" />
            零售多维月报筛选
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 text-[#1a5c9e] hover:bg-[#1a5c9e]/5 border border-[#1a5c9e]/20 hover:border-[#1a5c9e]/40 font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> 下载零售模版
            </button>
            <label className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/60 hover:border-emerald-300 text-emerald-800 font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-emerald-600" /> 上传零售数据
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleUploadRetail}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Region Select */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              管辖区域
            </label>
            <select
              value={activeRegion}
              onChange={(e) => {
                setActiveRegion(e.target.value);
                setSelectedStores(['all']);
              }}
              className="w-full px-3 py-2 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:border-[#1a5c9e] transition-colors"
            >
              <option value="all">全部区域</option>
              {Object.keys(regionStoreMap).map(reg => (
                <option key={reg} value={reg}>{reg}</option>
              ))}
            </select>
          </div>

          {/* Store select boxes */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              分店/商铺 选择
            </label>
            <div className="border border-slate-200 rounded-lg p-2 max-h-24 overflow-y-auto space-y-1 bg-white">
              <label className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedStores.includes('all')}
                  onChange={() => handleStoreCheckbox('all')}
                  className="rounded text-[#1a5c9e] focus:ring-0"
                />
                全部店铺
              </label>
              {storesForDropdown.map(st => (
                <label key={st} className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedStores.includes(st) && !selectedStores.includes('all')}
                    onChange={() => handleStoreCheckbox(st)}
                    className="rounded text-[#1a5c9e] focus:ring-0"
                  />
                  {st}
                </label>
              ))}
            </div>
          </div>

          {/* Category Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              类别品类
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:border-[#1a5c9e] transition-colors"
            >
              <option value="all">全部类别</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* SUMMARY DIMENSION - NEW ADDITION */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              报表汇总维度 <span className="text-rose-500 text-xs font-bold font-mono">*</span>
            </label>
            <select
              value={summaryDimension}
              onChange={(e) => setSummaryDimension(e.target.value as SummaryDimension)}
              className="w-full px-3 py-2 text-xs text-semibold text-white bg-[#1a5c9e] border border-[#1a5c9e] rounded-lg outline-none focus:border-[#113e6d] transition-colors cursor-pointer"
            >
              <option value="product_name">产品名称 (默认)</option>
              <option value="category">类别 / 品类</option>
              <option value="spec_model">规格型号</option>
            </select>
          </div>
        </div>

        {/* Month Selector section */}
        <div className="pt-2 border-t border-slate-100 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400" />
              选择月份列（可滚动勾选: {selectedMonths.length}/{availableMonths.length}已选）
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => toggleAllMonths(true)}
                className="px-2 py-1 text-[10px] font-bold text-[#1a5c9e] hover:bg-[#1a5c9e]/5 rounded border border-[#1a5c9e]/10 cursor-pointer transition-all"
              >
                全选
              </button>
              <button
                onClick={() => toggleAllMonths(false)}
                className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-100 rounded border border-slate-200 cursor-pointer transition-all"
              >
                清空
              </button>
            </div>
          </div>
          <div className="border border-slate-200 rounded-xl p-3 max-h-36 overflow-y-auto space-y-1.5 bg-slate-50/20">
            {availableMonths.length === 0 ? (
              <span className="text-xs text-slate-400 block p-1.5">暂无可用月份数据，可点击右上角导入零售数据</span>
            ) : (
              availableMonths.map(m => (
                <label 
                  key={m} 
                  className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg border transition-all cursor-pointer text-xs select-none ${
                    selectedMonths.includes(m)
                      ? 'bg-sky-50/80 border-sky-300 text-sky-850 font-semibold'
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <input 
                    type="checkbox"
                    checked={selectedMonths.includes(m)}
                    onChange={() => handleMonthToggle(m)}
                    className="rounded text-[#1a5c9e] border-slate-300 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="font-mono">{m} 零售数据列</span>
                </label>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Cross Grid Table Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        {/* Table Title Action */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-4 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Grid className="w-5 h-5 text-[#1a5c9e]" />
            <span className="font-bold text-slate-800 text-sm">
              零售经营交叉月报 
              <span className="text-xs text-slate-400 font-normal ml-2">
                (当前按- <strong>{summaryDimension === 'product_name' ? '产品名称' : summaryDimension === 'category' ? '销售类别' : '规格型号'}</strong> 汇总分拆)
              </span>
            </span>
          </div>

          <button 
            onClick={handleExportExcel}
            className="px-4 py-2 bg-[#1a5c9e] hover:bg-[#154678] text-white text-xs font-bold rounded-lg shadow-sm hover:shadow-[#1a5c9e]/10 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" /> 导出当页 Excel
          </button>
        </div>

        {/* Responsive Table Wrapper */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <th className="p-4 border-r border-slate-200 min-w-[160px] text-zinc-700">
                  {summaryDimension === 'product_name' ? '产品名称' :
                   summaryDimension === 'category' ? '产品品类' : '规格型号'}
                </th>
                <th className="p-4 border-r border-[#1a5c9e]/20 text-center min-w-[124px] bg-[#1a5c9e]/5 text-[#1a5c9e] font-bold">
                  存量库存总额
                </th>
                {selectedMonths.map(m => (
                  <th key={m} className="p-4 border-r border-slate-200 text-center min-w-[140px]">
                    <div className="text-slate-800 font-bold">{m}</div>
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1 uppercase font-normal px-1">
                      <span>销售额</span>
                      <span>毛利</span>
                    </div>
                  </th>
                ))}
                <th className="p-4 text-center min-w-[150px] bg-sky-50 text-sky-900 font-bold">
                  <div>全部总计</div>
                  <div className="flex justify-between text-[10px] text-sky-700/65 mt-1 font-normal px-2">
                    <span>销售额</span>
                    <span>毛利</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150">
              {crossTableGrid.length === 0 ? (
                <tr>
                  <td colSpan={selectedMonths.length + 3} className="p-12 text-center text-slate-400">
                    <TrendingDown className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    没有符合当前的筛选销售记录
                  </td>
                </tr>
              ) : (
                crossTableGrid.map((row) => {
                  let rowSalesTotal = 0;
                  let rowProfitTotal = 0;

                  return (
                    <tr key={row.label} className="hover:bg-slate-50/70 transition-colors">
                      {/* Row title */}
                      <td className="p-4 font-semibold text-slate-800 border-r border-slate-200 bg-slate-50/40">
                        {row.label || '—'}
                      </td>
                      {/* Stock amount */}
                      <td className="p-4 border-r border-slate-200 text-right font-mono font-bold text-slate-700 bg-slate-50/20">
                        {formatCurrency(row.stockAmount)}
                      </td>
                      {/* Monthly metrics cells */}
                      {selectedMonths.map(m => {
                        const cell = row.months[m] || { sales: 0, profit: 0 };
                        rowSalesTotal += cell.sales;
                        rowProfitTotal += cell.profit;

                        return (
                          <td key={m} className="p-4 border-r border-slate-200 text-right font-mono">
                            <div className="flex justify-between gap-1 w-full text-xs">
                              <span className="text-[#1a5c9e] font-semibold">{cell.sales > 0 ? formatCurrency(cell.sales) : '¥0.00'}</span>
                              <span className={cell.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                {cell.profit !== 0 ? formatCurrency(cell.profit) : '¥0.00'}
                              </span>
                            </div>
                          </td>
                        );
                      })}
                      {/* Row totals */}
                      <td className="p-4 text-right font-mono bg-sky-50/50 font-bold">
                        <div className="flex justify-between gap-1 w-full text-xs text-sky-950">
                          <span>{formatCurrency(rowSalesTotal)}</span>
                          <span className={rowProfitTotal >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                            {formatCurrency(rowProfitTotal)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}

              {/* Grand summary row */}
              {crossTableGrid.length > 0 && (
                <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-200">
                  <td className="p-4 border-r border-slate-200">
                    月份小计合计
                  </td>
                  <td className="p-4 text-right border-r border-slate-200 font-mono text-[#1a5c9e] text-sm">
                    {formatCurrency(totals.grandStockAmount)}
                  </td>
                  {selectedMonths.map(m => {
                    const monthSum = totals.monthTotals[m] || { sales: 0, profit: 0 };
                    return (
                      <td key={m} className="p-4 border-r border-slate-200 text-right font-mono text-sm">
                        <div className="flex justify-between w-full">
                          <span className="text-[#1a5c9e]">{formatCurrency(monthSum.sales)}</span>
                          <span className={monthSum.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                            {formatCurrency(monthSum.profit)}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                  <td className="p-4 text-right font-mono bg-sky-100 text-sm text-sky-950 font-extrabold">
                    <div className="flex justify-between w-full">
                      <span>{formatCurrency(totals.overallSales)}</span>
                      <span className={totals.overallProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                        {formatCurrency(totals.overallProfit)}
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Counter bottom */}
        <div className="p-4 border-t border-slate-100 text-xs text-slate-400 bg-slate-50 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>报表呈现归类总数: <strong className="text-slate-600">{crossTableGrid.length} 条记录</strong></span>
          <span className="font-semibold text-slate-500 font-mono">
            合计零售销售总额: <strong className="text-[#1a5c9e]">{formatCurrency(totals.overallSales)}</strong> (总毛利润: <strong className="text-emerald-600">{formatCurrency(totals.overallProfit)}</strong>)
          </span>
        </div>
      </div>
    </div>
  );
}
