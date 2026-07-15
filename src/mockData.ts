/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Transaction, InventoryItem, User } from './types';

export const DEFAULT_USERS: User[] = [];

export const DEFAULT_REGION_STORE_MAP: Record<string, string[]> = {
  '总部': ['总部总仓'],
  '华中': ['黄石店', '武汉店', '长沙店'],
  '华北': ['北京店', '天津店'],
  '华东': ['上海店', '南京店', '杭州店'],
  '华南': ['广州店', '深圳店']
};

export const DEFAULT_TRANSACTIONS: Transaction[] = [
  // === 分店→客户零售数据（sale_type: 'store_to_customer'） ===
  { date: '2026-01-05', store: '黄石店', category: '灯具', code: 'L001', name: '智能吸顶灯', spec: '圆形/40W', qty: 50, price: 120, amount: 6000, profit: 1800, sale_type: 'store_to_customer', supplier: '' },
  { date: '2026-01-10', store: '黄石店', category: '灯具', code: 'L002', name: '智能吸顶灯', spec: '方形/60W', qty: 30, price: 200, amount: 6000, profit: 1800, sale_type: 'store_to_customer', supplier: '' },
  { date: '2026-01-15', store: '武汉店', category: '灯具', code: 'L003', name: '复古吸顶灯', spec: '圆形/30W', qty: 40, price: 150, amount: 6000, profit: 2100, sale_type: 'store_to_customer', supplier: '' },
  { date: '2026-01-20', store: '北京店', category: '电子产品', code: 'E001', name: '无线蓝牙耳机', spec: 'Pro版', qty: 100, price: 299, amount: 29900, profit: 8970, sale_type: 'store_to_customer', supplier: '' },
  { date: '2026-01-22', store: '上海店', category: '家居用品', code: 'H001', name: '慢回弹记忆枕', spec: '标准型', qty: 80, price: 159, amount: 12720, profit: 3816, sale_type: 'store_to_customer', supplier: '' },

  { date: '2026-02-02', store: '黄石店', category: '灯具', code: 'L001', name: '智能吸顶灯', spec: '圆形/40W', qty: 60, price: 120, amount: 7200, profit: 2160, sale_type: 'store_to_customer', supplier: '' },
  { date: '2026-02-08', store: '黄石店', category: '灯具', code: 'L002', name: '智能吸顶灯', spec: '方形/60W', qty: 25, price: 200, amount: 5000, profit: 1500, sale_type: 'store_to_customer', supplier: '' },
  { date: '2026-02-14', store: '武汉店', category: '灯具', code: 'L003', name: '复古吸顶灯', spec: '圆形/30W', qty: 35, price: 150, amount: 5250, profit: 1837.5, sale_type: 'store_to_customer', supplier: '' },
  { date: '2026-02-18', store: '北京店', category: '电子产品', code: 'E001', name: '无线蓝牙耳机', spec: 'Pro版', qty: 120, price: 299, amount: 35880, profit: 10764, sale_type: 'store_to_customer', supplier: '' },
  { date: '2026-02-25', store: '长沙店', category: '电子产品', code: 'E002', name: '磁吸无线充电宝', spec: '20000mAh', qty: 45, price: 129, amount: 5805, profit: 1741.5, sale_type: 'store_to_customer', supplier: '' },

  { date: '2026-03-03', store: '黄石店', category: '灯具', code: 'L001', name: '智能吸顶灯', spec: '圆形/40W', qty: 70, price: 120, amount: 8400, profit: 2520, sale_type: 'store_to_customer', supplier: '' },
  { date: '2026-03-09', store: '黄石店', category: '灯具', code: 'L002', name: '智能吸顶灯', spec: '方形/60W', qty: 20, price: 200, amount: 4000, profit: 1200, sale_type: 'store_to_customer', supplier: '' },
  { date: '2026-03-18', store: '武汉店', category: '灯具', code: 'L003', name: '复古吸顶灯', spec: '圆形/30W', qty: 45, price: 150, amount: 6750, profit: 2362.5, sale_type: 'store_to_customer', supplier: '' },
  { date: '2026-03-20', store: '上海店', category: '电子产品', code: 'E001', name: '无线蓝牙耳机', spec: 'Pro版', qty: 130, price: 299, amount: 38870, profit: 11661, sale_type: 'store_to_customer', supplier: '' },
  { date: '2026-03-22', store: '广州店', category: '家居用品', code: 'H001', name: '慢回弹记忆枕', spec: '标准型', qty: 100, price: 159, amount: 15900, profit: 4770, sale_type: 'store_to_customer', supplier: '' },

  { date: '2026-04-01', store: '黄石店', category: '灯具', code: 'L001', name: '智能吸顶灯', spec: '圆形/40W', qty: 55, price: 120, amount: 6600, profit: 1980, sale_type: 'store_to_customer', supplier: '' },
  { date: '2026-04-07', store: '黄石店', category: '灯具', code: 'L002', name: '智能吸顶灯', spec: '方形/60W', qty: 18, price: 200, amount: 3600, profit: 1080, sale_type: 'store_to_customer', supplier: '' },
  { date: '2026-04-12', store: '武汉店', category: '灯具', code: 'L003', name: '复古吸顶灯', spec: '圆形/30W', qty: 30, price: 150, amount: 4500, profit: 1575, sale_type: 'store_to_customer', supplier: '' },
  { date: '2026-04-18', store: '广州店', category: '电子产品', code: 'E001', name: '无线蓝牙耳机', spec: 'Pro版', qty: 110, price: 299, amount: 32890, profit: 9867, sale_type: 'store_to_customer', supplier: '' },
  { date: '2026-04-20', store: '深圳店', category: '家居用品', code: 'H002', name: '护颈慢回弹记忆枕', spec: '升级版', qty: 65, price: 199, amount: 12935, profit: 4527.25, sale_type: 'store_to_customer', supplier: '' },

  { date: '2026-05-02', store: '黄石店', category: '灯具', code: 'L001', name: '智能吸顶灯', spec: '圆形/40W', qty: 65, price: 120, amount: 7800, profit: 2340, sale_type: 'store_to_customer', supplier: '' },
  { date: '2026-05-08', store: '黄石店', category: '灯具', code: 'L002', name: '智能吸顶灯', spec: '方形/60W', qty: 22, price: 200, amount: 4400, profit: 1320, sale_type: 'store_to_customer', supplier: '' },
  { date: '2026-05-15', store: '武汉店', category: '灯具', code: 'L003', name: '复古吸顶灯', spec: '圆形/30W', qty: 38, price: 150, amount: 5700, profit: 1995, sale_type: 'store_to_customer', supplier: '' },
  { date: '2026-05-18', store: '深圳店', category: '电子产品', code: 'E001', name: '无线蓝牙耳机', spec: 'Pro版', qty: 140, price: 299, amount: 41860, profit: 12558, sale_type: 'store_to_customer', supplier: '' },
  { date: '2026-05-20', store: '天津店', category: '家居用品', code: 'H001', name: '慢回弹记忆枕', spec: '标准型', qty: 50, price: 159, amount: 7950, profit: 2385, sale_type: 'store_to_customer', supplier: '' },

  { date: '2026-06-03', store: '黄石店', category: '灯具', code: 'L001', name: '智能吸顶灯', spec: '圆形/40W', qty: 80, price: 120, amount: 9600, profit: 2880, sale_type: 'store_to_customer', supplier: '' },
  { date: '2026-06-09', store: '黄石店', category: '灯具', code: 'L002', name: '智能吸顶灯', spec: '方形/60W', qty: 28, price: 200, amount: 5600, profit: 1680, sale_type: 'store_to_customer', supplier: '' },
  { date: '2026-06-14', store: '武汉店', category: '灯具', code: 'L003', name: '复古吸顶灯', spec: '圆形/30W', qty: 42, price: 150, amount: 6300, profit: 2205, sale_type: 'store_to_customer', supplier: '' },
  { date: '2026-06-15', store: '深圳店', category: '电子产品', code: 'E001', name: '无线蓝牙耳机', spec: 'Pro版', qty: 150, price: 299, amount: 44850, profit: 13455, sale_type: 'store_to_customer', supplier: '' },
  { date: '2026-06-16', store: '南京店', category: '灯具', code: 'L001', name: '智能吸顶灯', spec: '圆形/40W', qty: 45, price: 120, amount: 5400, profit: 1620, sale_type: 'store_to_customer', supplier: '' },

  // === 总部→分店批发数据（sale_type: 'head_to_store'） ===
  { date: '2026-01-08', store: '黄石店', category: '灯具', code: 'HL001', name: 'LED工程射灯', spec: '5W', qty: 200, price: 25, amount: 5000, profit: 1000, sale_type: 'head_to_store', supplier: '光源照明' },
  { date: '2026-01-18', store: '武汉店', category: '灯具', code: 'HL002', name: 'LED工程射灯', spec: '7W', qty: 150, price: 32, amount: 4800, profit: 960, sale_type: 'head_to_store', supplier: '光源照明' },
  { date: '2026-02-05', store: '黄石店', category: '电子产品', code: 'HE001', name: '超薄自连充电宝', spec: '10000mAh', qty: 500, price: 45, amount: 22500, profit: 4500, sale_type: 'head_to_store', supplier: '华强电子' },
  { date: '2026-02-20', store: '上海店', category: '电子产品', code: 'HE002', name: '超薄自连充电宝', spec: '20000mAh', qty: 300, price: 75, amount: 22500, profit: 4500, sale_type: 'head_to_store', supplier: '华强电子' },
  { date: '2026-03-10', store: '广州店', category: '家居用品', code: 'HH001', name: '不锈钢保温壶', spec: '2L', qty: 120, price: 65, amount: 7800, profit: 1560, sale_type: 'head_to_store', supplier: '生活优品' },
  { date: '2026-03-25', store: '深圳店', category: '家居用品', code: 'HH002', name: '不锈钢保温壶', spec: '1.5L', qty: 100, price: 55, amount: 5500, profit: 1100, sale_type: 'head_to_store', supplier: '生活优品' },
  { date: '2026-04-05', store: '北京店', category: '电子产品', code: 'HE003', name: '高速快充数据线', spec: 'Type-C', qty: 1000, price: 8, amount: 8000, profit: 1600, sale_type: 'head_to_store', supplier: '华强电子' },
  { date: '2026-04-22', store: '武汉店', category: '灯具', code: 'HL003', name: '全光谱吸顶灯芯', spec: '24W', qty: 300, price: 18, amount: 5400, profit: 1080, sale_type: 'head_to_store', supplier: '光源照明' },
  { date: '2026-05-05', store: '黄石店', category: '家居用品', code: 'HH003', name: '多功能塑料收纳箱', spec: '大号/50L', qty: 80, price: 45, amount: 3600, profit: 720, sale_type: 'head_to_store', supplier: '生活优品' },
  { date: '2026-05-18', store: '上海店', category: '电子产品', code: 'HE004', name: '无线双耳蓝牙耳机', spec: '基础款', qty: 200, price: 60, amount: 12000, profit: 2400, sale_type: 'head_to_store', supplier: '华强电子' },
  { date: '2026-06-02', store: '广州店', category: '灯具', code: 'HL004', name: '护眼LED台灯', spec: '国AA级', qty: 150, price: 30, amount: 4500, profit: 900, sale_type: 'head_to_store', supplier: '光源照明' },
  { date: '2026-06-15', store: '深圳店', category: '电子产品', code: 'HE005', name: '车载磁吸手机支架', spec: '出风口款', qty: 400, price: 15, amount: 6000, profit: 1200, sale_type: 'head_to_store', supplier: '华强电子' }
];

export const DEFAULT_INVENTORY: InventoryItem[] = [
  // 总部总仓备货
  { store: '总部总仓', name: '智能吸顶灯', spec: '圆形/40W', category: '灯具', stock: 8500, price: 60 },
  { store: '总部总仓', name: '智能吸顶灯', spec: '方形/60W', category: '灯具', stock: 5200, price: 100 },
  { store: '总部总仓', name: '复古吸顶灯', spec: '圆形/30W', category: '灯具', stock: 4800, price: 70 },
  { store: '总部总仓', name: '无线蓝牙耳机', spec: 'Pro版', category: '电子产品', stock: 6500, price: 150 },
  { store: '总部总仓', name: '慢回弹记忆枕', spec: '标准型', category: '家居用品', stock: 9200, price: 80 },
  { store: '总部总仓', name: 'LED工程射灯', spec: '5W', category: '灯具', stock: 14000, price: 12 },
  { store: '总部总仓', name: '超薄自连充电宝', spec: '10000mAh', category: '电子产品', stock: 11000, price: 25 },
  { store: '总部总仓', name: '不锈钢保温壶', spec: '2L', category: '家居用品', stock: 7500, price: 35 },

  // 零售对照库存
  { store: '黄石店', name: '智能吸顶灯', spec: '圆形/40W', category: '灯具', stock: 150, price: 84 },
  { store: '黄石店', name: '智能吸顶灯', spec: '方形/60W', category: '灯具', stock: 95, price: 140 },
  { store: '武汉店', name: '复古吸顶灯', spec: '圆形/30W', category: '灯具', stock: 110, price: 95 },
  { store: '北京店', name: '无线蓝牙耳机', spec: 'Pro版', category: '电子产品', stock: 250, price: 200 },
  { store: '上海店', name: '慢回弹记忆枕', spec: '标准型', category: '家居用品', stock: 180, price: 110 },
  { store: '长沙店', name: '磁吸无线充电宝', spec: '20000mAh', category: '电子产品', stock: 120, price: 90 },
  { store: '广州店', name: '慢回弹记忆枕', spec: '标准型', category: '家居用品', stock: 140, price: 110 },
  { store: '深圳店', name: '护颈慢回弹记忆枕', spec: '升级版', category: '家居用品', stock: 85, price: 130 },
  { store: '深圳店', name: '无线蓝牙耳机', spec: 'Pro版', category: '电子产品', stock: 320, price: 200 },
  { store: '天津店', name: '慢回弹记忆枕', spec: '标准型', category: '家居用品', stock: 90, price: 110 },
  { store: '南京店', name: '智能吸顶灯', spec: '圆形/40W', category: '灯具', stock: 75, price: 84 },

  // 批发对照库存
  { store: '黄石店', name: 'LED工程射灯', spec: '5W', category: '灯具', stock: 1200, price: 20 },
  { store: '武汉店', name: 'LED工程射灯', spec: '7W', category: '灯具', stock: 800, price: 25 },
  { store: '黄石店', name: '超薄自连充电宝', spec: '10000mAh', category: '电子产品', stock: 1500, price: 36 },
  { store: '上海店', name: '超薄自连充电宝', spec: '20000mAh', category: '电子产品', stock: 900, price: 60 },
  { store: '广州店', name: '不锈钢保温壶', spec: '2L', category: '家居用品', stock: 450, price: 52 },
  { store: '深圳店', name: '不锈钢保温壶', spec: '1.5L', category: '家居用品', stock: 300, price: 44 },
  { store: '北京店', name: '高速快充数据线', spec: 'Type-C', category: '电子产品', stock: 2500, price: 6.4 },
  { store: '武汉店', name: '全光谱吸顶灯芯', spec: '24W', category: '灯具', stock: 1000, price: 14.4 },
  { store: '黄石店', name: '多功能塑料收纳箱', spec: '大号/50L', category: '家居用品', stock: 350, price: 36 },
  { store: '上海店', name: '无线双耳蓝牙耳机', spec: '基础款', category: '电子产品', stock: 650, price: 48 },
  { store: '广州店', name: '护眼LED台灯', spec: '国AA级', category: '灯具', stock: 400, price: 24 },
  { store: '深圳店', name: '车载磁吸手机支架', spec: '出风口款', category: '电子产品', stock: 1100, price: 12 }
];
