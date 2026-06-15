import React, { useState } from 'react';
import { 
  History, 
  Search, 
  Terminal, 
  Activity, 
  Calendar,
  User as UserIcon
} from 'lucide-react';
import { OperationLog } from '../types';

interface LogsViewProps {
  logs: OperationLog[];
}

export default function LogsView({ logs }: LogsViewProps) {
  const [search, setSearch] = useState('');

  const filteredLogs = logs.filter(l => 
    l.username.toLowerCase().includes(search.toLowerCase()) ||
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.details.toLowerCase().includes(search.toLowerCase()) ||
    l.role.toLowerCase().includes(search.toLowerCase())
  );

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-50 border border-rose-100 text-rose-700 font-sans">管理员</span>;
      case 'branch':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-green-50 border border-green-100 text-green-700 font-sans">分店部</span>;
      case 'receptionist':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-50 border border-blue-100 text-blue-700 font-sans">前台汇总</span>;
      case 'purchasing':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-50 border border-blue-100 text-blue-700 font-sans">采购组</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-600 font-sans">系统</span>;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 md:p-6 space-y-4">
      {/* List Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-50">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="font-semibold text-slate-800 text-sm md:text-base">全系统操作审计日志</h3>
            <p className="text-[10px] text-slate-400">实时记载本系统中全部人员开单、审批、采购和发到货行为的溯源线迹</p>
          </div>
        </div>

        {/* Filter search */}
        <div className="relative text-xs">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="搜索操作人、类型或明细内容..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-505 w-64"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filteredLogs.slice(0, 100).map(log => (
          <div 
            key={log.id} 
            className="flex items-start gap-4 p-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-100/50 rounded-xl transition-colors text-xs"
          >
            {/* Operator info label */}
            <div className="flex flex-col items-start gap-1 w-28 shrink-0">
              <div className="font-semibold text-slate-900 flex items-center gap-1">
                <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>{log.username}</span>
              </div>
              <div>{getRoleBadge(log.role)}</div>
            </div>

            {/* Action information */}
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800 bg-blue-50/70 text-blue-800 px-1.5 py-0.2 rounded font-sans text-[11px]">
                  {log.action}
                </span>
                <span className="text-slate-400 font-mono text-[10px]">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
              <p className="text-slate-650 leading-relaxed font-sans">{log.details}</p>
            </div>
            
            <span className="text-[10px] font-mono text-slate-300">#{log.id.slice(4, 10)}</span>
          </div>
        ))}

        {filteredLogs.length === 0 && (
          <div className="p-12 text-center text-slate-400 text-xs">
            <Activity className="w-8 h-8 text-slate-200 mx-auto mb-2 stroke-[1.5]" />
            <span>没有检索到匹配条件的任何日志数据</span>
          </div>
        )}
      </div>
    </div>
  );
}
