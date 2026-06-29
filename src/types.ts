/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Role = 'admin' | 'boss' | 'region_manager' | 'branch' | 'receptionist' | 'purchasing' | 'data_admin';

export interface User {
  id?: string;
  username: string;
  role: Role;
  region?: string; // e.g. "华北", "华中", "华东", "华南", or "" for admin/boss (optional)
  password?: string;
  pin?: string;
  isActive?: boolean;
  branchName?: string;
  createdAt?: string;
  
  // Advanced features fields
  isViceAdmin?: boolean;
  branchSalesEnabled?: boolean;
  branchStockEnabled?: boolean;
}

export interface Transaction {
  id?: string;
  date: string;       // YYYY-MM-DD
  store: string;      // e.g. "黄石店", "北京店"
  category: string;   // e.g. "灯具", "电子产品"
  code: string;       // Product code
  name: string;       // Product name
  spec: string;       // Spec / model
  qty: number;        // Quantity sold
  price: number;      // Unit price
  amount: number;     // Total sales amount
  profit: number;     // Profit amount
  sale_type: 'store_to_customer' | 'head_to_store';
  supplier: string;   // e.g. "光源照明" (for head_to_store)
}

export interface InventoryItem {
  id?: string;
  store?: string;      // 分店 (for transaction-based inventory structure)
  name?: string;       // 产品名称
  spec?: string;       // 规格型号
  category?: string;   // 类别
  stock?: number;      // 库存数量
  price?: number;      // 单价 / 成本价
  
  // Custom database-driven inventory fields
  productCode?: string;
  productName?: string;
  specs?: string;
  currentStock?: number;
  safeStock?: number;
  supplier?: string;
  updatedAt?: string;
  createdAt?: string;

  // Management operations fields
  isPermanentlyCancelled?: boolean;
  permanentCancelReason?: string;
  permanentCancelAt?: string;
}

export type SummaryDimension = 'product_name' | 'category' | 'spec_model';
export type InventorySummaryDimension = 'product_details' | 'by_store' | 'by_category';

export interface RegionMapping {
  region: string;
  store: string;
}

export interface Order {
  id: string;
  orderNo: string;
  branchId: string;
  branchName: string;
  productCode: string;
  productName: string;
  specs: string;
  quantity: number;
  receivedQty: number;
  status: string; // 'pending_confirm' | 'pending_purchase' | 'purchased' | 'completed' | 'cancelled' | 'rejected'
  supplier: string;
  orderType?: 'conventional' | 'custom';
  remark?: string;
  remarkRole?: string;
  remarkOperatorName?: string;
  remarkUpdatedAt?: string;
  directDispatchApproved?: 'pending' | 'approved' | 'rejected' | 'none';
  createdAt: string;
  merchandiserName?: string;
  leadTimeText?: string;
  isUrgent?: boolean;
  rejectReason?: string;
  cancelReason?: string;
  factoryStatus?: string;
  expectedArrivalDate?: string;

  // Extended status tracing fields
  deleteReason?: string;
  deleteStage?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  previousPrice?: number;
  currentPrice?: number;
  confirmedAt?: string;
  purchaseOrderId?: string;
  deletedConfirmedByBranch?: boolean;
  closeState?: string;
  closeInitiator?: string;
  closeReason?: string;
  isOwedConfirmedByReception?: boolean;
}

export interface PurchaseOrder {
  id: string;
  poNo: string;
  supplier: string;
  orderDate: string;
  status: string;
  remarks?: string;
  orderIds: string[];
  totalQuantity: number;
  factoryStatus?: 'unconfirmed' | 'confirmed';
  createdAt: string;
  expectedArrivalDate?: string;
}

export interface Arrival {
  id: string;
  poId: string;
  poNo: string;
  orderId: string;
  receivedQty: number;
  arrivalDate: string;
  operator: string;
}

export interface SystemConfig {
  id: string;
  shortageThreshold: number;
  updatedAt: string;
  updatedBy: string;
}

export interface OperationLog {
  id: string;
  userId: string;
  username: string;
  role: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface Product {
  id: string;
  productCode: string;
  productName: string;
  specs: string;
  unit: string;
  defaultSupplier: string;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;

  costPrice?: number;
  sellingPrice?: number;

  // Management operations fields
  isPermanentlyCancelled?: boolean;
  permanentCancelReason?: string;
  permanentCancelAt?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  merchandiserName?: string;
  leadTimeText?: string;
}

export interface SalesRecord {
  id: string;
  month: string; // YYYY-MM
  branchName: string;
  productCode: string;
  productName: string;
  quantity: number;
  amount: number;
}

export interface BranchStock {
  id: string;
  branchName: string;
  productCode: string;
  productName: string;
  specs: string;
  stock: number;
  updatedAt?: string;
}

export interface IndependentPurchaseOrderItem {
  productCode: string;
  productName: string;
  specs: string;
  quantity: number;
  supplier: string;
  remark?: string;
  receivedQty: number;
  isNew: boolean;
  notes?: string;
}

export interface IndependentPurchaseOrder {
  id: string;
  poNo: string;
  orderDate: string;
  status: string;
  remarks?: string;
  items: IndependentPurchaseOrderItem[];
  factoryStatus?: 'unconfirmed' | 'confirmed';
  createdAt: string;
  expectedArrivalDate?: string;
}
