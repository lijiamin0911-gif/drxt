export type Role = 'admin' | 'branch' | 'receptionist' | 'purchasing';

export interface User {
  id: string;
  username: string; // unique
  role: Role;
  branchName?: string; // only for 'branch' role
  isActive: boolean;
  pin: string;
  createdAt: string;
  sessionToken?: string;
  isViceAdmin?: boolean; // 是否为副管理员
  branchSalesEnabled?: boolean; // 分店端是否具备查看本店销售数据权限
  branchStockEnabled?: boolean; // 分店端是否具备导入及参考库存权限
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
  receivedQty: number; // For shortage calculation: quantity - receivedQty = shortage (欠货)
  status: 'pending_confirm' | 'pending_purchase' | 'purchased' | 'completed' | 'rejected' | 'pending_delete' | 'deleted_abnormal' | 'cancelled';
  supplier: string; // default supplier
  purchaseOrderId?: string; // linked PO
  createdAt: string;
  confirmedAt?: string;
  previousPrice?: number; // 上次价格
  currentPrice?: number;  // 本次价格
  orderType?: 'conventional' | 'custom'; // convencional or custom (常规/新品非常规)
  remark?: string; // forced remark for custom novelty items
  remarkRole?: 'branch' | 'receptionist' | 'purchasing' | 'admin';
  remarkOperatorName?: string;
  remarkUpdatedAt?: string;
  directDispatchApproved?: 'pending' | 'approved' | 'rejected' | 'none';
  rejectReason?: string;
  deleteReason?: string;
  cancelReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  deleteStage?: 'none' | 'pending' | 'reception_confirmed';
  deletedConfirmedByBranch?: boolean;
  merchandiserName?: string; // 所属采购跟单员
  leadTimeText?: string;     // 关联交期交期说明
  isUrgent?: boolean;        // 是否加急
  closeState?: 'none' | 'pending_close_confirm' | 'closed_completed' | 'closed_cancelled'; // 是否给齐或者不要协同确认
  closeInitiator?: 'branch' | 'receptionist'; // 结单/物理取消发起方
  closeReason?: string;      // 结单/取消原因
  factoryCheckStatus?: 'none' | 'pending_confirm' | 'has_backlog' | 'no_backlog'; // 前台提采购核查厂里缺货
  factoryCheckRemark?: string;
  factoryCheckedBy?: string;
}

export interface Product {
  id: string;
  productCode: string;
  productName: string;
  specs: string;
  unit: string;
  defaultSupplier: string;
  isApproved: boolean; // false = unreviewed novelty商品, true = approved standard商品
  createdAt: string;
  updatedAt: string;
  isPermanentlyCancelled?: boolean; // 是否处于永久取消自动补货状态
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
  merchandiserName?: string; // 所属采购跟单 (例如: 采购、李跟单、王采购)
  leadTimeText?: string;      // 供应意向交期描述 (例如: "3-5天", "10天", "供货不稳定")
}

export interface PurchaseOrder {
  id: string;
  poNo: string;
  supplier: string;
  orderDate: string;
  status: 'pending_arrival' | 'completed';
  remarks: string;
  orderIds: string[]; // references Order.id
  totalQuantity: number;
  factoryStatus: 'unconfirmed' | 'confirmed';
  expectedArrivalDate?: string;
  createdAt: string;
}

export interface IndependentPurchaseOrderItem {
  productCode: string;
  productName: string;
  specs: string;
  quantity: number;
  supplier: string;
  remark?: string;
  receivedQty: number; // 实际到货数量
  isNew?: boolean; // 是否处于未审核的新品标记状态
}

export interface IndependentPurchaseOrder {
  id: string;
  poNo: string;
  orderDate: string;
  status: 'pending_arrival' | 'completed'; // “已提交给厂家” (即 pending_arrival) 或 “已到货” / 部分到货 (Completed)
  remarks: string;
  items: IndependentPurchaseOrderItem[];
  factoryStatus: 'unconfirmed' | 'confirmed';
  expectedArrivalDate?: string;
  createdAt: string;
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
  shortageThreshold: number; // e.g. warn when count is >= threshold
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

export interface InventoryItem {
  id: string;
  productCode: string;
  productName: string;
  specs: string;
  currentStock: number;
  safeStock: number;
  supplier: string;
  createdAt: string;
  updatedAt: string;
  isPermanentlyCancelled?: boolean; // Whether auto-replenishment calculation is permanently cancelled
  permanentCancelReason?: string;
  permanentCancelAt?: string;
}

export interface SalesRecord {
  id: string;
  branchName: string;
  supplierName: string;
  productCode: string;
  productName: string;
  specs: string;
  quantity: number;
  month: string; // e.g. '2026-05'
  importedAt: string;
}

export interface BranchStock {
  id: string;
  branchName: string;
  productCode: string;
  productName: string;
  specs: string;
  currentStock: number;
  updatedAt: string;
}


