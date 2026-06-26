import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  AlertTriangle, 
  ShieldAlert, 
  Settings, 
  ClipboardList, 
  ShoppingBag, 
  Layers,
  ArrowRight,
  Download,
  Database
} from 'lucide-react';
import { Order, SystemConfig } from '../types';
import { DbService } from '../lib/dbService';

interface DashboardViewProps {
  orders: Order[];
  systemConfig: SystemConfig;
  onConfigChange: (newThreshold: number) => void;
  currentUser: any;
}

export default function DashboardView({ orders, systemConfig, onConfigChange, currentUser }: DashboardViewProps) {
  const [thresholdInput, setThresholdInput] = useState<string>(String(systemConfig.shortageThreshold));
  const [isUpdating, setIsUpdating] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  // Supervisor monitoring states
  const [logs, setLogs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);

  // Supervisor tabs and advanced filters
  const [activeAdminTab, setActiveAdminTab] = useState<'branch' | 'staff' | 'search' | 'trace'>('branch');
  const [staffQuery, setStaffQuery] = useState<string>('');

  // Independent product / supplier filter states
  const [queryProduct, setQueryProduct] = useState<string>('');
  const [querySupplier, setQuerySupplier] = useState<string>('');
  const [queryBranch, setQueryBranch] = useState<string>('all');
  const [queryStatus, setQueryStatus] = useState<string>('all');
  const [traceLogSearch, setTraceLogSearch] = useState<string>('');

  useEffect(() => {
    const loadLogsAndUsers = async () => {
      try {
        const [logData, userData] = await Promise.all([
          DbService.getLogs(),
          DbService.getUsers()
        ]);
        setLogs([...logData].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        setUsers(userData);
      } catch (e) {
        console.error(e);
      }
    };
    loadLogsAndUsers();
  }, []); // Run on mount to avoid massive redundant fetch cycles during order modifications and polling

  const handleExportFullBackup = async () => {
    setIsBackingUp(true);
    try {
      // 1. Fetch system tables dynamically to ensure fresh data
      const ordersData = await DbService.getOrders();
      const inventoryData = await DbService.getInventory();
      const poData = await DbService.getPurchaseOrders();
      const logsData = await DbService.getLogs();

      // 2. Generate XML worksheets with XML escaping
      const escapeXml = (unsafe: any): string => {
        if (unsafe === null || unsafe === undefined) return '';
        const str = String(unsafe);
        return str.replace(/[<>&'"]/g, (c) => {
          switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
          }
        });
      };

      // Style and header helper
      const makeXmlHeaders = (labels: string[]) => {
        const cells = labels.map(l => `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(l)}</Data></Cell>`).join('');
        return `<Row ss:Height="22">${cells}</Row>`;
      };

      const makeXmlRows = (data: any[], keys: string[]) => {
        return data.map(item => {
          const cells = keys.map(k => {
            const val = item[k];
            const escaped = escapeXml(val);
            const isNum = typeof val === 'number' && !isNaN(val);
            return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${escaped}</Data></Cell>`;
          }).join('');
          return `<Row ss:Height="18">${cells}</Row>`;
        }).join('\n');
      };

      // Sheet 1: Orders
      const orderHeaders = ['订单号', '分店名称', '商品货号', '商品品名', '规格型号', '提报数量', '已清到数量', '当前状态', '协作供应商', '清退/备注说明', '创建时间'];
      const orderKeys = ['orderNo', 'branchName', 'productCode', 'productName', 'specs', 'quantity', 'receivedQty', 'status', 'supplier', 'remark', 'createdAt'];
      const orderRowsXml = makeXmlRows(ordersData.map(o => ({
        ...o,
        status: o.status === 'pending_confirm' ? '待前台审批' :
                o.status === 'pending_purchase' ? '待采购并案' :
                o.status === 'purchased' ? '已采购发货中' :
                o.status === 'completed' ? '全部到齐已完成' : '已被驳回',
        remark: o.remark || o.rejectReason || ''
      })), orderKeys);

      // Sheet 2: Inventory
      const inventoryHeaders = ['商品货号', '商品品名', '规格型号', '当前库存量', '安全警告线', '供应商', '最后更新时间'];
      const inventoryKeys = ['productCode', 'productName', 'specs', 'currentStock', 'safeStock', 'supplier', 'updatedAt'];
      const inventoryRowsXml = makeXmlRows(inventoryData, inventoryKeys);

      // Sheet 3: Purchase Orders
      const poHeaders = ['采购合并单号', '对接厂家', '合并采购总件数', '厂家确认反馈', '预计到期日', '主单状态', '说明备注', '创建时间'];
      const poKeys = ['poNo', 'supplier', 'totalQuantity', 'factoryStatus', 'expectedArrivalDate', 'status', 'remarks', 'createdAt'];
      const poRowsXml = makeXmlRows(poData.map(p => ({
        ...p,
        factoryStatus: p.factoryStatus === 'confirmed' ? '厂家已接单确认' : '厂家未应答待确认',
        status: p.status === 'pending_arrival' ? '等待到货零配' : '全部零配装箱完成',
        expectedArrivalDate: p.expectedArrivalDate || '未反馈',
        remarks: p.remarks || ''
      })), poKeys);

      // Sheet 4: Logs
      const logHeaders = ['操作时间戳', '操作账户', '岗位角色', '业务动作', '详细事件参数记录'];
      const logKeys = ['timestamp', 'username', 'role', 'action', 'details'];
      const logRowsXml = makeXmlRows(logsData.map(l => ({
        ...l,
        role: l.role === 'admin' ? '超级管理员' :
              l.role === 'branch' ? '分店提报端' :
              l.role === 'receptionist' ? '前台汇总端' : '采购合并端'
      })), logKeys);

      // Master Document Building (SpreadsheetML / XML format compatible with Excel)
      const xmlDoc = `<?xml version="1.0" encoding="utf-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Author>多分店订单协同管理系统</Author>
    <LastAuthor>系统管理账户</LastAuthor>
    <Created>${new Date().toISOString()}</Created>
  </DocumentProperties>
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:FontName="Segoe UI font-sans" x:CharSet="134" ss:Size="10" ss:Color="#3F4E5E"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>
    <Style ss:ID="Header">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI font-sans" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#1D4ED8" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1E40AF"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1E40AF"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1E40AF"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1E40AF"/>
      </Borders>
    </Style>
  </Styles>
  
  <Worksheet ss:Name="全分店订单总表">
    <Table ss:DefaultColumnWidth="120">
      ${makeXmlHeaders(orderHeaders)}
      ${orderRowsXml}
    </Table>
  </Worksheet>
  
  <Worksheet ss:Name="备货库库存表">
    <Table ss:DefaultColumnWidth="120">
      ${makeXmlHeaders(inventoryHeaders)}
      ${inventoryRowsXml}
    </Table>
  </Worksheet>
  
  <Worksheet ss:Name="合并采购流转单">
    <Table ss:DefaultColumnWidth="120">
      ${makeXmlHeaders(poHeaders)}
      ${poRowsXml}
    </Table>
  </Worksheet>
  
  <Worksheet ss:Name="操作审计日志">
    <Table ss:DefaultColumnWidth="130">
      ${makeXmlHeaders(logHeaders)}
      ${logRowsXml}
    </Table>
  </Worksheet>
</Workbook>`;

      const blob = new Blob([xmlDoc], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const formattedDate = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 10);
      link.setAttribute('download', `SYS_EXCEL_BACKUP_${formattedDate}.xls`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Log successful backup events
      await DbService.log(
        currentUser.id,
        currentUser.username,
        currentUser.role,
        '全系统多维备份',
        `成功执行了全系统级离线数据归档备份，一键导出订单数 ${ordersData.length} 件、备货库存项 ${inventoryData.length} 件。`
      );
    } catch (e: any) {
      console.error(e);
      alert('备份生成失败，请检查相关数据模块！');
    } finally {
      setIsBackingUp(false);
    }
  };

  useEffect(() => {
    setThresholdInput(String(systemConfig.shortageThreshold));
  }, [systemConfig]);

  // Calculations
  const totalOrders = orders.length;
  const pendingConfirm = orders.filter(o => o.status === 'pending_confirm').length;
  const pendingPurchase = orders.filter(o => o.status === 'pending_purchase').length;
  
  // Backlogged/Deficit calculation
  // Shortage happens for orders in status: 'purchased' or 'pending_purchase' where receivedQty < quantity
  const shortageItems = orders.filter(o => {
    const received = o.receivedQty || 0;
    return o.status === 'purchased' && received < o.quantity;
  });

  const totalShortageQty = shortageItems.reduce((sum, o) => sum + (o.quantity - o.receivedQty), 0);
  const isThresholdExcceeded = totalShortageQty >= systemConfig.shortageThreshold;

  // Group shortage by product code
  const productBacklogs: { [code: string]: { code: string; name: string; qty: number } } = {};
  for (const item of shortageItems) {
    const qtyShort = item.quantity - item.receivedQty;
    if (productBacklogs[item.productCode]) {
      productBacklogs[item.productCode].qty += qtyShort;
    } else {
      productBacklogs[item.productCode] = {
        code: item.productCode,
        name: item.productName,
        qty: qtyShort
      };
    }
  }

  const topBacklogs = Object.values(productBacklogs)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // Compute metrics per branch
  const uniqueBranches = Array.from(new Set(orders.map(o => o.branchName).filter(Boolean)));
  const branchStats = uniqueBranches.map(branchName => {
    const bOrders = orders.filter(o => o.branchName === branchName);
    return {
      name: branchName,
      totalCount: bOrders.length,
      totalQty: bOrders.reduce((sum, o) => sum + o.quantity, 0),
      completedCount: bOrders.filter(o => o.status === 'completed').length,
      pendingCount: bOrders.filter(o => o.status === 'pending_confirm' || o.status === 'pending_purchase' || o.status === 'purchased').length,
      cancelledCount: bOrders.filter(o => o.status === 'cancelled').length,
    };
  }).sort((a, b) => b.totalQty - a.totalQty); 

   // Compute metrics per staff (merchandiser, branch personnel, receptionist)
   const staffsList = Array.from(new Set([
     ...users.map(u => u.username).filter(Boolean),
     ...orders.flatMap(o => o.merchandiserName ? o.merchandiserName.split(/[,，;\s\/]+/).map(n => n.trim()).filter(Boolean) : []).filter(Boolean),
     ...logs.map(l => l.username).filter(Boolean),
   ])).filter(name => name !== 'admin' && name !== '管理员' && name !== '主管' && name !== 'System' && name !== 'system');
 
   const staffStats = staffsList.map(name => {
     const assigned = orders.filter(o => o.merchandiserName && o.merchandiserName.split(/[,，;\s\/]+/).map(n => n.trim()).filter(Boolean).includes(name));
     const userLogs = logs.filter(l => l.username === name);
     return {
       name,
       assignedCount: assigned.length,
       assignedPending: assigned.filter(o => o.status === 'purchased').length,
       assignedCompleted: assigned.filter(o => o.status === 'completed').length,
       logCount: userLogs.length,
       lastActive: userLogs[0]?.timestamp || null,
       lastAction: userLogs[0]?.action || '暂无近期操作',
     };
   }).sort((a, b) => b.logCount - a.logCount);

  const handleUpdateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(thresholdInput, 10);
    if (isNaN(val) || val < 0) {
      alert('请输入有效的正整数');
      return;
    }

    setIsUpdating(true);
    try {
      await onConfigChange(val);
      alert('警戒阈值配置已成功更新！');
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="space-y-6">
      {/* Shortage Alarm Alert Block */}
      {isThresholdExcceeded && (
        <div id="shortage_high_alert" className="flex items-start gap-4 p-4 border border-rose-200 bg-rose-50 rounded-xl text-rose-900 animate-pulse">
          <div className="p-2 bg-rose-100 rounded-lg text-rose-600 shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-rose-950 text-sm md:text-base">
              【系统告警】采购欠货量已超出警戒阈值！
            </h3>
            <p className="text-xs md:text-sm text-rose-800">
              当前系统内的总欠货数量为 <strong className="text-rose-950 font-bold text-base px-1">{totalShortageQty}</strong> 件，
              已超出管理员设定的警戒红线（<strong className="font-semibold">{systemConfig.shortageThreshold}</strong> 件）。
              请采购部门人员尽快处理欠货报表，并向厂家发起【一键补货】以缓解分店缺货情况！
            </p>
          </div>
        </div>
      )}

      {/* Stats Bento Grid */}
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">系统关键指标</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1 */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs md:text-sm font-medium">今日订单</span>
            <div className="p-1.5 bg-slate-50 rounded-lg text-slate-600">
              <ClipboardList className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-bold text-slate-800">{totalOrders}</div>
            <p className="text-[10px] text-slate-400 mt-1">分店累计发起的产品款项</p>
          </div>
        </div>

        {/* Stat 2 */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs md:text-sm font-medium">待审核订单</span>
            <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-bold text-amber-700">{pendingConfirm}</div>
            <p className="text-[10px] text-slate-400 mt-1">需要前台批量核对确认</p>
          </div>
        </div>

        {/* Stat 3 */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <span className="text-xs md:text-sm font-medium">待采购订单</span>
            <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-bold text-blue-700">{pendingPurchase}</div>
            <p className="text-[10px] text-slate-400 mt-1">等待采购组汇总发布到厂家</p>
          </div>
        </div>

        {/* Stat 4 */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-600 mb-2">
            <span className="text-xs md:text-sm font-medium">欠货提醒</span>
            <div className="p-1.5 bg-rose-50 rounded-lg text-rose-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-bold text-rose-700">{totalShortageQty}</div>
            <p className="text-[10px] text-slate-400 mt-1">
              警戒阈值: <strong className="font-semibold">{systemConfig.shortageThreshold}</strong>
            </p>
          </div>
        </div>
      </div>

      {/* 主管专属：深度运营监控透视 */}
      {isAdmin && (
        <div className="bg-slate-900 text-white rounded-2xl shadow-xl overflow-hidden border border-slate-800 p-5 md:p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg text-lg">🛡️</span>
                <h3 className="font-extrabold text-sm md:text-base tracking-tight text-white mb-0.5">主管专属协同业务穿透监控台（分页组织 & 独立筛查机制）</h3>
              </div>
              <p className="text-xs text-slate-400">已将前台、采购、分店等不同功能分离排版。支持单独筛选指定同仁轨迹、对供应商或产品进行独立穿透筛查。</p>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wider font-extrabold text-slate-450 font-mono">
              <span className="bg-slate-850 px-2.5 py-1 rounded text-indigo-400 border border-slate-800">活跃店面: {branchStats.length} 个</span>
              <span className="bg-slate-850 px-2.5 py-1 rounded text-blue-400 border border-slate-800">核定同仁数: {staffStats.length} 人</span>
            </div>
          </div>

          {/* Segmented Sub-Tabs Selector */}
          <div className="flex flex-wrap gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveAdminTab('branch')}
              className={`flex-1 min-w-[130px] md:min-w-[150px] py-2 px-3 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none ${
                activeAdminTab === 'branch'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 bg-transparent'
              }`}
            >
              🏪 (1) 各分店订单汇总
            </button>
            <button
              type="button"
              onClick={() => setActiveAdminTab('staff')}
              className={`flex-1 min-w-[130px] md:min-w-[150px] py-2 px-3 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none ${
                activeAdminTab === 'staff'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 bg-transparent'
              }`}
            >
              👥 (2) 员工与同仁工作轨迹
            </button>
            <button
              type="button"
              onClick={() => setActiveAdminTab('search')}
              className={`flex-1 min-w-[130px] md:min-w-[150px] py-2 px-3 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none ${
                activeAdminTab === 'search'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 bg-transparent'
              }`}
            >
              🔍 (3) 商品与供应商筛查
            </button>
            <button
              type="button"
              onClick={() => setActiveAdminTab('trace')}
              className={`flex-1 min-w-[130px] md:min-w-[150px] py-2 px-3 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none ${
                activeAdminTab === 'trace'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 bg-transparent'
              }`}
            >
              ⚡ (4) 超级监控日志流
            </button>
          </div>

          {/* TAB 1 CONTENT: Branch orders accumulation */}
          {activeAdminTab === 'branch' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                  各分店提报订货数据分析（点击特定分店展开穿透明细）
                </h4>
              </div>

              <div className="bg-slate-850 rounded-xl border border-slate-800 divide-y divide-slate-800/60 overflow-hidden text-xs">
                {branchStats.length === 0 ? (
                  <div className="p-10 text-center text-slate-500 font-bold">暂无任何分店订单汇总数据</div>
                ) : (
                  branchStats.map(b => {
                    const isSelected = selectedBranch === b.name;
                    return (
                      <div key={b.name} className="transition-colors hover:bg-slate-800/10">
                        <div 
                          onClick={() => setSelectedBranch(isSelected ? null : b.name)}
                          className="flex items-center justify-between p-3.5 cursor-pointer select-none"
                        >
                          <div className="space-y-0.5">
                            <span className="font-extrabold text-xs md:text-sm text-slate-100 flex items-center gap-1.5">
                              🏪 {b.name}
                              <span className="text-[10px] bg-blue-900/40 text-blue-300 border border-blue-800 px-1.5 rounded-md font-bold">
                                {b.totalCount} 笔提报
                              </span>
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <div className="text-right text-[10px] font-mono flex items-center gap-x-2 text-slate-400">
                              <span>总量: <strong className="text-slate-200 font-bold">{b.totalQty}件</strong></span>
                              <span>完结: <strong className="text-emerald-400 font-bold">{b.completedCount}比</strong></span>
                              <span>作废: <strong className="text-rose-400 font-bold">{b.cancelledCount}比</strong></span>
                            </div>
                            <span className="text-slate-500 text-xs font-black shrink-0">{isSelected ? '▲' : '▼'}</span>
                          </div>
                        </div>

                        {/* Detail rows for this branch */}
                        {isSelected && (
                          <div className="bg-slate-950 p-4 border-t border-slate-900 space-y-3">
                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-black border-b border-slate-900 pb-2 px-1">
                              <span>【{b.name}】关联提货流运转实时明细:</span>
                              <span className="text-blue-400 font-mono">共 {b.totalCount} 笔记录</span>
                            </div>
                            <div className="max-h-72 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-900/65">
                              {orders.filter(o => o.branchName === b.name).map(o => {
                                let statusTag = '';
                                if (o.status === 'pending_confirm') statusTag = '🎨 待报审草稿';
                                if (o.status === 'pending_purchase') statusTag = '📨 待前台核准';
                                if (o.status === 'purchased') statusTag = '🏭 采购已发货';
                                if (o.status === 'completed') statusTag = '✅ 全部到货完结';
                                if (o.status === 'cancelled') statusTag = '🚫 已作废/取消';
                                if (o.status === 'rejected') statusTag = '↩️ 退回修正';

                                return (
                                  <div key={o.id} className="pt-2 text-[11px] leading-relaxed flex flex-col md:flex-row justify-between md:items-center gap-2">
                                    <div className="space-y-0.5">
                                      <div className="font-bold text-slate-200">
                                        {o.productName} <span className="text-[10px] text-slate-500 font-mono">({o.specs})</span>
                                      </div>
                                      <div className="text-[10px] text-[10px] text-slate-400 flex flex-wrap items-center gap-x-2">
                                        <span>单号: <strong className="font-mono text-slate-300">{o.orderNo}</strong></span>
                                        <span>量: <strong className="text-slate-200 font-mono">{o.quantity}件</strong></span>
                                        {o.receivedQty > 0 && <span>实到: <strong className="text-emerald-400 font-mono">{o.receivedQty}件</strong></span>}
                                        {o.status === 'purchased' && o.quantity - o.receivedQty > 0 && (
                                          <span className="text-rose-450 font-bold bg-rose-950/40 border border-rose-900 px-1 rounded text-[9px]">
                                            缺: {o.quantity - o.receivedQty}件
                                          </span>
                                        )}
                                      </div>
                                      {o.status === 'cancelled' && (
                                        <div className="text-[10px] text-rose-400 p-1.5 bg-rose-950/20 border border-rose-900/40 rounded mt-1">
                                          <strong>作废说明：</strong> {o.cancelReason || '未填写具体原因'}
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-350 border border-slate-800 font-medium whitespace-nowrap">
                                        {statusTag}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2 CONTENT: Staff / Operations tracker with specific User screening */}
          {activeAdminTab === 'staff' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-300 tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-550 bg-indigo-500 animate-pulse animate-pulse shrink-0" />
                    按人员账号精确检索及操作穿透（选择同仁过滤对应底稿）
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-1">
                    可以筛选不同人员在系统内的活跃情况；点击特定操作人卡片即可穿透查看其全周期的审计记录。
                  </p>
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="输入同仁姓名/账号定位..."
                    value={staffQuery}
                    onChange={(e) => setStaffQuery(e.target.value)}
                    className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none min-w-[200px]"
                  />
                </div>
              </div>

              {/* Grid of Staff operators matches query */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {staffStats.filter(s => s.name.toLowerCase().includes(staffQuery.toLowerCase())).length === 0 ? (
                  <div className="col-span-full p-8 text-center bg-slate-850/45 rounded-xl border border-slate-800 text-slate-500 text-xs font-bold">
                    没有检索和匹配到人员“{staffQuery}”
                  </div>
                ) : (
                  staffStats
                    .filter(s => s.name.toLowerCase().includes(staffQuery.toLowerCase()))
                    .map(s => {
                      const isSelected = selectedStaff === s.name;
                      return (
                        <div 
                          key={s.name}
                          onClick={() => setSelectedStaff(isSelected ? null : s.name)}
                          className={`p-4 rounded-xl border cursor-pointer transition-all select-none ${
                            isSelected 
                              ? 'bg-indigo-950/45 border-indigo-555 border-indigo-500/80 shadow-md shadow-indigo-500/5' 
                              : 'bg-slate-850/80 border-slate-805 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-extrabold text-sm text-slate-105 text-slate-100 flex items-center gap-1.5">
                                👤 {s.name}
                              </div>
                              <div className="text-[10.5px] text-slate-400 mt-2 space-y-0.5">
                                <div>系统安全日志: <strong className="text-indigo-400 font-semibold">{s.logCount} 次修改</strong></div>
                                <div>承接合并派产: <strong className="text-blue-400 font-semibold">待办 {s.assignedPending} 笔 | 完工 {s.assignedCompleted} 笔</strong></div>
                              </div>
                            </div>
                            <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded border ${
                              isSelected ? 'bg-indigo-900 text-indigo-300 border-indigo-700' : 'bg-slate-900 text-slate-500 border-slate-800'
                            }`}>
                              {isSelected ? '已选择' : '点击穿透'}
                            </span>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-slate-800/60 text-[10px] text-slate-400 truncate">
                            <span className="font-mono text-slate-500">最新:</span> {s.lastAction}
                          </div>
                        </div>
                      );
                    })
                )}
              </div>

              {/* Staff dedicated trace drawer if selected */}
              {selectedStaff && (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-205">🔍 人员审计明细: 【{selectedStaff}】的历史操作轨迹</span>
                      <span className="text-[9px] px-2 py-0.5 bg-indigo-950/60 text-indigo-300 border border-indigo-850 rounded font-mono">
                        筛选完成
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedStaff(null)}
                      className="text-[10px] font-bold text-rose-450 hover:text-rose-450/85 px-2 py-0.5 bg-slate-900 border border-slate-800 rounded transition-colors"
                    >
                      清屏返回
                    </button>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2 divider-y divide-slate-900 pr-1 text-xs">
                    {logs.filter(l => l.username === selectedStaff).map((l, index) => (
                      <div key={index} className="pt-2 text-[11px]">
                        <div className="flex items-center justify-between gap-2 text-[9.5px] text-slate-500 mb-1 font-mono">
                          <span className="text-indigo-400 font-extrabold">【{l.action}】</span>
                          <span>{new Date(l.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-350 ml-1 font-medium bg-slate-905 bg-slate-900/30 p-2 border border-slate-900/50 rounded">{l.details}</p>
                      </div>
                    ))}
                    {logs.filter(l => l.username === selectedStaff).length === 0 && (
                      <div className="p-8 text-center text-slate-600 font-bold">该同仁在当前数据库中暂无记录。</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3 CONTENT: Independent Supplier & Product Screening Panel */}
          {activeAdminTab === 'search' && (() => {
            const uniqueSuppliers = Array.from(new Set(orders.map(o => o.supplier).filter(Boolean)));
            const uniqueBranches = Array.from(new Set(orders.map(o => o.branchName).filter(Boolean)));

            // Compute filtering on orders
            const matchedOrders = orders.filter(o => {
              const productMatch = !queryProduct || 
                o.productName.toLowerCase().includes(queryProduct.toLowerCase()) || 
                o.productCode.toLowerCase().includes(queryProduct.toLowerCase());
              
              const supplierMatch = !querySupplier || o.supplier === querySupplier;
              const branchMatch = queryBranch === 'all' || o.branchName === queryBranch;
              
              let statusMatch = true;
              if (queryStatus !== 'all') {
                statusMatch = o.status === queryStatus;
              }
              
              return productMatch && supplierMatch && branchMatch && statusMatch;
            });

            const matchedTotalQty = matchedOrders.reduce((sum, o) => sum + o.quantity, 0);
            const matchedCompletedQty = matchedOrders.filter(o => o.status === 'completed').reduce((sum, o) => sum + o.quantity, 0);

            return (
              <div className="space-y-4 animate-fadeIn text-xs">
                {/* Advanced Filter Box */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3.5">
                  <div className="flex items-center justify-between border-b border-slate-900 pb-1">
                    <span className="font-extrabold text-xs text-slate-300">🛠️ 独立交叉筛查过滤面板（商品与供货商联动）</span>
                    <button 
                      type="button" 
                      onClick={() => {
                        setQueryProduct('');
                        setQuerySupplier('');
                        setQueryBranch('all');
                        setQueryStatus('all');
                      }}
                      className="text-[9.5px] text-blue-400 hover:text-blue-300 font-bold font-mono hover:underline"
                    >
                      [ 恢复默认重置筛选 ]
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Item query */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase">1. 独立商品筛选 (支持编码/名称)</label>
                      <input
                        type="text"
                        placeholder="输入款号/名称模糊匹配..."
                        value={queryProduct}
                        onChange={(e) => setQueryProduct(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-205 text-slate-200 rounded-lg p-2 font-medium text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    {/* Supplier filter */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase">2. 独立供应商筛选</label>
                      <select
                        value={querySupplier}
                        onChange={(e) => setQuerySupplier(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-lg p-2 font-medium text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="">全部合作供应商 ({uniqueSuppliers.length} 家)</option>
                        {uniqueSuppliers.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    {/* Branch filter */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase">3. 来源提交分店</label>
                      <select
                        value={queryBranch}
                        onChange={(e) => setQueryBranch(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-lg p-2 font-medium text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="all">全部来源分店 ({uniqueBranches.length} 个)</option>
                        {uniqueBranches.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>

                    {/* Status filter */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase">4. 订单当前运作状态</label>
                      <select
                        value={queryStatus}
                        onChange={(e) => setQueryStatus(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-lg p-2 font-medium text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="all">任意运作进度</option>
                        <option value="pending_confirm">待前台核对</option>
                        <option value="pending_purchase">待前台核发</option>
                        <option value="purchased">采购运输中 (在途/欠货中)</option>
                        <option value="completed">已足额到货完结</option>
                        <option value="cancelled">异常申请/已作废取消</option>
                        <option value="rejected">退回分店待修改</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Filter statistics strip */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 bg-slate-850 rounded-xl border border-slate-800 text-[10px]">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">检索到匹配笔数: <strong className="text-white font-black text-xs font-mono">{matchedOrders.length} 笔</strong></span>
                    <span className="text-slate-400">|</span>
                    <span className="text-slate-400">累计订单总件数: <strong className="text-indigo-400 font-bold font-mono">{matchedTotalQty} 件</strong></span>
                    <span className="text-slate-400">|</span>
                    <span className="text-slate-400">已到货完好交付: <strong className="text-emerald-400 font-bold font-mono">{matchedCompletedQty} 件</strong></span>
                  </div>
                  <span className="text-[9px] text-slate-500 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded font-mono">
                    LIVE SIFT
                  </span>
                </div>

                {/* Matched list layout table */}
                <div className="bg-slate-850 rounded-xl border border-slate-800 overflow-hidden text-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[700px]">
                      <thead>
                        <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 text-[10px] uppercase font-black tracking-wider">
                          <th className="p-3">订单号 & 时间</th>
                          <th className="p-3">提报分店</th>
                          <th className="p-3">商品编码 & 商品名称</th>
                          <th className="p-3">规格/尺寸/型号</th>
                          <th className="p-3 text-center">订货数量</th>
                          <th className="p-3">合作供应商</th>
                          <th className="p-3 text-center w-28">当前状态</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850 text-slate-350">
                        {matchedOrders.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-12 text-center text-slate-500 font-bold">
                              💡 暂无任何满足筛查条件的商品货单。请重新调整和配置上方筛查条件。
                            </td>
                          </tr>
                        ) : (
                          matchedOrders.map(o => {
                            let badge = (
                              <span className="text-[9px] bg-slate-900 border border-slate-850 px-2 py-0.5 rounded text-slate-400">
                                未知
                              </span>
                            );
                            if (o.status === 'pending_confirm') badge = <span className="text-[9px] bg-amber-950 text-amber-300 border border-amber-900/60 px-1.5 py-0.5 rounded">待核对</span>;
                            if (o.status === 'pending_purchase') badge = <span className="text-[9px] bg-blue-950 text-blue-300 border border-blue-900/60 px-1.5 py-0.5 rounded">待前台确认</span>;
                            if (o.status === 'purchased') badge = <span className="text-[9px] bg-indigo-950 text-indigo-300 border border-indigo-900/60 px-1.5 py-0.5 rounded">运输/排产中</span>;
                            if (o.status === 'completed') badge = <span className="text-[9px] bg-green-950 text-green-300 border border-green-900/60 px-1.5 py-0.5 rounded">已全部到齐</span>;
                            if (o.status === 'cancelled') badge = <span className="text-[9px] bg-rose-950 text-rose-300 border border-rose-900/60 px-1.5 py-0.5 rounded">异常作废</span>;
                            if (o.status === 'rejected') badge = <span className="text-[9px] bg-purple-950 text-purple-300 border border-purple-900/60 px-1.5 py-0.5 rounded">退回修正</span>;

                            return (
                              <tr key={o.id} className="hover:bg-slate-800/10 transition-colors">
                                <td className="p-3 font-medium">
                                  <div className="font-bold text-slate-200">{o.orderNo}</div>
                                  <div className="text-[9px] text-slate-550 font-mono mt-0.5">{o.createdAt}</div>
                                </td>
                                <td className="p-3 font-semibold text-slate-200">
                                  🏪 {o.branchName}
                                </td>
                                <td className="p-3">
                                  <div className="font-bold text-slate-200">{o.productName}</div>
                                  <div className="text-[9.5px] text-slate-500 font-mono mt-0.5">编码: {o.productCode}</div>
                                </td>
                                <td className="p-3 font-medium text-slate-400">
                                  {o.specs}
                                </td>
                                <td className="p-3 text-center font-bold font-mono text-slate-100">
                                  {o.quantity}
                                </td>
                                <td className="p-3 font-medium text-slate-300">
                                  🌐 {o.supplier}
                                </td>
                                <td className="p-3 text-center">
                                  {badge}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* TAB 4 CONTENT: Full Trace activity stream with custom log text-search */}
          {activeAdminTab === 'trace' && (
            <div className="space-y-4 animate-fadeIn text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950 p-4 rounded-xl border border-slate-850">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-emerald-400 font-bold tracking-widest flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    超级历史全轨迹：系统运行动作与审计日志
                  </span>
                  <p className="text-[10px] text-slate-550">自动捕获全方位指令动向，可自由在下方直接匹配任意内容。</p>
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="输入操作人、操作内容、事件..."
                    value={traceLogSearch}
                    onChange={(e) => setTraceLogSearch(e.target.value)}
                    className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none min-w-[200px]"
                  />
                </div>
              </div>

              <div className="bg-slate-950 rounded-xl p-3 border border-slate-850/60 max-h-72 overflow-y-auto divide-y divide-slate-900 space-y-2.5">
                {logs.filter(l => {
                  const queryStr = traceLogSearch.toLowerCase();
                  return !traceLogSearch ||
                    l.username.toLowerCase().includes(queryStr) ||
                    l.role.toLowerCase().includes(queryStr) ||
                    l.action.toLowerCase().includes(queryStr) ||
                    l.details.toLowerCase().includes(queryStr);
                }).length === 0 ? (
                  <div className="p-10 text-center text-slate-500 font-extrabold text-xs">
                    没有搜索到匹配的审计日志流水“{traceLogSearch}”
                  </div>
                ) : (
                  logs.filter(l => {
                    const queryStr = traceLogSearch.toLowerCase();
                    return !traceLogSearch ||
                      l.username.toLowerCase().includes(queryStr) ||
                      l.role.toLowerCase().includes(queryStr) ||
                      l.action.toLowerCase().includes(queryStr) ||
                      l.details.toLowerCase().includes(queryStr);
                  }).map((l, idx) => {
                    let roleColor = 'text-amber-300 bg-amber-950/20 border-amber-900';
                    if (l.role === 'admin') roleColor = 'bg-rose-950/20 text-rose-305 border-rose-900';
                    if (l.role === 'branch') roleColor = 'bg-blue-950/20 text-blue-300 border-blue-900';
                    if (l.role === 'purchasing') roleColor = 'bg-indigo-950/20 text-indigo-300 border-indigo-900';

                    return (
                      <div key={idx} className="pt-2.5 flex items-start gap-3 text-xs leading-relaxed">
                        <span className="font-mono text-[9px] text-slate-500 pt-0.5 whitespace-nowrap">{new Date(l.timestamp).toLocaleTimeString()}</span>
                        <div className="flex-1 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <strong className="text-slate-200 font-extrabold">👤 {l.username}</strong>
                            <span className={`text-[8.5px] px-1.5 py-0.2 border rounded font-black whitespace-nowrap ${roleColor}`}>
                              {l.role === 'admin' ? '主管/管理员' : l.role === 'branch' ? '分店提单' : l.role === 'receptionist' ? '前台文员' : '采购跟单组'}
                            </span>
                            <span className="text-[10px] text-indigo-400 font-black">【{l.action}】</span>
                          </div>
                          <p className="text-slate-350">{l.details}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Deficit products list */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-slate-800 text-sm md:text-base">欠货最高产品排行 (Top 5)</h3>
            </div>
            <span className="text-xs text-slate-400">实时计算</span>
          </div>

          {topBacklogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-xs">
              <ClipboardList className="w-8 h-8 stroke-[1.5] text-slate-300 mb-2" />
              <span>当前系统暂无厂家欠货数据</span>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {topBacklogs.map((item, idx) => {
                // Calculate percentage against threshold or highest backlog
                const maxQty = Math.max(...topBacklogs.map(b => b.qty), systemConfig.shortageThreshold);
                const percent = Math.min(100, Math.round((item.qty / maxQty) * 100));
                
                return (
                  <div key={item.code} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs md:text-sm">
                      <div className="flex items-center gap-2 font-medium text-slate-700">
                        <span className="text-slate-400 font-mono w-4">#{idx + 1}</span>
                        <span>{item.name}</span>
                        <span className="text-xs bg-slate-150 text-slate-500 font-mono px-1.5 py-0.2 rounded">
                          {item.code}
                        </span>
                      </div>
                      <span className="font-bold text-rose-600 font-mono">{item.qty} 件</span>
                    </div>
                    {/* Bar container */}
                    <div className="w-full h-2.5 bg-slate-50 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          item.qty >= systemConfig.shortageThreshold ? 'bg-rose-500' : 'bg-amber-500'
                        }`} 
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Configuration stacked with Backup Panel */}
        <div className="space-y-6">
          {/* Threshold Settings Panel */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 md:p-6 space-y-4">
            <div className="flex items-center gap-2 text-blue-600">
              <Settings className="w-5 h-5" />
              <h3 className="font-semibold text-slate-800 text-sm md:text-base">欠货告警告警线偏好</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              当分店欠货总和达到该偏好值时，系统将在前台与各级后台推送高亮报警横幅，用以督促采购部门尽快补齐货源。
            </p>

            <form onSubmit={handleUpdateConfig} className="space-y-4 pt-2 border-t border-slate-50">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">当前告警阈值（件）</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    disabled={!isAdmin}
                    value={thresholdInput}
                    onChange={e => setThresholdInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 disabled:bg-slate-50/50 disabled:text-slate-400"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400">件</span>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 space-y-1">
                <div>最后修改时间: {new Date(systemConfig.updatedAt).toLocaleString()}</div>
                <div>修改操作人: {systemConfig.updatedBy}</div>
              </div>

              {isAdmin ? (
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer disabled:bg-blue-400"
                >
                  {isUpdating ? '正在提交...' : '更新告警阈值'}
                </button>
              ) : (
                <div className="text-rose-500 text-[11px] p-2 bg-rose-50 border border-rose-100 rounded-lg text-center font-medium">
                  🔒 仅超级管理员拥有修改警报警戒线配置的权限
                </div>
              )}
            </form>
          </div>

          {/* Admin Dedicated System Backup Panel */}
          {isAdmin && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 md:p-6 space-y-4">
              <div className="flex items-center gap-2 text-blue-600">
                <Database className="w-4 h-4 text-blue-600 animate-pulse" />
                <h3 className="font-semibold text-slate-800 text-sm md:text-base">运行状态离线物理全备份 (Excel)</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                作为主数据防线保障，管理员可一键对系统全部实体数据切片（包含<strong>全分店订单总表</strong>、<strong>总部备货库库存量</strong>、<strong>合并采购流转单</strong>、以及<strong>全平台操作审计日志</strong>）开展离线归档，实现物理级安全物理阻断备份。
              </p>
              <div className="pt-2.5 border-t border-slate-50">
                <button
                  type="button"
                  onClick={handleExportFullBackup}
                  disabled={isBackingUp}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-850 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className={`w-3.5 h-3.5 ${isBackingUp ? 'animate-bounce' : ''}`} />
                  <span>{isBackingUp ? '正在拉取动态库并生成工作表...' : '立即导出全系统备份文件 (.xls)'}</span>
                </button>
                <p className="text-[9px] text-slate-400 leading-normal text-center mt-2.5">
                  注：采用标准的 Excel-XML 复合电子表格格式构建。下载后支持直接使用 Microsoft Office、WPS 极速载入，能安全还原出独立划分的多 Sheet 工作表信息。
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
