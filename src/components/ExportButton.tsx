import React from 'react';
import { Download } from 'lucide-react';

interface ExportButtonProps {
  data: any[];
  headers: { key: string; label: string }[];
  fileName: string;
  id?: string;
}

export default function ExportButton({ data, headers, fileName, id }: ExportButtonProps) {
  const handleExport = () => {
    if (data.length === 0) {
      alert('暂无数据可导出');
      return;
    }

    // Generate CSV content
    const csvRows = [];
    
    // Add header row
    const headerRow = headers.map(h => `"${h.label.replace(/"/g, '""')}"`).join(',');
    csvRows.push(headerRow);

    // Add data rows
    for (const item of data) {
      const dataRow = headers.map(h => {
        const val = item[h.key];
        const formattedVal = val === null || val === undefined ? '' : String(val);
        return `"${formattedVal.replace(/"/g, '""')}"`;
      }).join(',');
      csvRows.push(dataRow);
    }

    const csvContent = '\uFEFF' + csvRows.join('\n'); // Add UTF-8 BOM for Excel support
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${fileName}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button
      id={id || 'btn_export_' + Math.random().toString(36).substring(2,6)}
      onClick={handleExport}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
    >
      <Download className="w-3.5 h-3.5 text-slate-500" />
      <span>导出数据</span>
    </button>
  );
}
