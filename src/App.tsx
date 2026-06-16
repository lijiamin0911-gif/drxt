import React, { useState, useEffect, useRef } from 'react';
import { 
  LogOut, 
  Key, 
  Building, 
  Layers, 
  ShoppingBag, 
  AlertTriangle, 
  Terminal, 
  Sliders, 
  ShieldAlert, 
  Users, 
  CheckCircle,
  LayoutDashboard,
  Sparkles,
  FileSpreadsheet,
  ArrowRight,
  ChevronRight,
  Globe,
  Lock,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DbService } from './lib/dbService';
import { User, Order, PurchaseOrder, SystemConfig, OperationLog, InventoryItem } from './types';

// Importing Views
import DashboardView from './components/DashboardView';
import UserManagementView from './components/UserManagementView';
import BranchOrderView from './components/BranchOrderView';
import ReceptionConfirmView from './components/ReceptionConfirmView';
import PurchasingView from './components/PurchasingView';
import ShortageReportView from './components/ShortageReportView';
import LogsView from './components/LogsView';
import InventoryView from './components/InventoryView';
import OrderQueryView from './components/OrderQueryView';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  
  const [usernameInput, setUsernameInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [bypassKickout, setBypassKickout] = useState<boolean>(() => {
    const stored = localStorage.getItem('bypass_kickout');
    // Default to true so that users can view multiple roles/tabs simultaneously without kicking others out during evaluation
    return stored ? stored === 'true' : true;
  });

  const handleToggleBypass = (val: boolean) => {
    setBypassKickout(val);
    localStorage.setItem('bypass_kickout', val ? 'true' : 'false');
  };

  const [showAccountsGuide, setShowAccountsGuide] = useState(true);
  const [guideSearchQuery, setGuideSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isLoading, setIsLoading] = useState(true);

  // Real-time notification toast queue
  const [toasts, setToasts] = useState<{ id: string; text: string; type: 'success' | 'info' | 'warning' | 'error'; duration?: number }[]>([]);
  
  const addToast = (text: string, type: 'success' | 'info' | 'warning' | 'error' = 'info', duration = 6000) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setToasts(prev => [...prev, { id, text, type, duration }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  };

  // Comparative references for state change auditing (real-time notification processing)
  const prevOrdersRef = useRef<Order[]>([]);
  const prevPurchaseOrdersRef = useRef<PurchaseOrder[]>([]);
  const prevInventoryRef = useRef<InventoryItem[]>([]);
  const isFirstLoadRef = useRef(true);

  // Load and subscribe to DB Changes
  useEffect(() => {
    let unsubscribe: () => void;

    async function loadAllData() {
      setIsLoading(true);
      try {
        await DbService.initialize();
        const [u, o, po, lg, cfg, inv] = await Promise.all([
          DbService.getUsers(),
          DbService.getOrders(),
          DbService.getPurchaseOrders(),
          DbService.getLogs(),
          DbService.getConfig(),
          DbService.getInventory()
        ]);
        setUsers(u);
        setOrders(o);
        setPurchaseOrders(po);
        setLogs(lg);
        setSystemConfig(cfg);

        // Seed comparative registries to block first-load toast flood
        prevOrdersRef.current = o;
        prevPurchaseOrdersRef.current = po;
        prevInventoryRef.current = inv;
        isFirstLoadRef.current = false;

        // Bind real-time change listener
        unsubscribe = DbService.onChange(async () => {
          const [u2, o2, po2, lg2, cfg2, inv2] = await Promise.all([
            DbService.getUsers(),
            DbService.getOrders(),
            DbService.getPurchaseOrders(),
            DbService.getLogs(),
            DbService.getConfig(),
            DbService.getInventory()
          ]);

          // Compare logic to generate gorgeous role-specific live Toast Notifications
          const localUser = JSON.parse(sessionStorage.getItem('current_user') || 'null') || currentUser;
          
          if (!isFirstLoadRef.current && localUser) {
            const currentRole = localUser.role;
            const currentUserId = localUser.id;

            // 1. Check for New Orders (Created)
            o2.forEach(newOrder => {
              const oldMatch = prevOrdersRef.current.find(o => o.id === newOrder.id);
              if (!oldMatch) {
                if (currentRole === 'admin' || currentRole === 'receptionist') {
                  addToast(
                    `🔔 实时新提报：【${newOrder.branchName}】新增了货品订单\n商品：${newOrder.productName} (${newOrder.specs}) x ${newOrder.quantity} 件\n状态：待前台确认`,
                    'info'
                  );
                } else if (currentRole === 'branch' && newOrder.branchId === currentUserId) {
                  addToast(
                    `📝 本店提报成功！订单已进入待确认状态 [编号: ${newOrder.orderNo}]`,
                    'success'
                  );
                }
              } else {
                // 2. Check for Order modifications (Status changes or prices)
                if (oldMatch.status !== newOrder.status) {
                  const statusLabels: Record<string, string> = {
                    'pending_confirm': '待前台确认',
                    'pending_purchase': '待汇总采购',
                    'purchased': '已采购待到货',
                    'completed': '已完成(已入库)',
                    'cancelled': '已取消',
                    'rejected': '被驳回'
                  };
                  const oldLabel = statusLabels[oldMatch.status] || oldMatch.status;
                  const newLabel = statusLabels[newOrder.status] || newOrder.status;

                  if (currentRole === 'admin' || currentRole === 'receptionist' || currentRole === 'purchasing') {
                    addToast(
                      `🔄 【状态变更】订单 [${newOrder.orderNo}]\n商品: ${newOrder.productName} x ${newOrder.quantity}\n分店: ${newOrder.branchName}\n变更为：[${newLabel}]`,
                      'success'
                    );
                  } else if (currentRole === 'branch' && newOrder.branchId === currentUserId) {
                    addToast(
                      `📦 【本店订单状态已变更】您提报的 ${newOrder.productName} x ${newOrder.quantity}\n当前最新状态变更为：【${newLabel}】`,
                      newOrder.status === 'rejected' ? 'error' : 'success'
                    );
                  }
                }

                // Check for Price Updates (Auditing/reception price updates)
                if ((oldMatch.currentPrice !== newOrder.currentPrice) || (oldMatch.previousPrice !== newOrder.previousPrice)) {
                  if (currentRole === 'admin' || (currentRole === 'branch' && newOrder.branchId === currentUserId)) {
                    addToast(
                      `💰 【核算价变动】订单 [${newOrder.orderNo}]\n货品: ${newOrder.productName}\n核算单价变更为：¥${newOrder.currentPrice || 0} / 件`,
                      'success'
                    );
                  }
                }
              }
            });

            // 3. New / Modified Purchase Orders (POs)
            po2.forEach(newPo => {
              const oldMatch = prevPurchaseOrdersRef.current.find(po => po.id === newPo.id);
              if (!oldMatch) {
                if (currentRole === 'admin' || currentRole === 'purchasing') {
                  addToast(
                    `📦 【新增采购订货单】[${newPo.poNo}]\n供应商：${newPo.supplier}\n计划汇总订购货品数量：${newPo.totalQuantity} 件`,
                    'warning'
                  );
                } else if (currentRole === 'branch') {
                  // Find if any of our orders were included in this PO
                  const ourOrdersInPo = o2.filter(o => o.branchId === currentUserId && newPo.orderIds.includes(o.id));
                  if (ourOrdersInPo.length > 0) {
                    addToast(
                      `✈️ 【采购发运中】您的 ${ourOrdersInPo.length} 项货品已汇总到采购单 [${newPo.poNo}]，由供应商 [${newPo.supplier}] 进行备货发运！`,
                      'info'
                    );
                  }
                }
              } else {
                if (oldMatch.factoryStatus !== newPo.factoryStatus) {
                  const label = newPo.factoryStatus === 'confirmed' ? '厂家已确认接收' : '未接收';
                  if (currentRole === 'admin' || currentRole === 'purchasing') {
                    addToast(
                      `🏭 【厂家来信】采购单 [${newPo.poNo}] 厂家接单状态已更新：${label}`,
                      'warning'
                    );
                  }
                }
                if (oldMatch.expectedArrivalDate !== newPo.expectedArrivalDate && newPo.expectedArrivalDate) {
                  if (currentRole === 'admin' || currentRole === 'purchasing' || currentRole === 'receptionist') {
                    addToast(
                      `🗓️ 【预计提货日更新】采购单 [${newPo.poNo}]\n供应商：${newPo.supplier}\n交付排产日期：${newPo.expectedArrivalDate}`,
                      'warning'
                    );
                  }
                }
                if (oldMatch.status !== newPo.status) {
                  const poLabels: Record<string, string> = {
                    'pending_arrival': '发运中/待收货',
                    'completed': '全额到货',
                    'cancelled': '已取消'
                  };
                  const statusLabel = poLabels[newPo.status] || newPo.status;
                  if (currentRole === 'admin' || currentRole === 'purchasing' || currentRole === 'receptionist') {
                    addToast(
                      `📦 【采购单交付状态变动】采购单 [${newPo.poNo}]\n最新状态：【${statusLabel}】`,
                      'success'
                    );
                  }
                }
              }
            });

            // 4. Inventory Stock updates (Deduction and replenishment)
            inv2.forEach(newInv => {
              const oldMatch = prevInventoryRef.current.find(i => i.productCode === newInv.productCode);
              if (oldMatch && oldMatch.currentStock !== newInv.currentStock) {
                const diff = newInv.currentStock - oldMatch.currentStock;
                const changeDetail = diff > 0 ? `入库上架增加 ${diff} 件` : `出库扣减 ${Math.abs(diff)} 件`;
                
                if (currentRole === 'admin' || currentRole === 'purchasing' || currentRole === 'receptionist') {
                  addToast(
                    `📦 【库存精细变动】货品：[${newInv.productName}] \n变动动作：${changeDetail}\n当前库内现存：${newInv.currentStock} 件`,
                    diff > 0 ? 'success' : 'info'
                  );
                }
              }
            });
          }

          // Save current snapshots for future comparisons
          prevOrdersRef.current = o2;
          prevPurchaseOrdersRef.current = po2;
          prevInventoryRef.current = inv2;

          setUsers(u2);
          setOrders(o2);
          setPurchaseOrders(po2);
          setLogs(lg2);
          setSystemConfig(cfg2);
        });

      } catch (err) {
        console.error('Failed to load DB resources:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadAllData();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser]);

  // Set default tab based on logged role
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'branch') {
        setActiveTab('branch-orders');
      } else if (currentUser.role === 'receptionist') {
        setActiveTab('reception-confirm');
      } else if (currentUser.role === 'purchasing') {
        setActiveTab('purchasing-pos');
      } else {
        setActiveTab('dashboard'); // Admin default
      }
    }
  }, [currentUser]);

  // 除了超级管理员，账号同一时间仅限一人登录。他人上线则挤掉旧会话并踢下线。
  useEffect(() => {
    if (bypassKickout) return; // 超管预设已授权多浏览器页签、跨设备免密多角色同账号并存模式
    if (currentUser && currentUser.role !== 'admin') {
      const dbMatchedUser = users.find(u => u.id === currentUser.id);
      if (dbMatchedUser && dbMatchedUser.sessionToken) {
        const localSess = sessionStorage.getItem('current_session_token') || localStorage.getItem(`session_token_${currentUser.id}`);
        
        // 解析 Session Token 中的时间戳进行安全比对，防范异步加载产生的时序紊乱（闪退/无法登录等情况）
        const getSessionTimestamp = (tokenStr: string | null | undefined): number => {
          if (!tokenStr || !tokenStr.startsWith('sess_')) return 0;
          const parts = tokenStr.split('_');
          const ts = parseInt(parts[1], 10);
          return isNaN(ts) ? 0 : ts;
        };

        const dbTs = getSessionTimestamp(dbMatchedUser.sessionToken);
        const localTs = getSessionTimestamp(localSess || currentUser.sessionToken);

        // 仅当数据库中的新会话时间戳严格大于本地当前登录会话的时间戳时，才确认为被后登录的会话顶替
        if (dbMatchedUser.sessionToken !== localSess && dbTs > localTs) {
          alert(`⚠️ 安全警示：您的账号 [${currentUser.username}] 已在其他设备或新浏览器页签登录！当前会话已直接被强制下线。`);
          setCurrentUser(null);
          sessionStorage.removeItem('current_session_token');
          localStorage.removeItem(`session_token_${currentUser.id}`);
        }
      }
    }
  }, [users, currentUser, bypassKickout]);

  // Load and subscribe to DB Changes

  const getMatchedUser = (typed: string) => {
    const search = typed.trim();
    let matched = users.find(u => u.username.trim() === search);
    if (!matched && search.toLowerCase() === 'admin') {
      matched = users.find(u => u.id === 'u_admin');
    }
    return matched;
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) {
      alert('请输入您的系统登录账号');
      return;
    }

    const matched = getMatchedUser(usernameInput);
    if (!matched) {
      alert('系统未登记此登录账号，请更换或联系管理员分配');
      return;
    }

    if (!matched.isActive) {
      alert('此账户已被系统管理员禁用，请联系管理员激活');
      return;
    }

    if (!pinInput) {
      alert('请输入对应的安全 PIN 验证码');
      return;
    }

    if (pinInput === matched.pin) {
      const sessionToken = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
      sessionStorage.setItem('current_session_token', sessionToken);
      localStorage.setItem(`session_token_${matched.id}`, sessionToken);

      // If logging in as admin and existing database record username isn't 'admin' yet, normalize it
      const finalUsername = matched.id === 'u_admin' ? 'admin' : matched.username;
      const updatedUser: User = {
        ...matched,
        username: finalUsername,
        sessionToken
      };

      try {
        await DbService.saveUser(updatedUser, { id: matched.id, name: finalUsername, role: matched.role });
      } catch (err) {
        console.error('更新会话Token失败', err);
      }

      setCurrentUser(updatedUser);
      setPinInput('');
      setUsernameInput('');
      
      // Log login success
      DbService.log(
        matched.id,
        finalUsername,
        matched.role,
        '自主登录',
        `账号 [${finalUsername}] 验证成功且单人安全会话锁定，登录进入协同视角`
      );
    } else {
      alert('安全验证失败：验证 PIN 码不匹配，请重新输入');
      setPinInput('');
    }
  };

  const handleLogout = async () => {
    if (currentUser) {
      await DbService.log(
        currentUser.id,
        currentUser.username,
        currentUser.role,
        '自主登出',
        `安全退出系统会话`
      );
      setCurrentUser(null);
    }
  };

  // Wrapper DB actions
  const onSaveUser = async (user: User) => {
    if (!currentUser) return;
    await DbService.saveUser(user, { id: currentUser.id, name: currentUser.username, role: currentUser.role });
  };

  const onDeleteUser = async (userId: string, username: string) => {
    if (!currentUser) return;
    await DbService.deleteUser(userId, username, { id: currentUser.id, name: currentUser.username, role: currentUser.role });
  };

  const onAddBranchOrders = async (items: any[], submissionDate?: string) => {
    if (!currentUser) return;
    await DbService.submitOrder(currentUser.id, currentUser.branchName || currentUser.username, items, submissionDate);
  };

  const onConfirmOrdersByReception = async (orderIds: string[]) => {
    if (!currentUser) return;
    await DbService.batchConfirmOrders(orderIds, { id: currentUser.id, name: currentUser.username, role: currentUser.role });
  };

  const onGeneratePurchaseOrders = async (orderIds: string[], remarks: string) => {
    if (!currentUser) return;
    await DbService.generatePurchaseOrders(orderIds, { id: currentUser.id, name: currentUser.username, role: currentUser.role }, remarks);
  };

  const onCreateDirectPurchaseOrder = async (supplier: string, orderDate: string, remarks: string, items: any[]) => {
    if (!currentUser) return;
    await DbService.createDirectPurchaseOrder(
      supplier,
      orderDate,
      remarks,
      items,
      { id: currentUser.id, name: currentUser.username, role: currentUser.role }
    );
  };

  const onSubmitPoToFactory = async (poId: string, factoryStatus: 'confirmed' | 'unconfirmed', expectedArrivalDate: string) => {
    if (!currentUser) return;
    await DbService.submitPoToFactory(poId, factoryStatus, expectedArrivalDate, { id: currentUser.id, name: currentUser.username, role: currentUser.role });
  };

  const onLogArrival = async (poId: string, itemArrivals: { orderId: string; receivedQty: number }[]) => {
    if (!currentUser) return;
    await DbService.logArrival(poId, itemArrivals, { id: currentUser.id, name: currentUser.username, role: currentUser.role });
  };

  const onReplenishShortage = async (payload: any) => {
    if (!currentUser) return;
    await DbService.replenishShortage(payload, { id: currentUser.id, name: currentUser.username, role: currentUser.role });
  };

  const onConfigThresholdUpdate = async (newThreshold: number) => {
    if (!currentUser) return;
    await DbService.updateConfig(newThreshold, currentUser.username);
  };

  if (isLoading || !systemConfig) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 font-sans">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent mb-4"></div>
        <div className="text-sm font-semibold text-slate-800">数据库及依赖框架初始同步中...</div>
        <div className="text-xs text-slate-400 mt-1">首次接入将重置 seed 分店数据集</div>
      </div>
    );
  }

  // LOGIN PORTAL PAGE
  if (!currentUser) {
    return (
      <div id="login_portal_wrapper" className="min-h-screen bg-gradient-to-tr from-slate-50 via-slate-100/80 to-blue-50/40 flex items-center justify-center p-4 md:p-8 font-sans select-none relative overflow-hidden">
        {/* 背景轻量科技光晕 */}
        <div className="absolute -top-[30%] -left-[20%] w-[70%] h-[70%] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-[20%] -right-[15%] w-[60%] h-[60%] rounded-full bg-blue-400/5 blur-[100px] pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, y: 15, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md bg-white rounded-3xl border border-slate-200/80 shadow-[0_25px_60px_-15px_rgba(30,58,138,0.06)] p-6 md:p-10 space-y-6 relative z-10 backdrop-blur-xs"
        >
          {/* 商业化极简标头 */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-blue-700 text-[10px] sm:text-xs font-semibold tracking-wide uppercase mx-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
              企业级数智供应链协同
            </div>
            
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-850 tracking-tight flex items-center justify-center gap-3">
              <span className="p-1.5 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-xl shadow-md shadow-blue-500/10">
                <Layers className="w-5 h-5" />
              </span>
              多分店订单协同管理系统
            </h1>
            
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              请输入系统分配的账号，验证后将开启专属供应链协同视窗
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {/* 账号输入框 */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 tracking-wide flex items-center gap-1.5">
                <span className="w-1 h-3 bg-blue-600 rounded-full"></span>
                登录账号
              </label>
              <div className="relative">
                <Users className="absolute left-3.5 top-2.5 w-4.5 h-4.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="请输入您的系统登录账号"
                  value={usernameInput}
                  onChange={e => setUsernameInput(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600 text-sm duration-150 text-slate-800"
                />
              </div>
            </div>

            {/* PIN码输入框 */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 tracking-wide flex items-center gap-1.5">
                <span className="w-1 h-3 bg-blue-600 rounded-full"></span>
                安全 PIN 验证码
              </label>
              <div className="relative">
                <Key className="absolute left-3.5 top-2.5 w-4.5 h-4.5 text-slate-400" />
                <input
                  type="password"
                  maxLength={10}
                  placeholder="请输入您的安全 PIN 验证码"
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full pl-10 pr-3 py-2 border border-slate-200 bg-white rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600 text-sm duration-150 text-slate-800 placeholder:font-sans"
                />
              </div>
            </div>

            {/* 提交按钮 */}
            <motion.button
              type="submit"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 duration-150 flex items-center justify-center gap-1.5 cursor-pointer leading-none mt-2 shrink-0"
            >
              验证并安全登录系统 <ArrowRight className="w-3.5 h-3.5" />
            </motion.button>
          </form>

          <div className="text-center text-[10px] text-slate-400 pt-1 border-t border-slate-100 flex items-center justify-center gap-1 italic">
            <Globe className="w-3 h-3 text-slate-300" />
            分布式数据存储与高并发监听已就绪，全网订单数据实时动态连通。
          </div>
        </motion.div>
      </div>
    );
  }

  // MAIN RUNNING WORKSPACE
  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col text-slate-800">
      
      {/* Top Header */}
      <header className="bg-white border-b border-slate-150 sticky top-0 z-40 px-4 md:px-6 py-3 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* Logo Title */}
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
              <Layers className="w-4 h-4 md:w-5 md:h-5" />
            </span>
            <h1 className="text-xs md:text-sm lg:text-base font-bold text-slate-900 tracking-tight">
              多分店订单协同管理系统
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg">
              <div className="flex flex-col text-left">
                <span className="font-bold text-slate-900 leading-none">{currentUser.username}</span>
                <span className="text-[9px] text-slate-400 leading-none mt-0.5 uppercase font-semibold font-mono tracking-wider">
                  {currentUser.role === 'admin' && (currentUser.username.includes('副') ? '副系统管理员' : '主系统管理员')}
                  {currentUser.role === 'branch' && '分店业务人员'}
                  {currentUser.role === 'receptionist' && '前台汇总审批'}
                  {currentUser.role === 'purchasing' && '采购组主管'}
                </span>
              </div>
              
              <button
                onClick={handleLogout}
                className="p-1 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-100 rounded-md transition-all cursor-pointer"
                title="登出系统"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        
        {/* Navigation Tabs based on Role */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2">
          
          {/* Admin Role Tabs */}
          {currentUser.role === 'admin' && (
            <>
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-white text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-100'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>管理看板</span>
              </button>

              <button
                onClick={() => setActiveTab('users-mgmt')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'users-mgmt' ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-white text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-100'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>用户账号管理</span>
              </button>

              <button
                onClick={() => setActiveTab('branch-orders')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'branch-orders' ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-white text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-100'
                }`}
              >
                <Building className="w-3.5 h-3.5" />
                <span>分店采购提单</span>
              </button>

              <button
                onClick={() => setActiveTab('reception-confirm')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'reception-confirm' ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-white text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>前台审批汇总</span>
              </button>

              <button
                onClick={() => setActiveTab('purchasing-pos')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'purchasing-pos' ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-white text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-100'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>采购流转管理</span>
              </button>

              <button
                onClick={() => setActiveTab('shortage-reports')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 relative ${
                  activeTab === 'shortage-reports' ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-white text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-100'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                <span>欠货与补货分析</span>
                {orders.filter(o => o.status === 'purchased' && (o.receivedQty || 0) < o.quantity).length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75 animate-bounce"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('inventory-registry')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'inventory-registry' ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-white text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-100'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-500" />
                <span>备货库库存与导入</span>
              </button>

              <button
                onClick={() => setActiveTab('order-query')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'order-query' ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-white text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-100'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>每日订单明细一键查询</span>
              </button>

              <button
                onClick={() => setActiveTab('system-logs')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'system-logs' ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-white text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-100'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>操作审计日志</span>
              </button>
            </>
          )}

          {/* Branch Role limits */}
          {currentUser.role === 'branch' && (
            <>
              <button
                onClick={() => setActiveTab('branch-orders')}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-605 text-white shadow-sm flex items-center gap-1.5 bg-blue-600"
              >
                <Building className="w-3.5 h-3.5" />
                <span>我的分店货品提报提单</span>
              </button>
            </>
          )}

          {/* Receptionist Role limits */}
          {currentUser.role === 'receptionist' && (
            <>
              <button
                onClick={() => setActiveTab('reception-confirm')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'reception-confirm' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-105 bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>全分店待审批订单汇总 ({orders.filter(o => o.status === 'pending_confirm').length}件)</span>
              </button>
              
              <button
                onClick={() => setActiveTab('order-query')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'order-query' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-105 bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>每日订单明细一键查询</span>
              </button>
            </>
          )}

          {/* Purchasing Role limits */}
          {currentUser.role === 'purchasing' && (
            <>
              <button
                onClick={() => setActiveTab('purchasing-pos')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'purchasing-pos' ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-white text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-100'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>采购并单汇总与到到货</span>
              </button>
              
              <button
                onClick={() => setActiveTab('shortage-reports')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'shortage-reports' ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-white text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-100'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                <span>实时欠货报表与一键补货</span>
              </button>

              <button
                onClick={() => setActiveTab('inventory-registry')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'inventory-registry' ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-white text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-100'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-500" />
                <span>总部备货与零库采购</span>
              </button>
            </>
          )}

        </div>

        {/* Dynamic Render Subview according to selection */}
        <div className="animate-fadeIn min-h-[400px]">
          {activeTab === 'dashboard' && (
            <DashboardView
              orders={orders}
              systemConfig={systemConfig}
              onConfigChange={onConfigThresholdUpdate}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'users-mgmt' && (
            <UserManagementView
              users={users}
              onSaveUser={onSaveUser}
              onDeleteUser={onDeleteUser}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'branch-orders' && (
            <BranchOrderView
              orders={orders}
              purchaseOrders={purchaseOrders}
              onAddOrders={onAddBranchOrders}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'reception-confirm' && (
            <ReceptionConfirmView
              orders={orders}
              onConfirmOrders={onConfirmOrdersByReception}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'purchasing-pos' && (
            <PurchasingView
              orders={orders}
              purchaseOrders={purchaseOrders}
              onGeneratePos={onGeneratePurchaseOrders}
              onCreateDirectPo={onCreateDirectPurchaseOrder}
              onSubmitToFactory={onSubmitPoToFactory}
              onLogArrival={onLogArrival}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'shortage-reports' && (
            <ShortageReportView
              orders={orders}
              systemConfig={systemConfig}
              onReplenish={onReplenishShortage}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'inventory-registry' && (
            <InventoryView
              currentUser={currentUser}
            />
          )}

          {activeTab === 'system-logs' && (
            <LogsView
              logs={logs}
            />
          )}

          {activeTab === 'order-query' && (
            <OrderQueryView
              orders={orders}
              currentUser={currentUser}
            />
          )}
        </div>

      </main>

      {/* Persistent Footer */}
      <footer className="bg-white border-t border-slate-150 py-3 px-4 text-center text-[10px] text-slate-400 font-sans shrink-0">
        多分店订单协同管理系统 © 2026. Designed with Inter & JetBrains Mono display typography. All rights reserved.
      </footer>

      {/* Real-time Toast Notifications Container (Interactive Role-scoped Alerts) */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className={`pointer-events-auto p-4 rounded-xl shadow-xl border flex items-start gap-3 bg-white/95 backdrop-blur-sm ${
                toast.type === 'success' ? 'border-emerald-200 bg-emerald-50/95 text-emerald-900 shadow-emerald-100/50' :
                toast.type === 'warning' ? 'border-amber-200 bg-amber-50/95 text-amber-900 shadow-amber-100/50' :
                toast.type === 'error' ? 'border-rose-200 bg-rose-50/95 text-rose-900 shadow-rose-100/50' :
                'border-blue-200 bg-blue-50/95 text-blue-900 shadow-blue-105/50'
              }`}
            >
              <div className="text-base select-none shrink-0 mt-0.5">
                {toast.type === 'success' ? '⚡' :
                 toast.type === 'warning' ? '📦' :
                 toast.type === 'error' ? '⚠️' : '🔔'}
              </div>
              <div className="flex-1 text-xs font-semibold whitespace-pre-line leading-relaxed font-sans">
                {toast.text}
              </div>
              <button
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="text-slate-400 hover:text-slate-600 cursor-pointer transition-colors pointer-events-auto text-xs font-bold shrink-0 self-start select-none pl-1"
                aria-label="Close Notification"
              >
                ✕
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
}
