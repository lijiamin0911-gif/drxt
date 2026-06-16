import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  FileSpreadsheet, 
  ShoppingCart, 
  AlertTriangle, 
  CheckCircle, 
  Sliders, 
  PlusCircle, 
  Trash2, 
  Edit, 
  RefreshCw, 
  X, 
  FileText, 
  ChevronRight, 
  Sparkles 
} from 'lucide-react';
import { InventoryItem, User } from '../types';
import { DbService } from '../lib/dbService';

interface InventoryViewProps {
  currentUser: User;
}

export default function InventoryView({ currentUser }: InventoryViewProps) {
  // State from DB
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'stockout' | 'warning' | 'normal'>('all');

  // Interactive UI modals
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isEditingItem, setIsEditingItem] = useState<InventoryItem | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  
  // New Item / Edit Form States
  const [formProductCode, setFormProductCode] = useState('');
  const [formProductName, setFormProductName] = useState('');
  const [formSpecs, setFormSpecs] = useState('');
  const [formCurrentStock, setFormCurrentStock] = useState<number>(0);
  const [formSafeStock, setFormSafeStock] = useState<number>(0);
  const [formSupplier, setFormSupplier] = useState('');

  // Import Parser States
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState<Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>[]>([]);
  const [importError, setImportError] = useState('');

  // Quick PO Checklist States
  const [selectedStockoutIds, setSelectedStockoutIds] = useState<string[]>([]);
  const [poRemarks, setPoRemarks] = useState('备货库库存不足，自动合并生成采购补货单');
  const [isPoLoading, setIsPoLoading] = useState(false);

  // Success notifications
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Load Inventory from DB
  const fetchInventoryData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await DbService.getInventory();
      setInventory(data);
      
      // Auto-select all stockout items for convenience in purchase consolidation
      const stockouts = data.filter(item => item.currentStock < item.safeStock);
      setSelectedStockoutIds(stockouts.map(item => item.id));
    } catch (err) {
      console.error('Failed to load inventory:', err);
      showToast('获取库存记录失败，请刷新重试', 'error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchInventoryData();

    // Subscribe to DB updates
    const unsub = DbService.onChange(() => {
      fetchInventoryData();
    });
    return () => unsub();
  }, [fetchInventoryData]);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Filter & Search Logic
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const matchSearch = 
        item.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.specs && item.specs.toLowerCase().includes(searchTerm.toLowerCase()));

      const hasStockout = item.currentStock < item.safeStock;
      const isCritical = item.currentStock <= item.safeStock * 0.4;
      
      if (statusFilter === 'stockout') {
        return matchSearch && hasStockout && isCritical;
      }
      if (statusFilter === 'warning') {
        return matchSearch && hasStockout && !isCritical;
      }
      if (statusFilter === 'normal') {
        return matchSearch && !hasStockout;
      }
      return matchSearch;
    });
  }, [inventory, searchTerm, statusFilter]);

  // Items currently lagging safe stock level
  const stockoutItems = useMemo(() => {
    return inventory.filter(item => item.currentStock < item.safeStock);
  }, [inventory]);

  // Create Individual Item
  const handleCreateOrUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProductCode.trim() || !formProductName.trim() || !formSupplier.trim()) {
      showToast('请完整填写商品编码、商品名称与推荐供应商', 'error');
      return;
    }

    try {
      if (isEditingItem) {
        // Edit flow
        const updated: InventoryItem = {
          ...isEditingItem,
          productCode: formProductCode.trim(),
          productName: formProductName.trim(),
          specs: formSpecs.trim(),
          currentStock: Number(formCurrentStock),
          safeStock: Number(formSafeStock),
          supplier: formSupplier.trim(),
          updatedAt: new Date().toISOString()
        };
        await DbService.saveInventoryItem(updated, {
          id: currentUser.id,
          name: currentUser.username,
          role: currentUser.role
        });
        await DbService.log(
          currentUser.id,
          currentUser.username,
          currentUser.role,
          '修改库存属性',
          `手动调整了 [${updated.productName}] (${updated.productCode}) 的库存与参数`
        );
        showToast('库存参数更新成功', 'success');
        setIsEditingItem(null);
      } else {
        // Create flow
        // Check duplication
        const duplicate = inventory.find(i => i.productCode.toLowerCase() === formProductCode.trim().toLowerCase());
        if (duplicate) {
          showToast(`商品编码 ${formProductCode} 已存在，不能重复新增！`, 'error');
          return;
        }

        const newItem: InventoryItem = {
          id: 'inv_' + Date.now() + Math.random().toString(36).substring(2, 6),
          productCode: formProductCode.trim(),
          productName: formProductName.trim(),
          specs: formSpecs.trim(),
          currentStock: Number(formCurrentStock),
          safeStock: Number(formSafeStock),
          supplier: formSupplier.trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await DbService.saveInventoryItem(newItem, {
          id: currentUser.id,
          name: currentUser.username,
          role: currentUser.role
        });
        await DbService.log(
          currentUser.id,
          currentUser.username,
          currentUser.role,
          '新增库存品项',
          `手动添加了备货库新产品：${newItem.productName} (${newItem.productCode})`
        );
        showToast('库存产品新增成功', 'success');
        setIsAddingItem(false);
      }
      resetForm();
    } catch (err) {
      console.error(err);
      showToast('保存产品失败', 'error');
    }
  };

  const resetForm = () => {
    setFormProductCode('');
    setFormProductName('');
    setFormSpecs('');
    setFormCurrentStock(0);
    setFormSafeStock(0);
    setFormSupplier('');
  };

  const openEditModal = (item: InventoryItem) => {
    setIsEditingItem(item);
    setFormProductCode(item.productCode);
    setFormProductName(item.productName);
    setFormSpecs(item.specs || '');
    setFormCurrentStock(item.currentStock);
    setFormSafeStock(item.safeStock);
    setFormSupplier(item.supplier);
  };

  // Quick template loaders for testing
  const loadDemoTemplate = () => {
    const templateText = 
`PROD-A01\t九牧不锈钢暗装高档水龙头\tSS-901-HM\t15\t50\t九牧卫浴制造厂
PROD-B05\t飞利浦智能LED吸顶顶灯 50W\tPL-M50W-LED\t5\t30\t飞利浦合肥照明厂
PROD-E60\t雷士奢华全铜客厅水晶吊灯\tLS-CRY-V8\t2\t10\t雷士照明惠州厂
PROD-F44\t德力西高精度全自动自复位漏电器\tDLX-RCBO-40A\t8\t25\t德力西电气集团
PROD-H90\t联塑给水加厚防爆PVC弯头 25mm\tLS-WT-25\t120\t200\t联塑科技制造厂`;
    setImportText(templateText);
    parsePastedText(templateText);
  };

  // Excel Copy-Paste String parsing logic
  const parsePastedText = (text: string) => {
    setImportError('');
    if (!text.trim()) {
      setImportPreview([]);
      return;
    }

    const lines = text.split('\n');
    const parsedData: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // split by tabs (Excel format) or commas
      let parts = line.split('\t');
      if (parts.length < 2) {
        parts = line.split(',');
      }

      if (parts.length < 2) {
        setImportError(`第 ${i + 1} 行解析失败：每行数据必须至少包含【商品编码】和【商品名称】`);
        setImportPreview([]);
        return;
      }

      const productCode = parts[0]?.trim();
      const productName = parts[1]?.trim();
      const specs = parts[2]?.trim() || '通用规格';
      const currentStock = Number(parts[3]) || 0;
      const safeStock = Number(parts[4]) || 0;
      const supplier = parts[5]?.trim() || '通用合作厂商';

      if (!productCode || !productName) {
        setImportError(`第 ${i + 1} 行不完整：商品编码及名称不可为空`);
        setImportPreview([]);
        return;
      }

      parsedData.push({
        productCode,
        productName,
        specs,
        currentStock,
        safeStock,
        supplier
      });
    }

    setImportPreview(parsedData);
  };

  const handleImportSubmit = async () => {
    if (importPreview.length === 0) {
      showToast('无有效可导入的数据预览', 'error');
      return;
    }

    try {
      await DbService.importInventory(importPreview, {
        id: currentUser.id,
        name: currentUser.username,
        role: currentUser.role
      });
      showToast(`成功批量并列更新 ${importPreview.length} 项备货库库存`, 'success');
      setIsImporting(false);
      setImportText('');
      setImportPreview([]);
    } catch (err) {
      console.error(err);
      showToast('由于数据库规则限制，批量导入失败', 'error');
    }
  };

  // One-click generate PO for stockout items
  const handleBulkGeneratePurchaseOrders = async () => {
    const selectedItemsToProcure = stockoutItems.filter(item => selectedStockoutIds.includes(item.id));
    
    if (selectedItemsToProcure.length === 0) {
      showToast('未选择任何欠货产品进行并案采购', 'error');
      return;
    }

    setIsPoLoading(true);
    try {
      // Calculate deficiency qty for each
      const itemsPayload = selectedItemsToProcure.map(item => ({
        productCode: item.productCode,
        productName: item.productName,
        specs: item.specs || '通用规格',
        qtyToOrder: item.safeStock - item.currentStock, // order volume to reach safeStock boundary!
        supplier: item.supplier
      }));

      await DbService.generateInventoryPurchaseOrders(itemsPayload, {
        id: currentUser.id,
        name: currentUser.username,
        role: currentUser.role
      }, poRemarks);

      showToast(`成功并单生成 ${itemsPayload.length} 笔货品厂家采购订单！`, 'success');
      
      // Update selected states
      setSelectedStockoutIds([]);
    } catch (err) {
      console.error(err);
      showToast('采购合同并并失败，请核对权限', 'error');
    } finally {
      setIsPoLoading(false);
    }
  };

  const handleToggleSelectAllStockouts = () => {
    const activeCheckedCount = stockoutItems.filter(item => selectedStockoutIds.includes(item.id)).length;
    if (activeCheckedCount === stockoutItems.length) {
      // Uncheck all
      setSelectedStockoutIds([]);
    } else {
      // Check all
      setSelectedStockoutIds(stockoutItems.map(item => item.id));
    }
  };

  const handleToggleSelectStockout = (id: string) => {
    if (selectedStockoutIds.includes(id)) {
      setSelectedStockoutIds(selectedStockoutIds.filter(item => item !== id));
    } else {
      setSelectedStockoutIds([...selectedStockoutIds, id]);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Visual Banners / Toast Notifications */}
      {toastMessage && (
        <div 
          className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg border animate-slideIn flex items-center gap-3 max-w-sm ${
            toastMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
            toastMessage.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
            'bg-slate-50 border-slate-200 text-slate-800'
          }`}
        >
          {toastMessage.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />}
          <div className="text-xs font-semibold">{toastMessage.text}</div>
        </div>
      )}

      {/* Grid: Left Summary Cards & Setup Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* PO Quick Generator Banner */}
        <div className="lg:col-span-4 bg-gradient-to-br from-blue-900 to-slate-900 text-white p-6 rounded-2xl border border-blue-700/30 shadow-md flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-1 px-2 text-[10px] bg-blue-500/30 text-blue-300 font-bold uppercase rounded font-mono tracking-wider">
                仓库自适应预警柜
              </span>
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            </div>
            
            <h2 className="text-lg font-extrabold tracking-tight">根据库存智能缺货并单采购</h2>
            <p className="text-xs text-blue-200/80 leading-relaxed font-sans">
              系统根据您导入的<b>备货库现有库存量</b>与<b>安全阈值水平</b>进行对等交叉分析。通过勾选预警的货品编码，即可一键将差额并案发单提报给关联厂家，实现智能采购流转。
            </p>
          </div>

          <div className="pt-4 border-t border-white/10 grid grid-cols-2 gap-4">
            <div className="bg-white/5 p-3 rounded-xl border border-white/5">
              <div className="text-[10px] text-blue-300 font-mono">备货总品项</div>
              <div className="text-xl font-bold font-mono text-white mt-1">{inventory.length}</div>
            </div>
            <div className="bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
              <div className="text-[10px] text-rose-300 font-mono">当前缺货货品</div>
              <div className="text-xl font-bold font-mono text-rose-400 mt-1">{stockoutItems.length}</div>
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setIsImporting(true)}
              className="flex-1 p-2.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-center text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>导入库存数据</span>
            </button>
            <button
              onClick={() => setIsAddingItem(true)}
              className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-center text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">新增品项</span>
            </button>
          </div>
        </div>

        {/* Stockout Consolidation Processing Area */}
        <div id="quick_po_area" className="lg:col-span-8 bg-white rounded-2xl border border-slate-150 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
                <AlertTriangle className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-xs md:text-sm font-bold text-slate-900">1. 下图为比对缺货的产品清单 (低于安全库存级数)</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">勾选品项：系统将生成 需购数量 = [安全库存 - 现有主库存] 以补充水位</p>
              </div>
            </div>
            {stockoutItems.length > 0 && (
              <button
                onClick={handleToggleSelectAllStockouts}
                className="text-[11px] text-blue-600 font-bold hover:underline cursor-pointer"
              >
                {selectedStockoutIds.length === stockoutItems.length ? '全部取消' : '一键全选'}
              </button>
            )}
          </div>

          {stockoutItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-250">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
              <div className="text-xs font-bold text-slate-700 mt-2">备货极其安全，没有任何商品处于缺货水位</div>
              <p className="text-[10px] text-slate-400 mt-1 max-w-sm text-center">系统检测到目前所有录入货品的 [现有库存] 均大于等于其 [安全预警值]。</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="max-h-56 overflow-y-auto border border-slate-150 rounded-xl divide-y divide-slate-100 pr-1">
                {stockoutItems.map(item => {
                  const understockQty = item.safeStock - item.currentStock;
                  const isSelected = selectedStockoutIds.includes(item.id);
                  return (
                    <div 
                      key={item.id} 
                      onClick={() => handleToggleSelectStockout(item.id)}
                      className={`p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs transition-colors cursor-pointer ${
                        isSelected ? 'bg-blue-50/20' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleToggleSelectStockout(item.id);
                          }}
                          className="mt-0.5 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                        />
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                            <span>{item.productName}</span>
                            <span className="text-[9px] bg-slate-100 px-1 py-0.5 text-slate-500 rounded font-mono uppercase tracking-wider">{item.productCode}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1">
                            推荐供应商：<strong>{item.supplier}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-right self-end md:self-center">
                        <div className="text-slate-500 text-[10px]">
                          现存 <b className="font-mono text-slate-800">{item.currentStock}</b> / 阈值 <span className="font-mono text-slate-600">{item.safeStock}</span>
                        </div>
                        <div className="bg-rose-50 text-rose-700 px-2.5 py-1 rounded-md border border-rose-100 text-center">
                          <span className="text-[10px] leading-none block font-semibold text-rose-500">差额缺口</span>
                          <span className="font-mono font-extrabold text-xs">-{understockQty} 件</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Form details to generate PO */}
              <div className="bg-slate-50 p-4 border border-slate-150 rounded-xl space-y-3.5 text-xs text-slate-700">
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex-1 space-y-1">
                    <label className="block text-slate-600 font-semibold text-[10px]">2. 厂家合同/回执备用说明</label>
                    <input
                      type="text"
                      className="w-full px-3 py-1.5 bg-white border border-slate-205 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600"
                      value={poRemarks}
                      onChange={(e) => setPoRemarks(e.target.value)}
                      placeholder="如：急单、备齐立刻安排发货"
                    />
                  </div>

                  <div className="md:w-56 flex flex-col justify-end">
                    <button
                      type="button"
                      disabled={isPoLoading || selectedStockoutIds.length === 0}
                      onClick={handleBulkGeneratePurchaseOrders}
                      className={`w-full p-2.5 text-white font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer text-xs ${
                        selectedStockoutIds.length === 0 
                          ? 'bg-slate-350 cursor-not-allowed opacity-50 bg-slate-400' 
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      <ShoppingCart className="w-4 h-4" />
                      <span>{isPoLoading ? '正在核发采购...' : `合并核发 ${selectedStockoutIds.length} 项货品`}</span>
                    </button>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 flex items-center gap-1.5 leading-tight pt-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  <span>快速核发将合并同厂商/推荐供应商的所有品项，即刻一键打包在同份系统 PO 中，省去您二次归集的繁琐。</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Stock Table */}
      <div className="bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden p-5 space-y-4">
        
        {/* Table Filter Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs md:text-sm font-extrabold text-slate-900">备货库库存综合账目</h3>
            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-mono leading-none">{filteredInventory.length} 件检索结果</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="搜索编码、品名、厂家..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-sans text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600 w-44 md:w-56"
              />
            </div>

            {/* Filter segments */}
            <div className="flex rounded-md p-1 bg-slate-100 border border-slate-200">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                  statusFilter === 'all' ? 'bg-white shadow-sm text-slate-900 border border-slate-200' : 'text-slate-505 text-slate-600'
                }`}
              >
                全部
              </button>
              <button
                onClick={() => setStatusFilter('stockout')}
                className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                  statusFilter === 'stockout' ? 'bg-white shadow-sm text-rose-700 border border-slate-200' : 'text-slate-505 text-slate-600'
                }`}
                title="现有库存仅占安全储备量 40% 或以下"
              >
                🔴 严重缺货
              </button>
              <button
                onClick={() => setStatusFilter('warning')}
                className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                  statusFilter === 'warning' ? 'bg-white shadow-sm text-amber-700 border border-slate-200' : 'text-slate-505 text-slate-600'
                }`}
                title="现有库存未达到安全储备警戒水位"
              >
                🟡 次级缺货
              </button>
              <button
                onClick={() => setStatusFilter('normal')}
                className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                  statusFilter === 'normal' ? 'bg-white shadow-sm text-emerald-700 border border-slate-200' : 'text-slate-505 text-slate-600'
                }`}
              >
                🟢 充足
              </button>
            </div>
          </div>
        </div>

        {/* Real Registry Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans text-slate-700">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] tracking-wider uppercase font-bold text-slate-400">
                <th className="py-3 px-4">货号编码</th>
                <th className="py-3 px-4">货品名称</th>
                <th className="py-3 px-4">规格型号</th>
                <th className="py-3 px-4">推荐订货商 / 品牌商</th>
                <th className="py-3 px-4 text-center">当前库存</th>
                <th className="py-3 px-4 text-center">安全库存</th>
                <th className="py-3 px-4 text-center">库存水位状态</th>
                <th className="py-3 px-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-105 divide-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400 italic">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                      <span>正在实时拉取或同步备货库资产清单...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400 italic">
                    未查找到任何匹配的库存账目数据。可以尝试新建或清空搜索条件。
                  </td>
                </tr>
              ) : (
                filteredInventory.map(item => {
                  const percent = Math.min(100, Math.round((item.currentStock / item.safeStock) * 105) || 0);
                  const isStockout = item.currentStock < item.safeStock;
                  const isCritical = item.currentStock <= item.safeStock * 0.4;

                  return (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-slate-50 transition-colors group ${
                        isCritical ? 'bg-rose-50/5' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 select-all">
                        {item.productCode}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {item.productName}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono">
                        {item.specs || '--'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-800 font-medium">
                        {item.supplier}
                      </td>
                      
                      <td className="py-3.5 px-4 text-center">
                        <span className={`font-mono font-bold text-sm ${
                          isCritical ? 'text-rose-600' : isStockout ? 'text-amber-600' : 'text-emerald-700'
                        }`}>
                          {item.currentStock}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono text-slate-600">
                        {item.safeStock}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex flex-col items-center gap-1">
                          {isCritical ? (
                            <span className="px-2 py-0.5 rounded bg-rose-50 border border-rose-100 text-rose-700 font-bold text-[9px] scale-95">
                              🚨 严重缺货 ({(item.currentStock / item.safeStock * 100).toFixed(0)}%)
                            </span>
                          ) : isStockout ? (
                            <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-150 text-amber-800 font-bold text-[9px] scale-95">
                              ⚠️ 次级报警
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-100 text-emerald-800 font-bold text-[9px] scale-95">
                              ✅ 储备稳健
                            </span>
                          )}

                          {/* Progress bar visualizer */}
                          <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden mt-0.5">
                            <div 
                              className={`h-full rounded-full ${
                                isCritical ? 'bg-rose-500' : isStockout ? 'bg-amber-400' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${percent}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex justify-end gap-1.5 opacity-80 group-hover:opacity-100">
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1 px-2 border border-slate-205 rounded hover:bg-slate-50 text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-0.5 text-[10px] float-right cursor-pointer"
                          >
                            <Edit className="w-2.5 h-2.5" />
                            <span>调整</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Excel CSV Paste Import Area */}
      {isImporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-150 shadow-xl overflow-hidden animate-zoomIn flex flex-col max-h-[85vh]">
            <div className="p-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                <span className="text-xs md:text-sm font-bold text-slate-800">通过 Excel 批量复制/CSV 纯文本导入备货库</span>
              </div>
              <button 
                onClick={() => {
                  setIsImporting(false);
                  setImportText('');
                  setImportPreview([]);
                  setImportError('');
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="bg-slate-50 p-3.5 border border-slate-150 rounded-xl space-y-2 text-xs">
                <div className="font-bold text-slate-700">💡 操作向导与纯文本格式说明：</div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  请在下方大输入框中，粘贴从 <b>Excel</b>、<b>WPS 电子表格</b>、或 <b>TXT 写字板</b> 拖进来的行列表格数据。<br/>
                  <b>首行无需标题声明</b>，字段排列顺序默认遵循：<br/>
                  <code className="bg-blue-50/60 p-1 px-1.5 rounded text-blue-700 font-mono tracking-wide">商品货号[TAB/逗号]中文品名[TAB/逗号]规格型号[TAB/逗号]当前库存量[TAB/逗号]安全防线阈值[TAB/逗号]关联厂家名称</code>
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={loadDemoTemplate}
                    className="p-1.5 px-3 bg-white hover:bg-slate-100 border border-slate-205 rounded text-[10px] font-bold text-blue-600 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle className="w-3 h-3" />
                    <span>自动载入标准示例货品</span>
                  </button>
                </div>
              </div>

              {/* Pasting Box */}
              <div className="space-y-1.5">
                <label className="block text-slate-700 font-bold text-xs">文本粘帖区</label>
                <textarea
                  className="w-full h-32 px-3 py-2 bg-slate-50 border border-slate-205 rounded-xl font-mono text-xs focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white resize-y"
                  value={importText}
                  onChange={(e) => {
                    setImportText(e.target.value);
                    parsePastedText(e.target.value);
                  }}
                  placeholder="示例商品：&#10;PROD-A01&#9;九牧暗装高档水龙头&#9;SS-901-HM&#9;15&#9;50&#9;九牧卫浴制造厂&#10;PROD-B05&#9;飞利浦智能吸顶灯 50W&#9;PL-M50W-LED&#9;5&#9;30&#9;飞利浦合肥照明厂"
                />
              </div>

              {/* Parsing visual feedback */}
              {importError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {importPreview.length > 0 && (
                <div className="space-y-2">
                  <div className="text-slate-700 font-bold text-xs flex items-center justify-between">
                    <span>📑 解析预览 ({importPreview.length} 件产品)</span>
                    <span className="text-[10px] text-emerald-600 font-bold">格式解析验证通过 ✓</span>
                  </div>

                  <div className="max-h-40 overflow-y-auto border border-slate-150 rounded-xl">
                    <table className="w-full text-left text-[10px] border-collapse font-sans">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-150 text-slate-400 font-bold sticky top-0">
                          <th className="py-2 px-3">编码</th>
                          <th className="py-2 px-3">名称</th>
                          <th className="py-2 px-3">规格</th>
                          <th className="py-2 px-3 text-center">库存</th>
                          <th className="py-2 px-3 text-center">安全限额</th>
                          <th className="py-2 px-3">推荐供应商</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-600">
                        {importPreview.map((p, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/55">
                            <td className="py-1 px-3 font-mono font-semibold">{p.productCode}</td>
                            <td className="py-1 px-3 font-medium text-slate-900">{p.productName}</td>
                            <td className="py-1 px-3 font-mono text-slate-400">{p.specs}</td>
                            <td className="py-1 px-3 text-center font-mono text-emerald-700 font-bold">{p.currentStock}</td>
                            <td className="py-1 px-3 text-center font-mono text-slate-500">{p.safeStock}</td>
                            <td className="py-1 px-3 font-medium text-slate-600">{p.supplier}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-150 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsImporting(false);
                  setImportText('');
                  setImportPreview([]);
                  setImportError('');
                }}
                className="px-4 py-2 border border-slate-205 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-500 transition-all cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                disabled={importPreview.length === 0}
                onClick={handleImportSubmit}
                className={`px-5 py-2 text-white font-bold rounded-lg text-xs transition-all flex items-center gap-1 cursor-pointer ${
                  importPreview.length === 0 ? 'bg-slate-350 cursor-not-allowed opacity-50 bg-slate-400' : 'bg-blue-600 hover:bg-blue-705 bg-blue-600'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>确认并同步导入备用库</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Add or Edit Form */}
      {(isAddingItem || isEditingItem) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-150 shadow-xl overflow-hidden animate-zoomIn">
            <div className="p-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-blue-600" />
                <span className="text-xs md:text-sm font-bold text-slate-800">
                  {isEditingItem ? '编辑货品属性与库存' : '手动新增货品品项'}
                </span>
              </div>
              <button 
                onClick={() => {
                  setIsAddingItem(false);
                  setIsEditingItem(null);
                  resetForm();
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOrUpdateItem}>
              <div className="p-5 space-y-4 text-xs">
                
                {/* 1. Code */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-bold">商品货号 / 品类编码 <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    disabled={!!isEditingItem}
                    placeholder="如：PROD-H90 (英数字且全局唯一)"
                    value={formProductCode}
                    onChange={(e) => setFormProductCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-205 rounded-lg disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white font-mono"
                  />
                </div>

                {/* 2. Name */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-bold">商品货品名称 <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="如：九牧不锈钢高档出水水嘴"
                    value={formProductName}
                    onChange={(e) => setFormProductName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-205 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white"
                  />
                </div>

                {/* 3. Specs & Supplier */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="block text-slate-700 font-bold">规格型号</label>
                    <input
                      type="text"
                      placeholder="SS-901-HM"
                      value={formSpecs}
                      onChange={(e) => setFormSpecs(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-205 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-700 font-bold">推荐订货厂家 / 供应商 <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="九牧卫浴制造厂"
                      value={formSupplier}
                      onChange={(e) => setFormSupplier(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-205 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white"
                    />
                  </div>
                </div>

                {/* 4. Stocks */}
                <div className="grid grid-cols-2 gap-3.5 pt-1.5 border-t border-slate-100">
                  <div className="space-y-1">
                    <label className="block text-slate-700 font-bold">当前货品储备量 (件)</label>
                    <input
                      type="number"
                      min={0}
                      value={formCurrentStock}
                      onChange={(e) => setFormCurrentStock(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-205 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white font-mono text-center font-bold text-slate-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-700 font-bold">最低安全预警限额 (件)</label>
                    <input
                      type="number"
                      min={0}
                      value={formSafeStock}
                      onChange={(e) => setFormSafeStock(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-205 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white font-mono text-center font-bold text-blue-700"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-150 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingItem(false);
                    setIsEditingItem(null);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-slate-205 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-500 transition-all cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-705 text-white font-bold rounded-lg text-xs transition-all cursor-pointer shadow-sm bg-blue-600"
                >
                  完成保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
