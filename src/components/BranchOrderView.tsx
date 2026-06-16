import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Send, 
  History, 
  AlertCircle, 
  Search, 
  CheckCircle, 
  FileText,
  Sliders,
  Clock,
  Sparkles,
  Zap,
  Ban,
  X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Order, PurchaseOrder, User, Product, Supplier } from '../types';
import { DbService } from '../lib/dbService';
import ExportButton from './ExportButton';

interface BranchOrderViewProps {
  orders: Order[];
  purchaseOrders: PurchaseOrder[];
  onAddOrders: (items: any[], submissionDate?: string) => Promise<void>;
  currentUser: User;
}

interface NewItemRow {
  productCode: string;
  productName: string;
  specs: string;
  quantity: number;
  supplier: string;
  orderType: 'conventional' | 'custom';
  remark: string;
  isUrgent?: boolean;
}

const DEFAULT_HISTORY_COLS = [
  { key: 'status', label: '处理进度' },
  { key: 'orderType', label: '下单类型' },
  { key: 'orderNo', label: '订单批次号' },
  { key: 'createdAt', label: '提报时间' },
  { key: 'productName', label: '商品基本信息' },
  { key: 'specs', label: '型号规格' },
  { key: 'quantity', label: '申领量' },
  { key: 'receivedQty', label: '实收到货' },
  { key: 'supplier', label: '供货商/厂家' },
];

export default function BranchOrderView({ orders, purchaseOrders = [], onAddOrders, currentUser }: BranchOrderViewProps) {
  const [activeTab, setActiveTab] = useState<'catalog' | 'draft' | 'history' | 'shortages' | 'permanent_cancelled' | 'cancelled_orders'>('catalog');
  
  // Selection state for draft list
  const [selectedDraftIndices, setSelectedDraftIndices] = useState<number[]>([]);
  
  // Tabular order builder rows
  const [orderRows, setOrderRows] = useState<NewItemRow[]>([
    { productCode: 'PROD-A01', productName: '九牧不锈钢暗装高档水龙头', specs: 'SS-901-HM', quantity: 10, supplier: '九牧卫浴制造厂', orderType: 'conventional', remark: '', isUrgent: false },
    { productCode: 'PROD-B05', productName: '飞利浦智能LED吸顶顶灯 50W', specs: 'PL-M50W-LED', quantity: 5, supplier: '飞利浦合肥照明厂', orderType: 'conventional', remark: '', isUrgent: false }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importText, setImportText] = useState('');
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [showSelfCheckOnly, setShowSelfCheckOnly] = useState(false);
  const [orderDate, setOrderDate] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });

  // Unique key states for One-Click Order Selection Generator
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogSupplierFilter, setCatalogSupplierFilter] = useState('all');
  const [selectedCatalogItems, setSelectedCatalogItems] = useState<{ [code: string]: boolean }>({});
  const [selectedCatalogQuantities, setSelectedCatalogQuantities] = useState<{ [code: string]: number }>({});

  // Cancel dialog options
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelTargetType, setCancelTargetType] = useState<'row' | 'order'>('row');
  const [cancelRowIdx, setCancelRowIdx] = useState<number | null>(null);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  
  // Joint close states
  const [showJointCloseDialog, setShowJointCloseDialog] = useState(false);
  const [jointCloseOrderId, setJointCloseOrderId] = useState<string | null>(null);

  // Remarks & Cross-Month Direct dispatch tracking states
  const [editingRemarkOrder, setEditingRemarkOrder] = useState<Order | null>(null);
  const [newRemarkText, setNewRemarkText] = useState('');
  const [showCrossMonthModal, setShowCrossMonthModal] = useState(false);
  const [dismissedCrossMonth, setDismissedCrossMonth] = useState(false);

  // States for Editing/Unblocking permanently cancelled items
  const [permCancelledProducts, setPermCancelledProducts] = useState<Product[]>([]);
  const [editPermProduct, setEditPermProduct] = useState<Product | null>(null);
  const [editPermReason, setEditPermReason] = useState('');

  // Load officially approved products
  const [officialProducts, setOfficialProducts] = useState<Product[]>([]);
  React.useEffect(() => {
    DbService.getProducts().then(prods => {
      // Filter only approved formal products
      const approved = prods.filter(p => p.isApproved);
      setOfficialProducts(approved);
      
      // Filter permanently cancelled items
      const cancelledList = prods.filter(p => p.isPermanentlyCancelled);
      setPermCancelledProducts(cancelledList);
    });
  }, [orders]); // Refresh products if orders change or system refreshes

  // Count branch urgent items submitted on the chosen orderDate
  const todayStr = orderDate;
  const myOrders = (currentUser.role === 'admin' ? orders : orders.filter(o => o.branchId === currentUser.id))
    .filter(o => !o.deletedConfirmedByBranch);

  const urgentOrdersToday = myOrders.filter(o => o.isUrgent && o.createdAt?.split(' ')[0] === todayStr);
  const urgentCountToday = urgentOrdersToday.length;
  const MAX_URGENT_DAILY = 3;

  const isCrossMonthOrder = (createdAt: string) => {
    if (!createdAt) return false;
    const datePart = createdAt.split(' ')[0];
    const parts = datePart.split('-');
    if (parts.length < 2) return false;
    const orderYear = parseInt(parts[0], 10);
    const orderMonth = parseInt(parts[1], 15); // Month parsing safe
    const orderMonthVal = parseInt(parts[1], 10);

    const now = new Date();
    const currYear = now.getFullYear();
    const currMonth = now.getMonth() + 1; // 1-12

    return orderYear < currYear || (orderYear === currYear && orderMonthVal < currMonth);
  };

  const crossMonthDirectOrders = React.useMemo(() => {
    return myOrders.filter(o => {
      const isDirect = ['直发', '厂家直发', '厂里直发', '工厂直发'].some(k => (o.remark || '').includes(k));
      const active = ['purchased', 'pending_purchase', 'rejected', 'pending_confirm'].includes(o.status);
      return isDirect && active && isCrossMonthOrder(o.createdAt);
    });
  }, [myOrders]);

  React.useEffect(() => {
    if (crossMonthDirectOrders.length > 0 && !dismissedCrossMonth && !showCrossMonthModal) {
      setShowCrossMonthModal(true);
    }
  }, [crossMonthDirectOrders, dismissedCrossMonth]);

  // Handles unblocking permanent cancel
  const handleRestorePermanentlyCancelled = async (prod: Product) => {
    if (!confirm(`确定要恢复商品 【${prod.productName}】 自动补货/提单安全警告吗？恢复后将并入正常交叉筛查中。`)) return;
    try {
      const updatedProd = { ...prod, isPermanentlyCancelled: false, permanentCancelReason: undefined, permanentCancelAt: undefined };
      await DbService.saveProduct(updatedProd, { id: currentUser.id, name: currentUser.username, role: currentUser.role });
      
      // Update local storage / state list if there's inventory match
      try {
        const invItems = await DbService.getInventory();
        const matchInv = invItems.find(i => i.productCode === prod.productCode);
        if (matchInv) {
          matchInv.isPermanentlyCancelled = false;
          matchInv.permanentCancelReason = undefined;
          matchInv.permanentCancelAt = undefined;
          await DbService.saveInventoryItem(matchInv, { id: currentUser.id, name: currentUser.username, role: currentUser.role });
        }
      } catch (ex) {}

      alert('商品正常状态已成功恢复！');
      // Trigger local state re-fetch
      DbService.getProducts().then(prods => {
        setOfficialProducts(prods.filter(p => p.isApproved));
        setPermCancelledProducts(prods.filter(p => p.isPermanentlyCancelled));
      });
    } catch (err: any) {
      alert('恢复失败：' + err.message);
    }
  };

  // Handles cross-month cancellation and remark modifications
  const handleCrossMonthCancelOrder = async (orderId: string) => {
    try {
      await DbService.requestDeleteOrder(
        orderId,
        '自动跨月监测：直发物料已收到，分店自主申请作废本订单，防范总部/工厂重复直发配送',
        { id: currentUser.id, name: currentUser.username, role: currentUser.role }
      );
      alert('已成功为跨月直发订单发起作废退单申请，工作流已递向前台确认，请耐心等待！');
    } catch (e: any) {
      alert('发起撤单失败：' + e.message);
    }
  };

  const handleSaveRemarkEdit = async () => {
    if (!editingRemarkOrder) return;
    try {
      await DbService.updateOrderRemark(
        editingRemarkOrder.id,
        newRemarkText,
        { id: currentUser.id, name: currentUser.username, role: currentUser.role }
      );
      alert('备注更新成功，已同步触发跨席位即时提醒机制（前台与采购可见）！');
      setEditingRemarkOrder(null);
    } catch (e: any) {
      alert(e.message || '更新备注出错');
    }
  };

  const handleSavePermEdit = async () => {
    if (!editPermProduct) return;
    try {
      const updated = { ...editPermProduct, permanentCancelReason: editPermReason };
      await DbService.saveProduct(updated, { id: currentUser.id, name: currentUser.username, role: currentUser.role });
      
      // Sync to inventory if matching
      try {
        const invItems = await DbService.getInventory();
        const matchInv = invItems.find(i => i.productCode === editPermProduct.productCode);
        if (matchInv) {
          matchInv.permanentCancelReason = editPermReason;
          await DbService.saveInventoryItem(matchInv, { id: currentUser.id, name: currentUser.username, role: currentUser.role });
        }
      } catch (e) {}

      alert('备注信息已成功更改！');
      setEditPermProduct(null);
      // Refresh
      DbService.getProducts().then(prods => {
        setOfficialProducts(prods.filter(p => p.isApproved));
        setPermCancelledProducts(prods.filter(p => p.isPermanentlyCancelled));
      });
    } catch (err: any) {
      alert('更新失败：' + err.message);
    }
  };

  // Columns dragging support
  const [historyCols, setHistoryCols] = useState(() => {
    const raw = localStorage.getItem(`cols_branch_history_${currentUser.id}`);
    if (raw) {
      try { return JSON.parse(raw); } catch (e) {}
    }
    return DEFAULT_HISTORY_COLS;
  });
  const [draggedColIdx, setDraggedColIdx] = useState<number | null>(null);

  const handleDragStart = (idx: number) => {
    setDraggedColIdx(idx);
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  const handleDrop = (targetIdx: number) => {
    if (draggedColIdx === null) return;
    const reordered = [...historyCols];
    const [draggedItem] = reordered.splice(draggedColIdx, 1);
    reordered.splice(targetIdx, 0, draggedItem);
    setHistoryCols(reordered);
    localStorage.setItem(`cols_branch_history_${currentUser.id}`, JSON.stringify(reordered));
    setDraggedColIdx(null);
  };
  const handleResetHistoryCols = () => {
    setHistoryCols(DEFAULT_HISTORY_COLS);
    localStorage.removeItem(`cols_branch_history_${currentUser.id}`);
  };

  // Filters for history
  const [historySearch, setHistorySearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [historyDateFilter, setHistoryDateFilter] = useState('');

  // Shortages (Current branch backlog where status is 'purchased' and receivedQty < quantity)
  const myShortages = myOrders.filter(o => {
    const received = o.receivedQty || 0;
    return o.status === 'purchased' && received < o.quantity;
  });

  const handleSelectAllDrafts = (check: boolean) => {
    if (check) {
      setSelectedDraftIndices(orderRows.map((_, idx) => idx));
    } else {
      setSelectedDraftIndices([]);
    }
  };

  const handleDeleteSelectedDrafts = () => {
    if (selectedDraftIndices.length === 0) {
      alert('请先勾选需要删除的草稿项！');
      return;
    }
    if (window.confirm(`确定要批量删除这已选的 ${selectedDraftIndices.length} 项货品草稿吗？`)) {
      const remaining = orderRows.filter((_, idx) => !selectedDraftIndices.includes(idx));
      setOrderRows(remaining);
      setSelectedDraftIndices([]);
    }
  };

  const handleAddFieldRow = () => {
    setOrderRows([
      ...orderRows,
      { productCode: '', productName: '', specs: '', quantity: 1, supplier: '', orderType: 'conventional', remark: '', isUrgent: false }
    ]);
  };

  const handleRemoveFieldRow = (idx: number) => {
    const row = orderRows[idx];
    handleOpenCancelOptions('row', idx, row.productCode);
  };

  const handleRowChange = (idx: number, field: keyof NewItemRow, value: any) => {
    const updated = [...orderRows];
    if (field === 'quantity') {
      const parsedVal = parseInt(value, 10);
      updated[idx][field] = isNaN(parsedVal) ? 0 : Math.max(1, parsedVal);
    } else {
      updated[idx][field] = value;
    }
    setOrderRows(updated);
  };

  // Custom trigger for cancel options (当下取消 vs 永久取消)
  const [tempCancelCode, setTempCancelCode] = useState('');
  const handleOpenCancelOptions = (type: 'row' | 'order', idOrIndex: any, code: string) => {
    setCancelTargetType(type);
    setTempCancelCode(code);
    if (type === 'row') {
      setCancelRowIdx(Number(idOrIndex));
    } else {
      setCancelOrderId(String(idOrIndex));
    }
    setShowCancelDialog(true);
  };

  const handleExecuteCancel = async (isPermanent: boolean, reasonText: string) => {
    try {
      const activeCode = tempCancelCode || '';
      
      // 1. Mark as permanently cancelled if selected
      if (isPermanent && activeCode) {
        // Query products and find matched product code to set flag
        const allProducts = await DbService.getProducts();
        const matched = allProducts.find(p => p.productCode.trim().toLowerCase() === activeCode.trim().toLowerCase());
        if (matched) {
          matched.isPermanentlyCancelled = true;
          matched.permanentCancelReason = reasonText || '分店业务手动申请永久下架/永久取消自动库存补货';
          matched.permanentCancelAt = new Date().toISOString();
          await DbService.saveProduct(matched, { id: currentUser.id, name: currentUser.username, role: currentUser.role });
        }

        // Also update HQ warehouse Inventory registry to avoid auto safe stock alerts
        const allInventory = await DbService.getInventory();
        const matchedInv = allInventory.find(i => i.productCode.trim().toLowerCase() === activeCode.trim().toLowerCase());
        if (matchedInv) {
          matchedInv.isPermanentlyCancelled = true;
          matchedInv.permanentCancelReason = reasonText || '分店业务手动申请永久取消';
          matchedInv.permanentCancelAt = new Date().toISOString();
          await DbService.saveInventoryItem(matchedInv, { id: currentUser.id, name: currentUser.username, role: currentUser.role });
        }
      }

      // 2. Perform the actual removal
      if (cancelTargetType === 'row') {
        if (cancelRowIdx !== null) {
          const updated = orderRows.filter((_, i) => i !== cancelRowIdx);
          setOrderRows(updated.length === 0 ? [{ productCode: '', productName: '', specs: '', quantity: 1, supplier: '', orderType: 'conventional', remark: '', isUrgent: false }] : updated);
          alert(isPermanent ? '已在录入行中移除，且成功将该货品在系统中标记为【永久取消安全库存自动告警】状态！' : '录入行已移除。');
        }
      } else if (cancelTargetType === 'order' && cancelOrderId) {
        // Cancel the actual order
        await DbService.deleteOrder(cancelOrderId, {
          id: currentUser.id,
          name: currentUser.username,
          role: currentUser.role
        });
        alert(isPermanent ? '该笔在轨订单已被硬撤销，并且系统中该货品已被标记为【永久取消自动警告】状态，不再在备货短平交叉表中展现！' : '订单撤单成功！');
      }

      // Refresh
      DbService.getProducts().then(prods => {
        setOfficialProducts(prods.filter(p => p.isApproved));
        setPermCancelledProducts(prods.filter(p => p.isPermanentlyCancelled));
      });
      setShowCancelDialog(false);
      setCancelRowIdx(null);
      setCancelOrderId(null);
      setTempCancelCode('');
    } catch (e: any) {
      alert('取消流程失败：' + e.message);
    }
  };

  const handleApplyJointClose = async (orderId: string, choice: 'supplied' | 'cancel', remark: string) => {
    try {
      const ordersList = await DbService.getOrders();
      const order = ordersList.find(o => o.id === orderId);
      if (!order) return;
      order.closeState = 'pending_close_confirm';
      order.closeInitiator = 'branch';
      order.closeReason = choice === 'supplied' ? 'supplied' : 'cancel';
      order.remark = `${order.remark || ''} [分店协同申请: ${choice === 'supplied' ? '商品已送足给齐，申请结单' : '客户不要了或退换，申请取消'}。备注: ${remark}]`.trim();
      await DbService.saveOrder(order, { id: currentUser.id, name: currentUser.username, role: currentUser.role });
      
      await DbService.log(
        currentUser.id, 
        currentUser.username, 
        currentUser.role, 
        '分店发起协同结单', 
        `分店针对订单 [${order.orderNo}] 提交了协同会签申请：${choice === 'supplied' ? '已经给齐/申请普通结单' : '不要了/申请异常作废'}`
      );
      
      alert('协同会签申请已成功提报！请知会总部前台/会签管理员进行双重结单判定确认。');
      setShowJointCloseDialog(false);
      setJointCloseOrderId(null);
    } catch (e: any) {
      alert('发生错误：' + e.message);
    }
  };

  const handleRestoreProduct = async (product: Product) => {
    if (!confirm(`您确定要撤销对商品 [${product.productName}] 的【永久取消】限制吗？\n撤销后该商品将重新纳入安全备货与常规订货提醒体系。`)) return;
    try {
      product.isPermanentlyCancelled = false;
      product.permanentCancelReason = '';
      product.permanentCancelAt = '';
      await DbService.saveProduct(product, { id: currentUser.id, name: currentUser.username, role: currentUser.role });

      // Also restore in Inventory if exists
      const allInventory = await DbService.getInventory();
      const matchedInv = allInventory.find(i => i.productCode.trim().toLowerCase() === product.productCode.trim().toLowerCase());
      if (matchedInv) {
        matchedInv.isPermanentlyCancelled = false;
        matchedInv.permanentCancelReason = '';
        matchedInv.permanentCancelAt = '';
        await DbService.saveInventoryItem(matchedInv, { id: currentUser.id, name: currentUser.username, role: currentUser.role });
      }

      // Refresh state
      const prods = await DbService.getProducts();
      setOfficialProducts(prods.filter(p => p.isApproved));
      setPermCancelledProducts(prods.filter(p => p.isPermanentlyCancelled));
      alert('已成功撤销并重新激活该产品的常规配额备货机制！');
    } catch (e: any) {
      alert('撤销失败：' + e.message);
    }
  };

  const handleUpdateCancelReason = async (product: Product, newReason: string) => {
    if (!newReason.trim()) {
      alert('备注说明不能为空！');
      return;
    }
    try {
      product.permanentCancelReason = newReason;
      await DbService.saveProduct(product, { id: currentUser.id, name: currentUser.username, role: currentUser.role });

      // Also update in Inventory
      const allInventory = await DbService.getInventory();
      const matchedInv = allInventory.find(i => i.productCode.trim().toLowerCase() === product.productCode.trim().toLowerCase());
      if (matchedInv) {
        matchedInv.permanentCancelReason = newReason;
        await DbService.saveInventoryItem(matchedInv, { id: currentUser.id, name: currentUser.username, role: currentUser.role });
      }

      const prods = await DbService.getProducts();
      setPermCancelledProducts(prods.filter(p => p.isPermanentlyCancelled));
      setEditPermProduct(null);
      alert('永久取消备注说明更新成功！');
    } catch (e: any) {
      alert('操作失败：' + e.message);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    // Standard delete is redirected to our comprehensive choice
    const ord = orders.find(o => o.id === orderId);
    handleOpenCancelOptions('order', orderId, ord ? ord.productCode : '');
  };

  const handleRequestAbnormalDelete = async (orderId: string) => {
    const ord = orders.find(o => o.id === orderId);
    handleOpenCancelOptions('order', orderId, ord ? ord.productCode : '');
  };

  const handleConfirmBranchDelete = async (orderId: string) => {
    if (!confirm('您确定已了解本订单之异常作废结论，并在该历史列表上点击清除吗？确认后将不再在我的订单中显示。')) return;
    try {
      await DbService.confirmBranchDelete(orderId, {
        id: currentUser.id,
        name: currentUser.username,
        role: currentUser.role
      });
      alert('删除记录清算成功！');
    } catch (e: any) {
      alert(e.message || '操作失败');
    }
  };

  const handleReorderProduct = async (order: Order) => {
    const isDirect = window.confirm(
      `您确定要重新下单商品：${order.productName} 吗？\n\n` +
      `【确定】：直接以一模一样的参数，极速重新向总部提交并生成新订单！\n` +
      `【取消】：将该项详情导入到顶部的【待报审订单草稿箱】，您可以修改数量/规格后再提交。`
    );

    if (isDirect) {
      const defaultQty = order.quantity;
      const qtyStr = window.prompt(`请确认重新订货数量（留空将代表默认数量 ${defaultQty} 件）：`, String(defaultQty));
      if (qtyStr === null) return;

      let targetQty = defaultQty;
      if (qtyStr.trim() !== '') {
        const parsed = parseInt(qtyStr, 10);
        if (isNaN(parsed) || parsed <= 0) {
          alert('数量必须为大于0的有效整数！');
          return;
        }
        targetQty = parsed;
      }

      setIsSubmitting(true);
      try {
        await onAddOrders([
          {
            productCode: order.productCode,
            productName: order.productName,
            specs: order.specs,
            quantity: targetQty,
            supplier: order.supplier,
            orderType: order.orderType || 'conventional',
            remark: `【一键重订】复制自 ${order.orderNo}`,
            isUrgent: false
          }
        ]);
        alert('极速重新提单成功！已直接推送至总部前台审批。');
      } catch (err: any) {
        alert('提报失败：' + err.message);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setOrderRows([
        ...orderRows.filter(r => r.productCode !== ''),
        {
          productCode: order.productCode,
          productName: order.productName,
          specs: order.specs,
          quantity: order.quantity,
          supplier: order.supplier,
          orderType: order.orderType || 'conventional',
          remark: `【重订草稿】复制自 ${order.orderNo}`,
          isUrgent: false
        }
      ]);
      setActiveTab('draft');
      alert(`已成功复制到【待报审订单草稿箱】！已为您自动切回草稿箱页面，请在表格中检查并提报。`);
    }
  };

  const handleEditRejectedOrder = async (order: Order) => {
    if (!confirm('“编辑重报”会把该项详情复制到顶部的【订货表格】进行修改重提。是否继续？')) return;
    try {
      // Add to active set
      setOrderRows([
        ...orderRows.filter(r => r.productCode !== ''), // clean empty placeholder rows
        {
          productCode: order.productCode,
          productName: order.productName,
          specs: order.specs,
          quantity: order.quantity,
          supplier: order.supplier,
          orderType: order.orderType || 'conventional',
          remark: order.remark || '',
          isUrgent: order.isUrgent || false
        }
      ]);
      
      // Also delete the rejected item so we don't have duplicates
      await DbService.deleteOrder(order.id, {
        id: currentUser.id,
        name: currentUser.username,
        role: currentUser.role
      });

      setActiveTab('draft');
      alert('已成功将驳回项载入到订单中！请在上方表格中调整并重新确认推送审核。');
    } catch (e: any) {
      alert(e.message || '操作失败');
    }
  };

  const handleSubmitOrderBatch = async () => {
    // Validations
    let pendingUrgentCount = 0;
    for (const [idx, item] of orderRows.entries()) {
      if (!item.productCode.trim() || !item.productName.trim() || !item.specs.trim()) {
        alert(`第 ${idx + 1} 行信息未填完，请完善必填参数。`);
        return;
      }
      if (item.quantity <= 0) {
        alert(`第 ${idx + 1} 行数量必须大于 0`);
        return;
      }
      if (item.orderType === 'custom' && !item.remark.trim()) {
        alert(`第 ${idx + 1} 行为非常规新品申购，必须强制填写行备注（如客户特定需求、大户订单预订来源等）。`);
        return;
      }
      if (item.isUrgent) {
        pendingUrgentCount++;
      }
    }

    // Verify Urgent Limit daily quota
    if (urgentCountToday + pendingUrgentCount > MAX_URGENT_DAILY) {
      alert(`⚠️ 无法提交：当前设定的加急申报超出了每日限额！\n\n- 今日已成功申报：${urgentCountToday} 笔加急订单\n- 本单拟申请计入：${pendingUrgentCount} 笔加急订单\n- 每日最大限额：${MAX_URGENT_DAILY} 笔/分店\n\n为了保障后勤履约平衡，不可能每张补货单都写‘急’，请取消多余选项后再呈报！`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddOrders(orderRows, orderDate);
      alert('订单提报成功！已推送至收银/前台管理员处进行审批。');
      // Reset
      setOrderRows([{ productCode: '', productName: '', specs: '', quantity: 1, supplier: '', orderType: 'conventional', remark: '', isUrgent: false }]);
      setActiveTab('history');
    } catch (err) {
      console.error(err);
      alert('提报失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleParseImport = (text: string) => {
    if (!text.trim()) {
      alert('请先输入或者粘贴要导入的订货数据！');
      return;
    }
    const lines = text.split('\n');
    const newImportedRows: NewItemRow[] = [];
    let parsedCount = 0;
    
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      
      // Filter out typical header rows
      if (
        line.includes('商品编码') || 
        line.includes('商品名称') || 
        line.includes('规格型号') || 
        line.includes('CODE') || 
        line.includes('Code') || 
        line.includes('编码')
      ) {
        continue;
      }
      
      // Auto split columns: supports tab, commas, semicolons, or vertical bar
      const parts = line.split(/[,\t;|，；｜]/).map(p => p.trim());
      if (parts.length < 3) continue; // Needs at least productCode, productName, specs/quantity
      
      const code = parts[0] || '';
      const name = parts[1] || '导入未定名产品';
      const specs = parts[2] || '普规';
      const qtyStr = parts[3] || '1';
      const quantity = parseInt(qtyStr, 10) || 1;
      const supplier = parts[4] || '';
      const remark = parts[5] || '';
      
      // Search matching official goods to fill values
      const matched = officialProducts.find(
        p => p.productCode.trim().toLowerCase() === code.trim().toLowerCase()
      );
      
      if (matched) {
        newImportedRows.push({
          productCode: matched.productCode,
          productName: matched.productName,
          specs: matched.specs,
          quantity: Math.max(1, quantity),
          supplier: matched.defaultSupplier || '系统自提厂商',
          orderType: 'conventional',
          remark: remark || '文字快速导入'
        });
      } else {
        newImportedRows.push({
          productCode: code ? code.toUpperCase() : 'NEW-PROD',
          productName: name,
          specs: specs,
          quantity: Math.max(1, quantity),
          supplier: supplier || '随单指定厂商',
          orderType: 'custom',
          remark: remark || '⚠️新品/未提交过 (请在此处补充说明新品详情需求)'
        });
      }
      parsedCount++;
    }
    
    if (newImportedRows.length === 0) {
      alert('未识别到有效的多行数据，请检测是否按：[商品编码,商品名称,规格型号,订货数量] 顺序排列，由逗号/空格或Tab分隔。');
      return;
    }
    
    // Replace current list if only empty row exists, otherwise append
    const isOnlyEmptyRowRow = orderRows.length === 1 && orderRows[0].productCode === '';
    if (isOnlyEmptyRowRow) {
      setOrderRows(newImportedRows);
    } else {
      setOrderRows([...orderRows, ...newImportedRows]);
    }
    setImportText('');
    setShowImportPanel(false);
    alert(`成功从粘贴文本中识别录入 ${parsedCount} 款订货项目！已悉数加载合并到下方表格中，商品库不存在的项已自动标记为“非常规新品”。`);
  };

  const downloadOrderTemplate = () => {
    try {
      const data = [
        ["商品编码", "商品名称", "规格型号", "订货数量", "首选供应商/厂家", "单行详细备注 / 定制需求说明"],
        ["PROD-A01", "九牧不锈钢暗装高档水龙头", "SS-901-HM", 15, "九牧卫浴制造厂", "一楼男洗手间损坏更换"],
        ["PROD-B05", "飞利浦智能LED吸顶灯 50W", "PL-M50W-LED", 25, "飞利浦合肥照明厂", "二层前厅天花板吊顶替换"],
        ["NEW-TEM-88", "合金防盗特种防爆挂锁", "LT-88MM-HIGH-SECURITY", 5, "温州特种锁厂", "⚠️非标新品：材质需要全钢，钥匙配4把"]
      ];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(data);
      
      ws['!cols'] = [
        { wch: 20 },
        { wch: 32 },
        { wch: 26 },
        { wch: 12 },
        { wch: 28 },
        { wch: 48 }
      ];

      XLSX.utils.book_append_sheet(wb, ws, "分店批量订货提报表");
      XLSX.writeFile(wb, "分店批量订货提报标准模板.xlsx");
    } catch (e: any) {
      alert("下载订单模板失败：" + e.message);
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        const newImportedRows: NewItemRow[] = [];
        let headerSkipped = false;
        let parsedCount = 0;

        for (const row of rawJson) {
          if (!Array.isArray(row) || row.length === 0) continue;
          
          const col0Str = String(row[0] || '').trim();
          if (
            !headerSkipped &&
            (col0Str.includes('商品编码') ||
              col0Str.includes('产品编码') ||
              col0Str.includes('CODE') ||
              col0Str.includes('Code') ||
              col0Str.includes('代码') ||
              col0Str.includes('编码'))
          ) {
            headerSkipped = true;
            continue;
          }

          const code = String(row[0] || '').trim();
          const name = String(row[1] || '').trim();
          const specs = String(row[2] || '').trim();
          const qtyVal = parseInt(String(row[3] || '1'), 10) || 1;
          const supplier = String(row[4] || '').trim();
          const remark = String(row[6] || row[5] || '').trim();

          if (!code && !name) continue;

          const matched = officialProducts.find(
            p => p.productCode.trim().toLowerCase() === code.trim().toLowerCase()
          );

          if (matched) {
            newImportedRows.push({
              productCode: matched.productCode,
              productName: matched.productName,
              specs: matched.specs,
              quantity: Math.max(1, qtyVal),
              supplier: matched.defaultSupplier || '系统自提厂商',
              orderType: 'conventional',
              remark: remark || 'Excel文件导入'
            });
          } else {
            newImportedRows.push({
              productCode: code ? code.toUpperCase() : 'NEW-' + Math.floor(1000 + Math.random() * 9000),
              productName: name || '新品自填货项',
              specs: specs || '普规规格',
              quantity: Math.max(1, qtyVal),
              supplier: supplier || '随单指定厂商',
              orderType: 'custom',
              remark: remark || '⚠️新品/未提交过 (请分店核实补充此处的详细备注)'
            });
          }
          parsedCount++;
        }

        if (newImportedRows.length === 0) {
          alert('未能从选择的文件中提取到可读的行属性（格式要求商品编码作为第一列）');
          return;
        }

        const isOnlyEmptyRowRow = orderRows.length === 1 && orderRows[0].productCode === '';
        if (isOnlyEmptyRowRow) {
          setOrderRows(newImportedRows);
        } else {
          setOrderRows([...orderRows, ...newImportedRows]);
        }
        setShowImportPanel(false);
        alert(`一键文件导入成功！已高效读取 ${parsedCount} 笔数据至表格，系统比对不符的行已被自动识别为新品，已标亮橙色标记以引导分店自主备注。`);
      } catch (err) {
        console.error(err);
        alert('解析 Excel 或 CSV 发生错误，请确认数据排布与表头格式正常。');
      }
    };
    reader.readAsBinaryString(file);
    // Reset file input value
    e.target.value = '';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_confirm':
        return <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-100">待前台确认</span>;
      case 'pending_purchase':
        return <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-100">待采购汇总</span>;
      case 'purchased':
        return <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-100">厂家生产派送中</span>;
      case 'completed':
        return <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-green-50 text-green-700 border border-green-100">全部到齐</span>;
      case 'rejected':
        return <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-100">已被前台驳回</span>;
    }
  };

  const filteredHistory = myOrders.filter(o => {
    const sMatch = statusFilter === 'all' || o.status === statusFilter;
    const qMatch = o.productName.toLowerCase().includes(historySearch.toLowerCase()) || 
                   o.productCode.toLowerCase().includes(historySearch.toLowerCase()) ||
                   o.orderNo.toLowerCase().includes(historySearch.toLowerCase());
    return sMatch && qMatch;
  });

  // History Headers for CSV export
  const exportHeaders = [
    { key: 'orderNo', label: '订单号' },
    { key: 'createdAt', label: '提报时间' },
    { key: 'productCode', label: '商品编码' },
    { key: 'productName', label: '商品名称' },
    { key: 'specs', label: '规格/型号' },
    { key: 'quantity', label: '开单数量' },
    { key: 'receivedQty', label: '到货数量' },
    { key: 'supplier', label: '指定厂商' },
    { key: 'status', label: '状态' }
  ];

  const exportShortageHeaders = [
    { key: 'orderNo', label: '关联订单号' },
    { key: 'productCode', label: '商品编码' },
    { key: 'productName', label: '商品名称' },
    { key: 'specs', label: '规格型号' },
    { key: 'quantity', label: '订货量' },
    { key: 'receivedQty', label: '实收量' },
    { key: 'supplier', label: '供货商' }
  ];

  return (
    <div className="space-y-6">
      {/* Prominent Global Date Badge */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white rounded-2xl p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none font-mono text-7xl font-black">
          {new Date().toISOString().slice(0, 10).replace(/-/g, '/')}
        </div>
        <div className="space-y-1 z-10">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-450 text-slate-400">核对日期 · 本地分店提单管控中心</div>
          <h2 className="text-lg md:text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
            🏪 {currentUser.branchName || currentUser.username} · 在轨订单管理端
          </h2>
          <p className="text-xs text-slate-300">
            规范申报基准日：<strong className="text-blue-300 font-semibold">{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</strong>
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 z-10">
          <div className="px-3 py-1.5 bg-white/5 rounded-xl border border-white/10 text-xs flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>下单归档基准时间：<strong className="text-blue-300 font-mono">{new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</strong></span>
          </div>
          <div className="px-3 py-1.5 bg-rose-500/10 rounded-xl border border-rose-500/15 text-xs text-rose-350 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-rose-450 text-rose-400 animate-bounce" />
            <span>加急货申报配额：<strong className="font-mono text-rose-400">{urgentCountToday} / {MAX_URGENT_DAILY}</strong> (限额)</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2 gap-3">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap space-x-1 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeTab === 'catalog' 
                ? 'bg-white text-slate-800 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            ✨ 一键智能选品下单
          </button>

          <button
            onClick={() => setActiveTab('draft')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer relative ${
              activeTab === 'draft' 
                ? 'bg-white text-slate-800 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            📋 待报审订单草稿箱
            {orderRows.length > 0 && !(orderRows.length === 1 && orderRows[0].productCode === '') && (
              <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white font-mono text-[9px] w-4.5 h-4.5 flex items-center justify-center rounded-full">
                {orderRows.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeTab === 'history' 
                ? 'bg-white text-slate-800 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            历史提报记录
          </button>

          <button
            onClick={() => setActiveTab('shortages')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer relative ${
              activeTab === 'shortages' 
                ? 'bg-white text-slate-800 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            本店欠货一览
            {myShortages.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-mono text-[9px] w-4.5 h-4.5 flex items-center justify-center rounded-full">
                {myShortages.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('permanent_cancelled')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer relative ${
              activeTab === 'permanent_cancelled' 
                ? 'bg-white text-slate-800 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            🚫 永久下架物料
            {permCancelledProducts.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-slate-500 text-white font-mono text-[9px] px-1 h-4.5 flex items-center justify-center rounded-full">
                {permCancelledProducts.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('cancelled_orders')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer relative ${
              activeTab === 'cancelled_orders' 
                ? 'bg-white text-slate-800 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            📂 已作废/取消订单 ({orders.filter(o => o.status === 'cancelled' && (currentUser.role === 'admin' || currentUser.role === 'purchasing' || currentUser.role === 'receptionist' || o.branchName === currentUser.branchName)).length}笔)
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(activeTab === 'catalog' || activeTab === 'draft') && (
            <div className="text-xs text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 shadow-xs">
              <span className="font-semibold text-slate-500">📅 归档下单日期调整:</span>
              <input
                id="branch-order-date-picker"
                type="date"
                value={orderDate}
                onChange={e => setOrderDate(e.target.value)}
                className="px-1.5 py-0.5 border border-slate-350 rounded font-semibold bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer text-xs"
                title="选择/调整该批次申领订单的创建基准日期"
              />
            </div>
          )}
        </div>
      </div>

      {activeTab === 'catalog' && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 md:p-6 space-y-6 text-left">
          {/* One-Click Product Selection & Order Generator Panel */}
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 md:p-5 space-y-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <span className="p-1 bg-blue-100 text-blue-600 rounded-md">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  </span>
                  官方商品一键选品池 · 自助勾选一件生成订单草稿
                </h4>
                <p className="text-[10px] text-slate-500 mt-1">
                  💡 直接勾选需要的官方正式商品，输入数量，即可【一件生成下方的订货草稿】，无需繁琐的手写编码或人工导入！
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="搜索名称 / 编码"
                  value={catalogSearch}
                  onChange={e => setCatalogSearch(e.target.value)}
                  className="px-2.5 py-1 border border-slate-200 rounded-lg text-xs w-36 bg-white outline-none focus:ring-1 focus:ring-blue-500"
                />
                <select
                  value={catalogSupplierFilter}
                  onChange={e => setCatalogSupplierFilter(e.target.value)}
                  className="px-2 py-1 border border-slate-200 rounded-lg text-xs bg-white outline-none cursor-pointer text-slate-700"
                >
                  <option value="all">所有供货厂商</option>
                  {Array.from(new Set(officialProducts.map(p => p.defaultSupplier).filter(Boolean))).map(sup => (
                    <option key={sup} value={sup}>{sup}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto border border-slate-150 rounded-lg bg-white shadow-2xs">
              <table className="w-full text-left text-xs text-slate-600 min-w-[500px]">
                <thead className="bg-slate-50 border-b border-slate-150 sticky top-0 z-10 text-slate-700">
                  <tr>
                    <th className="p-2.5 w-10 text-center">选择</th>
                    <th className="p-2.5">商品名称 / 货号编码</th>
                    <th className="p-2.5">规格型号</th>
                    <th className="p-2.5 text-center w-28">指定数量</th>
                    <th className="p-2.5">所属默认供货厂家</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-105 divide-slate-100">
                  {officialProducts
                    .filter(p => !p.isPermanentlyCancelled)
                    .filter(p => {
                      const sMatch = p.productName.toLowerCase().includes(catalogSearch.toLowerCase()) || 
                                     p.productCode.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                                     p.specs.toLowerCase().includes(catalogSearch.toLowerCase());
                      const fMatch = catalogSupplierFilter === 'all' || p.defaultSupplier === catalogSupplierFilter;
                      return sMatch && fMatch;
                    })
                    .map(p => {
                      const isChecked = !!selectedCatalogItems[p.productCode];
                      const qty = selectedCatalogQuantities[p.productCode] || 10;
                      return (
                        <tr 
                          key={p.productCode} 
                          className={`hover:bg-blue-50/20 duration-100 transition-colors ${isChecked ? 'bg-blue-50/20' : ''}`}
                        >
                          <td className="p-2 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                setSelectedCatalogItems({
                                  ...selectedCatalogItems,
                                  [p.productCode]: e.target.checked
                                });
                                if (!selectedCatalogQuantities[p.productCode]) {
                                  setSelectedCatalogQuantities({
                                    ...selectedCatalogQuantities,
                                    [p.productCode]: 10
                                  });
                                }
                              }}
                              className="w-4 h-4 text-blue-600 focus:ring-blue-500 rounded cursor-pointer"
                            />
                          </td>
                          <td className="p-2">
                            <div className="font-semibold text-slate-800">{p.productName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">CODE: {p.productCode}</div>
                          </td>
                          <td className="p-2 font-semibold text-slate-500">{p.specs}</td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              min="1"
                              value={qty}
                              disabled={!isChecked}
                              onChange={e => {
                                const v = parseInt(e.target.value, 10);
                                setSelectedCatalogQuantities({
                                  ...selectedCatalogQuantities,
                                  [p.productCode]: isNaN(v) ? 1 : Math.max(1, v)
                                });
                              }}
                              className="w-20 px-2 py-0.5 border border-slate-200 rounded text-center text-xs font-bold font-mono disabled:bg-slate-50 shadow-xs"
                            />
                          </td>
                          <td className="p-2 text-slate-500 font-semibold">{p.defaultSupplier}</td>
                        </tr>
                      );
                    })}
                  {officialProducts
                    .filter(p => !p.isPermanentlyCancelled)
                    .filter(p => {
                      const sMatch = p.productName.toLowerCase().includes(catalogSearch.toLowerCase()) || 
                                     p.productCode.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                                     p.specs.toLowerCase().includes(catalogSearch.toLowerCase());
                      const fMatch = catalogSupplierFilter === 'all' || p.defaultSupplier === catalogSupplierFilter;
                      return sMatch && fMatch;
                    }).length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-400 text-xs font-medium">
                          未匹配到相关未永久注销之官方正式商品
                        </td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => {
                  const toAdd: NewItemRow[] = [];
                  Object.keys(selectedCatalogItems).forEach(code => {
                    if (selectedCatalogItems[code]) {
                      const matchProd = officialProducts.find(p => p.productCode === code);
                      if (matchProd) {
                        toAdd.push({
                          productCode: matchProd.productCode,
                          productName: matchProd.productName,
                          specs: matchProd.specs,
                          quantity: selectedCatalogQuantities[code] || 10,
                          supplier: matchProd.defaultSupplier,
                          orderType: 'conventional',
                          remark: '一键选货秒级生成',
                          isUrgent: false
                        });
                      }
                    }
                  });

                  if (toAdd.length === 0) {
                    alert('请先勾选需要一件生成订单的官方商品勾选框！');
                    return;
                  }

                  // Load
                  const isPlaceholder = orderRows.length === 1 && orderRows[0].productCode === '';
                  if (isPlaceholder) {
                    setOrderRows(toAdd);
                  } else {
                    setOrderRows([...orderRows, ...toAdd]);
                  }

                  // Clear check states
                  setSelectedCatalogItems({});
                  setActiveTab('draft');
                  alert(`一件秒级补货生成成功！已一键生成并装载了共 ${toAdd.length} 项商品，并自动跳转至【待报审订单草稿箱】列表中进行核算及提报。`);
                }}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 active:scale-[0.98]"
              >
                <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-bounce" />
                <span>一件选中生成订单草稿行并自动跳转</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'draft' && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 md:p-6 space-y-6 text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-800 text-sm md:text-base flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-blue-500" />
              <span>快速批量录入订货行</span>
            </h3>
            
            <div className="flex items-center gap-2">
              {selectedDraftIndices.length > 0 && (
                <button
                  type="button"
                  onClick={handleDeleteSelectedDrafts}
                  className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>批选删除 ({selectedDraftIndices.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowImportPanel(!showImportPanel)}
                className={`flex items-center gap-1 px-3 py-1.5 border rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  showImportPanel 
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                    : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50/40'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>📁 Excel 模版一键导入</span>
              </button>

              <button
                onClick={handleAddFieldRow}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>插入空产品行</span>
              </button>
            </div>
          </div>

          {/* Collapsible Excel Batch Importer Panel */}
          {showImportPanel && (
            <div className="bg-slate-55 border border-slate-200/80 rounded-2xl p-4 md:p-5 space-y-4 text-left shadow-sm bg-slate-50 transition-all animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                    分店提货单 - Excel 表格 / 多行文本一键解析导入器
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                    系统支持一键读取 Excel (.xlsx/.xls) 文件、CSV 电子表格，或由分店在微信/QQ直接复制过来的多行用逗号/空格分隔的文本形式。
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={downloadOrderTemplate}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 rounded text-[10px] font-bold transition-colors cursor-pointer border border-emerald-200"
                    title="下载格式完全对接系统的标准微软 Excel 提货模版"
                  >
                    📥 下载标准 Excel 模板.xlsx
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImportText(
                        "PROD-A01,九牧不锈钢暗装高档水龙头,SS-901-HM,15,九牧卫浴制造厂,Excel常规补货提单\nPROD-B05,飞利浦智能LED吸顶顶灯 50W,PL-M50W-LED,25,飞利浦合肥照明厂,急单专供\nPROD-NEW-XYZ,定制合金防锈角阀,DF-90X-BRASS,50,苏锡特种阀门厂,分店新品临时订单"
                      );
                    }}
                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100/80 text-blue-700 hover:text-blue-800 rounded text-[10px] font-bold transition-colors cursor-pointer border border-blue-200/40"
                    title="自动载入高质量快速补货示例串"
                  >
                    📋 导入标准范例
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText("商品编码,商品名称,规格型号,数量,首选厂商,行备注\nPROD-A01,九牧不锈钢暗装高档水龙头,SS-901-HM,20,九牧卫浴制造厂,分店补齐");
                      alert("Excel 通用 csv 模板表头格式已复制！可直接在表格内编辑好整块复制。");
                    }}
                    className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-600 rounded text-[10px] font-bold transition-colors cursor-pointer border border-slate-200 shadow-2xs"
                  >
                    🖨 复制 CSV 表头
                  </button>
                </div>
              </div>

              {/* Spreadsheets File Selector Dropzone Option */}
              <div className="p-3.5 bg-white border border-dashed border-blue-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <h5 className="text-xs font-bold text-slate-800">读取本地 Excel 工作簿或 CSV 文本表格 (.xlsx, .csv)</h5>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">
                      表列排序为：<strong>[第一列：商品编码]、[第二列：商品名称]、[第三列：规格型号]、[第四列：订货数量]</strong>。推荐直接点选上方【下载标准 Excel 模板】。
                    </p>
                  </div>
                </div>
                <label className="w-full sm:w-auto text-center px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-sm block">
                  📂 选择本地表格文件
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleFileImport}
                  />
                </label>
              </div>

              <div className="w-full text-center text-[10px] text-slate-400 font-medium"><span>—— 或者在此处直接粘贴粘贴行文本数据 ——</span></div>

              <div className="space-y-1.5 text-left">
                <div className="text-[10px] font-bold text-slate-500 tracking-wide flex items-center gap-1.5">
                  <span className="w-1.5 h-1 bg-blue-500 rounded-sm"></span>
                  手贴行格式示例：
                  <span className="font-mono bg-white px-1.5 py-0.5 border border-slate-200 rounded text-slate-700 leading-none">
                    商品编码, 商品名称, 规格型号, 数量, 指定供应商（选填）
                  </span>
                </div>
                
                <textarea
                  rows={4}
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  className="w-full p-3 bg-white border border-slate-200 focus:border-blue-505 rounded-xl font-mono text-xs focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 focus:border-blue-505 duration-150"
                  placeholder="如不想上传文件，可在微信/钉钉中复制大段补货行粘贴于此，每行一个商品，系统自适应解析。"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setShowImportPanel(false)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-500 cursor-pointer text-xs"
                >
                  关闭
                </button>
                <button
                  type="button"
                  onClick={() => handleParseImport(importText)}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer text-xs font-bold shadow-xs active:scale-[0.99] transition-all"
                >
                  ⚡ 解析上贴文本并合并
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 min-w-[700px]">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100">
                  <th className="p-3 font-semibold text-slate-700 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={orderRows.length > 0 && selectedDraftIndices.length === orderRows.length}
                      onChange={e => handleSelectAllDrafts(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-200 focus:ring-blue-500 cursor-pointer"
                      title="全选 / 取消全选"
                    />
                  </th>
                  <th className="p-3 font-semibold text-slate-700 w-1/6">商品编码 *</th>
                  <th className="p-3 font-semibold text-slate-700 w-1/4">商品名称 *</th>
                  <th className="p-3 font-semibold text-slate-700 w-1/4">规格型号 *</th>
                  <th className="p-3 font-semibold text-slate-700 w-1/8">订购数量 *</th>
                  <th className="p-3 font-semibold text-slate-700 w-1/5">指定合伙厂商 / 供应商</th>
                  <th className="p-3 font-semibold text-slate-700 text-right w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orderRows.map((row, idx) => {
                  const isCustom = row.orderType === 'custom';
                  return (
                    <React.Fragment key={idx}>
                      <tr className="bg-slate-50/20">
                        <td className="p-2" colSpan={7}>
                          <div className="flex flex-wrap items-center gap-4 bg-slate-50/70 p-2 rounded-lg border border-slate-200">
                            <span className="font-bold text-[10px] text-slate-400">选择第 {idx + 1} 行项提单类型：</span>
                            <div className="flex items-center gap-1.5 font-medium">
                              <input
                                type="radio"
                                id={`type-conv-${idx}`}
                                name={`row-type-${idx}`}
                                checked={row.orderType === 'conventional'}
                                onChange={() => {
                                  const updated = [...orderRows];
                                  updated[idx].orderType = 'conventional';
                                  if (officialProducts.length > 0) {
                                    const first = officialProducts[0];
                                    updated[idx].productCode = first.productCode;
                                    updated[idx].productName = first.productName;
                                    updated[idx].specs = first.specs;
                                    updated[idx].supplier = first.defaultSupplier;
                                  }
                                  setOrderRows(updated);
                                }}
                                className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                              <label htmlFor={`type-conv-${idx}`} className="text-xs text-slate-700 cursor-pointer">
                                🏢 常规单 (系统商品库已有)
                              </label>
                            </div>

                            <div className="flex items-center gap-1.5 font-medium">
                              <input
                                type="radio"
                                id={`type-cust-${idx}`}
                                name={`row-type-${idx}`}
                                checked={row.orderType === 'custom'}
                                onChange={() => {
                                  const updated = [...orderRows];
                                  updated[idx].orderType = 'custom';
                                  updated[idx].productCode = '';
                                  updated[idx].productName = '';
                                  updated[idx].specs = '';
                                  updated[idx].supplier = '';
                                  setOrderRows(updated);
                                }}
                                className="w-3.5 h-3.5 text-purple-600 focus:ring-purple-500 cursor-pointer"
                              />
                              <label htmlFor={`type-cust-${idx}`} className="text-xs text-purple-700 cursor-pointer">
                                ✨ 非常规新品 (手动录入新件/强制备注)
                              </label>
                            </div>
                            
                            {!isCustom && officialProducts.length > 0 && (
                              <div className="ml-auto flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-200">
                                <span className="text-[10px] font-bold text-slate-400">检索/选品：</span>
                                <select
                                  onChange={(e) => {
                                    const selCode = e.target.value;
                                    const match = officialProducts.find(p => p.productCode === selCode);
                                    if (match) {
                                      const updated = [...orderRows];
                                      updated[idx].productCode = match.productCode;
                                      updated[idx].productName = match.productName;
                                      updated[idx].specs = match.specs;
                                      updated[idx].supplier = match.defaultSupplier;
                                      setOrderRows(updated);
                                    }
                                  }}
                                  value={row.productCode}
                                  className="bg-transparent border-none text-[11px] font-semibold text-slate-700 focus:ring-0 cursor-pointer focus:outline-none"
                                >
                                  <option value="">-- 点击选择正式商品并自动填充 --</option>
                                  {officialProducts.map(p => (
                                    <option key={p.id} value={p.productCode}>
                                      [{p.productCode}] {p.productName} ({p.specs}) - 厂: {p.defaultSupplier}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                      <tr className="border-b border-slate-100 hover:bg-slate-50/10">
                        <td className="p-2 text-center align-middle">
                          <input
                            type="checkbox"
                            checked={selectedDraftIndices.includes(idx)}
                            onChange={() => {
                              setSelectedDraftIndices(prev => 
                                prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
                              );
                            }}
                            className="w-4 h-4 text-blue-600 rounded border-slate-200 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-2">
                          {isCustom ? (
                            <input
                              type="text"
                              placeholder="货号(如NEW-01)*"
                              required
                              value={row.productCode}
                              onChange={e => handleRowChange(idx, 'productCode', e.target.value)}
                              className="w-full px-2 py-1.5 border border-purple-200 bg-purple-50/10 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs text-purple-900 font-semibold uppercase font-mono"
                            />
                          ) : (
                            <input
                              type="text"
                              readOnly
                              placeholder="系统自动填充"
                              value={row.productCode}
                              className="w-full px-2 py-1.5 border border-slate-200 bg-slate-100 rounded text-xs text-slate-500 font-mono font-bold"
                            />
                          )}
                        </td>
                         <td className="p-2">
                          <input
                            type="text"
                            required
                            readOnly={!isCustom}
                            placeholder={isCustom ? "请输入自定义商品名称 *" : "选择商品后自动填充"}
                            value={row.productName}
                            onChange={e => handleRowChange(idx, 'productName', e.target.value)}
                            className={`w-full px-2 py-1.5 border text-xs rounded focus:outline-none ${
                              isCustom 
                                ? 'border-purple-200 bg-purple-50/10 focus:ring-purple-500 text-purple-900 font-bold' 
                                : 'border-slate-200 bg-slate-100 text-slate-500'
                            }`}
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            required
                            readOnly={!isCustom}
                            placeholder={isCustom ? "规格型号,如: 50A *" : "选择商品后自动填充"}
                            value={row.specs}
                            onChange={e => handleRowChange(idx, 'specs', e.target.value)}
                            className={`w-full px-2 py-1.5 border text-xs rounded focus:outline-none ${
                              isCustom 
                                ? 'border-purple-200 bg-purple-50/10 focus:ring-purple-500 text-purple-900' 
                                : 'border-slate-200 bg-slate-100 text-slate-500'
                            }`}
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="1"
                            required
                            value={row.quantity}
                            onChange={e => handleRowChange(idx, 'quantity', e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-bold text-slate-850 font-mono text-center"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            readOnly={!isCustom}
                            placeholder={isCustom ? "指定供应商/厂商 *" : "选择商品后自动填充"}
                            value={row.supplier}
                            onChange={e => handleRowChange(idx, 'supplier', e.target.value)}
                            className={`w-full px-2 py-1.5 border text-xs rounded focus:outline-none ${
                              isCustom 
                                ? 'border-purple-200 bg-purple-50/10 focus:ring-purple-500 text-purple-900 font-medium' 
                                : 'border-slate-200 bg-slate-100 text-slate-500 font-medium'
                            }`}
                          />
                        </td>
                        <td className="p-2 text-right">
                          <button
                            onClick={() => handleRemoveFieldRow(idx)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="移去这一项"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                      {/* Joint subrow for mark as urgent and supplementary remarks */}
                      <tr className="bg-slate-50/10 border-b border-slate-150">
                        <td colSpan={7} className="p-2">
                          <div className="flex flex-wrap items-center gap-4 pl-2">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!row.isUrgent}
                                onChange={e => handleRowChange(idx, 'isUrgent', e.target.checked)}
                                className="w-4 h-4 text-rose-600 focus:ring-rose-500 rounded cursor-pointer"
                              />
                              <span className={`text-[11px] font-bold flex items-center gap-1 ${row.isUrgent ? 'text-rose-600 animate-pulse' : 'text-slate-500'}`}>
                                ⚡ 申请加急货
                              </span>
                            </label>

                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <span className="font-semibold text-slate-400">补充备注说明:</span>
                              <input
                                type="text"
                                placeholder={isCustom ? "✨ 非常规商品备注必填 (填买家、特定用途、工程等)*" : "行备注 (如：3号款、随车备货等，选填)"}
                                required={isCustom}
                                value={row.remark}
                                onChange={e => handleRowChange(idx, 'remark', e.target.value)}
                                className={`px-2 py-1 border rounded text-xs w-[450px] ${
                                  isCustom 
                                    ? 'border-purple-300 bg-purple-50/20 text-purple-950 font-medium font-semibold placeholder:text-purple-300' 
                                    : 'border-slate-200 bg-white text-slate-800'
                                }`}
                              />
                            </div>

                            {row.isUrgent && (
                              <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-extrabold pb-0.5">
                                📢 急货提醒：今日该分店加急申报配额：{urgentCountToday + orderRows.filter(r => r.isUrgent).length} / {MAX_URGENT_DAILY}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end items-center gap-3 border-t border-slate-50 pt-4">
            <span className="text-xs text-slate-400">当前共有 {orderRows.length} 项订货条目</span>
            <button
              onClick={handleSubmitOrderBatch}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:bg-blue-400"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? '保存提交中...' : '核对无误，呈报前台审核'}</span>
            </button>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 md:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-50">
            <div>
              <h3 className="font-semibold text-slate-800 text-sm md:text-base">本店下发意向单据流水</h3>
              <p className="text-[10px] text-slate-400">在此汇总查看及处理您向总部前台推送的大货订货单进度状态（按住表头左右拖动可定制列）</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Submission Date Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">提交日期:</span>
                <input
                  type="date"
                  value={historyDateFilter}
                  onChange={e => setHistoryDateFilter(e.target.value)}
                  className="px-2 py-1 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  title="按特定年-月-日提报日期过滤列表"
                />
                {historyDateFilter && (
                  <button 
                    onClick={() => setHistoryDateFilter('')}
                    className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer font-bold"
                  >
                    清除
                  </button>
                )}
              </div>

              {/* Self Check Toggle Indicator */}
              <button
                type="button"
                onClick={() => setShowSelfCheckOnly(!showSelfCheckOnly)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                  showSelfCheckOnly
                    ? 'bg-amber-50 border-amber-250 text-amber-700 border-amber-300 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
                title="“我的订单状态自检”功能：过滤出仅有欠货且未完成的在轨意向单"
              >
                <Sliders className="w-3.5 h-3.5 text-amber-500" />
                <span>{showSelfCheckOnly ? '自检模式：仅显示未完成（欠货）' : '状态自检：全部'}</span>
              </button>

              {/* Reset Cols Ordering */}
              <button
                type="button"
                onClick={handleResetHistoryCols}
                className="px-2 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-800 text-slate-500 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                title="还原排序到系统默认模板规则"
              >
                🔄 恢复列布局
              </button>

              {/* Search */}
              <input
                type="text"
                placeholder="搜索商品编码/名称"
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 w-36"
              />

              {/* Filter */}
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">所有常规状态</option>
                <option value="pending_confirm">待前台确认</option>
                <option value="pending_purchase">待采购汇总</option>
                <option value="purchased">厂家发货中</option>
                <option value="completed">已签收到齐</option>
                <option value="rejected">已被驳回退回</option>
                <option value="pending_delete">申请废弃中(待审)</option>
                <option value="deleted_abnormal">已异常废单/退货</option>
              </select>

              {/* Export button */}
              <ExportButton 
                data={filteredHistory} 
                headers={exportHeaders} 
                fileName={`${currentUser.branchName}_提单历史`} 
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-50 rounded-lg">
            <table className="w-full text-left text-xs text-slate-600 min-w-[850px]">
              <thead className="bg-slate-50/70 border-b border-slate-100">
                <tr>
                  {historyCols.map((col: any, cIdx: number) => (
                    <th
                      key={col.key}
                      draggable
                      onDragStart={() => handleDragStart(cIdx)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(cIdx)}
                      className="p-3 font-semibold text-slate-700 cursor-move hover:bg-slate-100 select-none relative group transition-colors inline-th"
                      title="按住鼠标拖拽此表头，可上下左右拖动以调整自定义列位置"
                    >
                      <div className="flex items-center gap-1">
                        <span>{col.label}</span>
                        <span className="text-[10px] text-slate-350 group-hover:text-slate-450 font-normal">⋮⋮</span>
                      </div>
                    </th>
                  ))}
                  <th className="p-3 font-semibold text-slate-700 text-center w-28">操作动作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHistory.map(order => {
                  const isLongOverdue = order.status === 'pending_confirm' && 
                    (Date.now() - new Date(order.createdAt).getTime()) > 24 * 60 * 60 * 1000;
                  
                  return (
                    <tr key={order.id} className="hover:bg-slate-50/40 align-middle">
                      {historyCols.map((col: any) => {
                        if (col.key === 'status') {
                          return (
                            <td className="p-3" key="status">
                              {order.status === 'pending_delete' ? (
                                <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-orange-100 text-orange-700 border border-orange-200 animate-pulse">
                                  ⚠️ 待核准删除
                                </span>
                              ) : order.status === 'deleted_abnormal' ? (
                                <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                  已异常删除(作废)
                                </span>
                              ) : (
                                getStatusBadge(order.status)
                              )}
                            </td>
                          );
                        }

                        if (col.key === 'orderType') {
                          return (
                            <td className="p-3 font-medium" key="orderType">
                              {order.orderType === 'custom' ? (
                                <span className="px-1.5 py-0.5 text-[10px] bg-purple-100 text-purple-700 rounded font-extrabold border border-purple-200">非常规新品</span>
                              ) : (
                                <span className="px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-700 rounded font-extrabold border border-blue-100">常规大货单</span>
                              )}
                            </td>
                          );
                        }

                        if (col.key === 'orderNo') {
                          return <td className="p-3 font-mono font-medium text-slate-900" key="orderNo">{order.orderNo}</td>;
                        }

                        if (col.key === 'createdAt') {
                          return (
                            <td className="p-3 text-slate-400 font-mono" key="createdAt">
                              {order.createdAt}
                            </td>
                          );
                        }

                        if (col.key === 'productName') {
                          // Find matched PO expected dates (Self Check Helper)
                          const matchedPo = purchaseOrders.find(po => po.orderIds?.includes(order.id));
                          const expectedArrival = matchedPo?.expectedArrivalDate || '';
                          const shortageNum = Math.max(0, order.quantity - (order.receivedQty || 0));

                          return (
                            <td className="p-3" key="productName">
                              <div className="font-semibold text-slate-950">{order.productName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">货号编码: {order.productCode}</div>
                              
                              {/* 24 Hours Alert Tooltip */}
                              {isLongOverdue && (
                                <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 p-1.5 rounded-lg mt-1.5 font-bold animate-pulse flex items-center gap-1">
                                  🚨 超24H未处理：该订单提报审核已搁置超过 24 小时仍处挂起状态，建议核对前台并敦促。
                                </div>
                              )}

                              {/* State Selfcheck block */}
                              {order.status === 'purchased' && (
                                <div className="mt-1 bg-slate-50 border border-slate-100 p-1.5 rounded-md space-y-0.5 text-[10px]">
                                  <div className="text-slate-600">
                                    自检测成果：已核发实收 <strong className="text-slate-900 font-mono">{order.receivedQty || 0}</strong> 件，仍尚拖欠 <strong className="text-rose-600 font-mono">{shortageNum}</strong> 件缺页。
                                  </div>
                                  {expectedArrival && (
                                    <div className="text-blue-700 font-bold flex items-center gap-1 bg-blue-50/50 p-0.5 rounded px-1 w-fit">
                                      🗓 厂家预估投产发货日期：{expectedArrival} (敬请等待)
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Advanced Multi-Party Remark Indicators with Highlighting Alert Banners */}
                              <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                                {order.remark ? (
                                  <>
                                    {order.remarkRole === 'receptionist' && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                        🎨 【总部前台: {order.remarkOperatorName || '文员'}】补充: {order.remark}
                                      </span>
                                    )}
                                    {order.remarkRole === 'purchasing' && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                        🏭 【采购主管: {order.remarkOperatorName || '采购'}】补充: {order.remark}
                                      </span>
                                    )}
                                    {(!order.remarkRole || order.remarkRole === 'branch' || order.remarkRole === 'admin') && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                                        🏪 【本分店备注】: {order.remark}
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">暂无流转备注</span>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingRemarkOrder(order);
                                    setNewRemarkText(order.remark || '');
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 text-[10px] font-semibold border border-blue-200 cursor-pointer transition-colors"
                                  title="不管在提交前后，所有订单均可以自行追加/调整备注流转，若包含‘直发’字样将触发直发逻辑"
                                >
                                  📝 追加/修改备注
                                </button>
                              </div>
                              
                              {order.status === 'rejected' && (
                                <div className="text-[11px] text-rose-600 bg-rose-50 border border-rose-100 p-1.5 rounded mt-1.5 font-semibold">
                                  🚨 驳回理由: {order.rejectReason || '未填写具体原因'}
                                </div>
                              )}

                              {order.status === 'pending_delete' && (
                                <div className="text-[10px] text-orange-700 bg-orange-50 border border-orange-100 p-1 rounded mt-1">
                                  申请异常作废理由：{order.deleteReason || '未标注'}
                                </div>
                              )}
                            </td>
                          );
                        }

                        if (col.key === 'specs') {
                          return <td className="p-3 text-slate-500 font-medium" key="specs">{order.specs}</td>;
                        }

                        if (col.key === 'quantity') {
                          return <td className="p-3 font-semibold font-mono text-slate-900 text-center" key="quantity">{order.quantity}</td>;
                        }

                        if (col.key === 'receivedQty') {
                          return <td className="p-3 font-semibold font-mono text-center text-slate-700" key="receivedQty">{order.receivedQty || 0}</td>;
                        }

                        if (col.key === 'supplier') {
                          return <td className="p-3 text-slate-500 font-medium" key="supplier">{order.supplier}</td>;
                        }

                        return null;
                      })}

                      <td className="p-3 text-center">
                        <div className="flex flex-col items-center justify-center gap-1">
                          {currentUser.role === 'admin' ? (
                            <button
                              onClick={() => handleDeleteOrder(order.id)}
                              className="w-full px-2 py-1 bg-rose-600 text-white hover:bg-rose-700 rounded text-[10px] font-bold cursor-pointer transition-colors"
                              title="系统最高管理员直接硬编码强制删除行项"
                            >
                              💥 强制清除
                            </button>
                          ) : (
                            <>
                              {order.status === 'pending_confirm' && (
                                <button
                                  onClick={() => handleDeleteOrder(order.id)}
                                  className="w-full px-2 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded text-[10px] font-bold cursor-pointer transition-colors"
                                  title="撤回当前待审批订单"
                                >
                                  撤销提单
                                </button>
                              )}
                              {order.status === 'rejected' && (
                                <>
                                  <button
                                    onClick={() => handleEditRejectedOrder(order)}
                                    className="w-full px-2 py-1 bg-purple-150 hover:bg-purple-200 text-purple-700 rounded text-[10px] font-bold cursor-pointer transition-colors"
                                    title="载入录入表重新排产"
                                  >
                                    编辑重申
                                  </button>
                                  <button
                                    onClick={() => handleDeleteOrder(order.id)}
                                    className="w-full px-2 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded text-[10px] font-bold cursor-pointer transition-colors mt-0.5"
                                    title="彻底删除此项"
                                  >
                                    彻底删除
                                  </button>
                                </>
                              )}

                              {/* Normal or partial processing allows Request Abnormal Delete */}
                              {!['pending_confirm', 'rejected', 'pending_delete', 'deleted_abnormal'].includes(order.status) && (
                                <>
                                  <button
                                    onClick={() => handleRequestAbnormalDelete(order.id)}
                                    className="w-full px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold rounded text-[10px]"
                                    title="提货途中遇到极特殊损坏、退换货等异常情况，发起总单据异常退单（双重会签流程）"
                                  >
                                    ⚠️ 申请作废退单
                                  </button>

                                  {!['completed'].includes(order.status) && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setJointCloseOrderId(order.id);
                                        setShowJointCloseDialog(true);
                                      }}
                                      className="w-full px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded text-[10px] mt-1 border border-emerald-200"
                                      title="分店协同结单：如果分店货物给齐不要了，一键与前台确认结清或永久取消"
                                    >
                                      🤝 协同结清/取消
                                    </button>
                                  )}
                                </>
                              )}

                              {order.status === 'pending_delete' && (
                                <span className="text-[10px] text-orange-600 font-bold bg-orange-50 px-1 rounded animate-pulse">
                                  待总部会签中...
                                </span>
                              )}

                              {order.status === 'deleted_abnormal' && (
                                <button
                                  onClick={() => handleConfirmBranchDelete(order.id)}
                                  className="w-full px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-[10px] font-bold shadow-2xs"
                                  title="清理本地界面展示，销毁视图看板"
                                >
                                  🫙 确认清空看板
                                </button>
                              )}

                              {['completed', 'cancelled', 'deleted_abnormal'].includes(order.status) && (
                                <button
                                  type="button"
                                  onClick={() => handleReorderProduct(order)}
                                  className="w-full px-2 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold rounded text-[10px] mt-1 cursor-pointer transition-colors"
                                  title="已完结零件或中途取消订单：一键复制极速重新申报"
                                >
                                  🔁 一键重订
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredHistory.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">
                      无对应状态或与之相符的大货订单单据记录
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'shortages' && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 md:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-55">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-500" />
              <div>
                <h3 className="font-semibold text-slate-800 text-sm md:text-base">本店厂家欠货跟踪清单</h3>
                <p className="text-[10px] text-slate-400">统计已提交采购至外部厂家，但未满额送货、仍在欠货状态的产品信息</p>
              </div>
            </div>

            <ExportButton 
              data={myShortages.map(o => ({ ...o, qtyShort: o.quantity - o.receivedQty }))} 
              headers={exportShortageHeaders} 
              fileName={`${currentUser.branchName}_欠货清单`} 
              // React 18 / Lucide Icons supported
            />
          </div>

          <div className="overflow-x-auto border border-slate-50 rounded-lg">
            <table className="w-full text-left text-xs text-slate-600 min-w-[700px]">
              <thead className="bg-slate-50/70 border-b border-slate-100">
                <tr>
                  <th className="p-3 font-semibold text-slate-700">关联订单批号</th>
                  <th className="p-3 font-semibold text-slate-700">商品名称</th>
                  <th className="p-3 font-semibold text-slate-700">型号规格</th>
                  <th className="p-3 font-semibold text-slate-700 font-mono text-center w-24">原采购量</th>
                  <th className="p-3 font-semibold text-slate-700 font-mono text-center w-24">实受到账</th>
                  <th className="p-3 font-semibold text-rose-700 font-mono text-center bg-rose-50/20 w-28">实时欠货数量</th>
                  <th className="p-3 font-semibold text-slate-700">供货商</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {myShortages.map(order => {
                  const qtyShort = order.quantity - order.receivedQty;
                  return (
                    <tr key={order.id} className="hover:bg-rose-50/5/30">
                      <td className="p-3 font-mono font-semibold text-slate-800">{order.orderNo}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{order.productName}</div>
                        <div className="text-[10px] font-mono text-slate-400">货号: {order.productCode}</div>
                      </td>
                      <td className="p-3 text-slate-500">{order.specs}</td>
                      <td className="p-3 text-center font-mono font-medium">{order.quantity}</td>
                      <td className="p-3 text-center font-mono font-medium text-slate-600">{order.receivedQty || 0}</td>
                      <td className="p-3 text-center bg-rose-50/50 font-bold font-mono text-rose-600">
                        {qtyShort}
                      </td>
                      <td className="p-3 text-slate-500 font-medium">{order.supplier}</td>
                    </tr>
                  );
                })}
                {myShortages.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-slate-400">
                      <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2 shrink-0 stroke-[1.5]" />
                      <div className="text-xs font-semibold text-slate-700">您好，当前分店处于零欠货的饱满状态！</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">厂家发出的采购商品已100%全额配齐签收</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Active tab for Permanently Cancelled Products */}
      {activeTab === 'permanent_cancelled' && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 md:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-105 border-slate-100">
            <div className="flex items-center gap-2">
              <Ban className="w-5 h-5 text-slate-500" />
              <div>
                <h3 className="font-semibold text-slate-800 text-sm md:text-base">🚫 商品永久下架 / 自动备货注销名录</h3>
                <p className="text-[10px] text-slate-400">列出已被人工申请永久取消、不再参与安全备货公式分析及订单预警提示的专属物料</p>
              </div>
            </div>
            <div className="text-xs text-slate-500 font-semibold bg-slate-50 px-3 py-1 rounded-lg">
              挂账物料总量: {permCancelledProducts.length} 款
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-50 rounded-lg">
            <table className="w-full text-left text-xs text-slate-600 min-w-[700px]">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-700">
                <tr>
                  <th className="p-3 font-semibold">货号编码</th>
                  <th className="p-3 font-semibold">商品名称</th>
                  <th className="p-3 font-semibold">规格型号</th>
                  <th className="p-3 font-semibold">主力厂家</th>
                  <th className="p-3 font-semibold">注销备注原因 / 控制指令</th>
                  <th className="p-3 font-semibold text-center w-40">核销指令操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-105 divide-slate-100 bg-white">
                {permCancelledProducts.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono font-bold text-slate-800">{p.productCode}</td>
                    <td className="p-3 font-bold text-slate-900">{p.productName}</td>
                    <td className="p-3 text-slate-500 font-medium">{p.specs}</td>
                    <td className="p-3 text-slate-500 font-medium">{p.defaultSupplier || '通用厂商'}</td>
                    <td className="p-3">
                      <div className="text-slate-850 font-medium text-rose-700 text-[11px] bg-rose-50/40 p-1.5 rounded border border-rose-100/60 break-words max-w-sm">
                        {p.permanentCancelReason || '未填写具体原因'}
                      </div>
                      {p.permanentCancelAt && (
                        <div className="text-[9px] text-slate-400 mt-1 font-mono">
                          注销标定时间: {new Date(p.permanentCancelAt).toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex flex-col gap-1 justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            setEditPermProduct(p);
                            setEditPermReason(p.permanentCancelReason || '');
                          }}
                          className="px-2 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded font-bold text-[10px] cursor-pointer transition-colors"
                        >
                          ✏️ 修正取消原因
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRestoreProduct(p)}
                          className="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded font-bold text-[10px] cursor-pointer transition-colors"
                        >
                          ❇️ 恢复继续备货
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {permCancelledProducts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-400">
                      <CheckCircle className="w-8 h-8 text-slate-350 mx-auto mb-2 shrink-0 stroke-[1.5]" />
                      <div className="text-xs font-semibold text-slate-600">当前没有配置任何永久下架商品项目</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">所有正式物料都正常参与到分店与采购端的安全缺货盘点流中</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Active tab for Cancelled/Voided Orders */}
      {activeTab === 'cancelled_orders' && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 md:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Ban className="w-5 h-5 text-rose-500 animate-pulse" />
              <div>
                <h3 className="font-semibold text-slate-800 text-sm md:text-base">📂 已作废 / 取消合同订单全档</h3>
                <p className="text-[10px] text-slate-400">列出在此系统中已被分店、前台或采购部中途注销作废的所有订单条目，以便另外存放、核实和追溯</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-50 rounded-lg">
            <table className="w-full text-left text-xs text-slate-600 min-w-[750px]">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-700">
                <tr>
                  <th className="p-3 font-semibold">提单分店</th>
                  <th className="p-3 font-semibold">流水单号/投产单</th>
                  <th className="p-3 font-semibold">商品信息</th>
                  <th className="p-3 font-semibold text-center">原采购量</th>
                  <th className="p-3 font-semibold">协同厂商</th>
                  <th className="p-3 font-semibold">取消备注及原因说明</th>
                  <th className="p-3 font-semibold text-center w-28">操作相关</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {orders
                  .filter(o => o.status === 'cancelled' && (currentUser.role === 'admin' || currentUser.role === 'purchasing' || currentUser.role === 'receptionist' || o.branchName === currentUser.branchName))
                  .map(o => (
                    <tr key={o.id} className="hover:bg-slate-50/50">
                      <td className="p-3">
                        <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                          {o.branchName}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-500">{o.orderNo}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{o.productName}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">货号: {o.productCode} / 规格: {o.specs}</div>
                      </td>
                      <td className="p-3 text-center font-mono font-bold">{o.quantity} 件</td>
                      <td className="p-3 text-slate-500 font-medium">{o.supplier}</td>
                      <td className="p-3">
                        <div className="text-rose-700 text-[11px] bg-rose-50/50 p-2 rounded border border-rose-100/50 max-w-sm font-medium">
                          <strong>原因:</strong> {o.cancelReason || '未备注说明'}
                        </div>
                        {o.cancelledAt && (
                          <div className="text-[9px] text-slate-405 text-slate-400 font-mono mt-1">
                            🕒 取消于: {new Date(o.cancelledAt).toLocaleString()} | 操作人: {o.cancelledBy || '系统'}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center space-y-1">
                        <span className="text-[10px] text-slate-500 border border-slate-200 bg-slate-50 rounded px-2 py-1 select-none font-semibold block text-center">
                          🔒 已加锁存底
                        </span>
                        <button
                          type="button"
                          onClick={() => handleReorderProduct(o)}
                          className="w-full px-2 py-1 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 font-bold rounded text-[10px] cursor-pointer transition-colors block text-center"
                          title="一键将此作废订单重新极速提报或复制为草稿"
                        >
                          🔁 重新下单
                        </button>
                      </td>
                    </tr>
                ))}
                {orders.filter(o => o.status === 'cancelled' && (currentUser.role === 'admin' || currentUser.role === 'purchasing' || currentUser.role === 'receptionist' || o.branchName === currentUser.branchName)).length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-slate-400">
                      <CheckCircle className="w-8 h-8 text-slate-350 mx-auto mb-2 shrink-0 stroke-[1.5]" />
                      <div className="text-xs font-semibold text-slate-600">当前没有已被废止的订单</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">所有常规和非常规合同款都在各级审核流转中平稳运作。</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* dialog modal for Cancel Options (当下取消 vs 永久取消) */}
      {showCancelDialog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" style={{ margin:0 }}>
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-5 md:p-6 space-y-4 border border-slate-100 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm md:text-base flex items-center gap-2">
                <Ban className="w-5 h-5 text-rose-500 animate-pulse" />
                <span>请确认撤销/下架操作类型</span>
              </h3>
              <button 
                onClick={() => {
                  setShowCancelDialog(false);
                  setCancelRowIdx(null);
                  setCancelOrderId(null);
                  setTempCancelCode('');
                }}
                className="p-1 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full hover:scale-105 duration-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-2.5">
              <p className="font-medium text-slate-700">
                您正准备移除或撤下货品项。商品货号编码为：
                <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded font-bold text-rose-600">{tempCancelCode || '未知/新品'}</span>
              </p>
              
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-150 border-amber-200 text-amber-850 space-y-1.5">
                <p className="font-bold text-[11px] flex items-center gap-1">
                  💡 注意：此物料是否以后不再生产或本店无限期拒收？
                </p>
                <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-slate-600">
                  <li><strong>当下取消 (临时移除)</strong>：仅从当前列表/订单中删除。下次总部自动配货依然会根据安全库存算法对该货品报警补货。</li>
                  <li><strong>永久取消 (全量下架)</strong>：将该商品在系统中标记为「永久取消自动补货」，避免配货算法在缺料表格中无限警告欠货！</li>
                </ul>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500">
                  填写取消/下架详情备注原因 (若选择永久取消，会公开此原因)* ：
                </label>
                <textarea
                  id="cancel-reason-input"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-rose-500 text-slate-800 focus:bg-white"
                  rows={2}
                  placeholder="例如: 厂家已断产/不再卖此货/因溢价永久停用等..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('cancel-reason-input') as HTMLTextAreaElement;
                  const txt = el?.value || '';
                  handleExecuteCancel(false, txt);
                }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer text-center duration-150 transition-colors"
              >
                ⏳ 仅当下取消 (普通删除)
              </button>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('cancel-reason-input') as HTMLTextAreaElement;
                  const txt = el?.value || '';
                  if (!txt.trim()) {
                    alert('对于【永久取消并全量下架】指令，必须输入详细的原因理由作为归档查验依据！');
                    return;
                  }
                  handleExecuteCancel(true, txt);
                }}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl cursor-pointer text-center duration-150 transition-colors shadow-sm"
              >
                🚫 确定永久取消并通知采购
              </button>
            </div>
          </div>
        </div>
      )}

      {/* dialog modal for Joint Close Confirmation (branch with receptionist-purchasing verification) */}
      {showJointCloseDialog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" style={{ margin:0 }}>
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-5 md:p-6 space-y-4 border border-slate-100 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm md:text-base flex items-center gap-1.5 animate-fadeIn">
                🤝 申请双重指引·协同会签结单
              </h3>
              <button 
                onClick={() => {
                  setShowJointCloseDialog(false);
                  setJointCloseOrderId(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-3">
              <p className="leading-relaxed">
                针对在轨运作的大货订单，如果分店发现该货品<strong>“已给齐送足”</strong>，或者客户告知<strong>“由于到货迟延所以绝对不要了”</strong>等意外状态：
              </p>
              
              <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 font-bold text-slate-700">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                  请选择您的会签核销目的:
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <label className="flex items-center gap-2 p-2.5 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 hover:border-emerald-500 transition-all checked-wrap">
                    <input
                      type="radio"
                      name="jointCloseChoice"
                      id="choice-supplied"
                      defaultChecked
                      className="w-3.5 h-3.5 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span>已给齐 (申请结案)</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 hover:border-rose-500 transition-all checked-wrap">
                    <input
                      type="radio"
                      name="jointCloseChoice"
                      id="choice-cancel"
                      className="w-3.5 h-3.5 text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                    <span>不要了 (清除作废)</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500">
                  会签申请核算补充原由说明 (必填)* ：
                </label>
                <textarea
                  id="joint-close-reason"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 focus:bg-white"
                  rows={2}
                  placeholder="请详细描写该货物为何需要一键结清，例：前台师傅随车送过来了/不要了等..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setShowJointCloseDialog(false);
                  setJointCloseOrderId(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-xl cursor-pointer duration-150"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  const radSupplied = document.getElementById('choice-supplied') as HTMLInputElement;
                  const choiceVal = radSupplied?.checked ? 'supplied' : 'cancel';
                  const txt = (document.getElementById('joint-close-reason') as HTMLTextAreaElement)?.value || '';

                  if (!txt.trim()) {
                    alert('请给会签前台/采购审核老师填写一两句简短的会签核实交带备注！');
                    return;
                  }
                  
                  if (jointCloseOrderId) {
                    handleApplyJointClose(jointCloseOrderId, choiceVal, txt);
                  }
                }}
                className="px-5 py-2 bg-gradient-to-r from-emerald-650 to-emerald-600 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl cursor-pointer font-extrabold shadow-sm active:scale-[0.99] transition-all"
              >
                ⚡ 呈递协同前台及采购确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editing product custom cancel reason modal */}
      {editPermProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" style={{ margin:0 }}>
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-5 md:p-6 space-y-4 border border-slate-100 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-850 text-slate-800 text-sm md:text-base">
                ✏️ 修正永久停产/对账下架原由
              </h3>
              <button 
                onClick={() => setEditPermProduct(null)}
                className="p-1 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-3.5">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-150">
                <div className="font-bold text-slate-800">{editPermProduct.productName}</div>
                <div className="text-[10px] font-mono text-slate-400 mt-0.5">货号编码: {editPermProduct.productCode} | 厂供: {editPermProduct.defaultSupplier}</div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500">
                  修改下架注销及告警停发原由说明的原因理由 * ：
                </label>
                <textarea
                  value={editPermReason}
                  onChange={e => setEditPermReason(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 focus:bg-white"
                  rows={3}
                  placeholder="在此输入新的公开注销缘由..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setEditPermProduct(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-xl cursor-pointer duration-150 font-semibold"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => handleUpdateCancelReason(editPermProduct, editPermReason)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl cursor-pointer font-bold duration-150 shadow-xs"
              >
                💾 确认保存修改
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editing remark modal */}
      {editingRemarkOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" style={{ margin:0 }}>
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-5 md:p-6 space-y-4 border border-slate-100 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm md:text-base flex items-center gap-1.5">
                📝 流转附加备注 / 直发申请修改
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
                <div className="font-bold text-slate-800">商品名称：{editingRemarkOrder.productName}</div>
                <div className="text-slate-500 mt-1">单据单号：<span className="font-mono text-xs text-slate-700">{editingRemarkOrder.orderNo}</span></div>
                <div className="text-slate-500">提报规格：{editingRemarkOrder.specs} | 提报类型：{editingRemarkOrder.orderType === 'custom' ? '非常规新品' : '常规大货'}</div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500">
                  输入修改后的备注详情说明（支持前台/采购实时查看）：
                </label>
                <textarea
                  value={newRemarkText}
                  onChange={e => setNewRemarkText(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 focus:bg-white"
                  rows={3}
                  placeholder="例如：需厂里直发 / 顺丰到付 / 加急发货..."
                />
                <p className="text-[10px] text-slate-400">
                  💡 提示：若备注中包含“直发”文字（如：“厂里直发”），常规单据在库内有货时将被拦截，特殊新品单将呈送采购专门审批。
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
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl cursor-pointer font-bold duration-150 shadow-xs"
              >
                💾 确认流转保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cross-month direct-dispatch modal warning popup */}
      {showCrossMonthModal && crossMonthDirectOrders.length > 0 && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4" style={{ margin:0 }}>
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl p-5 md:p-6 space-y-4 border border-amber-250 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-amber-100 pb-3">
              <h3 className="font-extrabold text-amber-700 text-sm md:text-base flex items-center gap-1.5">
                ⚠️ 跨月在轨直发物料安全盘查确认
              </h3>
            </div>

            <div className="text-xs text-slate-600 space-y-3.5">
              <p className="text-slate-800 font-medium leading-relaxed">
                系统为您自动盘查到以下 <strong>{crossMonthDirectOrders.length}</strong> 笔订单属于先前<strong>跨月提报</strong>并在备注中要求了“直发”的采购货品：
              </p>

              <div className="p-3 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl space-y-1.5 text-[11px]">
                <p className="font-bold text-amber-850">🚨 避免重复发货及冗余结算指引：</p>
                <p>如果该批直发货品已经由厂家直发到店收到，为彻底避免后续采购人员或供货厂商重复装车发货，请您务必立即点击下方的【已收到货，立即申请退单】提交申请，等待前台文员审核冲回退账！</p>
              </div>

              <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100 bg-slate-50 p-2 space-y-2">
                {crossMonthDirectOrders.map(order => (
                  <div key={order.id} className="p-2.5 bg-white rounded-lg flex items-center justify-between gap-4 text-[11px]">
                    <div>
                      <div className="font-bold text-slate-800">{order.productName}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">编码: {order.productCode} | 提期: {order.createdAt} | 数量: <strong className="text-slate-800">{order.quantity}</strong></div>
                      <div className="text-[10px] text-purple-650 font-semibold italic mt-0.5 bg-purple-55 px-1.5 py-0.5 rounded-sm w-fit">分店备注: "{order.remark}"</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCrossMonthCancelOrder(order.id)}
                      className="px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 rounded text-[10px] font-bold duration-150 flex-shrink-0 cursor-pointer"
                    >
                      🤝 已收到货，立即申请退退
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setShowCrossMonthModal(false);
                  setDismissedCrossMonth(true);
                }}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer duration-150 font-bold"
                title="稍后弹窗提醒，继续核对其他货项"
              >
                💤 暂不处理，稍后提醒
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
