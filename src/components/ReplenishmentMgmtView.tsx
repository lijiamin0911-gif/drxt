import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  FileSpreadsheet, 
  PlusCircle, 
  Trash2, 
  X, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Upload, 
  Download, 
  ShoppingBag, 
  ChevronDown, 
  ChevronUp, 
  Filter, 
  Calendar, 
  ChevronLeft,
  Coins
} from 'lucide-react';
import { 
  IndependentPurchaseOrder, 
  IndependentPurchaseOrderItem, 
  InventoryItem, 
  Product, 
  Order, 
  User 
} from '../types';
import { DbService } from '../lib/dbService';

interface ReplenishmentMgmtProps {
  currentUser: User;
}

export default function ReplenishmentMgmtView({ currentUser }: ReplenishmentMgmtProps) {
  // DB States
  const [independentPOs, setIndependentPOs] = useState<IndependentPurchaseOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active view tabs
  // 'list' = 采购单列表及历史记录
  // 'create-manual' = 手动新增采购单
  // 'create-import' = Excel/CSV一键导入
  // 'create-by-stock' = 基于库存一键生成补货
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'create-manual' | 'create-import' | 'create-by-stock'>('list');

  // Filter configurations
  const [searchPoNo, setSearchPoNo] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending_arrival' | 'completed'>('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Manual Creation States
  const [manualPoNo, setManualPoNo] = useState('');
  const [manualRemarks, setManualRemarks] = useState('');
  const [manualItems, setManualItems] = useState<Partial<IndependentPurchaseOrderItem>[]>([
    { productCode: '', productName: '', specs: '', quantity: 50, supplier: '', remark: '', receivedQty: 0 }
  ]);

  // Excel/CSV Import States
  const [dragActive, setDragActive] = useState(false);
  const [parsedItems, setParsedItems] = useState<IndependentPurchaseOrderItem[]>([]);
  const [importProgress, setImportProgress] = useState<string | null>(null);
  const [importRemarks, setImportRemarks] = useState('批量导入自动生成');

  // Stock-based Replenishment States
  const [selectedStockProductCodes, setSelectedStockProductCodes] = useState<string[]>([]);
  const [stockReplenishQtyMap, setStockReplenishQtyMap] = useState<Record<string, number>>({});
  const [stockReplenishSupplierMap, setStockReplenishSupplierMap] = useState<Record<string, string>>({});

  // Expanded PO State
  const [expandedPoId, setExpandedPoId] = useState<string | null>(null);

  // Status/Arrival record editing panel states
  const [editingPoId, setEditingPoId] = useState<string | null>(null);
  const [editingExpectedArrival, setEditingExpectedArrival] = useState('');
  const [editingFactoryStatus, setEditingFactoryStatus] = useState<'unconfirmed' | 'confirmed'>('unconfirmed');
  const [arrivalInputMap, setArrivalInputMap] = useState<Record<string, string>>({}); // productCode -> amount input

  // Load Data
  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const pos = await DbService.getIndependentPurchaseOrders();
      const inv = await DbService.getInventory();
      const prods = await DbService.getProducts();
      const ords = await DbService.getOrders();
      
      // Sort pos newest first
      pos.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      setIndependentPOs(pos);
      setInventory(inv);
      setProducts(prods);
      setOrders(ords);
    } catch (err) {
      console.error('Failed to load data in Replenishment View:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
    // Subscribe to DB changes
    const unsubscribe = DbService.onChange(() => {
      loadAllData();
    });
    return () => unsubscribe();
  }, []);

  // Compute unique suppliers from both records, products and suppliers table
  const uniqueSuppliers = useMemo(() => {
    const suppliersSet = new Set<string>();
    products.forEach(p => {
      if (p.defaultSupplier) suppliersSet.add(p.defaultSupplier);
    });
    independentPOs.forEach(po => {
      po.items.forEach(item => {
        if (item.supplier) suppliersSet.add(item.supplier);
      });
    });
    return Array.from(suppliersSet);
  }, [products, independentPOs]);

  // Generate automated PO number
  const generateNewPoNo = () => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `PO-REPL-${dateStr}-${rand}`;
  };

  useEffect(() => {
    if (activeSubTab === 'create-manual') {
      setManualPoNo(generateNewPoNo());
      setManualRemarks('');
      setManualItems([{ productCode: '', productName: '', specs: '', quantity: 50, supplier: '', remark: '', receivedQty: 0 }]);
    }
  }, [activeSubTab]);

  // CSV Template download
  const downloadTemplate = (e: React.MouseEvent) => {
    e.preventDefault();
    const headers = ['产品编码', '产品名称', '规格型号', '采购数量', '供应商', '备注'];
    const row = ['CP-1025', '球阀法兰 DN50', 'DN50-PN16 直面', '100', '永嘉阀门制造厂', '日常补库'];
    const csvContent = "\uFEFF" + [headers.join(','), row.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.id = 'download_replenishment_template_btn';
    link.setAttribute('href', url);
    link.setAttribute('download', '自主采购补货单批量导入模板.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Drag and drop file parser
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      parseCSVFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      parseCSVFile(e.target.files[0]);
    }
  };

  const parseCSVFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        if (lines.length < 2) {
          alert('CSV格式异常：未检测到有效的数据行数！');
          return;
        }

        const rawItems: IndependentPurchaseOrderItem[] = [];
        // Skip header
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
          if (cols.length < 4) continue; // Must contain at least Code, Name, Specs, Qty
          
          const productCode = cols[0];
          const productName = cols[1];
          const specs = cols[2];
          const qty = parseInt(cols[3]) || 0;
          const supplier = cols[4] || '默认常规厂商';
          const remark = cols[5] || '';

          if (!productCode || !productName) continue;

          // Check if system has this product already
          const exists = products.some(p => p.productCode.toLowerCase() === productCode.toLowerCase());

          rawItems.push({
            productCode,
            productName,
            specs,
            quantity: qty <= 0 ? 50 : qty,
            supplier,
            remark,
            receivedQty: 0,
            isNew: !exists
          });
        }

        setParsedItems(rawItems);
        alert(`CSV文件解析成功！共解析到 ${rawItems.length} 项采购项。`);
      } catch (err) {
        console.error(err);
        alert('解析CSV文件失败，请检查编码格式是否为UTF-8、内容是否标准。');
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  // Submit manual creation
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate rows
    const validItems: IndependentPurchaseOrderItem[] = [];
    for (const item of manualItems) {
      if (!item.productCode || !item.productName || !item.supplier) {
        alert('请务必填写每一行的产品编码、产品名称与供应商！');
        return;
      }
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) {
        alert('补货数量必须大于0！');
        return;
      }

      const exists = products.some(p => p.productCode.toLowerCase() === item.productCode!.trim().toLowerCase());

      validItems.push({
        productCode: item.productCode.trim(),
        productName: item.productName.trim(),
        specs: (item.specs || '').trim(),
        quantity: qty,
        supplier: item.supplier.trim(),
        remark: (item.remark || '').trim(),
        receivedQty: 0,
        isNew: !exists
      });
    }

    if (validItems.length === 0) {
      alert('请添加至少一件采购产品。');
      return;
    }

    const newPO: IndependentPurchaseOrder = {
      id: `po_ind_${Date.now()}`,
      poNo: manualPoNo,
      orderDate: new Date().toISOString().slice(0, 10),
      status: 'pending_arrival',
      remarks: manualRemarks,
      items: validItems,
      factoryStatus: 'unconfirmed',
      createdAt: new Date().toISOString()
    };

    try {
      // Process "新品" direct additions if any
      await checkAndRegisterNewProducts(validItems);

      // Save PO
      await DbService.saveIndependentPurchaseOrder(newPO, {
        id: currentUser.id,
        name: currentUser.username,
        role: currentUser.role
      });

      // Audit log
      await DbService.log(
        currentUser.id,
        currentUser.username,
        currentUser.role,
        '自主发起采购单',
        `新增手动采购单 [${manualPoNo}]，共 ${validItems.length} 行商品`
      );

      alert(`✅ 自主采购单 ${manualPoNo} 创建并成功送达厂商处理！`);
      setActiveSubTab('list');
    } catch (err) {
      console.error(err);
      alert('创建采购单失败，请重试');
    }
  };

  // Save unknown imported products automatically as UNAPPROVED standard products
  const checkAndRegisterNewProducts = async (items: IndependentPurchaseOrderItem[]) => {
    const freshProductsList = await DbService.getProducts();
    for (const item of items) {
      const match = freshProductsList.find(p => p.productCode.toLowerCase() === item.productCode.toLowerCase());
      if (!match) {
        // Automatically inject as unapproved "新品"
        const newProd: Product = {
          id: `prod_${Date.now()}_raw_${Math.random().toString(36).substring(2, 6)}`,
          productCode: item.productCode,
          productName: item.productName,
          specs: item.specs,
          unit: '件',
          defaultSupplier: item.supplier,
          isApproved: false, // Wait for admin confirmation to standardize
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await DbService.saveProduct(newProd, {
          id: currentUser.id,
          name: currentUser.username,
          role: currentUser.role
        });
      }
    }
  };

  // Submit Bulk Upload PO
  const handleImportSubmit = async () => {
    if (parsedItems.length === 0) {
      alert('没有需要导入的采购明细！');
      return;
    }

    const newPoNo = generateNewPoNo();
    const newPO: IndependentPurchaseOrder = {
      id: `po_ind_${Date.now()}`,
      poNo: newPoNo,
      orderDate: new Date().toISOString().slice(0, 10),
      status: 'pending_arrival',
      remarks: importRemarks,
      items: parsedItems,
      factoryStatus: 'unconfirmed',
      createdAt: new Date().toISOString()
    };

    try {
      await checkAndRegisterNewProducts(parsedItems);

      await DbService.saveIndependentPurchaseOrder(newPO, {
        id: currentUser.id,
        name: currentUser.username,
        role: currentUser.role
      });

      await DbService.log(
        currentUser.id,
        currentUser.username,
        currentUser.role,
        '导入Excel采购单',
        `导入并在厂家建立起补货单 [${newPoNo}]，共批量提交 ${parsedItems.length} 项货品商品`
      );

      alert(`✅ 批量Excel导入采购单成功！单号: ${newPoNo}`);
      setParsedItems([]);
      setActiveSubTab('list');
    } catch (err) {
      console.error(err);
      alert('导入提交错误，请稍后重试');
    }
  };

  // Based on low-inventory items, pre-fill order selection
  // Filter Inventory Safety thresholds
  const lowStockItems = useMemo(() => {
    return inventory.filter(item => {
      const current = item.currentStock || 0;
      const safe = item.safeStock || 0;
      return current <= 0 || current < safe;
    });
  }, [inventory]);

  // Set default values for stock replenishments
  useEffect(() => {
    const updatedQty: Record<string, number> = {};
    const updatedSup: Record<string, string> = {};
    lowStockItems.forEach(item => {
      // Deficiency gap
      const gap = Math.max(50, (item.safeStock || 0) - (item.currentStock || 0));
      updatedQty[item.productCode] = gap;
      updatedSup[item.productCode] = item.supplier || '常备优选厂';
    });
    setStockReplenishQtyMap(updatedQty);
    setStockReplenishSupplierMap(updatedSup);
  }, [lowStockItems]);

  // Submit stock-based replenishment selection
  const handleStockReplenishSubmit = async () => {
    if (selectedStockProductCodes.length === 0) {
      alert('请在左侧勾选您本次希望一键补货的缺口货品！');
      return;
    }

    const generatedItems: IndependentPurchaseOrderItem[] = [];
    for (const code of selectedStockProductCodes) {
      const invItem = inventory.find(i => i.productCode === code);
      if (!invItem) continue;

      const qty = stockReplenishQtyMap[code] || 50;
      const supplier = stockReplenishSupplierMap[code] || invItem.supplier || '未指定供应商';

      generatedItems.push({
        productCode: code,
        productName: invItem.productName,
        specs: invItem.specs,
        quantity: qty,
        supplier: supplier,
        receivedQty: 0,
        isNew: false
      });
    }

    const newPoNo = generateNewPoNo();
    const newPO: IndependentPurchaseOrder = {
      id: `po_ind_${Date.now()}`,
      poNo: newPoNo,
      orderDate: new Date().toISOString().slice(0, 10),
      status: 'pending_arrival',
      remarks: '基于安全库存自动一键算料生成',
      items: generatedItems,
      factoryStatus: 'unconfirmed',
      createdAt: new Date().toISOString()
    };

    try {
      await DbService.saveIndependentPurchaseOrder(newPO, {
        id: currentUser.id,
        name: currentUser.username,
        role: currentUser.role
      });

      await DbService.log(
        currentUser.id,
        currentUser.username,
        currentUser.role,
        '一键生成补货单',
        `智能库存算料补货：创建了采购单 [${newPoNo}]，多选自动订购 ${generatedItems.length} 件待补货品`
      );

      alert(`✅ 智能补货单一键派单成功！单号: ${newPoNo}`);
      setSelectedStockProductCodes([]);
      setActiveSubTab('list');
    } catch (err) {
      console.error(err);
      alert('生成补货指令单失败，请检查各字段');
    }
  };

  // Edit PO state variables (Expected Date & Factory Status)
  const startEditingPo = (po: IndependentPurchaseOrder) => {
    setEditingPoId(po.id);
    setEditingExpectedArrival(po.expectedArrivalDate || '');
    setEditingFactoryStatus(po.factoryStatus || 'unconfirmed');
  };

  const saveEditedPoHeader = async (po: IndependentPurchaseOrder) => {
    const updated: IndependentPurchaseOrder = {
      ...po,
      expectedArrivalDate: editingExpectedArrival,
      factoryStatus: editingFactoryStatus
    };

    try {
      await DbService.saveIndependentPurchaseOrder(updated, {
        id: currentUser.id,
        name: currentUser.username,
        role: currentUser.role
      });

      await DbService.log(
        currentUser.id,
        currentUser.username,
        currentUser.role,
        '更正采购单协议',
        `更新了独立采购单 ${po.poNo} 的厂家确认状态为 [${editingFactoryStatus === 'confirmed' ? '已确认下单' : '待协调'}] 且预计交期设定 [${editingExpectedArrival || '待定'}]`
      );

      setEditingPoId(null);
      alert('采购物流排产信息保存成功！');
    } catch (err) {
      console.error(err);
      alert('更新保存失败，请检查网络');
    }
  };

  // CORE LOGIC: Commit actual received quantities row by row, offset branch shortages first, prioritizing by earliest, then general inventory!
  const recordRowArrival = async (po: IndependentPurchaseOrder, itemIndex: number) => {
    const item = po.items[itemIndex];
    const rawInputVal = arrivalInputMap[`${po.id}_${item.productCode}`];
    const amountToReceive = parseInt(rawInputVal) || 0;

    if (amountToReceive <= 0) {
      alert('请输入有效的本次到货接收数量！');
      return;
    }

    const availableToReceive = item.quantity - item.receivedQty;
    if (amountToReceive > availableToReceive) {
      const confirmExceed = confirm(`提示：录入本批到货数量 (${amountToReceive}件) 超过了此补货货品未清余额 (${availableToReceive}件)。确定超额录入到货吗？`);
      if (!confirmExceed) return;
    }

    // Prepare variables
    let remainingArrivedQty = amountToReceive;
    let shortageOffsetLogs: string[] = [];
    let conventionalStockLog = '';

    // Step 1: Query active (unfulfilled) orders with shortage for this productCode
    // Status candidates: pending_confirm, pending_purchase, purchased, pending_delete
    const eligibleOrders = orders.filter(ord => {
      if (ord.productCode !== item.productCode) return false;
      // Active statuses
      const isActive = ['pending_confirm', 'pending_purchase', 'purchased', 'pending_delete'].includes(ord.status);
      const shortage = ord.quantity - (ord.receivedQty || 0);
      return isActive && shortage > 0;
    });

    // Sort by createdAt ascending (Earliest Orders First)
    eligibleOrders.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    // Allocate!
    const updatedOrdersToSave: Order[] = [];
    for (const ord of eligibleOrders) {
      if (remainingArrivedQty <= 0) break;

      const currentShortage = ord.quantity - (ord.receivedQty || 0);
      const allocation = Math.min(remainingArrivedQty, currentShortage);

      if (allocation > 0) {
        ord.receivedQty = (ord.receivedQty || 0) + allocation;
        remainingArrivedQty -= allocation;

        if (ord.receivedQty >= ord.quantity) {
          ord.status = 'completed';
        } else {
          ord.status = 'purchased'; // set to purchased if partial
        }

        updatedOrdersToSave.push(ord);
        shortageOffsetLogs.push(`🏫 ${ord.branchName} 订单 ${ord.orderNo}: 对冲完成 ${allocation} 件`);
      }
    }

    // Step 2: Remaining quantity goes to convention warehouse inventory
    if (remainingArrivedQty > 0) {
      const invMatch = inventory.find(i => i.productCode === item.productCode);
      if (invMatch) {
        invMatch.currentStock = (invMatch.currentStock || 0) + remainingArrivedQty;
        invMatch.updatedAt = new Date().toISOString();
        await DbService.saveInventoryItem(invMatch, {
          id: currentUser.id,
          name: currentUser.username,
          role: currentUser.role
        });
      } else {
        const newInv: InventoryItem = {
          id: `inv_${Date.now()}_raw`,
          productCode: item.productCode,
          productName: item.productName,
          specs: item.specs,
          currentStock: remainingArrivedQty,
          safeStock: item.quantity * 2,
          supplier: item.supplier,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await DbService.saveInventoryItem(newInv, {
          id: currentUser.id,
          name: currentUser.username,
          role: currentUser.role
        });
      }
      conventionalStockLog = `📦 HQ常规备货库存增加 ${remainingArrivedQty} 件`;
    }

    // Save updated orders
    for (const ord of updatedOrdersToSave) {
      await DbService.saveOrder(ord, {
        id: currentUser.id,
        name: currentUser.username,
        role: currentUser.role
      });
    }

    // Step 3: Update item's receivedQty in independent purchase order
    const updatedItems = [...po.items];
    updatedItems[itemIndex] = {
      ...item,
      receivedQty: item.receivedQty + amountToReceive
    };

    // Evaluate PO overall state -- if all constituent order items are completed, mark PO as 'completed'
    const allPoCompleted = updatedItems.every(i => i.receivedQty >= i.quantity);

    const updatedPO: IndependentPurchaseOrder = {
      ...po,
      items: updatedItems,
      status: allPoCompleted ? 'completed' : 'pending_arrival'
    };

    try {
      await DbService.saveIndependentPurchaseOrder(updatedPO, {
        id: currentUser.id,
        name: currentUser.username,
        role: currentUser.role
      });

      // Clear input state
      setArrivalInputMap(prev => {
        const next = { ...prev };
        delete next[`${po.id}_${item.productCode}`];
        return next;
      });

      // Assemble audit log
      const logDetails = [
        `采购单号: ${po.poNo}`,
        `入库产品: ${item.productName} (${amountToReceive}件)`,
        shortageOffsetLogs.length > 0 ? `对冲欠货清单:\n  ${shortageOffsetLogs.join('\n  ')}` : '无排队中分店欠货记录',
        conventionalStockLog ? `库存转化: ${conventionalStockLog}` : ''
      ].filter(Boolean).join('\n');

      await DbService.log(
        currentUser.id,
        currentUser.username,
        currentUser.role,
        '独立采购单到货对冲',
        logDetails
      );

      // Re-trigger reload from DB
      await loadAllData();

      // Alert summary report to the user
      alert(
        `🎉 录入到货接收成功！\n\n` +
        `本次接收：${item.productName} * ${amountToReceive} 件\n\n` +
        `【对冲及分配结果如下】：\n` +
        (shortageOffsetLogs.length > 0 ? `• 已优先对冲分店欠货 ${amountToReceive - remainingArrivedQty} 件：\n  - ` + shortageOffsetLogs.join('\n  - ') : '• 无分店待处理欠货订单对冲') +
        `\n` +
        (remainingArrivedQty > 0 ? `• 其余 ${remainingArrivedQty} 件已自动并网入备货备用零库 (HQ核心总仓库存)` : '')
      );
    } catch (err) {
      console.error(err);
      alert('保存到货过程出错，请重试');
    }
  };

  // Filter list results
  const filteredPOs = useMemo(() => {
    return independentPOs.filter(po => {
      // Search code or No
      const matchNo = !searchPoNo || po.poNo.toLowerCase().includes(searchPoNo.toLowerCase()) || 
        po.items.some(it => it.productCode.toLowerCase().includes(searchPoNo.toLowerCase()) || it.productName.toLowerCase().includes(searchPoNo.toLowerCase()));
      // Supplier Match
      const matchSupplier = filterSupplier === 'all' || po.items.some(it => it.supplier === filterSupplier);
      // Status Match
      const matchStatus = filterStatus === 'all' || po.status === filterStatus;
      // Date Range Match
      let matchDate = true;
      if (filterStartDate) {
        matchDate = matchDate && po.orderDate >= filterStartDate;
      }
      if (filterEndDate) {
        matchDate = matchDate && po.orderDate <= filterEndDate;
      }

      return matchNo && matchSupplier && matchStatus && matchDate;
    });
  }, [independentPOs, searchPoNo, filterSupplier, filterStatus, filterStartDate, filterEndDate]);

  return (
    <div className="space-y-6">
      {/* Upper Module header Card */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 text-white rounded-3xl p-6 md:p-8 shadow-xl text-left relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none translate-x-12 translate-y-12">
          <ShoppingBag className="w-80 h-80" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <span className="text-[10px] px-2.5 py-1 bg-white/20 uppercase tracking-widest font-extrabold rounded-full border border-white/10">
              自主供求流转后台
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">独立采购单/补货单管理</h1>
            <p className="text-xs text-indigo-100 font-medium">
              该模块专注于采购部门基于安全库存水位或一键指令自主向厂商采购备料，无需依托分店提报。到货后系统将自动冲销未出债务欠款。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveSubTab('list')}
              className={`p-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubTab === 'list' 
                  ? 'bg-white text-indigo-700 shadow-lg' 
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>补货单列表记录</span>
            </button>
            <button
              onClick={() => setActiveSubTab('create-manual')}
              className={`p-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubTab === 'create-manual' 
                  ? 'bg-white text-indigo-700 shadow-lg' 
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>手工新增采购单</span>
            </button>
            <button
              onClick={() => setActiveSubTab('create-import')}
              className={`p-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubTab === 'create-import' 
                  ? 'bg-white text-indigo-700 shadow-lg' 
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>智能Excel/CSV导入</span>
            </button>
            <button
              onClick={() => setActiveSubTab('create-by-stock')}
              className={`p-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 relative ${
                activeSubTab === 'create-by-stock' 
                  ? 'bg-white text-indigo-700 shadow-lg' 
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
              <span>智能低库存算料派单</span>
              {lowStockItems.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-600 text-[9px] font-extrabold flex items-center justify-center rounded-full text-white animate-pulse">
                  {lowStockItems.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-150 shadow-sm flex flex-col justify-center items-center gap-2">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          <span className="text-slate-500 text-xs font-bold">正在全力加载自主采购流水与总网备料中...</span>
        </div>
      ) : (
        <>
          {/* TAB 1: LIST / HISTORY */}
          {activeSubTab === 'list' && (
            <div className="space-y-4">
              {/* Filter controls row */}
              <div className="bg-white p-4 rounded-2xl border border-slate-150 shadow-xs grid grid-cols-1 md:grid-cols-5 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase flex items-center gap-1">
                    <Search className="w-3 h-3 text-slate-400" />
                    搜索单号/货品编码
                  </label>
                  <input
                    type="text"
                    value={searchPoNo}
                    onChange={e => setSearchPoNo(e.target.value)}
                    placeholder="例如: PO-REPL-..."
                    className="w-full text-xs p-2 border border-slate-200 rounded-xl bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-700 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase flex items-center gap-1">
                    <Filter className="w-3 h-3 text-slate-400" />
                    按供应商筛选
                  </label>
                  <select
                    value={filterSupplier}
                    onChange={e => setFilterSupplier(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-200 rounded-xl bg-white focus:outline-none text-slate-700 font-bold"
                  >
                    <option value="all">-- 全部分厂 / 供应商 --</option>
                    {uniqueSuppliers.map(sup => (
                      <option key={sup} value={sup}>{sup}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase flex items-center gap-1">
                    <Filter className="w-3 h-3 text-slate-400" />
                    到货状态
                  </label>
                  <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value as any)}
                    className="w-full text-xs p-2 border border-slate-200 rounded-xl bg-white focus:outline-none text-slate-700 font-bold"
                  >
                    <option value="all">-- 所有状态 --</option>
                    <option value="pending_arrival">已提交厂家(待到货)</option>
                    <option value="completed">全额到齐结单</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    开始日期
                  </label>
                  <input
                    type="date"
                    value={filterStartDate}
                    onChange={e => setFilterStartDate(e.target.value)}
                    className="w-full text-xs p-1.5 border border-slate-200 rounded-xl focus:outline-none text-slate-700 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    截止日期
                  </label>
                  <input
                    type="date"
                    value={filterEndDate}
                    onChange={e => setFilterEndDate(e.target.value)}
                    className="w-full text-xs p-1.5 border border-slate-200 rounded-xl focus:outline-none text-slate-700 font-medium"
                  />
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-150 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700">自主补料采购单账本历史</h3>
                  <span className="text-[10px] px-2.5 py-1 bg-slate-200 text-slate-700 font-bold rounded-md">
                    检索到 {filteredPOs.length} 项采购记录
                  </span>
                </div>

                {filteredPOs.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 space-y-2">
                    <ShoppingBag className="w-8 h-8 mx-auto opacity-40 text-slate-500" />
                    <p className="text-xs font-bold">没有找到符合筛选条件的自主补货指令单</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto divide-y divide-slate-150">
                    {filteredPOs.map(po => {
                      const isExpanded = expandedPoId === po.id;
                      const hasUnconfirmedItems = po.factoryStatus === 'unconfirmed';
                      const isEditing = editingPoId === po.id;

                      // Aggregate totals
                      const totalQty = po.items.reduce((sum, i) => sum + i.quantity, 0);
                      const totalReceived = po.items.reduce((sum, i) => sum + (i.receivedQty || 0), 0);

                      return (
                        <div key={po.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                          {/* Header Summary Row */}
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div className="flex items-start gap-2.5">
                              <span className={`p-1.5 rounded-xl text-white mt-0.5 ${
                                po.status === 'completed' ? 'bg-emerald-600' : 'bg-amber-500'
                              }`}>
                                <ShoppingBag className="w-4 h-4" />
                              </span>
                              <div className="space-y-0.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-black text-slate-800 font-mono select-all">
                                    {po.poNo}
                                  </span>
                                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                    po.status === 'completed' 
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                      : 'bg-amber-50 text-amber-700 border border-amber-100'
                                  }`}>
                                    {po.status === 'completed' ? '🟢 全额到齐' : '🟡 厂家派单中 / 部分到货'}
                                  </span>
                                  {po.factoryStatus === 'confirmed' ? (
                                    <span className="text-[9px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full">
                                      🏢 厂家已安排排产
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                                      ⚠️ 待厂家反馈交期
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-500 font-bold flex flex-wrap gap-x-3 gap-y-1">
                                  <span>📅 发起时间: {po.orderDate}</span>
                                  {po.expectedArrivalDate && (
                                    <span className="text-indigo-650 font-extrabold bg-indigo-50/50 px-1 rounded">
                                      🚚 预计交期: {po.expectedArrivalDate}
                                    </span>
                                  )}
                                  <span>🖋️ 备注: {po.remarks || '无说明'}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 self-end md:self-auto">
                              <div className="text-right space-y-0.5">
                                <p className="text-xs font-semibold text-slate-550">货量总计</p>
                                <p className="text-xs font-black text-slate-800 font-mono">
                                  {totalReceived} / {totalQty} <span className="text-[10px] font-normal text-slate-500">件</span>
                                </p>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setExpandedPoId(isExpanded ? null : po.id)}
                                  className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg cursor-pointer border border-slate-200/80 font-bold text-xs flex items-center gap-1"
                                >
                                  {isExpanded ? '收起明细 ▵' : '录入到货/查看 ▿'}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Expanded Details Panel */}
                          {isExpanded && (
                            <div className="mt-4 border-t border-dashed border-slate-150 pt-4 space-y-4">
                              {/* Expected and Confirmed Dates update panel */}
                              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-left">
                                <div className="space-y-0.5">
                                  <h4 className="text-[11px] font-extrabold text-slate-700">🏭 厂家跟单与排产排程更新</h4>
                                  <p className="text-[10px] text-slate-500 font-semibold">采购可在此随时校正厂家的接单确认标识和预计到达总部仓交期，方便实时跟催。</p>
                                </div>

                                {isEditing ? (
                                  <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-bold text-slate-600">厂家状态:</span>
                                      <select
                                        value={editingFactoryStatus}
                                        onChange={e => setEditingFactoryStatus(e.target.value as any)}
                                        className="text-[10px] font-bold p-1 bg-white border border-slate-250 rounded-md text-slate-800"
                                      >
                                        <option value="unconfirmed">待确认</option>
                                        <option value="confirmed">已确认接单</option>
                                      </select>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-bold text-slate-600">预计到货:</span>
                                      <input
                                        type="date"
                                        value={editingExpectedArrival}
                                        onChange={e => setEditingExpectedArrival(e.target.value)}
                                        className="text-[10px] p-1 bg-white border border-slate-250 rounded-md font-medium text-slate-800"
                                      />
                                    </div>
                                    <div className="flex gap-1">
                                      <button
                                        type="button"
                                        onClick={() => saveEditedPoHeader(po)}
                                        className="p-1 px-2.5 bg-indigo-600 text-white text-[10px] font-extrabold rounded-md cursor-pointer"
                                      >
                                        保存
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingPoId(null)}
                                        className="p-1 px-2.5 bg-slate-200 text-slate-600 text-[10px] font-extrabold rounded-md cursor-pointer"
                                      >
                                        取消
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => startEditingPo(po)}
                                    className="p-1.5 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold rounded-lg cursor-pointer"
                                  >
                                    ⚙️ 设定厂家排产与预计交期
                                  </button>
                                )}
                              </div>

                              {/* Items Detailed Table */}
                              <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                                <table className="w-full text-xs text-left">
                                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase">
                                    <tr>
                                      <th className="p-2.5 text-center w-12">序号</th>
                                      <th className="p-2.5">产品编码</th>
                                      <th className="p-2.5">产品名称</th>
                                      <th className="p-2.5">规格型号</th>
                                      <th className="p-2.5">供应商</th>
                                      <th className="p-2.5 text-center">采购数量</th>
                                      <th className="p-2.5 text-center">已收数量</th>
                                      <th className="p-2.5 text-center">未清余量</th>
                                      <th className="p-2.5 text-center w-56 bg-slate-100/50">本次到货登录</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-150 font-medium">
                                    {po.items.map((item, idx) => {
                                      const unreceived = Math.max(0, item.quantity - item.receivedQty);
                                      const isCompl = unreceived <= 0;
                                      const keyStr = `${po.id}_${item.productCode}`;
                                      const currentInputValue = arrivalInputMap[keyStr] || '';

                                      return (
                                        <tr key={item.productCode} className={`hover:bg-slate-50/45 ${isCompl ? 'bg-slate-50/50 text-slate-400' : 'text-slate-800'}`}>
                                          <td className="p-2.5 text-center font-mono font-bold">{idx + 1}</td>
                                          <td className="p-2.5">
                                            <div className="flex items-center gap-1">
                                              <span className="font-mono font-bold select-all">{item.productCode}</span>
                                              {item.isNew && (
                                                <span className="text-[8px] font-extrabold px-1.5 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded">
                                                  ⚠️ 新品待审
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="p-2.5 font-semibold">{item.productName}</td>
                                          <td className="p-2.5 text-slate-550">{item.specs || '--'}</td>
                                          <td className="p-2.5 text-slate-600 font-semibold">{item.supplier}</td>
                                          <td className="p-2.5 text-center font-bold font-mono">{item.quantity}</td>
                                          <td className="p-2.5 text-center font-bold font-mono text-emerald-600">{item.receivedQty}</td>
                                          <td className="p-2.5 text-center font-bold font-mono text-amber-600">
                                            {isCompl ? '0' : unreceived}
                                          </td>
                                          <td className="p-2.5 bg-slate-50/60 flex items-center justify-center gap-2">
                                            {isCompl ? (
                                              <span className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-0.5">
                                                ✓ 全额收齐
                                              </span>
                                            ) : (
                                              <>
                                                <input
                                                  type="text"
                                                  value={currentInputValue}
                                                  onChange={e => {
                                                    const cleanNum = e.target.value.replace(/\D/g, '');
                                                    setArrivalInputMap(prev => ({
                                                      ...prev,
                                                      [keyStr]: cleanNum
                                                    }));
                                                  }}
                                                  placeholder={`未清 ${unreceived}`}
                                                  className="w-20 p-1 text-center bg-white border border-slate-300 rounded font-bold font-mono text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                                />
                                                <button
                                                  type="button"
                                                  onClick={() => recordRowArrival(po, idx)}
                                                  className="p-1 px-2.5 bg-indigo-640 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-[10px] cursor-pointer shadow-2xs"
                                                >
                                                  录入到货
                                                </button>
                                              </>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>

                              <div className="bg-slate-50 p-3 rounded-xl border border-indigo-50 flex items-start gap-2 text-[10px] text-slate-550 leading-relaxed font-semibold">
                                <span className="text-base">📢</span>
                                <div>
                                  <span className="text-indigo-700 font-extrabold">核心到货抵扣扣减逻辑：</span>
                                  录入具体货品的到货数量后，系统将自动发起全局订单冲抵扫描。优先将剩余的数量分派给系统中仍在“欠货 / 厂家欠账”状态的分店历史订单（按时间由远到近、先进先出），扣减充抵欠货金额。冲抵完毕后如有剩余多余到货，将自动作为常规HQ仓核心库存并入备货。
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: MANUAL CREATION */}
          {activeSubTab === 'create-manual' && (
            <form onSubmit={handleManualSubmit} className="bg-white rounded-3xl border border-slate-150 shadow-sm p-6 md:p-8 space-y-6 text-left">
              <div className="border-b border-slate-100 pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div className="space-y-0.5">
                  <h3 className="text-sm md:text-base font-black text-slate-800">✍️ 自主发起新采购单 / 补货单</h3>
                  <p className="text-[11px] text-slate-500 font-semibold">采购跟单员可以手动将多行货品商品逐个新增进来，并对供应商、备注信息进行自主归纳。</p>
                </div>
                <div className="font-mono text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-150 px-3.5 py-1.5 rounded-xl">
                  📄 拟生成单号：{manualPoNo}
                </div>
              </div>

              {/* Items Table container */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-slate-700 flex items-center gap-1">
                    <span className="w-1.5 h-3.5 bg-indigo-600 rounded-full"></span>
                    采购货品明细逐行登记 ({manualItems.length}行)
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setManualItems([...manualItems, { productCode: '', productName: '', specs: '', quantity: 50, supplier: '', remark: '', receivedQty: 0 }]);
                    }}
                    className="p-1 px-3 border border-indigo-300 hover:border-indigo-600 text-indigo-755 text-xs text-indigo-600 font-extrabold rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>追加采购商品行</span>
                  </button>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                      <tr>
                        <th className="p-3 text-center w-12">序号</th>
                        <th className="p-3 w-44">产品编码 (不可空)</th>
                        <th className="p-3 w-48">产品名称 (不可空)</th>
                        <th className="p-3 w-40">规格型号</th>
                        <th className="p-3 w-40">采购供应商 (不可空)</th>
                        <th className="p-3 w-28 text-center">采购数量</th>
                        <th className="p-3">单项备注 (选填)</th>
                        <th className="p-3 text-center w-12">移除</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {manualItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-3 text-center font-mono font-bold text-slate-500">{idx + 1}</td>
                          
                          <td className="p-2">
                            <input
                              type="text"
                              required
                              placeholder="例: CP-103"
                              value={item.productCode || ''}
                              onChange={e => {
                                const val = e.target.value.toUpperCase();
                                const updated = [...manualItems];
                                updated[idx].productCode = val;
                                
                                // Dynamic auto-complete from existing products
                                const matched = products.find(p => p.productCode.toUpperCase() === val);
                                if (matched) {
                                  updated[idx].productName = matched.productName;
                                  updated[idx].specs = matched.specs;
                                  updated[idx].supplier = matched.defaultSupplier;
                                }
                                setManualItems(updated);
                              }}
                              className="w-full text-xs p-1.5 border border-slate-250 bg-white rounded-lg focus:outline-none focus:border-indigo-500 font-bold font-mono"
                            />
                          </td>

                          <td className="p-2">
                            <input
                              type="text"
                              required
                              placeholder="例: 焊接碳钢弯头"
                              value={item.productName || ''}
                              onChange={e => {
                                const updated = [...manualItems];
                                updated[idx].productName = e.target.value;
                                setManualItems(updated);
                              }}
                              className="w-full text-xs p-1.5 border border-slate-250 bg-white rounded-lg focus:outline-none"
                            />
                          </td>

                          <td className="p-2">
                            <input
                              type="text"
                              placeholder="例: 90度-DN100"
                              value={item.specs || ''}
                              onChange={e => {
                                const updated = [...manualItems];
                                updated[idx].specs = e.target.value;
                                setManualItems(updated);
                              }}
                              className="w-full text-xs p-1.5 border border-slate-250 bg-white rounded-lg focus:outline-none"
                            />
                          </td>

                          <td className="p-2">
                            <input
                              type="text"
                              required
                              placeholder="例: 沧州弯头一厂"
                              value={item.supplier || ''}
                              onChange={e => {
                                const updated = [...manualItems];
                                updated[idx].supplier = e.target.value;
                                setManualItems(updated);
                              }}
                              className="w-full text-xs p-1.5 border border-slate-250 bg-white rounded-lg focus:outline-none font-bold"
                            />
                          </td>

                          <td className="p-2 text-center">
                            <input
                              type="number"
                              required
                              min={1}
                              value={item.quantity || 1}
                              onChange={e => {
                                const updated = [...manualItems];
                                updated[idx].quantity = parseInt(e.target.value) || 0;
                                setManualItems(updated);
                              }}
                              className="w-full text-xs p-1.5 border border-slate-250 bg-white rounded-lg focus:outline-none font-bold font-mono text-center"
                            />
                          </td>

                          <td className="p-2">
                            <input
                              type="text"
                              placeholder="无"
                              value={item.remark || ''}
                              onChange={e => {
                                const updated = [...manualItems];
                                updated[idx].remark = e.target.value;
                                setManualItems(updated);
                              }}
                              className="w-full text-xs p-1.5 border border-slate-250 bg-white rounded-lg focus:outline-none"
                            />
                          </td>

                          <td className="p-2 text-center">
                            {manualItems.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = manualItems.filter((_, i) => i !== idx);
                                  setManualItems(updated);
                                }}
                                className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Remarks Box & Action row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-705 flex items-center gap-1">
                    <span className="w-1.5 h-3 bg-indigo-650 rounded-full"></span>
                    整单备注及附加指引 (选填)
                  </label>
                  <textarea
                    rows={2}
                    value={manualRemarks}
                    onChange={e => setManualRemarks(e.target.value)}
                    placeholder="例如：本次为防范大风汛期准备的预备物料，要求物流直接发物流干线..."
                    className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 bg-white text-slate-700 focus:outline-none"
                  />
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between">
                  <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                    💡 <span className="text-indigo-700 font-bold">智能建议提示：</span>
                    您在上方行中键入“产品编码”时，系统将会根据标准货品库进行自动检索联想补全。若该产品在现有的库存商品体系内不存在，系统在生成该采购订单的同时，将会自动在新采购单建立该未登记商品并打上“新品标记”，后续只需等待管理员后台最终对该新品审核入标准商品库即可。
                  </p>
                  <div className="flex gap-2.5 pt-3 justify-end">
                    <button
                      type="button"
                      onClick={() => setActiveSubTab('list')}
                      className="py-2 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer text-center duration-150"
                    >
                      返回列表
                    </button>
                    <button
                      type="submit"
                      className="py-2 px-8 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-500/15 duration-150 cursor-pointer"
                    >
                      确认创建并派发厂家
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}

          {/* TAB 3: EXCEL IMPORT */}
          {activeSubTab === 'create-import' && (
            <div className="bg-white rounded-3xl border border-slate-150 shadow-sm p-6 md:p-8 space-y-6 text-left">
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-0.5">
                  <h3 className="text-sm md:text-base font-black text-slate-800">📥 一键上传表格批量申报采购单</h3>
                  <p className="text-[11px] text-slate-500 font-semibold">支持直接采用由系统官方标准的CSV数据模板填写完后一键拖拽完成极速派发。</p>
                </div>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="p-2 px-3.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-150 text-[11px] font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  title="下载CSV通用批量补货模板"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>下载采购单标准Excel-CSV模板</span>
                </button>
              </div>

              {/* Upload Drag area */}
              {parsedItems.length === 0 ? (
                <div 
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-3xl p-10 md:p-14 text-center cursor-pointer transition-all ${
                    dragActive 
                      ? 'border-indigo-600 bg-indigo-50/60' 
                      : 'border-slate-350 bg-slate-50/30 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="file"
                    id="excel_po_file_selector"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label htmlFor="excel_po_file_selector" className="cursor-pointer space-y-3 block">
                    <span className="p-3 bg-indigo-50 text-indigo-700 rounded-full inline-block">
                      <Upload className="w-8 h-8" />
                    </span>
                    <div className="space-y-1">
                      <p className="text-xs font-black text-slate-800">
                        拖拽您的 CSV 标准格式文件到此处，或点击浏览本地文件
                      </p>
                      <p className="text-[10px] text-slate-400 font-semibold">
                        (推荐直接使用右上方提供的官方标准格式，完美防止编码乱码现象)
                      </p>
                    </div>
                  </label>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Parsed List Info */}
                  <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 bg-indigo-600 rounded-full animate-ping"></span>
                      <span className="text-xs font-bold text-slate-700">
                        预解析结果明细：解析到共 <span className="text-indigo-700 text-sm font-black font-mono">{parsedItems.length}</span> 行采购商品项。
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setParsedItems([])}
                      className="text-xs text-rose-600 hover:text-rose-800 font-extrabold cursor-pointer"
                    >
                      清空重新导入
                    </button>
                  </div>

                  {/* Items list table */}
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-150 text-slate-700 font-bold uppercase border-b border-slate-200">
                        <tr>
                          <th className="p-3 text-center w-12">序号</th>
                          <th className="p-3">产品编码</th>
                          <th className="p-3">产品名称</th>
                          <th className="p-3">规格型号</th>
                          <th className="p-3">采购数量</th>
                          <th className="p-3">供应商</th>
                          <th className="p-3">备注</th>
                          <th className="p-3 text-center w-28">产品身份</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 font-medium">
                        {parsedItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/45">
                            <td className="p-3 text-center font-mono font-bold text-slate-500">{idx + 1}</td>
                            <td className="p-3 font-mono font-bold text-slate-805 select-all">{item.productCode}</td>
                            <td className="p-3 font-semibold">{item.productName}</td>
                            <td className="p-3 text-slate-550">{item.specs || '--'}</td>
                            <td className="p-3 font-bold font-mono text-slate-700">{item.quantity}</td>
                            <td className="p-3 text-slate-600 font-semibold">{item.supplier}</td>
                            <td className="p-3 text-slate-450">{item.remark || '--'}</td>
                            <td className="p-3 text-center">
                              {item.isNew ? (
                                <span className="text-[10px] font-black px-2 py-0.5 bg-rose-55 text-rose-600 border border-rose-100 rounded-full">
                                  ⚠️ 待审新品
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full">
                                  ✓ 在库产品
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Submit Configuration and Action Box */}
                  <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">整单备注及附加指引：</label>
                      <input
                        type="text"
                        value={importRemarks}
                        onChange={e => setImportRemarks(e.target.value)}
                        placeholder="给厂家填写的本单统一附加要求..."
                        className="w-full text-xs p-2 border border-slate-250 bg-white rounded-xl focus:outline-none"
                      />
                    </div>

                    <div className="flex gap-2 justify-end pt-3 md:pt-0">
                      <button
                        type="button"
                        onClick={() => setParsedItems([])}
                        className="py-2.5 px-6 bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                      >
                        取消导入
                      </button>
                      <button
                        type="button"
                        onClick={handleImportSubmit}
                        className="py-2.5 px-8 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-500/15 cursor-pointer"
                      >
                        确认并一键送达厂家排单 ({parsedItems.length}件)
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: STOCK-BASED INTELLIGENT REPLENISHMENT */}
          {activeSubTab === 'create-by-stock' && (
            <div className="bg-white rounded-3xl border border-slate-150 shadow-sm p-6 md:p-8 space-y-6 text-left">
              <div className="space-y-1">
                <h3 className="text-sm md:text-base font-black text-slate-800">🤖 智能低库存物料缺料算料补货</h3>
                <p className="text-[11px] text-slate-500 font-semibold">
                  系统会自动对现有的总部备货零库数据进行实时穿透扫描，将那些 “已经是0/负数” 或是 “低于最低限安全水位” 的货品主动排查列出，实现一键打包派送。
                </p>
              </div>

              {lowStockItems.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-slate-50/50 border border-slate-200 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <p className="text-xs font-extrabold text-slate-700">当前没有低于安全线水位的亏空货品！</p>
                  <p className="text-[10px] text-slate-550">全网商品均备料在额、安然无虑。</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Multi-select Header Control */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-indigo-50/60 p-3 rounded-2xl border border-indigo-100 gap-3">
                    <span className="text-xs font-bold text-slate-750">
                      💡 提示：检测到共 <span className="text-rose-600 text-sm font-black font-mono">{lowStockItems.length}</span> 项低水位保障性警戒商品。您可下方多选后批量申报。
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedStockProductCodes(lowStockItems.map(i => i.productCode))}
                        className="text-[10px] font-bold px-2 py-1.5 bg-indigo-600 text-white rounded-lg cursor-pointer"
                      >
                        选择全部
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedStockProductCodes([])}
                        className="text-[10px] font-bold px-2 py-1.5 bg-slate-200 text-slate-705 rounded-lg cursor-pointer border border-slate-300"
                      >
                        全部取消
                      </button>
                    </div>
                  </div>

                  {/* Stock depletion catalog table */}
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-700 font-bold uppercase border-b border-slate-200">
                        <tr>
                          <th className="p-3 w-12 text-center">选择</th>
                          <th className="p-3">产品编码</th>
                          <th className="p-3">产品名称</th>
                          <th className="p-3">规格型号</th>
                          <th className="p-3 text-center">当前在库储备</th>
                          <th className="p-3 text-center">最少安全存栏</th>
                          <th className="p-3 w-32 text-center bg-amber-50/40">拟补货采购量</th>
                          <th className="p-3 w-44">拟指定厂家供应商</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 font-medium">
                        {lowStockItems.map(item => {
                          const currentVal = item.currentStock || 0;
                          const safeVal = item.safeStock || 0;
                          const isSeverelyLow = currentVal <= 0;
                          const isChecked = selectedStockProductCodes.includes(item.productCode);

                          return (
                            <tr 
                              key={item.id} 
                              className={`hover:bg-indigo-50/30 ${isChecked ? 'bg-indigo-50/20' : ''}`}
                            >
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={e => {
                                    if (e.target.checked) {
                                      setSelectedStockProductCodes([...selectedStockProductCodes, item.productCode]);
                                    } else {
                                      setSelectedStockProductCodes(selectedStockProductCodes.filter(c => c !== item.productCode));
                                    }
                                  }}
                                  className="w-4 h-4 text-indigo-600 rounded cursor-pointer border-slate-300 focus:ring-indigo-500"
                                />
                              </td>

                              <td className="p-3 font-mono font-bold text-slate-800 select-all">{item.productCode}</td>
                              <td className="p-3 font-semibold text-slate-900">{item.productName}</td>
                              <td className="p-3 text-slate-550">{item.specs || '--'}</td>
                              
                              <td className="p-3 text-center">
                                <span className={`font-mono font-extrabold ${isSeverelyLow ? 'text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100' : 'text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100'}`}>
                                  {currentVal}
                                </span>
                              </td>
                              <td className="p-3 text-center font-mono text-slate-500">{safeVal}</td>

                              <td className="p-2 bg-amber-50/30 text-center">
                                <input
                                  type="number"
                                  min={1}
                                  value={stockReplenishQtyMap[item.productCode] || ''}
                                  onChange={e => {
                                    const val = parseInt(e.target.value) || 0;
                                    setStockReplenishQtyMap(prev => ({
                                      ...prev,
                                      [item.productCode]: val
                                    }));
                                  }}
                                  className="w-24 text-xs p-1 text-center bg-white border border-amber-300 rounded-md font-bold font-mono focus:ring-1 focus:ring-amber-500 focus:outline-none"
                                />
                              </td>

                              <td className="p-2">
                                <input
                                  type="text"
                                  placeholder="首选指定供应商"
                                  value={stockReplenishSupplierMap[item.productCode] || ''}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setStockReplenishSupplierMap(prev => ({
                                      ...prev,
                                      [item.productCode]: val
                                    }));
                                  }}
                                  className="w-full text-xs p-1.5 border border-slate-200 bg-white rounded-md font-bold focus:outline-none focus:border-indigo-500 text-slate-700"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Submission Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-slate-50 p-4 rounded-3xl border border-slate-200 gap-3">
                    <span className="text-xs text-slate-550 font-semibold">
                      🎁 选中补货项：<span className="text-indigo-750 font-black text-sm font-mono">{selectedStockProductCodes.length}</span> 项货品。
                    </span>
                    <button
                      type="button"
                      onClick={handleStockReplenishSubmit}
                      disabled={selectedStockProductCodes.length === 0}
                      className="py-2.5 px-8 bg-gradient-to-r from-blue-600 to-indigo-700 disabled:from-slate-400 disabled:to-slate-400 text-white font-extrabold rounded-xl text-xs shadow-md shadow-indigo-500/15 duration-150 cursor-pointer disabled:cursor-not-allowed"
                    >
                      🚀 确认并一键打包提交补货订单给厂家
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </>
      )}

    </div>
  );
}
