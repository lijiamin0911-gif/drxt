import React, { useState, useEffect } from 'react';
import { Search, RotateCcw, Calendar, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { Order, User } from '../types';
import { formatDateToMinute } from '../lib/dbService';
import ExportButton from './ExportButton';

interface OrderQueryViewProps {
  orders: Order[];
  currentUser: User;
}

interface ColumnConfig {
  key: string;
  label: string;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: 'branchName', label: '分店名称' },
  { key: 'productCode', label: '产品编码' },
  { key: 'productName', label: '商品名称' },
  { key: 'specs', label: '规格型号' },
  { key: 'quantity', label: '数量' },
  { key: 'supplier', label: '供应商' },
  { key: 'orderType', label: '订单类型' },
  { key: 'status', label: '当前状态' },
  { key: 'normalizedCreatedAt', label: '提交时间' }
];

export default function OrderQueryView({ orders, currentUser }: OrderQueryViewProps) {
  // Default to today's date YYYY-MM-DD
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const storageKey = `cols_order_query_${currentUser.id}`;
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : DEFAULT_COLUMNS;
  });

  // Reset to default column ordering
  const handleResetColumns = () => {
    localStorage.removeItem(storageKey);
    setColumns(DEFAULT_COLUMNS);
  };

  // Drag and Drop hooks
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

    const newCols = [...columns];
    const [removed] = newCols.splice(sourceIndex, 1);
    newCols.splice(targetIndex, 0, removed);
    setColumns(newCols);
    localStorage.setItem(storageKey, JSON.stringify(newCols));
  };

  // Format statuses inline
  const getDetailedStatusString = (order: Order): string => {
    if (order.status === 'pending_confirm') return '待前台确认';
    if (order.status === 'pending_purchase') return '待采购处理';
    if (order.status === 'completed') return '已完成';
    if (order.status === 'rejected') return '已被驳回';
    if (order.status === 'pending_delete') return '待审核删除';
    if (order.status === 'deleted_abnormal') return '已删除（异常）';
    if (order.status === 'purchased') {
      if ((order.receivedQty || 0) > 0) return '部分到货';
      return '采购已下单';
    }
    return '未知状态';
  };

  const getDetailedStatusBadge = (order: Order) => {
    const text = getDetailedStatusString(order);
    let style = "bg-slate-50 text-slate-600 border-slate-100";
    if (order.status === 'pending_confirm') {
      style = "bg-amber-50 text-amber-700 border-amber-100";
    } else if (order.status === 'pending_purchase') {
      style = "bg-indigo-50 text-indigo-700 border-indigo-100";
    } else if (order.status === 'completed') {
      style = "bg-emerald-50 text-emerald-700 border-emerald-100";
    } else if (order.status === 'rejected') {
      style = "bg-rose-50 text-rose-700 border-rose-100";
    } else if (order.status === 'pending_delete') {
      style = "bg-amber-100 text-amber-850 border-amber-200 animate-pulse";
    } else if (order.status === 'deleted_abnormal') {
      style = "bg-zinc-100 text-zinc-500 border-zinc-200 line-through";
    } else if (order.status === 'purchased') {
      if ((order.receivedQty || 0) > 0) {
        style = "bg-orange-50 text-orange-700 border-orange-100";
      } else {
        style = "bg-blue-50 text-blue-700 border-blue-100";
      }
    }
    return (
      <span className={`px-2 py-0.5 text-[10px] md:text-xs font-bold rounded-full border ${style}`}>
        {text}
      </span>
    );
  };

  // Filter orders by chosen date suffix (compares YYYY-MM-DD prefix of createdAt)
  const matchingOrders = React.useMemo(() => {
    return orders.filter(o => {
      // If branch user, restrict to their own branch
      if (currentUser.role === 'branch' && o.branchId !== currentUser.id) {
        return false;
      }
      // o.createdAt is formatted as YYYY-MM-DD HH:mm
      const minuteTimeStr = formatDateToMinute(o.createdAt);
      return minuteTimeStr.startsWith(selectedDate);
    });
  }, [orders, selectedDate, currentUser]);

  // Map matching results for proper export attributes matching table columns
  const exportData = React.useMemo(() => {
    return matchingOrders.map(o => ({
      branchName: o.branchName || '未知分店',
      productCode: o.productCode || '无',
      productName: o.productName || '无',
      specs: o.specs || '无',
      quantity: o.quantity || 0,
      supplier: o.supplier || '未指定',
      orderType: o.orderType === 'custom' ? '非常规新品' : '常规大货单',
      status: getDetailedStatusString(o),
      normalizedCreatedAt: formatDateToMinute(o.createdAt)
    }));
  }, [matchingOrders]);

  // Render rows dynamically matched with custom column ordering
  const renderCell = (order: Order, colKey: string) => {
    switch (colKey) {
      case 'branchName':
        return <span className="font-bold text-slate-800">{order.branchName || '总部'}</span>;
      case 'productCode':
        return <span className="font-mono text-slate-500 font-semibold">{order.productCode}</span>;
      case 'productName':
        return (
          <div className="max-w-[180px] truncate" title={order.productName}>
            <span className="font-medium text-slate-900">{order.productName}</span>
          </div>
        );
      case 'specs':
        return <span className="text-slate-500">{order.specs}</span>;
      case 'quantity':
        return <span className="font-bold font-mono text-slate-900">{order.quantity}</span>;
      case 'supplier':
        return <span className="text-slate-600 font-medium">{order.supplier}</span>;
      case 'orderType':
        return order.orderType === 'custom' ? (
          <span className="px-1.5 py-0.5 text-[10px] bg-purple-50 text-purple-700 border border-purple-100 rounded font-bold">非常规/特定新品</span>
        ) : (
          <span className="px-1.5 py-0.5 text-[10px] bg-slate-50 text-slate-600 border border-slate-200/50 rounded">常规</span>
        );
      case 'status':
        return getDetailedStatusBadge(order);
      case 'normalizedCreatedAt':
        return <span className="text-slate-400 font-mono text-[11px]">{formatDateToMinute(order.createdAt)}</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6 space-y-4">
        {/* Title Block */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-50 pb-4 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                <Search className="w-4 h-4" />
              </span>
              <h2 className="text-base font-extrabold text-slate-800">前台一键查询某日订单明细</h2>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">快速检索、展示、拖拽列顺序及导出全辖分店任意某一提交日期的全部货品订单流水明细</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Reset cols order */}
            <button
              onClick={handleResetColumns}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-250 border-slate-205 text-slate-600 hover:text-slate-900 rounded-lg text-xs font-semibold cursor-pointer select-none bg-slate-50 hover:bg-slate-100 transition-colors"
              title="恢复系统出厂表格字段默认顺序"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>重置为默认顺序</span>
            </button>

            {/* Export */}
            <ExportButton
              data={exportData}
              headers={columns}
              fileName={`${selectedDate}_全分店订单明细`}
            />
          </div>
        </div>

        {/* Date Selector input bar */}
        <div className="bg-slate-50/70 p-4 border border-slate-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-slate-500 text-xs font-bold flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              选择查询目标提交日期
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600 text-xs font-semibold text-slate-700 bg-white shadow-xs cursor-pointer"
            />
          </div>

          <div className="text-right">
            <span className="text-slate-400 text-[11px]">该日提单行总数：</span>
            <span className="font-mono text-sm font-black text-blue-600">{matchingOrders.length}</span>
            <span className="text-[10px] text-slate-400"> 行</span>
          </div>
        </div>

        {/* Results table */}
        <div className="overflow-x-auto border border-slate-100 rounded-xl bg-white shadow-xs">
          <table className="w-full text-left text-xs text-slate-600 min-w-[850px]">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-100 select-none">
              <tr>
                {columns.map((col, index) => (
                  <th
                    key={col.key}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    className="p-3.5 font-bold cursor-move hover:bg-slate-150 hover:bg-slate-100 transition-colors border-r last:border-r-0 border-slate-100 relative group"
                    title="按住鼠标拖拽可以个性化排列此列左右顺序"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span>{col.label}</span>
                      <span className="text-[9px] text-slate-300 font-normal group-hover:text-slate-400">⋮⋮</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {matchingOrders.map(order => (
                <tr key={order.id} className="hover:bg-slate-50/40 align-middle">
                  {columns.map(col => (
                    <td key={col.key} className="p-3.5 border-r last:border-r-0 border-slate-100/50">
                      {renderCell(order, col.key)}
                    </td>
                  ))}
                </tr>
              ))}
              {matchingOrders.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="p-12 text-center text-slate-400">
                    <Search className="w-8 h-8 text-slate-300 mx-auto mb-2.5 stroke-[1.5]" />
                    <div className="text-xs font-semibold text-slate-700">没有在所选日期 {selectedDate} 检索到分店提报提交的订单。</div>
                    <div className="text-[10px] text-slate-400 mt-1">请选择另一个日期或引导分店补充新申领大货意向</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
