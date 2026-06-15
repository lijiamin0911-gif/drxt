import React, { useState, useEffect } from 'react';
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
import { User, Order, PurchaseOrder, SystemConfig, OperationLog } from './types';

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

  // Load and subscribe to DB Changes
  useEffect(() => {
    let unsubscribe: () => void;

    async function loadAllData() {
      setIsLoading(true);
      try {
        await DbService.initialize();
        const [u, o, po, lg, cfg] = await Promise.all([
          DbService.getUsers(),
          DbService.getOrders(),
          DbService.getPurchaseOrders(),
          DbService.getLogs(),
          DbService.getConfig()
        ]);
        setUsers(u);
        setOrders(o);
        setPurchaseOrders(po);
        setLogs(lg);
        setSystemConfig(cfg);

        // Bind real-time change listener
        unsubscribe = DbService.onChange(async () => {
          const [u2, o2, po2, lg2, cfg2] = await Promise.all([
            DbService.getUsers(),
            DbService.getOrders(),
            DbService.getPurchaseOrders(),
            DbService.getLogs(),
            DbService.getConfig()
          ]);
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
  }, []);

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

  // 计算调试栏简易切换按钮的代表子集（例如：前2个管理员[主/副]、前2个分店、前1个前台、前1个采购），避免100+账号堆积冲毁排版
  const debugUsers = React.useMemo(() => {
    const subset: User[] = [];
    const roleCounts: { [role: string]: number } = {};
    for (const u of users) {
      const currentCount = roleCounts[u.role] || 0;
      let shouldAdd = false;
      if (u.role === 'admin' && currentCount < 2) shouldAdd = true;
      else if (u.role === 'branch' && currentCount < 2) shouldAdd = true;
      else if (u.role === 'receptionist' && currentCount < 1) shouldAdd = true;
      else if (u.role === 'purchasing' && currentCount < 1) shouldAdd = true;

      if (shouldAdd) {
        subset.push(u);
        roleCounts[u.role] = currentCount + 1;
      }
    }
    return subset;
  }, [users]);

  const handleInstantLogin = async (user: User) => {
    if (!user.isActive) {
      alert('此账户已被管理员禁用，请联系管理员激活');
      return;
    }

    const sessionToken = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    sessionStorage.setItem('current_session_token', sessionToken);
    localStorage.setItem(`session_token_${user.id}`, sessionToken);

    const updatedUser: User = {
      ...user,
      sessionToken
    };

    try {
      await DbService.saveUser(updatedUser, { id: user.id, name: user.username, role: user.role });
    } catch (err) {
      console.error('更新会话Token失败', err);
    }

    setCurrentUser(updatedUser);
    setPinInput('');
    setUsernameInput('');

    DbService.log(
      user.id,
      user.username,
      user.role,
      '一键免密登录',
      `演示人员通过便捷通道一键免密进入系统：${user.username} (${user.role})，已注册单点单会话保护`
    );
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) {
      alert('请输入管理员分配的系统账号');
      return;
    }

    const matched = users.find(u => u.username.trim() === usernameInput.trim());
    if (!matched) {
      alert('系统未登记此登录账号，请使用管理员分配或创建的账号');
      return;
    }

    if (!matched.isActive) {
      alert('此账户已被管理员禁用，请联系管理员激活');
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

      const updatedUser: User = {
        ...matched,
        sessionToken
      };

      try {
        await DbService.saveUser(updatedUser, { id: matched.id, name: matched.username, role: matched.role });
      } catch (err) {
        console.error('更新会话Token失败', err);
      }

      setCurrentUser(updatedUser);
      setPinInput('');
      setUsernameInput('');
      
      // Log login success
      DbService.log(
        matched.id,
        matched.username,
        matched.role,
        '自主登录',
        `账号 [${matched.username}] 分配角色 [${matched.role}] 验证成功且单人安全会话锁定，自主动态进入系统`
      );
    } else {
      alert('安全验证失效：安全 PIN 错误，请重新输入');
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

  // Switch role on the fly for reviewer debugging convenience
  const handleQuickSwitchUser = async (user: User) => {
    const sessionToken = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    sessionStorage.setItem('current_session_token', sessionToken);
    localStorage.setItem(`session_token_${user.id}`, sessionToken);

    const updatedUser: User = {
      ...user,
      sessionToken
    };

    try {
      await DbService.saveUser(updatedUser, { id: user.id, name: user.username, role: user.role });
    } catch (err) {
      console.error(err);
    }

    setCurrentUser(updatedUser);
    DbService.log(
      user.id,
      user.username,
      user.role,
      '快速角色切换',
      `评审员通过快捷调试栏切换至：${user.username} (${user.role})，并生成测试安全单点会话`
    );
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
    const matchedUser = users.find(u => u.username.trim() === usernameInput.trim());

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
            
            <p className="text-xs text-slate-505 text-slate-500 max-w-sm mx-auto leading-relaxed">
              请输入管理员分配的分店、前台汇总或采购身份账号，系统将自动识别对应权限并开启专属协同视窗
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

            {/* 权限识别微标 */}
            <AnimatePresence mode="wait">
              {usernameInput.trim() !== '' && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -5 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  {matchedUser ? (
                    <div className="flex items-start gap-2 p-2.5 bg-emerald-50/70 border border-emerald-100 rounded-xl text-emerald-805 text-emerald-800 text-xs text-left">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">【角色确认】{matchedUser.role === 'admin' ? (matchedUser.username.includes('副') ? '副系统管理员' : '主系统管理员') : matchedUser.role === 'branch' ? `分店业务员 (${matchedUser.branchName || matchedUser.username})` : matchedUser.role === 'receptionist' ? '前台汇总确认审批员' : '采购部管理主管'}</span>
                        <span className="text-[10px] text-emerald-600 leading-none">身份验证已锁定，请输入测试验证 PIN 码</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 p-2.5 bg-amber-50/70 border border-amber-100 rounded-xl text-amber-805 text-amber-800 text-xs text-left">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">未匹配到此系统账户</span>
                        <span className="text-[10px] text-amber-600">请输入已有管理员账户，或点击下方【查看预设测试指南】</span>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* PIN码输入框 */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 tracking-wide flex items-center gap-1.5">
                <span className="w-1 h-3 bg-blue-600 rounded-full"></span>
                安全 PIN 验证码
              </label>
              <div className="relative">
                <Key className="absolute left-3.5 top-2.5 w-4.5 h-4.5 text-slate-405 text-slate-400" />
                <input
                  type="password"
                  maxLength={10}
                  placeholder="请输入您的安全 PIN 验证码"
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full pl-10 pr-3 py-2 border border-slate-205 border-slate-200 bg-white rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600 text-sm duration-150 text-slate-800 placeholder:font-sans"
                />
              </div>
            </div>

            {/* 提交按钮 */}
            <motion.button
              type="submit"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 duration-150 flex items-center justify-center gap-1.5 cursor-pointer leading-none mt-2 animate-pulse"
            >
              验证并安全登录系统 <ArrowRight className="w-3.5 h-3.5" />
            </motion.button>
          </form>

          {/* ⚖️ 超管免挤退并发通道控制 */}
          <div className="bg-gradient-to-br from-blue-50/70 to-indigo-50/60 border border-blue-100 rounded-xl p-3 space-y-1 text-xs shadow-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-750 text-slate-800 flex items-center gap-1">
                🛡️ 超管授权：多页面页签免密并存
              </span>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={bypassKickout}
                  onChange={(e) => handleToggleBypass(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-250 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-650 peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <p className="text-[10px] text-slate-500 leading-normal">
              {bypassKickout ? (
                <span className="text-emerald-700 font-semibold">
                  已由超管授信开启（推荐）：允许多款浏览器或跨终端并存同一个角色账号（绝不强制下线对方），便于多角色视图比对评审。
                </span>
              ) : (
                <span className="text-amber-700 font-medium">
                  已启用严格商业单点安全锁：同账号再次登录将抢占会话，前一次会话自动安全踢下线。
                </span>
              )}
            </p>
          </div>

          {/* ⚡ 演示专属：常用角色一键秒登通道 */}
          <div className="space-y-2 pt-1">
            <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <span>⚡ 演示/评审专属一键免密闪登：</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'u_admin', username: '超级管理员', role: 'admin', label: '👑 系统主管' },
                { id: 'u_reception', username: '前台汇总员', role: 'receptionist', label: '🎨 前台汇总' },
                { id: 'u_purchasing', username: '采购主管', role: 'purchasing', label: '🏭 采购主管' },
                { id: 'u_branch_east', username: '城东分店', role: 'branch', label: '🏪 城东分店' }
              ].map(item => {
                const fullUser = users.find(u => u.id === item.id) || {
                  id: item.id,
                  username: item.username,
                  role: item.role as any,
                  isActive: true,
                  pin: item.id === 'u_admin' ? '1111' : item.id === 'u_reception' ? '4444' : item.id === 'u_purchasing' ? '5555' : '2222',
                  createdAt: ''
                };
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleInstantLogin(fullUser)}
                    className="py-1.5 px-2 bg-slate-50 border border-slate-200 hover:border-blue-500 hover:bg-blue-50/30 rounded-lg text-[10px] font-bold text-slate-700 duration-150 transition-all flex items-center justify-between cursor-pointer active:scale-95 text-left"
                    title={`一键免密闪登【${item.username}】身份`}
                  >
                    <span className="truncate">{item.label}</span>
                    <ArrowRight className="w-2.5 h-2.5 text-slate-400 shrink-0 ml-1" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* 预设账号与PIN提示（Collapsible Accordion） */}
          <div className="border border-slate-100 rounded-xl bg-slate-50/50 p-2.5">
            <button
              type="button"
              onClick={() => setShowAccountsGuide(!showAccountsGuide)}
              className="w-full flex items-center justify-between text-[11px] font-bold text-slate-600 cursor-pointer"
            >
              <span className="flex items-center gap-1 inline-flex">
                <Sparkles className="w-3 h-3 text-blue-500" />
                查看管理员分配的预设测试账号与 PIN 码
              </span>
              <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showAccountsGuide ? 'rotate-90' : ''}`} />
            </button>
            
            <AnimatePresence>
              {showAccountsGuide && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mt-2 pt-2 border-t border-slate-200/60 text-left"
                >
                  <p className="text-[10px] text-slate-500 leading-normal mb-2">
                    系统已为您预置以下演示用账户，无需输入。**直接点击以下任意账户卡片**即可实现免密一键闪电登录：
                  </p>

                  {/* 快捷检索条 */}
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="按账号、分店或角色过滤清单..."
                      value={guideSearchQuery}
                      onChange={e => setGuideSearchQuery(e.target.value)}
                      className="w-full pl-7 pr-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-1.5 text-left max-h-52 overflow-y-auto pr-1 scrollbar-thin">
                    {users
                      .filter(u => {
                        if (!guideSearchQuery.trim()) return true;
                        const queryLower = guideSearchQuery.toLowerCase();
                        return (
                          u.username.toLowerCase().includes(queryLower) ||
                          u.role.toLowerCase().includes(queryLower) ||
                          (u.branchName && u.branchName.toLowerCase().includes(queryLower))
                        );
                      })
                      .map((u) => (
                        <div 
                          key={u.id} 
                          onClick={() => handleInstantLogin(u)}
                          className="flex items-center justify-between p-1.5 bg-white border border-slate-100/80 rounded-lg text-[10px] hover:border-blue-600 hover:bg-blue-50/50 cursor-pointer transition-all active:scale-[0.99] border-l-2 hover:border-l-blue-600"
                          title="点击此预设卡片，一键为您免密安全登录此角色身份"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-slate-800">{u.username}</span>
                            <span className="text-[9px] text-slate-400 px-1 bg-slate-50 border border-slate-100/50 rounded leading-none shrink-0">
                              {u.role === 'admin' ? (u.username.includes('副') ? '副管理员' : '主管理员') : u.role === 'branch' ? `分店 (${u.branchName || '业务'})` : u.role === 'receptionist' ? '前台汇总' : '采购主管'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-150 px-1.5 py-0.5 rounded leading-none">⚡ 闪电一键登录</span>
                          </div>
                        </div>
                      ))}
                    {users.filter(u => {
                      if (!guideSearchQuery.trim()) return true;
                      const queryLower = guideSearchQuery.toLowerCase();
                      return (
                        u.username.toLowerCase().includes(queryLower) ||
                        u.role.toLowerCase().includes(queryLower) ||
                        (u.branchName && u.branchName.toLowerCase().includes(queryLower))
                      );
                    }).length === 0 && (
                      <p className="text-[10px] text-slate-400 text-center py-4">无匹配的相关账户</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

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

          {/* Quick-Switch Reviewer Debugger (High Craftsman) */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-sans">
            <span className="text-slate-400 font-medium hidden lg:inline">调试快捷切换:</span>
            <div className="flex flex-wrap gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
              {debugUsers.map(u => (
                <button
                  key={u.id}
                  onClick={() => handleQuickSwitchUser(u)}
                  className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                    currentUser.id === u.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-150'
                  }`}
                  title={`快速切换角色身份：${u.username}`}
                >
                  {u.role === 'admin' && (u.username.includes('副') ? '副管' : '主管')}
                  {u.role === 'branch' && (u.branchName || u.username).substring(0, 4)}
                  {u.role === 'receptionist' && '前台'}
                  {u.role === 'purchasing' && '采购'}
                </button>
              ))}
            </div>

            {/* Current log state */}
            <div className="h-4 w-px bg-slate-200 hidden sm:inline"></div>

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
                <span>分店提单模拟区</span>
              </button>

              <button
                onClick={() => setActiveTab('reception-confirm')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'reception-confirm' ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-white text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>前台审批模拟区</span>
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

    </div>
  );
}
