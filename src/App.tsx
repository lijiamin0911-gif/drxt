/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ShieldCheck, ShieldAlert, LogOut, Users, Key, Landmark, LayoutDashboard,
  CalendarDays, Settings, FolderKanban, RotateCcw, TrendingUp,
  ShoppingBag, ClipboardList, Layers, Truck, Database, Activity, Sparkles, RefreshCw,
  Award, Briefcase, Home, FileText, Coins
} from 'lucide-react';

import { User, Transaction, InventoryItem, SummaryDimension, Order, PurchaseOrder, SystemConfig, Product } from './types';
import { 
  DEFAULT_USERS, DEFAULT_REGION_STORE_MAP, DEFAULT_TRANSACTIONS, DEFAULT_INVENTORY 
} from './mockData';

// Modular Components
import { ToastContainer, ToastMessage } from './components/Toast';
import { 
  LoginModal, UserManagementModal, ChangePwdModal, RegionMappingModal 
} from './components/Modals';
import { OverviewTab } from './components/OverviewTab';
import { MonthlyReportTab } from './components/MonthlyReportTab';
import { WholesaleTab } from './components/WholesaleTab';
import { InventoryTab } from './components/InventoryTab';
import SalesAnalysisView from './components/SalesAnalysisView';

// ERP Core Live Components
import DashboardView from './components/DashboardView';
import BranchOrderView from './components/BranchOrderView';
import PurchasingView from './components/PurchasingView';
import ReceptionConfirmView from './components/ReceptionConfirmView';
import ReplenishmentMgmtView from './components/ReplenishmentMgmtView';
import UserManagementView from './components/UserManagementView';
import PriceManagementView from './components/PriceManagementView';
import { DbService } from './lib/dbService';

export default function App() {
  // ==========================================
  // Core Business State
  // ==========================================
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [regionStoreMap, setRegionStoreMap] = useState<Record<string, string[]>>({});

  // UI Navigation / Overlay States
  const [systemMode, setSystemMode] = useState<'BI' | 'ERP'>('BI');
  const [activeTab, setActiveTab] = useState<
    'overview' | 'monthly' | 'headWholesale' | 'inventory' | 'bossDashboard' |
    'erpDashboard' | 'erpBranchOrder' | 'erpPurchase' | 'erpReception' | 'erpReplenish' | 'erpPriceManagement' | 'erpUsersSuppliers'
  >('overview');
  const [erpOrders, setErpOrders] = useState<Order[]>([]);
  const [erpPurchaseOrders, setErpPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [erpSystemConfig, setErpSystemConfig] = useState<SystemConfig | null>(null);
  const [erpUsers, setErpUsers] = useState<User[]>([]);
  const [erpProducts, setErpProducts] = useState<Product[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isUserMgmtOpen, setIsUserMgmtOpen] = useState(false);
  const [isChangePwdOpen, setIsChangePwdOpen] = useState(false);
  const [isRegionMapOpen, setIsRegionMapOpen] = useState(false);

  // Global Filter States
  const [globalRegion, setGlobalRegion] = useState('all');
  const [globalStore, setGlobalStore] = useState('all');
  const [globalCategory, setGlobalCategory] = useState('all');
  const [globalYear, setGlobalYear] = useState('all');

  // Applied values for filtered rendering
  const [appliedRegion, setAppliedRegion] = useState('all');
  const [appliedStore, setAppliedStore] = useState('all');
  const [appliedCategory, setAppliedCategory] = useState('all');
  const [appliedYear, setAppliedYear] = useState('all');

  // ==========================================
  // Toast Helper System
  // ==========================================
  const addToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToasts(prev => {
      if (prev.some(t => t.text === text)) {
        return prev;
      }
      const id = Date.now().toString() + Math.random().toString();
      setTimeout(() => {
        removeToast(id);
      }, 4000);
      return [...prev, { id, text, type }];
    });
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // ==========================================
  // Local Database Hydration
  // ==========================================
  useEffect(() => {
    // 1. Load Mapping
    const savedMap = localStorage.getItem('salesRegionStoreMap');
    if (savedMap) {
      try {
        const parsed = JSON.parse(savedMap);
        if (parsed && typeof parsed === 'object' && !parsed['总部']) {
          parsed['总部'] = ['总部总仓'];
          localStorage.setItem('salesRegionStoreMap', JSON.stringify(parsed));
          setRegionStoreMap(parsed);
        } else {
          setRegionStoreMap(parsed);
        }
      } catch (e) {
        setRegionStoreMap(DEFAULT_REGION_STORE_MAP);
      }
    } else {
      localStorage.setItem('salesRegionStoreMap', JSON.stringify(DEFAULT_REGION_STORE_MAP));
      setRegionStoreMap(DEFAULT_REGION_STORE_MAP);
    }

    // 2. Load Transactions
    const savedTx = localStorage.getItem('salesTransactions');
    if (savedTx) {
      setTransactions(JSON.parse(savedTx));
    } else {
      localStorage.setItem('salesTransactions', JSON.stringify(DEFAULT_TRANSACTIONS));
      setTransactions(DEFAULT_TRANSACTIONS);
    }

    // 3. Load Stocks
    const savedInv = localStorage.getItem('salesInventory');
    if (savedInv) {
      try {
        const parsed = JSON.parse(savedInv);
        if (Array.isArray(parsed) && !parsed.some(item => item.store === '总部总仓')) {
          const combined = [...DEFAULT_INVENTORY.filter(i => i.store === '总部总仓'), ...parsed];
          localStorage.setItem('salesInventory', JSON.stringify(combined));
          setInventory(combined);
        } else {
          setInventory(parsed);
        }
      } catch (e) {
        setInventory(DEFAULT_INVENTORY);
      }
    } else {
      localStorage.setItem('salesInventory', JSON.stringify(DEFAULT_INVENTORY));
      setInventory(DEFAULT_INVENTORY);
    }

    // 4. Load User Account Registry
    const savedUsers = localStorage.getItem('salesUsers');
    if (savedUsers) {
      setUsers(JSON.parse(savedUsers));
    } else {
      localStorage.setItem('salesUsers', JSON.stringify(DEFAULT_USERS));
      setUsers(DEFAULT_USERS);
    }

    // 5. Hydrate login session
    const activeSession = sessionStorage.getItem('salesCurrentUser');
    if (activeSession) {
      setCurrentUser(JSON.parse(activeSession));
    } else {
      setIsLoginOpen(true);
    }
  }, []);

  // Redirect non-bosses if they land on the boss dashboard
  useEffect(() => {
    if (currentUser && currentUser.role !== 'boss' && activeTab === 'bossDashboard') {
      setActiveTab('overview');
    }
  }, [currentUser, activeTab]);

  // ERP State Synchronizer & DbService subscription
  const loadErpStates = useCallback(async () => {
    try {
      const [ord, po, cfg, usr, prods] = await Promise.all([
        DbService.getOrders(),
        DbService.getPurchaseOrders(),
        DbService.getConfig(),
        DbService.getUsers(),
        DbService.getProducts()
      ]);
      setErpOrders(ord);
      setErpPurchaseOrders(po);
      setErpSystemConfig(cfg);
      setErpUsers(usr);
      setErpProducts(prods);
    } catch (e) {
      console.error("Error loading ERP states:", e);
    }
  }, []);

  useEffect(() => {
    // Initialize DbService database and subcollections
    DbService.initialize().then(() => {
      loadErpStates();
    });

    // Subscribe to live listener hooks
    const unsubscribe = DbService.onChange(() => {
      loadErpStates();
    });

    return () => {
      unsubscribe();
    };
  }, [loadErpStates]);

  // Handle user login and routing options with strict role-based separation
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'boss') {
        // Boss is restricted strictly to BI dashboards only, no ERP system access
        if (systemMode !== 'BI') {
          setSystemMode('BI');
        }
        if (activeTab.startsWith('erp')) {
          setActiveTab('bossDashboard');
        }
      } else if (currentUser.role === 'branch') {
        // Branch manager is restricted strictly to their own Order Entry workspace
        if (systemMode !== 'ERP') {
          setSystemMode('ERP');
        }
        if (activeTab !== 'erpBranchOrder') {
          setActiveTab('erpBranchOrder');
        }
      } else if (currentUser.role === 'receptionist') {
        // Warehouse receptionist is restricted strictly to delivery receptions checks
        if (systemMode !== 'ERP') {
          setSystemMode('ERP');
        }
        if (activeTab !== 'erpReception') {
          setActiveTab('erpReception');
        }
      } else if (currentUser.role === 'purchasing') {
        // Purchasing is restricted strictly to purchasing and replenishment tabs
        if (systemMode !== 'ERP') {
          setSystemMode('ERP');
        }
        if (activeTab !== 'erpPurchase' && activeTab !== 'erpReplenish') {
          setActiveTab('erpPurchase');
        }
      } else if (currentUser.role === 'data_admin') {
        // Data administrator (行政后台) can access financial Price Management and BI dashboards to submit/manage data!
        if (systemMode === 'BI' && activeTab.startsWith('erp')) {
          setActiveTab('overview');
        } else if (systemMode === 'ERP' && !activeTab.startsWith('erp')) {
          setActiveTab('erpPriceManagement');
        }
      } else {
        // Admins and Region managers are allowed to toggle between both modes, guard standard mode-tab boundaries
        if (systemMode === 'BI' && activeTab.startsWith('erp')) {
          setActiveTab('overview');
        } else if (systemMode === 'ERP' && !activeTab.startsWith('erp')) {
          if (currentUser.role === 'region_manager') {
            setActiveTab('erpBranchOrder');
          } else {
            setActiveTab('erpDashboard');
          }
        }
      }
    }
  }, [currentUser, systemMode, activeTab]);

  // Mode boundaries guard (reinforcement)
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'boss' && systemMode !== 'BI') {
        setSystemMode('BI');
        setActiveTab('bossDashboard');
      } else {
        const isErpSpecific = currentUser.role === 'branch' || currentUser.role === 'receptionist' || currentUser.role === 'purchasing';
        if (isErpSpecific && systemMode !== 'ERP') {
          setSystemMode('ERP');
          if (currentUser.role === 'branch') setActiveTab('erpBranchOrder');
          if (currentUser.role === 'receptionist') setActiveTab('erpReception');
          if (currentUser.role === 'purchasing') setActiveTab('erpPurchase');
        }
      }
    }
  }, [systemMode, currentUser]);

  // Sync state mutation helper back to physical storage and local state
  const syncUsersList = (newUsersList: User[]) => {
    localStorage.setItem('salesUsers', JSON.stringify(newUsersList));
    setUsers(newUsersList);
  };

  const syncInventoryList = (newInvList: InventoryItem[]) => {
    localStorage.setItem('salesInventory', JSON.stringify(newInvList));
    setInventory(newInvList);
  };

  const syncTransactionsList = (newTxList: Transaction[]) => {
    localStorage.setItem('salesTransactions', JSON.stringify(newTxList));
    setTransactions(newTxList);
  };

  const syncRegionStoreMap = (newMap: Record<string, string[]>) => {
    localStorage.setItem('salesRegionStoreMap', JSON.stringify(newMap));
    setRegionStoreMap(newMap);
  };

  // ==========================================
  // Manager Restrictions & Dynamic Guards
  // ==========================================
  const isRegionManager = currentUser?.role === 'region_manager';
  const designatedRegion = currentUser?.region || '';

  // Get stores allowed under the current user's role limits
  const storesInCurrentRegion = useMemo(() => {
    if (isRegionManager) {
      return regionStoreMap[designatedRegion] || [];
    }
    // Admin or Boss can see all stored stores in database mapping
    return Object.values(regionStoreMap).flat();
  }, [isRegionManager, designatedRegion, regionStoreMap]);

  // Restrict region filter dropdown list based on current user
  const regionDropdownList = useMemo(() => {
    if (isRegionManager) {
      return [designatedRegion];
    }
    return Object.keys(regionStoreMap).filter(Boolean).sort();
  }, [isRegionManager, designatedRegion, regionStoreMap]);

  // Restrict stores lists in dropdown lists based on dynamic region chosen
  const storeDropdownList = useMemo(() => {
    const parentRegion = isRegionManager ? designatedRegion : globalRegion;
    if (parentRegion === 'all') {
      return storesInCurrentRegion;
    }
    const regionStores = regionStoreMap[parentRegion] || [];
    return regionStores.filter(s => storesInCurrentRegion.includes(s));
  }, [isRegionManager, designatedRegion, globalRegion, regionStoreMap, storesInCurrentRegion]);

  // Sync locked filters for regional manager automatically
  useEffect(() => {
    if (isRegionManager && designatedRegion) {
      setGlobalRegion(designatedRegion);
      setAppliedRegion(designatedRegion);
    }
  }, [isRegionManager, designatedRegion]);

  // Unique categories helper
  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(transactions.map(t => t.category).filter(Boolean))).sort();
  }, [transactions]);

  // Unique years helper
  const uniqueYears = useMemo(() => {
    return Array.from(new Set(transactions.map(t => t.date.slice(0, 4)).filter(Boolean))).sort();
  }, [transactions]);

  // ==========================================
  // Actions
  // ==========================================
  const handleLogin = async (userIn: string, passIn: string): Promise<boolean> => {
    const cleanUserIn = userIn.trim();
    const cleanPassIn = passIn.trim();

    // Helper to match user credentials safely
    const findInList = (list: User[]) => {
      return list.find(u => {
        const uName = (u.username || '').trim();
        const uPin = (u.pin || '').trim();
        const uPass = (u.password || '').trim();
        return uName === cleanUserIn && (uPin === cleanPassIn || uPass === cleanPassIn);
      });
    };

    let matched: User | undefined = undefined;

    // 1. FAST PATH (Instant): Check cached/in-memory states first to bypass network latency entirely
    if (erpUsers && erpUsers.length > 0) {
      matched = findInList(erpUsers);
    }
    if (!matched && users && users.length > 0) {
      matched = findInList(users);
    }
    if (!matched) {
      matched = findInList(DEFAULT_USERS);
    }

    // 2. Fallback FAST PATH: Read raw localStorage fallback
    if (!matched) {
      try {
        const rawDbUsers = localStorage.getItem('db_users');
        if (rawDbUsers) {
          const parsed: User[] = JSON.parse(rawDbUsers);
          if (Array.isArray(parsed)) {
            matched = findInList(parsed);
          }
        }
      } catch (e) {
        console.error("Error reading fallback db_users:", e);
      }
    }

    // 3. SLOW PATH: Only query server dynamically if credentials are not matched in local cache
    if (!matched) {
      try {
        const freshErpUsers = await DbService.getUsers();
        if (freshErpUsers && freshErpUsers.length > 0) {
          setErpUsers(freshErpUsers);
          matched = findInList(freshErpUsers);
        }
      } catch (e) {
        console.warn("Dynamic user retrieval failed, falling back to offline defaults:", e);
      }
    }

    if (matched) {
      setCurrentUser(matched);
      sessionStorage.setItem('salesCurrentUser', JSON.stringify(matched));
      setIsLoginOpen(false);
      
      let roleLabel = '成员';
      if (matched.role === 'admin') {
        roleLabel = matched.isViceAdmin ? '副系统管理员' : '系统最高管理员';
      } else if (matched.role === 'boss') {
        roleLabel = '老板/决策者';
      } else if (matched.role === 'region_manager') {
        roleLabel = `区域经理 (${matched.region || '大区'})`;
      } else if (matched.role === 'purchasing') {
        roleLabel = '采购';
      } else if (matched.role === 'receptionist') {
        roleLabel = '前台库管/验收员';
      } else if (matched.role === 'branch') {
        roleLabel = `分店店长 (${matched.branchName || '分舵'})`;
      }

      addToast(`🎉 欢迎登录系统，当前权限：${roleLabel}`, 'success');
      return true;
    }

    // 4. Hardcoded Fallback: check defaults directly in case state is syncing slowly
    const fallbackMatched = DEFAULT_USERS.find(u => u.username === userIn && u.password === passIn);
    if (fallbackMatched) {
      setCurrentUser(fallbackMatched);
      sessionStorage.setItem('salesCurrentUser', JSON.stringify(fallbackMatched));
      const freshList = [...users];
      if (!freshList.some(x => x.username === 'admin')) {
        freshList.push(fallbackMatched);
        syncUsersList(freshList);
      }
      setIsLoginOpen(false);
      addToast(`🎉 管理员成功恢复默认登录！`, 'success');
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    sessionStorage.removeItem('salesCurrentUser');
    setCurrentUser(null);
    setIsLoginOpen(true);
    addToast('🔒 安全登出系统，本地缓存保留', 'info');
  };

  const handleQueryApply = () => {
    setAppliedRegion(globalRegion);
    setAppliedStore(globalStore);
    setAppliedCategory(globalCategory);
    setAppliedYear(globalYear);
    addToast('⚡ 全局筛选已更新！经营总览大屏图表已重构刷新。', 'info');
  };

  // ==========================================
  // Render Filters Base
  // ==========================================
  // Dynamically map and associate transactions with costPrice and sellingPrice from erpProducts
  const mappedTransactions = useMemo(() => {
    return transactions.map(t => {
      // Find corresponding product by matching code or name
      const matchedProd = erpProducts.find(p => p.productCode === t.code || p.productName === t.name);
      if (matchedProd) {
        // Use prices maintained by the data administrator
        const sellingPrice = matchedProd.sellingPrice !== undefined ? matchedProd.sellingPrice : t.price;
        const costPrice = matchedProd.costPrice !== undefined ? matchedProd.costPrice : (sellingPrice * 0.7); // default 30% margin fallback if cost unset
        
        const newAmount = t.qty * sellingPrice;
        const newProfit = t.qty * (sellingPrice - costPrice);
        
        return {
          ...t,
          price: sellingPrice,
          amount: newAmount,
          profit: newProfit
        };
      }
      return t;
    });
  }, [transactions, erpProducts]);

  // Filter core retail records for Overview Tab
  const filteredRetailOnlyOverview = useMemo(() => {
    return mappedTransactions.filter(t => {
      if (t.sale_type !== 'store_to_customer') return false;
      
      // Region Lock Check
      const rowRegion = Object.keys(regionStoreMap).find(reg => regionStoreMap[reg].includes(t.store)) || '';
      if (isRegionManager && rowRegion !== designatedRegion) return false;

      // Applied values checks
      if (appliedRegion !== 'all' && rowRegion !== appliedRegion) return false;
      if (appliedStore !== 'all' && t.store !== appliedStore) return false;
      if (appliedCategory !== 'all' && t.category !== appliedCategory) return false;
      if (appliedYear !== 'all' && t.date.slice(0, 4) !== appliedYear) return false;

      return true;
    });
  }, [mappedTransactions, appliedRegion, appliedStore, appliedCategory, appliedYear, isRegionManager, designatedRegion, regionStoreMap]);

  // Filter core stock list for Overview tab KPIs
  const filteredInventoryOverview = useMemo(() => {
    return inventory.filter(item => {
      // Permission restrict
      if (!storesInCurrentRegion.includes(item.store)) return false;

      // Filter matches
      const itemRegion = Object.keys(regionStoreMap).find(reg => regionStoreMap[reg].includes(item.store)) || '';
      if (appliedRegion !== 'all' && itemRegion !== appliedRegion) return false;
      if (appliedStore !== 'all' && item.store !== appliedStore) return false;
      if (appliedCategory !== 'all' && item.category !== appliedCategory) return false;

      return true;
    });
  }, [inventory, appliedRegion, appliedStore, appliedCategory, storesInCurrentRegion, regionStoreMap]);

  // Selected filters subtitle string description
  const kpiFilterDescriptorText = useMemo(() => {
    const parts: string[] = [];
    if (appliedRegion !== 'all') parts.push(appliedRegion);
    if (appliedStore !== 'all') parts.push(appliedStore);
    if (appliedCategory !== 'all') parts.push(appliedCategory);
    if (appliedYear !== 'all') parts.push(`${appliedYear}年`);
    return parts.length > 0 ? parts.join(' ｜ ') : '管辖全国大区';
  }, [appliedRegion, appliedStore, appliedCategory, appliedYear]);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-700 font-sans antialiased overflow-hidden">
      {/* Sidebar Layout */}
      {currentUser && (
        <>
          {/* Backdrop on Mobile */}
          {isSidebarOpen && (
            <div 
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden" 
              onClick={() => setIsSidebarOpen(false)} 
            />
          )}

          <aside 
            className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#2563eb] text-white flex flex-col shadow-xl transition-transform duration-300 transform md:relative md:translate-x-0 ${
              isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
            }`}
          >
            {/* Logo Brand Header */}
            <div className="p-6 text-lg font-bold border-b border-blue-800/60 flex items-center gap-2.5 flex-shrink-0">
              <div className="w-8 h-8 bg-white/10 text-white rounded-lg flex items-center justify-center font-bold text-base shadow-sm">
                管
              </div>
              <div className="min-w-0">
                <span className="block font-bold text-sm leading-tight">订单协同管理平台</span>
                <span className="block text-[9px] text-blue-200/70 font-semibold uppercase tracking-wider">Business Analytics Studio</span>
              </div>
            </div>

            {/* Sidebar Navigation */}
            <nav className="flex-1 py-4 overflow-y-auto space-y-1">
              {/* Optional Portal Switcher: Non-boss admins, region managers & data admins (行政后台) */}
              {(currentUser?.role === 'admin' || currentUser?.role === 'region_manager' || currentUser?.role === 'data_admin') && (
                <div className="px-4 pb-4">
                  <div className="bg-black/20 p-1 rounded-xl flex items-center justify-between gap-1 border border-white/5">
                    <button
                      onClick={() => {
                        setSystemMode('BI');
                        setActiveTab('overview');
                        setIsSidebarOpen(false);
                      }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer select-none ${
                        systemMode === 'BI'
                          ? 'bg-white/15 text-white shadow-sm'
                          : 'text-blue-200/60 hover:text-blue-100'
                      }`}
                    >
                      <Activity className="w-3.5 h-3.5" />
                      BI 智能大屏
                    </button>
                    <button
                      onClick={() => {
                        setSystemMode('ERP');
                        if (currentUser.role === 'region_manager') {
                          setActiveTab('erpBranchOrder');
                        } else if (currentUser.role === 'data_admin') {
                          setActiveTab('erpPriceManagement');
                        } else {
                          setActiveTab('erpDashboard');
                        }
                        setIsSidebarOpen(false);
                      }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer select-none ${
                        systemMode === 'ERP'
                          ? 'bg-emerald-500 text-white shadow-md'
                          : 'text-blue-200/60 hover:text-blue-100'
                      }`}
                    >
                      <Database className="w-3.5 h-3.5" />
                      ERP 协同
                    </button>
                  </div>
                </div>
              )}

              {systemMode === 'BI' ? (
                <>
                  <div className="px-6 py-1.5 text-xs font-bold text-blue-200/50 uppercase tracking-widest">
                    数据分析驾驶舱
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('overview');
                      setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center px-6 py-3 transition-all text-left font-semibold text-xs sm:text-sm border-l-4 cursor-pointer ${
                      activeTab === 'overview'
                        ? 'bg-white/10 border-white text-white font-bold'
                        : 'bg-transparent border-transparent text-blue-100 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4 mr-3" />
                    经营总览大屏
                  </button>

                  <div className="px-6 py-1.5 pt-4 text-xs font-bold text-blue-200/50 uppercase tracking-widest">
                    决策与报表
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('monthly');
                      setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center px-6 py-3 transition-all text-left font-semibold text-xs sm:text-sm border-l-4 cursor-pointer ${
                      activeTab === 'monthly'
                        ? 'bg-white/10 border-white text-white font-bold'
                        : 'bg-transparent border-transparent text-blue-100 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <CalendarDays className="w-4 h-4 mr-3" />
                    分店零售月报 (店→客)
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('headWholesale');
                      setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center px-6 py-3 transition-all text-left font-semibold text-xs sm:text-sm border-l-4 cursor-pointer ${
                      activeTab === 'headWholesale'
                        ? 'bg-white/10 border-white text-white font-bold'
                        : 'bg-transparent border-transparent text-blue-100 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Landmark className="w-4 h-4 mr-3" />
                    总部批发决策 (总部→店)
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('inventory');
                      setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center px-6 py-3 transition-all text-left font-semibold text-xs sm:text-sm border-l-4 cursor-pointer ${
                      activeTab === 'inventory'
                        ? 'bg-white/10 border-white text-white font-bold'
                        : 'bg-transparent border-transparent text-blue-100 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <FolderKanban className="w-4 h-4 mr-3" />
                    账面库存明细
                  </button>

                  {(currentUser?.role === 'boss' || currentUser?.role === 'admin' || currentUser?.role === 'data_admin') && (
                    <>
                      <div className="px-6 py-1.5 pt-4 text-xs font-bold text-amber-200/50 uppercase tracking-widest">
                        老板与后台数据管理
                      </div>
                      <button
                        onClick={() => {
                          setActiveTab('bossDashboard');
                          setIsSidebarOpen(false);
                        }}
                        className={`w-full flex items-center px-6 py-3 transition-all text-left font-semibold text-xs sm:text-sm border-l-4 cursor-pointer ${
                          activeTab === 'bossDashboard'
                            ? 'bg-amber-500/10 border-amber-400 text-amber-300 font-bold'
                            : 'bg-transparent border-transparent text-amber-100/70 hover:bg-amber-500/5 hover:text-amber-200'
                        }`}
                      >
                        <TrendingUp className="w-4 h-4 mr-3 text-amber-400" />
                        经营分析与数据大屏
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="px-6 py-1.5 text-xs font-bold text-emerald-200/50 uppercase tracking-widest">
                    协同物资订货 ERP
                  </div>

                  {currentUser?.role === 'admin' && (
                    <button
                      onClick={() => {
                        setActiveTab('erpDashboard');
                        setIsSidebarOpen(false);
                      }}
                      className={`w-full flex items-center px-6 py-3 transition-all text-left font-semibold text-xs sm:text-sm border-l-4 cursor-pointer ${
                        activeTab === 'erpDashboard'
                          ? 'bg-emerald-500/15 border-emerald-400 text-emerald-100 font-bold'
                          : 'bg-transparent border-transparent text-emerald-200/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Activity className="w-4 h-4 mr-3 text-emerald-400" />
                      订货决策总览
                    </button>
                  )}

                  {(currentUser?.role === 'admin' || currentUser?.role === 'region_manager' || currentUser?.role === 'branch') && (
                    <button
                      onClick={() => {
                        setActiveTab('erpBranchOrder');
                        setIsSidebarOpen(false);
                      }}
                      className={`w-full flex items-center px-6 py-3 transition-all text-left font-semibold text-xs sm:text-sm border-l-4 cursor-pointer ${
                        activeTab === 'erpBranchOrder'
                          ? 'bg-emerald-500/15 border-emerald-400 text-emerald-100 font-bold'
                          : 'bg-transparent border-transparent text-emerald-200/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <ShoppingBag className="w-4 h-4 mr-3 text-emerald-400" />
                      分店订货申报
                    </button>
                  )}

                  {(currentUser?.role === 'admin' || currentUser?.role === 'purchasing') && (
                    <button
                      onClick={() => {
                        setActiveTab('erpPurchase');
                        setIsSidebarOpen(false);
                      }}
                      className={`w-full flex items-center px-6 py-3 transition-all text-left font-semibold text-xs sm:text-sm border-l-4 cursor-pointer ${
                        activeTab === 'erpPurchase'
                          ? 'bg-emerald-500/15 border-emerald-400 text-emerald-100 font-bold'
                          : 'bg-transparent border-transparent text-emerald-200/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <ClipboardList className="w-4 h-4 mr-3 text-emerald-400" />
                      采购下单管理
                    </button>
                  )}

                  {(currentUser?.role === 'admin' || currentUser?.role === 'receptionist') && (
                    <button
                      onClick={() => {
                        setActiveTab('erpReception');
                        setIsSidebarOpen(false);
                      }}
                      className={`w-full flex items-center px-6 py-3 transition-all text-left font-semibold text-xs sm:text-sm border-l-4 cursor-pointer ${
                        activeTab === 'erpReception'
                          ? 'bg-emerald-500/15 border-emerald-400 text-emerald-100 font-bold'
                          : 'bg-transparent border-transparent text-emerald-200/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Truck className="w-4 h-4 mr-3 text-emerald-400" />
                      到货入库验收
                    </button>
                  )}

                  {(currentUser?.role === 'admin' || currentUser?.role === 'purchasing') && (
                    <button
                      onClick={() => {
                        setActiveTab('erpReplenish');
                        setIsSidebarOpen(false);
                      }}
                      className={`w-full flex items-center px-6 py-3 transition-all text-left font-semibold text-xs sm:text-sm border-l-4 cursor-pointer ${
                        activeTab === 'erpReplenish'
                          ? 'bg-emerald-500/15 border-emerald-400 text-emerald-100 font-bold'
                          : 'bg-transparent border-transparent text-emerald-200/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <RefreshCw className="w-4 h-4 mr-3 text-emerald-400" />
                      物资补货监控
                    </button>
                  )}

                  {(currentUser?.role === 'admin' || currentUser?.role === 'data_admin') && (
                    <button
                      onClick={() => {
                        setActiveTab('erpPriceManagement');
                        setIsSidebarOpen(false);
                      }}
                      className={`w-full flex items-center px-6 py-3 transition-all text-left font-semibold text-xs sm:text-sm border-l-4 cursor-pointer ${
                        activeTab === 'erpPriceManagement'
                          ? 'bg-emerald-500/15 border-emerald-400 text-emerald-100 font-bold'
                          : 'bg-transparent border-transparent text-emerald-200/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Coins className="w-4 h-4 mr-3 text-emerald-400" />
                      价格与财务数据维护
                    </button>
                  )}

                  {currentUser?.role === 'admin' && (
                    <button
                      onClick={() => {
                        setActiveTab('erpUsersSuppliers');
                        setIsSidebarOpen(false);
                      }}
                      className={`w-full flex items-center px-6 py-3 transition-all text-left font-semibold text-xs sm:text-sm border-l-4 cursor-pointer ${
                        activeTab === 'erpUsersSuppliers'
                          ? 'bg-emerald-500/15 border-emerald-400 text-emerald-100 font-bold'
                          : 'bg-transparent border-transparent text-emerald-200/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Users className="w-4 h-4 mr-3 text-emerald-400" />
                      账号与供货管理
                    </button>
                  )}
                </>
              )}
            </nav>

            {/* Profile Block inside Sidebar */}
            <div className="p-4 border-t border-blue-800/60 flex-shrink-0">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center font-bold text-white text-xs shadow-inner">
                  {currentUser.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate">{currentUser.username}</div>
                  <div className="text-[10px] text-blue-200/70 font-semibold truncate mt-0.5">
                    {currentUser.role === 'admin' 
                      ? (currentUser.isViceAdmin ? '副系统管理员' : '系统管理员') 
                      : currentUser.role === 'boss' 
                        ? '决策审阅人 (老板)' 
                        : currentUser.role === 'region_manager'
                          ? `区域经理 (${currentUser.region || '全区'})`
                          : currentUser.role === 'purchasing'
                            ? '采购'
                            : currentUser.role === 'receptionist'
                              ? '前台验收员'
                              : currentUser.role === 'branch'
                                ? `${currentUser.branchName || '分店店长'}`
                                : '系统成员'}
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* Right Side Main Layout */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Top Header */}
        {currentUser ? (
          <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-6 shadow-sm flex-shrink-0 z-30">
            <div className="flex items-center gap-3">
              {/* Hamburger Button on mobile */}
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg md:hidden cursor-pointer"
              >
                <span className="sr-only">Open menu</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-bold text-slate-800 leading-tight">
                  {activeTab === 'overview' && '经营总览大屏 (数字驾驶舱)'}
                  {activeTab === 'monthly' && '分店零售分析 (零售月报模型)'}
                  {activeTab === 'headWholesale' && '总部批发决策 (供销供货大屏)'}
                  {activeTab === 'inventory' && '账面库存监管 (库存实物明细)'}
                  {activeTab === 'bossDashboard' && '老板专属经营分析大屏 (同期同比决策大屏)'}
                  {activeTab === 'erpDashboard' && '订货排产决策大屏 (ERP 决策中枢)'}
                  {activeTab === 'erpBranchOrder' && '分店订货申报单提交与溯源 (协同订货)'}
                  {activeTab === 'erpPurchase' && '供货采购分配与合同管理 (ERP 采购单)'}
                  {activeTab === 'erpReception' && '到货验收与实物入库校对 (前台库管)'}
                  {activeTab === 'erpReplenish' && '缺货调剂及自主补货大屏幕 (补货大屏)'}
                  {activeTab === 'erpUsersSuppliers' && '供应链往来单位与协同职位授权 (ERP 配置)'}
                </h2>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5 hidden sm:block">
                  {activeTab === 'overview' && 'RTL & EXCEL DYNAMIC DATA INTEGRATED VIEW'}
                  {activeTab === 'monthly' && 'RETAIL CROSS-TAB MONTHLY PROFITABILITY REPORT'}
                  {activeTab === 'headWholesale' && 'WHOLESALE SHIPMENT STRATEGY CONTROL BOARD'}
                  {activeTab === 'inventory' && 'BOOK VALUE QUANTITY MANAGEMENT'}
                  {activeTab === 'bossDashboard' && 'BOSS STRATEGIC DECISION-MAKING & OUTLOOK ANALYSIS'}
                  {activeTab === 'erpDashboard' && 'ERP SUPPLY CHAIN INTEGRATION MONITOR'}
                  {activeTab === 'erpBranchOrder' && 'BRANCH REQUEST REPORTING & LIFECYCLE TRACING'}
                  {activeTab === 'erpPurchase' && 'SUPPLIER ALLOCATION & COMPREHENSIVE PURCHASE PLANS'}
                  {activeTab === 'erpReception' && 'WAREHOUSE DELIVERY RECEPTIONS & DISCONNECT CHECKS'}
                  {activeTab === 'erpReplenish' && 'SUPPLIER SHORTAGE CALCULATOR & INVENTORY CORRECTION'}
                  {activeTab === 'erpUsersSuppliers' && 'RELATIONS AND ERP ACCESS PERMISSIONS MANAGER'}
                </p>
              </div>
            </div>

            {/* Quick Actions block */}
            <div className="flex items-center gap-2">
              {currentUser.role === 'admin' && (
                <button
                  onClick={() => setIsUserMgmtOpen(true)}
                  className="px-2.5 py-1.5 text-xs font-semibold text-[#2563eb] bg-[#2563eb]/10 border border-[#2563eb]/20 hover:bg-[#2563eb]/15 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" /> 用户管理
                </button>
              )}

              <button
                onClick={() => setIsChangePwdOpen(true)}
                className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-all flex items-center gap-1 cursor-pointer border border-slate-200"
              >
                <Key className="w-3.5 h-3.5" /> 修改密码
              </button>

              <button
                onClick={handleLogout}
                className="px-2.5 py-1.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-all flex items-center gap-1 cursor-pointer border border-red-200"
              >
                <LogOut className="w-3.5 h-3.5" /> 登出
              </button>
            </div>
          </header>
        ) : null}

        {/* Content Scrolling Pane */}
        {currentUser ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* General Filter Section Card */}
            {systemMode === 'BI' && (
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col lg:flex-row lg:items-end justify-between gap-5 transition-all">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 flex-1">
                  {/* Region Select */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                      全局大区
                    </label>
                    <select
                      disabled={isRegionManager}
                      value={globalRegion}
                      onChange={(e) => {
                        setGlobalRegion(e.target.value);
                        setGlobalStore('all'); // reset store sub-choices
                      }}
                      className="w-full px-3 py-2 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:border-[#2563eb] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {!isRegionManager && <option value="all">全国分舵大区</option>}
                      {regionDropdownList.map(reg => (
                        <option key={reg} value={reg}>{reg}</option>
                      ))}
                    </select>
                  </div>

                  {/* Store select options */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                      门店分店
                    </label>
                    <select
                      value={globalStore}
                      onChange={(e) => setGlobalStore(e.target.value)}
                      className="w-full px-3 py-2 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:border-[#2563eb] cursor-pointer"
                    >
                      <option value="all">全部商铺门店</option>
                      {storeDropdownList.map(st => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>

                  {/* Category selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                      经营类别品类
                    </label>
                    <select
                      value={globalCategory}
                      onChange={(e) => setGlobalCategory(e.target.value)}
                      className="w-full px-3 py-2 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:border-[#2563eb] cursor-pointer"
                    >
                      <option value="all">全类别划分</option>
                      {uniqueCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Year filter dropdown */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                      销售年度
                    </label>
                    <select
                      value={globalYear}
                      onChange={(e) => setGlobalYear(e.target.value)}
                      className="w-full px-3 py-2 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:border-[#2563eb] cursor-pointer"
                    >
                      <option value="all">全部销售年度</option>
                      {uniqueYears.map(yr => (
                        <option key={yr} value={yr}>{yr}年</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* General Apply query filters */}
                <div className="flex items-center gap-2 flex-shrink-0 w-full lg:w-auto">
                  <button
                    onClick={handleQueryApply}
                    className="w-full lg:w-auto px-5 py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-xs rounded-lg shadow-sm transition-all text-center flex items-center justify-center gap-1 cursor-pointer"
                  >
                    查询
                  </button>
                  
                  {!isRegionManager && (
                    <button
                      onClick={() => setIsRegionMapOpen(true)}
                      className="w-full lg:w-auto px-4 py-2.5 text-[#2563eb] bg-[#2563eb]/5 hover:bg-[#2563eb]/10 text-xs font-bold border border-[#2563eb]/15 hover:border-[#2563eb]/30 rounded-lg transition-all text-center flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5" /> 区域映射配置
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Active Content rendering Tab Pane */}
            <div className="pt-1 animate-in fade-in slide-in-from-bottom-2 duration-250 flex-grow">
              {activeTab === 'overview' && (
                <OverviewTab 
                  transactions={filteredRetailOnlyOverview} 
                  inventory={filteredInventoryOverview}
                  filterLabel={kpiFilterDescriptorText}
                />
              )}

              {activeTab === 'monthly' && (
                <MonthlyReportTab 
                  transactions={mappedTransactions}
                  inventory={inventory}
                  storesInCurrentRegion={storesInCurrentRegion}
                  regionStoreMap={regionStoreMap}
                  onUpdateTransactionsList={(newList, msg) => {
                    syncTransactionsList(newList);
                    addToast(msg, 'success');
                  }}
                  onShowToast={addToast}
                />
              )}

              {activeTab === 'headWholesale' && (
                <WholesaleTab 
                  transactions={mappedTransactions}
                  inventory={inventory}
                  storesInCurrentRegion={storesInCurrentRegion}
                  regionStoreMap={regionStoreMap}
                  onUpdateTransactionsList={(newList, msg) => {
                    syncTransactionsList(newList);
                    addToast(msg, 'success');
                  }}
                  onShowToast={addToast}
                />
              )}

              {activeTab === 'inventory' && (
                <InventoryTab 
                  inventory={inventory}
                  storesInCurrentRegion={storesInCurrentRegion}
                  onUpdateInventoryList={(newList, msg) => {
                    syncInventoryList(newList);
                    addToast(msg, 'success');
                  }}
                  onShowToast={addToast}
                />
              )}

              {activeTab === 'bossDashboard' && currentUser && (
                <SalesAnalysisView 
                  currentUser={currentUser}
                />
              )}

              {activeTab === 'erpDashboard' && (
                <DashboardView 
                  orders={erpOrders}
                  systemConfig={erpSystemConfig || { id: 'global', shortageThreshold: 10, updatedAt: new Date().toISOString(), updatedBy: 'system' }}
                  onConfigChange={async (newThreshold) => {
                    await DbService.updateConfig(newThreshold, currentUser?.username || 'system');
                    addToast(`🔧 系统缺货阈值已成功更新为：${newThreshold}件`, 'success');
                  }}
                  currentUser={currentUser}
                />
              )}

              {activeTab === 'erpBranchOrder' && (
                <BranchOrderView 
                  orders={erpOrders}
                  purchaseOrders={erpPurchaseOrders}
                  onAddOrders={async (items, submissionDate) => {
                    await DbService.submitOrder(currentUser?.id || 'u_branch', currentUser?.branchName || currentUser?.username || '黄石店', items, submissionDate);
                    addToast('🎉 分店订单提交成功，自动汇总并触发多人协同追踪！', 'success');
                  }}
                  currentUser={currentUser}
                />
              )}

              {activeTab === 'erpPurchase' && (
                <PurchasingView 
                  orders={erpOrders}
                  purchaseOrders={erpPurchaseOrders}
                  onGeneratePos={async (orderIds, remarks) => {
                    await DbService.generatePurchaseOrders(orderIds, { id: currentUser?.id || 'u_purchasing', name: currentUser?.username || '采购经理', role: currentUser?.role || 'purchasing' }, remarks);
                    addToast('📄 采购单已拼盘合并生成，已同步关联至分店提报项！', 'success');
                  }}
                  onCreateDirectPo={async (supplier, orderDate, remarks, items) => {
                    await DbService.createDirectPurchaseOrder(supplier, orderDate, remarks, items, { id: currentUser?.id || 'u_purchasing', name: currentUser?.username || '采购经理', role: currentUser?.role || 'purchasing' });
                    addToast('📄 自建备货采购批次已顺利下达，进入货期管家！', 'success');
                  }}
                  onSubmitToFactory={async (poId, factoryStatus, expectedArrival) => {
                    await DbService.submitPoToFactory(poId, factoryStatus, expectedArrival, { id: currentUser?.id || 'u_purchasing', name: currentUser?.username || '采购经理', role: currentUser?.role || 'purchasing' });
                    addToast(`🏭 已向供货厂家确认货期批次，状态更新为：${factoryStatus === 'confirmed' ? '已排产受托确认' : '未排产待厂家受托'}`, 'success');
                  }}
                  onLogArrival={async (poId, itemArrivals) => {
                    await DbService.logArrival(poId, itemArrivals, { id: currentUser?.id || 'u_purchasing', name: currentUser?.username || '采购经理', role: currentUser?.role || 'purchasing' });
                    addToast('📝 成功登记并复核此次采购到货明细，库存已自动累加！', 'success');
                  }}
                  currentUser={currentUser}
                />
              )}

              {activeTab === 'erpReception' && (
                <ReceptionConfirmView 
                  orders={erpOrders}
                  onConfirmOrders={async (orderIds) => {
                    await DbService.batchConfirmOrders(orderIds, { id: currentUser?.id || 'u_rec', name: currentUser?.username || '前台验收员', role: 'receptionist' });
                    addToast('✅ 分店提报订单已完成前台初审核对，移交并就绪采购流程！', 'success');
                  }}
                  currentUser={currentUser}
                />
              )}

              {activeTab === 'erpReplenish' && (
                <ReplenishmentMgmtView 
                  currentUser={currentUser}
                />
              )}

              {activeTab === 'erpPriceManagement' && currentUser && (
                <PriceManagementView 
                  currentUser={currentUser}
                  onShowToast={(text, type) => addToast(text, type === 'error' ? 'error' : type === 'success' ? 'success' : 'info')}
                />
              )}

              {activeTab === 'erpUsersSuppliers' && (
                <UserManagementView 
                  users={erpUsers}
                  onSaveUser={async (usr) => {
                    await DbService.saveUser(usr, { id: currentUser?.id || 'admin', name: currentUser?.username || '管理员', role: 'admin' });
                    addToast('👤 多人体系账号已更新同步！', 'success');
                  }}
                  onDeleteUser={async (userId, uname) => {
                    await DbService.deleteUser(userId, uname, { id: currentUser?.id || 'admin', name: currentUser?.username || '管理员', role: 'admin' });
                    addToast('👤 协作子账号已成功销户注销！', 'success');
                  }}
                  currentUser={currentUser}
                />
              )}
            </div>

            <footer className="py-4 text-center text-xs text-slate-400">
              销售与账面经营决策系统 v2.4 ｜ 本地安全缓存存储 ｜ 完美适配大区锁定权限
            </footer>
          </div>
        ) : null}
      </div>

      {/* Modals Containers */}
      <LoginModal 
        isOpen={isLoginOpen} 
        onLogin={handleLogin}
      />

      <UserManagementModal 
        isOpen={isUserMgmtOpen}
        onClose={() => setIsUserMgmtOpen(false)}
        users={users}
        onAddUser={(name, role, reg, pass) => {
          if (users.some(u => u.username === name)) {
            addToast(`❌ 用户账号 ${name} 已存在！`, 'error');
            return false;
          }
          const addition: User = { username: name, role, region: reg, password: pass };
          const list = [...users, addition];
          syncUsersList(list);
          addToast(`✅ 成功添加新系统账号 [${name}]`, 'success');
          return true;
        }}
        onDeleteUser={(name) => {
          const clean = users.filter(x => x.username !== name);
          syncUsersList(clean);
          addToast(`🗑️ 用户 [${name}] 已成功彻底注销账户！`, 'success');
        }}
        onResetPassword={(name, fresh) => {
          const mod = users.map(u => u.username === name ? { ...u, password: fresh } : u);
          syncUsersList(mod);
          // If resetting self, update current details too
          if (currentUser && currentUser.username === name) {
            const selfObj = { ...currentUser, password: fresh };
            setCurrentUser(selfObj);
            sessionStorage.setItem('salesCurrentUser', JSON.stringify(selfObj));
          }
          addToast(`🔒 用户 [${name}] 的登录凭证密码已被重设，立即生效。`, 'success');
        }}
      />

      <ChangePwdModal 
        isOpen={isChangePwdOpen}
        onClose={() => setIsChangePwdOpen(false)}
        currentUser={currentUser}
        onConfirmChange={(oldPass, newPass) => {
          if (!currentUser) return false;
          const userDB = users.find(u => u.username === currentUser.username);
          if (!userDB || userDB.password !== oldPass) {
            return false; //old verification failure
          }
          const modUsers = users.map(u => u.username === currentUser.username ? { ...u, password: newPass } : u);
          syncUsersList(modUsers);
          const activeSelf = { ...currentUser, password: newPass };
          setCurrentUser(activeSelf);
          sessionStorage.setItem('salesCurrentUser', JSON.stringify(activeSelf));
          addToast('🎉 您的个人密码修改保存成功，请妥善保管。', 'success');
          return true;
        }}
      />

      <RegionMappingModal 
        isOpen={isRegionMapOpen}
        onClose={() => setIsRegionMapOpen(false)}
        regionStoreMap={regionStoreMap}
        onSaveMappings={(newMap) => {
          syncRegionStoreMap(newMap);
          // Auto update transactional region maps
          addToast('🔄 区域组织架构映射更新完毕并同步全局！', 'success');
        }}
        onShowToast={addToast}
      />

      {/* Persistent notifications toasts wrapper */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
