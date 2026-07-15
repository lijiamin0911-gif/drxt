/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, List, Search, Download, Upload, Boxes, ListFilter,
  Check, Play
} from 'lucide-react';
import { InventoryItem, InventorySummaryDimension } from '../types';

interface InventoryTabProps {
  inventory: InventoryItem[];                                                // all raw active inventory items
  storesInCurrentRegion: string[];                                            // stores allowed for current user
  onUpdateInventoryList: (newList: InventoryItem[], changeMsg: string) => void; // updates state back in App
  onShowToast: (text: string, type: 'success' | 'error' | 'info') => void;
}

export function InventoryTab({
  inventory,
  storesInCurrentRegion,
  onUpdateInventoryList,
  onShowToast
}: InventoryTabProps) {
  // 1. Dynamic Filters
  const [summaryDimension, setSummaryDimension] = useState<InventorySummaryDimension>('product_details');
  const [selectedStores, setSelectedStores] = useState<string[]>(['all']);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // Local query states (triggered by clicking "Query" button, so that filter reflects on applied trigger)
  const [appliedStores, setAppliedStores] = useState<string[]>(['all']);
  const [appliedCategory, setAppliedCategory] = useState<string>('all');
  const [appliedKeyword, setAppliedKeyword] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Categories list
  const categories = useMemo(() => {
    return Array.from(new Set(inventory.map(item => item.category).filter(Boolean))).sort();
  }, [inventory]);

  // Compute overall headquarter-warehouse vs retail-branch statistics
  const hqAndBranchesTotals = useMemo(() => {
    let hqStock = 0;
    let hqAmount = 0;
    let branchStock = 0;
    let branchAmount = 0;

    inventory.forEach(item => {
      // Permission restriction check
      if (!storesInCurrentRegion.includes(item.store)) return;

      const isHQ = item.store === '总部总仓' || item.store === '总仓';
      const itemValue = item.stock * item.price;
      if (isHQ) {
        hqStock += item.stock;
        hqAmount += itemValue;
      } else {
        branchStock += item.stock;
        branchAmount += itemValue;
      }
    });

    return {
      hqStock,
      hqAmount,
      branchStock,
      branchAmount,
      totalStock: hqStock + branchStock,
      totalAmount: hqAmount + branchAmount
    };
  }, [inventory, storesInCurrentRegion]);

  // Compute allowed inventory based on Manager locks and applied filters
  const processedInventory = useMemo(() => {
    return inventory.filter(item => {
      // Permission restrict
      if (!storesInCurrentRegion.includes(item.store)) return false;

      // Applied Store filter
      if (!appliedStores.includes('all') && appliedStores.length > 0) {
        if (!appliedStores.includes(item.store)) return false;
      }

      // Applied Category filter
      if (appliedCategory !== 'all' && item.category !== appliedCategory) return false;

      // Applied Product name keyword
      if (appliedKeyword.trim()) {
        if (!item.name.toLowerCase().includes(appliedKeyword.toLowerCase())) return false;
      }

      return true;
    });
  }, [inventory, appliedStores, appliedCategory, appliedKeyword, storesInCurrentRegion]);

  // 2. Perform Grouping Aggregations based on selected dimension
  const gridRows = useMemo(() => {
    if (summaryDimension === 'product_details') {
      // Show fine granularity
      return processedInventory.map(item => ({
        key: `${item.store}-${item.productCode || ''}-${item.name}-${item.spec}`,
        productCode: item.productCode || '—',
        name: item.name,
        store: item.store,
        category: item.category,
        spec: item.spec,
        stock: item.stock,
        stockAmount: item.stock * item.price
      })).sort((a, b) => a.store.localeCompare(b.store, 'zh') || a.name.localeCompare(b.name, 'zh'));
    }

    if (summaryDimension === 'by_store') {
      // Group by Store
      const storeMap: Record<string, { store: string; stock: number; stockAmount: number }> = {};
      processedInventory.forEach(item => {
        if (!storeMap[item.store]) {
          storeMap[item.store] = { store: item.store, stock: 0, stockAmount: 0 };
        }
        storeMap[item.store].stock += item.stock;
        storeMap[item.store].stockAmount += item.stock * item.price;
      });
      return Object.values(storeMap).sort((a, b) => a.store.localeCompare(b.store, 'zh'));
    }

    // summaryDimension === 'by_category'
    // Group by Category
    const catMap: Record<string, { category: string; stock: number; stockAmount: number }> = {};
    processedInventory.forEach(item => {
      const cat = item.category || '未分类';
      if (!catMap[cat]) {
        catMap[cat] = { category: cat, stock: 0, stockAmount: 0 };
      }
      catMap[cat].stock += item.stock;
      catMap[cat].stockAmount += item.stock * item.price;
    });
    return Object.values(catMap).sort((a, b) => a.category.localeCompare(b.category, 'zh'));
  }, [processedInventory, summaryDimension]);

  // Total Summary row statistics
  const totals = useMemo(() => {
    let totalStock = 0;
    let totalAmount = 0;
    gridRows.forEach((r: any) => {
      totalStock += r.stock;
      totalAmount += r.stockAmount;
    });
    return {
      totalStock,
      totalAmount
    };
  }, [gridRows]);

  const handleQuery = () => {
    setAppliedStores(selectedStores);
    setAppliedCategory(selectedCategory);
    setAppliedKeyword(searchKeyword);
    onShowToast('🔍 库存数据筛选已应用！', 'info');
  };

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

  // 3. Independent Stock upload template generate and XLSX file downloader
  const handleDownloadTemplate = () => {
    const headers = ['分店', '产品编码', '产品名称', '规格型号', '类别', '库存数量', '单价'];
    const samples = [
      ['总部总仓', 'L001', '智能吸顶灯', '圆形/40W', '灯具', 150, 84],
      ['黄石店', 'L001', '智能吸顶灯', '圆形/40W', '灯具', 110, 84],
      ['武汉店', 'L001', '智能吸顶灯', '圆形/40W', '灯具', 150, 84],
      ['北京店', 'E001', '无线蓝牙耳机', 'Pro版', '电子产品', 250, 200],
      ['广州店', 'H001', '慢回弹记忆枕', '标准型', '家居用品', 140, 110]
    ];
    const wsData = [headers, ...samples];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, '库存模板');
    XLSX.writeFile(wb, '库存导入模版.xlsx');
    onShowToast('⬇️ 库存导入模版下载完毕！', 'success');
  };

  // 4. Batch Upload parser matcher
  const handleUploadStock = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        const storeCol = cols.find(c => c.includes('分店') || c.toLowerCase().includes('store'));
        const codeCol = cols.find(c => c.includes('产品编码') || c.includes('商品编码') || c.includes('编码') || c.toLowerCase().includes('code'));
        const nameCol = cols.find(c => c.includes('产品名称') || c.includes('名称') || c.toLowerCase().includes('name'));
        const specCol = cols.find(c => c.includes('规格') || c.includes('型号') || c.toLowerCase().includes('spec'));
        const catCol = cols.find(c => c.includes('类别') || c.toLowerCase().includes('cat'));
        const qtyCol = cols.find(c => c.includes('数量') || c.includes('库存') || c.toLowerCase().includes('qty') || c.toLowerCase().includes('stock'));
        const priceCol = cols.find(c => c.includes('单价') || c.includes('价格') || c.toLowerCase().includes('price'));

        if (!storeCol || !nameCol || !qtyCol || !priceCol) {
          onShowToast('缺少必要属性列！模板必须包含：“分店、产品名称、库存数量、单价”。', 'error');
          return;
        }

        let updateCount = 0;
        let insertCount = 0;
        const newInventory = [...inventory]; // Copy current base state

        jsonData.forEach(row => {
          const storeVal = String(row[storeCol] || '').trim();
          const codeVal = String(codeCol ? row[codeCol] : '').trim();
          const nameVal = String(row[nameCol] || '').trim();
          const specVal = String(specCol ? row[specCol] : '').trim() || '—';
          const catVal = String(catCol ? row[catCol] : '').trim() || '未分类';
          const qtyVal = parseFloat(row[qtyCol]) || 0;
          const priceVal = parseFloat(row[priceCol]) || 0;

          if (!storeVal || !nameVal) return; // Skip empty rows

          // MATCH logic: Use code + store if code is present. Otherwise fallback to store + name + spec + category
          const existIdx = newInventory.findIndex(item => {
            if (codeVal && item.productCode) {
              return item.store === storeVal && item.productCode === codeVal;
            }
            return (
              item.store === storeVal &&
              item.name === nameVal &&
              item.spec === specVal &&
              item.category === catVal
            );
          });

          if (existIdx !== -1) {
            newInventory[existIdx] = {
              ...newInventory[existIdx],
              productCode: codeVal || newInventory[existIdx].productCode || '',
              stock: qtyVal,
              price: priceVal
            };
            updateCount++;
          } else {
            newInventory.push({
              store: storeVal,
              productCode: codeVal,
              name: nameVal,
              spec: specVal,
              category: catVal,
              stock: qtyVal,
              price: priceVal
            });
            insertCount++;
          }
        });

        onUpdateInventoryList(newInventory, `Excel 批量库存更新 (更新: ${updateCount} 条 | 新增: ${insertCount} 条)`);
        onShowToast(`🎉 成功导入 Excel 数量。更新 ${updateCount} 条，新增 ${insertCount} 条！`, 'success');
      } catch (err: any) {
        onShowToast('解析库存 Excel 文件失败：' + err.message, 'error');
      }
    };
    fileReader.readAsArrayBuffer(file);
    e.target.value = ''; // Clean selector state
  };

  // 5. Excel export matches the displayed Summary Dimension precisely
  const handleExportExcel = () => {
    let headers: string[] = [];
    if (summaryDimension === 'product_details') {
      headers = ['产品编码', '产品名称', '分店', '类别', '规格/型号', '库存数量', '库存金额'];
    } else if (summaryDimension === 'by_store') {
      headers = ['分店', '库存数量', '库存金额'];
    } else {
      headers = ['品类类别', '库存数量', '库存金额'];
    }

    const sheetRows = [headers];

    gridRows.forEach((r: any) => {
      if (summaryDimension === 'product_details') {
        sheetRows.push([r.productCode, r.name, r.store, r.category, r.spec, r.stock, r.stockAmount]);
      } else if (summaryDimension === 'by_store') {
        sheetRows.push([r.store, r.stock, r.stockAmount]);
      } else {
        sheetRows.push([r.category, r.stock, r.stockAmount]);
      }
    });

    // Add totals row
    if (summaryDimension === 'product_details') {
      sheetRows.push(['合计', '—', '—', '—', '—', totals.totalStock, totals.totalAmount]);
    } else {
      sheetRows.push(['合计', totals.totalStock, totals.totalAmount]);
    }

    const ws = XLSX.utils.aoa_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '库存分类数据');
    XLSX.writeFile(wb, '库存明细数据.xlsx');

    onShowToast('✅ 库存明细及汇总数据已下载为 Excel！', 'success');
  };

  const formatCurrency = (val: number) => {
    return '¥' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-6">
      {/* 1. 总分库存 KPI 决策卡片组 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: 总仓 (Headquarters Warehouse) */}
        <div id="hq-inventory-card" className="bg-gradient-to-br from-indigo-50 to-white p-5 rounded-2xl border border-indigo-100/65 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-indigo-500/10 text-indigo-700 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest">总仓库存储备 (General WH)</span>
            <div className="mt-1.5 flex items-baseline gap-1.5 flex-wrap">
              <span className="text-xl font-extrabold text-slate-800 font-mono">
                {hqAndBranchesTotals.hqStock.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 font-semibold">件</span>
            </div>
            <div className="text-sm font-bold text-indigo-600 font-mono mt-0.5 truncate">
              {formatCurrency(hqAndBranchesTotals.hqAmount)}
            </div>
          </div>
        </div>

        {/* Card 2: 分店合计 (Retail Store Branches) */}
        <div id="branches-inventory-card" className="bg-gradient-to-br from-sky-50 to-white p-5 rounded-2xl border border-sky-100/65 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-sky-500/10 text-sky-700 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest">分店合计库存 (Branches Sum)</span>
            <div className="mt-1.5 flex items-baseline gap-1.5 flex-wrap">
              <span className="text-xl font-extrabold text-slate-800 font-mono">
                {hqAndBranchesTotals.branchStock.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 font-semibold">件</span>
            </div>
            <div className="text-sm font-bold text-sky-600 font-mono mt-0.5 truncate">
              {formatCurrency(hqAndBranchesTotals.branchAmount)}
            </div>
          </div>
        </div>

        {/* Card 3: 总分合计 (Grand Total Consolidated) */}
        <div id="grand-inventory-card" className="bg-gradient-to-br from-purple-50 to-white p-5 rounded-2xl border border-purple-100/65 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-purple-500/10 text-purple-700 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest">总分累计库存 (Grand Total)</span>
            <div className="mt-1.5 flex items-baseline gap-1.5 flex-wrap">
              <span className="text-xl font-extrabold text-slate-800 font-mono">
                {hqAndBranchesTotals.totalStock.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 font-semibold">件</span>
            </div>
            <div className="text-sm font-bold text-purple-600 font-mono mt-0.5 truncate">
              {formatCurrency(hqAndBranchesTotals.totalAmount)}
            </div>
          </div>
        </div>
      </div>

      {/* Filters with independent buttons */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-50 pb-2 mb-2">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
            <ListFilter className="w-4.5 h-4.5 text-[#1a5c9e]" />
            库存明细及多维度汇总筛选
          </h3>

          {/* RIGHT ALIGNED EXCEL ACTIONS - NEW ADDITION */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleDownloadTemplate}
              className="px-2.5 py-1.5 text-xs font-semibold text-[#1a5c9e] hover:bg-[#1a5c9e]/10 border border-[#1a5c9e]/20 hover:border-[#1a5c9e]/40 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> 下载库存模版
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 border border-emerald-500/20 hover:border-emerald-500/40 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-600" /> 上传批量库存
            </button>
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleUploadStock}
              accept=".xlsx, .xls"
              className="hidden"
            />
            <button
              onClick={handleExportExcel}
              className="px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-50 border border-sky-500/20 hover:border-sky-500/40 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-sky-600" /> 导出 Excel
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Summary Dimension Filter - NEW ADDITION */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              分组汇总维度 <span className="text-rose-500 text-xs font-bold font-mono">*</span>
            </label>
            <select
              value={summaryDimension}
              onChange={(e) => setSummaryDimension(e.target.value as InventorySummaryDimension)}
              className="w-full px-3 py-2 text-xs text-semibold text-white bg-[#1a5c9e] border border-[#1a5c9e] rounded-lg outline-none focus:border-[#113e6d] transition-colors cursor-pointer"
            >
              <option value="product_details">产品明细 (默认)</option>
              <option value="by_store">按分店汇总列表</option>
              <option value="by_category">按品类类别汇总列表</option>
            </select>
          </div>

          {/* Store Checklist */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              库存店铺 / 门店
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

          {/* Category List */}
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

          {/* Fuzzy Search Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              模糊产品名称
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="搜索产品名字"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-xs text-slate-750 focus:border-[#1a5c9e] pr-8"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>
        </div>

        {/* Query trigger */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            onClick={handleQuery}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1 cursor-pointer transition-all hover:-translate-y-px"
          >
            <Play className="w-3.5 h-3.5 fill-white text-transparent" /> 执行查询
          </button>
        </div>
      </div>

      {/* Grid inventory list card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
          <Boxes className="w-5 h-5 text-[#1a5c9e]" />
          <span className="font-bold text-slate-800 text-sm">
            库存账面存量汇总列表
            <span className="text-xs text-slate-400 font-normal ml-2">
              (当前处于- <strong>{summaryDimension === 'product_details' ? '产品明细' : summaryDimension === 'by_store' ? '按分店汇总' : '按品类汇总'}</strong> 报表维度)
            </span>
          </span>
        </div>

        {/* Dynamic Headers Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider">
              {summaryDimension === 'product_details' ? (
                <tr>
                  <th className="p-4 border-r border-slate-200">产品编码</th>
                  <th className="p-4 border-r border-slate-200">产品名称</th>
                  <th className="p-4 border-r border-slate-200">存储分店</th>
                  <th className="p-4 border-r border-slate-200">产品品类</th>
                  <th className="p-4 border-r border-slate-200">规格/型号</th>
                  <th className="p-4 border-r border-slate-200 text-right">账面数量</th>
                  <th className="p-4 text-right bg-[#1a5c9e]/5 text-[#1a5c9e] font-bold">库存账面总额</th>
                </tr>
              ) : summaryDimension === 'by_store' ? (
                <tr>
                  <th className="p-4 border-r border-slate-200">存储分店</th>
                  <th className="p-4 border-r border-slate-200 text-right">大区汇总存量数量</th>
                  <th className="p-4 text-right bg-[#1a5c9e]/5 text-[#1a5c9e] font-bold">库存账面总额</th>
                </tr>
              ) : (
                <tr>
                  <th className="p-4 border-r border-slate-200">品类类别</th>
                  <th className="p-4 border-r border-slate-200 text-right">大区汇总存量数量</th>
                  <th className="p-4 text-right bg-[#1a5c9e]/5 text-[#1a5c9e] font-bold">库存账面总额</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {gridRows.length === 0 ? (
                <tr>
                  <td colSpan={summaryDimension === 'product_details' ? 7 : 3} className="p-12 text-center text-slate-400">
                     <Boxes className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                     没有发现任何满足过滤条件的账面记录
                  </td>
                </tr>
              ) : (
                gridRows.map((row: any) => (
                  <tr key={row.key || row.store || row.category} className="hover:bg-slate-50/50 transition-colors">
                    {summaryDimension === 'product_details' ? (
                      <>
                        <td className="p-4 font-mono text-slate-500 border-r border-slate-200">{row.productCode || '—'}</td>
                        <td className="p-4 font-semibold text-slate-800 border-r border-slate-200">{row.name}</td>
                        <td className="p-4 text-slate-500 border-r border-slate-200">{row.store}</td>
                        <td className="p-4 text-slate-500 border-r border-slate-200">{row.category}</td>
                        <td className="p-4 text-slate-400 font-mono border-r border-slate-200">{row.spec || '—'}</td>
                        <td className="p-4 text-right font-mono font-bold text-slate-700 border-r border-slate-200">{row.stock.toLocaleString()} 件</td>
                        <td className="p-4 text-right font-mono font-bold text-[#1a5c9e] bg-[#1a5c9e]/2.5">{formatCurrency(row.stockAmount)}</td>
                      </>
                    ) : summaryDimension === 'by_store' ? (
                      <>
                        <td className="p-4 font-semibold text-slate-800 border-r border-slate-200">{row.store}</td>
                        <td className="p-4 text-right font-mono font-bold text-slate-700 border-r border-slate-200">{row.stock.toLocaleString()} 件</td>
                        <td className="p-4 text-right font-mono font-bold text-[#1a5c9e] bg-[#1a5c9e]/2.5">{formatCurrency(row.stockAmount)}</td>
                      </>
                    ) : (
                      <>
                        <td className="p-4 font-semibold text-slate-800 border-r border-slate-200">{row.category}</td>
                        <td className="p-4 text-right font-mono font-bold text-slate-700 border-r border-slate-200">{row.stock.toLocaleString()} 件</td>
                        <td className="p-4 text-right font-mono font-bold text-[#1a5c9e] bg-[#1a5c9e]/2.5">{formatCurrency(row.stockAmount)}</td>
                      </>
                    )}
                  </tr>
                ))
              )}

              {/* Total Row */}
              {gridRows.length > 0 && (
                <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-200">
                  {summaryDimension === 'product_details' ? (
                    <>
                      <td colSpan={5} className="p-4 border-r border-slate-200 text-right uppercase">账面合计</td>
                      <td className="p-4 text-right font-mono border-r border-slate-200">{totals.totalStock.toLocaleString()} 件</td>
                      <td className="p-4 text-right font-mono text-[#1a5c9e] text-sm font-extrabold bg-[#1a5c9e]/5">{formatCurrency(totals.totalAmount)}</td>
                    </>
                  ) : (
                    <>
                      <td className="p-4 border-r border-slate-200 uppercase">合计</td>
                      <td className="p-4 text-right font-mono border-r border-slate-200">{totals.totalStock.toLocaleString()} 件</td>
                      <td className="p-4 text-right font-mono text-[#1a5c9e] text-sm font-extrabold bg-[#1a5c9e]/5">{formatCurrency(totals.totalAmount)}</td>
                    </>
                  )}
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table summary count */}
        <div className="p-4 border-t border-slate-100 text-xs text-slate-400 bg-slate-50 flex items-center justify-between">
          <span>账面分组统计行: <strong className="text-slate-600">{gridRows.length} 条数据</strong></span>
          <span className="font-semibold text-slate-500 font-mono">
            大区合并账面总额: <strong className="text-[#1a5c9e]">{formatCurrency(totals.totalAmount)}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
