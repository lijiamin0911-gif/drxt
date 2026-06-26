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
  X,
  Building
} from 'lucide-react';
import { Order, PurchaseOrder, User, Product, Supplier, SalesRecord } from '../types';
import { DbService } from '../lib/dbService';
import ExportButton from './ExportButton';
import * as XLSX from 'xlsx';

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
  const [activeSubTab, setActiveSubTab] = useState<'generate' | 'manage' | 'direct' | 'cancelled' | 'sales_history'>('generate');
  const [showPrices, setShowPrices] = useState(false);
  
  // States for sales reference/history with multi-select of year & month
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>(['2025', '2026']);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const [salesBranchFilter, setSalesBranchFilter] = useState<string>('all');
  const [salesSearchQuery, setSalesSearchQuery] = useState<string>('');
  
  // Load suppliers and approved products for manual creator
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [salesRefs, setSalesRefs] = useState<{ [code: string]: { avg3Months: number; lastYearSameMonth: number } }>({});
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
    DbService.getSalesRecords().then(records => {
      setSalesRecords(records);
    });
  }, [orders]); // Refresh when orders or system refreshes

  React.useEffect(() => {
    const loadSalesRefs = async () => {
      const activeMonthStr = new Date().toISOString().slice(0, 7); // e.g. "2026-06"
      const refs: { [code: string]: { avg3Months: number; lastYearSameMonth: number } } = {};
      
      for (const p of allProducts) {
        const res = await DbService.calculateSalesReference(p.productCode, activeMonthStr);
        refs[p.productCode] = res;
      }
      setSalesRefs(refs);
    };

    if (allProducts.length > 0) {
      loadSalesRefs();
    }
  }, [allProducts]);

  const generateMockSalesRecords = async () => {
    if (allProducts.length === 0) {
      alert('请先等待货品数据加载完毕！');
      return;
    }
    const branches = ['黄石店', '中山路店', '北京路旗舰店', '青山大药房', '后湖大药房'];
    const years = ['2024', '2025', '2026'];
    const mockRecords: SalesRecord[] = [];
    
    let idx = 0;
    for (const year of years) {
      for (let monthNum = 1; monthNum <= 12; monthNum++) {
        const monthStr = `${year}-${String(monthNum).padStart(2, '0')}`;
        for (const branch of branches) {
          for (const prod of allProducts) {
            // deterministic but varied quantities based on product code & month
            const codeSum = prod.productCode.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
            const baseQty = (codeSum % 35) + 2;
            const seasonalMultiplier = 1 + Math.sin((monthNum / 12) * Math.PI) * 0.4;
            const qty = Math.round(baseQty * seasonalMultiplier * (1 + (idx % 3) * 0.1));
            const amount = qty * 45; 
            
            mockRecords.push({
              id: `mock_sale_${year}_${monthNum}_${branch}_${prod.productCode}_${idx++}`,
              month: monthStr,
              branchName: branch,
              productCode: prod.productCode,
              productName: prod.productName,
              quantity: qty,
              amount: amount
            });
          }
        }
      }
    }
    
    try {
      await DbService.saveSalesRecords(mockRecords, { id: currentUser.id, name: currentUser.username, role: currentUser.role });
      setSalesRecords(mockRecords);
      alert('🔮 已成功在后台为您生成并持久化了近三年 (2024 - 2026) 5 个主要分店的所有货品月度销售流水账，已多维汇总呈现！');
    } catch (e: any) {
      alert('生成模拟数据失败: ' + e.message);
    }
  };

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
  const [directItems, setDirectItems] = useState<{ productCode: string; productName: string; specs: string; quantity: number; previousPrice?: number; currentPrice?: number }[]>([
    { productCode: '', productName: '', specs: '', quantity: 1, previousPrice: undefined, currentPrice: undefined }
  ]);
  const [isSubmittingDirect, setIsSubmittingDirect] = useState(false);
  const [showDirectImportPanel, setShowDirectImportPanel] = useState(false);
  const [directImportText, setDirectImportText] = useState('');

  const handlePastedTextDirectImport = () => {
    if (!directImportText.trim()) {
      alert('请先输入或粘贴多行商品数据！排布格式支持：[商品编码,商品名称,型号规格,采购数量,前次单价,本次单价]');
      return;
    }

    const lines = directImportText.split('\n');
    const newItems: any[] = [];
    let parsedCount = 0;

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      // split by tab, comma, or space
      let parts = line.split('\t');
      if (parts.length < 2) {
        parts = line.split(',');
      }
      if (parts.length < 2) {
        parts = line.split(/[ ]{2,}/); // 2 or more spaces
      }
      if (parts.length < 2) {
        parts = line.split(' '); // single space fallback
      }

      const p0 = (parts[0] || '').trim();
      const p1 = (parts[1] || '').trim();
      const p2 = (parts[2] || '').trim();
      const p3 = parseInt((parts[3] || '1').trim(), 10) || 1;
      const p4 = parseFloat((parts[4] || '0').trim()) || 0;
      const p5 = parseFloat((parts[5] || '0').trim()) || 0;

      if (!p0 && !p1) continue;

      const matched = allProducts.find(
        p => p.productCode.trim().toLowerCase() === p0.toLowerCase()
      );

      if (matched) {
        newItems.push({
          productCode: matched.productCode,
          productName: matched.productName,
          specs: matched.specs,
          quantity: p3,
          previousPrice: p4 || undefined,
          currentPrice: p5 || undefined
        });
      } else {
        newItems.push({
          productCode: p0 ? p0.toUpperCase() : 'NEW-' + Math.floor(1000 + Math.random() * 9000),
          productName: p1 || '直属自建新品',
          specs: p2 || '规格补足',
          quantity: p3,
          previousPrice: p4 || undefined,
          currentPrice: p5 || undefined
        });
      }
      parsedCount++;
    }

    if (newItems.length === 0) {
      alert('未识别到有效的多行商品特征，支持商品编码、姓名、规格、订货数量');
      return;
    }

    const isOnlyEmpty = directItems.length === 1 && directItems[0].productCode === '';
    if (isOnlyEmpty) {
      setDirectItems(newItems);
    } else {
      setDirectItems([...directItems, ...newItems]);
    }
    
    setDirectImportText('');
    setShowDirectImportPanel(false);
    alert(`文本批量代录匹配完成！已为您自动扩充追加了 ${parsedCount} 款采购货条目。`);
  };

  const handleFileDirectImport = (e: React.ChangeEvent<HTMLInputElement>) => {
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

        const newItems: any[] = [];
        let headerSkipped = false;
        let parsedCount = 0;

        for (const row of rawJson) {
          if (!Array.isArray(row) || row.length === 0) continue;

          const col0Str = String(row[0] || '').trim();
          if (
            !headerSkipped &&
            (col0Str.includes('商品编码') ||
              col0Str.includes('产品') ||
              col0Str.includes('CODE') ||
              col0Str.includes('代') ||
              col0Str.includes('编'))
          ) {
            headerSkipped = true;
            continue;
          }

          const code = String(row[0] || '').trim();
          const name = String(row[1] || '').trim();
          const specs = String(row[2] || '').trim();
          const qtyVal = parseInt(String(row[3] || '1'), 10) || 1;
          const prevPrice = parseFloat(String(row[4] || '')) || undefined;
          const currPrice = parseFloat(String(row[5] || '')) || undefined;

          if (!code && !name) continue;

          const matched = allProducts.find(
            p => p.productCode.trim().toLowerCase() === code.trim().toLowerCase()
          );

          if (matched) {
            newItems.push({
              productCode: matched.productCode,
              productName: matched.productName,
              specs: matched.specs,
              quantity: Math.max(1, qtyVal),
              previousPrice: prevPrice,
              currentPrice: currPrice
            });
          } else {
            newItems.push({
              productCode: code ? code.toUpperCase() : 'NEW-' + Math.floor(1000 + Math.random() * 9000),
              productName: name || '新品直批备货',
              specs: specs || '常规规格',
              quantity: Math.max(1, qtyVal),
              previousPrice: prevPrice,
              currentPrice: currPrice
            });
          }
          parsedCount++;
        }

        if (newItems.length === 0) {
          alert('Excel数据行格式不符：商品编码作为第一列，商品名称作为第二列，数量第四列');
          return;
        }

        const isOnlyEmpty = directItems.length === 1 && directItems[0].productCode === '';
        if (isOnlyEmpty) {
          setDirectItems(newItems);
        } else {
          setDirectItems([...directItems, ...newItems]);
        }
        setShowDirectImportPanel(false);
        alert(`一键大批量 Excel 代读取完成！成功将 ${parsedCount} 行采购详单同步追溯。`);
      } catch (err) {
        console.error(err);
        alert('读取 Excel 工作簿或 CSV 失败，请确认表格文件正常。');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDirectItemProductChange = (idx: number, productCode: string) => {
    const matched = allProducts.find(p => p.productCode === productCode);
    const updated = [...directItems];
    if (matched) {
      updated[idx] = {
        productCode: matched.productCode,
        productName: matched.productName,
        specs: matched.specs,
        quantity: updated[idx].quantity,
        previousPrice: updated[idx].previousPrice,
        currentPrice: updated[idx].currentPrice
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
        quantity: updated[idx].quantity,
        previousPrice: undefined,
        currentPrice: undefined
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
    setDirectItems([...directItems, { productCode: '', productName: '', specs: '', quantity: 1, previousPrice: undefined, currentPrice: undefined }]);
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
      setDirectItems([{ productCode: '', productName: '', specs: '', quantity: 1, previousPrice: undefined, currentPrice: undefined }]);
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
  const [selectedSupplierForDrilldown, setSelectedSupplierForDrilldown] = useState<string | null>(null);

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
    return o.merchandiserName && o.merchandiserName.split(/[,，;\s\/]+/).map(n => n.trim()).filter(Boolean).includes(selectedMerchandiserFilter);
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

  const handleEditOrder = async (order: Order) => {
    const newQtyStr = window.prompt(`【调整货量】修改订单 [${order.orderNo}] 的数量。\n当前数量: ${order.quantity}，请输入新数量:`, String(order.quantity));
    if (newQtyStr === null) return;
    const newQty = parseInt(newQtyStr, 10);
    if (isNaN(newQty) || newQty <= 0) {
      alert('请输入大于 0 的有效整数值！');
      return;
    }

    const newSpecs = window.prompt(`【调整规格】修改产品规格。\n当前规格: "${order.specs}"，请输入新规格:`, order.specs || '');
    if (newSpecs === null) return;

    const newSupplier = window.prompt(`【调整跟单生产厂商】修改厂家归属。\n当前厂商: "${order.supplier}"，请输入新厂商名:`, order.supplier || '');
    if (newSupplier === null) return;

    try {
      await DbService.editOrderDetails(order.id, {
        quantity: newQty,
        specs: newSpecs.trim(),
        supplier: newSupplier.trim()
      }, {
        id: currentUser.id,
        name: currentUser.username,
        role: currentUser.role
      });
      alert('修改成功！订货单据内容已实时重构保存。');
    } catch (err: any) {
      alert('操作失败: ' + err.message);
    }
  };

  const handleDeleteOrderInManage = async (order: Order) => {
    const shortageQty = order.quantity - (order.receivedQty || 0);
    const hasShortage = order.status === 'purchased' && shortageQty > 0;

    if (hasShortage && !order.isOwedConfirmedByReception) {
      const action = window.confirm(
        `【无法直接删除：仍有欠货】\n该单据目前仍拖欠分店 [ ${shortageQty} ] 件，仍处于在轨在途欠货期。\n\n` +
        `根据主管会签合规流程，您可以先选择：\n` +
        `👉 点击 【确定】：一键【生成新补单并结转】，将原单实收数截止，未达数量生成全新独立补单（原单将被无欠放行结案，之后即可以安全作废/删除原单）；\n` +
        `👉 或者是点击【取消】，通知前台主管在“欠货核对”栏核实确认（前台标记“确认无欠”后，采购方可强制删除本书面单）。\n\n` +
        `是否确定现在一键拆分结转缺货部分，并完成补位生成流转新采购补单？`
      );
      if (action) {
        try {
          await DbService.createCarryOverOrder(order.id, {
            id: currentUser.id,
            name: currentUser.username,
            role: currentUser.role
          });
          alert('结转分拆补单重拍成功！原账目缺货部分已作截止处理，补位新单已成功生成并重新注入待采购流！原订单已无欠，现在可以安全删除了。');
        } catch (err: any) {
          alert('快速结转结案失败: ' + err.message);
        }
      }
    } else {
      if (window.confirm(`确定要彻底作废并从当前采购履约单中【强制删除】这单货品款式吗？\n单号: [${order.orderNo}] | 货品: [${order.productName}]`)) {
        try {
          await DbService.deleteOrderByPurchasing(order.id, {
            id: currentUser.id,
            name: currentUser.username,
            role: currentUser.role
          });
          alert('疑问款明细已成功作废并彻底删除！');
        } catch (err: any) {
          alert('删除失败: ' + err.message);
        }
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
          onClick={() => setActiveSubTab('sales_history')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'sales_history' 
              ? 'bg-white text-blue-800 shadow-sm' 
              : 'text-slate-500 hover:text-slate-800'
          }`}
          title="分店月度销售量对比分析参考"
        >
          <span>📊 分店月度销量/历史销售参考</span>
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
              <label className="flex items-center gap-1.5 text-xs text-slate-700 bg-white border border-slate-250 px-3 py-1.5 rounded-lg font-bold hover:bg-slate-50 cursor-pointer select-none shadow-2xs">
                <input
                  type="checkbox"
                  checked={showPrices}
                  onChange={e => setShowPrices(e.target.checked)}
                  className="rounded text-blue-600 cursor-pointer focus:ring-1 focus:ring-blue-500 w-3.5 h-3.5"
                />
                <span>💰 启用价格对比 (上次价格与本次价格)</span>
              </label>

              <select
                value={selectedMerchandiserFilter}
                onChange={e => setSelectedMerchandiserFilter(e.target.value)}
                className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">📁 显示全部跟单 (共 {pendingPurchaseItems.length} 件)</option>
                <option value="unassigned">🚨 暂无指派采购跟单 ({pendingPurchaseItems.filter(o => !o.merchandiserName).length} 件)</option>
                {Array.from(new Set(procurementStaff.map(u => u.username))).map((name: string) => {
                  const count = pendingPurchaseItems.filter(o => o.merchandiserName && o.merchandiserName.split(/[,，;\s\/]+/).map(n => n.trim()).filter(Boolean).includes(name)).length;
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
                        className="w-full py-2 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                        <span>批量注销/取消已选 ({selectedOrderIds.length} 笔)</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Items directory grouped by supplier: Cards & Drilldowns */}
              <div className="lg:col-span-2 space-y-6 text-xs text-left">
                {/* 1. Supplier Summary Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(groupedPurchaseItemsBySupplier).map(([supplier, entries]) => {
                    const skuCount = new Set(entries.map(o => o.productCode)).size;
                    const totalQty = entries.reduce((sum, o) => sum + o.quantity, 0);
                    const branchCount = new Set(entries.map(o => o.branchName)).size;
                    
                    const isSelected = selectedSupplierForDrilldown === supplier || (!selectedSupplierForDrilldown && Object.keys(groupedPurchaseItemsBySupplier)[0] === supplier);
                    const isGroupSelected = entries.every(o => selectedOrderIds.includes(o.id));
                    const selectedInGroup = entries.filter(o => selectedOrderIds.includes(o.id));

                    // Aesthetics based on name
                    const norm = supplier.toLowerCase();
                    const icon = norm.includes('五金') || norm.includes('铁') ? '🔩' : (norm.includes('电器') || norm.includes('光电') ? '⚡' : '🏭');
                    
                    return (
                      <div 
                        key={supplier}
                        onClick={() => setSelectedSupplierForDrilldown(supplier)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer select-none bg-white relative flex flex-col justify-between min-h-[140px] ${
                          isSelected 
                            ? 'border-blue-600 ring-2 ring-blue-500/10 shadow-md' 
                            : 'border-slate-200/80 hover:border-slate-355 hover:shadow-2xs shadow-3xs'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-3 right-3 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                          </div>
                        )}

                        <div className="space-y-3 font-sans text-left">
                          <div className="flex items-start gap-2">
                            <span className="text-xl shrink-0 mt-0.5">{icon}</span>
                            <div>
                              <h4 className="font-extrabold text-slate-900 text-xs md:text-sm leading-tight pr-4">
                                {supplier}
                              </h4>
                              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                                配套首选生产制造厂商
                              </p>
                            </div>
                          </div>

                          {/* Stats Bento */}
                          <div className="grid grid-cols-3 gap-1 bg-slate-50 p-2 rounded-lg text-center font-sans">
                            <div className="space-y-0.5">
                              <span className="text-[9px] text-slate-400 block font-medium">货品品类</span>
                              <strong className="text-slate-800 text-[11px] md:text-xs font-bold font-mono">{skuCount} 种</strong>
                            </div>
                            <div className="space-y-0.5 border-x border-slate-200/60">
                              <span className="text-[9px] text-slate-400 block font-medium">待开单总量</span>
                              <strong className="text-slate-800 text-[11px] md:text-xs font-bold font-mono">{totalQty} 件</strong>
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-[9px] text-slate-400 block font-medium">涉及分店</span>
                              <strong className="text-slate-800 text-[11px] md:text-xs font-bold font-mono">{branchCount} 家</strong>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-1 animate-fadeIn" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setSelectedSupplierForDrilldown(supplier)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                              isSelected
                                ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-3xs'
                                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <span>🔍 钻取明细 ({entries.length} 笔)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleBuildSupplierPO(supplier, entries)}
                            disabled={selectedInGroup.length === 0 || isGenerating}
                            className="px-2 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-extrabold hover:bg-indigo-700 shadow-3xs transition-all cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
                          >
                            <span>🏭 供方批下单</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 2. Drill-down Area (钻取及分店详情独立展示区) */}
                {(() => {
                  const currentSupplier = selectedSupplierForDrilldown || (Object.keys(groupedPurchaseItemsBySupplier).length > 0 ? Object.keys(groupedPurchaseItemsBySupplier)[0] : null);
                  if (!currentSupplier) return null;

                  const entries = groupedPurchaseItemsBySupplier[currentSupplier] || [];
                  const isGroupSelected = entries.every(o => selectedOrderIds.includes(o.id));
                  const selectedInGroup = entries.filter(o => selectedOrderIds.includes(o.id));
                  const uncheckedInGroup = entries.filter(o => !selectedOrderIds.includes(o.id));

                  // Group current supplier's orders by branch
                  const ordersByBranch: { [branch: string]: Order[] } = {};
                  for (const order of entries) {
                    if (!ordersByBranch[order.branchName]) {
                      ordersByBranch[order.branchName] = [];
                    }
                    ordersByBranch[order.branchName].push(order);
                  }

                  return (
                    <div className="border border-blue-105 rounded-2xl shadow-md overflow-hidden bg-white animate-fadeIn font-sans">
                      {/* Drilldown Header */}
                      <div className="bg-gradient-to-r from-blue-900 to-indigo-950 p-4 text-white flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-0.5 text-left">
                          <h4 className="font-extrabold text-sm md:text-base flex items-center gap-1.5 flex-wrap">
                            <span>🔍 钻取工作台:</span>
                            <span className="bg-white/10 px-2 py-0.5 rounded text-blue-100 font-extrabold uppercase text-xs">
                              {currentSupplier}
                            </span>
                          </h4>
                          <p className="text-[10px] text-blue-100/70 font-medium">
                            对该厂家下所有分店的申报计划进行查看、汇总、一键补货和会签直发。
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSelectGroup(currentSupplier)}
                            className="bg-white/15 hover:bg-white/25 text-white border border-white/20 font-black px-2.5 py-1 rounded text-[10px] transition-all cursor-pointer"
                          >
                            {isGroupSelected ? '❌ 取消全厂勾选' : '✔️ 一键勾选全厂'}
                          </button>
                        </div>
                      </div>

                      {/* Warnings & Advice Area to prevent missed orders */}
                      <div className="p-3 bg-slate-50 border-b border-slate-100 space-y-2 text-left">
                        {uncheckedInGroup.length > 0 ? (
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-amber-900 text-[11px] font-bold animate-fadeIn">
                            <div className="flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 animate-bounce" />
                              <span>⚠️ [ 漏下单预警 ]：当前该厂家共有 <strong className="text-rose-600 text-xs font-mono">{uncheckedInGroup.length}</strong> 款分店提报的商品尚未勾选，未合并下单！</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const allGroupIds = entries.map(o => o.id);
                                setSelectedOrderIds(Array.from(new Set([...selectedOrderIds, ...allGroupIds])));
                              }}
                              className="sm:ml-auto underline text-blue-700 hover:text-blue-950 cursor-pointer font-extrabold flex items-center gap-0.5 whitespace-nowrap"
                            >
                              👉 点击一键全选该厂商品，避免漏单
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg text-emerald-800 text-[11px] font-bold">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>完美覆盖：该厂待派送的所有分店申领货项已被 <span className="bg-emerald-600 text-white font-mono rounded px-1.5 text-[9px] py-0.2">100% 勾选</span> 完毕，无采购遗漏隐患！</span>
                          </div>
                        )}
                      </div>

                      {/* Split list by branch */}
                      <div className="p-4 space-y-4 max-h-[800px] overflow-y-auto">
                        {Object.entries(ordersByBranch).map(([branchName, branchOrders]) => {
                          const branchTotalQty = branchOrders.reduce((sum, o) => sum + o.quantity, 0);
                          return (
                            <div key={branchName} className="border border-slate-200/85 rounded-xl overflow-hidden bg-white shadow-3xs">
                              {/* Store header card */}
                              <div className="bg-slate-50/90 px-3 py-2 border-b border-slate-150 flex items-center justify-between text-xs font-bold text-slate-800">
                                <div className="flex items-center gap-1.5">
                                  <span>🏪</span>
                                  <span className="font-extrabold text-slate-800 text-xs md:text-sm bg-slate-200 px-2 py-0.5 rounded">{branchName}分店</span>
                                  <span className="text-[10px] text-slate-400 font-normal">
                                    提交了该供应商商品：{branchOrders.length} 款
                                  </span>
                                </div>
                                <div className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-150">
                                  分店下达总量：{branchTotalQty} 件
                                </div>
                              </div>

                              {/* Branch specific orders table */}
                              <div className="overflow-x-auto text-xs">
                                <table className="w-full text-left min-w-[700px]">
                                  <thead>
                                    <tr className="text-slate-400 border-b border-slate-100 text-[9px] font-extrabold uppercase">
                                      <th className="py-2 px-3 w-10 text-center">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const branchIds = branchOrders.map(o => o.id);
                                            const allChecked = branchIds.every(id => selectedOrderIds.includes(id));
                                            if (allChecked) {
                                              setSelectedOrderIds(prev => prev.filter(id => !branchIds.includes(id)));
                                            } else {
                                              setSelectedOrderIds(prev => Array.from(new Set([...prev, ...branchIds])));
                                            }
                                          }}
                                          className="text-slate-400 hover:text-blue-600 transition-colors inline-block cursor-pointer"
                                          title="全选/反选该分店本期所有申报单"
                                        >
                                          {branchOrders.every(o => selectedOrderIds.includes(o.id)) ? (
                                            <CheckSquare className="w-4.5 h-4.5 text-blue-600" />
                                          ) : (
                                            <Square className="w-4.5 h-4.5 text-slate-350" />
                                          )}
                                        </button>
                                      </th>
                                      <th className="py-2 px-3">申领商品明细</th>
                                      <th className="py-2 px-3">型号规格</th>
                                      <th className="py-2 px-3 text-center bg-blue-50/20 text-blue-900">分店订单量</th>
                                      <th className="py-2 px-3 text-center bg-amber-50/30 text-amber-900 w-44">📦 仓库库存确认 & 补货加注</th>
                                      <th className="py-2 px-3 text-center bg-indigo-50 text-indigo-950 font-extrabold">最终一键投产量</th>
                                      {showPrices && (
                                        <>
                                          <th className="py-2 px-3 text-center bg-teal-50 text-teal-950 font-extrabold w-22">上次价格</th>
                                          <th className="py-2 px-3 text-center bg-rose-50 text-rose-950 font-extrabold w-22">本次价格</th>
                                        </>
                                      )}
                                      <th className="py-2 px-3 text-center">指派跟单 (可提单)</th>
                                      <th className="py-2 px-3 text-center w-16">单挑管理</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {branchOrders.map(order => {
                                      const isChecked = selectedOrderIds.includes(order.id);
                                      const hash = order.productCode.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
                                      const mockStock = (hash * 13) % 45; 
                                      const isStockLow = mockStock < 15;

                                      const extraStr = extraReplenishQty[order.id] || '';
                                      const extraVal = parseInt(extraStr, 10) || 0;
                                      const finalTotalQty = order.quantity + extraVal;

                                      return (
                                        <tr 
                                          key={order.id}
                                          onClick={() => handleSelectToggle(order.id)}
                                          className={`group transition-all cursor-pointer ${
                                            isChecked 
                                              ? 'bg-blue-50/15 font-medium' 
                                              : 'hover:bg-slate-50/30'
                                          }`}
                                        >
                                          {/* Checkbox */}
                                          <td className="py-2.5 px-3 text-center" onClick={e => e.stopPropagation()}>
                                            <button
                                              type="button"
                                              onClick={() => handleSelectToggle(order.id)}
                                              className="text-slate-400 hover:text-blue-600 transition-transform active:scale-95 cursor-pointer"
                                            >
                                              {isChecked ? (
                                                <CheckSquare className="w-4 h-4 text-blue-600" />
                                              ) : (
                                                <Square className="w-4 h-4" />
                                              )}
                                            </button>
                                          </td>

                                          {/* Item details */}
                                          <td className="py-2.5 px-3 text-left">
                                            <span className="font-bold text-slate-900 block">{order.productName}</span>
                                            <span className="text-[9px] text-slate-400 font-mono block mt-0.5">CODE: {order.productCode}</span>
                                            
                                            {order.isUrgent && (
                                              <span className="inline-block bg-rose-100 text-rose-700 text-[8px] px-1.5 py-0.2 rounded font-black border border-rose-200 mt-0.5 animate-pulse">
                                                ⚡ 加急申报
                                              </span>
                                            )}

                                            {/* Remark view */}
                                            <div className="mt-1 flex flex-wrap gap-1 items-center" onClick={e => e.stopPropagation()}>
                                              {order.remark ? (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-850 border border-purple-200">
                                                  🏪 【分店备注】: {order.remark}
                                                </span>
                                              ) : (
                                                <span className="text-[9px] text-slate-400 font-normal italic">暂无留言备注</span>
                                              )}
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setEditingRemarkOrder(order);
                                                  setNewRemarkText(order.remark || '');
                                                }}
                                                className="px-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-bold rounded text-[8px] cursor-pointer"
                                              >
                                                批注
                                              </button>
                                            </div>

                                            {/* Special direct approval */}
                                            {order.orderType === 'custom' && ['直发', '厂家直发', '厂里直发', '工厂直发'].some(k => (order.remark || '').includes(k)) && (
                                              <div className="mt-1.5 p-1 bg-purple-50 border border-purple-150 rounded space-y-1 w-fit" onClick={e => e.stopPropagation()}>
                                                <div className="text-[8px] font-bold text-purple-700 flex items-center gap-1">
                                                  <span>直发会签审核判决：</span>
                                                  {!order.directDispatchApproved || order.directDispatchApproved === 'pending' ? (
                                                    <span className="px-1 bg-purple-100 text-purple-800 rounded font-black animate-pulse">待决</span>
                                                  ) : order.directDispatchApproved === 'approved' ? (
                                                    <span className="px-1 bg-emerald-100 text-emerald-800 rounded font-black">通过</span>
                                                  ) : (
                                                    <span className="px-1 bg-rose-100 text-rose-800 rounded font-black">否决</span>
                                                  )}
                                                </div>
                                                {(!order.directDispatchApproved || order.directDispatchApproved === 'pending') && (
                                                  <div className="flex gap-1">
                                                    <button
                                                      type="button"
                                                      onClick={() => handleAuditDirectDispatch(order.id, true)}
                                                      className="px-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[8px] font-extrabold rounded cursor-pointer"
                                                    >
                                                      同意
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => handleAuditDirectDispatch(order.id, false)}
                                                      className="px-1 bg-rose-600 hover:bg-rose-700 text-white text-[8px] font-extrabold rounded cursor-pointer"
                                                    >
                                                      否决
                                                    </button>
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </td>

                                          {/* Specs */}
                                          <td className="py-2.5 px-3 text-slate-600 font-bold font-mono text-left">{order.specs}</td>

                                          {/* Order quantity */}
                                          <td className="py-2.5 px-3 text-center text-slate-800 font-black font-mono bg-blue-50/5">
                                            {order.quantity}
                                          </td>

                                          {/* Stock and replenishment input */}
                                          <td className="py-2.5 px-3 text-center bg-amber-50/5" onClick={e => e.stopPropagation()}>
                                            <div className="flex items-center justify-center gap-1">
                                              <span className={`w-1 h-1 rounded-full ${isStockLow ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`}></span>
                                              <span className={`text-[8px] font-extrabold ${isStockLow ? 'text-rose-600' : 'text-slate-400'}`}>
                                                {isStockLow ? `仅剩 ${mockStock} 件` : `充足 (${mockStock})`}
                                              </span>
                                            </div>
                                            
                                            <div className="flex items-center justify-center gap-1 mt-1 max-w-[110px] mx-auto">
                                              <input
                                                type="number"
                                                min="0"
                                                placeholder="+ 补货量"
                                                value={extraStr}
                                                onChange={e => {
                                                  const val = e.target.value;
                                                  setExtraReplenishQty(prev => ({
                                                    ...prev,
                                                    [order.id]: val
                                                  }));
                                                }}
                                                className="w-16 px-1 py-0.5 border border-amber-300 rounded text-center text-xs text-blue-600 font-extrabold font-mono bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                              />
                                            </div>
                                          </td>

                                          {/* Result qty */}
                                          <td className="py-2.5 px-3 text-center bg-indigo-50/15">
                                            <span className="text-slate-500 font-mono text-[9px] block">
                                              {order.quantity} + {extraVal}
                                            </span>
                                            <strong className={`font-mono text-xs block mt-0.5 ${isChecked ? 'text-indigo-600' : 'text-slate-700'}`}>
                                              = {finalTotalQty} 件
                                            </strong>
                                          </td>

                                          {/* Price comparison columns */}
                                          {showPrices && (
                                            <>
                                              <td className="py-2.5 px-3 text-center bg-teal-50/10" onClick={e => e.stopPropagation()}>
                                                <input
                                                  type="number"
                                                  min="0"
                                                  step="0.01"
                                                  value={order.previousPrice !== undefined ? order.previousPrice : ''}
                                                  onChange={async (e) => {
                                                    const prevVal = parseFloat(e.target.value) || 0;
                                                    await DbService.updateOrderPrices(order.id, prevVal, order.currentPrice || 0, { id: currentUser.id, name: currentUser.username, role: currentUser.role });
                                                  }}
                                                  placeholder="上次价 ¥"
                                                  className="w-16 px-1 py-0.5 border border-teal-300 rounded text-center text-xs text-teal-800 font-bold bg-white font-mono focus:outline-none focus:ring-1 focus:ring-teal-500"
                                                />
                                              </td>
                                              <td className="py-2.5 px-3 text-center bg-rose-50/10" onClick={e => e.stopPropagation()}>
                                                <input
                                                  type="number"
                                                  min="0"
                                                  step="0.01"
                                                  value={order.currentPrice !== undefined ? order.currentPrice : ''}
                                                  onChange={async (e) => {
                                                    const currVal = parseFloat(e.target.value) || 0;
                                                    await DbService.updateOrderPrices(order.id, order.previousPrice || 0, currVal, { id: currentUser.id, name: currentUser.username, role: currentUser.role });
                                                  }}
                                                  placeholder="本次价 ¥"
                                                  className="w-16 px-1 py-0.5 border border-rose-300 rounded text-center text-xs text-rose-800 font-bold bg-white font-mono focus:outline-none focus:ring-1 focus:ring-rose-500"
                                                />
                                              </td>
                                            </>
                                          )}

                                          {/* Scheduler */}
                                          <td className="py-2.5 px-3 text-center" onClick={e => e.stopPropagation()}>
                                            <select
                                              value={order.merchandiserName || ''}
                                              onChange={e => handleUpdateOrderMerchandiser(order.id, e.target.value)}
                                              className="text-[9px] px-1 py-0.5 border border-slate-200 rounded text-slate-700 font-semibold focus:outline-none bg-white font-semibold"
                                            >
                                              <option value="">-- 指派采购 --</option>
                                              {procurementStaff.map(u => (
                                                <option key={u.id} value={u.username}>
                                                  {u.username}
                                                </option>
                                              ))}
                                            </select>
                                          </td>

                                          {/* Action */}
                                          <td className="py-2.5 px-3 text-center" onClick={e => e.stopPropagation()}>
                                            <div className="flex flex-col gap-1 items-center justify-center">
                                              <button
                                                type="button"
                                                onClick={() => handleEditOrder(order)}
                                                className="px-1.5 py-0.5 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 font-bold rounded text-[9.5px] cursor-pointer"
                                                title="更改数量、规格型号、指派供应商"
                                              >
                                                🖊️ 更改
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleSingleCancelOrder(order.id, order.orderNo, order.productName)}
                                                className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 border border-rose-220 text-rose-600 rounded font-bold text-[9.5px] cursor-pointer"
                                                title="把原分店订单作废撤销"
                                              >
                                                ❌ 撤单
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Supplier direct confirmations footer actions */}
                      <div className="bg-slate-50 px-4 py-3 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
                        <div className="text-[10px] font-bold text-slate-500 text-left">
                          {selectedInGroup.length > 0 ? (
                            <span className="text-blue-700">
                              ℹ️ 本厂当前已勾选 <strong>{selectedInGroup.length}</strong> 款进行投产 (包含补货，合计：
                              <strong>
                                {selectedInGroup.reduce((acc, order) => {
                                  const addOn = parseInt(extraReplenishQty[order.id], 10) || 0;
                                  return acc + order.quantity + addOn;
                                }, 0)}
                              </strong> 件)
                            </span>
                          ) : (
                            <span className="text-rose-600">⚠️ 未选择任何商品行，无法生成排产合同</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleBuildSupplierPO(currentSupplier, entries)}
                            disabled={selectedInGroup.length === 0 || isGenerating}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] px-4 py-1.5 border-b border-indigo-800 rounded-lg shadow-sm transition-colors cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:border-none"
                          >
                            🏭 确认向该生产厂 [ {currentSupplier} ] 派单投产
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}



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
                                {showPrices && (
                                  <>
                                    <th className="p-2 font-semibold text-teal-800 text-center w-22 bg-teal-50/50">上次单价</th>
                                    <th className="p-2 font-semibold text-rose-800 text-center w-22 bg-rose-50/50">本次单价</th>
                                  </>
                                )}
                                <th className="p-2 font-mono text-center w-20">已收数量</th>
                                <th className="p-2 font-semibold text-rose-600 font-mono text-center w-20 bg-rose-50/10">当前欠货</th>
                                <th className="p-2 text-center w-32 font-bold text-blue-700">本次到货登录</th>
                                <th className="p-2 text-center w-40 font-bold text-amber-800 bg-amber-50/30">🔍 采购单据操作</th>
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
                                    {showPrices && (
                                      <>
                                        <td className="p-2 text-center bg-teal-50/10 font-bold text-teal-800 font-mono">
                                          {order.previousPrice !== undefined ? `¥${order.previousPrice}` : '未指定'}
                                        </td>
                                        <td className="p-2 text-center bg-rose-50/10 font-bold text-rose-800 font-mono">
                                          {order.currentPrice !== undefined ? `¥${order.currentPrice}` : '未指定'}
                                        </td>
                                      </>
                                    )}
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
                                    <td className="p-2 text-center" onClick={e => e.stopPropagation()}>
                                      <div className="flex flex-col gap-1 items-center justify-center">
                                        <div className="flex gap-1 justify-center">
                                          <button
                                            type="button"
                                            onClick={() => handleEditOrder(order)}
                                            className="px-1.5 py-0.5 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 font-bold rounded text-[9.5px] cursor-pointer"
                                            title="更改数量、规格型号、指派供应商"
                                          >
                                            🖊️ 更改
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteOrderInManage(order)}
                                            className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold rounded text-[9.5px] cursor-pointer"
                                            title="从当前采购履约单中强制删除、作废这单商品"
                                          >
                                            🗑️ 删除
                                          </button>
                                        </div>
                                        {short > 0 && (
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              if (window.confirm(`确认要把此单的缺货量 [${short}件] 进行一键拆分并转结为新补货单吗？此操作将把原单的预购量限制为当前的实收量 [${received}件]（即在原单中不再拖欠），并在采购中创建一条全新的补位采购单，状态置为待采购。`)) {
                                                try {
                                                  await DbService.createCarryOverOrder(order.id, {
                                                    id: currentUser.id,
                                                    name: currentUser.username,
                                                    role: currentUser.role
                                                  });
                                                  alert('已成功生成补发重拍流水！原单缺货已安全结算不再拖欠，补位新单已送达待合并采购池。');
                                                } catch (err: any) {
                                                  alert(err.message || '转单失败');
                                                }
                                              }
                                            }}
                                            className="px-1.5 py-0.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded text-[8px] cursor-pointer shadow-3xs transition-all"
                                            title="生成新订单补发并标记原单不再欠货"
                                          >
                                            ⚡ 结转新单补发
                                          </button>
                                        )}
                                      </div>
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowDirectImportPanel(!showDirectImportPanel)}
                  className="flex items-center gap-1 px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-md text-xs font-bold transition-all cursor-pointer"
                >
                  <span>📥 导入当次订单 (Excel/文本)</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddDirectItemRow}
                  className="flex items-center gap-1 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-md text-xs font-bold transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>新增一栏货品款式</span>
                </button>
              </div>
            </div>

            {showDirectImportPanel && (
              <div className="p-4 bg-amber-50/40 border border-amber-200/60 rounded-xl space-y-4 text-left">
                <div>
                  <h5 className="font-bold text-slate-800 text-xs text-amber-900">📥 智能采购订单导入</h5>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    请选择直接读取 Excel / CSV 文件，或在下方输入框粘贴多行货品字段（由空格/Tab或逗号分割，列顺序：商品编码、名称、规格、订单量、上次价、本次价）。
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-slate-600">方案 A：读取 Excel 工作簿 / CSV 表格 (.xlsx, .csv)</label>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileDirectImport}
                      className="block w-full text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200 cursor-pointer"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-slate-600">方案 B：直接复制微信/QQ货品文字批量粘贴</label>
                    <textarea
                      placeholder="格式如：&#10;PROD-A01 九牧暗装水龙头 SS-901 10 15.5 16.0&#10;PROD-B05 飞利浦吊灯 PL-M50W 25 45.0 46.5"
                      value={directImportText}
                      onChange={e => setDirectImportText(e.target.value)}
                      className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg h-24 focus:ring-1 focus:ring-amber-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handlePastedTextDirectImport}
                      className="px-4 py-1.5 bg-amber-650 hover:bg-amber-700 text-white rounded font-bold text-xs cursor-pointer shadow-2xs"
                    >
                      ⚡ 识别并导入粘贴板文本
                    </button>
                  </div>
                </div>
              </div>
            )}

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
                    {showPrices && (
                      <>
                        <th className="p-3 w-22 text-center text-teal-850 font-bold bg-teal-50">上次价格 (元)</th>
                        <th className="p-3 w-22 text-center text-rose-850 font-bold bg-rose-50">本次价格 (元)</th>
                      </>
                    )}
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
                        {item.productCode && salesRefs[item.productCode] && (
                          <div className="mt-1.2 flex flex-wrap gap-1.5 items-center text-[10px] font-bold">
                            <span className="text-slate-400">📈 参谋:</span>
                            <span className="text-indigo-600 bg-indigo-50/50 px-1.5 py-0.5 rounded-md">近3月均销 {salesRefs[item.productCode].avg3Months} 件</span>
                            <span className="text-teal-600 bg-teal-50/50 px-1.5 py-0.5 rounded-md">去年同月销 {salesRefs[item.productCode].lastYearSameMonth} 件</span>
                          </div>
                        )}
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
                      {showPrices && (
                        <>
                          <td className="p-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.previousPrice !== undefined ? item.previousPrice : ''}
                              onChange={e => handleDirectItemChange(idx, 'previousPrice', parseFloat(e.target.value) || 0)}
                              placeholder="上次价 ¥"
                              className="w-full p-1.5 border border-slate-200 rounded-lg text-center text-xs font-mono text-teal-800 font-semibold bg-white focus:ring-1 focus:ring-teal-500 focus:outline-none"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.currentPrice !== undefined ? item.currentPrice : ''}
                              onChange={e => handleDirectItemChange(idx, 'currentPrice', parseFloat(e.target.value) || 0)}
                              placeholder="本次价 ¥"
                              className="w-full p-1.5 border border-slate-200 rounded-lg text-center text-xs font-mono text-rose-800 font-semibold bg-white focus:ring-1 focus:ring-rose-500 focus:outline-none"
                            />
                          </td>
                        </>
                      )}
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

      {activeSubTab === 'sales_history' && (
        <div className="bg-white p-5 border border-slate-100 rounded-xl space-y-6 text-left shadow-sm">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm md:text-base flex items-center gap-2">
                <span className="p-1 bg-blue-50 text-blue-600 rounded">📊</span>
                全国分店月度销量 & 历史销售数量参考系统
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                此页面专为采购跟单决策量身订做。可一键钻取各主要分店在不同年份、月份下的累计采购提报与消费流水，降低库存积压。
              </p>
            </div>
            
            {salesRecords.length > 0 && (
              <button
                onClick={generateMockSalesRecords}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-650 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                title="重置或生成全新模拟销量账"
              >
                <span>🔁 重置/重新生成演示销量</span>
              </button>
            )}
          </div>

          {/* If No Data Screen */}
          {salesRecords.length === 0 ? (
            <div className="p-12 border-2 border-dashed border-slate-200 rounded-2xl text-center max-w-2xl mx-auto space-y-4 my-6">
              <span className="text-5xl block animate-pulse">📈</span>
              <h4 className="font-extrabold text-slate-800 text-base">体验未激活：暂缺历史销量流水数据</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                当前系统数据库中尚未导入或同步分店以往周期的月度销售数量总帐。我们为您准备了极简的数据填充器，只需轻点下方按钮，系统将立即在后台生成并写入 <strong className="text-blue-600">近三年 (2024 - 2026) 5 大分店、所有已登记货项</strong> 的高保真模拟销售销量。
              </p>
              <button
                type="button"
                onClick={generateMockSalesRecords}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 mx-auto"
              >
                <span>🔮 一键一秒注入三年模拟演示销售数据集</span>
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Filter Area */}
              <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 md:p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Search Query */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">🔍 搜索商品</label>
                    <input
                      type="text"
                      placeholder="检索商品名称、货号或首字母..."
                      value={salesSearchQuery}
                      onChange={e => setSalesSearchQuery(e.target.value)}
                      className="w-full text-xs p-2.5 bg-white border border-slate-250 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
                    />
                  </div>

                  {/* Branch Select */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">🏪 统计统计分店</label>
                    <select
                      value={salesBranchFilter}
                      onChange={e => setSalesBranchFilter(e.target.value)}
                      className="w-full text-xs p-2.5 bg-white border border-slate-250 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 font-semibold"
                    >
                      <option value="all">📁 全国全分店总合计 (五大主要分店)</option>
                      {Array.from(new Set(salesRecords.map(r => r.branchName))).map(b => (
                        <option key={b} value={b}>🏪 {b}</option>
                      ))}
                    </select>
                  </div>

                  {/* Multi-Select Year */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">📅 年限多选汇总 ({selectedYears.length}个活跃年份)</label>
                    <div className="flex flex-wrap items-center gap-3 p-1.5 bg-white border border-slate-250 rounded-lg min-h-[38px] px-3">
                      {Array.from(new Set(salesRecords.map(r => r.month.split('-')[0]))).sort().map(y => {
                        const isChecked = selectedYears.includes(y);
                        return (
                          <label key={y} className="flex items-center gap-1 text-xs text-slate-700 font-semibold cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedYears(selectedYears.filter(year => year !== y));
                                } else {
                                  setSelectedYears([...selectedYears, y]);
                                }
                              }}
                              className="rounded text-blue-600 cursor-pointer focus:ring-1 focus:ring-blue-500 w-3.5 h-3.5"
                            />
                            <span>{y}年</span>
                          </label>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => {
                          const allYears = Array.from(new Set(salesRecords.map(r => r.month.split('-')[0]))).sort();
                          setSelectedYears(selectedYears.length === allYears.length ? [] : allYears);
                        }}
                        className="ml-auto text-[10px] text-blue-600 hover:text-blue-800 font-extrabold cursor-pointer"
                      >
                        {selectedYears.length === Array.from(new Set(salesRecords.map(r => r.month.split('-')[0]))).length ? '全不选' : '快捷全选'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Multi-Select Months Panels */}
                <div className="space-y-2 border-t border-slate-200/60 pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700">🗓️ 活跃月份多选参考栏 ({selectedMonths.length}个选定月份)</span>
                    
                    {/* Month shortcuts */}
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])}
                        className="px-2 py-0.5 bg-slate-200/60 hover:bg-slate-200 text-slate-700 font-extrabold rounded text-[9px] cursor-pointer"
                      >
                        全年全选
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedMonths([1, 2, 3, 4, 5, 6])}
                        className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold rounded text-[9px] cursor-pointer"
                      >
                        上半年 (1-6月)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedMonths([7, 8, 9, 10, 11, 12])}
                        className="px-2 py-0.5 bg-teal-50 hover:bg-teal-100 text-teal-700 font-extrabold rounded text-[9px] cursor-pointer"
                      >
                        下半年 (7-12月)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedMonths([])}
                        className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold rounded text-[9px] cursor-pointer"
                      >
                        清选空
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2 bg-white p-3 rounded-lg border border-slate-250">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
                      const isChecked = selectedMonths.includes(m);
                      return (
                        <label 
                          key={m} 
                          className={`flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-md border text-xs font-bold cursor-pointer select-none transition-all ${
                            isChecked 
                              ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-3xs' 
                              : 'bg-slate-50/55 hover:bg-slate-50 text-slate-400 border-slate-150'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setSelectedMonths(selectedMonths.filter(month => month !== m));
                              } else {
                                setSelectedMonths([...selectedMonths, m].sort((a,b)=>a-b));
                              }
                            }}
                            className="rounded text-blue-600 focus:ring-0 cursor-pointer w-3.2 h-3.2"
                          />
                          <span>{m}月</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto border border-slate-100 rounded-xl shadow-2xs bg-white">
                <table className="w-full text-left text-xs min-w-[1200px]">
                  <thead className="bg-gradient-to-r from-slate-50 to-slate-100 text-[10px] text-slate-500 font-extrabold uppercase border-b border-slate-150">
                    <tr>
                      <th className="p-3 w-[240px] sticky left-0 bg-slate-50 z-10 border-r border-slate-150 shadow-3xs">商品及资料</th>
                      <th className="p-3 w-[160px] text-center border-r border-slate-150">货号编码 / 首选供应商</th>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
                        const isSelected = selectedMonths.includes(m);
                        return (
                          <th 
                            key={m} 
                            className={`p-3 text-center transition-all ${
                              isSelected ? 'bg-blue-50/50 text-blue-900 border-b-2 border-b-blue-500 font-black' : 'text-slate-350 bg-slate-50/10'
                            }`}
                          >
                            {m}月销数
                          </th>
                        );
                      })}
                      <th className="p-3 text-center bg-blue-600 text-white font-black text-xs">累计总数量</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 text-slate-705">
                    {(() => {
                      const filteredProductsForSales = allProducts.filter(p => {
                        if (!salesSearchQuery) return true;
                        const q = salesSearchQuery.toLowerCase();
                        return p.productName.toLowerCase().includes(q) || p.productCode.toLowerCase().includes(q);
                      });

                      if (filteredProductsForSales.length === 0) {
                        return (
                          <tr>
                            <td colSpan={15} className="p-12 text-center text-slate-400 font-medium">
                              🔍 没有找到任何与过滤匹配的货品销数汇总。
                            </td>
                          </tr>
                        );
                      }

                      // Pre-calculate sales hash table
                      const recordHash: { [key: string]: number } = {};
                      for (const r of salesRecords) {
                        const year = r.month.split('-')[0];
                        const monthNum = parseInt(r.month.split('-')[1], 10);
                        
                        const matchYear = selectedYears.includes(year);
                        const matchBranch = salesBranchFilter === 'all' || r.branchName === salesBranchFilter;
                        
                        if (matchYear && matchBranch) {
                          const hashKey = `${r.productCode}_${monthNum}`;
                          recordHash[hashKey] = (recordHash[hashKey] || 0) + r.quantity;
                        }
                      }

                      // Define column totals
                      const colsTotal: { [month: number]: number } = {};
                      for (const m of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
                        colsTotal[m] = 0;
                      }
                      let totalGrandSum = 0;

                      const rows = filteredProductsForSales.map(p => {
                        const monthVals: { [month: number]: number } = {};
                        let rowSum = 0;
                        
                        for (const m of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
                          const cellVal = recordHash[`${p.productCode}_${m}`] || 0;
                          monthVals[m] = cellVal;
                          
                          if (selectedMonths.includes(m)) {
                            colsTotal[m] += cellVal;
                            rowSum += cellVal;
                          }
                        }
                        totalGrandSum += rowSum;

                        return {
                          product: p,
                          monthVals,
                          rowSum
                        };
                      });

                      return (
                        <>
                          {rows.map(({ product, monthVals, rowSum }) => (
                            <tr key={product.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="p-3 font-semibold text-slate-800 sticky left-0 bg-white z-10 border-r border-slate-150 shadow-3xs">
                                <span className="block text-[11.5px] font-bold text-slate-900 leading-tight">{product.productName}</span>
                                <span className="text-[9px] font-mono text-slate-400 block mt-0.5">规格: {product.specs || '通用'} ｜ 单位: {product.unit || '件'}</span>
                              </td>
                              <td className="p-3 text-center border-r border-slate-150 text-slate-500">
                                <span className="font-mono text-[10.5px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded block w-fit mx-auto">{product.productCode}</span>
                                <span className="text-[9px] text-slate-400 block mt-1 truncate max-w-[120px]">{product.defaultSupplier || '首选货源厂商'}</span>
                              </td>
                              
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
                                const isSelected = selectedMonths.includes(m);
                                const val = monthVals[m] || 0;
                                return (
                                  <td 
                                    key={m} 
                                    className={`p-3 text-center font-mono font-medium transition-colors text-xs ${
                                      isSelected 
                                        ? val > 0 
                                          ? 'bg-blue-50/15 text-blue-700 font-bold' 
                                          : 'bg-blue-50/10 text-slate-300'
                                        : 'text-slate-300 bg-slate-50/10'
                                    }`}
                                  >
                                    {val > 0 ? `${val}` : '-'}
                                  </td>
                                );
                              })}

                              <td className="p-3 text-center bg-blue-50 text-blue-900 font-extrabold text-xs font-mono">
                                {rowSum} <span className="text-[9px] font-normal text-blue-500">{product.unit || '件'}</span>
                              </td>
                            </tr>
                          ))}

                          {/* Summary Row */}
                          <tr className="bg-gradient-to-r from-slate-100 to-slate-200 text-slate-800 font-black border-t border-slate-300">
                            <td className="p-3 font-extrabold sticky left-0 bg-slate-100 z-10 border-r border-slate-300 shadow-3xs">
                              🏆 上述货品列总合计
                            </td>
                            <td className="p-3 text-center border-r border-slate-300 text-slate-600 text-[10px]">
                              包含已选过滤件
                            </td>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
                              const isSelected = selectedMonths.includes(m);
                              const colSum = colsTotal[m] || 0;
                              return (
                                <td 
                                  key={m} 
                                  className={`p-3 text-center font-mono text-xs ${
                                    isSelected 
                                      ? 'bg-blue-100 text-blue-950 font-black' 
                                      : 'text-slate-400 bg-slate-100/10'
                                  }`}
                                >
                                  {colSum > 0 ? `${colSum}` : '-'}
                                </td>
                              );
                            })}
                            <td className="p-3 text-center bg-blue-600 text-white font-semibold text-sm font-mono shadow-inner">
                              {totalGrandSum}
                            </td>
                          </tr>
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Auxiliary guidance card */}
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start gap-3">
                <span className="text-xl">💡</span>
                <div className="text-xs text-blue-800 space-y-1">
                  <div className="font-bold">采购员下单对比秘诀：</div>
                  <p className="leading-relaxed">
                    在多选年限和月份生成合计后，可以直接将上面列表对应的<strong>"累计总数量"</strong>，作为你合并向厂家批量下达【采购协议单】时的<strong>“基准销售参考值”</strong>。可以大幅减少盲目拍脑袋预订所带来的货流呆滞隐患。
                  </p>
                </div>
              </div>
            </div>
          )}
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
