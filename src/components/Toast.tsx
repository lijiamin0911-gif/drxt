/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  text: string;
  type: 'success' | 'error' | 'info';
}

export function ToastContainer({ 
  toasts, 
  onClose 
}: { 
  toasts: ToastMessage[]; 
  onClose: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        let bgColor = 'bg-zinc-950/95 text-white';
        let IconElement = Info;
        let iconColor = 'text-sky-400';

        if (toast.type === 'success') {
          bgColor = 'bg-slate-900 border border-emerald-500/30 text-white shadow-xl shadow-emerald-500/5';
          IconElement = CheckCircle2;
          iconColor = 'text-emerald-400';
        } else if (toast.type === 'error') {
          bgColor = 'bg-red-950 border border-red-500/30 text-red-50 shadow-xl shadow-red-500/5';
          IconElement = AlertCircle;
          iconColor = 'text-red-400';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-lg transition-all duration-300 transform translate-y-0 opacity-100 ${bgColor}`}
            role="alert"
          >
            <IconElement className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColor}`} />
            <div className="flex-1 text-sm font-medium leading-5">{toast.text}</div>
            <button
              onClick={() => onClose(toast.id)}
              className="text-zinc-400 hover:text-zinc-200 transition-colors p-0.5 rounded-lg hover:bg-white/5 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
