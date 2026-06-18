/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, Grid, ChevronDown, Check, Columns, Calendar,
  TrendingDown, ListFilter, Warehouse, Download, Upload
} from 'lucide-react';
import { Transaction, InventoryItem, SummaryDimension } from '../types';

interface WholesaleTabProps {
  transactions: Transaction[];         // all transactions from parent
  inventory: InventoryItem[];          // all inventory items
  storesInCurrentRegion: string[];     // list of stores with permission
  regionStoreMap: Record<string, string[]>;
  onUpdateTransactionsList: (transactions: Transaction[], msg: string) => void;
  onShowToast: (text: string, type: 'success' | 'error' | 'info') => void;
}

export function WholesaleTab({
  transactions,
  inventory,
  storesInCurrentRegion,
  regionStoreMap,
  onUpdateTransactionsList,
  onShowToast
}: WholesaleTabProps) {
  // 1. Filter States
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>(['all']);
  const [selectedStores, setSelectedStores] = useState<string[]>(['all']);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [summaryDimension, setSummaryDimension] = useState<SummaryDimension>('product_name');

  // Filter for wholesale entries to preserve existing logic
  const wholesaleTransactions = useMemo(() => {
    return transactions.filter(t => t.sale_type === 'head_to_store');
  }, [transactions]);

  // Compute unique dynamic list of suppliers
  const suppliers = useMemo(() => {
    return Array.from(new Set(wholesaleTransactions.map(t => t.supplier).filter(Boolean))).sort();
  }, [wholesaleTransactions]);

  // Compute list of categories
  const categories = useMemo(() => {
    return Array.from(new Set(wholesaleTransactions.map(t => t.category).filter(Boolean))).sort();
  }, [wholesaleTransactions]);

  // Available months list
  const availableMonths = useMemo(() => {
    return Array.from(new Set(wholesaleTransactions.map(t => t.date.slice(0, 7))))
      .filter(Boolean)
      .sort();
  }, [wholesaleTransactions]);

  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  React.useEffect(() => {
    if (availableMonths.length > 0 && selectedMonths.length === 0) {
      setSelectedMonths(availableMonths);
    }
  }, [availableMonths]);

  // Apply general wholesale transaction filtering
  const filteredData = useMemo(() => {
    return wholesaleTransactions.filter(t => {
      // Stores filter check
      if (!selectedStores.includes('all') && selectedStores.length > 0) {
        if (!selectedStores.includes(t.store)) return false;
      }
      if (!storesInCurrentRegion.includes(t.store)) return false;

      // Supplier filter check
      if (!selectedSuppliers.includes('all') && selectedSuppliers.length > 0) {
        if (!selectedSuppliers.includes(t.supplier)) return false;
      }

      // Category filter match
      if (selectedCategory !== 'all' && t.category !== selectedCategory) return false;

      return true;
    });
  }, [wholesaleTransactions, selectedStores, selectedSuppliers, selectedCategory, storesInCurrentRegion]);

  // Match stocks for active stores in filters
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      if (!storesInCurrentRegion.includes(item.store)) return false;
      if (!selectedStores.includes('all') && selectedStores.length > 0) {
        if (!selectedStores.includes(item.store)) return false;
      }
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      return true;
    });
  }, [inventory, selectedStores, selectedCategory, storesInCurrentRegion]);

  // 2. Perform Grouping matching selected SummaryDimension
  const crossTableGrid = useMemo(() => {
    const groupMap: Record<string, { 
      label: string; 
      months: Record<string, { sales: number; profit: number }>;
      stockAmount: number;
    }> = {};

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

    // Accumulate Inventory amount
    filteredInventory.forEach(item => {
      const label = summaryDimension === 'product_name' ? item.name :
                    summaryDimension === 'category' ? item.category : item.spec;
      if (groupMap[label]) {
        groupMap[label].stockAmount += item.stock * item.price;
      }
    });

    return Object.values(groupMap).sort((a, b) => a.label.localeCompare(b.label, 'zh'));
  }, [filteredData, filteredInventory, summaryDimension]);

  // 3. Subtotals or Total calculations
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

  // Mutate dynamic wholesale suppliers selection
  const handleSupplierCheckbox = (sup: string) => {
    if (sup === 'all') {
      setSelectedSuppliers(['all']);
      return;
    }
    const clean = selectedSuppliers.filter(s => s !== 'all');
    if (clean.includes(sup)) {
      const next = clean.filter(s => s !== sup);
      setSelectedSuppliers(next.length === 0 ? ['all'] : next);
    } else {
      setSelectedSuppliers([...clean, sup]);
    }
  };

  const handleMonthToggle = (month: string) => {
    if (selectedMonths.includes(month)) {
      setSelectedMonths(selectedMonths.filter(m => m !== month));
    } else {
      setSelectedMonths([...selectedMonths, month]);
    }
  };

  // 4. Export Table to Excel XML Workbook
  const handleExportExcel = () => {
    const dimHeaderLabel = summaryDimension === 'product_name' ? '产品名称' :
                           summaryDimension === 'category' ? '品类类别' : '规格型号';

    const headers = [dimHeaderLabel, '库存金额'];
    selectedMonths.forEach(m => {
      headers.push(`${m} 销售额`);
      headers.push(`${m} 毛利`);
    });
    headers.push('总计 销售额');
    headers.push('总计 毛利');

    const sheetRows = [headers];

    // Data rows input
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

    // Sum overall totals rows
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
    XLSX.utils.book_append_sheet(wb, ws, '总部批发月报');
    XLSX.writeFile(wb, '总部批发数据.xlsx');

    onShowToast('✅ 总部批发 Excel 导出成功！', 'success');
  };

  // Download Wholesale Transaction template
  const handleDownloadTemplate = () => {
    const headers = ['日期', '收货分店', '产品品类', '商品编码', '产品名称', '规格型号', '进货数量', '进货单价', '进货金额', '预估利润', '供应商'];
    const samples = [
      ['2026-06-01', '武汉店', '灯具', 'L001', '智能吸顶灯', '圆形/40W', 200, 50, 10000, 3400, '雷士照明'],
      ['2026-06-02', '北京店', '电子产品', 'E001', '无线蓝牙耳机', 'Pro版', 100, 120, 12000, 4000, '索尼数码'],
      ['2026-06-03', '上海店', '家居用品', 'H001', '慢回弹记忆枕', '标准型', 150, 60, 9000, 2700, '罗莱家纺'],
    ];
    const wsData = [headers, ...samples];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, '批发导入模板');
    XLSX.writeFile(wb, '总部批发导入模版.xlsx');
    onShowToast('⬇️ 总部批发导入模版下载完毕！', 'success');
  };

  // Upload/Submit Wholesale Transaction Excel
  const handleUploadWholesale = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        const storeCol = cols.find(c => c.includes('店') || c.toLowerCase().includes('store'));
        const catCol = cols.find(c => c.includes('分类') || c.includes('品类') || c.includes('类别') || c.toLowerCase().includes('cat'));
        const codeCol = cols.find(c => c.includes('编码') || c.toLowerCase().includes('code'));
        const nameCol = cols.find(c => c.includes('产品') || c.includes('品名') || c.includes('产品名称') || c.toLowerCase().includes('name'));
        const specCol = cols.find(c => c.includes('规格') || c.includes('型号') || c.toLowerCase().includes('spec'));
        const qtyCol = cols.find(c => c.includes('数量') || c.toLowerCase().includes('qty') || c.toLowerCase().includes('qty') || c.toLowerCase().includes('stock'));
        const priceCol = cols.find(c => c.includes('单价') || c.includes('价格') || c.toLowerCase().includes('price'));
        const amountCol = cols.find(c => c.includes('进货金额') || c.includes('金额') || c.toLowerCase().includes('amount') || c.toLowerCase().includes('total'));
        const profitCol = cols.find(c => c.includes('利润') || c.toLowerCase().includes('profit'));
        const supplierCol = cols.find(c => c.includes('供应商') || c.toLowerCase().includes('supplier'));

        if (!dateCol || !storeCol || !nameCol || !qtyCol || !priceCol) {
          onShowToast('格式检测失败：模板至少需要包含 “日期、收货分店、产品名称、进货数量、进货单价” 列。', 'error');
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
          const codeVal = String(codeCol ? row[codeCol] : '').trim() || 'W999';
          const nameVal = String(row[nameCol] || '').trim();
          const specVal = String(specCol ? row[specCol] : '').trim() || '通用型';
          const qtyVal = parseFloat(row[qtyCol]) || 0;
          const priceVal = parseFloat(row[priceCol]) || 0;
          const amtVal = parseFloat(amountCol ? row[amountCol] : '') || (qtyVal * priceVal);
          const profitVal = parseFloat(profitCol ? row[profitCol] : '') || Math.round(amtVal * 0.25 * 100) / 100;
          const supplierVal = String(supplierCol ? row[supplierCol] : '').trim() || '未知供应商';

          if (!storeVal || !nameVal) return; // Skip empty rows

          // Find if there's an existing wholesale transaction to overwrite
          const matchIdx = newTransactions.findIndex(t => 
            t.sale_type === 'head_to_store' && 
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
              profit: profitVal,
              supplier: supplierVal
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
              sale_type: 'head_to_store',
              supplier: supplierVal
            });
            insertCount++;
          }
        });

        // Trigger updates
        onUpdateTransactionsList(
          newTransactions, 
          `✅ 总部批发数据导入成功：更新 ${updateCount} 条并新增 ${insertCount} 条！`
        );
      } catch (err: any) {
        onShowToast('解析批发数据 Excel 失败: ' + err.message, 'error');
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
      {/* Filters Bar Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-50 pb-2 mb-2">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
            <Warehouse className="w-4.5 h-4.5 text-[#1a5c9e]" />
            总部批发多维月报筛选
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 text-[#1a5c9e] hover:bg-[#1a5c9e]/5 border border-[#1a5c9e]/20 hover:border-[#1a5c9e]/40 font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> 下载批发模版
            </button>
            <label className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/60 hover:border-emerald-300 text-emerald-800 font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-emerald-600" /> 上传批发数据
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleUploadWholesale}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Supplier multi select */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              总部供应商
            </label>
            <div className="border border-slate-200 rounded-lg p-2 max-h-24 overflow-y-auto space-y-1 bg-white">
              <label className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedSuppliers.includes('all')}
                  onChange={() => handleSupplierCheckbox('all')}
                  className="rounded text-[#1a5c9e] focus:ring-0"
                />
                全部供应商
              </label>
              {suppliers.map(sup => (
                <label key={sup} className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedSuppliers.includes(sup) && !selectedSuppliers.includes('all')}
                    onChange={() => handleSupplierCheckbox(sup)}
                    className="rounded text-[#1a5c9e] focus:ring-0"
                  />
                  {sup}
                </label>
              ))}
            </div>
          </div>

          {/* Store select choices */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              进货商铺 / 分店
            </label>
            <div className="border border-slate-200 rounded-lg p-2 max-h-24 overflow-y-auto space-y-1 bg-white">
              <label className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedStores.includes('all')}
                  onChange={() => handleStoreCheckbox('all')}
                  className="rounded text-[#1a5c9e] focus:ring-0"
                />
                全部进货店
              </label>
              {storesInCurrentRegion.map(st => (
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

          {/* Category drop select */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              类别品类
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:border-[#1a5c9e] transition-colors"
            >
              <option value="all">全部产品类</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Dynamic Summary Dimension - NEW ADDITION */}
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

        {/* Month checklists selection */}
        <div className="pt-2 border-t border-slate-100 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400" />
              选择月份列（可滚动勾选: {selectedMonths.length}/{availableMonths.length}已选）
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedMonths(availableMonths)}
                className="px-2 py-1 text-[10px] font-bold text-[#1a5c9e] hover:bg-[#1a5c9e]/5 rounded border border-[#1a5c9e]/10 cursor-pointer transition-all"
              >
                全选
              </button>
              <button
                onClick={() => setSelectedMonths([])}
                className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-100 rounded border border-slate-200 cursor-pointer transition-all"
              >
                清空
              </button>
            </div>
          </div>
          <div className="border border-slate-200 rounded-xl p-3 max-h-36 overflow-y-auto space-y-1.5 bg-slate-50/20">
            {availableMonths.length === 0 ? (
              <span className="text-xs text-slate-400 block p-1.5">暂无可用月份数据，可点击右上角导入批发数据</span>
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
                  <span className="font-mono">{m} 批发数据列</span>
                </label>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Grid cross table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        {/* Table Title Action header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-4 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Grid className="w-5 h-5 text-[#1a5c9e]" />
            <span className="font-bold text-slate-800 text-sm">
              总部批发销售月报表格 
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

        {/* Scrollable table grids */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <th className="p-4 border-r border-slate-200 min-w-[170px] text-zinc-700">
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
                    没有符合当前的批发记录
                  </td>
                </tr>
              ) : (
                crossTableGrid.map((row) => {
                  let rowSalesTotal = 0;
                  let rowProfitTotal = 0;

                  return (
                    <tr key={row.label} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-4 font-semibold text-slate-800 border-r border-slate-200 bg-slate-50/40">
                        {row.label || '—'}
                      </td>
                      <td className="p-4 border-r border-slate-200 text-right font-mono font-bold text-slate-700 bg-slate-50/20">
                        {formatCurrency(row.stockAmount)}
                      </td>
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
                      <td className="p-4 text-right font-mono bg-sky-50/50 font-bold">
                        <div className="flex justify-between w-full text-xs text-sky-950">
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

              {/* Grand summary sum */}
              {crossTableGrid.length > 0 && (
                <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-200">
                  <td className="p-4 border-r border-slate-200">
                    月份各列合计
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

        {/* Counts indicators footer */}
        <div className="p-4 border-t border-slate-100 text-xs text-slate-400 bg-slate-50 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>列表批发呈现归类数: <strong className="text-slate-600">{crossTableGrid.length} 条记录</strong></span>
          <span className="font-semibold text-slate-500 font-mono">
            批发总销售：<strong className="text-[#1a5c9e]">{formatCurrency(totals.overallSales)}</strong> (批发毛利润: <strong className="text-emerald-600">{formatCurrency(totals.overallProfit)}</strong>)
          </span>
        </div>
      </div>
    </div>
  );
}
