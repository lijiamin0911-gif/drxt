import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Search, 
  Filter, 
  RefreshCw, 
  CheckCircle, 
  ArrowRight,
  TrendingUp,
  Sliders,
  Building,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Order, User, SystemConfig } from '../types';
import ExportButton from './ExportButton';

interface ShortageReportViewProps {
  orders: Order[];
  systemConfig: SystemConfig;
  onReplenish: (shorageItem: any) => Promise<void>;
  currentUser: User;
}

export default function ShortageReportView({ orders, systemConfig, onReplenish, currentUser }: ShortageReportViewProps) {
  const [branchFilter, setBranchFilter] = useState('all');
  const [productSearch, setProductSearch] = useState('');
  const [shortageOnly, setShortageOnly] = useState<boolean>(true); // default true: only show actual shortfalls
  const [isReplenishingId, setIsReplenishingId] = useState<string | null>(null);
  const [collapsedSuppliers, setCollapsedSuppliers] = useState<{ [supplier: string]: boolean }>({});

  // Extract unique branches
  const uniqueBranches = Array.from(new Set(orders.map(o => o.branchName)));

  // Calculate backlog lines
  // Let's list all 'purchased' status orders.
  // If shortageOnly is true, only list things with receivedQty < quantity.
  // Otherwise, list all purchased items to let them compare everything.
  const purchasedOrders = orders.filter(o => o.status === 'purchased');

  const shortageItemsList = purchasedOrders.map(order => {
    const received = order.receivedQty || 0;
    const qtyShort = Math.max(0, order.quantity - received);
    return {
      ...order,
      received,
      qtyShort,
      isShort: qtyShort > 0
    };
  });

  const filteredShortages = shortageItemsList.filter(item => {
    const bMatch = branchFilter === 'all' || item.branchName === branchFilter;
    const pMatch = item.productName.toLowerCase().includes(productSearch.toLowerCase()) || 
                   item.productCode.toLowerCase().includes(productSearch.toLowerCase()) ||
                   item.orderNo.toLowerCase().includes(productSearch.toLowerCase());
    const sMatch = !shortageOnly || item.qtyShort > 0;
    return bMatch && pMatch && sMatch;
  });

  const shortagesBySupplier: { [supplier: string]: typeof filteredShortages } = {};
  for (const item of filteredShortages) {
    const sup = item.supplier || '未指定生产厂家';
    if (!shortagesBySupplier[sup]) shortagesBySupplier[sup] = [];
    shortagesBySupplier[sup].push(item);
  }

  // Calculate stats
  const aggregateTotalShortage = shortageItemsList.reduce((sum, item) => sum + item.qtyShort, 0);
  const isAboveThreshold = aggregateTotalShortage >= systemConfig.shortageThreshold;

  const handlePerformReplenish = async (item: any) => {
    setIsReplenishingId(item.id);
    try {
      const payload = {
        orderId: item.id,
        branchId: item.branchId,
        branchName: item.branchName,
        productCode: item.productCode,
        productName: item.productName,
        specs: item.specs,
        qtyShort: item.qtyShort,
        supplier: item.supplier
      };
      await onReplenish(payload);
      alert(`一键生成补货单成功！全新订货单已下达并标记为【待前台确认】。数量为：${item.qtyShort}件`);
    } catch (err) {
      console.error(err);
      alert('补货单生成失败，请稍后重试');
    } finally {
      setIsReplenishingId(null);
    }
  };

  const exportHeaders = [
    { key: 'orderNo', label: '原申购单批号' },
    { key: 'branchName', label: '提货分店' },
    { key: 'productCode', label: '货品物料编码' },
    { key: 'productName', label: '货品名称' },
    { key: 'specs', label: '规格/型号' },
    { key: 'quantity', label: '提报采购总数' },
    { key: 'received', label: '厂家已到货数量' },
    { key: 'qtyShort', label: '厂家欠货缺口' },
    { key: 'supplier', label: '合作品牌商' }
  ];

  return (
    <div className="space-y-6">
      {/* Alert threshold indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 border border-slate-100 shadow-sm rounded-xl flex items-center justify-between col-span-2">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${
              isAboveThreshold ? 'bg-rose-100 text-rose-600' : 'bg-green-100 text-green-600'
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">全系统欠货总负荷</div>
              <div className={`text-xl md:text-2xl font-bold font-mono mt-0.5 ${
                isAboveThreshold ? 'text-rose-600' : 'text-green-600'
              }`}>
                {aggregateTotalShortage} 件 
                <span className="text-xs font-normal text-slate-400 font-sans ml-2">
                  (系统警戒限阈值: {systemConfig.shortageThreshold} 件)
                </span>
              </div>
            </div>
          </div>

          <div className="text-right">
            {isAboveThreshold ? (
              <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-150 animate-pulse">
                ⛈ 欠货超出警戒线!
              </span>
            ) : (
              <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-green-50 text-green-700 border border-green-150">
                ☀ 处于安全供需区
              </span>
            )}
          </div>
        </div>

        <div className="bg-white p-4 border border-slate-100 shadow-sm rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>实存缺货SKU项</span>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-800 font-mono">
              {shortageItemsList.filter(o => o.qtyShort > 0).length}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">需关注安排补货的明细线路数</p>
          </div>
        </div>
      </div>

      {/* Main Filter Toolbar & Report representation */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 md:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50 pb-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-slate-800 text-sm md:text-base">实时配货短缺/欠货分析报表</h3>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            {/* Filter Toggle */}
            <button
              onClick={() => setShortageOnly(!shortageOnly)}
              className={`px-3 py-1.5 border rounded-lg transition-colors cursor-pointer ${
                shortageOnly 
                  ? 'bg-rose-50 text-rose-600 border-rose-150' 
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {shortageOnly ? '🔍 仅看当前有欠款项' : '🔍 浏览全量采购记录'}
            </button>

            {/* Branch dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg">
              <Building className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={branchFilter}
                onChange={e => setBranchFilter(e.target.value)}
                className="bg-transparent border-none focus:outline-none focus:ring-0 text-slate-700 font-semibold"
              >
                <option value="all">所有提货分店</option>
                {uniqueBranches.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {/* Keyword Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="检索货号/货品..."
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium w-44"
              />
            </div>

            {/* File export */}
            <ExportButton 
              data={filteredShortages} 
              headers={exportHeaders} 
              fileName="欠货缺口及补救方案分析报表" 
            />
          </div>
        </div>

        {/* Listing Grouped by Supplier */}
        {filteredShortages.length === 0 ? (
          <div className="overflow-x-auto border border-slate-50 rounded-lg text-xs p-12 text-center text-slate-400 bg-white">
            <CheckCircle className="w-10 h-10 text-slate-200 mx-auto mb-2 stroke-[1.2]" />
            <p className="font-semibold text-slate-700 text-xs">没有检索到符合过滤限制的欠款商品！</p>
            <p className="text-[10px] text-slate-400 mt-1">
              所有的商品预约、到港核对，均处于完好的高水准平衡。
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(shortagesBySupplier).map(([supplier, items]) => {
              const isCollapsed = !!collapsedSuppliers[supplier];
              const totalItemsCount = items.length;
              const totalQtyDeficit = items.reduce((sum, item) => sum + item.qtyShort, 0);

              return (
                <div key={supplier} className="border border-slate-100 rounded-lg overflow-hidden bg-white shadow-xs hover:shadow-sm transition-shadow">
                  {/* Supplier Header Group */}
                  <div 
                    onClick={() => setCollapsedSuppliers(prev => ({ ...prev, [supplier]: !isCollapsed }))}
                    className="p-3 bg-slate-50 border-b border-slate-100 hover:bg-slate-100/70 transition-colors flex items-center justify-between cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2">
                      {isCollapsed ? (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronUp className="w-4 h-4 text-slate-500" />
                      )}
                      <span className="font-extrabold text-slate-800 text-xs md:text-sm">🏭 {supplier}</span>
                      <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-200/50">
                        {totalItemsCount} 种商品
                      </span>
                      <span className="bg-rose-50 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded border border-rose-205">
                        待补缺口: {totalQtyDeficit} 件
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold hidden sm:inline">
                      {isCollapsed ? '点击展开查看该供应商下所有欠货明细' : '点击折叠收起'}
                    </span>
                  </div>

                  {/* Supplier Detail Table */}
                  {!isCollapsed && (
                    <div className="overflow-x-auto text-xs">
                      <table className="w-full text-left text-slate-600 min-w-[800px]">
                        <thead className="bg-slate-50 border-b border-slate-100 text-slate-700 font-semibold text-[10px]">
                          <tr>
                            <th className="p-3 font-semibold">流向分店</th>
                            <th className="p-3 font-semibold">采购合同号 / 货号</th>
                            <th className="p-3 font-semibold">货品明细</th>
                            <th className="p-3 font-semibold">型号规格</th>
                            <th className="p-3 font-semibold text-center font-mono">原预采购量</th>
                            <th className="p-3 font-semibold text-center font-mono">实到货件</th>
                            <th className="p-3 font-semibold text-rose-700 font-mono text-center bg-rose-50/20">欠货数量缺口</th>
                            <th className="p-3 font-semibold text-right">协同控制方案</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {items.map(item => {
                            const isUnderDeficit = item.qtyShort > 0;
                            return (
                              <tr key={item.id} className={`hover:bg-slate-50/30 transition-colors ${
                                isUnderDeficit ? 'bg-rose-50/5' : ''
                              }`}>
                                <td className="p-3">
                                  <span className="font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                                    {item.branchName}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <div className="font-mono font-medium text-slate-900">{item.orderNo}</div>
                                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">CODE: {item.productCode}</div>
                                </td>
                                <td className="p-3 font-bold text-slate-900">{item.productName}</td>
                                <td className="p-3 text-slate-500 font-medium">{item.specs}</td>
                                <td className="p-3 text-center font-mono">{item.quantity}</td>
                                <td className="p-3 text-center text-slate-500 font-mono">{item.received}</td>
                                <td className={`p-3 text-center font-bold font-mono ${
                                  isUnderDeficit ? 'bg-rose-50 text-rose-600' : 'text-slate-400 font-normal'
                                }`}>
                                  {item.qtyShort}
                                </td>
                                <td className="p-3 text-right">
                                  {isUnderDeficit ? (
                                    <button
                                      type="button"
                                      onClick={() => handlePerformReplenish(item)}
                                      disabled={isReplenishingId === item.id}
                                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded text-[11px] inline-flex items-center gap-1 cursor-pointer shadow-sm transition-all whitespace-nowrap"
                                      title="一键根据当前欠货值克隆下达到前台审核"
                                    >
                                      <RefreshCw className={`w-3.5 h-3.5 ${isReplenishingId === item.id ? 'animate-spin' : ''}`} />
                                      <span>一键补货 ({item.qtyShort}件)</span>
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-green-600 font-semibold bg-green-50 px-2 py-0.5 rounded-full inline-block">
                                      履约妥协 ✓
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
