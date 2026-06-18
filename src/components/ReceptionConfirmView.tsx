import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  Square, 
  CheckCircle, 
  Layers, 
  Search, 
  Filter, 
  ClipboardCheck,
  Building,
  AlertTriangle,
  FileText,
  XCircle,
  ThumbsUp,
  ThumbsDown,
  Sliders,
  Clock,
  Sparkles,
  Plus,
  X,
  Upload,
  Download,
  FileSpreadsheet
} from 'lucide-react';
import { Order, User, Supplier, InventoryItem, Product } from '../types';
import { DbService } from '../lib/dbService';
import ExportButton from './ExportButton';
import * as XLSX from 'xlsx';

interface ReceptionConfirmViewProps {
  orders: Order[];
  onConfirmOrders: (orderIds: string[]) => Promise<void>;
  currentUser: User;
}

const DEFAULT_PENDING_COLS = [
  { key: 'branchName', label: '流出分店' },
  { key: 'orderNo', label: '提单流水编码' },
  { key: 'createdAt', label: '提报时间' },
  { key: 'productName', label: '商品具名与编码' },
  { key: 'specs', label: '型号规格' },
  { key: 'quantity', label: '申购总量' },
  { key: 'supplier', label: '配套首选供应商' },
  { key: 'orderType', label: '下单类型' },
];

const DEFAULT_SHORTAGE_COLS = [
  { key: 'branchName', label: '拖欠分店' },
  { key: 'orderNo', label: '关联订单批号' },
  { key: 'productCode', label: '商品拼箱代码' },
  { key: 'productName', label: '货品名称' },
  { key: 'specs', label: '产品规格' },
  { key: 'quantity', label: '采购总数' },
  { key: 'received', label: '实签到货' },
  { key: 'qtyOwed', label: '拖欠差值' },
  { key: 'supplier', label: '签约供应合伙厂' },
];

export default function ReceptionConfirmView({ orders, onConfirmOrders, currentUser }: ReceptionConfirmViewProps) {
  const [panelTab, setPanelTab] = useState<'pending' | 'shortages' | 'deletes' | 'inventory_check'>('pending');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingRemarkOrder, setEditingRemarkOrder] = useState<Order | null>(null);
  const [newRemarkText, setNewRemarkText] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // States for stock crosscheck replenishment
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [quantitiesToOrder, setQuantitiesToOrder] = useState<{ [itemCode: string]: number }>({});
  const [remarksToOrder, setRemarksToOrder] = useState<{ [itemCode: string]: string }>({});
  const [selectedSuppliersForItem, setSelectedSuppliersForItem] = useState<{ [itemCode: string]: string }>({});
  const [selectedMerchandiserFilterForCheck, setSelectedMerchandiserFilterForCheck] = useState<string>('all');
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [officialProducts, setOfficialProducts] = useState<Product[]>([]);

  const fetchSuppliersAndInventory = () => {
    DbService.getSuppliers().then(sups => {
      setSuppliers(sups.filter(s => s.isActive !== false));
    });
    DbService.getInventory().then(items => {
      setInventoryItems(items);
    });
    DbService.getProducts().then(prods => {
      setOfficialProducts(prods);
    });
  };

  useEffect(() => {
    fetchSuppliersAndInventory();
  }, [orders]);

  const downloadReceptionTemplate = () => {
    try {
      const data = [
        ["流出分店名称", "商品编码", "商品名称", "规格型号", "订货数量", "首选供应商/厂家", "下单类型 (常规/样品/特配/补件)", "单行详细备注 / 定制需求说明"],
        ["城东分店", "PROD-A01", "九牧不锈钢暗装高档水龙头", "SS-901-HM", 15, "九牧卫浴制造厂", "常规", "一楼男洗手间损坏更换"],
        ["城南分店", "PROD-B05", "飞利浦智能LED吸顶灯 50W", "PL-M50W-LED", 25, "飞利浦合肥照明厂", "常规", "二层前厅天花板吊顶替换"],
        ["总部备货库", "PROD-NEW-99", "高级纳米防爆花洒套件", "NM-HS-99", 8, "广州卫浴五金厂", "样品", "客制化样板展示需求"]
      ];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(data);
      
      ws['!cols'] = [
        { wch: 18 },
        { wch: 18 },
        { wch: 30 },
        { wch: 22 },
        { wch: 12 },
        { wch: 26 },
        { wch: 26 },
        { wch: 45 }
      ];

      XLSX.utils.book_append_sheet(wb, ws, "前台代客批量导入模版");
      XLSX.writeFile(wb, "前台批量代录入提货单标准模版.xlsx");
    } catch (e: any) {
      alert("下载模板出错：" + e.message);
    }
  };

  const handleReceptionFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        let headerSkipped = false;
        let parsedCount = 0;
        const newImportedOrders: Order[] = [];

        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const createdAtStr = `${now.toISOString().slice(0, 10)} ${hh}:${mm}`;

        for (const row of rawJson) {
          if (!Array.isArray(row) || row.length === 0) continue;
          
          const col0Str = String(row[0] || '').trim();
          const col1Str = String(row[1] || '').trim();
          if (
            !headerSkipped &&
            (col0Str.includes('分店') ||
              col1Str.includes('商品编码') ||
              col1Str.includes('产品编码') ||
              col1Str.includes('CODE') ||
              col1Str.includes('代码') ||
              col1Str.includes('编码'))
          ) {
            headerSkipped = true;
            continue;
          }

          const branchNameVal = String(row[0] || '').trim() || '前台代客提报';
          const code = String(row[1] || '').trim();
          const name = String(row[2] || '').trim();
          const specs = String(row[3] || '').trim();
          const qtyVal = parseInt(String(row[4] || '1'), 10) || 1;
          const supplier = String(row[5] || '').trim();
          const orderTypeStr = String(row[6] || '常规').trim();
          const remark = String(row[7] || '').trim();

          if (!code && !name) continue;

          const matched = officialProducts.find(
            p => p.productCode.trim().toLowerCase() === code.trim().toLowerCase()
          );

          const finalSupplier = supplier || (matched ? (matched.defaultSupplier || '系统自提厂商') : '随单指定厂商');
          const matchedSupplierObj = suppliers.find(s => s.name.trim() === finalSupplier.trim());
          const merchandiserName = matchedSupplierObj ? matchedSupplierObj.merchandiserName : undefined;
          const leadTimeText = matchedSupplierObj ? matchedSupplierObj.leadTimeText : undefined;

          const orderNoStr = `SO-RC-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;

          const newOrder: Order = {
            id: `ord_${Date.now()}_RC_${parsedCount}_${Math.floor(Math.random() * 1000)}`,
            orderNo: orderNoStr,
            branchId: `rc_import_${encodeURIComponent(branchNameVal)}`,
            branchName: branchNameVal,
            productCode: code || (matched ? matched.productCode : ('IMP-' + Date.now())),
            productName: name || (matched ? matched.productName : '导入未知商品'),
            specs: specs || (matched ? matched.specs : '通用规格'),
            quantity: Math.max(1, qtyVal),
            receivedQty: 0,
            status: 'pending_confirm', // To appear in the review list
            supplier: finalSupplier,
            orderType: (orderTypeStr === '常规' || orderTypeStr === 'conventional') ? 'conventional' : 'custom',
            remark: remark || '前台大批量代理进口提单',
            createdAt: createdAtStr,
            merchandiserName,
            leadTimeText
          };

          newImportedOrders.push(newOrder);
          parsedCount++;
        }

        if (newImportedOrders.length === 0) {
          alert('未能从选择的文件中提取到可读的订单项（格式要求流出分店名称作为第一列，商品编码作为第二列）');
          return;
        }

        // Save orders to DB in a loop
        let savedCount = 0;
        for (const order of newImportedOrders) {
          await DbService.saveOrder(order, {
            id: currentUser.id,
            name: currentUser.username,
            role: currentUser.role
          });
          savedCount++;
        }

        alert(`🎉 成功导入并上报 ${savedCount} 款订单货项！所有新订单已直载进入前台【分店提单待审核】待办池中。`);
        setShowImportPanel(false);
      } catch (e: any) {
        console.error(e);
        alert("解析 Excel 文件出错：" + e.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleCreateReplenishmentOrder = async (item: InventoryItem) => {
    const rawQty = quantitiesToOrder[item.productCode];
    const orderQty = rawQty !== undefined ? Number(rawQty) : (item.safeStock - item.currentStock);

    if (isNaN(orderQty) || orderQty <= 0) {
      alert('请填入大于 0 的有效加单数量！');
      return;
    }

    const currentSelSupplier = selectedSuppliersForItem[item.productCode] || item.supplier;
    const matchedSupplier = suppliers.find(s => s.name.trim() === currentSelSupplier.trim());
    const merchandiserName = matchedSupplier ? matchedSupplier.merchandiserName : undefined;
    const leadTimeText = matchedSupplier ? matchedSupplier.leadTimeText : undefined;

    const randomNo = Math.floor(1000 + Math.random() * 9000);
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const createdAtStr = `${now.toISOString().slice(0, 10)} ${hh}:${mm}`;

    const newOrder: Order = {
      id: `ord_${Date.now()}_HQ`,
      orderNo: `SO-HQ-${dateStr}-${randomNo}`,
      branchId: 'hq_warehouse',
      branchName: '总部备货库',
      productCode: item.productCode,
      productName: item.productName,
      specs: item.specs || '通用规格',
      quantity: orderQty,
      receivedQty: 0,
      status: 'pending_purchase', // direct to purchasing pending pool!
      supplier: currentSelSupplier,
      orderType: 'conventional',
      remark: remarksToOrder[item.productCode] || '前台交叉核算库存智能加单',
      createdAt: createdAtStr,
      merchandiserName,
      leadTimeText
    };

    try {
      await DbService.saveOrder(newOrder, {
        id: currentUser.id,
        name: currentUser.username,
        role: currentUser.role
      });
      alert(`已成功下单！货品 [${item.productName}] 额外加单数 ${orderQty} 件。订单状态已直达【采购并单合并】待办池中。\n自动分配分管跟单员: ${merchandiserName || '未指定采购'}，执行交期约定: ${leadTimeText || '默认无约定 (走现货)'}`);
      
      // Clear inputs for this item
      setQuantitiesToOrder(prev => ({ ...prev, [item.productCode]: 0 }));
      setRemarksToOrder(prev => ({ ...prev, [item.productCode]: '' }));

      fetchSuppliersAndInventory();
    } catch (e) {
      console.error(e);
      alert('加单失败，请检查数据库。');
    }
  };

  const handleUpdateOrderSupplier = async (orderId: string, supplierName: string) => {
    const matchedSup = suppliers.find(s => s.name === supplierName);
    const mName = matchedSup ? matchedSup.merchandiserName : undefined;
    const lTime = matchedSup ? matchedSup.leadTimeText : undefined;

    try {
      const allOrders = await DbService.getOrders();
      const ordIdx = allOrders.findIndex(o => o.id === orderId);
      if (ordIdx > -1) {
        allOrders[ordIdx] = {
          ...allOrders[ordIdx],
          supplier: supplierName,
          merchandiserName: mName,
          leadTimeText: lTime
        };
        await DbService.saveOrder(allOrders[ordIdx], {
          id: currentUser.id,
          name: currentUser.username,
          role: currentUser.role
        });
      }
    } catch (e) {
      console.error(e);
      alert('更新供应商/跟单采购失败！');
    }
  };

  // Tab A (Pending incoming orders) filter states
  const [branchSearch, setBranchSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [receptionDateFilter, setReceptionDateFilter] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tab B (All shortage items) filter states
  const [shortageProductSearch, setShortageProductSearch] = useState('');
  const [shortageBranchSearch, setShortageBranchSearch] = useState('');

  // Drag and Drop ordering for Tab A
  const [pendingCols, setPendingCols] = useState(() => {
    const raw = localStorage.getItem(`cols_reception_pending_${currentUser.id}`);
    if (raw) {
      try { return JSON.parse(raw); } catch (e) {}
    }
    return DEFAULT_PENDING_COLS;
  });
  const [draggedPendingColIdx, setDraggedPendingColIdx] = useState<number | null>(null);

  // Drag and Drop ordering for Tab B
  const [shortageCols, setShortageCols] = useState(() => {
    const raw = localStorage.getItem(`cols_reception_shortages_${currentUser.id}`);
    if (raw) {
      try { return JSON.parse(raw); } catch (e) {}
    }
    return DEFAULT_SHORTAGE_COLS;
  });
  const [draggedShortageColIdx, setDraggedShortageColIdx] = useState<number | null>(null);

  const handleDragStartP = (idx: number) => setDraggedPendingColIdx(idx);
  const handleDragOverP = (e: React.DragEvent) => e.preventDefault();
  const handleDropP = (targetIdx: number) => {
    if (draggedPendingColIdx === null) return;
    const reordered = [...pendingCols];
    const [dragged] = reordered.splice(draggedPendingColIdx, 1);
    reordered.splice(targetIdx, 0, dragged);
    setPendingCols(reordered);
    localStorage.setItem(`cols_reception_pending_${currentUser.id}`, JSON.stringify(reordered));
    setDraggedPendingColIdx(null);
  };
  const handleResetPendingCols = () => {
    setPendingCols(DEFAULT_PENDING_COLS);
    localStorage.removeItem(`cols_reception_pending_${currentUser.id}`);
  };

  const handleDragStartS = (idx: number) => setDraggedShortageColIdx(idx);
  const handleDragOverS = (e: React.DragEvent) => e.preventDefault();
  const handleDropS = (targetIdx: number) => {
    if (draggedShortageColIdx === null) return;
    const reordered = [...shortageCols];
    const [dragged] = reordered.splice(draggedShortageColIdx, 1);
    reordered.splice(targetIdx, 0, dragged);
    setShortageCols(reordered);
    localStorage.setItem(`cols_reception_shortages_${currentUser.id}`, JSON.stringify(reordered));
    setDraggedShortageColIdx(null);
  };
  const handleResetShortageCols = () => {
    setShortageCols(DEFAULT_SHORTAGE_COLS);
    localStorage.removeItem(`cols_reception_shortages_${currentUser.id}`);
  };

  // 1. FILTERING DATA FOR TAB A (Pending Confirms)
  const pendingOrders = orders.filter(o => o.status === 'pending_confirm');
  
  const rawFilteredPending = pendingOrders.filter(o => {
    const bMatch = !branchSearch.trim() || o.branchName.toLowerCase().includes(branchSearch.toLowerCase());
    const pMatch = !productSearch.trim() || 
                   o.productName.toLowerCase().includes(productSearch.toLowerCase()) || 
                   o.productCode.toLowerCase().includes(productSearch.toLowerCase()) ||
                   o.orderNo.toLowerCase().includes(productSearch.toLowerCase());
    const dMatch = !receptionDateFilter || (o.createdAt && o.createdAt.startsWith(receptionDateFilter));
    return bMatch && pMatch && dMatch;
  });

  // Sort: isUrgent (加急) always first, then newest first (To reflect: 如果分店备注急货，订单会优先排到前面)
  const filteredPending = [...rawFilteredPending].sort((a, b) => {
    const aUrgent = !!a.isUrgent;
    const bUrgent = !!b.isUrgent;
    if (aUrgent && !bUrgent) return -1;
    if (!aUrgent && bUrgent) return 1;
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  // 2. COMPUTING & FILTERING DATA FOR TAB B (Branch shortages tracker)
  const shortageOrders = orders.filter(o => {
    const received = o.receivedQty || 0;
    return o.status === 'purchased' && received < o.quantity;
  }).map(o => {
    const received = o.receivedQty || 0;
    const qtyOwed = o.quantity - received;
    return {
      ...o,
      received,
      qtyOwed
    };
  });

  const filteredShortages = shortageOrders.filter(o => {
    const pMatch = !shortageProductSearch.trim() || 
                   o.productName.toLowerCase().includes(shortageProductSearch.toLowerCase()) || 
                   o.productCode.toLowerCase().includes(shortageProductSearch.toLowerCase());
    const bMatch = !shortageBranchSearch.trim() || 
                   o.branchName.toLowerCase().includes(shortageBranchSearch.toLowerCase());
    return pMatch && bMatch;
  });

  // 3. TAB C: ABNORMAL DELETES REVIEW (Stage: pending)
  const deleteRequests = orders.filter(o => o.status === 'pending_delete' && o.deleteStage === 'pending');

  // Multi-party Remark Synchronizer handler
  const handleSaveRemarkEdit = async () => {
    if (!editingRemarkOrder) return;
    try {
      await DbService.updateOrderRemark(
        editingRemarkOrder.id,
        newRemarkText,
        { id: currentUser.id, name: currentUser.username, role: currentUser.role }
      );
      alert('总部前台流转备注更新成功，已同步提醒分店与采购员！');
      setEditingRemarkOrder(null);
    } catch (e: any) {
      alert(e.message || '更新备注失败');
    }
  };

  // Selection handlers
  const handleSelectToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleSelectAllToggle = () => {
    const allFilteredIds = filteredPending.map(o => o.id);
    const areAllSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.includes(id));

    if (areAllSelected) {
      setSelectedIds(selectedIds.filter(id => !allFilteredIds.includes(id)));
    } else {
      const newSelections = Array.from(new Set([...selectedIds, ...allFilteredIds]));
      setSelectedIds(newSelections);
    }
  };

  const handleBatchConfirmSubmit = async () => {
    if (selectedIds.length === 0) {
      alert('请先勾选需要确认的分店订货条目');
      return;
    }

    if (!confirm(`确定要批量核准确认所选的 ${selectedIds.length} 笔订单提报吗？确认后将同步通知采购合并下单。`)) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirmOrders(selectedIds);
      alert('批量合并确认成功！对应款项已顺畅交接至采购部门的主管。');
      setSelectedIds([]); // clear selection
    } catch (err) {
      console.error(err);
      alert('操作失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSingleReject = async (orderId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const reason = prompt('请输入驳回该订单的详细因由/规范要求：');
    if (reason === null) return;
    if (!reason.trim()) {
      alert('驳回原因属于核心审核责任链，必须强制核填说明！');
      return;
    }
    try {
      await DbService.rejectOrder(orderId, reason.trim(), 'rejected', {
        id: currentUser.id,
        name: currentUser.username,
        role: currentUser.role
      });
      alert('已成功将该提单驳回给发起分店，系统提示分店在【编辑重申】。');
    } catch (e: any) {
      alert(e.message || '操作失败');
    }
  };

  const handleApproveDeletePre = async (orderId: string) => {
    if (!confirm('您确定通过对该异常作废提请的【前台初审】吗？核准同意后，本申请会流转至采购终审判定。')) return;
    try {
      await DbService.receptionConfirmDelete(orderId, {
        id: currentUser.id,
        name: currentUser.username,
        role: currentUser.role
      });
      alert('前台初核成功！已高效推报至【采购部门】进行终裁复议。');
    } catch (e: any) {
      alert(e.message || '审核失败');
    }
  };

  const handleRejectDeletePre = async (orderId: string) => {
    if (!confirm('您确定撤回或驳回分店这一异常作废提请，并恢复订单在采购/收货池中的日常履约记录吗？')) return;
    try {
      await DbService.rejectDeleteOrder(orderId, {
        id: currentUser.id,
        name: currentUser.username,
        role: currentUser.role
      });
      alert('已驳回废单诉求，对应订单履约指标已退回并常态跟进。');
    } catch (e: any) {
      alert(e.message || '驳回失败');
    }
  };

  const exportHeadersPending = [
    { key: 'orderNo', label: '提报批号' },
    { key: 'branchName', label: '申购分店' },
    { key: 'createdAt', label: '下单日期' },
    { key: 'productCode', label: '商品编码' },
    { key: 'productName', label: '商品名称' },
    { key: 'specs', label: '规格/型号' },
    { key: 'quantity', label: '订货量' },
    { key: 'supplier', label: '意向厂商' }
  ];

  const exportHeadersShortages = [
    { key: 'orderNo', label: '关联合同号' },
    { key: 'branchName', label: '所欠分店' },
    { key: 'productCode', label: '商品编码' },
    { key: 'productName', label: '商品名称' },
    { key: 'specs', label: '规格型号' },
    { key: 'quantity', label: '总需量' },
    { key: 'received', label: '实收到货' },
    { key: 'qtyOwed', label: '仍拖欠数量' },
    { key: 'supplier', label: '配套供应厂家' }
  ];

  return (
    <div className="space-y-4">
      {/* Upper Navigation Row with Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
        <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setPanelTab('pending')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
              panelTab === 'pending' 
                ? 'bg-white text-slate-800 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-amber-500" />
            <span>待核准分店新单</span>
            {pendingOrders.length > 0 && (
              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {pendingOrders.length}
              </span>
            )}
          </button>
          
          <button
            onClick={() => setPanelTab('shortages')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
              panelTab === 'shortages' 
                ? 'bg-white text-slate-800 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            <span>所欠分店订单跟踪</span>
            {shortageOrders.length > 0 && (
              <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none animate-pulse">
                {shortageOrders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setPanelTab('deletes')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
              panelTab === 'deletes' 
                ? 'bg-white text-slate-800 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="查看和批准/驳回分店提呈上来的异常删除跟签"
          >
            <XCircle className="w-3.5 h-3.5 text-orange-500" />
            <span>异常退货初审</span>
            {deleteRequests.length > 0 && (
              <span className="bg-orange-100 text-orange-850 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full leading-none animate-bounce">
                {deleteRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setPanelTab('inventory_check')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
              panelTab === 'inventory_check' 
                ? 'bg-white text-slate-800 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="根据备货库实时缺货交叉，核算后一键加单采购，直接并入采购代办中"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
            <span>📋 备货库交叉比对 & 加单</span>
            {inventoryItems.filter(i => i.currentStock < i.safeStock).length > 0 && (
              <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {inventoryItems.filter(i => i.currentStock < i.safeStock).length} 预警
              </span>
            )}
          </button>
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-1">
          <span>前台终端：</span>
          <span className="font-bold text-slate-700 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
            {currentUser.username} (总前台汇总)
          </span>
        </div>
      </div>

      {panelTab === 'pending' && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 md:p-6 space-y-4 animate-fadeIn">
          {/* Branch Remark Highlight Banners */}
          {pendingOrders.filter(o => o.remark && (!o.remarkRole || o.remarkRole === 'branch')).length > 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-950 p-4 rounded-xl space-y-2 text-xs">
              <div className="font-bold flex items-center gap-1.5 text-amber-800 text-[13px]">
                📦 <span>分店最新特定备注及“厂家直发”申请提醒：</span>
              </div>
              <ul className="list-disc pl-5 space-y-1">
                {pendingOrders.filter(o => o.remark && (!o.remarkRole || o.remarkRole === 'branch')).map(o => {
                  const isDirect = ['直发', '厂家直发', '厂里直发', '工厂直发'].some(k => o.remark!.includes(k));
                  return (
                    <li key={o.id} className="leading-relaxed">
                      🏪 分店 <strong>[{o.branchName}]</strong> 针对货号 <code>{o.productCode}</code> 的货物 <strong>[{o.productName}]</strong> 提报了特定备注：
                      <span className="bg-amber-100/60 text-amber-900 border border-amber-300/60 font-bold px-1.5 py-0.5 rounded mx-1 italic">
                        "{o.remark}"
                      </span>
                      {isDirect && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 ml-1.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200 animate-pulse">
                          🏭 申请厂家直发
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Section info & filters for Tab A */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-50">
            <div>
              <h3 className="font-bold text-slate-800 text-sm md:text-base">分店极速提报汇总</h3>
              <p className="text-[10px] text-slate-400">汇聚当前全部分店最新提报的订货单。请核准签字（拖动表头定制排版）。</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Submission Date Filter */}
              <div className="flex items-center gap-1 font-bold text-slate-500">
                <span>提报日期:</span>
                <input
                  type="date"
                  value={receptionDateFilter}
                  onChange={e => setReceptionDateFilter(e.target.value)}
                  className="px-2 py-1 border border-slate-200 rounded-lg text-xs bg-white focus:ring-1 focus:ring-amber-500"
                />
                {receptionDateFilter && (
                  <button onClick={() => setReceptionDateFilter('')} className="text-[10px] text-slate-400 font-bold hover:text-slate-600">清除</button>
                )}
              </div>

              {/* Reset layout */}
              <button
                onClick={handleResetPendingCols}
                className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer"
                title="重置自定义调整后的表格列排序"
              >
                🔄 重置表头
              </button>

              {/* Branch Search Box */}
              <div className="relative text-xs w-36">
                <Building className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="分店筛查"
                  value={branchSearch}
                  onChange={e => setBranchSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400 w-full bg-slate-50 font-medium"
                />
              </div>

              {/* Product Text Search Box */}
              <div className="relative text-xs w-44">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="产品名/编码/批次号"
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400 w-full font-medium"
                />
              </div>

              {/* Export Trigger */}
              <ExportButton 
                data={filteredPending} 
                headers={exportHeadersPending} 
                fileName="待审核分店提报流转大货订单" 
              />

              {/* Import Orders Trigger */}
              <button
                type="button"
                onClick={() => setShowImportPanel(!showImportPanel)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  showImportPanel 
                    ? 'bg-amber-100 border-amber-300 text-amber-850' 
                    : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'
                }`}
              >
                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                <span>批量导入订单</span>
              </button>

              {/* Confirm Selection Action Button */}
              <button
                onClick={handleBatchConfirmSubmit}
                disabled={selectedIds.length === 0 || isSubmitting}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-200 text-white font-bold rounded-lg text-xs shadow-sm transition-colors cursor-pointer"
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>批量核准所选 ({selectedIds.length}款)</span>
              </button>
            </div>
          </div>

          {showImportPanel && (
            <div className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-4 shadow-3xs animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-extrabold text-slate-850 flex items-center gap-1.5 font-sans">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>前台代客分店订单 - Excel表格一键解析上报</span>
                  </h4>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    支持读取 Excel (.xlsx/.xls) 文件或 CSV 电子表格。导入的订单会直接以【待核准分店新单】的状态同步进入前台等待审核与一键确认。
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={downloadReceptionTemplate}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 font-bold border border-slate-200 text-slate-700 rounded-lg text-[10px] transition-all cursor-pointer shadow-3xs font-sans"
                    title="下载格式完全对接系统的标准微软 Excel 订单提货代录入模版"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-600" />
                    <span>下载空白代录订单模板.xlsx</span>
                  </button>
                </div>
              </div>

              <div className="border border-dashed border-slate-200 hover:border-blue-400 bg-white rounded-lg p-5 transition-colors cursor-pointer text-center relative flex flex-col items-center justify-center gap-1.5 group">
                <Upload className="w-6 h-6 text-slate-450 group-hover:text-blue-500 duration-150" />
                <span className="text-xs font-bold text-slate-700 group-hover:text-blue-600 duration-150">点击或将订单 Excel 拖拽到此处进行智能识别</span>
                <span className="text-[10px] text-slate-400">支持 .xlsx / .xls / .csv 格式</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleReceptionFileImport}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </div>
            </div>
          )}

          {/* Pending Table */}
          <div className="overflow-x-auto border border-slate-50 rounded-lg">
            <table className="w-full text-left text-xs text-slate-600 min-w-[850px]">
              <thead className="bg-slate-50/70 border-b border-slate-100 text-slate-700">
                <tr>
                  <th className="p-3 w-12 text-center">
                    <button
                      type="button"
                      onClick={handleSelectAllToggle}
                      className="text-slate-400 hover:text-blue-600 transition-colors inline-block cursor-pointer"
                      title="全选/反选本页"
                    >
                      {filteredPending.length > 0 && filteredPending.every(o => selectedIds.includes(o.id)) ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  {pendingCols.map((col: any, pIdx: number) => (
                    <th
                      key={col.key}
                      draggable
                      onDragStart={() => handleDragStartP(pIdx)}
                      onDragOver={handleDragOverP}
                      onDrop={() => handleDropP(pIdx)}
                      className="p-3 font-semibold text-slate-700 cursor-move hover:bg-slate-100 select-none relative group transition-colors"
                      title="拖动该列可自定义列位置"
                    >
                      <div className="flex items-center gap-0.5">
                        <span>{col.label}</span>
                        <span className="text-[9px] text-slate-350 opacity-0 group-hover:opacity-100 transition-opacity">⋮⋮</span>
                      </div>
                    </th>
                  ))}
                  <th className="p-3 font-semibold text-center w-24 text-slate-700">业务驳回</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPending.map(order => {
                  const isChecked = selectedIds.includes(order.id);
                  return (
                    <tr 
                      key={order.id} 
                      onClick={() => handleSelectToggle(order.id)}
                      className={`cursor-pointer transition-colors align-middle ${
                        isChecked ? 'bg-amber-50/20 font-medium text-amber-950' : 'hover:bg-slate-50/40'
                      }`}
                    >
                      <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleSelectToggle(order.id)}
                          className="text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      
                      {pendingCols.map((col: any) => {
                        if (col.key === 'branchName') {
                          return (
                            <td className="p-3" key="branchName">
                              <span className="font-extrabold text-slate-950 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                                {order.branchName}
                              </span>
                            </td>
                          );
                        }

                        if (col.key === 'orderNo') {
                          return <td className="p-3 font-mono font-medium text-slate-800 text-[11px]" key="orderNo">{order.orderNo}</td>;
                        }

                        if (col.key === 'createdAt') {
                          return <td className="p-3 text-slate-400 font-mono text-[11px]" key="createdAt">{order.createdAt}</td>;
                        }

                        if (col.key === 'productName') {
                          return (
                            <td className="p-3 text-slate-900 font-bold" key="productName">
                              <div>{order.productName}</div>
                              <div className="text-[10px] font-mono text-slate-400 font-normal">货号: {order.productCode}</div>
                              {/* Collaborative integrated remark visualization */}
                              <div className="mt-1 flex flex-wrap gap-1 items-center" onClick={e => e.stopPropagation()}>
                                {order.remark ? (
                                  <>
                                    {order.remarkRole === 'branch' && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                        🏪 【分店备注】: {order.remark}
                                      </span>
                                    )}
                                    {order.remarkRole === 'purchasing' && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 animate-pulse">
                                        🏭 【采购备注】: {order.remark}
                                      </span>
                                    )}
                                    {order.remarkRole === 'receptionist' && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 font-medium">
                                        🎨 【我的前台备注】: {order.remark}
                                      </span>
                                    )}
                                    {!order.remarkRole && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 font-medium">
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
                                  title="核实分店特殊需求，或填写特定补充交付给采购"
                                >
                                  📝 修改/追加备注
                                </button>
                              </div>
                            </td>
                          );
                        }

                        if (col.key === 'specs') {
                          return <td className="p-3 text-slate-500 font-medium" key="specs">{order.specs}</td>;
                        }

                        if (col.key === 'quantity') {
                          return <td className="p-3 text-center font-bold font-mono text-blue-600" key="quantity">{order.quantity}</td>;
                        }

                        if (col.key === 'supplier') {
                          return (
                            <td className="p-3 font-medium min-w-[180px]" key="supplier" onClick={e => e.stopPropagation()}>
                              <div className="space-y-1.5">
                                <div className="text-xs font-bold text-slate-800">{order.supplier}</div>
                                <select
                                  value={order.supplier || ''}
                                  onChange={e => handleUpdateOrderSupplier(order.id, e.target.value)}
                                  className="w-full text-[11px] px-2 py-1 border border-slate-200 rounded-lg bg-orange-50 text-orange-900 font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                                >
                                  <option value="">-- 重指派供应商 & 采购员 --</option>
                                  {suppliers.map(s => (
                                    <option key={s.id} value={s.name}>
                                      {s.name} ({s.merchandiserName || '无跟单人'})
                                    </option>
                                  ))}
                                </select>
                                <div className="text-[10px] flex flex-col gap-0.5 mt-1">
                                  <span className={`px-1.5 py-0.5 rounded-md w-fit text-[9px] font-bold ${
                                    order.merchandiserName 
                                      ? 'bg-blue-100 text-blue-700' 
                                      : 'bg-rose-100 text-rose-700 animate-pulse'
                                  }`}>
                                    担当采购: {order.merchandiserName || '🚨 未知所属跟单'}
                                  </span>
                                  {order.leadTimeText ? (
                                    <span className="text-[9px] text-slate-500 font-mono">
                                      交期: {order.leadTimeText}
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-slate-400 italic">
                                      交期: 默认无交期
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                          );
                        }

                        if (col.key === 'orderType') {
                          return (
                            <td className="p-3 font-medium" key="orderType">
                              {order.orderType === 'custom' ? (
                                <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-bold">新品定制</span>
                              ) : (
                                <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold">常规大货</span>
                              )}
                            </td>
                          );
                        }

                        return null;
                      })}

                      <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => handleSingleReject(order.id, e)}
                          className="px-2 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 rounded text-[10px] font-extrabold cursor-pointer border border-rose-200 transition-colors"
                          title="对分店的不合规单据行给予驳回，要求填写原因"
                        >
                          驳回分店
                        </button>
                      </td>
                    </tr>
                  );
                })}
                
                {filteredPending.length === 0 && (
                  <tr>
                    <td colSpan={pendingCols.length + 2} className="p-16 text-center text-slate-400">
                      <CheckCircle className="w-10 h-10 text-slate-300 mx-auto mb-2 stroke-[1.2]" />
                      <p className="font-semibold text-slate-700 text-xs">没有找到与您的筛选限定相符的待审核分店申报行</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        请确认左上方的提报日期及筛选框。若无订单，表示分店申报已核定完毕。
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {pendingOrders.length > 0 && (
            <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1.5 bg-slate-50 p-3 rounded-lg border border-slate-100/50">
              <div>
                数据简报：全系统有 <strong className="text-slate-700 font-bold">{pendingOrders.length}</strong> 份来单，
                过滤契合 <strong className="text-slate-800 font-extrabold">{filteredPending.length}</strong> 份，
                已选中并锁定 <strong className="text-blue-600 font-extrabold">{selectedIds.length}</strong> 款等待签章。
              </div>
            </div>
          )}
        </div>
      )}

      {panelTab === 'shortages' && (
        /* TAB B: ALL BRANCHES SHORTAGES COORD */
        <div className="bg-white rounded-xl border border-rose-100 shadow-sm p-4 md:p-6 space-y-4 animate-fadeIn">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-rose-100/40">
            <div>
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                <h3 className="font-bold text-slate-900 text-sm md:text-base">全分店欠货清单追踪分析</h3>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                此处是已提交厂家并生产完款、但厂家未足额送货依然拖欠的合同明细。您可按产品名过滤，实时核查所欠分店。
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Reset Head */}
              <button
                onClick={handleResetShortageCols}
                className="px-2 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer"
                title="清除自定义左右列拖拽位置"
              >
                🔄 重置列
              </button>

              {/* Product Name Search */}
              <div className="relative text-xs w-52">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-rose-400" />
                <input
                  type="text"
                  placeholder="按产品名称/编码筛查所欠分店..."
                  value={shortageProductSearch}
                  onChange={e => setShortageProductSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 border border-rose-150 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-400 w-full font-bold bg-white text-slate-800 placeholder:text-slate-400"
                />
              </div>

              {/* Branch Search */}
              <div className="relative text-xs w-44">
                <Building className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="按所欠分店名称筛选..."
                  value={shortageBranchSearch}
                  onChange={e => setShortageBranchSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-300 w-full"
                />
              </div>

              {/* Shortage export */}
              <ExportButton 
                data={filteredShortages} 
                headers={exportHeadersShortages} 
                fileName="全分店系统滞延缺货及所欠跟踪表" 
              />
            </div>
          </div>

          {/* shortage table display */}
          <div className="overflow-x-auto border border-rose-100/30 rounded-lg">
            <table className="w-full text-left text-xs text-slate-600 min-w-[850px]">
              <thead className="bg-rose-50/30 border-b border-rose-100/50 text-slate-800">
                <tr>
                  {shortageCols.map((col: any, sIdx: number) => (
                    <th
                      key={col.key}
                      draggable
                      onDragStart={() => handleDragStartS(sIdx)}
                      onDragOver={handleDragOverS}
                      onDrop={() => handleDropS(sIdx)}
                      className={`p-3 font-semibold cursor-move hover:bg-rose-100 select-none ${col.key === 'qtyOwed' ? 'text-rose-700 bg-rose-50/20' : 'text-slate-700'}`}
                      title="左右拖动表头自由布局"
                    >
                      <div className="flex items-center gap-0.5">
                        <span>{col.label}</span>
                        <span className="text-[9px] text-slate-300">⋮⋮</span>
                      </div>
                    </th>
                  ))}
                  <th className="p-3 font-semibold text-center w-36 text-slate-800 bg-rose-50/10">主管合规核对</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredShortages.map(item => (
                  <tr key={item.id} className="hover:bg-rose-50/10">
                    {shortageCols.map((col: any) => {
                      if (col.key === 'branchName') {
                        return (
                          <td className="p-3" key="branchName">
                            <span className="font-bold text-slate-900 bg-rose-50 text-rose-800 border border-rose-100 px-2 py-0.5 rounded">
                              {item.branchName}
                            </span>
                          </td>
                        );
                      }

                      if (col.key === 'orderNo') {
                        return <td className="p-3 font-mono text-slate-500" key="orderNo">{item.orderNo}</td>;
                      }

                      if (col.key === 'productCode') {
                        return <td className="p-3 font-mono font-medium text-slate-700" key="productCode">{item.productCode}</td>;
                      }

                      if (col.key === 'productName') {
                        return <td className="p-3 font-bold text-slate-900" key="productName">{item.productName}</td>;
                      }

                      if (col.key === 'specs') {
                        return <td className="p-3 text-slate-500 font-medium" key="specs">{item.specs}</td>;
                      }

                      if (col.key === 'quantity') {
                        return <td className="p-3 text-center font-mono" key="quantity">{item.quantity}</td>;
                      }

                      if (col.key === 'received') {
                        return <td className="p-3 text-center text-slate-400 font-mono" key="received">{item.received}</td>;
                      }

                      if (col.key === 'qtyOwed') {
                        return (
                          <td className="p-3 text-center bg-rose-50/30 text-rose-600 font-mono font-extrabold text-sm" key="qtyOwed">
                            {"qtyOwed" in item ? (item as any).qtyOwed : item.quantity - (item.receivedQty || 0)} 件
                          </td>
                        );
                      }

                      if (col.key === 'supplier') {
                        return <td className="p-3 text-slate-500 font-medium" key="supplier">{item.supplier}</td>;
                      }

                      return null;
                    })}
                    <td className="p-3 text-center border-l border-slate-100" onClick={e => e.stopPropagation()}>
                      {item.isOwedConfirmedByReception ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-600 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-md">
                          ✓ 前台确认已无欠数
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm(`确认该笔订单 [${item.orderNo}]（${item.productName}）对分店并无欠数，核定通过，以便后续采购安全删除或结转该疑问单吗？`)) return;
                            try {
                              await DbService.confirmOrderNoOwedByReception(item.id, {
                                id: currentUser.id,
                                name: currentUser.username,
                                role: currentUser.role
                              });
                              alert('前台确认无欠成功！已同步赋能该单据在采购列表中的核减/直接删除权限。');
                            } catch (err: any) {
                              alert(err.message || '操作失败');
                            }
                          }}
                          className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded font-bold text-[10px] cursor-pointer transition-colors shadow-2xs"
                          title="签署会签意见：核实并确认该条并不拖欠"
                        >
                          🟢 确认无欠款
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                
                {filteredShortages.length === 0 && (
                  <tr>
                    <td colSpan={shortageCols.length + 1} className="p-16 text-center text-slate-400">
                      <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2 stroke-[1.5]" />
                      <p className="font-semibold text-slate-700 text-xs">好消息，未查找当前状态的任何厂家拖欠货品！</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        分店意向已被各部门及工厂全额完好配齐配送。
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="text-[11px] p-2 bg-slate-50 border border-slate-100 rounded-lg text-slate-500 text-left flex justify-between items-center">
            <span>
              统计概要：全分店累积有 <strong className="text-rose-600 font-bold">{shortageOrders.length}</strong> 笔合同仍处于拖欠未足额中；
              本次分析命中过滤款项 <strong className="text-slate-800 font-bold">{filteredShortages.length}</strong> 件。
            </span>
          </div>
        </div>
      )}

      {panelTab === 'deletes' && (
        /* TAB C: ABNORMAL DELETES REVIEW (PRE-AUDIT) */
        <div className="bg-white rounded-xl border border-orange-100 shadow-sm p-4 md:p-6 space-y-4 animate-fadeIn">
          <div className="pb-2 border-b border-orange-100/50">
            <h3 className="font-bold text-slate-900 text-sm md:text-base flex items-center gap-1">
              <span className="text-orange-500">⚠️</span> 分店异常作废/退货申请【前台初审池】
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              分店提报的异常废单或极个别退货需求。由于此项对库存与流转有重大影响，前台负责完成初核校验，通过后分流至采购终审。
            </p>
          </div>

          <div className="overflow-x-auto border border-orange-100/20 rounded-lg">
            <table className="w-full text-left text-xs min-w-[750px]">
              <thead className="bg-orange-50/20 border-b border-orange-100 text-slate-800">
                <tr>
                  <th className="p-3 font-semibold">申请分店</th>
                  <th className="p-3 font-semibold">订单号</th>
                  <th className="p-3 font-semibold">商品拼箱代码</th>
                  <th className="p-3 font-semibold">货品名称</th>
                  <th className="p-3 font-semibold text-center w-24">原开申指标</th>
                  <th className="p-3 font-semibold text-center w-24">实受到账</th>
                  <th className="p-3 font-semibold text-rose-700">异常退单申请理由与原因</th>
                  <th className="p-3 font-bold text-center w-40">前台签署会签初审</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deleteRequests.map(order => (
                  <tr key={order.id} className="hover:bg-amber-50/10">
                    <td className="p-3">
                      <span className="font-bold text-orange-850 bg-orange-100/50 px-2 py-0.5 rounded">
                        {order.branchName}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-500">{order.orderNo}</td>
                    <td className="p-3 font-mono text-slate-500">{order.productCode}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{order.productName}</div>
                      <div className="text-[10px] text-slate-400">{order.specs}</div>
                    </td>
                    <td className="p-3 text-center font-semibold">{order.quantity}</td>
                    <td className="p-3 text-center text-slate-500">{order.receivedQty || 0}</td>
                    <td className="p-3 text-rose-600 font-medium whitespace-pre-wrap max-w-xs text-[11px]">
                      {order.deleteReason || '分店工作人员未详述原因'}
                    </td>
                    <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleApproveDeletePre(order.id)}
                          className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded font-bold text-[10px] cursor-pointer shadow-2xs flex items-center gap-0.5"
                          title="同意初审：签字认可异常，放行流转至采购进行最终废单操作"
                        >
                          <ThumbsUp className="w-3 h-3 text-white" />
                          <span>同意初审</span>
                        </button>
                        <button
                          onClick={() => handleRejectDeletePre(order.id)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-bold text-[10px] cursor-pointer flex items-center gap-0.5"
                          title="驳回申请：不予批准，该商品将常态还原以便后续履约和收货"
                        >
                          <ThumbsDown className="w-3 h-3 text-slate-500" />
                          <span>驳回</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {deleteRequests.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-16 text-center text-slate-400">
                      <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2 stroke-[1.5]" />
                      <p className="font-bold text-slate-700 text-xs">前台绿道：当前全业务层零异常纠偏申请</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">分店运营及大货交付常态运转中，并无任何废案纠扯。</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. CROSS CHECK INVENTORY WITH LOW STOCK PANEL */}
      {panelTab === 'inventory_check' && (() => {
        const lowStockItems = inventoryItems.filter(item => item.currentStock < item.safeStock);

        // Filter lowStockItems by selected merchandiser filter
        const filteredLowStockItems = lowStockItems.filter(item => {
          if (selectedMerchandiserFilterForCheck === 'all') return true;
          
          // Look up supplier merchandiserName in suppliers
          const matchedSup = suppliers.find(s => s.name.trim() === item.supplier.trim());
          if (!matchedSup || !matchedSup.merchandiserName) return false;
          const assignedNames = matchedSup.merchandiserName.split(/[,，;\s\/]+/).map(n => n.trim()).filter(Boolean);

          if (selectedMerchandiserFilterForCheck === 'me') {
            return assignedNames.includes(currentUser.username);
          }
          return assignedNames.includes(selectedMerchandiserFilterForCheck);
        });

        return (
          <div className="space-y-4 animate-fadeIn">
            {/* Header / Intro */}
            <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-rose-100/50">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                  </span>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">备货库水位极简多层交叉分析</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">自动罗列目前低于安全水位的商品。支持在前台阶段直接“确认加单”，自动指派契合的跟单采购，并支持实时修改或统一流转目标承接厂商。</p>
                  </div>
                </div>
                <div className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-lg flex items-center gap-1">
                  <span>主控预警项：</span>
                  <span className="font-mono text-sm">{lowStockItems.length}</span>
                  <span>/ {inventoryItems.length} 款总商品已告警</span>
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-0.5 max-w-xl">
                  <span className="text-xs font-bold text-slate-800 block">👤 归属跟单采购筛选过滤</span>
                  <span className="text-[10px] text-slate-400 block">各前台会签完后，可以通过跟单员名称（例如：自己归属）一键过滤所跟的供应商行，便于统筹下单与并单操作。</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <select
                    value={selectedMerchandiserFilterForCheck}
                    onChange={e => setSelectedMerchandiserFilterForCheck(e.target.value)}
                    className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-3xs"
                  >
                    <option value="all">📁 查看全部供应商缺货行 (共 {lowStockItems.length} 件)</option>
                    <option value="me">👤 仅看我直接跟管的厂家品项 (跟单: {currentUser.username})</option>
                    {Array.from(new Set(suppliers.flatMap(s => s.merchandiserName ? s.merchandiserName.split(/[,，;\s\/]+/).map(n => n.trim()).filter(Boolean) : []))).map(name => {
                      const count = lowStockItems.filter(item => {
                        const sObj = suppliers.find(su => su.name.trim() === item.supplier.trim());
                        if (!sObj || !sObj.merchandiserName) return false;
                        const assignedNames = sObj.merchandiserName.split(/[,，;\s\/]+/).map(n => n.trim()).filter(Boolean);
                        return assignedNames.includes(name);
                      }).length;
                      return (
                        <option key={name} value={name}>
                          👤 仅看 {name} 所属供应商的缺货行 ({count} 款)
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>

            {/* List / Table Area */}
            <div className="overflow-x-auto border border-slate-150 rounded-2xl shadow-sm bg-white">
              <table className="w-full text-left text-xs min-w-[900px]">
                <thead className="bg-slate-50 border-b border-slate-150 text-slate-700 font-bold">
                  <tr>
                    <th className="p-3">告警商品参数 (商品编码/规格)</th>
                    <th className="p-3 text-center">当前主库库存</th>
                    <th className="p-3 text-center">安全库存级数</th>
                    <th className="p-3 text-center">水位缺口（差值）</th>
                    <th className="p-3 min-w-[200px]">对接厂家 (承承制商可调配) 及 交期</th>
                    <th className="p-3 text-center w-28">本次追加订购量</th>
                    <th className="p-3">订单流转备注</th>
                    <th className="p-3 text-center w-32">提交追加到采购代办</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLowStockItems.map(item => {
                    const currentSelSupplier = selectedSuppliersForItem[item.productCode] || item.supplier;
                    const matchedSupplier = suppliers.find(s => s.name.trim() === currentSelSupplier.trim());
                    const leadTimeText = matchedSupplier?.leadTimeText;
                    const merchandiser = matchedSupplier?.merchandiserName || '未指定采购';

                    const defaultDeficiencyQty = item.safeStock - item.currentStock;
                    const currentInputQty = quantitiesToOrder[item.productCode] !== undefined 
                      ? quantitiesToOrder[item.productCode] 
                      : defaultDeficiencyQty;

                    return (
                      <tr key={item.productCode} className="hover:bg-slate-50/40">
                        <td className="p-3">
                          <div className="font-extrabold text-slate-900">{item.productName}</div>
                          <div className="flex items-center gap-2 mt-1 text-[10px]">
                            <span className="font-mono text-slate-400 bg-slate-100 px-1 py-0.2 rounded font-semibold text-[9px]">CODE: {item.productCode}</span>
                            <span className="text-slate-300">|</span>
                            <span className="text-slate-500 font-mono text-[9px] font-medium">{item.specs || '默认通用规格'}</span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="inline-flex items-center gap-1 text-slate-800 font-bold font-mono">
                            <span className="text-rose-600 text-sm font-extrabold">{item.currentStock}</span>
                            <span className="text-slate-400 font-normal text-[10px]">件</span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="inline-flex items-center gap-1 text-slate-500 font-mono">
                            <span>{item.safeStock}</span>
                            <span className="text-slate-300 text-[10px]">件</span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 font-bold font-mono text-[10px]">
                            缺 {defaultDeficiencyQty} 件
                          </span>
                        </td>
                        <td className="p-3 space-y-1.5" onClick={e => e.stopPropagation()}>
                          <select
                            value={currentSelSupplier}
                            onChange={e => setSelectedSuppliersForItem(prev => ({ ...prev, [item.productCode]: e.target.value }))}
                            className="text-[11px] font-bold px-1.5 py-1 border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                          >
                            {suppliers.map(s => (
                              <option key={s.id} value={s.name}>🏭 {s.name}</option>
                            ))}
                          </select>
                          <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-slate-400">
                            <span className="bg-slate-50 border border-slate-200/50 text-slate-500 px-1 py-0.2 rounded font-bold">
                              跟单: {merchandiser}
                            </span>
                            <span>•</span>
                            <span className="text-amber-600 font-bold flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5 text-amber-500" />
                              {leadTimeText ? `厂商交期: ${leadTimeText}` : '默认常规约定(无约定)'}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                          <input
                            type="number"
                            value={currentInputQty === 0 ? '' : currentInputQty}
                            placeholder={String(defaultDeficiencyQty)}
                            onChange={e => {
                              const val = e.target.value === '' ? 0 : Number(e.target.value);
                              setQuantitiesToOrder(prev => ({ ...prev, [item.productCode]: val }));
                            }}
                            className="w-20 px-2 py-1 text-center font-bold font-mono text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:ring-1 focus:ring-blue-500"
                            min="1"
                          />
                        </td>
                        <td className="p-3" onClick={e => e.stopPropagation()}>
                          <input
                            type="text"
                            value={remarksToOrder[item.productCode] || ''}
                            placeholder="请输入加购流转合同备注"
                            onChange={e => setRemarksToOrder(prev => ({ ...prev, [item.productCode]: e.target.value }))}
                            className="w-full px-2 py-1 text-slate-600 text-[11px] border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleCreateReplenishmentOrder(item)}
                            className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[10px] cursor-pointer flex items-center justify-center gap-1 shadow-2xs transition-all active:scale-[0.98]"
                            title="一键下单，进入该供应商跟单采购的待核准待办池内"
                          >
                            <Plus className="w-3.5 h-3.5 text-white" />
                            <span>确认加单</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredLowStockItems.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-16 text-center text-slate-400">
                        <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2 stroke-[1.5] animate-bounce" />
                        <p className="font-bold text-slate-700 text-xs">主库存安全无忧</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          所筛查的备货货品水位线非常稳健，暂时没有任何警戒缺口需要交叉提单加单。
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
      {/* Editing remark modal */}
      {editingRemarkOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" style={{ margin:0 }}>
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-5 md:p-6 space-y-4 border border-slate-100 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm md:text-base flex items-center gap-1.5">
                📝 总部前台备注修订与直发流转
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
                <div className="text-slate-500 mt-1">单号：<span className="font-mono text-xs text-slate-700">{editingRemarkOrder.orderNo}</span></div>
                <div className="text-slate-500">提报分店：{editingRemarkOrder.branchName} | 类型：{editingRemarkOrder.orderType === 'custom' ? '新品开发件' : '库房常规货'}</div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500">
                  编辑要批注补充的备注详情：
                </label>
                <textarea
                  value={newRemarkText}
                  onChange={e => setNewRemarkText(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 focus:bg-white"
                  rows={3}
                  placeholder="请输入对该单据补充、核查或配运指示..."
                />
                <p className="text-[10px] text-slate-400">
                  💡 注意：如包含“直发”文字（如“厂里直发”），如总部仓库有库存将触发系统的常规有货拦截机制，如为非常规特殊新品则会递向采购审核会签。
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
                💾 确认保存并流转
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
