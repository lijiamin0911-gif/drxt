const collection = (() => {}) as any;
const doc = (() => {}) as any;
const getDocs = (() => Promise.resolve({ empty: true, docs: [] })) as any;
const getDoc = (() => Promise.resolve({ exists: () => false, data: () => null })) as any;
const setDoc = (() => Promise.resolve()) as any;
const addDoc = (() => Promise.resolve()) as any;
const updateDoc = (() => Promise.resolve()) as any;
const deleteDoc = (() => Promise.resolve()) as any;
const onSnapshot = (() => {}) as any;
const query = (() => {}) as any;
const where = (() => {}) as any;
const orderBy = (() => {}) as any;

import { db, isFirebaseConfigured, disableFirebase } from '../src/lib/firebase';
import { User, Order, PurchaseOrder, Arrival, SystemConfig, OperationLog, Role, InventoryItem, Product, Supplier, SalesRecord, BranchStock, IndependentPurchaseOrder, IndependentPurchaseOrderItem } from '../src/types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: 'app_user',
      email: 'user@example.com'
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Seed Users List
const SEED_USERS: User[] = [];

export const SEED_INVENTORY: InventoryItem[] = [
  {
    id: 'inv_1',
    productCode: 'PROD-A01',
    productName: '九牧不锈钢暗装高档水龙头',
    specs: 'SS-901-HM',
    currentStock: 12,
    safeStock: 50,
    supplier: '九牧卫浴制造厂',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'inv_2',
    productCode: 'PROD-B05',
    productName: '飞利浦智能LED吸顶顶灯 50W',
    specs: 'PL-M50W-LED',
    currentStock: 8,
    safeStock: 30,
    supplier: '飞利浦合肥照明厂',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'inv_3',
    productCode: 'PROD-C12',
    productName: '西门子五孔大面板安全墙面插座',
    specs: 'XMZ-5P-10A',
    currentStock: 120,
    safeStock: 100,
    supplier: '西门子电气制造部',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'inv_4',
    productCode: 'PROD-D09',
    productName: '欧普全光谱护眼台灯 12W',
    specs: 'OP-12W-GD',
    currentStock: 3,
    safeStock: 20,
    supplier: '欧普照明江门基地',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const SEED_PRODUCTS: Product[] = [
  {
    id: 'prod_1',
    productCode: 'PROD-A01',
    productName: '九牧不锈钢暗装高档水龙头',
    specs: 'SS-901-HM',
    unit: '个',
    defaultSupplier: '九牧卫浴制造厂',
    isApproved: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod_2',
    productCode: 'PROD-B05',
    productName: '飞利浦智能LED吸顶顶灯 50W',
    specs: 'PL-M50W-LED',
    unit: '盏',
    defaultSupplier: '飞利浦合肥照明厂',
    isApproved: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod_3',
    productCode: 'PROD-C12',
    productName: '西门子五孔大面板安全墙面插座',
    specs: 'XMZ-5P-10A',
    unit: '个',
    defaultSupplier: '西门子电气制造部',
    isApproved: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod_4',
    productCode: 'PROD-D09',
    productName: '欧普全光谱护眼台灯 12W',
    specs: 'OP-12W-GD',
    unit: '台',
    defaultSupplier: '欧普照明江门基地',
    isApproved: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod_5',
    productCode: 'P001',
    productName: '不锈钢螺母',
    specs: 'M8*20 规格',
    unit: '盒',
    defaultSupplier: '三好五金厂',
    isApproved: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod_6',
    productCode: 'P002',
    productName: '尼龙传动带',
    specs: 'B型周长1200',
    unit: '条',
    defaultSupplier: '强力传动工业部',
    isApproved: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const SEED_SUPPLIERS: Supplier[] = [
  {
    id: 'sup_1',
    name: '九牧卫浴制造厂',
    contact: '张九牧',
    phone: '13888888888',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    merchandiserName: '采购',
    leadTimeText: '有常备意向交期: 3-5天'
  },
  {
    id: 'sup_2',
    name: '飞利浦合肥照明厂',
    contact: '李照明',
    phone: '13999999999',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    merchandiserName: '采购',
    leadTimeText: '有周期限制: 7天内生产'
  },
  {
    id: 'sup_3',
    name: '西门子电气制造部',
    contact: '王电气',
    phone: '13777777777',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    merchandiserName: '王采购',
    leadTimeText: '默认无指定交期 (走现货安排)'
  },
  {
    id: 'sup_4',
    name: '欧普照明江门基地',
    contact: '赵五金',
    phone: '13666666666',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    merchandiserName: '王采购',
    leadTimeText: '有急单交期: 3天加急'
  },
  {
    id: 'sup_5',
    name: '三好五金厂',
    contact: '孙三好',
    phone: '13555555555',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    merchandiserName: '李跟单',
    leadTimeText: '有常规货期: 10-12天'
  },
  {
    id: 'sup_6',
    name: '强力传动工业部',
    contact: '郑强力',
    phone: '13444444444',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    merchandiserName: '李跟单',
    leadTimeText: '默认无指定交期'
  }
];

// Local DB State for server-side persistence in a JSON file
import fs from 'fs';
import path from 'path';
import { dbClient } from './dbClient';

const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

// Ensure data directory exists
if (!fs.existsSync(path.dirname(DB_FILE))) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
}

interface JsonDatabase {
  db_users?: any[];
  db_orders?: any[];
  db_purchase_orders?: any[];
  db_logs?: any[];
  db_config?: any;
  db_inventory?: any[];
  db_products?: any[];
  db_suppliers?: any[];
  db_sales_records?: any[];
  db_branch_stocks?: any[];
  db_independent_purchase_orders?: any[];
  lastModified?: number;
}

let dbData: JsonDatabase = {};
const modifiedKeys = new Set<string>();

// Load data from file
function loadDb() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      dbData = JSON.parse(raw);
    } catch (e) {
      console.error('Failed to parse database file, resetting to empty', e);
      dbData = {};
    }
  } else {
    dbData = {};
  }
}

// Write data to file atomically and asynchronously, with debouncing
let writeTimer: NodeJS.Timeout | null = null;
let isWriting = false;
let pendingWrite = false;

async function performWrite() {
  if (isWriting) {
    pendingWrite = true;
    return;
  }
  isWriting = true;
  pendingWrite = false;

  const tempPath = DB_FILE + '.tmp';
  try {
    const serialized = JSON.stringify(dbData); // Compact, avoids 'null, 2' pretty printing overhead
    await fs.promises.writeFile(tempPath, serialized, 'utf-8');
    await fs.promises.rename(tempPath, DB_FILE);
  } catch (error) {
    console.error('Failed to write db.json asynchronously, retrying synchronous fallback:', error);
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(dbData), 'utf-8');
    } catch (fallbackError) {
      console.error('Critical: Fallback save failed as well:', fallbackError);
    }
  }

  // Synchronize modified keys to PostgreSQL / Supabase if enabled
  if (dbClient.isEnabled() && modifiedKeys.size > 0) {
    const keysToSync = Array.from(modifiedKeys);
    modifiedKeys.clear();
    try {
      for (const key of keysToSync) {
        const val = (dbData as any)[key];
        if (val !== undefined) {
          await dbClient.set(key, val);
        }
      }
      console.log(`✨ [DB Sync] Synchronized keys to PostgreSQL/Supabase: [${keysToSync.join(', ')}]`);
    } catch (dbErr) {
      console.error('❌ [DB Sync] Failed to synchronize keys to database:', dbErr);
      // Put keys back so we retry next time
      keysToSync.forEach(k => modifiedKeys.add(k));
    }
  }

  isWriting = false;
  if (pendingWrite) {
    // Trigger immediately if there was another request during writing
    performWrite();
  }
}

function saveDb() {
  dbData.lastModified = Date.now();
  if (writeTimer) {
    clearTimeout(writeTimer);
  }
  // Debounce actual disk writing by 200ms to merge rapid continuous updates (e.g., loops/bulk)
  writeTimer = setTimeout(() => {
    performWrite();
  }, 200);
}

// Load database immediately
loadDb();

const getLocalData = <T>(key: string, defaultValue: T): T => {
  const val = (dbData as any)[key];
  if (val === undefined || val === null) {
    (dbData as any)[key] = defaultValue;
    modifiedKeys.add(key);
    saveDb();
    return defaultValue;
  }
  // Type protection: If defaultValue is an array, but val is not, reset it to empty array
  if (Array.isArray(defaultValue) && !Array.isArray(val)) {
    console.warn(`⚠️ [DB Type Protection] Expected array for key "${key}", but got type "${typeof val}". Resetting to default value.`);
    (dbData as any)[key] = defaultValue;
    modifiedKeys.add(key);
    saveDb();
    return defaultValue;
  }
  return val as T;
};

const setLocalData = <T>(key: string, data: T) => {
  (dbData as any)[key] = data;
  modifiedKeys.add(key);
  saveDb();
};

export function formatDateToMinute(dateStr?: string | Date): string {
  if (!dateStr) return '';
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  const d = typeof dateStr === 'string' ? new Date(dateStr.replace('Z', '').replace('T', ' ')) : dateStr;
  if (isNaN(d.getTime())) {
    return String(dateStr);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

export class ServerDbService {
  public static getLastModified(): number {
    return dbData.lastModified || 0;
  }

  public static async handleApiRequest(method: string, args: any[]): Promise<any> {
    const fn = (this as any)[method];
    if (typeof fn !== 'function') {
      throw new Error(`Method "${method}" not found on ServerDbService`);
    }
    return fn.apply(this, args);
  }
  // Listeners list
  private static listeners: (() => void)[] = [];
  private static isListeningRealTime = false;

  // Static Cache variables for instant rendering and optimistic updates
  private static cachedUsers: User[] | null = null;
  private static cachedOrders: Order[] | null = null;
  private static cachedPurchaseOrders: PurchaseOrder[] | null = null;
  private static cachedLogs: OperationLog[] | null = null;
  private static cachedConfig: SystemConfig | null = null;
  private static cachedInventory: InventoryItem[] | null = null;
  private static cachedProducts: Product[] | null = null;
  private static cachedSuppliers: Supplier[] | null = null;
  private static cachedSalesRecords: SalesRecord[] | null = null;
  private static cachedBranchStocks: BranchStock[] | null = null;
  private static cachedIndependentPurchaseOrders: IndependentPurchaseOrder[] | null = null;

  // Register state change listeners
  public static onChange(callback: () => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  private static triggerChange() {
    this.listeners.forEach(cb => cb());
  }

  // Clear specific collections of test data, with optional selective filters
  public static async clearCollections(
    collections: string[], 
    operator: { id: string, name: string, role: string },
    filter?: { 
      branchName?: string; 
      purchaserName?: string; 
      receptionistName?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<void> {
    const isSelective = !!(filter && (
      filter.branchName || 
      filter.purchaserName || 
      filter.receptionistName || 
      filter.startDate || 
      filter.endDate
    ));
    console.log(`🧹 [DB] Clearing collections: [${collections.join(', ')}] by ${operator.name} (${operator.role}). Selective: ${!!isSelective}`, filter);
    
    // Helper to check if a date falls inside the filter range
    const isDateInRange = (dateStr: string | undefined): boolean => {
      if (!dateStr) return false;
      try {
        const itemDate = new Date(dateStr);
        if (isNaN(itemDate.getTime())) return false;
        
        if (filter?.startDate) {
          const start = new Date(filter.startDate + 'T00:00:00');
          if (itemDate < start) return false;
        }
        if (filter?.endDate) {
          const end = new Date(filter.endDate + 'T23:59:59.999');
          if (itemDate > end) return false;
        }
        return true;
      } catch (e) {
        return false;
      }
    };

    // If selective, we fetch suppliers to check merchandiser mappings
    const suppliersList = isSelective ? await this.getSuppliers() : [];
    
    for (const col of collections) {
      if (col === 'db_orders') {
        const orders = await this.getOrders();
        if (isSelective) {
          const filtered = orders.filter(o => {
            let matchBranch = true;
            let matchPurchaser = true;
            let matchReceptionist = true;
            let matchDate = true;

            if (filter.branchName) {
              matchBranch = o.branchName === filter.branchName;
            }
            if (filter.purchaserName) {
              matchPurchaser = o.merchandiserName === filter.purchaserName;
            }
            if (filter.receptionistName) {
              matchReceptionist = o.remarkOperatorName === filter.receptionistName;
            }
            if (filter.startDate || filter.endDate) {
              matchDate = isDateInRange(o.createdAt);
            }

            const shouldDelete = matchBranch && matchPurchaser && matchReceptionist && matchDate;
            return !shouldDelete;
          });
          setLocalData('db_orders', filtered);
          this.cachedOrders = filtered;
        } else {
          setLocalData('db_orders', []);
          this.cachedOrders = [];
        }
      } else if (col === 'db_purchase_orders') {
        const pos = await this.getPurchaseOrders();
        if (isSelective) {
          // If filtering by branch, we must inspect the constituent orders
          const orders = await this.getOrders();
          const filteredOrders = orders.filter(o => {
            let matchBranch = true;
            let matchPurchaser = true;
            let matchReceptionist = true;
            let matchDate = true;

            if (filter.branchName) {
              matchBranch = o.branchName === filter.branchName;
            }
            if (filter.purchaserName) {
              matchPurchaser = o.merchandiserName === filter.purchaserName;
            }
            if (filter.receptionistName) {
              matchReceptionist = o.remarkOperatorName === filter.receptionistName;
            }
            if (filter.startDate || filter.endDate) {
              matchDate = isDateInRange(o.createdAt);
            }

            const shouldDelete = matchBranch && matchPurchaser && matchReceptionist && matchDate;
            return !shouldDelete;
          });
          const remainingOrderIds = new Set(filteredOrders.map(o => o.id));

          const filteredPos = pos.filter(po => {
            let matchPurchaser = true;
            let matchDate = true;

            if (filter.purchaserName) {
              const matchedSup = suppliersList.find(s => s.name === po.supplier);
              const merchandisers = matchedSup?.merchandiserName ? matchedSup.merchandiserName.split(/[,，;\s\/]+/).map(n => n.trim()) : [];
              matchPurchaser = merchandisers.includes(filter.purchaserName);
            }
            if (filter.startDate || filter.endDate) {
              matchDate = isDateInRange(po.createdAt) || isDateInRange(po.orderDate);
            }

            // Also check if its constituent orders have been deleted
            po.orderIds = po.orderIds.filter(id => remainingOrderIds.has(id));
            const hasNoOrders = po.orderIds.length === 0;

            const shouldDelete = (matchPurchaser && matchDate) || hasNoOrders;
            if (shouldDelete) return false;
            
            // Recalculate total quantity
            const constituentOrders = filteredOrders.filter(o => po.orderIds.includes(o.id));
            po.totalQuantity = constituentOrders.reduce((sum, o) => sum + o.quantity, 0);
            return true;
          });
          setLocalData('db_purchase_orders', filteredPos);
          this.cachedPurchaseOrders = filteredPos;
        } else {
          setLocalData('db_purchase_orders', []);
          this.cachedPurchaseOrders = [];
        }
      } else if (col === 'db_arrivals') {
        const arrivals = getLocalData<Arrival[]>('db_arrivals', []);
        if (isSelective) {
          const orders = await this.getOrders();
          const filtered = arrivals.filter(arr => {
            let matchBranch = true;
            let matchPurchaser = true;
            let matchReceptionist = true;
            let matchDate = true;

            const assocOrder = orders.find(o => o.id === arr.orderId);

            if (filter.branchName) {
              matchBranch = assocOrder ? assocOrder.branchName === filter.branchName : false;
            }
            if (filter.purchaserName) {
              matchPurchaser = assocOrder ? assocOrder.merchandiserName === filter.purchaserName : false;
            }
            if (filter.receptionistName) {
              matchReceptionist = arr.operator === filter.receptionistName;
            }
            if (filter.startDate || filter.endDate) {
              matchDate = isDateInRange(arr.arrivalDate);
            }

            const shouldDelete = matchBranch && matchPurchaser && matchReceptionist && matchDate;
            return !shouldDelete;
          });
          setLocalData('db_arrivals', filtered);
        } else {
          setLocalData('db_arrivals', []);
        }
      } else if (col === 'db_logs') {
        const logs = getLocalData<OperationLog[]>('db_logs', []);
        if (isSelective) {
          const filtered = logs.filter(log => {
            let matchBranch = true;
            let matchPurchaser = true;
            let matchReceptionist = true;
            let matchDate = true;

            if (filter.branchName) {
              matchBranch = log.username === filter.branchName && log.role === 'branch';
            }
            if (filter.purchaserName) {
              matchPurchaser = log.username === filter.purchaserName && log.role === 'purchasing';
            }
            if (filter.receptionistName) {
              matchReceptionist = log.username === filter.receptionistName && log.role === 'receptionist';
            }
            if (filter.startDate || filter.endDate) {
              matchDate = isDateInRange(log.timestamp);
            }

            const shouldDelete = matchBranch && matchPurchaser && matchReceptionist && matchDate;
            return !shouldDelete;
          });
          setLocalData('db_logs', filtered);
          this.cachedLogs = filtered;
        } else {
          setLocalData('db_logs', []);
          this.cachedLogs = [];
        }
      } else if (col === 'db_inventory') {
        if (!isSelective) {
          setLocalData('db_inventory', []);
          this.cachedInventory = [];
        }
      } else if (col === 'db_products') {
        if (!isSelective) {
          setLocalData('db_products', []);
          this.cachedProducts = [];
        }
      } else if (col === 'db_suppliers') {
        if (!isSelective) {
          setLocalData('db_suppliers', []);
          this.cachedSuppliers = [];
        }
      } else if (col === 'db_sales_records') {
        const records = getLocalData<SalesRecord[]>('db_sales_records', []);
        if (isSelective) {
          const filtered = records.filter(r => {
            let matchBranch = true;
            let matchDate = true;

            if (filter.branchName) {
              matchBranch = r.branchName === filter.branchName;
            }
            if (filter.startDate || filter.endDate) {
              const recMonth = r.month;
              if (filter.startDate) {
                const startMonth = filter.startDate.substring(0, 7);
                if (recMonth < startMonth) matchDate = false;
              }
              if (filter.endDate) {
                const endMonth = filter.endDate.substring(0, 7);
                if (recMonth > endMonth) matchDate = false;
              }
            }

            const shouldDelete = matchBranch && matchDate;
            return !shouldDelete;
          });
          setLocalData('db_sales_records', filtered);
          this.cachedSalesRecords = filtered;
        } else {
          setLocalData('db_sales_records', []);
          this.cachedSalesRecords = [];
        }
      } else if (col === 'db_branch_stocks') {
        const stocks = getLocalData<BranchStock[]>('db_branch_stocks', []);
        if (isSelective) {
          const filtered = stocks.filter(s => {
            let matchBranch = true;
            let matchDate = true;

            if (filter.branchName) {
              matchBranch = s.branchName === filter.branchName;
            }
            if (filter.startDate || filter.endDate) {
              matchDate = isDateInRange(s.updatedAt);
            }

            const shouldDelete = matchBranch && matchDate;
            return !shouldDelete;
          });
          setLocalData('db_branch_stocks', filtered);
          this.cachedBranchStocks = filtered;
        } else {
          setLocalData('db_branch_stocks', []);
          this.cachedBranchStocks = [];
        }
      } else if (col === 'db_independent_purchase_orders') {
        const pos = getLocalData<IndependentPurchaseOrder[]>('db_independent_purchase_orders', []);
        if (isSelective) {
          const filtered = pos.filter(po => {
            let matchPurchaser = true;
            let matchDate = true;

            if (filter.purchaserName) {
              const matchedSup = suppliersList.find(s => s.name === po.items[0]?.supplier);
              const merchandisers = matchedSup?.merchandiserName ? matchedSup.merchandiserName.split(/[,，;\s\/]+/).map(n => n.trim()) : [];
              matchPurchaser = merchandisers.includes(filter.purchaserName);
            }
            if (filter.startDate || filter.endDate) {
              matchDate = isDateInRange(po.orderDate) || isDateInRange(po.createdAt);
            }

            const shouldDelete = matchPurchaser && matchDate;
            return !shouldDelete;
          });
          setLocalData('db_independent_purchase_orders', filtered);
          this.cachedIndependentPurchaseOrders = filtered;
        } else {
          setLocalData('db_independent_purchase_orders', []);
          this.cachedIndependentPurchaseOrders = [];
        }
      } else if (col === 'db_users') {
        const currentUsers = getLocalData<User[]>('db_users', []);
        if (isSelective) {
          const filtered = currentUsers.filter(u => {
            if (filter.branchName && u.username === filter.branchName && u.role === 'branch') return false;
            if (filter.purchaserName && u.username === filter.purchaserName && u.role === 'purchasing') return false;
            if (filter.receptionistName && u.username === filter.receptionistName && u.role === 'receptionist') return false;
            return true;
          });
          // Preserve administrative users and the active operator so they don't get locked out
          const preserved = filtered.filter(u => u.id === operator.id || u.username === operator.name || u.role === 'admin');
          const finalUsers = preserved.length > 0 ? preserved : currentUsers.filter(u => u.role === 'admin');
          setLocalData('db_users', finalUsers);
          this.cachedUsers = finalUsers;
        } else {
          // Preserve administrative users and the active operator so they don't get locked out
          const preserved = currentUsers.filter(u => u.id === operator.id || u.username === operator.name || u.role === 'admin');
          const finalUsers = preserved.length > 0 ? preserved : currentUsers.filter(u => u.role === 'admin');
          setLocalData('db_users', finalUsers);
          this.cachedUsers = finalUsers;
        }
      }
    }
    
    // Log this major maintenance action
    let details = `管理员清空了以下数据集：[${collections.join(', ')}]，保留了主要管理账户。`;
    if (isSelective) {
      details = `管理员针对特定对象进行了【靶向清空】：` + [
        filter.branchName ? `分店: ${filter.branchName}` : '',
        filter.purchaserName ? `采购员: ${filter.purchaserName}` : '',
        filter.receptionistName ? `前台/验收: ${filter.receptionistName}` : '',
        filter.startDate ? `起始日期: ${filter.startDate}` : '',
        filter.endDate ? `结束日期: ${filter.endDate}` : ''
      ].filter(Boolean).join('，') + `。受影响数据集：[${collections.join(', ')}]。`;
    }
    
    await this.log(
      operator.id,
      operator.name,
      operator.role,
      isSelective ? '🧹 靶向清洗特定对象数据' : '🧹 清空/重置测试数据',
      details
    );
    
    this.triggerChange();
  }

  // Initialize seed database
  public static async initialize() {
    // 1. PostgreSQL / Supabase Integration
    if (dbClient.isEnabled()) {
      try {
        console.log('🔌 [DB] Connecting and initializing PostgreSQL/Supabase DB...');
        await dbClient.init();
        const pgData = await dbClient.getAll();
        
        if (Object.keys(pgData).length > 0) {
          dbData = { ...dbData, ...pgData };
          console.log('✅ [DB] Successfully loaded all collections from PostgreSQL/Supabase into memory.');
        } else {
          console.log('ℹ️ [DB] PostgreSQL/Supabase DB is empty. Seeding and migrating local collections to Cloud Relational Database...');
          
          // Seeding default datasets only if they do not exist locally
          if (!dbData['db_inventory'] || dbData['db_inventory'].length === 0) {
            dbData['db_inventory'] = SEED_INVENTORY;
          }
          if (!dbData['db_products'] || dbData['db_products'].length === 0) {
            dbData['db_products'] = SEED_PRODUCTS;
          }
          if (!dbData['db_suppliers'] || dbData['db_suppliers'].length === 0) {
            dbData['db_suppliers'] = SEED_SUPPLIERS;
          }
          if (!dbData['db_config']) {
            dbData['db_config'] = {
              id: 'global',
              shortageThreshold: 10,
              updatedAt: new Date().toISOString(),
              updatedBy: '系统'
            };
          }
          
          // Safety: Do not overwrite existing local accounts. Only set to empty if absolutely nothing exists locally either.
          if (!dbData['db_users']) {
            dbData['db_users'] = [];
          } else if (dbData['db_users'].length > 0) {
            console.log(`📦 [DB Sync] Migrating ${dbData['db_users'].length} existing user accounts to empty PostgreSQL/Supabase Cloud database.`);
          }

          // Force-sync local data back to empty Cloud DB so they are never lost
          await dbClient.set('db_inventory', dbData['db_inventory']);
          await dbClient.set('db_products', dbData['db_products']);
          await dbClient.set('db_suppliers', dbData['db_suppliers']);
          await dbClient.set('db_config', dbData['db_config']);
          await dbClient.set('db_users', dbData['db_users']);
          
          await this.log('system', '系统', 'admin', '系统初始化', '初始化并同步本地历史数据至云端关系型数据库');
        }
        this.triggerChange();
        return; // Skip standard filesystem / Firebase initialization
      } catch (err) {
        console.error('❌ [DB] PostgreSQL/Supabase initialization failed, falling back to local JSON file:', err);
      }
    }

    if (isFirebaseConfigured && db) {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        if (usersSnap.empty) {
          // Initialize remote database
          for (const u of SEED_USERS) {
            await setDoc(doc(db, 'users', u.id), u);
          }
          await setDoc(doc(db, 'configs', 'global'), {
            id: 'global',
            shortageThreshold: 10,
            updatedAt: new Date().toISOString(),
            updatedBy: 'system'
          });
          await this.log('system', '系统', 'admin', '系统初始化', '初始化默认分店、前台、采购与管理员账户');
        }

        // Initialize remote inventory if empty
        const invSnap = await getDocs(collection(db, 'inventory'));
        if (invSnap.empty) {
          for (const item of SEED_INVENTORY) {
            await setDoc(doc(db, 'inventory', item.id), item);
          }
        }

        // Initialize remote products if empty
        const prodSnap = await getDocs(collection(db, 'products'));
        if (prodSnap.empty) {
          for (const item of SEED_PRODUCTS) {
            await setDoc(doc(db, 'products', item.id), item);
          }
        }

        // Initialize remote suppliers if empty
        const supSnap = await getDocs(collection(db, 'suppliers'));
        if (supSnap.empty) {
          for (const item of SEED_SUPPLIERS) {
            await setDoc(doc(db, 'suppliers', item.id), item);
          }
        }

        // Subscribe to real-time changes
        if (isFirebaseConfigured && db && !this.isListeningRealTime) {
          this.isListeningRealTime = true;
          const collectionsToWatch = ['users', 'orders', 'purchase_orders', 'logs', 'configs', 'inventory', 'products', 'suppliers', 'sales_records', 'branch_stocks', 'independent_purchase_orders'];
          collectionsToWatch.forEach(colName => {
            onSnapshot(collection(db, colName), (snap) => {
              const data = snap.docs.map(doc => doc.data());
              if (colName === 'users') {
                this.cachedUsers = data as User[];
              } else if (colName === 'orders') {
                this.cachedOrders = data as Order[];
              } else if (colName === 'purchase_orders') {
                this.cachedPurchaseOrders = data as PurchaseOrder[];
              } else if (colName === 'logs') {
                this.cachedLogs = data as OperationLog[];
              } else if (colName === 'configs') {
                const globalDoc = data.find(d => d.id === 'global');
                this.cachedConfig = globalDoc as SystemConfig || null;
              } else if (colName === 'inventory') {
                this.cachedInventory = data as InventoryItem[];
              } else if (colName === 'products') {
                this.cachedProducts = data as Product[];
              } else if (colName === 'suppliers') {
                this.cachedSuppliers = data as Supplier[];
              } else if (colName === 'sales_records') {
                this.cachedSalesRecords = data as SalesRecord[];
              } else if (colName === 'branch_stocks') {
                this.cachedBranchStocks = data as BranchStock[];
              } else if (colName === 'independent_purchase_orders') {
                this.cachedIndependentPurchaseOrders = data as IndependentPurchaseOrder[];
              }
              this.triggerChange();
            }, (err) => {
              console.warn(`Snapshot subscription failed for ${colName}:`, err);
            });
          });
        }
      } catch (e) {
        console.error('Firebase Seed Init Failed (using local fallback)', e);
        disableFirebase();
        // Prepare local database setup fallback
        const users = getLocalData<User[]>('db_users', []);
        if (users.length === 0) {
          setLocalData('db_users', SEED_USERS);
          setLocalData('db_config', {
            id: 'global',
            shortageThreshold: 10,
            updatedAt: new Date().toISOString(),
            updatedBy: '系统'
          });
          await this.log('system', '系统', 'admin', '系统初始化', '初始化本地分店、前台、采购与管理员账户');
        }

        const inv = getLocalData<InventoryItem[]>('db_inventory', []);
        if (inv.length === 0) {
          setLocalData('db_inventory', SEED_INVENTORY);
        }

        const prods = getLocalData<Product[]>('db_products', []);
        if (prods.length === 0) {
          setLocalData('db_products', SEED_PRODUCTS);
        }

        const sups = getLocalData<Supplier[]>('db_suppliers', []);
        if (sups.length === 0) {
          setLocalData('db_suppliers', SEED_SUPPLIERS);
        }
      }
    } else {
      // Local setup
      const users = getLocalData<User[]>('db_users', []);
      if (users.length === 0) {
        setLocalData('db_users', SEED_USERS);
        setLocalData('db_config', {
          id: 'global',
          shortageThreshold: 10,
          updatedAt: new Date().toISOString(),
          updatedBy: '系统'
        });
        await this.log('system', '系统', 'admin', '系统初始化', '初始化本地分店、前台、采购与管理员账户');
      }

      const inv = getLocalData<InventoryItem[]>('db_inventory', []);
      if (inv.length === 0) {
        setLocalData('db_inventory', SEED_INVENTORY);
      }

      const prods = getLocalData<Product[]>('db_products', []);
      if (prods.length === 0) {
        setLocalData('db_products', SEED_PRODUCTS);
      }

      const sups = getLocalData<Supplier[]>('db_suppliers', []);
      if (sups.length === 0) {
        setLocalData('db_suppliers', SEED_SUPPLIERS);
      }
    }
    this.triggerChange();
  }

  // Operation Logs Helper
  public static async log(userId: string, username: string, role: string, action: string, details: string) {
    const logItem: OperationLog = {
      id: 'log_' + Date.now() + Math.random().toString(36).substring(2, 6),
      userId,
      username,
      role,
      action,
      details,
      timestamp: new Date().toISOString()
    };

    if (this.cachedLogs) {
      this.cachedLogs.unshift(logItem);
    } else {
      this.cachedLogs = [logItem];
    }

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'logs', logItem.id), logItem);
      } catch (e) {
        handleFirestoreError(e, OperationType.CREATE, 'logs');
      }
    } else {
      const logs = getLocalData<OperationLog[]>('db_logs', []);
      logs.unshift(logItem); // Newest first
      setLocalData('db_logs', logs);
    }
    this.triggerChange();
  }

  public static async getLogs(): Promise<OperationLog[]> {
    if (this.cachedLogs !== null) {
      return [...this.cachedLogs].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    }
    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDocs(query(collection(db, 'logs'), orderBy('timestamp', 'desc')));
        this.cachedLogs = snap.docs.map(doc => doc.data() as OperationLog);
        return this.cachedLogs;
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, 'logs');
      }
    }
    return getLocalData<OperationLog[]>('db_logs', []).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  // Config management
  public static async getConfig(): Promise<SystemConfig> {
    if (this.cachedConfig !== null) {
      return this.cachedConfig;
    }
    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDoc(doc(db, 'configs', 'global'));
        if (snap.exists()) {
          this.cachedConfig = snap.data() as SystemConfig;
          return this.cachedConfig;
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.GET, 'configs/global');
      }
    }
    return getLocalData<SystemConfig>('db_config', {
      id: 'global',
      shortageThreshold: 10,
      updatedAt: new Date().toISOString(),
      updatedBy: '系统'
    });
  }

  public static async updateConfig(threshold: number, operatorName: string): Promise<SystemConfig> {
    const configData: SystemConfig = {
      id: 'global',
      shortageThreshold: threshold,
      updatedAt: new Date().toISOString(),
      updatedBy: operatorName
    };

    this.cachedConfig = configData;

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'configs', 'global'), configData);
      } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, 'configs/global');
      }
    } else {
      setLocalData('db_config', configData);
    }
    this.triggerChange();
    return configData;
  }

  // --- Users CRUD ---
  public static async getUsers(): Promise<User[]> {
    if (this.cachedUsers !== null) {
      return this.cachedUsers;
    }
    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDocs(collection(db, 'users'));
        this.cachedUsers = snap.docs.map(doc => doc.data() as User);
        return this.cachedUsers;
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, 'users');
      }
    }
    return getLocalData<User[]>('db_users', SEED_USERS);
  }

  public static async saveUser(user: User, operator: { id: string; name: string; role: string }): Promise<void> {
    if (this.cachedUsers) {
      const index = this.cachedUsers.findIndex(u => u.id === user.id);
      if (index > -1) {
        this.cachedUsers[index] = user;
      } else {
        this.cachedUsers.push(user);
      }
    }

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'users', user.id), user);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `users/${user.id}`);
      }
    } else {
      const users = getLocalData<User[]>('db_users', SEED_USERS);
      const index = users.findIndex(u => u.id === user.id);
      if (index > -1) {
        users[index] = user;
      } else {
        users.push(user);
      }
      setLocalData('db_users', users);
    }
    await this.log(operator.id, operator.name, operator.role, '更新用户', `管理员保存了账号: ${user.username} (${user.role})`);
    this.triggerChange();
  }

  public static async deleteUser(userId: string, username: string, operator: { id: string; name: string; role: string }): Promise<void> {
    if (this.cachedUsers) {
      this.cachedUsers = this.cachedUsers.filter(u => u.id !== userId);
    }

    if (isFirebaseConfigured && db) {
      try {
        await deleteDoc(doc(db, 'users', userId));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `users/${userId}`);
      }
    } else {
      const users = getLocalData<User[]>('db_users', SEED_USERS);
      const filtered = users.filter(u => u.id !== userId);
      setLocalData('db_users', filtered);
    }
    await this.log(operator.id, operator.name, operator.role, '删除用户', `管理员删除了账号: ${username}`);
    this.triggerChange();
  }

  public static async importUsers(items: { username: string; role: Role; branchName?: string; pin: string; isActive?: boolean }[], operator: { id: string; name: string; role: string }, overwrite: boolean): Promise<{ imported: number; updated: number; skipped: number }> {
    const existing = await this.getUsers();
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    const finalUsers = [...existing];

    for (const newItem of items) {
      if (!newItem.username || !newItem.username.trim()) continue;
      const matchIdx = finalUsers.findIndex(e => e.username.toLowerCase() === newItem.username.trim().toLowerCase());
      if (matchIdx > -1) {
        if (overwrite) {
          finalUsers[matchIdx] = {
            ...finalUsers[matchIdx],
            role: newItem.role,
            branchName: newItem.role === 'branch' ? newItem.branchName : undefined,
            pin: newItem.pin || finalUsers[matchIdx].pin,
            password: newItem.pin || finalUsers[matchIdx].pin, // Sync password
            isActive: newItem.isActive !== undefined ? newItem.isActive : true,
          };
          updated++;
        } else {
          skipped++;
        }
      } else {
        const createdUser: User = {
          id: 'u_' + Date.now() + Math.random().toString(36).substring(2, 6) + '_' + Math.floor(Math.random() * 100),
          username: newItem.username.trim(),
          role: newItem.role,
          branchName: newItem.role === 'branch' ? newItem.branchName : undefined,
          pin: newItem.pin || '123456', // default pin
          password: newItem.pin || '123456', // Sync password
          isActive: newItem.isActive !== undefined ? newItem.isActive : true,
          createdAt: new Date().toISOString()
        };
        finalUsers.push(createdUser);
        imported++;
      }
    }

    // Save back to db (Firestore or localStorage)
    if (isFirebaseConfigured && db) {
      try {
        for (const u of finalUsers) {
          await setDoc(doc(db, 'users', u.id), u);
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, 'users_bulk');
      }
    } else {
      setLocalData('db_users', finalUsers);
    }

    this.cachedUsers = finalUsers;

    await this.log(
      operator.id,
      operator.name,
      operator.role,
      '导入用户表',
      `批量导入账户：新增 ${imported} 个账户，覆盖 ${updated} 个账户，跳过 ${skipped} 个账户`
    );
    this.triggerChange();
    return { imported, updated, skipped };
  }

  // --- Orders CRUD ---
  public static async getOrders(): Promise<Order[]> {
    if (this.cachedOrders !== null) {
      return this.cachedOrders;
    }
    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDocs(collection(db, 'orders'));
        this.cachedOrders = snap.docs.map(doc => doc.data() as Order);
        return this.cachedOrders;
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, 'orders');
      }
    }
    return getLocalData<Order[]>('db_orders', []);
  }

  public static async saveOrder(order: Order, operator: { id: string; name: string; role: string }): Promise<void> {
    if (this.cachedOrders) {
      const index = this.cachedOrders.findIndex(o => o.id === order.id);
      if (index > -1) {
        this.cachedOrders[index] = order;
      } else {
        this.cachedOrders.push(order);
      }
    }

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'orders', order.id), order);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `orders/${order.id}`);
      }
    } else {
      const orders = getLocalData<Order[]>('db_orders', []);
      const index = orders.findIndex(o => o.id === order.id);
      if (index > -1) {
        orders[index] = order;
      } else {
        orders.push(order);
      }
      setLocalData('db_orders', orders);
    }
    this.triggerChange();
  }

  // Submit Order from Branch
  public static async submitOrder(
    branchId: string, 
    branchName: string, 
    items: { productCode: string; productName: string; specs: string; quantity: number; supplier: string; orderType?: 'conventional' | 'custom'; remark?: string; isUrgent?: boolean }[],
    submissionDate?: string
  ): Promise<void> {
    const suppliersList = await this.getSuppliers();
    const invItems = await this.getInventory();

    // Verification of Inventory for direct-dispatch conventional parts
    for (const item of items) {
      const normalizedRemark = (item.remark || '').trim();
      const hasDirectKeywords = ['直发', '厂家直发', '厂里直发', '工厂直发'].some(k => normalizedRemark.includes(k));
      if (hasDirectKeywords && item.orderType !== 'custom') {
        const existingInv = invItems.find(inv => inv.productCode.trim() === item.productCode.trim());
        const currentStock = existingInv ? (existingInv.currentStock || 0) : 0;
        if (currentStock > 0) {
          throw new Error(`【有库存阻止厂家直发】常规产品 [${item.productName}] (编码: ${item.productCode}) 在总部系统内有备货库存（当前余量：${currentStock} 件），常规系统强制不允许厂家直发！请库内配送，或清除备注中的“直发”字样后重新提报。`);
        }
      }
    }

    const ordersToSubmit: Order[] = items.map((item, idx) => {
      const randomNo = Math.floor(1000 + Math.random() * 9000);
      
      const d = submissionDate ? new Date(submissionDate) : new Date();
      const dateStr = isNaN(d.getTime())
         ? new Date().toISOString().slice(0, 10).replace(/-/g, '')
         : submissionDate!.replace(/-/g, '');
         
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const createdAtStr = submissionDate ? `${submissionDate} ${hh}:${mm}` : formatDateToMinute(now.toISOString());

      // Match supplier to populate merchandiserName and leadTimeText automatically
      const matchedSupplier = suppliersList.find(s => s.name.trim() === item.supplier.trim());

      const normalizedRemark = (item.remark || '').trim();
      const hasDirectKeywords = ['直发', '厂家直发', '厂里直发', '工厂直发'].some(k => normalizedRemark.includes(k));
      let directDispatchApproved: 'pending' | 'approved' | 'rejected' | undefined = undefined;
      
      if (hasDirectKeywords && item.orderType === 'custom') {
        directDispatchApproved = 'pending';
      }

      return {
        id: `ord_${Date.now()}_${idx}`,
        orderNo: `SO-${dateStr}-${randomNo}`,
        branchId,
        branchName,
        productCode: item.productCode.trim(),
        productName: item.productName.trim(),
        specs: item.specs.trim(),
        quantity: item.quantity,
        receivedQty: 0,
        status: 'pending_confirm',
        supplier: item.supplier.trim() || '通用厂商',
        orderType: item.orderType || 'conventional',
        remark: item.remark || '',
        remarkRole: item.remark ? 'branch' : undefined,
        remarkOperatorName: item.remark ? branchName : undefined,
        remarkUpdatedAt: item.remark ? new Date().toISOString() : undefined,
        directDispatchApproved,
        createdAt: createdAtStr,
        merchandiserName: matchedSupplier ? matchedSupplier.merchandiserName : undefined,
        leadTimeText: matchedSupplier ? matchedSupplier.leadTimeText : undefined,
        isUrgent: item.isUrgent || false
      };
    });

    for (const order of ordersToSubmit) {
      await this.saveOrder(order, { id: branchId, name: branchName, role: 'branch' });
    }

    await this.log(
      branchId, 
      branchName, 
      'branch', 
      '提交订单', 
      `分店提交了 ${items.length} 笔订单，状态：【待前台确认】`
    );
  }

  // Batch confirm orders (Receptionist)
  public static async batchConfirmOrders(orderIds: string[], operator: { id: string; name: string; role: string }): Promise<void> {
    const allOrders = await this.getOrders();
    const confirmedCount = orderIds.length;
    let autoLinkedCount = 0;

    for (const orderId of orderIds) {
      const order = allOrders.find(o => o.id === orderId);
      if (order && order.status === 'pending_confirm') {
        order.status = 'pending_purchase';
        order.confirmedAt = new Date().toISOString();
        
        // Auto link if an active PO exists for the same supplier
        const linked = await this.autoLinkOrderToExistingPo(order, operator);
        if (linked) {
          autoLinkedCount++;
        }
        await this.saveOrder(order, operator);
      }
    }

    await this.log(
      operator.id, 
      operator.name, 
      operator.role, 
      '确认订单', 
      `前台批量确认了 ${confirmedCount} 笔分店订单。状态更新：【待采购处理】(其中 ${autoLinkedCount} 笔已自动并案到该合作商的在途采购合同中)`
    );
  }

  // --- Purchase Orders (PO) CRUD ---
  public static async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    if (this.cachedPurchaseOrders !== null) {
      return this.cachedPurchaseOrders;
    }
    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDocs(collection(db, 'purchase_orders'));
        this.cachedPurchaseOrders = snap.docs.map(doc => doc.data() as PurchaseOrder);
        return this.cachedPurchaseOrders;
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, 'purchase_orders');
      }
    }
    return getLocalData<PurchaseOrder[]>('db_purchase_orders', []);
  }

  public static async generatePurchaseOrders(orderIds: string[], operator: { id: string; name: string; role: string }, poRemarks: string): Promise<void> {
    const allOrders = await this.getOrders();
    const selectedOrders = allOrders.filter(o => orderIds.includes(o.id) && o.status === 'pending_purchase');

    if (selectedOrders.length === 0) return;

    // Group selected orders by Supplier
    const groupedBySupplier: { [supplier: string]: Order[] } = {};
    for (const order of selectedOrders) {
      if (!groupedBySupplier[order.supplier]) {
        groupedBySupplier[order.supplier] = [];
      }
      groupedBySupplier[order.supplier].push(order);
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const posCreated: string[] = [];

    for (const [supplier, items] of Object.entries(groupedBySupplier)) {
      const randomNo = Math.floor(1000 + Math.random() * 9000);
      const poNo = `PO-${dateStr}-${randomNo}`;
      const poId = `po_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

      const newPo: PurchaseOrder = {
        id: poId,
        poNo,
        supplier,
        orderDate: new Date().toISOString().slice(0, 10),
        status: 'pending_arrival',
        remarks: poRemarks || '无',
        orderIds: items.map(i => i.id),
        totalQuantity,
        factoryStatus: 'unconfirmed',
        createdAt: new Date().toISOString()
      };

      if (this.cachedPurchaseOrders) {
        this.cachedPurchaseOrders.push(newPo);
      }

      // Write PO
      if (isFirebaseConfigured && db) {
        try {
          await setDoc(doc(db, 'purchase_orders', poId), newPo);
        } catch (e) {
          handleFirestoreError(e, OperationType.CREATE, `purchase_orders/${poId}`);
        }
      } else {
        const pos = getLocalData<PurchaseOrder[]>('db_purchase_orders', []);
        pos.push(newPo);
        setLocalData('db_purchase_orders', pos);
      }

      // Update constituent order status to 'purchased' and bind poId
      for (const order of items) {
        order.status = 'purchased';
        order.purchaseOrderId = poId;
        await this.saveOrder(order, operator);
      }

      posCreated.push(`${poNo} (${supplier}, ${items.length}项产品)`);
    }

    await this.log(
      operator.id, 
      operator.name, 
      operator.role, 
      '生成采购单', 
      `采购员合并生成了 ${posCreated.length} 份采购单：${posCreated.join('; ')}，备注：${poRemarks || '无'}`
    );
    this.triggerChange();
  }

  // Delete/Cancel a Purchase Order (PO) with the choice to preserve or cancel branch orders
  public static async deletePurchaseOrder(
    poId: string, 
    deleteBranchOrders: boolean, 
    operator: { id: string; name: string; role: string }
  ): Promise<void> {
    const pos = await this.getPurchaseOrders();
    const poIndex = pos.findIndex(p => p.id === poId);
    if (poIndex === -1) {
      throw new Error('采购合同单未找到');
    }
    const po = pos[poIndex];
    const allOrders = await this.getOrders();
    const poOrders = allOrders.filter(o => po.orderIds.includes(o.id));

    let processedCount = 0;
    for (const order of poOrders) {
      if (deleteBranchOrders) {
        order.status = 'cancelled';
        order.cancelReason = `因采购合同[${po.poNo}]被废除，关联订单一并作废。`;
        order.cancelledBy = operator.name;
        order.cancelledAt = new Date().toISOString();
      } else {
        // Preserve and release back to pending purchase queue
        order.status = 'pending_purchase';
        order.purchaseOrderId = undefined;
        order.receivedQty = 0;
      }
      await this.saveOrder(order, operator);
      processedCount++;
    }

    // Remove PO from cache and database
    pos.splice(poIndex, 1);
    if (isFirebaseConfigured && db) {
      try {
        await deleteDoc(doc(db, 'purchase_orders', poId));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `purchase_orders/${poId}`);
      }
    } else {
      setLocalData('db_purchase_orders', pos);
    }

    const actionText = deleteBranchOrders ? '同步作废关联分店订单' : '释放关联订单回采购队列(保留分店订单)';
    await this.log(
      operator.id,
      operator.name,
      operator.role,
      '废除采购合同',
      `采购员作废了合同 [${po.poNo}]，操作选择：【${actionText}】，涉及分店订单：${processedCount} 笔`
    );

    this.triggerChange();
  }

  // Automatically link a pending_purchase order to an active PO of the same supplier if available
  public static async autoLinkOrderToExistingPo(
    order: Order, 
    operator: { id: string; name: string; role: string }
  ): Promise<boolean> {
    const pos = await this.getPurchaseOrders();
    // Find active PO (pending_arrival) for the exact same supplier
    const activePo = pos.find(p => p.supplier.trim() === order.supplier.trim() && p.status === 'pending_arrival');
    
    if (activePo) {
      order.status = 'purchased';
      order.purchaseOrderId = activePo.id;
      
      if (!activePo.orderIds.includes(order.id)) {
        activePo.orderIds.push(order.id);
        activePo.totalQuantity += order.quantity;
        
        // Save the updated PO
        if (isFirebaseConfigured && db) {
          try {
            await setDoc(doc(db, 'purchase_orders', activePo.id), activePo);
          } catch (e) {
            handleFirestoreError(e, OperationType.UPDATE, `purchase_orders/${activePo.id}`);
          }
        } else {
          setLocalData('db_purchase_orders', pos);
        }
      }
      return true;
    }
    return false;
  }

  // Create direct inventory/replenishment purchase order without branch submission
  public static async createDirectPurchaseOrder(
    supplier: string,
    orderDate: string,
    remarks: string,
    items: { productCode: string; productName: string; specs: string; quantity: number; previousPrice?: number; currentPrice?: number }[],
    operator: { id: string; name: string; role: string }
  ): Promise<void> {
    const rawDate = orderDate || new Date().toISOString().slice(0, 10);
    const dateStr = rawDate.replace(/-/g, '');
    const poRandom = Math.floor(1000 + Math.random() * 9000);
    const poNo = `PO-DIRECT-${dateStr}-${poRandom}`;
    const poId = `po_${Date.now()}_direct_${Math.random().toString(36).substring(2, 6)}`;

    const orderIdsCreated: string[] = [];
    const createdOrders: Order[] = [];

    // 1. Create standard order items representing the inventory replenishment rows
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const ordId = `ord_direct_${Date.now()}_${idx}`;
      const ordRandom = Math.floor(1000 + Math.random() * 9000);
      
      const newOrder: Order = {
        id: ordId,
        orderNo: `SO-DIRECT-${dateStr}-${ordRandom}`,
        branchId: 'hq_warehouse',
        branchName: '总部备货仓',
        productCode: item.productCode.trim(),
        productName: item.productName.trim(),
        specs: item.specs.trim(),
        quantity: item.quantity,
        receivedQty: 0,
        status: 'purchased',
        supplier: supplier.trim(),
        purchaseOrderId: poId,
        previousPrice: item.previousPrice,
        currentPrice: item.currentPrice,
        createdAt: `${rawDate} ${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`,
        orderType: 'conventional'
      };

      createdOrders.push(newOrder);
      orderIdsCreated.push(ordId);
    }

    // Save all of these orders to database
    for (const ord of createdOrders) {
      await this.saveOrder(ord, operator);
    }

    // 2. Create and write the PurchaseOrder
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const newPo: PurchaseOrder = {
      id: poId,
      poNo,
      supplier: supplier.trim(),
      orderDate: rawDate,
      status: 'pending_arrival',
      remarks: remarks || '库存储备(采购自主建单)',
      orderIds: orderIdsCreated,
      totalQuantity,
      factoryStatus: 'unconfirmed',
      createdAt: new Date().toISOString()
    };

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'purchase_orders', poId), newPo);
      } catch (e) {
        handleFirestoreError(e, OperationType.CREATE, `purchase_orders/${poId}`);
      }
    } else {
      const pos = getLocalData<PurchaseOrder[]>('db_purchase_orders', []);
      pos.push(newPo);
      setLocalData('db_purchase_orders', pos);
    }

    // 3. Log the process
    await this.log(
      operator.id,
      operator.name,
      operator.role,
      '创建直属采购单',
      `采购自建备库合同 ${newPo.poNo}，供应商: ${supplier}，共 ${items.length} 种货品，合计 ${totalQuantity} 件`
    );

    this.triggerChange();
  }

  // One-click submit / confirm with factory
  public static async submitPoToFactory(poId: string, factoryStatus: 'confirmed' | 'unconfirmed', expectedArrival: string, operator: { id: string; name: string; role: string }): Promise<void> {
    const pos = await this.getPurchaseOrders();
    const po = pos.find(p => p.id === poId);

    if (po) {
      po.factoryStatus = factoryStatus;
      po.expectedArrivalDate = expectedArrival;

      if (isFirebaseConfigured && db) {
        try {
          await setDoc(doc(db, 'purchase_orders', poId), po);
        } catch (e) {
          handleFirestoreError(e, OperationType.UPDATE, `purchase_orders/${poId}`);
        }
      } else {
        const index = pos.findIndex(p => p.id === poId);
        pos[index] = po;
        setLocalData('db_purchase_orders', pos);
      }

      await this.log(
        operator.id,
        operator.name,
        operator.role,
        '提交采购厂家',
        `采购员向厂家确认了采购单 ${po.poNo}，预计到货日期：${expectedArrival}，厂家确认状态：${factoryStatus === 'confirmed' ? '已确认' : '待确认'}`
      );
      this.triggerChange();
    }
  }

  // --- Arrivals / Backlog Tracking ---
  public static async getArrivals(): Promise<Arrival[]> {
    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDocs(collection(db, 'arrivals'));
        return snap.docs.map(doc => doc.data() as Arrival);
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, 'arrivals');
      }
    }
    return getLocalData<Arrival[]>('db_arrivals', []);
  }

  // Log new arrival
  public static async logArrival(poId: string, itemArrivals: { orderId: string; receivedQty: number }[], operator: { id: string; name: string; role: string }): Promise<void> {
    const pos = await this.getPurchaseOrders();
    const po = pos.find(p => p.id === poId);
    if (!po) return;

    const allOrders = await this.getOrders();
    const completedArrivals: Arrival[] = [];

    for (const item of itemArrivals) {
      if (item.receivedQty <= 0) continue;

      const order = allOrders.find(o => o.id === item.orderId);
      if (!order) continue;

      // Ensure received quantity does not exceed original requested (though in reality, it's bound by total quantity)
      const prevReceived = order.receivedQty || 0;
      const newReceived = prevReceived + item.receivedQty;
      order.receivedQty = newReceived;

      if (order.receivedQty >= order.quantity) {
        order.status = 'completed';
      }
      await this.saveOrder(order, operator);

      // Automatically increment current stock for HQ warehouse replenishment arrivals
      if (order.branchId === 'hq_warehouse') {
        try {
          const invItems = await this.getInventory();
          const existingInv = invItems.find(inv => inv.productCode === order.productCode);
          if (existingInv) {
            existingInv.currentStock = (existingInv.currentStock || 0) + item.receivedQty;
            existingInv.updatedAt = new Date().toISOString();
            await this.saveInventoryItem(existingInv, operator);
          } else {
            const newInv: InventoryItem = {
              id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              productCode: order.productCode,
              productName: order.productName,
              specs: order.specs,
              currentStock: item.receivedQty,
              safeStock: order.quantity * 2,
              supplier: order.supplier,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            await this.saveInventoryItem(newInv, operator);
          }
        } catch (err) {
          console.error('Failed to auto-increment stock on hq arrival:', err);
        }
      }

      const arrivalRecord: Arrival = {
        id: `arr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        poId,
        poNo: po.poNo,
        orderId: item.orderId,
        receivedQty: item.receivedQty,
        arrivalDate: new Date().toISOString(),
        operator: operator.name
      };

      if (isFirebaseConfigured && db) {
        try {
          await setDoc(doc(db, 'arrivals', arrivalRecord.id), arrivalRecord);
        } catch (e) {
          handleFirestoreError(e, OperationType.CREATE, `arrivals/${arrivalRecord.id}`);
        }
      } else {
        const arrs = getLocalData<Arrival[]>('db_arrivals', []);
        arrs.unshift(arrivalRecord);
        setLocalData('db_arrivals', arrs);
      }

      completedArrivals.push(arrivalRecord);
    }

    // Evaluate PO overall state -- if all constituent order items arecompleted, mark PO as 'completed'
    const updatedOrders = await this.getOrders();
    const poOrders = updatedOrders.filter(o => po.orderIds.includes(o.id));
    const allCompleted = poOrders.every(o => o.receivedQty >= o.quantity);

    if (allCompleted) {
      po.status = 'completed';
      if (isFirebaseConfigured && db) {
        try {
          await setDoc(doc(db, 'purchase_orders', poId), po);
        } catch (e) {
          handleFirestoreError(e, OperationType.UPDATE, `purchase_orders/${poId}`);
        }
      } else {
        const index = pos.findIndex(p => p.id === poId);
        pos[index] = po;
        setLocalData('db_purchase_orders', pos);
      }
    }

    if (completedArrivals.length > 0) {
      const summaryMsg = completedArrivals.map(a => {
        const order = allOrders.find(o => o.id === a.orderId);
        return `${order?.productName || '产品'}: ${a.receivedQty}件`;
      }).join(', ');

      await this.log(
        operator.id,
        operator.name,
        operator.role,
        '录入到货',
        `采购员录入了采购单 ${po.poNo} 的到货数据 (${summaryMsg})。采购单完成状态：${po.status === 'completed' ? '全部到齐' : '部分到货'}`
      );
    }
    this.triggerChange();
  }

  // 一键补货 (One-Click Replenish)
  // Generates a replenishment order automatically for Shortage items
  public static async replenishShortage(shorageItem: { orderId: string; branchId: string; branchName: string; productCode: string; productName: string; specs: string; qtyShort: number; supplier: string }, operator: { id: string; name: string; role: string }): Promise<void> {
    const randomNo = Math.floor(1000 + Math.random() * 9000);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    const replenishmentOrder: Order = {
      id: `ord_${Date.now()}_replenish`,
      orderNo: `SO-${dateStr}-${randomNo}(补)`,
      branchId: shorageItem.branchId,
      branchName: shorageItem.branchName,
      productCode: shorageItem.productCode,
      productName: shorageItem.productName,
      specs: shorageItem.specs,
      quantity: shorageItem.qtyShort,
      receivedQty: 0,
      status: 'pending_confirm', // starts as pending receptionist confirmation
      supplier: shorageItem.supplier || '通用厂商',
      createdAt: formatDateToMinute(new Date().toISOString())
    };

    await this.saveOrder(replenishmentOrder, operator);

    await this.log(
      operator.id,
      operator.name,
      operator.role,
      '一键补货',
      `针对欠货产品 [${shorageItem.productName}] 一键生成补货单 ${replenishmentOrder.orderNo}，数量：${shorageItem.qtyShort}件`
    );
    this.triggerChange();
  }

  // --- Inventory Management ---
  public static async getInventory(): Promise<InventoryItem[]> {
    if (this.cachedInventory !== null) {
      return this.cachedInventory;
    }
    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDocs(collection(db, 'inventory'));
        this.cachedInventory = snap.docs.map(doc => doc.data() as InventoryItem);
        return this.cachedInventory;
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, 'inventory');
      }
    }
    return getLocalData<InventoryItem[]>('db_inventory', SEED_INVENTORY);
  }

  public static async saveInventoryItem(item: InventoryItem, operator: { id: string; name: string; role: string }): Promise<void> {
    if (this.cachedInventory) {
      const index = this.cachedInventory.findIndex(i => i.id === item.id || i.productCode === item.productCode);
      if (index > -1) {
        this.cachedInventory[index] = { ...this.cachedInventory[index], ...item };
      } else {
        this.cachedInventory.push(item);
      }
    }

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'inventory', item.id), item);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `inventory/${item.id}`);
      }
    } else {
      const inv = getLocalData<InventoryItem[]>('db_inventory', SEED_INVENTORY);
      const index = inv.findIndex(i => i.id === item.id || i.productCode === item.productCode);
      if (index > -1) {
        inv[index] = { ...inv[index], ...item };
      } else {
        inv.push(item);
      }
      setLocalData('db_inventory', inv);
    }
    this.triggerChange();
  }

  public static async importInventory(items: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>[], operator: { id: string; name: string; role: string }): Promise<void> {
    const existing = await this.getInventory();
    
    // Process items
    for (const newItem of items) {
      const match = existing.find(e => e.productCode === newItem.productCode);
      if (match) {
        // Overwrite stock and supplier details
        match.currentStock = newItem.currentStock;
        match.safeStock = newItem.safeStock;
        match.productName = newItem.productName;
        match.specs = newItem.specs;
        match.supplier = newItem.supplier;
        match.updatedAt = new Date().toISOString();
        await this.saveInventoryItem(match, operator);
      } else {
        // Add new
        const createdItem: InventoryItem = {
          ...newItem,
          id: 'inv_' + Date.now() + Math.random().toString(36).substring(2, 6),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await this.saveInventoryItem(createdItem, operator);
      }
    }

    await this.log(
      operator.id,
      operator.name,
      operator.role,
      '导入库存',
      `成功批量导入/更新了 ${items.length} 笔库存数据`
    );
    this.triggerChange();
  }

  // Quick PO generation for stockout inventory
  public static async generateInventoryPurchaseOrders(items: { productCode: string; productName: string; specs: string; qtyToOrder: number; supplier: string }[], operator: { id: string; name: string; role: string }, poRemarks?: string): Promise<void> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    // Group items by supplier
    const groupedBySupplier: { [supplier: string]: typeof items } = {};
    for (const item of items) {
      const sup = item.supplier?.trim() || '通用厂商';
      if (!groupedBySupplier[sup]) {
        groupedBySupplier[sup] = [];
      }
      groupedBySupplier[sup].push(item);
    }

    const posCreated: string[] = [];

    for (const [supplier, subItems] of Object.entries(groupedBySupplier)) {
      const randomNo = Math.floor(1000 + Math.random() * 9000);
      const poNo = `PO-HQ-${dateStr}-${randomNo}`;
      const poId = `po_${Date.now()}_inv_${Math.random().toString(36).substring(2, 6)}`;
      const totalQuantity = subItems.reduce((sum, item) => sum + item.qtyToOrder, 0);

      // We need corresponding Order records in order to attach to PO and log arrivals!
      const orderIds: string[] = [];
      
      for (const [idx, item] of subItems.entries()) {
        const orderId = `ord_hq_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 4)}`;
        const orderNo = `SO-HQ-${dateStr}-${randomNo}`;
        
        const hqOrder: Order = {
          id: orderId,
          orderNo,
          branchId: 'hq_warehouse',
          branchName: '总部仓库',
          productCode: item.productCode,
          productName: item.productName,
          specs: item.specs,
          quantity: item.qtyToOrder,
          receivedQty: 0,
          status: 'purchased', // bypass receptionist and go straight to purchased!
          supplier: supplier,
          createdAt: formatDateToMinute(new Date().toISOString()),
          purchaseOrderId: poId
        };

        // Write individual Order
        await this.saveOrder(hqOrder, operator);
        orderIds.push(orderId);
      }

      const newPo: PurchaseOrder = {
        id: poId,
        poNo,
        supplier,
        orderDate: new Date().toISOString().slice(0, 10),
        status: 'pending_arrival',
        remarks: poRemarks || '总部备货库库存不足，自动生成采购补货单',
        orderIds,
        totalQuantity,
        factoryStatus: 'unconfirmed',
        createdAt: new Date().toISOString()
      };

      // Write PO
      if (isFirebaseConfigured && db) {
        try {
          await setDoc(doc(db, 'purchase_orders', poId), newPo);
        } catch (e) {
          handleFirestoreError(e, OperationType.CREATE, `purchase_orders/${poId}`);
        }
      } else {
        const pos = getLocalData<PurchaseOrder[]>('db_purchase_orders', []);
        pos.push(newPo);
        setLocalData('db_purchase_orders', pos);
      }

      posCreated.push(`${poNo} (${supplier}, 共 ${subItems.length} 项产品)`);
    }

    await this.log(
      operator.id,
      operator.name,
      operator.role,
      '库存缺货并案采购',
      `针对缺货产品快速生成了 ${posCreated.length} 份分店及总部采购单：${posCreated.join('; ')}`
    );
    this.triggerChange();
  }

  // --- Order Deletion with Perm Checks ---
  public static async deleteOrder(orderId: string, operator: { id: string; name: string; role: string }): Promise<void> {
    const orders = await this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      throw new Error('订单未找到');
    }

    const isAdminUser = operator.role === 'admin';
    const isOwnerBranch = operator.role === 'branch' && order.branchId === operator.id;
    const isReceptionist = operator.role === 'receptionist';

    if (!isAdminUser) {
      if (order.status === 'pending_purchase' || order.status === 'purchased' || order.status === 'completed') {
        throw new Error(`订单已进入采购流转或已被处理（当前状态：${
          order.status === 'pending_purchase' ? '待采购汇总' : order.status === 'purchased' ? '已采购/生产发货中' : '全部到齐已完成'
        }），禁止直接删除。非管理员如需撤回，请联系管理员执行强制删除，或由采购处理驳回。`);
      }

      if (order.status !== 'pending_confirm' && order.status !== 'rejected') {
        throw new Error('权限拦截：非管理员只有在“待前台确认”或“已被驳回”状态下才允许被删除。');
      }

      if (!isOwnerBranch && !isReceptionist) {
        throw new Error('权限不足：分店账户只能删除或重报本分店对应的待确认单。');
      }
    }

    if (isFirebaseConfigured && db) {
      try {
        await deleteDoc(doc(db, 'orders', orderId));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `orders/${orderId}`);
      }
    } else {
      const filtered = orders.filter(o => o.id !== orderId);
      setLocalData('db_orders', filtered);
    }

    if (isAdminUser) {
      await this.log(
        operator.id,
        operator.name,
        operator.role,
        '超级管理员强制删除订单',
        `系统管理员 [${operator.name}] (账号ID: ${operator.id}) 强制删除了订单: ${order.orderNo} (${order.productName})。商品编码: ${order.productCode}, 规格 specs: ${order.specs}, 分店ID: ${order.branchId}, 当前订单状态: ${order.status}。操作审计时间戳: ${new Date().toISOString()}`
      );
    } else {
      await this.log(
        operator.id,
        operator.name,
        operator.role,
        '删除订单',
        `操作人 [${operator.name}] 删除了订单: ${order.orderNo} (${order.productName})`
      );
    }
    this.triggerChange();
  }

  // --- Order Cancellation (Stored Separately) ---
  public static async cancelOrder(orderId: string, reason: string, operator: { id: string; name: string; role: string }): Promise<void> {
    const orders = await this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      throw new Error('订单未找到');
    }

    order.status = 'cancelled';
    order.cancelReason = reason;
    order.cancelledAt = new Date().toISOString();
    order.cancelledBy = operator.name;
    
    await this.saveOrder(order, operator);

    await this.log(
      operator.id,
      operator.name,
      operator.role,
      '取消订单',
      `操作人 [${operator.name}] 取消了该采购/分店关联订单: ${order.orderNo} (${order.productName})。商品编码: ${order.productCode}, 订单数量: ${order.quantity}, 取消备注: ${reason || '未备注'}`
    );
    this.triggerChange();
  }

  // --- Order Reject / Revert with Reason ---
  public static async rejectOrder(orderId: string, reason: string, targetStatus: 'pending_confirm' | 'pending_purchase' | 'rejected', operator: { id: string; name: string; role: string }): Promise<void> {
    const orders = await this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      throw new Error('订单未找到');
    }

    order.status = targetStatus;
    order.rejectReason = reason;

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'orders', orderId), order);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `orders/${orderId}`);
      }
    } else {
      const idx = orders.findIndex(o => o.id === orderId);
      if (idx > -1) {
        orders[idx] = order;
      }
      setLocalData('db_orders', orders);
    }

    await this.log(
      operator.id,
      operator.name,
      operator.role,
      '驳回退回订单',
      `操作人 [${operator.name}] 驳回退回了订单: ${order.orderNo}，目标状态：${targetStatus === 'rejected' ? '已退回分店' : targetStatus === 'pending_confirm' ? '待前台确认' : '待采购汇总'}，理由：${reason}`
    );
    this.triggerChange();
  }

  // --- Receptionist Confirming Order has No Shortages ('无欠确认') ---
  public static async confirmOrderNoOwedByReception(orderId: string, operator: { id: string; name: string; role: string }): Promise<void> {
    const orders = await this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      throw new Error('订单未找到');
    }
    order.isOwedConfirmedByReception = true;
    await this.saveOrder(order, operator);
    await this.log(
      operator.id,
      operator.name,
      operator.role,
      '前台确认无欠',
      `前台核对确认订单 ${order.orderNo} (${order.productName}) 已不拖欠分店货品（标记无欠）`
    );
    this.triggerChange();
  }

  // --- Split / Create Carry-over Sub-order for Shortage ('生成新订单补发') ---
  public static async createCarryOverOrder(orderId: string, operator: { id: string; name: string; role: string }): Promise<void> {
    const orders = await this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      throw new Error('订单未找到');
    }
    const shortageQty = order.quantity - (order.receivedQty || 0);
    if (shortageQty <= 0) {
      throw new Error('此订单不处于拖欠欠货状态，无需补发新单');
    }

    // Create a new order row for the shortage amount
    const newOrderNo = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
    const newOrder: Order = {
      id: 'o_' + Math.random().toString(36).substring(2, 9),
      orderNo: newOrderNo,
      branchId: order.branchId,
      branchName: order.branchName,
      productCode: order.productCode,
      productName: order.productName,
      specs: order.specs,
      quantity: shortageQty,
      receivedQty: 0,
      status: 'pending_purchase', // direct to purchasing so it's ready to be re-ordered
      supplier: order.supplier,
      orderType: order.orderType || 'conventional',
      remark: `【核增拆补发新单】源自未满足的前置欠货单：${order.orderNo}`,
      createdAt: new Date().toISOString(),
      merchandiserName: order.merchandiserName,
      isUrgent: order.isUrgent
    };

    // Update original order's quantity to equal receivedQty, so that the shortage is resolved
    order.quantity = order.receivedQty || 0;
    // original order also gets marked resolved/completed/updated
    if (order.quantity === 0) {
      order.status = 'cancelled';
      order.cancelReason = '由于缺货部分合并到新补单，原0实签单作废';
    } else {
      order.status = 'completed';
    }

    await this.saveOrder(order, operator);
    await this.saveOrder(newOrder, operator);

    await this.log(
      operator.id,
      operator.name,
      operator.role,
      '生成补发新单',
      `针对原拖欠订单 ${order.orderNo} 拆分生成的补发订单 ${newOrderNo} (数量: ${shortageQty}) 已成功录入待采购。原单拖欠部分已结转。`
    );
    this.triggerChange();
  }

  // --- Edit Order Details by Purchasing ---
  public static async editOrderDetails(orderId: string, updatedFields: Partial<Order>, operator: { id: string; name: string; role: string }): Promise<void> {
    const orders = await this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      throw new Error('订单未找到');
    }
    const oldQty = order.quantity;
    const oldSpecs = order.specs;

    Object.assign(order, updatedFields);
    await this.saveOrder(order, operator);

    await this.log(
      operator.id,
      operator.name,
      operator.role,
      '修改订单内容',
      `采购修改了订单 ${order.orderNo} (${order.productName})。原规格: ${oldSpecs} -> 新规格: ${order.specs}，原申购数: ${oldQty} -> 新数: ${order.quantity}`
    );
    this.triggerChange();
  }

  // --- Delete Doubtful Order by Purchasing (with shortages checks) ---
  public static async deleteOrderByPurchasing(orderId: string, operator: { id: string; name: string; role: string }): Promise<void> {
    const orders = await this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      throw new Error('订单未找到');
    }

    const shortageQty = order.quantity - (order.receivedQty || 0);
    const hasShortage = order.status === 'purchased' && shortageQty > 0;

    if (hasShortage && !order.isOwedConfirmedByReception) {
      throw new Error('权限拦截：该条明细目前仍有拖欠分店的数量。请先由【前台】在欠货表核对并点击“确认无欠”，或者先在一侧【生成补发新单】补位放行后，采购方可作废或直接删除。');
    }

    // Proceed to delete
    if (isFirebaseConfigured && db) {
      try {
        await deleteDoc(doc(db, 'orders', orderId));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `orders/${orderId}`);
      }
    } else {
      const filtered = orders.filter(o => o.id !== orderId);
      setLocalData('db_orders', filtered);
    }

    await this.log(
      operator.id,
      operator.name,
      operator.role,
      '采购删除疑问订单',
      `采购人员 [${operator.name}] 删除了有疑问的订单: ${order.orderNo} (${order.productName})。商品编码: ${order.productCode}, 数量: ${order.quantity}。原状态: ${order.status}。`
    );
    this.triggerChange();
  }

  // 申请删除 (Abnormal Delete Flow - Branch Initiates)
  public static async requestDeleteOrder(orderId: string, reason: string, operator: { id: string; name: string; role: string }): Promise<void> {
    const orders = await this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) throw new Error('订单未找到');
    order.status = 'pending_delete';
    order.deleteReason = reason;
    order.deleteStage = 'pending';
    await this.saveOrder(order, operator);
    await this.log(operator.id, operator.name, operator.role, '申请删除异常订单', `分店 [${operator.name}] 针对订单 [${order.orderNo}] 申请异常删除，原因：${reason}`);
    this.triggerChange();
  }

  // 前台初步确认
  public static async receptionConfirmDelete(orderId: string, operator: { id: string; name: string; role: string }): Promise<void> {
    const orders = await this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) throw new Error('订单未找到');
    order.deleteStage = 'reception_confirmed';
    await this.saveOrder(order, operator);
    await this.log(operator.id, operator.name, operator.role, '前台初审删除申请', `前台 [${operator.name}] 初步同意了订单 [${order.orderNo}] 的异常删除申请`);
    this.triggerChange();
  }

  // 采购最终审核通过
  public static async approveDeleteOrder(orderId: string, operator: { id: string; name: string; role: string }): Promise<void> {
    const orders = await this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) throw new Error('订单未找到');
    order.status = 'deleted_abnormal';
    await this.saveOrder(order, operator);
    await this.log(operator.id, operator.name, operator.role, '采购审核同意删除', `采购员 [${operator.name}] 最终批准了订单 [${order.orderNo}] 的异常删除申请，订单标记为【异常删除】`);
    this.triggerChange();
  }

  // 采购/前台驳回删除申请
  public static async rejectDeleteOrder(orderId: string, operator: { id: string; name: string; role: string }): Promise<void> {
    const orders = await this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) throw new Error('订单未找到');
    // Restore status based on delivery
    order.status = (order.receivedQty >= order.quantity) ? 'completed' : 'purchased';
    order.deleteStage = 'none';
    order.deleteReason = undefined;
    await this.saveOrder(order, operator);
    await this.log(operator.id, operator.name, operator.role, '驳回删除申请', `操作人 [${operator.name}] 驳回了订单 [${order.orderNo}] 的异常删除申请，订单状态恢复`);
    this.triggerChange();
  }

  // 分店确认删除
  public static async confirmBranchDelete(orderId: string, operator: { id: string; name: string; role: string }): Promise<void> {
    const orders = await this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) throw new Error('订单未找到');
    order.deletedConfirmedByBranch = true;
    await this.saveOrder(order, operator);
    await this.log(operator.id, operator.name, operator.role, '分店确认删除记录', `分店 [${operator.name}] 确认清空了异常删除订单 [${order.orderNo}] 的本地可见提示`);
    this.triggerChange();
  }

  // --- Products CRUD ---
  public static async getProducts(): Promise<Product[]> {
    if (this.cachedProducts !== null) {
      return this.cachedProducts;
    }
    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDocs(collection(db, 'products'));
        this.cachedProducts = snap.docs.map(doc => doc.data() as Product);
        return this.cachedProducts;
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, 'products');
      }
    }
    return getLocalData<Product[]>('db_products', SEED_PRODUCTS);
  }

  public static async saveProduct(product: Product, operator: { id: string; name: string; role: string }): Promise<void> {
    if (this.cachedProducts) {
      const idx = this.cachedProducts.findIndex(p => p.id === product.id);
      if (idx > -1) {
        this.cachedProducts[idx] = { ...this.cachedProducts[idx], ...product };
      } else {
        this.cachedProducts.push(product);
      }
    }

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'products', product.id), product);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `products/${product.id}`);
      }
    } else {
      const prods = getLocalData<Product[]>('db_products', SEED_PRODUCTS);
      const idx = prods.findIndex(p => p.id === product.id);
      if (idx > -1) {
        prods[idx] = { ...prods[idx], ...product };
      } else {
        prods.push(product);
      }
      setLocalData('db_products', prods);
    }
    this.triggerChange();
  }

  public static async deleteProduct(productId: string, productName: string, operator: { id: string; name: string; role: string }): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        await deleteDoc(doc(db, 'products', productId));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `products/${productId}`);
      }
    } else {
      const prods = getLocalData<Product[]>('db_products', SEED_PRODUCTS);
      const filtered = prods.filter(p => p.id !== productId);
      setLocalData('db_products', filtered);
    }
    await this.log(operator.id, operator.name, operator.role, '删除商品', `删除了商品：${productName}`);
    this.triggerChange();
  }

  public static async importProducts(items: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[], operator: { id: string; name: string; role: string }, overwrite: boolean): Promise<{ imported: number; updated: number; skipped: number }> {
    const existing = await this.getProducts();
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const newItem of items) {
      const match = existing.find(e => e.productCode.toLowerCase() === newItem.productCode.trim().toLowerCase());
      if (match) {
        if (overwrite) {
          match.productName = newItem.productName;
          match.specs = newItem.specs;
          match.unit = newItem.unit;
          match.defaultSupplier = newItem.defaultSupplier;
          match.isApproved = newItem.isApproved !== undefined ? newItem.isApproved : true;
          match.updatedAt = new Date().toISOString();
          await this.saveProduct(match, operator);
          updated++;
        } else {
          skipped++;
        }
      } else {
        const createdProduct: Product = {
          ...newItem,
          id: 'prod_' + Date.now() + Math.random().toString(36).substring(2, 6),
          isApproved: newItem.isApproved !== undefined ? newItem.isApproved : true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await this.saveProduct(createdProduct, operator);
        imported++;
      }
    }

    await this.log(
      operator.id,
      operator.name,
      operator.role,
      '导入商品库',
      `批量导入商品资料：新增 ${imported} 项，覆盖 ${updated} 项，跳过 ${skipped} 项`
    );
    this.triggerChange();
    return { imported, updated, skipped };
  }

  // --- Suppliers CRUD ---
  public static async getSuppliers(): Promise<Supplier[]> {
    if (this.cachedSuppliers !== null) {
      return this.cachedSuppliers;
    }
    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDocs(collection(db, 'suppliers'));
        this.cachedSuppliers = snap.docs.map(doc => doc.data() as Supplier);
        return this.cachedSuppliers;
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, 'suppliers');
      }
    }
    return getLocalData<Supplier[]>('db_suppliers', SEED_SUPPLIERS);
  }

  public static async saveSupplier(supplier: Supplier, operator: { id: string; name: string; role: string }): Promise<void> {
    if (this.cachedSuppliers) {
      const idx = this.cachedSuppliers.findIndex(s => s.id === supplier.id);
      if (idx > -1) {
        this.cachedSuppliers[idx] = { ...this.cachedSuppliers[idx], ...supplier };
      } else {
        this.cachedSuppliers.push(supplier);
      }
    }

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'suppliers', supplier.id), supplier);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `suppliers/${supplier.id}`);
      }
    } else {
      const sups = getLocalData<Supplier[]>('db_suppliers', SEED_SUPPLIERS);
      const idx = sups.findIndex(s => s.id === supplier.id);
      if (idx > -1) {
        sups[idx] = { ...sups[idx], ...supplier };
      } else {
        sups.push(supplier);
      }
      setLocalData('db_suppliers', sups);
    }
    this.triggerChange();
  }

  public static async deleteSupplier(supplierId: string, supplierName: string, operator: { id: string; name: string; role: string }): Promise<void> {
    if (this.cachedSuppliers) {
      this.cachedSuppliers = this.cachedSuppliers.filter(s => s.id !== supplierId);
    }

    if (isFirebaseConfigured && db) {
      try {
        await deleteDoc(doc(db, 'suppliers', supplierId));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `suppliers/${supplierId}`);
      }
    } else {
      const sups = getLocalData<Supplier[]>('db_suppliers', SEED_SUPPLIERS);
      const filtered = sups.filter(s => s.id !== supplierId);
      setLocalData('db_suppliers', filtered);
    }
    await this.log(operator.id, operator.name, operator.role, '删除供应商', `删除了供应商：${supplierName}`);
    this.triggerChange();
  }

  public static async importSuppliers(items: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>[], operator: { id: string; name: string; role: string }, overwrite: boolean): Promise<{ imported: number; updated: number; skipped: number }> {
    const existing = await this.getSuppliers();
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const newItem of items) {
      const match = existing.find(e => e.name.toLowerCase() === newItem.name.trim().toLowerCase());
      if (match) {
        if (overwrite) {
          match.contact = newItem.contact;
          match.phone = newItem.phone;
          match.updatedAt = new Date().toISOString();
          await this.saveSupplier(match, operator);
          updated++;
        } else {
          skipped++;
        }
      } else {
        const createdSupplier: Supplier = {
          ...newItem,
          id: 'sup_' + Date.now() + Math.random().toString(36).substring(2, 6),
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await this.saveSupplier(createdSupplier, operator);
        imported++;
      }
    }

    await this.log(
      operator.id,
      operator.name,
      operator.role,
      '导入供应商',
      `批量导入供应商资料：新增 ${imported} 项，覆盖 ${updated} 项，跳过 ${skipped} 项`
    );
    this.triggerChange();
    return { imported, updated, skipped };
  }

  public static async updateOrderRemark(
    orderId: string, 
    remark: string, 
    operator: { id: string; name: string; role: string }
  ): Promise<void> {
    const orders = await this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) throw new Error('未找到对应货项单据');

    const normalizedRemark = remark.trim();
    const hasDirectKeywords = ['直发', '厂家直发', '厂里直发', '工厂直发'].some(k => normalizedRemark.includes(k));

    if (hasDirectKeywords) {
      // Check inventory
      const invItems = await this.getInventory();
      const existingInv = invItems.find(inv => inv.productCode.trim() === order.productCode.trim());
      const currentStock = existingInv ? (existingInv.currentStock || 0) : 0;

      if (currentStock > 0 && order.orderType !== 'custom') {
        const errorMsg = `【有库存阻止厂家直发】常规产品 [${order.productName}] (编码: ${order.productCode}) 在总部系统内有备货库存（当前余量：${currentStock} 件），常规系统强制不允许厂家直发！请库内配送，或清除备注中的“直发”字样后重新保存。`;
        throw new Error(errorMsg);
      }

      // If it is custom, it requires Purchasing review
      if (order.orderType === 'custom') {
        if (!order.directDispatchApproved || order.directDispatchApproved === 'none') {
          order.directDispatchApproved = 'pending';
        }
      }
    } else {
      // If direct keywords were removed, we can clean up
      order.directDispatchApproved = undefined;
    }

    order.remark = normalizedRemark;
    order.remarkRole = operator.role as any;
    order.remarkOperatorName = operator.name;
    order.remarkUpdatedAt = new Date().toISOString();

    await this.saveOrder(order, operator);

    await this.log(
      operator.id,
      operator.name,
      operator.role,
      '更新订单备注',
      `修改了订单 [${order.orderNo}] 的行项备注，更新内容为：'${normalizedRemark}'`
    );

    this.triggerChange();
  }

  public static async auditDirectDispatch(
    orderId: string, 
    approved: boolean, 
    operator: { id: string; name: string; role: string }
  ): Promise<void> {
    const orders = await this.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) throw new Error('未找到对应货项单据');

    order.directDispatchApproved = approved ? 'approved' : 'rejected';
    
    await this.saveOrder(order, operator);

    await this.log(
      operator.id,
      operator.name,
      operator.role,
      approved ? '审核同意厂家直发' : '硬驳回并拒绝直发',
      `采购跟单员 [${operator.name}] 审核了特殊件 [${order.productName}] 的厂家直发：【${approved ? '同意厂家直发' : '拒绝：改库房派送'}】`
    );

    this.triggerChange();
  }

  public static async updateOrderPrices(
    orderId: string,
    previousPrice: number,
    currentPrice: number,
    operator: { id: string; name: string; role: string }
  ): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        const orderRef = doc(db, 'orders', orderId);
        await updateDoc(orderRef, { previousPrice, currentPrice });
      } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, `orders/${orderId}`);
      }
    } else {
      const orders = getLocalData<Order[]>('db_orders', []);
      const idx = orders.findIndex(o => o.id === orderId);
      if (idx > -1) {
        orders[idx].previousPrice = previousPrice;
        orders[idx].currentPrice = currentPrice;
        setLocalData('db_orders', orders);
      }
    }

    await this.log(
      operator.id,
      operator.name,
      operator.role,
      '更新货品价格数据',
      `采购员更新了货项编号订单ID [${orderId}] 的价格体系：上次价格 ¥${previousPrice} -> 本次价格 ¥${currentPrice}`
    );

    this.triggerChange();
  }

  public static async getSalesRecords(): Promise<SalesRecord[]> {
    if (this.cachedSalesRecords) {
      return this.cachedSalesRecords;
    }
    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDocs(collection(db, 'sales_records'));
        const list = snap.docs.map(d => d.data() as SalesRecord);
        this.cachedSalesRecords = list;
        return list;
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, 'sales_records');
      }
    }
    return getLocalData<SalesRecord[]>('db_sales_records', []);
  }

  public static async calculateSalesReference(
    productCode: string,
    currentDateStr: string, // e.g. '2026-06'
    branchName?: string // Optional filter
  ): Promise<{ avg3Months: number; lastYearSameMonth: number }> {
    const records = await this.getSalesRecords();
    
    // Filter records for the correct product and optional branch
    const filtered = records.filter(r => {
      const codeMatch = r.productCode === productCode;
      if (!codeMatch) return false;
      if (branchName) {
        return r.branchName === branchName;
      }
      return true;
    });

    if (filtered.length === 0) {
      return { avg3Months: 0, lastYearSameMonth: 0 };
    }

    // Parse target date (e.g. '2026-06')
    const parts = currentDateStr.split('-');
    const currentYear = parseInt(parts[0], 10);
    const currentMonth = parseInt(parts[1], 10);

    // Calculate last year same month (e.g. '2025-06')
    const lastYearStr = `${currentYear - 1}-${String(currentMonth).padStart(2, '0')}`;
    const lastYearSameMonthRecords = filtered.filter(r => r.month === lastYearStr);
    const lastYearSameMonth = lastYearSameMonthRecords.reduce((sum, r) => sum + r.quantity, 0);

    // Calculate last 3 months
    const last3MonthsStrings: string[] = [];
    for (let i = 1; i <= 3; i++) {
      let m = currentMonth - i;
      let y = currentYear;
      if (m <= 0) {
        m += 12;
        y -= 1;
      }
      last3MonthsStrings.push(`${y}-${String(m).padStart(2, '0')}`);
    }

    const last3MonthsRecords = filtered.filter(r => last3MonthsStrings.includes(r.month));
    const total3MonthsQty = last3MonthsRecords.reduce((sum, r) => sum + r.quantity, 0);
    const avg3Months = Math.round((total3MonthsQty / 3) * 10) / 10;

    return { avg3Months, lastYearSameMonth };
  }

  public static async saveSalesRecords(records: SalesRecord[], operator: { id: string; name: string; role: string }): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        for (const item of records) {
          await setDoc(doc(db, 'sales_records', item.id), item);
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, 'sales_records');
      }
    } else {
      const current = getLocalData<SalesRecord[]>('db_sales_records', []);
      const updated = [...current];
      for (const item of records) {
        const idx = updated.findIndex(r => r.id === item.id);
        if (idx > -1) {
          updated[idx] = item;
        } else {
          updated.push(item);
        }
      }
      setLocalData('db_sales_records', updated);
    }

    if (this.cachedSalesRecords) {
      this.cachedSalesRecords = null; // force reload
    }

    await this.log(
      operator.id,
      operator.name,
      operator.role,
      '导入分店销售数据',
      `成功批量导入/上传了共 ${records.length} 条分店往期销售业绩数据`
    );

    this.triggerChange();
  }

  public static async deleteSalesRecord(id: string, operator: { id: string; name: string; role: string }): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        await deleteDoc(doc(db, 'sales_records', id));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `sales_records/${id}`);
      }
    } else {
      const current = getLocalData<SalesRecord[]>('db_sales_records', []);
      const updated = current.filter(r => r.id !== id);
      setLocalData('db_sales_records', updated);
    }

    if (this.cachedSalesRecords) {
      this.cachedSalesRecords = null; // force reload
    }

    await this.log(
      operator.id,
      operator.name,
      operator.role,
      '删除单条销售数据',
      `成功删除了单条分店销售业绩记录 (ID: ${id})`
    );

    this.triggerChange();
  }

  public static async updateSalesRecord(record: SalesRecord, operator: { id: string; name: string; role: string }): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'sales_records', record.id), record);
      } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, `sales_records/${record.id}`);
      }
    } else {
      const current = getLocalData<SalesRecord[]>('db_sales_records', []);
      const updated = current.map(r => r.id === record.id ? record : r);
      setLocalData('db_sales_records', updated);
    }

    if (this.cachedSalesRecords) {
      this.cachedSalesRecords = null; // force reload
    }

    await this.log(
      operator.id,
      operator.name,
      operator.role,
      '修改分店销售数据',
      `成功修改了销售业绩记录: [${record.branchName}] ${record.productName} 在 ${record.month} 销量为 ${record.quantity}件`
    );

    this.triggerChange();
  }

  public static async deleteSalesRecordsByFilter(
    filter: { month?: string; branchName?: string; productCode?: string }, 
    operator: { id: string; name: string; role: string }
  ): Promise<number> {
    let deletedCount = 0;
    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDocs(collection(db, 'sales_records'));
        for (const d of snap.docs) {
          const item = d.data() as SalesRecord;
          let match = true;
          if (filter.month && item.month !== filter.month) match = false;
          if (filter.branchName && item.branchName !== filter.branchName) match = false;
          if (filter.productCode && item.productCode !== filter.productCode) match = false;
          if (match) {
            await deleteDoc(doc(db, 'sales_records', item.id));
            deletedCount++;
          }
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, 'sales_records_by_filter');
      }
    } else {
      const current = getLocalData<SalesRecord[]>('db_sales_records', []);
      const filtered = current.filter(item => {
        let match = true;
        if (filter.month && item.month !== filter.month) match = false;
        if (filter.branchName && item.branchName !== filter.branchName) match = false;
        if (filter.productCode && item.productCode !== filter.productCode) match = false;
        if (match) {
          deletedCount++;
          return false; // delete it
        }
        return true; // keep it
      });
      setLocalData('db_sales_records', filtered);
    }

    if (this.cachedSalesRecords) {
      this.cachedSalesRecords = null; // force reload
    }

    let logMsg = '按条件选择性删除销售数据';
    let logDetail = '删除了符合条件的销售记录。';
    const parts: string[] = [];
    if (filter.month) parts.push(`月份: ${filter.month}`);
    if (filter.branchName) parts.push(`分店: ${filter.branchName}`);
    if (filter.productCode) parts.push(`商品编码: ${filter.productCode}`);
    if (parts.length > 0) {
      logDetail = `清除了符合条件 [${parts.join(', ')}] 的销售记录共 ${deletedCount} 条`;
    } else {
      logDetail = `清除了全部销售记录共 ${deletedCount} 条`;
    }

    await this.log(
      operator.id,
      operator.name,
      operator.role,
      logMsg,
      logDetail
    );

    this.triggerChange();
    return deletedCount;
  }

  public static async clearAllSalesRecords(operator: { id: string; name: string; role: string }): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDocs(collection(db, 'sales_records'));
        for (const d of snap.docs) {
          await deleteDoc(doc(db, 'sales_records', d.id));
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, 'sales_records_all');
      }
    } else {
      setLocalData('db_sales_records', []);
    }

    if (this.cachedSalesRecords) {
      this.cachedSalesRecords = null; // force reload
    }

    await this.log(
      operator.id,
      operator.name,
      operator.role,
      '清空所有分店销售数据',
      '管理员执行了清空全部历史销售记录的操作，准备开始录入实际业务数据。'
    );

    this.triggerChange();
  }

  public static async getBranchStocks(): Promise<BranchStock[]> {
    if (this.cachedBranchStocks) {
      return this.cachedBranchStocks;
    }
    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDocs(collection(db, 'branch_stocks'));
        const list = snap.docs.map(d => d.data() as BranchStock);
        this.cachedBranchStocks = list;
        return list;
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, 'branch_stocks');
      }
    }
    return getLocalData<BranchStock[]>('db_branch_stocks', []);
  }

  public static async saveBranchStocks(stocks: BranchStock[], operator: { id: string; name: string; role: string }): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        for (const item of stocks) {
          await setDoc(doc(db, 'branch_stocks', item.id), item);
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, 'branch_stocks');
      }
    } else {
      const current = getLocalData<BranchStock[]>('db_branch_stocks', []);
      const updated = [...current];
      for (const item of stocks) {
        const idx = updated.findIndex(s => s.id === item.id || (s.branchName === item.branchName && s.productCode === item.productCode));
        if (idx > -1) {
          updated[idx] = { ...updated[idx], ...item };
        } else {
          updated.push(item);
        }
      }
      setLocalData('db_branch_stocks', updated);
    }

    if (this.cachedBranchStocks) {
      this.cachedBranchStocks = null; // force reload
    }

    await this.log(
      operator.id,
      operator.name,
      operator.role,
      '导入分店参考库存数据',
      `成功批量导入/上传了共 ${stocks.length} 条分店在库现存量参考数据`
    );

    this.triggerChange();
  }

  // --- Independent Purchase Orders ---
  public static async getIndependentPurchaseOrders(): Promise<IndependentPurchaseOrder[]> {
    if (this.cachedIndependentPurchaseOrders !== null) {
      return this.cachedIndependentPurchaseOrders;
    }
    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDocs(collection(db, 'independent_purchase_orders'));
        this.cachedIndependentPurchaseOrders = snap.docs.map(doc => doc.data() as IndependentPurchaseOrder);
        return this.cachedIndependentPurchaseOrders;
      } catch (e) {
        handleFirestoreError(e, OperationType.LIST, 'independent_purchase_orders');
      }
    }
    return getLocalData<IndependentPurchaseOrder[]>('db_independent_purchase_orders', []);
  }

  public static async saveIndependentPurchaseOrder(po: IndependentPurchaseOrder, operator: { id: string; name: string; role: string }): Promise<void> {
    if (this.cachedIndependentPurchaseOrders) {
      const idx = this.cachedIndependentPurchaseOrders.findIndex(p => p.id === po.id);
      if (idx > -1) {
        this.cachedIndependentPurchaseOrders[idx] = po;
      } else {
        this.cachedIndependentPurchaseOrders.push(po);
      }
    }

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'independent_purchase_orders', po.id), po);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `independent_purchase_orders/${po.id}`);
      }
    } else {
      const pos = getLocalData<IndependentPurchaseOrder[]>('db_independent_purchase_orders', []);
      const idx = pos.findIndex(p => p.id === po.id);
      if (idx > -1) {
        pos[idx] = po;
      } else {
        pos.push(po);
      }
      setLocalData('db_independent_purchase_orders', pos);
    }
    this.triggerChange();
  }
}
