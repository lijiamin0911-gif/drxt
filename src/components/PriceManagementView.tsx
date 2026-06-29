/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Search, 
  Coins, 
  FileSpreadsheet, 
  Upload, 
  Save, 
  CheckCircle, 
  AlertCircle, 
  TrendingUp, 
  Info,
  DollarSign,
  HelpCircle,
  BookOpen,
  ArrowUpDown,
  Filter,
  Send
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Product, User } from '../types';
import { DbService } from '../lib/dbService';

interface PriceManagementViewProps {
  currentUser: User;
  onShowToast?: (text: string, type: 'success' | 'info' | 'error') => void;
}

export default function PriceManagementView({ currentUser, onShowToast }: PriceManagementViewProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMissing, setFilterMissing] = useState(false);
  const [sortField, setSortField] = useState<'productCode' | 'productName' | 'costPrice' | 'sellingPrice'>('productCode');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Local changes dictionary (productId -> { costPrice, sellingPrice })
  const [localPrices, setLocalPrices] = useState<Record<string, { costPrice?: string; sellingPrice?: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Batch import states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importType, setImportType] = useState<'text' | 'file'>('text');
  const [importPreview, setImportPreview] = useState<{ productCode: string; costPrice?: number; sellingPrice?: number; productName?: string }[]>([]);
  const [importError, setImportError] = useState('');
  const [isSubmittingImport, setIsSubmittingImport] = useState(false);

  // States for submitting data to the boss
  const [isSubmittingToBoss, setIsSubmittingToBoss] = useState(false);
  const [showSubmitSuccessModal, setShowSubmitSuccessModal] = useState(false);

  const handleSubmitDataToBoss = async () => {
    const confirmed = window.confirm(
      '确定要将当前维护的所有成本价与零售售价账册数据，正式提交并同步推送给老板/决策者终端吗？\n\n这将会实时刷新老板侧BI数据决策大屏，重新乘积算得累计销售额、估计毛利润与盈利模型分析数据。'
    );
    if (!confirmed) return;

    setIsSubmittingToBoss(true);
    try {
      await DbService.log(
        currentUser.id || 'data_manager',
        currentUser.username || '数据管理员',
        currentUser.role || 'data_admin',
        '提交财务数据给老板',
        `数据管理员 [${currentUser.username}] 成功向老板/决策者终端提交推送了最新的商品成本与零售价格财务数据账册（共计 ${products.length} 款商品价格配置），已实时刷新同步全局商业决策BI看板数据。`
      );

      if (onShowToast) {
        onShowToast('🎉 成功提交最新后台价格数据给老板！BI大屏已同步刷新', 'success');
      }
      setShowSubmitSuccessModal(true);
    } catch (e: any) {
      console.error(e);
      if (onShowToast) onShowToast(`❌ 提交失败：${e.message || '网络连接异常'}`, 'error');
    } finally {
      setIsSubmittingToBoss(false);
    }
  };

  // Load products list
  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const prods = await DbService.getProducts();
      setProducts(prods);
      
      // Initialize local price inputs state
      const initialLocal: Record<string, { costPrice?: string; sellingPrice?: string }> = {};
      prods.forEach(p => {
        initialLocal[p.id] = {
          costPrice: p.costPrice !== undefined ? p.costPrice.toString() : '',
          sellingPrice: p.sellingPrice !== undefined ? p.sellingPrice.toString() : ''
        };
      });
      setLocalPrices(initialLocal);
    } catch (e) {
      console.error('Failed to load products for price management:', e);
      if (onShowToast) onShowToast('❌ 加载货品资料失败，请刷新重试', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [onShowToast]);

  useEffect(() => {
    loadProducts();
    const unsub = DbService.onChange(() => {
      loadProducts();
    });
    return () => unsub();
  }, [loadProducts]);

  // Handle single product price input updates
  const handlePriceChange = (productId: string, field: 'costPrice' | 'sellingPrice', value: string) => {
    // Basic formatting constraint (only allow numbers, decimal point)
    const sanitized = value.replace(/[^\d.]/g, '');
    
    // Prevent multiple decimal points
    const parts = sanitized.split('.');
    let finalValue = sanitized;
    if (parts.length > 2) {
      finalValue = parts[0] + '.' + parts.slice(1).join('');
    }

    setLocalPrices(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: finalValue
      }
    }));
  };

  // Save price updates for a single product
  const handleSavePrice = async (productId: string) => {
    const originalProd = products.find(p => p.id === productId);
    if (!originalProd) return;

    const inputData = localPrices[productId] || {};
    const updatedCost = inputData.costPrice && inputData.costPrice.trim() !== '' ? parseFloat(inputData.costPrice) : undefined;
    const updatedSelling = inputData.sellingPrice && inputData.sellingPrice.trim() !== '' ? parseFloat(inputData.sellingPrice) : undefined;

    if (updatedCost !== undefined && isNaN(updatedCost)) {
      if (onShowToast) onShowToast('❌ 成本价格式无效，请输入数字', 'error');
      return;
    }
    if (updatedSelling !== undefined && isNaN(updatedSelling)) {
      if (onShowToast) onShowToast('❌ 售价格式无效，请输入数字', 'error');
      return;
    }

    setSavingId(productId);
    try {
      const updatedProduct: Product = {
        ...originalProd,
        costPrice: updatedCost,
        sellingPrice: updatedSelling,
        updatedAt: new Date().toISOString()
      };

      await DbService.saveProduct(updatedProduct, {
        id: currentUser.id || 'data_manager',
        name: currentUser.username || '数据管理员',
        role: currentUser.role || 'data_admin'
      });

      // Record in logs
      await DbService.log(
        currentUser.id || 'data_manager',
        currentUser.username || '数据管理员',
        currentUser.role || 'data_admin',
        '维护货品价格',
        `更新了商品 [${originalProd.productName}] 的价格：成本价 ¥${updatedCost !== undefined ? updatedCost : '无'}, 售价 ¥${updatedSelling !== undefined ? updatedSelling : '无'}`
      );

      if (onShowToast) onShowToast(`✅ 成功更新 [${originalProd.productName}] 的价格体系！`, 'success');
    } catch (e) {
      console.error(e);
      if (onShowToast) onShowToast('❌ 价格保存保存失败，请检查网络', 'error');
    } finally {
      setSavingId(null);
    }
  };

  // Sorting helper
  const handleSort = (field: 'productCode' | 'productName' | 'costPrice' | 'sellingPrice') => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Process and filter products
  const filteredProducts = useMemo(() => {
    let list = [...products];

    // Search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      list = list.filter(p => 
        p.productCode.toLowerCase().includes(query) ||
        p.productName.toLowerCase().includes(query) ||
        p.specs.toLowerCase().includes(query) ||
        p.defaultSupplier.toLowerCase().includes(query)
      );
    }

    // Missing prices filter
    if (filterMissing) {
      list = list.filter(p => p.costPrice === undefined || p.sellingPrice === undefined);
    }

    // Sort
    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      // fallback for undefined prices when sorting numerically
      if (sortField === 'costPrice') {
        valA = a.costPrice ?? -1;
        valB = b.costPrice ?? -1;
      } else if (sortField === 'sellingPrice') {
        valA = a.sellingPrice ?? -1;
        valB = b.sellingPrice ?? -1;
      }

      if (typeof valA === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
    });

    return list;
  }, [products, searchQuery, filterMissing, sortField, sortOrder]);

  // Statistics
  const stats = useMemo(() => {
    const total = products.length;
    const hasCost = products.filter(p => p.costPrice !== undefined).length;
    const hasSelling = products.filter(p => p.sellingPrice !== undefined).length;
    const complete = products.filter(p => p.costPrice !== undefined && p.sellingPrice !== undefined).length;
    return { total, hasCost, hasSelling, complete };
  }, [products]);

  // Bulk Excel import parser (Text Copy-Paste)
  const handleParsePastedText = () => {
    setImportError('');
    if (!importText.trim()) {
      setImportPreview([]);
      return;
    }

    const lines = importText.trim().split('\n');
    if (lines.length < 2) {
      setImportError('至少需要两行数据（第一行为标题行，第二行为数据内容）');
      return;
    }

    // Attempt to parse headers
    const headers = lines[0].split('\t').map(h => h.trim());
    
    // Find matching indices
    const codeIdx = headers.findIndex(h => h.includes('编码') || h.includes('代码') || h.toLowerCase().includes('code'));
    const costIdx = headers.findIndex(h => h.includes('成本') || h.toLowerCase().includes('cost'));
    const sellIdx = headers.findIndex(h => h.includes('售价') || h.includes('零售价') || h.includes('单价') || h.toLowerCase().includes('price') || h.toLowerCase().includes('selling'));

    if (codeIdx === -1) {
      setImportError('无法自动识别【货品编码/产品编码】列。请确保标题行包含“编码”或“code”字样。');
      return;
    }
    if (costIdx === -1 && sellIdx === -1) {
      setImportError('无法自动识别价格列。标题行至少需要包含“成本”、“售价”或“单价”中的一种。');
      return;
    }

    const previewList: typeof importPreview = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split('\t');
      if (cols.length < codeIdx + 1) continue;

      const code = cols[codeIdx]?.trim();
      if (!code) continue;

      const costRaw = costIdx !== -1 ? cols[costIdx]?.replace(/[^\d.]/g, '') : '';
      const sellRaw = sellIdx !== -1 ? cols[sellIdx]?.replace(/[^\d.]/g, '') : '';

      const costPrice = costRaw ? parseFloat(costRaw) : undefined;
      const sellingPrice = sellRaw ? parseFloat(sellRaw) : undefined;

      // Find matched name in current product database if exists
      const match = products.find(p => p.productCode.toLowerCase() === code.toLowerCase());

      previewList.push({
        productCode: code,
        costPrice,
        sellingPrice,
        productName: match ? match.productName : '⚠️ 货品库中不存在此编码（将创建新条目或匹配失败）'
      });
    }

    if (previewList.length === 0) {
      setImportError('没有解析出合法的商品价格行，请检查数据行列格式。');
    } else {
      setImportPreview(previewList);
    }
  };

  // Bulk Excel Upload parser
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError('');
    const files = e.target.files;
    if (!files || !files[0]) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (rawJson.length < 2) {
          setImportError('Excel表内容过少，至少需要表头和一行数据！');
          return;
        }

        const headers = rawJson[0].map((h: any) => String(h || '').trim());
        const codeIdx = headers.findIndex(h => h.includes('编码') || h.includes('代码') || h.toLowerCase().includes('code'));
        const costIdx = headers.findIndex(h => h.includes('成本') || h.toLowerCase().includes('cost'));
        const sellIdx = headers.findIndex(h => h.includes('售价') || h.includes('零售价') || h.includes('单价') || h.toLowerCase().includes('price') || h.toLowerCase().includes('selling'));

        if (codeIdx === -1) {
          setImportError('无法在第一行表头中识别【商品编码】列（列名须包含“编码”或“Code”）。');
          return;
        }

        const previewList: typeof importPreview = [];
        for (let i = 1; i < rawJson.length; i++) {
          const row = rawJson[i];
          if (!row || row.length === 0) continue;

          const code = String(row[codeIdx] || '').trim();
          if (!code || code === 'undefined') continue;

          const costRaw = costIdx !== -1 ? String(row[costIdx] || '').replace(/[^\d.]/g, '') : '';
          const sellRaw = sellIdx !== -1 ? String(row[sellIdx] || '').replace(/[^\d.]/g, '') : '';

          const costPrice = costRaw ? parseFloat(costRaw) : undefined;
          const sellingPrice = sellRaw ? parseFloat(sellRaw) : undefined;

          const match = products.find(p => p.productCode.toLowerCase() === code.toLowerCase());

          previewList.push({
            productCode: code,
            costPrice,
            sellingPrice,
            productName: match ? match.productName : '⚠️ 货品库中不存在此编码（将创建新条目或匹配失败）'
          });
        }

        if (previewList.length === 0) {
          setImportError('Excel中未析出有效数据。');
        } else {
          setImportPreview(previewList);
        }
      } catch (err: any) {
        setImportError(`解析Excel出错: ${err.message}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Submit imported price lists
  const submitImportedPrices = async () => {
    if (importPreview.length === 0) {
      alert('没有需要导入的价格。');
      return;
    }

    setIsSubmittingImport(true);
    let updatedCount = 0;
    let failedCount = 0;

    try {
      for (const item of importPreview) {
        const match = products.find(p => p.productCode.toLowerCase() === item.productCode.toLowerCase());
        if (match) {
          const updatedProduct: Product = {
            ...match,
            costPrice: item.costPrice !== undefined ? item.costPrice : match.costPrice,
            sellingPrice: item.sellingPrice !== undefined ? item.sellingPrice : match.sellingPrice,
            updatedAt: new Date().toISOString()
          };

          await DbService.saveProduct(updatedProduct, {
            id: currentUser.id || 'data_manager',
            name: currentUser.username || '数据管理员',
            role: currentUser.role || 'data_admin'
          });
          updatedCount++;
        } else {
          failedCount++;
        }
      }

      await DbService.log(
        currentUser.id || 'data_manager',
        currentUser.username || '数据管理员',
        currentUser.role || 'data_admin',
        '批量导入货品价格',
        `批量导入价格体系，成功更新 ${updatedCount} 款商品价格，失败/未匹配 ${failedCount} 款。`
      );

      if (onShowToast) onShowToast(`🎉 批量导入成功！更新了 ${updatedCount} 款商品价格体系。`, 'success');
      setShowImportModal(false);
      setImportPreview([]);
      setImportText('');
    } catch (e: any) {
      console.error(e);
      alert(`导入发生错误: ${e.message}`);
    } finally {
      setIsSubmittingImport(false);
    }
  };

  // Download Price Import Template
  const downloadPriceTemplate = () => {
    try {
      const data = [
        ["商品编码", "商品名称", "成本价", "售价"],
        ["PROD-A01", "九牧不锈钢暗装高档水龙头", "45.00", "85.00"],
        ["PROD-B05", "飞利浦智能LED吸顶顶灯 50W", "120.00", "199.00"],
        ["PROD-C12", "西门子五孔大面板安全墙面插座", "12.50", "28.00"]
      ];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "商品价格导入模版");
      XLSX.writeFile(wb, "货品采购成本及售价批量导入模板.xlsx");
    } catch (e: any) {
      alert("下载模板出错: " + e.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and overview block */}
      <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none transform translate-x-6 -translate-y-6">
          <Coins className="w-56 h-56" />
        </div>
        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="bg-amber-500 text-amber-950 font-black text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md">
                  Financial Data Control
                </span>
                <span className="text-slate-400 font-mono text-[10px]">{new Date().toLocaleDateString()}</span>
              </div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                💰 价格与财务数据维护
              </h1>
              <p className="text-xs text-slate-400 max-w-2xl">
                货品金额管理专区：请在此录入、修改或导入各商品的采购成本价及零售售价。
                <strong className="text-amber-400 font-medium"> 系统BI大屏会自动读取此处的售价和成本价，与订单数量进行乘积关联，生成销售额、毛利等商业决策大屏数据。</strong>
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleSubmitDataToBoss}
                disabled={isSubmittingToBoss}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-black rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" /> {isSubmittingToBoss ? '提交中...' : '提交最新后台价格数据给老板'}
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" /> 批量导入价格 Excel
              </button>
            </div>
          </div>

          {/* Core Stats Bento */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            <div className="bg-slate-800/40 border border-slate-800 p-3.5 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 block">系统商品总数</span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-extrabold text-white font-mono">{stats.total}</span>
                <span className="text-[10px] text-slate-500">款</span>
              </div>
            </div>

            <div className="bg-slate-800/40 border border-slate-800 p-3.5 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 block">已设定成本价</span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-extrabold text-emerald-400 font-mono">{stats.hasCost}</span>
                <span className="text-[10px] text-slate-500">款 / {stats.total ? Math.round((stats.hasCost/stats.total)*100) : 0}%</span>
              </div>
            </div>

            <div className="bg-slate-800/40 border border-slate-800 p-3.5 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 block">已设定零售售价</span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-extrabold text-blue-400 font-mono">{stats.hasSelling}</span>
                <span className="text-[10px] text-slate-500">款 / {stats.total ? Math.round((stats.hasSelling/stats.total)*100) : 0}%</span>
              </div>
            </div>

            <div className="bg-slate-800/40 border border-slate-800 p-3.5 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-amber-400 block">完美定价（双价齐全）</span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-extrabold text-amber-400 font-mono">{stats.complete}</span>
                <span className="text-[10px] text-slate-500">款 / {stats.total ? Math.round((stats.complete/stats.total)*100) : 0}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main product pricing manager table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Filters and search */}
        <div className="p-4 bg-slate-50 border-b border-slate-150 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="搜索商品编码、货品名称、规格、供货厂家..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-9 pr-4 py-2 border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-400 font-semibold"
              />
            </div>
            
            <label className="flex items-center gap-1.5 text-xs text-slate-700 bg-white border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-50 cursor-pointer select-none shadow-3xs font-bold shrink-0">
              <input
                type="checkbox"
                checked={filterMissing}
                onChange={e => setFilterMissing(e.target.checked)}
                className="rounded text-amber-500 focus:ring-amber-400 w-3.5 h-3.5 cursor-pointer"
              />
              <span className="flex items-center gap-0.5 text-rose-700">
                <Filter className="w-3.5 h-3.5" /> 仅筛查未定价商品
              </span>
            </label>
          </div>

          <div className="text-xs text-slate-500 font-semibold">
            共找到 <span className="font-bold text-slate-800">{filteredProducts.length}</span> 款符合条件的货品
          </div>
        </div>

        {/* Interactive Table Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/70 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                <th className="p-3.5 font-bold cursor-pointer hover:bg-slate-150 select-none" onClick={() => handleSort('productCode')}>
                  <div className="flex items-center gap-1">
                    商品编码 <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-3.5 font-bold cursor-pointer hover:bg-slate-150 select-none" onClick={() => handleSort('productName')}>
                  <div className="flex items-center gap-1">
                    商品名称 <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-3.5 font-bold">规格型号</th>
                <th className="p-3.5 font-bold text-center w-16">单位</th>
                <th className="p-3.5 font-bold">默认供应商</th>
                <th className="p-3.5 font-bold text-center cursor-pointer hover:bg-slate-150 select-none w-36 bg-emerald-50/40 text-emerald-950" onClick={() => handleSort('costPrice')}>
                  <div className="flex items-center justify-center gap-1">
                    💸 采购成本价 (元) <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-3.5 font-bold text-center cursor-pointer hover:bg-slate-150 select-none w-36 bg-blue-50/40 text-blue-950" onClick={() => handleSort('sellingPrice')}>
                  <div className="flex items-center justify-center gap-1">
                    💰 销售零售售价 (元) <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-3.5 font-bold text-center w-24">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <HelpCircle className="w-8 h-8 text-slate-300" />
                      <span>未找到任何匹配商品或未定价货品条目</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map(p => {
                  const inputVal = localPrices[p.id] || { costPrice: '', sellingPrice: '' };
                  const isCostUpdated = (p.costPrice !== undefined ? p.costPrice.toString() : '') !== inputVal.costPrice;
                  const isSellingUpdated = (p.sellingPrice !== undefined ? p.sellingPrice.toString() : '') !== inputVal.sellingPrice;
                  const hasUnsavedChanges = isCostUpdated || isSellingUpdated;

                  return (
                    <tr key={p.id} className={`hover:bg-slate-50/80 transition-colors ${hasUnsavedChanges ? 'bg-amber-50/20' : ''}`}>
                      <td className="p-3.5 font-mono font-bold text-slate-900 tracking-tight">{p.productCode}</td>
                      <td className="p-3.5 font-bold text-slate-800 max-w-xs truncate" title={p.productName}>{p.productName}</td>
                      <td className="p-3.5 font-mono text-slate-500">{p.specs}</td>
                      <td className="p-3.5 text-center font-bold text-slate-500">{p.unit}</td>
                      <td className="p-3.5 text-slate-500 max-w-[150px] truncate" title={p.defaultSupplier}>{p.defaultSupplier}</td>
                      
                      {/* Cost Price input field */}
                      <td className="p-2.5 bg-emerald-50/20">
                        <div className="relative">
                          <span className="absolute left-2.5 top-2 text-emerald-600 font-bold font-mono text-xs">¥</span>
                          <input
                            type="text"
                            value={inputVal.costPrice}
                            onChange={e => handlePriceChange(p.id, 'costPrice', e.target.value)}
                            placeholder="未设定成本"
                            className={`w-full pl-6 pr-2 py-1.5 border rounded-lg text-center font-mono font-bold text-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs bg-white ${
                              p.costPrice === undefined ? 'border-dashed border-rose-300 shadow-2xs' : 'border-slate-200'
                            }`}
                          />
                        </div>
                      </td>

                      {/* Selling Price input field */}
                      <td className="p-2.5 bg-blue-50/20">
                        <div className="relative">
                          <span className="absolute left-2.5 top-2 text-blue-600 font-bold font-mono text-xs">¥</span>
                          <input
                            type="text"
                            value={inputVal.sellingPrice}
                            onChange={e => handlePriceChange(p.id, 'sellingPrice', e.target.value)}
                            placeholder="未设定售价"
                            className={`w-full pl-6 pr-2 py-1.5 border rounded-lg text-center font-mono font-bold text-blue-800 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs bg-white ${
                              p.sellingPrice === undefined ? 'border-dashed border-rose-300 shadow-2xs' : 'border-slate-200'
                            }`}
                          />
                        </div>
                      </td>

                      {/* Action save button */}
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleSavePrice(p.id)}
                          disabled={savingId === p.id || !hasUnsavedChanges}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-black tracking-tight flex items-center justify-center gap-1 mx-auto transition-all cursor-pointer ${
                            hasUnsavedChanges 
                              ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-md active:scale-95' 
                              : 'bg-slate-100 text-slate-400 opacity-60 cursor-not-allowed'
                          }`}
                        >
                          {savingId === p.id ? (
                            <span className="animate-spin text-slate-950">⌛</span>
                          ) : hasUnsavedChanges ? (
                            <>
                              <Save className="w-3.5 h-3.5" /> 保存修改
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-3.5 h-3.5 text-slate-400" /> 已保存
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Excel Data Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="w-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-extrabold">批量导入货品价格体系 Excel</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">支持 Excel 表格列字段直接匹配或直接粘贴导入更新成本价与售价</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportPreview([]);
                  setImportText('');
                }}
                className="text-slate-400 hover:text-white text-lg font-black cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold">
                  <Info className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>📥 批量导入使用说明与匹配机制：</span>
                </div>
                <p className="pl-5 text-slate-600 leading-relaxed">
                  1. 价格导入通过<strong className="text-slate-800">【商品编码】</strong>进行精确对齐和覆盖。若编码在系统货品库中存在，则直接覆盖/写入该货品价格。
                  <br />
                  2. 字段映射：表头第一行包含“编码/Code”、“成本/Cost”或“售价/单价/Selling/Price”时，系统将智能自动抓取对应数值。
                </p>
                <div className="pl-5 pt-1.5 flex items-center gap-3">
                  <button
                    onClick={downloadPriceTemplate}
                    className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold rounded-lg text-[10px] flex items-center gap-1 cursor-pointer transition-all border border-amber-200"
                  >
                    📥 下载标准的商品价格批量导入模板 Excel
                  </button>
                </div>
              </div>

              {/* Mode togglers */}
              <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                <button
                  type="button"
                  onClick={() => {
                    setImportType('text');
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
                    setImportError('');
                  }}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    importType === 'file' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-450 hover:text-slate-800'
                  }`}
                >
                  Excel/XLSX 文件上传
                </button>
              </div>

              {/* Input section */}
              {importType === 'text' ? (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 block">请在大框中粘贴您的 Excel 区域内容 (含第一行的标题列)：</span>
                  <textarea
                    rows={6}
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                    onBlur={handleParsePastedText}
                    placeholder="在 Excel 复制部分单元格，然后在此处按 Ctrl+V 粘贴..."
                    className="w-full p-3 font-mono text-xs border border-slate-250 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                  />
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={handleParsePastedText}
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      🕵️ 立即解析粘贴文本
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 block">选择存储在您电脑中的 XLSX / XLS 文件：</span>
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50/50 hover:bg-slate-50 transition-all relative">
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="space-y-2 flex flex-col items-center justify-center">
                      <Upload className="w-8 h-8 text-slate-400" />
                      <p className="text-xs font-bold text-slate-700">将您的价格 Excel 文件拖曳到这里，或点击选择浏览文件</p>
                      <p className="text-[10px] text-slate-400">支持 *.xlsx, *.xls, *.csv (首行包含标题)</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Alert */}
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
                    <span>🕵️ 匹配与解析预览（共解析出</span>
                    <span className="font-extrabold text-amber-600 font-mono text-sm">{importPreview.length}</span>
                    <span>条完备行信息）：</span>
                  </h4>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[250px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-[10px] font-extrabold text-slate-600 uppercase border-b border-slate-200 sticky top-0">
                          <th className="p-2">商品编码</th>
                          <th className="p-2">匹配名称 (当前系统)</th>
                          <th className="p-2 text-center bg-emerald-50 text-emerald-950">成本价 (导入值)</th>
                          <th className="p-2 text-center bg-blue-50 text-blue-950">零售售价 (导入值)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-xs">
                        {importPreview.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2 font-bold font-sans text-slate-800">{item.productCode}</td>
                            <td className="p-2 font-sans text-slate-500 truncate max-w-[200px]" title={item.productName}>
                              {item.productName}
                            </td>
                            <td className="p-2 text-center font-bold text-emerald-700 bg-emerald-50/10">
                              {item.costPrice !== undefined ? `¥${item.costPrice.toFixed(2)}` : <span className="text-slate-350">不变</span>}
                            </td>
                            <td className="p-2 text-center font-bold text-blue-700 bg-blue-50/10">
                              {item.sellingPrice !== undefined ? `¥${item.sellingPrice.toFixed(2)}` : <span className="text-slate-350">不变</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-150 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportPreview([]);
                  setImportText('');
                }}
                className="px-4 py-2 border border-slate-250 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-600 transition-all cursor-pointer"
              >
                取消
              </button>

              <button
                type="button"
                onClick={submitImportedPrices}
                disabled={importPreview.length === 0 || isSubmittingImport}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                {isSubmittingImport ? (
                  <span>正在导入更新中...</span>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" /> 确认写入并覆盖价格数据
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Success Dialog */}
      {showSubmitSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-100 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center gap-3 text-emerald-600">
              <div className="p-3 bg-emerald-50 rounded-full">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">数据推送成功</h3>
                <p className="text-xs text-slate-400 font-medium font-mono leading-none mt-1">Ledger Data Synced</p>
              </div>
            </div>
            
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-150 space-y-2 text-xs text-slate-600 leading-relaxed">
              <p className="font-semibold text-slate-800">尊敬的财务数据管理员：</p>
              <p>
                您维护的商品价格体系（共计 <strong className="text-emerald-600 font-bold">{products.length} 款</strong> 货品）已顺利通过系统安全验证，并实时<strong>打包推送提交给老板/决策者终端</strong>！
              </p>
              <p>
                全局 BI 商业数据大屏中的 <strong className="text-blue-600 font-bold">“累计销售金额”</strong> 及 <strong className="text-rose-600 font-bold">“累计预估毛利”</strong> 已按照您的最新售价与成本价系数完成动态重算与同步刷新。
              </p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowSubmitSuccessModal(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-850 text-white font-bold rounded-xl text-xs cursor-pointer transition-all active:scale-95"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
