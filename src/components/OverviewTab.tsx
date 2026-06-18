/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { 
  TrendingUp, BarChart3, PieChart, Landmark, DollarSign, Coins, 
  Warehouse, Percent 
} from 'lucide-react';
import { Transaction, InventoryItem } from '../types';
import { TrendChart, DonutChart, BarChart } from './CustomChart';

interface OverviewTabProps {
  transactions: Transaction[];       // already filtered by general filters
  inventory: InventoryItem[];         // active inventory items
  filterLabel: string;               // e.g. "华中 / 黄石店" for KPI subtext
}

export function OverviewTab({ transactions, inventory, filterLabel }: OverviewTabProps) {
  // 1. Calculate KPI Metrics
  const metrics = useMemo(() => {
    let sales = 0;
    let profit = 0;
    transactions.forEach(t => {
      sales += t.amount;
      profit += t.profit;
    });

    // Stock quantities: sum of stocks in inventory belonging to active stores/categories matching the active filter
    let stockQty = 0;
    inventory.forEach(item => {
      stockQty += item.stock;
    });

    const margin = sales > 0 ? (profit / sales) * 100 : 0;

    return {
      sales,
      profit,
      stockQty,
      margin
    };
  }, [transactions, inventory]);

  // 2. Generate Trend Graph Data (Monthly transaction sums)
  const trendData = useMemo(() => {
    const monthlyMap: Record<string, number> = {};
    transactions.forEach(t => {
      const month = t.date.slice(0, 7); // YYYY-MM
      monthlyMap[month] = (monthlyMap[month] || 0) + t.amount;
    });
    
    return Object.entries(monthlyMap)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [transactions]);

  // 3. Generate Category Product share (Donut graph data)
  const categoryData = useMemo(() => {
    const catMap: Record<string, number> = {};
    transactions.forEach(t => {
      catMap[t.category] = (catMap[t.category] || 0) + t.amount;
    });

    return Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  // 4. Generate Regional Sales pie chart data
  const regionalData = useMemo(() => {
    const regMap: Record<string, number> = {};
    transactions.forEach(t => {
      // Get branch store's designated region
      const reg = t.store.includes('店') ? t.store.slice(0, 2) : '其他'; 
      // Look up region, or group directly
      const resolvedReg = t.store.includes('黄石') || t.store.includes('武汉') || t.store.includes('长沙') ? '华中' :
                          t.store.includes('北京') || t.store.includes('天津') ? '华北' :
                          t.store.includes('上海') || t.store.includes('南京') || t.store.includes('杭州') ? '华东' : '华南';
      regMap[resolvedReg] = (regMap[resolvedReg] || 0) + t.amount;
    });

    return Object.entries(regMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  // 5. Generate Store Sales comparisons (Bar chart data)
  const storeData = useMemo(() => {
    const storeMap: Record<string, number> = {};
    transactions.forEach(t => {
      storeMap[t.store] = (storeMap[t.store] || 0) + t.amount;
    });

    return Object.entries(storeMap)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 stores
  }, [transactions]);

  const formatCurrency = (val: number) => {
    return '¥' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-6">
      {/* KPI Section */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Sales amount KPI */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-[#1a5c9e]/10 text-[#1a5c9e] rounded-xl flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">总销售额</span>
            <span className="block text-lg font-bold text-slate-800 font-mono mt-0.5 truncate">{formatCurrency(metrics.sales)}</span>
            <span className="block text-[10px] text-slate-400 mt-0.5 truncate">过滤条件: {filterLabel}</span>
          </div>
        </div>

        {/* Profit margin KPI */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Coins className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">总毛利润</span>
            <span className="block text-lg font-bold text-slate-800 font-mono mt-0.5 truncate">{formatCurrency(metrics.profit)}</span>
            <span className="block text-[10px] text-slate-400 mt-0.5 truncate">销售毛利积累额</span>
          </div>
        </div>

        {/* Total Stock Qty KPI */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Warehouse className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">总库存数量</span>
            <span className="block text-lg font-bold text-slate-800 font-mono mt-0.5 truncate">{metrics.stockQty.toLocaleString()} 件</span>
            <span className="block text-[10px] text-slate-400 mt-0.5 truncate">所选分店当前库存存量</span>
          </div>
        </div>

        {/* Margin rate KPI */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Percent className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">综合销售毛利率</span>
            <span className="block text-lg font-bold text-slate-800 font-mono mt-0.5 truncate">{metrics.margin.toFixed(1)}%</span>
            <span className="block text-[10px] text-slate-400 mt-0.5 truncate">总毛利 / 总销售额比值</span>
          </div>
        </div>
      </div>

      {/* Grid Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Trend chart card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-[320px]">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
            <TrendingUp className="w-4.5 h-4.5 text-[#1a5c9e]" />
            <h3 className="text-sm font-bold text-slate-800">月度销售额趋势</h3>
          </div>
          <div className="flex-1 min-h-0">
            <TrendChart data={trendData} />
          </div>
        </div>

        {/* Category donut card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-[320px]">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
            <PieChart className="w-4.5 h-4.5 text-[#1a5c9e]" />
            <h3 className="text-sm font-bold text-slate-800">产品类别销售占比</h3>
          </div>
          <div className="flex-1 min-h-0">
            <DonutChart data={categoryData} />
          </div>
        </div>

        {/* Regional donut card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-[320px]">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
            <Landmark className="w-4.5 h-4.5 text-[#1a5c9e]" />
            <h3 className="text-sm font-bold text-slate-800">各大区域份额占比</h3>
          </div>
          <div className="flex-1 min-h-0">
            <DonutChart data={regionalData} />
          </div>
        </div>

        {/* Store comparison bar card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-[320px]">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
            <BarChart3 className="w-4.5 h-4.5 text-[#1a5c9e]" />
            <h3 className="text-sm font-bold text-slate-800">分店销售排名 (Top 8)</h3>
          </div>
          <div className="flex-1 min-h-0">
            <BarChart data={storeData} />
          </div>
        </div>
      </div>
    </div>
  );
}
