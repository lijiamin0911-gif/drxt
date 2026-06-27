import { User, Order, PurchaseOrder, Arrival, SystemConfig, OperationLog, Role, InventoryItem, Product, Supplier, SalesRecord, BranchStock, IndependentPurchaseOrder, IndependentPurchaseOrderItem } from '../types';

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

export class DbService {
  private static listeners: (() => void)[] = [];
  private static lastServerModified = 0;
  private static pollInterval: any = null;
  private static cachedData: Record<string, any> = {};

  public static onChange(callback: () => void) {
    this.listeners.push(callback);
    if (!this.pollInterval) {
      this.startPolling();
    }
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
      if (this.listeners.length === 0 && this.pollInterval) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
      }
    };
  }

  private static triggerChange() {
    this.listeners.forEach(cb => cb());
  }

  private static startPolling() {
    this.pollInterval = setInterval(() => {
      this.checkServerUpdates();
    }, 3000);
  }

  private static async checkServerUpdates() {
    try {
      const res = await fetch('/api/db/version');
      if (res.ok) {
        const data = await res.json();
        if (data.lastModified !== this.lastServerModified) {
          this.lastServerModified = data.lastModified;
          this.cachedData = {}; // Clear caches
          this.triggerChange();
        }
      }
    } catch (e) {
      console.warn('Sync failed with server:', e);
    }
  }

  private static async callServer(method: string, args: any[], retries = 5, delay = 800): Promise<any> {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ method, args })
        });
        if (!res.ok) {
          try {
            const err = await res.json();
            throw new Error(err.error || err.message || 'API request failed');
          } catch {
            throw new Error(`API returned status ${res.status}`);
          }
        }
        const result = await res.json();
        
        // Only invalidate cache and trigger changes for mutation (write) operations
        const isMutation = !method.startsWith('get') && !method.startsWith('calculate') && method !== 'initialize';
        if (isMutation) {
          this.cachedData = {};
          this.triggerChange();
        }
        return result;
      } catch (e) {
        if (i === retries - 1) {
          throw e; // throw on the last attempt
        }
        console.warn(`API callServer failed (${method}), retrying in ${delay}ms...`, e);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5; // Backoff
      }
    }
  }

  private static async getWithCache(method: string, args: any[]): Promise<any> {
    const cacheKey = method + JSON.stringify(args);
    if (this.cachedData[cacheKey] !== undefined) {
      return this.cachedData[cacheKey];
    }
    const val = await this.callServer(method, args);
    this.cachedData[cacheKey] = val;
    return val;
  }

  // --- START OF REFLECTED API ---
  public static async initialize() {
    await this.callServer('initialize', []);
    this.checkServerUpdates();
  }

  public static async log(userId: string, username: string, role: string, action: string, details: string) {
    return this.callServer('log', [userId, username, role, action, details]);
  }

  public static async getLogs(): Promise<OperationLog[]> {
    return this.getWithCache('getLogs', []);
  }

  public static async getConfig(): Promise<SystemConfig> {
    return this.getWithCache('getConfig', []);
  }

  public static async updateConfig(threshold: number, operatorName: string): Promise<SystemConfig> {
    return this.callServer('updateConfig', [threshold, operatorName]);
  }

  public static async getUsers(): Promise<User[]> {
    return this.getWithCache('getUsers', []);
  }

  public static async saveUser(user: User, operator: any): Promise<void> {
    return this.callServer('saveUser', [user, operator]);
  }

  public static async deleteUser(userId: string, username: string, operator: any): Promise<void> {
    return this.callServer('deleteUser', [userId, username, operator]);
  }

  public static async importUsers(items: any[], operator: any, overwrite: boolean): Promise<any> {
    return this.callServer('importUsers', [items, operator, overwrite]);
  }

  public static async clearCollections(collections: string[], operator: any, filter?: { branchName?: string; purchaserName?: string; receptionistName?: string }): Promise<void> {
    return this.callServer('clearCollections', [collections, operator, filter]);
  }

  public static async getOrders(): Promise<Order[]> {
    return this.getWithCache('getOrders', []);
  }

  public static async saveOrder(order: Order, operator: any): Promise<void> {
    return this.callServer('saveOrder', [order, operator]);
  }

  public static async submitOrder(branchId: string, branchName: string, items: any[], submissionDate?: string): Promise<void> {
    return this.callServer('submitOrder', [branchId, branchName, items, submissionDate]);
  }

  public static async batchConfirmOrders(orderIds: string[], operator: any): Promise<void> {
    return this.callServer('batchConfirmOrders', [orderIds, operator]);
  }

  public static async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    return this.getWithCache('getPurchaseOrders', []);
  }

  public static async generatePurchaseOrders(orderIds: string[], operator: any, poRemarks: string): Promise<void> {
    return this.callServer('generatePurchaseOrders', [orderIds, operator, poRemarks]);
  }

  public static async createDirectPurchaseOrder(supplier: string, orderDate: string, remarks: string, items: any[], operator: any): Promise<void> {
    return this.callServer('createDirectPurchaseOrder', [supplier, orderDate, remarks, items, operator]);
  }

  public static async submitPoToFactory(poId: string, factoryStatus: any, expectedArrival: string, operator: any): Promise<void> {
    return this.callServer('submitPoToFactory', [poId, factoryStatus, expectedArrival, operator]);
  }

  public static async getArrivals(): Promise<Arrival[]> {
    return this.getWithCache('getArrivals', []);
  }

  public static async logArrival(poId: string, itemArrivals: any[], operator: any): Promise<void> {
    return this.callServer('logArrival', [poId, itemArrivals, operator]);
  }

  public static async replenishShortage(item: any, operator: any): Promise<void> {
    return this.callServer('replenishShortage', [item, operator]);
  }

  public static async getInventory(): Promise<InventoryItem[]> {
    return this.getWithCache('getInventory', []);
  }

  public static async saveInventoryItem(item: InventoryItem, operator: any): Promise<void> {
    return this.callServer('saveInventoryItem', [item, operator]);
  }

  public static async importInventory(items: any[], operator: any): Promise<void> {
    return this.callServer('importInventory', [items, operator]);
  }

  public static async generateInventoryPurchaseOrders(items: any[], operator: any, poRemarks?: string): Promise<void> {
    return this.callServer('generateInventoryPurchaseOrders', [items, operator, poRemarks]);
  }

  public static async deleteOrder(orderId: string, operator: any): Promise<void> {
    return this.callServer('deleteOrder', [orderId, operator]);
  }

  public static async cancelOrder(orderId: string, reason: string, operator: any): Promise<void> {
    return this.callServer('cancelOrder', [orderId, reason, operator]);
  }

  public static async rejectOrder(orderId: string, reason: string, targetStatus: any, operator: any): Promise<void> {
    return this.callServer('rejectOrder', [orderId, reason, targetStatus, operator]);
  }

  public static async confirmOrderNoOwedByReception(orderId: string, operator: any): Promise<void> {
    return this.callServer('confirmOrderNoOwedByReception', [orderId, operator]);
  }

  public static async createCarryOverOrder(orderId: string, operator: any): Promise<void> {
    return this.callServer('createCarryOverOrder', [orderId, operator]);
  }

  public static async editOrderDetails(orderId: string, updatedFields: any, operator: any): Promise<void> {
    return this.callServer('editOrderDetails', [orderId, updatedFields, operator]);
  }

  public static async deleteOrderByPurchasing(orderId: string, operator: any): Promise<void> {
    return this.callServer('deleteOrderByPurchasing', [orderId, operator]);
  }

  public static async requestDeleteOrder(orderId: string, reason: string, operator: any): Promise<void> {
    return this.callServer('requestDeleteOrder', [orderId, reason, operator]);
  }

  public static async receptionConfirmDelete(orderId: string, operator: any): Promise<void> {
    return this.callServer('receptionConfirmDelete', [orderId, operator]);
  }

  public static async approveDeleteOrder(orderId: string, operator: any): Promise<void> {
    return this.callServer('approveDeleteOrder', [orderId, operator]);
  }

  public static async rejectDeleteOrder(orderId: string, operator: any): Promise<void> {
    return this.callServer('rejectDeleteOrder', [orderId, operator]);
  }

  public static async confirmBranchDelete(orderId: string, operator: any): Promise<void> {
    return this.callServer('confirmBranchDelete', [orderId, operator]);
  }

  public static async getProducts(): Promise<Product[]> {
    return this.getWithCache('getProducts', []);
  }

  public static async saveProduct(product: Product, operator: any): Promise<void> {
    return this.callServer('saveProduct', [product, operator]);
  }

  public static async deleteProduct(productId: string, productName: string, operator: any): Promise<void> {
    return this.callServer('deleteProduct', [productId, productName, operator]);
  }

  public static async importProducts(items: any[], operator: any, overwrite: boolean): Promise<any> {
    return this.callServer('importProducts', [items, operator, overwrite]);
  }

  public static async getSuppliers(): Promise<Supplier[]> {
    return this.getWithCache('getSuppliers', []);
  }

  public static async saveSupplier(supplier: Supplier, operator: any): Promise<void> {
    return this.callServer('saveSupplier', [supplier, operator]);
  }

  public static async deleteSupplier(supplierId: string, supplierName: string, operator: any): Promise<void> {
    return this.callServer('deleteSupplier', [supplierId, supplierName, operator]);
  }

  public static async importSuppliers(items: any[], operator: any, overwrite: boolean): Promise<any> {
    return this.callServer('importSuppliers', [items, operator, overwrite]);
  }

  public static async updateOrderRemark(
    orderId: string,
    remark: string,
    operator: any
  ): Promise<void> {
    return this.callServer('updateOrderRemark', [orderId, remark, operator]);
  }

  public static async auditDirectDispatch(orderId: string, approved: boolean, operator: any): Promise<void> {
    return this.callServer('auditDirectDispatch', [orderId, approved, operator]);
  }

  public static async updateOrderPrices(orderId: string, prevPrice: number, currPrice: number, operator: any): Promise<void> {
    return this.callServer('updateOrderPrices', [orderId, prevPrice, currPrice, operator]);
  }

  public static async getSalesRecords(): Promise<SalesRecord[]> {
    return this.getWithCache('getSalesRecords', []);
  }

  public static async calculateSalesReference(productCode: string, targetMonth: string, branchName?: string): Promise<any> {
    return this.callServer('calculateSalesReference', [productCode, targetMonth, branchName]);
  }

  public static async saveSalesRecords(records: SalesRecord[], operator: any): Promise<void> {
    return this.callServer('saveSalesRecords', [records, operator]);
  }

  public static async getBranchStocks(): Promise<BranchStock[]> {
    return this.getWithCache('getBranchStocks', []);
  }

  public static async saveBranchStocks(stocks: BranchStock[], operator: any): Promise<void> {
    return this.callServer('saveBranchStocks', [stocks, operator]);
  }

  public static async getIndependentPurchaseOrders(): Promise<IndependentPurchaseOrder[]> {
    return this.getWithCache('getIndependentPurchaseOrders', []);
  }

  public static async saveIndependentPurchaseOrder(po: IndependentPurchaseOrder, operator: any): Promise<void> {
    return this.callServer('saveIndependentPurchaseOrder', [po, operator]);
  }

  public static async deletePurchaseOrder(poId: string, deleteBranchOrders: boolean, operator: any): Promise<void> {
    return this.callServer('deletePurchaseOrder', [poId, deleteBranchOrders, operator]);
  }
}
