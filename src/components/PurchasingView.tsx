import React, { useState } from 'react';
import { 
  ShoppingBag, 
  PlusSquare, 
  Truck, 
  Calendar, 
  Users, 
  FileText, 
  CheckCircle, 
  Clipboard, 
  CheckSquare, 
  Square,
  Sparkles,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  PackageCheck,
  Plus,
  Trash2,
  AlertTriangle,
  X
} from 'lucide-react';
import { Order, PurchaseOrder, User, Product, Supplier } from '../types';
import { DbService } from '../lib/dbService';
import ExportButton from './ExportButton';

interface PurchasingViewProps {
  orders: Order[];
  purchaseOrders: PurchaseOrder[];
  onGeneratePos: (orderIds: string[], remarks: string) => Promise<void>;
  onCreateDirectPo: (supplier: string, orderDate: string, remarks: string, items: any[]) => Promise<void>;
  onSubmitToFactory: (poId: string, factoryStatus: 'confirmed' | 'unconfirmed', expectedArrival: string) => Promise<void>;
  onLogArrival: (poId: string, itemArrivals: { orderId: string; receivedQty: number }[]) => Promise<void>;
  currentUser: User;
}

export default function PurchasingView({ 
  orders, 
  purchaseOrders, 
  onGeneratePos, 
  onCreateDirectPo,
  onSubmitToFactory, 
  onLogArrival,
  currentUser 
}: PurchasingViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'generate' | 'manage' | 'direct' | 'cancelled'>('generate');
  
  // Load suppliers and approved products for manual creator
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [procurementStaff, setProcurementStaff] = useState<User[]>([]);
  const [selectedMerchandiserFilter, setSelectedMerchandiserFilter] = useState<string>(() => {
    return currentUser.role === 'purchasing' ? currentUser.username : 'all';
  });

  React.useEffect(() => {
    DbService.getProducts().then(prods => {
      setAllProducts(prods.filter(p => p.isApproved));
    });
    DbService.getSuppliers().then(sups => {
      setSuppliers(sups.filter(s => s.isActive));
    });
    DbService.getUsers().then(usersList => {
      setProcurementStaff(usersList.filter(u => u.role === 'purchasing' || u.role === 'admin' || u.role === 'receptionist'));
    });
  }, [orders]); // Refresh when orders or system refreshes

  const handleUpdateOrderMerchandiser = async (orderId: string, merchandiserName: string) => {
    try {
      const allOrders = await DbService.getOrders();
      const ordIdx = allOrders.findIndex(o => o.id === orderId);
      if (ordIdx > -1) {
        allOrders[ordIdx] = {
          ...allOrders[ordIdx],
          merchandiserName: merchandiserName || undefined
        };
        await DbService.saveOrder(allOrders[ordIdx], {
          id: currentUser.id,
          name: currentUser.username,
          role: currentUser.role
        });
        alert('修改所属跟单采购成功！');
      }
    } catch (e) {
      console.error(e);
      alert('更新所属跟单采购失败！');
    }
  };

  // State for direct replenish PO builder
  const [directSupplier, setDirectSupplier] = useState('');
  const [directOrderDate, setDirectOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [directRemarks, setDirectRemarks] = useState('采购自主建单(库存储备备货)');
  const [directItems, setDirectItems] = useState<{ productCode: string; productName: string; specs: string; quantity: number }[]>([
    { productCode: '', productName: '', specs: '', quantity: 1 }
  ]);
  const [isSubmittingDirect, setIsSubmittingDirect] = useState(false);

  const handleDirectItemProductChange = (idx: number, productCode: string) => {
    const matched = allProducts.find(p => p.productCode === productCode);
    const updated = [...directItems];
    if (matched) {
      updated[idx] = {
        productCode: matched.productCode,
        productName: matched.productName,
        specs: matched.specs,
        quantity: updated[idx].quantity
      };
      // If no supplier selected yet, auto-select product's default supplier
      if (!directSupplier && matched.defaultSupplier) {
        setDirectSupplier(matched.defaultSupplier);
      }
    } else {
      updated[idx] = {
        productCode: '',
        productName: '',
        specs: '',
        quantity: updated[idx].quantity
      };
    }
    setDirectItems(updated);
  };

  const handleDirectItemChange = (idx: number, field: string, value: any) => {
    const updated = [...directItems];
    updated[idx] = {
      ...updated[idx],
      [field]: value
    };
    setDirectItems(updated);
  };

  const handleAddDirectItemRow = () => {
    setDirectItems([...directItems, { productCode: '', productName: '', specs: '', quantity: 1 }]);
  };

  const handleRemoveDirectItemRow = (idx: number) => {
    if (directItems.length === 1) {
      alert('请保留至少一个采购产品项！');
      return;
    }
    setDirectItems(directItems.filter((_, i) => i !== idx));
  };

  const handleSubmitDirectPo = async () => {
    const trimmedSupplier = directSupplier.trim();
    if (!trimmedSupplier) {
      alert('请选择、指定或填写对接的供货商/生产厂名称！');
      return;
    }
    for (const [idx, item] of directItems.entries()) {
      if (!item.productCode.trim() || !item.productName.trim()) {
        alert(`第 ${idx + 1} 行商品信息未填完，商品编码与商品名称、规格均为必填。`);
        return;
      }
      if (item.quantity <= 0) {
        alert(`第 ${idx + 1} 行采购预约数量必须大于 0！`);
        return;
      }
    }

    setIsSubmittingDirect(true);
    try {
      await onCreateDirectPo(trimmedSupplier, directOrderDate, directRemarks, directItems);
      alert('备货采购合同新建完毕！系统已在后台同步建立好了对应的跟踪货行及条目，并直接跳转展示当前采购单的履约及提报控制页面。');
      // Reset form
      setDirectSupplier('');
      setDirectRemarks('采购自主建单(库存储备备货)');
      setDirectItems([{ productCode: '', productName: '', specs: '', quantity: 1 }]);
      setActiveSubTab('manage'); // automatically switch to contract control page
    } catch (err) {
      console.error(err);
      alert('采购合同建单发生错误，请稍后检查重试');
    } finally {
      setIsSubmittingDirect(false);
    }
  };
  
  // Selection for PO build
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [editingRemarkOrder, setEditingRemarkOrder] = useState<Order | null>(null);
  const [newRemarkText, setNewRemarkText] = useState('');
  const [poRemarks, setPoRemarks] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Warehouse extra replenishment buffer quantities (orderId -> additional stock amount)
  const [extraReplenishQty, setExtraReplenishQty] = useState<{ [orderId: string]: string }>({});

  const handleSaveRemarkEdit = async () => {
    if (!editingRemarkOrder) return;
    try {
      await DbService.updateOrderRemark(
        editingRemarkOrder.id,
        newRemarkText,
        { id: currentUser.id, name: currentUser.username, role: currentUser.role }
      );
      alert('跟单采购备注更改并流转通知成功！');
      setEditingRemarkOrder(null);
    } catch (e: any) {
      alert(e.message || '修改备注失败');
    }
  };

  const handleAuditDirectDispatch = async (orderId: string, approve: boolean) => {
    try {
      await DbService.auditDirectDispatch(
        orderId, 
        approve,
        { id: currentUser.id, name: currentUser.username, role: currentUser.role }
      );
      alert(approve ? '✅ 已成功核签并通过分店此次特定直接派发方案！' : '❌ 已成功会签并拒绝直发方案，改由库房结算和对账！');
    } catch (e: any) {
      alert(e.message || '会签决策写入异常');
    }
  };

  // Expanded PO in management tab for logging arrivals
  const [expandedPoId, setExpandedPoId] = useState<string | null>(null);
  
  // Arrival inputs state map: orderId -> receivedQty string
  const [arrivalInputs, setArrivalInputs] = useState<{ [orderId: string]: string }>({});

  // Factory submit inputs maps: poId -> expectedArrivalDate
  const [factoryArrivalDates, setFactoryArrivalDates] = useState<{ [poId: string]: string }>({});
  const [isSubmittingFactory, setIsSubmittingFactory] = useState<{ [poId: string]: boolean }>({});

  // Filters for build PO
  const pendingPurchaseItems = orders.filter(o => o.status === 'pending_purchase');

  // Filter pending purchase items by merchandiser selection
  const filteredPendingItems = pendingPurchaseItems.filter(o => {
    if (selectedMerchandiserFilter === 'all') return true;
    if (selectedMerchandiserFilter === 'unassigned') return !o.merchandiserName;
    return o.merchandiserName === selectedMerchandiserFilter;
  });

  // Supplier grouping for selection visual
  const groupedPurchaseItemsBySupplier: { [supplier: string]: Order[] } = {};
  for (const item of filteredPendingItems) {
    if (!groupedPurchaseItemsBySupplier[item.supplier]) {
      groupedPurchaseItemsBySupplier[item.supplier] = [];
    }
    groupedPurchaseItemsBySupplier[item.supplier].push(item);
  }

  // Handle PO Generation with pre-integrated Warehouse stock replenishment values
  const handleBuildPOs = async () => {
    if (selectedOrderIds.length === 0) {
      alert('请先勾选需要采购合并的分店款项');
      return;
    }

    setIsGenerating(true);
    try {
      // Fetch latest orders to avoid overwrites
      const allOrders = await DbService.getOrders();
      for (const orderId of selectedOrderIds) {
        const order = allOrders.find(o => o.id === orderId);
        if (order) {
          const extraStr = extraReplenishQty[orderId];
          const extraVal = parseInt(extraStr, 10);
          if (extraVal && extraVal > 0) {
            const origQty = order.quantity;
            order.quantity = origQty + extraVal;
            order.remark = `${order.remark || ''} (合并仓库补货: +${extraVal}件)`.trim();
            await DbService.saveOrder(order, {
              id: currentUser.id,
              name: currentUser.username,
              role: currentUser.role
            });
          }
        }
      }

      await onGeneratePos(selectedOrderIds, poRemarks);
      alert('采购核准并成功合并！系统已自动分厂商、合并仓库补货并生成了正式采购单。');
      setSelectedOrderIds([]);
      setPoRemarks('');
      setExtraReplenishQty({});
      setActiveSubTab('manage'); // Switch to manage view
    } catch (err) {
      console.error(err);
      alert('生成采购单失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBatchCancelOrders = async () => {
    if (selectedOrderIds.length === 0) {
      alert('请先勾选需要取消的分店订单款项');
      return;
    }
    const reason = window.prompt(`您正在批量注销/取消已选的 ${selectedOrderIds.length} 笔分店申领。因为产品问题或不要等，与厂里交涉确认好，在此备注清楚（必填）：`, '');
    if (reason === null) return;
    
    if (!reason.trim()) {
      alert('必须填写取消备注才可进行取消订单操作！');
      return;
    }

    if (!window.confirm(`确定要正式取消并废止这 ${selectedOrderIds.length} 笔分店订单吗？此操作不可逆，已被取消的订货条目将移交到“已作废/取消订单全档”另外存放。`)) {
      return;
    }

    try {
      setIsGenerating(true);
      for (const orderId of selectedOrderIds) {
        await DbService.cancelOrder(orderId, reason.trim(), {
          id: currentUser.id,
          name: currentUser.username,
          role: currentUser.role
        });
      }
      alert(`批量取消成功！已成功将这 ${selectedOrderIds.length} 笔提单撤销并安全转存至已作废全档中。`);
      setSelectedOrderIds([]);
    } catch (err: any) {
      console.error(err);
      alert('操作失败！' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSingleCancelOrder = async (orderId: string, orderNo: string, productName: string) => {
    const reason = window.prompt(`您确定要取消订单: ${orderNo} (${productName}) 吗？与厂家和分店交涉确认好，在此备注清楚（必填）：`, '');
    if (reason === null) return;
    if (!reason.trim()) {
      alert('必须填写取消备注才可撤销订单！');
      return;
    }
    if (window.confirm(`确认要将订单: ${orderNo} 彻底作废并移交另外存放吗？`)) {
      try {
        await DbService.cancelOrder(orderId, reason.trim(), {
          id: currentUser.id,
          name: currentUser.username,
          role: currentUser.role
        });
        alert('该笔订单已作废取消，已放入作废档案另外存放！');
        setSelectedOrderIds(prev => prev.filter(id => id !== orderId));
      } catch (err: any) {
        alert('撤销失败：' + err.message);
      }
    }
  };

  // Submit uniquely to a specific supplier (manufacturer-specific workflow)
  const handleBuildSupplierPO = async (supplierName: string, supplierEntries: Order[]) => {
    const groupSelectedIds = supplierEntries.map(o => o.id).filter(id => selectedOrderIds.includes(id));
    if (groupSelectedIds.length === 0) {
      alert(`请先在右侧列表中勾选需要向厂家 [${supplierName}] 提交下单的款项。`);
      return;
    }

    const confirmAction = window.confirm(`是否确定按照当前厂家的产品格式，将已勾选的 ${groupSelectedIds.length} 款货品分别汇总向厂家 [${supplierName}] 直接提交下单？`);
    if (!confirmAction) return;

    setIsGenerating(true);
    try {
      // Fetch latest orders to safely append warehouse replenishments
      const allOrders = await DbService.getOrders();
      for (const orderId of groupSelectedIds) {
        const order = allOrders.find(o => o.id === orderId);
        if (order) {
          const extraStr = extraReplenishQty[orderId];
          const extraVal = parseInt(extraStr, 10);
          if (extraVal && extraVal > 0) {
            const origQty = order.quantity;
            order.quantity = origQty + extraVal;
            order.remark = `${order.remark || ''} (厂家下单时合并备货补库: +${extraVal}件)`.trim();
            await DbService.saveOrder(order, {
              id: currentUser.id,
              name: currentUser.username,
              role: currentUser.role
            });
          }
        }
      }

      // Generate specifically for this supplier group
      await onGeneratePos(groupSelectedIds, `【专厂直下】供应商/分厂: ${supplierName}。备注：${poRemarks || '无'}`);
      alert(`🎉 厂家 [${supplierName}] 下单成功！采购单已单独打包生成。您可以切换到“采购单合约跟单控制台”下载厂家专用格式。`);
      
      // Clear out selections for this supplier group
      setSelectedOrderIds(selectedOrderIds.filter(id => !groupSelectedIds.includes(id)));
    } catch (err) {
      console.error(err);
      alert('专厂下单出错，请稍后重试');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectToggle = (id: string) => {
    if (selectedOrderIds.includes(id)) {
      setSelectedOrderIds(selectedOrderIds.filter(selectedId => selectedId !== id));
    } else {
      setSelectedOrderIds([...selectedOrderIds, id]);
    }
  };

  const handleSelectGroup = (supplierName: string) => {
    const groupIds = groupedPurchaseItemsBySupplier[supplierName].map(o => o.id);
    const areAllGroupSelected = groupIds.every(id => selectedOrderIds.includes(id));

    if (areAllGroupSelected) {
      // Remove all
      setSelectedOrderIds(selectedOrderIds.filter(id => !groupIds.includes(id)));
    } else {
      // Add missing ones
      const newSelections = Array.from(new Set([...selectedOrderIds, ...groupIds]));
      setSelectedOrderIds(newSelections);
    }
  };

  const selectAllPendingItems = () => {
    const allIds = pendingPurchaseItems.map(o => o.id);
    if (selectedOrderIds.length === allIds.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(allIds);
    }
  };

  // Submit to Factory action
  const handleSendToFactory = async (po: PurchaseOrder) => {
    const expectedArrival = factoryArrivalDates[po.id] || po.expectedArrivalDate || new Date(Date.now() + 5*24*60*60*1000).toISOString().slice(0, 10);
    
    setIsSubmittingFactory(prev => ({ ...prev, [po.id]: true }));
    try {
      await onSubmitToFactory(po.id, 'confirmed', expectedArrival);
      alert(`采购单 ${po.poNo} 已一键提报供货厂家成功！设定预计送达时期为: ${expectedArrival}`);
    } catch (err) {
      console.error(err);
      alert('操作失败');
    } finally {
      setIsSubmittingFactory(prev => ({ ...prev, [po.id]: false }));
    }
  };

  // Log Arrivals submit
  const handleLogPOArrivals = async (poId: string) => {
    const po = purchaseOrders.find(p => p.id === poId);
    if (!po) return;

    const itemsToLog: { orderId: string; receivedQty: number }[] = [];
    
    // gather current input quantities
    for (const orderId of po.orderIds) {
      const inputStr = arrivalInputs[orderId];
      if (inputStr !== undefined && inputStr.trim() !== '') {
        const qty = parseInt(inputStr, 10);
        if (isNaN(qty) || qty < 0) {
          alert('请在到货输入框内填写有效的到货数量');
          return;
        }
        if (qty > 0) {
          itemsToLog.push({ orderId, receivedQty: qty });
        }
      }
    }

    if (itemsToLog.length === 0) {
      alert('请输入至少一项产品的实际到货数量！');
      return;
    }

    try {
      await onLogArrival(poId, itemsToLog);
      alert('分店到货情况录入成功！系统已针对非足额的产品自动重算并挂钩厂家欠货报表。');
      // Clear inputs
      const clearedInputs = { ...arrivalInputs };
      itemsToLog.forEach(item => {
        clearedInputs[item.orderId] = '';
      });
      setArrivalInputs(clearedInputs);
      setExpandedPoId(null); // collapse
    } catch (err) {
      console.error(err);
      alert('到货录入异常，请重新提交');
    }
  };

  const handleQuickReorder = async (oldOrder: Order) => {
    const defaultQty = oldOrder.quantity;
    const confirmPrompt = `您确定要重新下单该商品吗？
[分店]: ${oldOrder.branchName}
[商品]: ${oldOrder.productName}
[规格]: ${oldOrder.specs}
[默认数量]: ${defaultQty} 件
[合作商]: ${oldOrder.supplier}

此操作将一键为此分店生成一笔一模一样的新订货项，并提交至前台审批。若需调整数量，请在输入框内填入新数量：`;

    const qtyVal = window.prompt(confirmPrompt, String(defaultQty));
    if (qtyVal === null) return;
    
    let targetQty = defaultQty;
    if (qtyVal.trim() !== '') {
      const parsed = parseInt(qtyVal, 10);
      if (isNaN(parsed) || parsed <= 0) {
        alert('请输入大于0的有效整数数量！');
        return;
      }
      targetQty = parsed;
    }

    try {
      setIsGenerating(true);
      const branchId = oldOrder.branchId || `branch_${oldOrder.branchName}`;
      
      await DbService.submitOrder(
        branchId,
        oldOrder.branchName,
        [{
          productCode: oldOrder.productCode,
          productName: oldOrder.productName,
          specs: oldOrder.specs,
          quantity: targetQty,
          supplier: oldOrder.supplier,
          orderType: oldOrder.orderType || 'conventional',
          remark: `【采购代下一键重订】复制自 ${oldOrder.orderNo}`,
          isUrgent: false
        }]
      );

      // Log the activity
      await DbService.log(
        currentUser.id,
        currentUser.username,
        currentUser.role,
        '采购代订货',
        `手动一键代【${oldOrder.branchName}】分店重新提报了订单项《${oldOrder.productName}》，数量: ${targetQty} 件。`
      );

      alert(`一键重新下单成功！新建意向订单已推送至前台审批池。`);
    } catch (err: any) {
      alert('重新下单失败: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // PO CSV Export helper
  const exportPoHeaders = [
    { key: 'poNo', label: '采购合同编号' },
    { key: 'supplier', label: '对接供应商' },
    { key: 'orderDate', label: '下单日期' },
    { key: 'status', label: '履约进度' },
    { key: 'totalQuantity', label: '整体采购件数' },
    { key: 'factoryStatus', label: '厂家状态' },
    { key: 'expectedArrivalDate', label: '预计入库到货期' },
    { key: 'remarks', label: '采购备注' }
  ];

  return (
    <div className="space-y-6">
      {/* Navigation subheader */}
      <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveSubTab('generate')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
            activeSubTab === 'generate' 
              ? 'bg-white text-slate-800 shadow-sm' 
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          待采购批量合并 ({pendingPurchaseItems.length}件)
        </button>
        <button
          onClick={() => setActiveSubTab('manage')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
            activeSubTab === 'manage' 
              ? 'bg-white text-slate-800 shadow-sm' 
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          正式采购合同管理 ({purchaseOrders.length}单)
        </button>
        <button
          onClick={() => setActiveSubTab('direct')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'direct' 
              ? 'bg-white text-slate-800 shadow-sm animate-pulse' 
              : 'text-slate-500 hover:text-slate-800'
          }`}
          title="无需分店提报，适用于总部仓库、常规库存储备或采购自主和厂家签单"
        >
          <PlusSquare className="w-3.5 h-3.5 text-blue-600" />
          <span>新增独立采购单 (如库存单)</span>
        </button>
        <button
          onClick={() => setActiveSubTab('cancelled')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'cancelled' 
              ? 'bg-white text-rose-800 shadow-sm' 
              : 'text-slate-500 hover:text-slate-800'
          }`}
          title="所有被作废、取消的分店订单与合约子项全档"
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
          <span>已作废订单全档 ({orders.filter(o => o.status === 'cancelled').length}件)</span>
        </button>
      </div>

      {activeSubTab === 'generate' && (
        <div className="space-y-6">
          {/* Branch comments notification banner for Purchasers */}
          {pendingPurchaseItems.filter(o => o.remark && (!o.remarkRole || o.remarkRole === 'branch')).length > 0 && (
            <div className="bg-purple-50 border border-purple-200 text-purple-950 p-4 rounded-xl space-y-2 text-xs animate-fadeIn">
              <div className="font-bold flex items-center gap-1.5 text-purple-800 text-[13px]">
                🚨 <span>分店最新特定备注及“厂家直发”申请提醒（采购专属会签专区）：</span>
              </div>
              <ul className="list-disc pl-5 space-y-1">
                {pendingPurchaseItems.filter(o => o.remark && (!o.remarkRole || o.remarkRole === 'branch')).map(o => {
                  const isDirect = ['直发', '厂家直发', '厂里直发', '工厂直发'].some(k => o.remark!.includes(k));
                  return (
                    <li key={o.id} className="leading-relaxed">
                      🏪 分店 <strong>[{o.branchName}]</strong> 针对货号 <code>{o.productCode}</code> 的货物 <strong>[{o.productName}]</strong> 提报了特定备注：
                      <span className="bg-purple-100 text-purple-900 border border-purple-300 font-bold px-1.5 py-0.5 rounded mx-1 italic">
                        "{o.remark}"
                      </span>
                      {isDirect && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 ml-1.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                          🏭 申请厂家直发
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Merchandiser Filter UI */}
          <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-800 block">👤 跟单采购筛查过滤</span>
              <span className="text-[10px] text-slate-400 block">各采购只跟进自己名下归属供应商的订单，可在此快速切换。（支持一键调单）。</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedMerchandiserFilter}
                onChange={e => setSelectedMerchandiserFilter(e.target.value)}
                className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">📁 显示全部跟单 (共 {pendingPurchaseItems.length} 件)</option>
                <option value="unassigned">🚨 暂无指派采购跟单 ({pendingPurchaseItems.filter(o => !o.merchandiserName).length} 件)</option>
                {Array.from(new Set(procurementStaff.map(u => u.username))).map(name => {
                  const count = pendingPurchaseItems.filter(o => o.merchandiserName === name).length;
                  return (
                    <option key={name} value={name}>
                      👤 仅看 {name} 的跟进件 ({count} 件)
                    </option>
                  );
                })}
              </select>
              <div className="bg-white px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 flex items-center gap-1">
                <span>当前筛选数:</span>
                <span className="text-blue-600 font-mono text-sm">{filteredPendingItems.length}</span>
                <span>/ {pendingPurchaseItems.length} 件</span>
              </div>
            </div>
          </div>

          {/* Supplier Grid list */}
          {pendingPurchaseItems.length === 0 ? (
            <div className="bg-white p-12 border border-slate-100 rounded-xl text-center text-slate-400 shadow-sm">
              <CheckCircle className="w-10 h-10 text-slate-300 mx-auto mb-2 shrink-0 stroke-[1.2]" />
              <p className="font-semibold text-slate-700 text-xs">当前暂无待采购流转的分店合并订单件！</p>
              <p className="text-[10px] text-slate-400 mt-1">
                前台最新的分店预约提报已被充分消化采购完毕。
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Build control card */}
              <div className="bg-white p-4 md:p-6 border border-slate-100 rounded-xl shadow-sm h-fit space-y-4 lg:col-span-1">
                <div className="flex items-center gap-2 text-blue-600">
                  <PlusSquare className="w-5 h-5" />
                  <h3 className="font-semibold text-slate-800 text-sm md:text-base">合并生成最终采购合同</h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  选择右侧列表中所需提报的订货单行。系统会自动按照商品所配置的<strong>【目标供应商/生产厂商】</strong>自动分解，在保存时打包生成格式标准化的独立采购单合约。
                </p>

                <div className="pt-2 border-t border-slate-50 space-y-4">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-slate-600">当前已勾选：</span>
                    <span className="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded font-mono">
                      {selectedOrderIds.length} 笔订单
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700">采购备注</label>
                    <textarea
                      placeholder="选填。例如：急件请核对批次或附注合同约定条款等"
                      value={poRemarks}
                      onChange={e => setPoRemarks(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 bg-slate-50 h-20 resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={selectAllPendingItems}
                        className="flex-1 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                      >
                        {selectedOrderIds.length === pendingPurchaseItems.length ? '取消全选' : '整单全选'}
                      </button>
                      <button
                        type="button"
                        onClick={handleBuildPOs}
                        disabled={selectedOrderIds.length === 0 || isGenerating}
                        className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer disabled:bg-blue-400 shadow-sm"
                      >
                        {isGenerating ? '正在生成...' : '立即生成采购合同'}
                      </button>
                    </div>

                    {selectedOrderIds.length > 0 && (
                      <button
                        type="button"
                        onClick={handleBatchCancelOrders}
                        className="w-full py-2 bg-rose-55 border border-rose-200 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 shadow-xs bg-rose-50/50"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                        <span>批量注销/取消已选 ({selectedOrderIds.length} 笔)</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Items directory grouped by supplier */}
              <div className="lg:col-span-2 space-y-5 text-xs text-left">
                {Object.entries(groupedPurchaseItemsBySupplier).map(([supplier, entries]) => {
                  const isGroupSelected = entries.every(o => selectedOrderIds.includes(o.id));
                  const selectedInGroup = entries.filter(o => selectedOrderIds.includes(o.id));
                  const uncheckedInGroup = entries.filter(o => !selectedOrderIds.includes(o.id));
                  
                  // Decide template aesthetics depending on the factory category to reflect: "不同厂家生产的产品是不同的，所以下单页面肯定也是不同的"
                  const getSupplierFactoryTemplate = (supplierName: string) => {
                    const norm = supplierName.toLowerCase();
                    if (norm.includes('五金') || norm.includes('铁') || norm.includes('金属') || norm.includes('塑胶') || norm.includes('模具')) {
                      return {
                        title: "🔩 重工高碳钢锻造及模具成型排产合同格式",
                        sub: "（适用于金属构件、钣金、塑胶模具等重工类制造分厂）",
                        cardBg: "border-slate-300 bg-gradient-to-br from-slate-50 to-slate-100/50",
                        headerBg: "bg-slate-700 text-slate-100",
                        badgeBg: "bg-slate-800 text-slate-100",
                        icon: "🔩"
                      };
                    } else if (norm.includes('电器') || norm.includes('电子') || norm.includes('灯') || norm.includes('线') || norm.includes('光电') || norm.includes('芯片')) {
                      return {
                        title: "🌐 精密光电集成及电子电器提料装配合同格式",
                        sub: "（适用于精密元器件、电子控制板、电线电缆类高新科技分厂）",
                        cardBg: "border-blue-200 bg-gradient-to-br from-blue-50/10 to-indigo-50/10",
                        headerBg: "bg-blue-800 text-blue-50",
                        badgeBg: "bg-blue-600 text-white",
                        icon: "⚡"
                      };
                    } else {
                      return {
                        title: "📦 工业装配大宗标准重载装载投产单格式",
                        sub: "（适用于通用机械结构、箱体包装件、综合精细装配传统制造分厂）",
                        cardBg: "border-indigo-200 bg-white",
                        headerBg: "bg-indigo-900 text-indigo-50",
                        badgeBg: "bg-indigo-600 text-white",
                        icon: "🏭"
                      };
                    }
                  };

                  const temp = getSupplierFactoryTemplate(supplier);

                  return (
                    <div 
                      key={supplier} 
                      className={`border rounded-xl shadow-md transition-shadow hover:shadow-lg overflow-hidden flex flex-col ${temp.cardBg}`}
                    >
                      {/* Customized Factory Header Band */}
                      <div className={`px-4 py-3 flex flex-wrap items-center justify-between gap-2 shadow-sm ${temp.headerBg}`}>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-black tracking-tight">{temp.icon} {supplier}</span>
                            <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 bg-white/15 text-white rounded">
                              {entries.length} 款待买
                            </span>
                          </div>
                          <p className="text-[10px] opacity-90 font-medium">
                            {temp.title} <span className="opacity-75">{temp.sub}</span>
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSelectGroup(supplier)}
                            className="bg-white/20 hover:bg-white/30 text-white font-extrabold px-2.5 py-1 rounded text-[10px] transition-colors cursor-pointer"
                          >
                            {isGroupSelected ? '❌ 取消该厂全选' : '✔️ 一键选中全厂'}
                          </button>
                        </div>
                      </div>

                      {/* Warnings & Advice Area to prevent missed orders */}
                      <div className="p-3 border-b border-dashed border-slate-100 bg-white space-y-2">
                        {uncheckedInGroup.length > 0 ? (
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-amber-900 text-[11px] font-bold">
                            <div className="flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 animate-bounce" />
                              <span>⚠️ [ 漏下单预警 ]：当前该厂家共有 <strong className="text-rose-600 text-xs font-mono">{uncheckedInGroup.length}</strong> 款分店提报的商品尚未勾选，未生成采购合同！</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const allGroupIds = entries.map(o => o.id);
                                setSelectedOrderIds(Array.from(new Set([...selectedOrderIds, ...allGroupIds])));
                              }}
                              className="sm:ml-auto underline text-blue-700 hover:text-blue-900 cursor-pointer font-extrabold flex items-center gap-0.5 whitespace-nowrap"
                            >
                              👉 点击一键全选该厂商品，避免漏单
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg text-emerald-800 text-[11px] font-bold">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>完美覆盖：该厂待派送的所有分店申领货项已被 <span className="bg-emerald-600 text-white font-mono rounded px-1 text-[9px] py-0.2">100% 勾选</span> 完毕，无采购遗漏隐患！</span>
                          </div>
                        )}

                        {/* Interactive Hint */}
                        <div className="text-[10px] text-slate-500 font-medium bg-slate-50 px-2.5 py-1.5 rounded border border-slate-150 flex items-center gap-1.5">
                          <span className="text-amber-500">💡</span>
                          <span><strong>下单补货协同机制：</strong> 提单前请核对仓库实物水位，可在下方输入 <strong>【指定增加仓库补货量】</strong>，系统会自动将分店提报需求量与仓库备货合并，一次性合并派单投产。</span>
                        </div>
                      </div>

                      {/* Supplier-Specific Main Grid */}
                      <div className="p-3 bg-white overflow-x-auto">
                        <table className="w-full text-left text-xs min-w-[700px]">
                          <thead>
                            <tr className="text-slate-400 border-b border-slate-50 text-[10px] font-bold">
                              <th className="py-1.5 w-10 text-center">状态</th>
                              <th className="py-1.5">申请分店</th>
                              <th className="py-1.5">申领商品明细</th>
                              <th className="py-1.5">规格/型号</th>
                              <th className="py-1.5 text-center bg-blue-50/30 text-blue-900 border-x border-slate-100">分店订单量</th>
                              <th className="py-1.5 text-center bg-amber-50/50 text-amber-900">📦 仓库库存确认 & 补货加注</th>
                              <th className="py-1.5 text-center bg-indigo-50 text-indigo-950 font-extrabold border-x border-slate-100">最终一键投产量</th>
                              <th className="py-1.5 text-center">指派跟单 (可一键调单)</th>
                              <th className="py-1.5 border-r border-slate-100">预约提单日期</th>
                              <th className="py-1.5 text-center w-16">单挑管理</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {entries.map(order => {
                              const isChecked = selectedOrderIds.includes(order.id);
                              
                              // Compute stable dynamic mock stock based on code hashing to reflect real stock check
                              const hash = order.productCode.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
                              const mockStock = (hash * 13) % 45; // Stable mock stockpile
                              const isStockLow = mockStock < 15;

                              const extraStr = extraReplenishQty[order.id] || '';
                              const extraVal = parseInt(extraStr, 10) || 0;
                              const finalTotalQty = order.quantity + extraVal;

                              return (
                                <tr 
                                  key={order.id} 
                                  onClick={() => handleSelectToggle(order.id)}
                                  className={`group transition-all ${
                                    isChecked 
                                      ? 'bg-blue-50/25 border-l-2 border-blue-600 font-medium' 
                                      : 'hover:bg-slate-50/30'
                                  }`}
                                >
                                  <td className="py-2.5 text-center" onClick={e => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      onClick={() => handleSelectToggle(order.id)}
                                      className="text-slate-400 hover:text-blue-600 transition-transform active:scale-95"
                                      title={isChecked ? '取消勾选' : '勾选此项加入投产单'}
                                    >
                                      {isChecked ? (
                                        <CheckSquare className="w-4 h-4 text-blue-600" />
                                      ) : (
                                        <Square className="w-4 h-4" />
                                      )}
                                    </button>
                                  </td>
                                  
                                  <td className="py-2.5 font-extrabold text-slate-800">
                                    <span className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-[10px]">
                                      {order.branchName}
                                    </span>
                                  </td>
                                  
                                  <td className="py-2.5">
                                    <span className="font-bold text-slate-900 block">{order.productName}</span>
                                    <span className="text-[10px] text-slate-400 font-mono block mt-0.5">编码: {order.productCode}</span>
                                    {order.isUrgent && (
                                      <span className="inline-block bg-rose-100 text-rose-700 text-[9px] px-1.5 py-0.5 rounded font-black border border-rose-200 animate-pulse mt-0.5">
                                        ⚡ 加急申报件
                                      </span>
                                    )}

                                    {/* Collaborative integrated remark visualization */}
                                    <div className="mt-1.5 flex flex-wrap gap-1 items-center" onClick={e => e.stopPropagation()}>
                                      {order.remark ? (
                                        <>
                                          {order.remarkRole === 'branch' && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                              🏪 【分店备注】: {order.remark}
                                            </span>
                                          )}
                                          {order.remarkRole === 'receptionist' && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                              🎨 【前台备注】: {order.remark}
                                            </span>
                                          )}
                                          {order.remarkRole === 'purchasing' && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 font-medium">
                                              🏭 【我的备注】: {order.remark}
                                            </span>
                                          )}
                                          {!order.remarkRole && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                              🏪 【分店备注】: {order.remark}
                                            </span>
                                          )}
                                        </>
                                      ) : (
                                        <span className="text-[10px] text-slate-400 font-normal italic">暂无留言备注</span>
                                      )}

                                      <button
                                        type="button"
                                        onClick={(ev) => {
                                          ev.stopPropagation();
                                          setEditingRemarkOrder(order);
                                          setNewRemarkText(order.remark || '');
                                        }}
                                        className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 text-[10px] font-semibold border border-blue-100 cursor-pointer"
                                        title="对订单核实、加购流转时增加文字标记"
                                      >
                                        📝 批注/修改备注
                                      </button>
                                    </div>

                                    {/* Special-product Factory Direct Dispatch Review and Status Flag */}
                                    {order.orderType === 'custom' && ['直发', '厂家直发', '厂里直发', '工厂直发'].some(k => (order.remark || '').includes(k)) && (
                                      <div className="mt-1.5 p-1.5 bg-purple-50 border border-purple-200 rounded-lg space-y-1 w-fit" onClick={e => e.stopPropagation()}>
                                        <div className="text-[9px] font-bold text-purple-700 flex items-center gap-1">
                                          <span>🔮 新品直发会签审核判决：</span>
                                          {!order.directDispatchApproved || order.directDispatchApproved === 'pending' ? (
                                            <span className="px-1 py-0.2 bg-purple-100 text-purple-800 rounded font-black animate-pulse">待决定</span>
                                          ) : order.directDispatchApproved === 'approved' ? (
                                            <span className="px-1 py-0.2 bg-emerald-100 text-emerald-800 rounded font-black">已通过</span>
                                          ) : (
                                            <span className="px-1 py-0.2 bg-rose-100 text-rose-800 rounded font-black">已否决</span>
                                          )}
                                        </div>
                                        {(!order.directDispatchApproved || order.directDispatchApproved === 'pending') && (
                                          <div className="flex gap-1">
                                            <button
                                              type="button"
                                              onClick={() => handleAuditDirectDispatch(order.id, true)}
                                              className="px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-extrabold rounded cursor-pointer"
                                            >
                                              同意直发
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleAuditDirectDispatch(order.id, false)}
                                              className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-extrabold rounded cursor-pointer"
                                            >
                                              否决(改走仓库)
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {order.directDispatchApproved === 'approved' && (
                                      <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded text-[10px] border border-emerald-250">
                                        🚀 采购已会签核准：同意该新品流转直发
                                      </div>
                                    )}

                                    {order.directDispatchApproved === 'rejected' && (
                                      <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 bg-rose-50 text-rose-700 font-bold rounded text-[10px] border border-rose-250">
                                        ❌ 采购已会签否决：拒绝直发设案 (改大货物配)
                                      </div>
                                    )}
                                  </td>
                                  
                                  <td className="py-2.5 text-slate-600 font-bold font-mono">{order.specs}</td>
                                  
                                  {/* Original Demand Qty */}
                                  <td className="py-2.5 text-center text-slate-800 font-black font-mono bg-blue-50/10 border-x border-slate-100">
                                    {order.quantity}
                                  </td>
                                  
                                  {/* Interactive Warehouse stock check & input replenishment buffer */}
                                  <td className="py-2.5 text-center bg-amber-50/10 space-y-1" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center justify-center gap-1">
                                      <span className={`w-1.5 h-1.5 rounded-full ${isStockLow ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`}></span>
                                      <span className={`text-[9px] font-extrabold ${isStockLow ? 'text-rose-600' : 'text-slate-500'}`} title="这是系统自适应抓取的实物库存余量">
                                        {isStockLow ? `🚨 仅剩 ${mockStock} 件 (促抓补)` : `库存充足 (${mockStock} 件)`}
                                      </span>
                                    </div>
                                    
                                    <div className="flex items-center justify-center gap-1 max-w-[120px] mx-auto">
                                      <span className="text-[9px] font-bold text-slate-400">一键补仓:</span>
                                      <input
                                        type="number"
                                        min="0"
                                        placeholder="+ 件数"
                                        value={extraStr}
                                        onChange={e => {
                                          const val = e.target.value;
                                          setExtraReplenishQty(prev => ({
                                            ...prev,
                                            [order.id]: val
                                          }));
                                        }}
                                        className="w-14 px-1 py-0.5 border border-amber-300 rounded text-center text-xs text-blue-600 font-extrabold font-mono bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        title="如果仓库需要补足货架或备存，请输入需要额外加购的数量"
                                      />
                                    </div>
                                  </td>

                                  {/* Realtime aggregations */}
                                  <td className="py-2.5 text-center bg-indigo-50/50 border-x border-slate-100">
                                    <span className="text-slate-800 font-mono font-medium text-[10px] block">
                                      {order.quantity} + {extraVal}
                                    </span>
                                    <strong className={`font-mono text-sm block mt-0.5 ${isChecked ? 'text-indigo-600 font-black' : 'text-slate-700'}`}>
                                      = {finalTotalQty} 件
                                    </strong>
                                  </td>

                                  {/* Merchandiser scheduler */}
                                  <td className="py-2.5 text-center" onClick={e => e.stopPropagation()}>
                                    <select
                                      value={order.merchandiserName || ''}
                                      onChange={e => handleUpdateOrderMerchandiser(order.id, e.target.value)}
                                      className="text-[10px] px-1.5 py-0.5 border border-slate-200 rounded text-slate-700 font-medium focus:outline-none bg-white font-semibold"
                                    >
                                      <option value="">-- 指派跟单 --</option>
                                      {procurementStaff.map(u => (
                                        <option key={u.id} value={u.username}>
                                          👤 {u.username}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  
                                  <td className="py-2.5 text-slate-450 font-mono text-[9px] border-r border-slate-100">
                                    {new Date(order.createdAt).toLocaleDateString()}
                                  </td>
                                  <td className="py-2.5 text-center align-middle" onClick={e => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      onClick={() => handleSingleCancelOrder(order.id, order.orderNo, order.productName)}
                                      className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded font-bold text-[10px] transition-colors cursor-pointer"
                                      title="个别退单/作废此项"
                                    >
                                      🚫 撤单
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Manufacturer specific direct confirmations actions */}
                      <div className="bg-slate-50 px-4 py-3 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
                        <div className="text-[10px] font-bold text-slate-500">
                          {selectedInGroup.length > 0 ? (
                            <span className="text-blue-700">
                              ℹ️ 本分厂当前已勾选 <strong>{selectedInGroup.length}</strong> 款进行投产排单 (包含补货，合计：
                              <strong>
                                {selectedInGroup.reduce((acc, order) => {
                                  const addOn = parseInt(extraReplenishQty[order.id], 10) || 0;
                                  return acc + order.quantity + addOn;
                                }, 0)}
                              </strong> 件)
                            </span>
                          ) : (
                            <span className="text-slate-400">⚠️ 未选择任何商品行，无法生成排产合同</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleBuildSupplierPO(supplier, entries)}
                            disabled={selectedInGroup.length === 0 || isGenerating}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] px-4 py-1.5 border-b border-indigo-800 rounded-lg shadow-sm transition-colors cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:border-none"
                            title="专厂直接生成采购排产单，无需汇总其他厂家"
                          >
                            🏭 分厂直下：确认向 [ {supplier} ] 派单投产
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'manage' && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 md:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-50">
            <div>
              <h3 className="font-semibold text-slate-800 text-sm md:text-base flex items-center gap-1.5">
                <Clipboard className="w-5 h-5 text-blue-500" />
                <span>采购合同履约跟踪</span>
              </h3>
              <p className="text-[10px] text-slate-400">进行一键推送厂家和实物到货跟踪，到货录入后欠货数据分时运算</p>
            </div>

            <ExportButton 
              data={purchaseOrders} 
              headers={exportPoHeaders} 
              fileName="正式采购合同清单" 
            />
          </div>

          {purchaseOrders.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <ShoppingBag className="w-10 h-10 stroke-[1.2] text-slate-300 mx-auto mb-2 shrink-0" />
              <span>当前暂未合并创制任何采购合同单</span>
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              {purchaseOrders.map(po => {
                const isExpanded = expandedPoId === po.id;
                
                // Get original orders within this PO to show
                const constituentOrders = orders.filter(o => po.orderIds.includes(o.id));
                const expectedArrivalDate = factoryArrivalDates[po.id] || po.expectedArrivalDate || new Date(Date.now() + 5*24*60*60*1000).toISOString().slice(0, 10);

                return (
                  <div 
                    key={po.id} 
                    className={`border border-slate-150 rounded-xl overflow-hidden transition-all duration-150 bg-white ${
                      isExpanded ? 'ring-1 ring-blue-500' : ''
                    }`}
                  >
                    {/* Header info */}
                    <div 
                      onClick={() => setExpandedPoId(isExpanded ? null : po.id)}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50"
                    >
                      <div className="flex flex-wrap items-center gap-2 md:gap-4">
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-xs md:text-sm">{po.poNo}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 font-mono">
                              {po.supplier}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1 font-mono">
                            下单时期: {po.orderDate} | 项数: {po.orderIds.length}款产品 | 总采购量: {po.totalQuantity}件
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                        {/* Status Track */}
                        <div className="text-right">
                          <div className="flex items-center gap-1.5 justify-end">
                            <span className={`w-2 h-2 rounded-full ${
                              po.status === 'completed' ? 'bg-green-500' : 'bg-amber-400 animate-pulse'
                            }`}></span>
                            <span className="font-semibold text-slate-800">
                              {po.status === 'completed' ? '已全部到齐' : '部分到货中'}
                            </span>
                          </div>
                          
                          {/* Factory status notification */}
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            厂家状态: <strong className={po.factoryStatus === 'confirmed' ? 'text-green-600' : 'text-amber-500'}>
                              {po.factoryStatus === 'confirmed' ? `已确认 (预计:${po.expectedArrivalDate})` : '待提报对接'}
                            </strong>
                          </div>
                        </div>

                        {/* Submit Factory triggers */}
                        {po.factoryStatus !== 'confirmed' ? (
                          <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 border border-slate-200 rounded-lg">
                            <input
                              type="date"
                              value={factoryArrivalDates[po.id] || expectedArrivalDate}
                              onChange={e => setFactoryArrivalDates({ ...factoryArrivalDates, [po.id]: e.target.value })}
                              className="px-1 py-0.5 bg-white border border-slate-100 rounded text-[10px]"
                              title="拟预计到货期"
                            />
                            <button
                              type="button"
                              onClick={() => handleSendToFactory(po)}
                              disabled={isSubmittingFactory[po.id]}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded text-[10px] flex items-center gap-1 cursor-pointer"
                            >
                              <Truck className="w-3 h-3" />
                              <span>一键提报厂家</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] bg-green-50 text-green-700 border border-green-150 font-bold px-2 py-1 rounded">
                            ✓ 厂家已建单确认
                          </span>
                        )}

                        {/* Dropdown toggle */}
                        <button 
                          onClick={() => setExpandedPoId(isExpanded ? null : po.id)}
                          className="p-1 text-slate-400 bg-slate-50 border border-slate-100 hover:text-slate-800 rounded-lg cursor-pointer"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* EXPANDED AREA FOR RECEIVING ARRIVALS */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/30 p-4 space-y-4 animate-fadeIn">
                        <div className="flex items-center gap-1 text-blue-700 font-bold">
                          <PackageCheck className="w-4 h-4" />
                          <span>一单式实物扫码到货登记</span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          当该品牌货厂配送到分仓或总库时，请在下表填写各分店预订款的实收到货件数。系统重算后会自动充抵其在订单里的申请量。当订单数量配足，状态自动流转为全部到齐。
                        </p>

                        <div className="overflow-x-auto border border-slate-50 rounded-lg bg-white">
                          <table className="w-full text-left font-sans text-xs">
                            <thead className="bg-slate-50 border-b border-slate-100">
                              <tr>
                                <th className="p-2 w-1/4">开订分店</th>
                                <th className="p-2 w-1/3">商品款项</th>
                                <th className="p-2 font-mono text-center w-20">预采购量</th>
                                <th className="p-2 font-mono text-center w-20">已收数量</th>
                                <th className="p-2 font-semibold text-rose-600 font-mono text-center w-20 bg-rose-50/10">当前欠货</th>
                                <th className="p-2 text-center w-32 font-bold text-blue-700">本次到货登录</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {constituentOrders.map(order => {
                                const received = order.receivedQty || 0;
                                const short = order.quantity - received;
                                return (
                                  <tr key={order.id} className="hover:bg-slate-50/30">
                                    <td className="p-2">
                                      <span className="font-bold text-slate-800 bg-slate-100 px-1.5 py-0.2 rounded">
                                        {order.branchName}
                                      </span>
                                    </td>
                                    <td className="p-2">
                                      <div className="font-medium text-slate-900">{order.productName}</div>
                                      <div className="text-[10px] text-slate-400 font-mono">货号:{order.productCode} Spec: {order.specs}</div>
                                    </td>
                                    <td className="p-2 text-center font-mono">{order.quantity}</td>
                                    <td className="p-2 text-center text-slate-600 font-mono">{received}</td>
                                    <td className="p-2 text-center bg-rose-50/50 font-bold text-rose-600 font-mono">
                                      {short <= 0 ? '0 (到齐)' : short}
                                    </td>
                                    <td className="p-2 text-center">
                                      {short <= 0 ? (
                                        <div className="flex flex-col sm:flex-row items-center gap-1.5 justify-center">
                                          <span className="text-[10px] text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full inline-block">已足额到货</span>
                                          <button
                                            type="button"
                                            onClick={() => handleQuickReorder(order)}
                                            className="px-2 py-0.5 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded text-[9.5px] cursor-pointer transition-colors"
                                            title="到货齐全：一键极速代原分店重新提购一次"
                                          >
                                            🔁 重新下单
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center justify-center gap-1.5">
                                          <input
                                            type="number"
                                            min="0"
                                            max={short}
                                            placeholder="到货量"
                                            value={arrivalInputs[order.id] || ''}
                                            onChange={e => setArrivalInputs({ 
                                              ...arrivalInputs, 
                                              [order.id]: e.target.value 
                                            })}
                                            className="w-20 px-2 py-1 border border-slate-200 rounded text-center text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                                          />
                                          <span className="text-[10px] text-slate-400">件</span>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <div className="flex justify-between items-center text-[10px] text-slate-400">
                          <div className="italic">
                            💡 提示：如有厂家多次分批零星到货，可针对未齐商品输入相应的到货量进行累加登记
                          </div>
                          <button
                            type="button"
                            onClick={() => handleLogPOArrivals(po.id)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs shadow-sm cursor-pointer"
                          >
                            保存到货实收登记
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'direct' && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 md:p-6 space-y-6">
          <div className="border-b border-slate-100 pb-3 flex flex-wrap justify-between items-center gap-3">
            <div>
              <h3 className="font-semibold text-slate-800 text-sm md:text-base flex items-center gap-1.5 flex-wrap">
                <PlusSquare className="w-4 h-4 text-blue-600" />
                <span>采购合同直属自建 (适用于库存储备/补给备机，无须门店申报)</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                不需要任何分店单独提交，由采购直接针对特定合作厂商自主开出采购订单。
              </p>
            </div>
            <div className="text-[10px] text-blue-700 bg-blue-50 px-2.5 py-1 rounded font-bold">
              ⚙️ 采购中心自主发单
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100 items-start md:items-center">
            <div className="space-y-1 text-left">
              <label className="text-[11px] font-bold text-slate-500">🏢 对接合作供应商 / 生产厂家 (必选)</label>
              <div className="flex gap-2">
                <select
                  value={directSupplier}
                  onChange={e => setDirectSupplier(e.target.value)}
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg outline-none text-slate-800 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- 选择已有签约厂商 (自动填充) --</option>
                  {suppliers.map(sup => (
                    <option key={sup.id} value={sup.name}>
                      {sup.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="或直接手填新厂商"
                  value={directSupplier}
                  onChange={e => setDirectSupplier(e.target.value)}
                  className="w-40 text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg outline-none text-slate-800 focus:ring-1 focus:ring-blue-500 placeholder-slate-400 font-medium"
                />
              </div>
            </div>

            <div className="space-y-1 text-left">
              <label className="text-[11px] font-bold text-slate-500">📅 采购签署/下定页面日期</label>
              <input
                type="date"
                value={directOrderDate}
                onChange={e => setDirectOrderDate(e.target.value)}
                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg outline-none text-slate-800 font-semibold focus:ring-1 focus:ring-blue-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1 text-left">
              <label className="text-[11px] font-bold text-slate-500">📝 常规自建单备注 / 备货方案</label>
              <input
                type="text"
                placeholder="例: 总部常规货品安全库存储备 / 下季度主打款建单"
                value={directRemarks}
                onChange={e => setDirectRemarks(e.target.value)}
                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg outline-none text-slate-800 focus:ring-1 focus:ring-blue-500 placeholder-slate-400"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <span>🛒 补货详单列表</span>
                <span className="text-[10px] text-slate-400 font-normal">（可选择自动拉入库内已核准的标准商品，亦可纯手动录入）</span>
              </h4>
              <button
                type="button"
                onClick={handleAddDirectItemRow}
                className="flex items-center gap-1 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-md text-xs font-bold transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>新增一栏货品款式</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left text-xs min-w-[750px]">
                <thead className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-500 tracking-wider font-bold">
                  <tr>
                    <th className="p-3 w-10 text-center">#</th>
                    <th className="p-3 w-1/4">从主库商品名录中智能拉入 (快捷推荐)</th>
                    <th className="p-3 w-1/5">产品编码 / 货号 (必填)</th>
                    <th className="p-3 w-1/4">商品展示全名称 (必填)</th>
                    <th className="p-3 w-1/6">规格属性 (必填)</th>
                    <th className="p-3 w-28 text-center text-blue-700 font-bold">订单采购量 (套/件)</th>
                    <th className="p-3 w-12 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {directItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-3 text-center text-slate-400 font-mono font-bold">{idx + 1}</td>
                      <td className="p-3">
                        <select
                          value={item.productCode}
                          onChange={e => handleDirectItemProductChange(idx, e.target.value)}
                          className="w-full text-xs p-1.5 bg-white border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                        >
                          <option value="">-- 手动录入 或 快捷适配推荐 --</option>
                          {allProducts.map(p => (
                            <option key={p.id} value={p.productCode}>
                              [{p.productCode}] {p.productName} ({p.specs}) - {p.defaultSupplier}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={item.productCode}
                          onChange={e => handleDirectItemChange(idx, 'productCode', e.target.value)}
                          placeholder="货品代码"
                          className="w-full p-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono text-xs text-slate-700"
                        />
                      </td>
                      <td className="p-3 font-semibold">
                        <input
                          type="text"
                          value={item.productName}
                          onChange={e => handleDirectItemChange(idx, 'productName', e.target.value)}
                          placeholder="例如: 飞利浦射灯"
                          className="w-full p-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none text-xs text-slate-800"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={item.specs}
                          onChange={e => handleDirectItemChange(idx, 'specs', e.target.value)}
                          placeholder="1.5米/金色"
                          className="w-full p-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none text-xs text-slate-700"
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={e => handleDirectItemChange(idx, 'quantity', parseInt(e.target.value) || 1)}
                            className="w-20 p-1.5 border border-slate-200 rounded-lg text-center text-xs font-bold font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                          />
                          <span className="text-slate-400 font-semibold text-[10px]">件</span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveDirectItemRow(idx)}
                          className="p-1 hover:bg-rose-50 text-rose-500 rounded-lg hover:text-rose-700 transition-colors cursor-pointer"
                          title="排除此货号"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-slate-100 pt-4 gap-3 text-xs">
            <div className="text-[11px] text-slate-500 text-left font-medium">
              💡 自备货下单规则：确认建单后，不需要门店发起申请或收银、前台初审。订单直接转入【正式合同名录】对厂家跟踪其配货、预期到货率与实物核收清点。
            </div>
            
            <button
              onClick={handleSubmitDirectPo}
              disabled={isSubmittingDirect}
              className="flex items-center justify-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer disabled:bg-slate-350 shrink-0"
            >
              {isSubmittingDirect ? '主库自主下定中...' : '⚡ 确认上述货品，建立直接采购单'}
            </button>
          </div>
        </div>
      )}

      {activeSubTab === 'cancelled' && (
        <div className="bg-white p-5 border border-slate-100 rounded-xl space-y-4 text-left shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-800 text-sm md:text-base flex items-center gap-2">
                <span className="p-1 bg-rose-50 text-rose-600 rounded">🚫</span>
                已取消/作废分店订单总档
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">记录分店提报中途因为产品交涉、不要了或其他售后原因，在各岗位核定驳回或废止的所有订单流转明细。</p>
            </div>
            <span className="bg-rose-50 text-rose-600 px-2.5 py-1 rounded text-xs font-bold font-mono border border-rose-100">
              作废废档共计: {orders.filter(o => o.status === 'cancelled').length} 笔款项
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left text-xs min-w-[800px]">
              <thead className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-500 font-bold uppercase">
                <tr>
                  <th className="p-3 w-10 text-center">#</th>
                  <th className="p-3">订单编号 / 提报时间</th>
                  <th className="p-3">提报分店</th>
                  <th className="p-3">主商品品名 / 货号</th>
                  <th className="p-3">规格属性 / 供应商</th>
                  <th className="p-3 text-center">提单原数量</th>
                  <th className="p-3">作废交涉备注说明</th>
                  <th className="p-3">取消经办人 / 时间</th>
                  <th className="p-3 text-center w-28">管理操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {orders.filter(o => o.status === 'cancelled').length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-slate-400 font-medium">
                      🎉 暂无任何被注销或作废的订单！
                    </td>
                  </tr>
                ) : (
                  orders.filter(o => o.status === 'cancelled').map((o, idx) => (
                    <tr key={o.id} className="hover:bg-slate-50/50">
                      <td className="p-3 text-center text-slate-400 font-mono font-medium">{idx + 1}</td>
                      <td className="p-3 leading-relaxed">
                        <span className="font-mono font-black block text-slate-800">{o.orderNo}</span>
                        <span className="text-[10px] text-slate-450 block">{new Date(o.createdAt).toLocaleString()}</span>
                      </td>
                      <td className="p-3 font-extrabold text-slate-800">
                        <span className="bg-slate-100 border px-2 py-0.5 rounded text-[10.5px]">
                          {o.branchName}
                        </span>
                      </td>
                      <td className="p-3">
                        <strong className="block text-slate-900">{o.productName}</strong>
                        <span className="text-[10px] text-slate-400 font-mono block">货号: {o.productCode}</span>
                      </td>
                      <td className="p-3 font-medium">
                        <span className="block text-slate-700">{o.specs}</span>
                        <span className="text-[10px] text-slate-400 block">合作供应商: {o.supplier}</span>
                      </td>
                      <td className="p-3 text-center font-bold text-slate-800 font-mono text-xs">{o.quantity} 件</td>
                      <td className="p-3 max-w-[200px] break-all text-[11px] bg-rose-50/20 text-rose-800 font-medium p-2 rounded border border-rose-100/50">
                        <p className="leading-relaxed font-bold">{o.cancelReason || '未备注说明'}</p>
                      </td>
                      <td className="p-3 leading-relaxed text-[11px] text-slate-500">
                        <div className="font-extrabold text-slate-700">
                          👤 {o.cancelledBy || '未知同仁'} 
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                          {o.cancelledAt ? new Date(o.cancelledAt).toLocaleString() : '未记录时间'}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleQuickReorder(o)}
                          className="px-2 py-1.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 font-bold rounded text-[10.5px] cursor-pointer transition-colors"
                          title="一键代此分店进行快速投产重新下单"
                        >
                          🔁 快速重订
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Editing remark modal */}
      {editingRemarkOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" style={{ margin:0 }}>
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-5 md:p-6 space-y-4 border border-slate-100 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm md:text-base flex items-center gap-1.5">
                📝 采购跟单流转备注修订
              </h3>
              <button 
                onClick={() => setEditingRemarkOrder(null)}
                className="p-1 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-3.5">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-150 text-[11px]">
                <div className="font-bold text-slate-800">货品：{editingRemarkOrder.productName}</div>
                <div className="text-slate-500 mt-1">单据单号：<span className="font-mono text-xs text-slate-700">{editingRemarkOrder.orderNo}</span></div>
                <div className="text-slate-500">提报分店：{editingRemarkOrder.branchName} | 规格型号：{editingRemarkOrder.specs}</div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500">
                  编辑要批注流转给前台和分店的备注详情：
                </label>
                <textarea
                  value={newRemarkText}
                  onChange={e => setNewRemarkText(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 focus:bg-white"
                  rows={3}
                  placeholder="补充跟单要求、排产状态或物流直配指引..."
                />
                <p className="text-[10px] text-slate-400">
                  💡 注意：如果是与直发相关的流转备注变更，新品需另外在上面点击“同意直发”通过会签决策！常规备件有货则无法直发。
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setEditingRemarkOrder(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-xl cursor-pointer duration-150 font-semibold"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveRemarkEdit}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl cursor-pointer font-bold duration-150 shadow-xs"
              >
                💾 确认保存并流转
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
